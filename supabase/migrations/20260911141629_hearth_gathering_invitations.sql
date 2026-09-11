-- A host's full invitation list is private. Guests see accepted RSVPs only.
create table public.hearth_event_invites (
 event uuid not null references public.hearth_events(id) on delete cascade,
 person uuid not null references public.hearth_profiles(id) on delete cascade,
 primary key(event,person)
);
create index hearth_event_invites_person on public.hearth_event_invites(person,event);
alter table public.hearth_event_invites enable row level security;
revoke all on public.hearth_event_invites from public,anon,authenticated;
grant select on public.hearth_event_invites to authenticated;
-- Preserve the audience of plans already shared with all current kin.
insert into public.hearth_event_invites(event,person)
select e.id, case when c.requester=e.owner then c.recipient else c.requester end
from public.hearth_events e join public.hearth_connections c on c.accepted and e.owner in(c.requester,c.recipient)
where not exists(select 1 from public.hearth_blocks b where (b.owner=c.requester and b.target=c.recipient) or (b.owner=c.recipient and b.target=c.requester))
on conflict do nothing;

create function hearth_private.can_view_event(plan uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.hearth_events e where e.id=plan and
 (e.owner=auth.uid() or (hearth_private.connected(auth.uid(),e.owner)
 and exists(select 1 from public.hearth_event_invites i where i.event=e.id and i.person=auth.uid()))));
$$;
revoke all on function hearth_private.can_view_event(uuid) from public,anon;
grant execute on function hearth_private.can_view_event(uuid) to authenticated;
drop policy events_read on public.hearth_events;
create policy events_read on public.hearth_events for select to authenticated using(hearth_private.can_view_event(id));
create policy invites_host_read on public.hearth_event_invites for select to authenticated using(
 exists(select 1 from public.hearth_events e where e.id=event and e.owner=(select auth.uid())));
drop policy rsvps_read on public.hearth_rsvps;
drop policy rsvps_create on public.hearth_rsvps;
create policy rsvps_read on public.hearth_rsvps for select to authenticated using(hearth_private.can_view_event(event));
create policy rsvps_create on public.hearth_rsvps for insert to authenticated with check(
 person=(select auth.uid()) and hearth_private.can_view_event(event));
-- Creation and edits use one transaction so details and invitations cannot diverge.
revoke insert(title,place,starts_at,details) on public.hearth_events from authenticated;
create function hearth_private.save_event(plan uuid, plan_title text, plan_place text, plan_start timestamptz, plan_details text, invitees uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare who uuid := auth.uid(); result uuid; selected uuid[] := coalesce(invitees,'{}');
begin
 if who is null or not exists(select 1 from public.hearth_profiles where id=who) then raise exception 'Sign in first.'; end if;
 if plan is not null then
  select id into result from public.hearth_events where id=plan and owner=who for update;
  if result is null then raise exception 'Only the host can edit this plan.'; end if;
 end if;
 if plan_start is null or plan_start<=now() then raise exception 'Choose a time in the future.'; end if;
 if cardinality(selected)>200 then raise exception 'Choose up to 200 kin for one plan.'; end if;
 if exists(select 1 from unnest(selected) p where p is null or not hearth_private.connected(who,p)) then raise exception 'Invite only your connected kin.'; end if;
 if plan is null then
  insert into public.hearth_events(owner,title,place,starts_at,details) values(who,btrim(plan_title),btrim(plan_place),plan_start,coalesce(plan_details,'')) returning id into result;
 else
  update public.hearth_events set title=btrim(plan_title),place=btrim(plan_place),starts_at=plan_start,details=coalesce(plan_details,'') where id=result;
 end if;
 delete from public.hearth_rsvps where event=result and person<>who and not(person=any(selected));
 delete from public.hearth_event_invites where event=result and not(person=any(selected));
 insert into public.hearth_event_invites(event,person) select result,p from unnest(selected) p on conflict do nothing;
 return result;
end;
$$;
revoke all on function hearth_private.save_event(uuid,text,text,timestamptz,text,uuid[]) from public,anon;
grant execute on function hearth_private.save_event(uuid,text,text,timestamptz,text,uuid[]) to authenticated;
create function public.hearth_save_event(plan uuid, plan_title text, plan_place text, plan_start timestamptz, plan_details text, invitees uuid[]) returns uuid
language sql security invoker set search_path='' as $$
 select hearth_private.save_event(plan,plan_title,plan_place,plan_start,plan_details,invitees);
$$;
revoke all on function public.hearth_save_event(uuid,text,text,timestamptz,text,uuid[]) from public,anon;
grant execute on function public.hearth_save_event(uuid,text,text,timestamptz,text,uuid[]) to authenticated;
-- Reveal only accepted guests' display names to people who can view that plan.
-- This avoids expanding the private profile table's audience.
create function hearth_private.event_attendees(plans uuid[]) returns table(event uuid,person uuid,name text)
language sql stable security definer set search_path='' as $$
 select r.event,r.person,p.name from public.hearth_rsvps r join public.hearth_profiles p on p.id=r.person
 where auth.uid() is not null and r.event=any(plans) and hearth_private.can_view_event(r.event);
$$;
revoke all on function hearth_private.event_attendees(uuid[]) from public,anon;
grant execute on function hearth_private.event_attendees(uuid[]) to authenticated;
create function public.hearth_event_attendees(plans uuid[]) returns table(event uuid,person uuid,name text)
language sql security invoker set search_path='' as $$select * from hearth_private.event_attendees(plans);$$;
revoke all on function public.hearth_event_attendees(uuid[]) from public,anon;
grant execute on function public.hearth_event_attendees(uuid[]) to authenticated;
