-- New plans include their host; later edits do not override a declined RSVP.
create function hearth_private.event_host_attendance() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 insert into public.hearth_rsvps(event,person) values(new.id,new.owner) on conflict do nothing;
 return new;
end;
$$;
revoke all on function hearth_private.event_host_attendance() from public,anon,authenticated;
create trigger hearth_event_host_attendance after insert on public.hearth_events
for each row execute function hearth_private.event_host_attendance();
