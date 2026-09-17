-- Sent cards contain only what their author already sent, never recipient replies.
-- Include closed introductions so a decline does not become a read/status signal.
create function hearth_private.hearth_sent_introductions() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',i.id,'a',i.a,'b',i.b,'a_name',a.name,'b_name',b.name,'created_at',i.created_at
 ) order by i.created_at desc,i.id),'[]'::jsonb)
 from hearth_private.introductions i
 join public.hearth_profiles a on a.id=i.a
 join public.hearth_profiles b on b.id=i.b
 where i.introducer=auth.uid();
$$;
revoke all on function hearth_private.hearth_sent_introductions() from public,anon;
grant execute on function hearth_private.hearth_sent_introductions() to authenticated;
create function public.hearth_sent_introductions() returns jsonb
language sql stable security invoker set search_path='' as $$
 select hearth_private.hearth_sent_introductions();
$$;
revoke all on function public.hearth_sent_introductions() from public,anon;
grant execute on function public.hearth_sent_introductions() to authenticated;
