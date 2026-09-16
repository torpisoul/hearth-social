alter table public.hearth_events add column ends_at timestamptz;
update public.hearth_events set ends_at=starts_at;
alter table public.hearth_events alter column ends_at set not null;
alter table public.hearth_events add column all_day boolean not null default false;
alter table public.hearth_events add column time_zone text not null default 'UTC';
alter table public.hearth_events add constraint hearth_event_range check(ends_at>=starts_at);
create index hearth_events_end on public.hearth_events(ends_at);
drop function public.hearth_save_event(uuid,text,text,timestamptz,text,uuid[]);
drop function hearth_private.save_event(uuid,text,text,timestamptz,text,uuid[]);
create function hearth_private.save_event(plan uuid, plan_title text, plan_place text, plan_start timestamptz, plan_details text, invitees uuid[], plan_end timestamptz default null, plan_all_day boolean default false, plan_zone text default 'UTC') returns uuid
language plpgsql security definer set search_path='' as $$
declare who uuid := auth.uid(); result uuid; selected uuid[] := coalesce(invitees,'{}');
begin
 if who is null or not exists(select 1 from public.hearth_profiles where id=who) then raise exception 'Sign in first.'; end if;
 if plan is not null then
  select id into result from public.hearth_events where id=plan and owner=who for update;
  if result is null then raise exception 'Only the host can edit this plan.'; end if;
 end if;
 if plan_start is null or coalesce(plan_end,plan_start)<plan_start or coalesce(plan_end,plan_start)<=now() then raise exception 'Choose an end after the start and in the future.'; end if;
 if plan_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=plan_zone) then raise exception 'Choose a valid time zone.'; end if;
 if plan_all_day is null then raise exception 'Choose an all-day setting.'; end if;
 if plan_all_day and ((plan_start at time zone plan_zone)::time<>'00:00:00'::time or (plan_end at time zone plan_zone)::time<>'23:59:59'::time or plan_end is null) then raise exception 'All-day plans run from midnight to the end of the last day.'; end if;
 if cardinality(selected)>200 then raise exception 'Choose up to 200 kin for one plan.'; end if;
 if exists(select 1 from unnest(selected) p where p is null or not hearth_private.connected(who,p)) then raise exception 'Invite only your connected kin.'; end if;
 if plan is null then
  insert into public.hearth_events(owner,title,place,starts_at,details,ends_at,all_day,time_zone) values(who,btrim(plan_title),btrim(plan_place),plan_start,coalesce(plan_details,''),coalesce(plan_end,plan_start),plan_all_day,plan_zone) returning id into result;
 else
  update public.hearth_events set title=btrim(plan_title),place=btrim(plan_place),starts_at=plan_start,details=coalesce(plan_details,''),ends_at=coalesce(plan_end,plan_start),all_day=plan_all_day,time_zone=plan_zone where id=result;
 end if;
 delete from public.hearth_rsvps where event=result and person<>who and not(person=any(selected));
 delete from public.hearth_event_invites where event=result and not(person=any(selected));
 insert into public.hearth_event_invites(event,person) select result,p from unnest(selected) p on conflict do nothing;
 return result;
end;
$$;
revoke all on function hearth_private.save_event(uuid,text,text,timestamptz,text,uuid[],timestamptz,boolean,text) from public,anon;
grant execute on function hearth_private.save_event(uuid,text,text,timestamptz,text,uuid[],timestamptz,boolean,text) to authenticated;
create function public.hearth_save_event(plan uuid, plan_title text, plan_place text, plan_start timestamptz, plan_details text, invitees uuid[], plan_end timestamptz default null, plan_all_day boolean default false, plan_zone text default 'UTC') returns uuid
language sql security invoker set search_path='' as $$
 select hearth_private.save_event(plan,plan_title,plan_place,plan_start,plan_details,invitees,plan_end,plan_all_day,plan_zone);
$$;
revoke all on function public.hearth_save_event(uuid,text,text,timestamptz,text,uuid[],timestamptz,boolean,text) from public,anon;
grant execute on function public.hearth_save_event(uuid,text,text,timestamptz,text,uuid[],timestamptz,boolean,text) to authenticated;
