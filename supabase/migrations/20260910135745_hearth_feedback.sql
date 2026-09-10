create table public.hearth_feedback (
  id uuid primary key default gen_random_uuid(),
  author uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index hearth_feedback_author_time on public.hearth_feedback(author, created_at);
alter table public.hearth_feedback enable row level security;
revoke all on public.hearth_feedback from public, anon, authenticated;
grant select on public.hearth_feedback to authenticated;
grant insert(content) on public.hearth_feedback to authenticated;
create policy feedback_read_own on public.hearth_feedback for select to authenticated
  using (author = (select auth.uid()));
create policy feedback_create_own on public.hearth_feedback for insert to authenticated
  with check (author = (select auth.uid()));
-- The invoker sees only their own notes through RLS. Serialize their writes
-- so simultaneous requests cannot bypass the five-notes-per-hour limit.
create function hearth_private.guard_feedback() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or new.author <> auth.uid() then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hearth-feedback:' || auth.uid()::text, 0));
  if (select count(*) from public.hearth_feedback where author = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Your notes are saved. Come back in a little while if you have more to add.';
  end if;
  return new;
end; $$;
revoke all on function hearth_private.guard_feedback() from public, anon, authenticated;
create trigger feedback_guard before insert on public.hearth_feedback
  for each row execute function hearth_private.guard_feedback();
