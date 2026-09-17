-- Existing audiences remain valid. Deleted groups fail closed without deleting moments.
alter table public.hearth_statuses add column audience_group uuid
 references public.hearth_kin_groups(id) on delete set null;
create index hearth_status_group on public.hearth_statuses(audience_group) where audience_group is not null;
alter table public.hearth_statuses drop constraint hearth_statuses_audience_check;
alter table public.hearth_statuses add constraint hearth_statuses_audience_check
 check(audience in ('Only me','Inner circle','All kin','Group'));
alter table public.hearth_statuses add constraint hearth_statuses_group_check
 check(audience='Group' or audience_group is null);

-- Membership stays private. This helper answers only for the caller, not arbitrary people.
create function hearth_private.in_moment_group(actor uuid, chosen_group uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.hearth_kin_group_members m
 where m.owner=actor and m.group_id=chosen_group and m.person=auth.uid());
$$;
revoke all on function hearth_private.in_moment_group(uuid,uuid) from public,anon,authenticated;
grant execute on function hearth_private.in_moment_group(uuid,uuid) to authenticated;
alter policy statuses_read on public.hearth_statuses to authenticated using(
 author=(select auth.uid()) or (
 hearth_private.connected((select auth.uid()),author) and (
 audience='All kin' or
 (audience='Inner circle' and hearth_private.in_circle(author,(select auth.uid()))) or
 (audience='Group' and hearth_private.in_moment_group(author,audience_group))
 )));
alter policy statuses_create on public.hearth_statuses to authenticated with check(
 author=(select auth.uid()) and (audience<>'Group' or exists(
 select 1 from public.hearth_kin_groups g where g.id=audience_group and g.owner=(select auth.uid())
 )));
-- The sender rechecks membership immediately before notification delivery.
grant select on public.hearth_kin_group_members to service_role;
create or replace function hearth_private.notification_allowed(q hearth_private.notification_queue) returns boolean
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
 (s.audience='Group' and exists(select 1 from public.hearth_kin_group_members gm where gm.owner=s.author and gm.group_id=s.audience_group and gm.person=q.owner) or s.audience='All kin' or(s.audience='Inner circle' and exists(select 1 from public.hearth_circle c where c.owner=q.actor and c.member=q.owner))))
 when 'invitation' then exists(select 1 from public.hearth_event_invites i where i.event=q.source and i.person=q.owner)
 else false end end;
$$;
