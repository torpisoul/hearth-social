alter table public.hearth_preferences add column notification_zone text not null default 'UTC';
create function hearth_private.validate_notification_preferences() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.notification_zone) then
  raise exception 'Choose a valid time zone.';
 end if;
 if new.notification_time is not null and new.notification_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
  raise exception 'Choose a valid check-in time.';
 end if;
 if new.notification_mode='daily' and new.notification_time is null then
  raise exception 'Choose a daily check-in time.';
 end if;
 return new;
end; $$;
revoke all on function hearth_private.validate_notification_preferences() from public,anon,authenticated;
create trigger validate_notification_preferences before insert or update on public.hearth_preferences
for each row execute function hearth_private.validate_notification_preferences();

-- Private queue holds references only, never content or ciphertext.
create table hearth_private.notification_queue (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null references public.hearth_profiles(id) on delete cascade,
 actor uuid not null references public.hearth_profiles(id) on delete cascade,
 kind text not null check(kind in ('message','moment','invitation','connection')),
 source uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(owner,kind,source)
);
create index notification_queue_owner_time on hearth_private.notification_queue(owner,created_at);
create table hearth_private.notification_delivery (
 owner uuid primary key references public.hearth_profiles(id) on delete cascade,
 token uuid, lease_until timestamptz, claimed uuid[], mode text,
 last_sent timestamptz, last_daily date, next_attempt timestamptz, last_test timestamptz,
 attempts integer not null default 0
);
alter table hearth_private.notification_queue enable row level security;
alter table hearth_private.notification_delivery enable row level security;
revoke all on hearth_private.notification_queue,hearth_private.notification_delivery from public,anon,authenticated;
grant usage on schema hearth_private to service_role;
grant all on hearth_private.notification_queue,hearth_private.notification_delivery to service_role;
grant select,delete on public.hearth_push_subscriptions to service_role;
grant select on public.hearth_preferences,public.hearth_blocks,public.hearth_connections,
 public.hearth_messages,public.hearth_statuses,public.hearth_event_invites,public.hearth_circle to service_role;

create function hearth_private.notification_allowed(q hearth_private.notification_queue) returns boolean
language sql stable security invoker set search_path='' as $$
 select q.owner<>q.actor
 and not exists(select 1 from public.hearth_blocks b where
 (b.owner=q.owner and b.target=q.actor) or(b.owner=q.actor and b.target=q.owner))
 and case q.kind
 when 'connection' then exists(select 1 from public.hearth_connections c where c.requester=q.actor and c.recipient=q.owner and not c.accepted)
 else exists(select 1 from public.hearth_connections c where c.accepted and
 ((c.requester=q.owner and c.recipient=q.actor) or(c.requester=q.actor and c.recipient=q.owner)))
 and case q.kind
 when 'message' then exists(select 1 from public.hearth_messages m where m.id=q.source and m.sender=q.actor and m.recipient=q.owner)
 when 'moment' then exists(select 1 from public.hearth_statuses s join public.hearth_preferences p on p.owner=q.owner
 where s.id=q.source and s.author=q.actor and s.topic=any(p.topics) and
 (s.audience='All kin' or(s.audience='Inner circle' and exists(select 1 from public.hearth_circle c where c.owner=q.actor and c.member=q.owner))))
 when 'invitation' then exists(select 1 from public.hearth_event_invites i where i.event=q.source and i.person=q.owner)
 else false end end;
$$;
revoke all on function hearth_private.notification_allowed(hearth_private.notification_queue) from public,anon,authenticated;
grant execute on function hearth_private.notification_allowed(hearth_private.notification_queue) to service_role;

