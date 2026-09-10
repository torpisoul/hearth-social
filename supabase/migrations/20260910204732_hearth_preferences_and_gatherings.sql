create table public.hearth_preferences (
 owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 topics text[] not null default '{}' check(topics <@ array['Everyday life','Little joys','Outdoors','Making things']::text[] and cardinality(topics)<=4),
 update_mode text not null default 'manual' check(update_mode in('manual','foreground'))
);
alter table public.hearth_preferences enable row level security;
revoke all on public.hearth_preferences from public,anon,authenticated;
grant select,insert,update on public.hearth_preferences to authenticated;
create policy preferences_own on public.hearth_preferences for all to authenticated using(owner=(select auth.uid())) with check(owner=(select auth.uid()));
alter table public.hearth_profiles add column avatar text check(avatar is null or (length(avatar)<=80000 and avatar ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$'));
create table public.hearth_events (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null default auth.uid() references public.hearth_profiles(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 100),
 place text not null check(length(btrim(place)) between 1 and 200),
 starts_at timestamptz not null,
 details text not null default '' check(length(details)<=1500),
 created_at timestamptz not null default now()
);
create index hearth_events_owner on public.hearth_events(owner);
create index hearth_events_start on public.hearth_events(starts_at);
alter table public.hearth_events enable row level security;
revoke all on public.hearth_events from public,anon,authenticated;
grant select,delete on public.hearth_events to authenticated;
grant insert(title,place,starts_at,details) on public.hearth_events to authenticated;
create policy events_read on public.hearth_events for select to authenticated using(owner=(select auth.uid()) or hearth_private.connected((select auth.uid()),owner));
create policy events_create on public.hearth_events for insert to authenticated with check(owner=(select auth.uid()));
create policy events_delete on public.hearth_events for delete to authenticated using(owner=(select auth.uid()));
create table public.hearth_rsvps (
 event uuid references public.hearth_events(id) on delete cascade,
 person uuid default auth.uid() references public.hearth_profiles(id) on delete cascade,
 primary key(event,person)
);
create index hearth_rsvps_person on public.hearth_rsvps(person);
alter table public.hearth_rsvps enable row level security;
revoke all on public.hearth_rsvps from public,anon,authenticated;
grant select,delete on public.hearth_rsvps to authenticated;
grant insert(event) on public.hearth_rsvps to authenticated;
create policy rsvps_read on public.hearth_rsvps for select to authenticated using(exists(select 1 from public.hearth_events e where e.id=hearth_rsvps.event and (e.owner=(select auth.uid()) or hearth_private.connected((select auth.uid()),e.owner))));
create policy rsvps_create on public.hearth_rsvps for insert to authenticated with check(person=(select auth.uid()) and exists(select 1 from public.hearth_events e where e.id=hearth_rsvps.event and (e.owner=(select auth.uid()) or hearth_private.connected((select auth.uid()),e.owner))));
create policy rsvps_delete on public.hearth_rsvps for delete to authenticated using(person=(select auth.uid()));
