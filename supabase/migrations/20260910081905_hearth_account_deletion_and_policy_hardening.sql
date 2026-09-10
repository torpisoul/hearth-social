alter policy profiles_read on public.hearth_profiles to authenticated using(hearth_private.related((select auth.uid()),id));
alter policy profiles_create on public.hearth_profiles to authenticated with check(id=(select auth.uid()));
alter policy profiles_edit on public.hearth_profiles to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
alter policy connections_read on public.hearth_connections to authenticated using((select auth.uid()) in(requester,recipient) and not hearth_private.blocked(requester,recipient));
alter policy blocks_own on public.hearth_blocks to authenticated using(owner=(select auth.uid())) with check(owner=(select auth.uid()));
alter policy circle_own on public.hearth_circle to authenticated using(owner=(select auth.uid())) with check(owner=(select auth.uid()) and hearth_private.connected(owner,member));
alter policy statuses_read on public.hearth_statuses to authenticated using(author=(select auth.uid()) or(hearth_private.connected((select auth.uid()),author) and(audience='All kin' or(audience='Inner circle' and hearth_private.in_circle(author,(select auth.uid()))))));
alter policy statuses_create on public.hearth_statuses to authenticated with check(author=(select auth.uid()));
alter policy statuses_delete on public.hearth_statuses to authenticated using(author=(select auth.uid()));
alter policy keys_create on public.hearth_keys to authenticated with check(owner=(select auth.uid()));
alter policy messages_read on public.hearth_messages to authenticated using((select auth.uid()) in(sender,recipient));
alter policy messages_create on public.hearth_messages to authenticated with check(sender=(select auth.uid()) and hearth_private.connected(sender,recipient) and exists(select 1 from public.hearth_profiles where id=recipient));
do $$ begin if to_regprocedure('public.rls_auto_enable()') is not null then execute 'revoke execute on function public.rls_auto_enable() from public,anon,authenticated'; end if; end $$;
-- Self-service deletion revokes database sessions and removes all account-owned rows.
create function hearth_private.hearth_delete_account() returns void language plpgsql security definer set search_path='' as $$
declare person uuid:=auth.uid();
begin
 if person is null then raise exception 'Not authorized'; end if;
 delete from auth.sessions where user_id=person;
 delete from auth.users where id=person;
end; $$;
revoke all on function hearth_private.hearth_delete_account() from public,anon;
grant execute on function hearth_private.hearth_delete_account() to authenticated;
create function public.hearth_delete_account() returns void language sql security invoker set search_path='' as $$ select hearth_private.hearth_delete_account(); $$;
revoke all on function public.hearth_delete_account() from public,anon;
grant execute on function public.hearth_delete_account() to authenticated;