create function hearth_private.enqueue_notification(recipient uuid,actor uuid,kind text,source uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if recipient=actor or not exists(select 1 from public.hearth_preferences p where p.owner=recipient and p.notification_mode in('immediate','hourly','daily'))
 or not exists(select 1 from public.hearth_push_subscriptions s where s.owner=recipient) then return; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hearth-push:'||recipient::text,0));
 delete from hearth_private.notification_queue where owner=recipient and created_at<now()-interval '7 days';
 if (select count(*) from hearth_private.notification_queue where owner=recipient)>=500 then return; end if;
 insert into hearth_private.notification_queue(owner,actor,kind,source) values(recipient,actor,kind,source) on conflict do nothing;
 insert into hearth_private.notification_delivery(owner) values(recipient) on conflict do nothing;
end; $$;
revoke all on function hearth_private.enqueue_notification(uuid,uuid,text,uuid) from public,anon,authenticated;

create function hearth_private.queue_notification_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; host uuid;
begin
 if TG_TABLE_NAME='hearth_messages' then
  perform hearth_private.enqueue_notification(new.recipient,new.sender,'message',new.id);
 elsif TG_TABLE_NAME='hearth_connections' then
  if not new.accepted then perform hearth_private.enqueue_notification(new.recipient,new.requester,'connection',new.requester); end if;
 elsif TG_TABLE_NAME='hearth_event_invites' then
  select owner into host from public.hearth_events where id=new.event;
  perform hearth_private.enqueue_notification(new.person,host,'invitation',new.event);
 elsif TG_TABLE_NAME='hearth_statuses' and new.audience<>'Only me' then
  for recipient in select case when c.requester=new.author then c.recipient else c.requester end
   from public.hearth_connections c where c.accepted and new.author in(c.requester,c.recipient)
  loop perform hearth_private.enqueue_notification(recipient,new.author,'moment',new.id); end loop;
 end if;
 return new;
end; $$;
revoke all on function hearth_private.queue_notification_event() from public,anon,authenticated;
create trigger notify_message after insert on public.hearth_messages for each row execute function hearth_private.queue_notification_event();
create trigger notify_moment after insert on public.hearth_statuses for each row execute function hearth_private.queue_notification_event();
create trigger notify_invitation after insert on public.hearth_event_invites for each row execute function hearth_private.queue_notification_event();
create trigger notify_connection after insert on public.hearth_connections for each row execute function hearth_private.queue_notification_event();

create function hearth_private.reset_notification_queue() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='hearth_preferences' then
  if (new.notification_mode,new.notification_time,new.notification_zone) is not distinct from
     (old.notification_mode,old.notification_time,old.notification_zone) then return new; end if;
 else
  if exists(select 1 from public.hearth_push_subscriptions where owner=old.owner) then return old; end if;
 end if;
 delete from hearth_private.notification_queue where owner=old.owner;
 delete from hearth_private.notification_delivery where owner=old.owner;
 return old;
end; $$;
revoke all on function hearth_private.reset_notification_queue() from public,anon,authenticated;
create trigger reset_notification_preferences after update on public.hearth_preferences for each row execute function hearth_private.reset_notification_queue();
create trigger reset_notification_devices after delete on public.hearth_push_subscriptions for each row execute function hearth_private.reset_notification_queue();

-- One lease per account prevents simultaneous scheduler invocations sending twice.
create function public.hearth_claim_notifications() returns table(owner uuid,token uuid,mode text)
language plpgsql security invoker set search_path='' as $$
declare d record; p record; ids uuid[]; first_at timestamptz; today date; scheduled timestamptz; lease uuid; claimed_count integer:=0;
begin
 delete from hearth_private.notification_queue q where q.created_at<now()-interval '7 days' or not hearth_private.notification_allowed(q);
 for d in select s.* from hearth_private.notification_delivery s
 where (s.lease_until is null or s.lease_until<now()) and (s.next_attempt is null or s.next_attempt<=now())
 and exists(select 1 from hearth_private.notification_queue q where q.owner=s.owner)
 order by s.last_sent nulls first for update skip locked
 loop
  select * into p from public.hearth_preferences where hearth_preferences.owner=d.owner;
  if coalesce(p.notification_mode,'in_app') not in('immediate','hourly','daily') or not exists(select 1 from public.hearth_push_subscriptions s where s.owner=d.owner) then continue; end if;
  select array_agg(q.id),min(q.created_at) into ids,first_at from hearth_private.notification_queue q where q.owner=d.owner;
  if ids is null then continue; end if;
  today:=(now() at time zone p.notification_zone)::date;
  scheduled:=(today+p.notification_time::time) at time zone p.notification_zone;
  if p.notification_mode='hourly' and (now()<first_at+interval '1 hour' or now()<d.last_sent+interval '1 hour') then continue; end if;
  if p.notification_mode='daily' and (now()<scheduled or first_at>scheduled or d.last_daily=today) then continue; end if;
  if p.notification_mode='immediate' and now()<d.last_sent+interval '1 minute' then continue; end if;
  lease:=gen_random_uuid();
  update hearth_private.notification_delivery s set token=lease,lease_until=now()+interval '5 minutes',claimed=ids,mode=p.notification_mode where s.owner=d.owner;
  owner:=d.owner; token:=lease; mode:=p.notification_mode; return next;
  claimed_count:=claimed_count+1; if claimed_count>=20 then exit; end if;
 end loop;
end; $$;
revoke all on function public.hearth_claim_notifications() from public,anon,authenticated;
grant execute on function public.hearth_claim_notifications() to service_role;

-- Recheck consent and access immediately before delivery, including blocks and removals.
create function public.hearth_notification_targets(person uuid,lease uuid) returns table(endpoint text,p256dh text,auth text)
language sql stable security invoker set search_path='' as $$
 select s.endpoint,s.p256dh,s.auth from public.hearth_push_subscriptions s
 join hearth_private.notification_delivery d on d.owner=s.owner
 join public.hearth_preferences p on p.owner=s.owner
 where s.owner=person and d.token=lease and d.lease_until>now() and p.notification_mode=d.mode
 and p.notification_mode in('immediate','hourly','daily')
 and exists(select 1 from hearth_private.notification_queue q where q.id=any(d.claimed) and hearth_private.notification_allowed(q))
 order by s.created_at limit 10;
$$;
revoke all on function public.hearth_notification_targets(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hearth_notification_targets(uuid,uuid) to service_role;

create function public.hearth_finish_notifications(person uuid,lease uuid,delivered boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare d record; zone text;
begin
 select * into d from hearth_private.notification_delivery where owner=person and token=lease for update;
 if not found then return; end if;
 select notification_zone into zone from public.hearth_preferences where owner=person;
 if delivered or d.attempts>=4 then delete from hearth_private.notification_queue where id=any(d.claimed); end if;
 update hearth_private.notification_delivery set token=null,lease_until=null,claimed=null,
 last_sent=case when delivered then now() else last_sent end,
 last_daily=case when delivered and d.mode='daily' then (now() at time zone zone)::date else last_daily end,
 attempts=case when delivered or d.attempts>=4 then 0 else d.attempts+1 end,
 next_attempt=case when delivered then null else now()+interval '5 minutes' end where owner=person;
end; $$;
revoke all on function public.hearth_finish_notifications(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.hearth_finish_notifications(uuid,uuid,boolean) to service_role;

create function hearth_private.allow_push_test() returns boolean
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if who is null or not exists(select 1 from public.hearth_preferences where owner=who and notification_mode in('immediate','hourly','daily')) then return false; end if;
 insert into hearth_private.notification_delivery(owner) values(who) on conflict do nothing;
 update hearth_private.notification_delivery set last_test=now() where owner=who and (last_test is null or last_test<now()-interval '1 minute');
 return found;
end; $$;
revoke all on function hearth_private.allow_push_test() from public,anon;
grant execute on function hearth_private.allow_push_test() to authenticated;
create function public.hearth_allow_push_test() returns boolean language sql security invoker set search_path='' as $$select hearth_private.allow_push_test();$$;
revoke all on function public.hearth_allow_push_test() from public,anon;
grant execute on function public.hearth_allow_push_test() to authenticated;
