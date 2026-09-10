-- New Supabase project only. All browser operations run with the authenticated role.
create schema if not exists hearth_private;
revoke all on schema hearth_private from public;
grant usage on schema hearth_private to authenticated;
create table public.hearth_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 40),
 created_at timestamptz not null default now()
);
create table public.hearth_connections (
 requester uuid references public.hearth_profiles(id) on delete cascade,
 recipient uuid references public.hearth_profiles(id) on delete cascade,
 accepted boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(requester,recipient), check(requester <> recipient)
);
create unique index hearth_pair on public.hearth_connections(least(requester,recipient),greatest(requester,recipient));
create table public.hearth_blocks (
 owner uuid references public.hearth_profiles(id) on delete cascade,
 target uuid references public.hearth_profiles(id) on delete cascade,
 primary key(owner,target), check(owner <> target)
);
create table public.hearth_circle (
 owner uuid references public.hearth_profiles(id) on delete cascade,
 member uuid references public.hearth_profiles(id) on delete cascade,
 primary key(owner,member), check(owner <> member)
);
create table public.hearth_statuses (
 id uuid primary key default gen_random_uuid(),
 author uuid not null references public.hearth_profiles(id) on delete cascade,
 content text not null check(length(trim(content)) between 1 and 1500),
 audience text not null default 'Only me' check(audience in ('Only me','Inner circle','All kin')),
 topic text not null check(topic in ('Everyday life','Little joys','Outdoors','Making things')),
 created_at timestamptz not null default now()
);
create table public.hearth_keys (
 owner uuid primary key references public.hearth_profiles(id) on delete cascade,
 public_key jsonb not null check((public_key->>'kty'='EC' and public_key->>'crv'='P-256' and length(public_key->>'x')=43 and length(public_key->>'y')=43 and not public_key ? 'd') is true),
 vault jsonb not null check ((vault->>'version'='1' and length(vault->>'salt')=24 and length(vault->>'iv')=16 and length(vault->>'ciphertext') between 100 and 8000 and octet_length(vault::text)<10000) is true),
 created_at timestamptz not null default now()
);
create table public.hearth_messages (
 id uuid primary key,
 sender uuid not null references public.hearth_profiles(id) on delete cascade,
 recipient uuid not null references public.hearth_profiles(id) on delete cascade,
 ciphertext text not null check(length(ciphertext) between 20 and 16000),
 iv text not null check(length(iv)=16),
 version integer not null default 1 check(version=1),
 created_at timestamptz not null default now(), check(sender <> recipient)
);
create index hearth_status_time on public.hearth_statuses(created_at desc,id desc);
create index hearth_messages_inbox on public.hearth_messages(recipient,created_at desc);
create index hearth_messages_outbox on public.hearth_messages(sender,created_at desc);
create function hearth_private.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() in (a,b) and exists(select 1 from public.hearth_blocks where (owner=a and target=b) or (owner=b and target=a));
$$;
create function hearth_private.connected(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() in (a,b) and not hearth_private.blocked(a,b) and exists(select 1 from public.hearth_connections where accepted and ((requester=a and recipient=b) or(requester=b and recipient=a)));
$$;
create function hearth_private.related(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() in (a,b) and (a=b or (not hearth_private.blocked(a,b) and exists(select 1 from public.hearth_connections where (requester=a and recipient=b) or(requester=b and recipient=a))));
$$;
create function hearth_private.in_circle(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() in (a,b) and exists(select 1 from public.hearth_circle where owner=a and member=b);
$$;
revoke all on all functions in schema hearth_private from public;
grant execute on all functions in schema hearth_private to authenticated;

alter table public.hearth_profiles enable row level security;
alter table public.hearth_connections enable row level security;
alter table public.hearth_blocks enable row level security;
alter table public.hearth_circle enable row level security;
alter table public.hearth_statuses enable row level security;
alter table public.hearth_keys enable row level security;
alter table public.hearth_messages enable row level security;
-- Explicit grants avoid depending on Supabase's default table privileges.
revoke all on public.hearth_profiles, public.hearth_connections, public.hearth_blocks, public.hearth_circle, public.hearth_statuses, public.hearth_keys, public.hearth_messages from anon, authenticated;
grant select,insert on public.hearth_profiles to authenticated;
grant update(name) on public.hearth_profiles to authenticated;
grant select on public.hearth_connections to authenticated;
grant select,insert,delete on public.hearth_blocks,public.hearth_circle to authenticated;
grant select,insert,delete on public.hearth_statuses to authenticated;
grant insert on public.hearth_keys to authenticated;
grant select,insert on public.hearth_messages to authenticated;
create policy profiles_read on public.hearth_profiles for select to authenticated using(hearth_private.related(auth.uid(),id));
create policy profiles_create on public.hearth_profiles for insert to authenticated with check(id=auth.uid());
create policy profiles_edit on public.hearth_profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy connections_read on public.hearth_connections for select to authenticated using(auth.uid() in(requester,recipient) and not hearth_private.blocked(requester,recipient));
create policy blocks_own on public.hearth_blocks for all to authenticated using(owner=auth.uid()) with check(owner=auth.uid());
create policy circle_own on public.hearth_circle for all to authenticated using(owner=auth.uid()) with check(owner=auth.uid() and hearth_private.connected(owner,member));
create policy statuses_read on public.hearth_statuses for select to authenticated using(author=auth.uid() or(hearth_private.connected(auth.uid(),author) and(audience='All kin' or(audience='Inner circle' and hearth_private.in_circle(author,auth.uid())))));
create policy statuses_create on public.hearth_statuses for insert to authenticated with check(author=auth.uid());
create policy statuses_delete on public.hearth_statuses for delete to authenticated using(author=auth.uid());
create policy keys_create on public.hearth_keys for insert to authenticated with check(owner=auth.uid());
create policy messages_read on public.hearth_messages for select to authenticated using(auth.uid() in(sender,recipient));
create policy messages_create on public.hearth_messages for insert to authenticated with check(sender=auth.uid() and hearth_private.connected(sender,recipient) and exists(select 1 from public.hearth_profiles where id=recipient));

-- Public key lookup never returns encrypted private-key vaults to other users.
create function public.hearth_public_key(person uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select public_key from public.hearth_keys where owner=person and (person=auth.uid() or hearth_private.connected(auth.uid(),person));
$$;
create function public.hearth_my_vault() returns jsonb language sql stable security definer set search_path='' as $$
 select vault from public.hearth_keys where owner=auth.uid();
$$;
create function public.hearth_request_friend(person uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or person=auth.uid() or hearth_private.blocked(auth.uid(),person) then raise exception 'Unable to send request'; end if;
 if not exists(select 1 from public.hearth_profiles where id=person) then raise exception 'Unable to send request'; end if;
 insert into public.hearth_connections(requester,recipient) values(auth.uid(),person) on conflict do nothing;
end; $$;
create function public.hearth_accept_friend(person uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or hearth_private.blocked(auth.uid(),person) then raise exception 'Unable to accept request'; end if;
 update public.hearth_connections set accepted=true where requester=person and recipient=auth.uid();
 if not found then raise exception 'Request not found'; end if;
end; $$;
create function public.hearth_remove_friend(person uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.hearth_connections where (requester=auth.uid() and recipient=person) or(requester=person and recipient=auth.uid());
 delete from public.hearth_circle where(owner=auth.uid() and member=person) or(owner=person and member=auth.uid());
end; $$;
revoke all on function public.hearth_public_key(uuid),public.hearth_my_vault(),public.hearth_request_friend(uuid),public.hearth_accept_friend(uuid),public.hearth_remove_friend(uuid) from public,anon;
grant execute on function public.hearth_public_key(uuid),public.hearth_my_vault(),public.hearth_request_friend(uuid),public.hearth_accept_friend(uuid),public.hearth_remove_friend(uuid) to authenticated;

-- Index both sides of access checks and foreign keys.
create index hearth_connections_recipient on public.hearth_connections(recipient);
create index hearth_blocks_target on public.hearth_blocks(target);
create index hearth_circle_member on public.hearth_circle(member);
create index hearth_statuses_author on public.hearth_statuses(author,created_at desc);
-- Server timestamps and per-account write limits; advisory lock prevents concurrent bypass.
create function hearth_private.guard_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; recent bigint;
begin
 actor:=auth.uid();
 if actor is null then raise exception 'Not authorized'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || TG_TABLE_NAME,0));
 new.created_at:=now();
 if TG_TABLE_NAME='hearth_messages' then
  if new.sender<>actor then raise exception 'Not authorized'; end if;
  select count(*) into recent from public.hearth_messages where sender=actor and created_at>now()-interval '1 minute';
  if recent>=30 then raise exception 'Please wait a minute before sending more messages'; end if;
 elsif TG_TABLE_NAME='hearth_statuses' then
  if new.author<>actor then raise exception 'Not authorized'; end if;
  select count(*) into recent from public.hearth_statuses where author=actor and created_at>now()-interval '1 hour';
  if recent>=30 then raise exception 'Please wait before sharing more moments'; end if;
 elsif TG_TABLE_NAME='hearth_connections' then
  select count(*) into recent from public.hearth_connections where requester=actor and created_at>now()-interval '1 hour';
  if recent>=20 then raise exception 'Please wait before sending more connection requests'; end if;
 end if;
 return new;
end; $$;
revoke all on function hearth_private.guard_write() from public,anon,authenticated;
create trigger guard_messages before insert on public.hearth_messages for each row execute function hearth_private.guard_write();
create trigger guard_statuses before insert on public.hearth_statuses for each row execute function hearth_private.guard_write();
create trigger guard_connections before insert on public.hearth_connections for each row execute function hearth_private.guard_write();

-- Keep privileged implementations outside the exposed API schema.
alter function public.hearth_public_key(uuid) set schema hearth_private;
alter function public.hearth_my_vault() set schema hearth_private;
alter function public.hearth_request_friend(uuid) set schema hearth_private;
alter function public.hearth_accept_friend(uuid) set schema hearth_private;
alter function public.hearth_remove_friend(uuid) set schema hearth_private;
create function public.hearth_public_key(person uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select hearth_private.hearth_public_key(person); $$;
create function public.hearth_my_vault() returns jsonb language sql stable security invoker set search_path='' as $$ select hearth_private.hearth_my_vault(); $$;
create function public.hearth_request_friend(person uuid) returns void language sql security invoker set search_path='' as $$ select hearth_private.hearth_request_friend(person); $$;
create function public.hearth_accept_friend(person uuid) returns void language sql security invoker set search_path='' as $$ select hearth_private.hearth_accept_friend(person); $$;
create function public.hearth_remove_friend(person uuid) returns void language sql security invoker set search_path='' as $$ select hearth_private.hearth_remove_friend(person); $$;
revoke all on function public.hearth_public_key(uuid),public.hearth_my_vault(),public.hearth_request_friend(uuid),public.hearth_accept_friend(uuid),public.hearth_remove_friend(uuid) from public,anon;
grant execute on function public.hearth_public_key(uuid),public.hearth_my_vault(),public.hearth_request_friend(uuid),public.hearth_accept_friend(uuid),public.hearth_remove_friend(uuid) to authenticated;

