create table public.hearth_push_subscriptions (
 owner uuid not null references public.hearth_profiles(id) on delete cascade,
 endpoint text primary key check(length(endpoint) <= 2048 and endpoint ~ '^https://'),
 p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{87}$'),
 auth text not null check(auth ~ '^[A-Za-z0-9_-]{22}$'),
 created_at timestamptz not null default now()
);
alter table public.hearth_push_subscriptions enable row level security;
revoke all on public.hearth_push_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.hearth_push_subscriptions to authenticated;
create policy push_own on public.hearth_push_subscriptions for all to authenticated
 using(owner=(select auth.uid())) with check(owner=(select auth.uid()));
create index hearth_push_owner on public.hearth_push_subscriptions(owner);
