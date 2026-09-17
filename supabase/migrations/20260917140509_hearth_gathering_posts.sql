-- Gathering posts remain host-owned moments; accepting an invitation grants access
-- to earlier posts too. Removing an invitation or RSVP revokes that access.
alter table public.hearth_statuses add column audience_event uuid
 references public.hearth_events(id) on delete set null;
create index hearth_status_event on public.hearth_statuses(audience_event) where audience_event is not null;
alter table public.hearth_statuses drop constraint hearth_statuses_audience_check;
alter table public.hearth_statuses add constraint hearth_statuses_audience_check
 check(audience in ('Only me','Inner circle','All kin','Group','Gathering'));
alter table public.hearth_statuses add constraint hearth_statuses_event_check
 check(audience='Gathering' or audience_event is null);

create function hearth_private.attending_post(plan uuid, actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.hearth_events e
 join public.hearth_event_invites i on i.event=e.id and i.person=auth.uid()
 join public.hearth_rsvps r on r.event=e.id and r.person=auth.uid()
 where e.id=plan and e.owner=actor and hearth_private.connected(auth.uid(),actor));
$$;
revoke all on function hearth_private.attending_post(uuid,uuid) from public,anon;
grant execute on function hearth_private.attending_post(uuid,uuid) to authenticated;

alter policy statuses_read on public.hearth_statuses to authenticated using(
 author=(select auth.uid()) or (
 hearth_private.connected((select auth.uid()),author) and (
 audience='All kin' or
 (audience='Inner circle' and hearth_private.in_circle(author,(select auth.uid()))) or
 (audience='Group' and hearth_private.in_moment_group(author,audience_group)) or
 (audience='Gathering' and hearth_private.attending_post(audience_event,author))
 )));
alter policy statuses_create on public.hearth_statuses to authenticated with check(
 author=(select auth.uid()) and
 (audience<>'Group' or exists(select 1 from public.hearth_kin_groups g where g.id=audience_group and g.owner=(select auth.uid()))) and
 (audience<>'Gathering' or exists(select 1 from public.hearth_events e where e.id=audience_event and e.owner=(select auth.uid())))
);
