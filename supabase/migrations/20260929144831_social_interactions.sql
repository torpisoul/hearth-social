alter table public.hearth_messages add column received_at timestamptz not null default now();
update public.hearth_messages set received_at=created_at;
-- Preserve server-owned sent time when a waiting note is delivered.
create function hearth_private.waiting_sent_time() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.received_at:=clock_timestamp();
 select w.created_at into new.created_at from public.hearth_waiting_notes w
 where w.id=new.id and w.sender=new.sender and w.recipient=new.recipient;
 if not found then new.created_at:=now(); end if;
 return new;
end; $$;
revoke all on function hearth_private.waiting_sent_time() from public,anon,authenticated;
create trigger message_sent_time before insert on public.hearth_messages for each row execute function hearth_private.waiting_sent_time();

-- Dismissals follow the account and the particular connection lifetime.
create table public.hearth_invite_dismissals(
 owner uuid not null references public.hearth_profiles(id) on delete cascade,
 requester uuid not null, recipient uuid not null,
 primary key(owner,requester,recipient),
 foreign key(requester,recipient) references public.hearth_connections(requester,recipient) on delete cascade,
 check(owner in(requester,recipient))
);
alter table public.hearth_invite_dismissals enable row level security;
revoke all on public.hearth_invite_dismissals from public,anon,authenticated;
grant select,insert,delete on public.hearth_invite_dismissals to authenticated;
create policy dismissals_own on public.hearth_invite_dismissals for all to authenticated using(owner=(select auth.uid())) with check(owner=(select auth.uid()));

create table public.hearth_post_replies(
 id uuid primary key default gen_random_uuid(), post uuid not null references public.hearth_statuses(id) on delete cascade,
 author uuid not null default auth.uid() references public.hearth_profiles(id) on delete cascade,
 content text not null check(length(trim(content)) between 1 and 1500), created_at timestamptz not null default now()
);
create index post_reply_order on public.hearth_post_replies(post,created_at,id);
alter table public.hearth_post_replies enable row level security;
revoke all on public.hearth_post_replies from public,anon,authenticated;
grant select,delete on public.hearth_post_replies to authenticated;
grant insert(post,content) on public.hearth_post_replies to authenticated;
create policy replies_read on public.hearth_post_replies for select to authenticated using(exists(select 1 from public.hearth_statuses s where s.id=post));
create policy replies_create on public.hearth_post_replies for insert to authenticated with check(author=(select auth.uid()) and exists(select 1 from public.hearth_statuses s where s.id=post));
create policy replies_delete on public.hearth_post_replies for delete to authenticated using(author=(select auth.uid()) or exists(select 1 from public.hearth_statuses s where s.id=post and s.author=(select auth.uid())));
create table public.hearth_post_reactions(
 post uuid not null references public.hearth_statuses(id) on delete cascade,
 actor uuid not null default auth.uid() references public.hearth_profiles(id) on delete cascade,
 emoji text not null check(emoji in('♥','🌱','☀️','🫂')), primary key(post,actor)
);
alter table public.hearth_post_reactions enable row level security;
revoke all on public.hearth_post_reactions from public,anon,authenticated;
grant select,insert,delete on public.hearth_post_reactions to authenticated;
grant update on public.hearth_post_reactions to authenticated;
create policy reactions_own on public.hearth_post_reactions for all to authenticated using(actor=(select auth.uid()) and exists(select 1 from public.hearth_statuses s where s.id=post)) with check(actor=(select auth.uid()) and exists(select 1 from public.hearth_statuses s where s.id=post));

-- Metadata points only at private user-scoped objects. Four images per post.
create table public.hearth_status_media(
 status uuid not null references public.hearth_statuses(id) on delete cascade,
 owner uuid not null default auth.uid() references public.hearth_profiles(id) on delete cascade,
 path text not null unique, position integer not null check(position between 0 and 3),
 created_at timestamptz not null default now(), primary key(status,position),
 check(path like owner::text||'/%' and path !~ '\.\.')
);
alter table public.hearth_status_media enable row level security;
revoke all on public.hearth_status_media from public,anon,authenticated;
grant select,insert,delete on public.hearth_status_media to authenticated;
create policy media_read on public.hearth_status_media for select to authenticated using(exists(select 1 from public.hearth_statuses s where s.id=status));
create policy media_create on public.hearth_status_media for insert to authenticated with check(owner=(select auth.uid()) and exists(select 1 from public.hearth_statuses s where s.id=status and s.author=(select auth.uid())));
create policy media_delete on public.hearth_status_media for delete to authenticated using(owner=(select auth.uid()));
-- Supabase owns the storage schema. Tests provision its minimal policy contract.
do $$ begin
 if to_regclass('storage.objects') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('hearth-moments','hearth-moments',false,2097152,array['image/webp','image/jpeg','image/png']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
 execute $p$create policy moment_image_read on storage.objects for select to authenticated using(bucket_id='hearth-moments' and (split_part(name,'/',1)=(select auth.uid())::text or exists(select 1 from public.hearth_status_media m where m.path=name)))$p$;
 execute $p$create policy moment_image_create on storage.objects for insert to authenticated with check(bucket_id='hearth-moments' and split_part(name,'/',1)=(select auth.uid())::text and name !~ '\.\.')$p$;
 execute $p$create policy moment_image_delete on storage.objects for delete to authenticated using(bucket_id='hearth-moments' and split_part(name,'/',1)=(select auth.uid())::text)$p$;
 end if;
end $$;

-- A narrow service-only sweep catches failed uploads, cascade-deleted posts and
-- deleted accounts. Storage API removal (not SQL DELETE) deletes the actual file.
create function hearth_private.orphan_moment_images() returns table(path text) language plpgsql security definer set search_path='' as $$
begin
 if to_regclass('storage.objects') is not null then
 return query execute $q$select o.name::text from storage.objects o where o.bucket_id='hearth-moments' and o.created_at<now()-interval '24 hours' and not exists(select 1 from public.hearth_status_media m where m.path=o.name) order by o.created_at limit 100$q$;
 end if;
end; $$;
revoke all on function hearth_private.orphan_moment_images() from public,anon,authenticated;
grant usage on schema hearth_private to service_role;
grant execute on function hearth_private.orphan_moment_images() to service_role;
create function public.hearth_orphan_moment_images() returns table(path text) language sql security invoker set search_path='' as $$select * from hearth_private.orphan_moment_images()$$;
revoke all on function public.hearth_orphan_moment_images() from public,anon,authenticated;
grant execute on function public.hearth_orphan_moment_images() to service_role;

alter table public.hearth_post_replies add column author_name text not null default '';
create function hearth_private.reply_author_name() returns trigger language plpgsql security invoker set search_path='' as $$
begin select name into new.author_name from public.hearth_profiles where id=auth.uid(); return new; end; $$;
revoke all on function hearth_private.reply_author_name() from public,anon,authenticated;
create trigger reply_author before insert on public.hearth_post_replies for each row execute function hearth_private.reply_author_name();

-- Cover unread lookups and the referencing side of account/connection cascades.
create index hearth_message_arrivals on public.hearth_messages(recipient,sender,received_at desc);
create index invite_dismissal_connection on public.hearth_invite_dismissals(requester,recipient);
create index post_reply_author on public.hearth_post_replies(author);
create index post_reaction_actor on public.hearth_post_reactions(actor);
create index status_media_owner on public.hearth_status_media(owner);
