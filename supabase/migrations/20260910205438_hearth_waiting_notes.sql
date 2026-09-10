-- Waiting ciphertext is encrypted to the sender's own key. The recipient can
-- see that a note is waiting but cannot decrypt it until the sender forwards it.
create table public.hearth_waiting_notes (
 id uuid primary key,
 sender uuid not null references public.hearth_profiles(id) on delete cascade,
 recipient uuid not null references public.hearth_profiles(id) on delete cascade,
 version integer not null check(version=1),
 iv text not null check(length(iv)=16),
 ciphertext text not null check(length(ciphertext) between 20 and 16000),
 created_at timestamptz not null default now(),
 check(sender<>recipient)
);
create index hearth_waiting_sender on public.hearth_waiting_notes(sender,created_at);
create index hearth_waiting_recipient on public.hearth_waiting_notes(recipient,created_at);
alter table public.hearth_waiting_notes enable row level security;
revoke all on public.hearth_waiting_notes from public,anon,authenticated;
grant select,delete on public.hearth_waiting_notes to authenticated;
grant insert(id,sender,recipient,version,iv,ciphertext) on public.hearth_waiting_notes to authenticated;
create policy waiting_read on public.hearth_waiting_notes for select to authenticated using(sender=(select auth.uid()) or (recipient=(select auth.uid()) and hearth_private.connected(sender,recipient)));
create policy waiting_create on public.hearth_waiting_notes for insert to authenticated with check(sender=(select auth.uid()) and hearth_private.connected(sender,recipient));
create policy waiting_delete on public.hearth_waiting_notes for delete to authenticated using(sender=(select auth.uid()));
create function hearth_private.guard_waiting_notes() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('hearth-waiting:'||auth.uid()::text,0));
 if (select count(*) from public.hearth_waiting_notes where sender=auth.uid())>=30 then raise exception 'Your waiting notes are full. Let some arrive before adding more.'; end if;
 return new;
end; $$;
revoke all on function hearth_private.guard_waiting_notes() from public,anon,authenticated;
create trigger waiting_guard before insert on public.hearth_waiting_notes for each row execute function hearth_private.guard_waiting_notes();
