-- All accepted kin are eligible; private shared groups only influence ranking.
-- CREATE OR REPLACE preserves the existing restricted execution grants.
create or replace function hearth_private.introduction_eligible(actor uuid,x uuid,y uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select actor=auth.uid() and x<>y and actor not in(x,y)
 and hearth_private.connected(actor,x) and hearth_private.connected(actor,y)
 and not exists(select 1 from public.hearth_connections where least(requester,recipient)=least(x,y) and greatest(requester,recipient)=greatest(x,y))
 and not exists(select 1 from public.hearth_blocks where least(owner,target)=least(x,y) and greatest(owner,target)=greatest(x,y))
 and not exists(select 1 from hearth_private.introductions where a=least(x,y) and b=greatest(x,y));
$$;
create or replace function hearth_private.hearth_next_introduction() returns jsonb
 language plpgsql security definer set search_path='' as $$
 declare x uuid; y uuid; actor uuid:=auth.uid();
 begin
 if actor is null then raise exception 'Sign in first'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||'introductions',0));
 with kin as (
  select recipient as person from public.hearth_connections where requester=actor and accepted
  union
  select requester as person from public.hearth_connections where recipient=actor and accepted
 )
 select m.person,n.person into x,y from kin m join kin n on m.person<n.person
 left join hearth_private.introduction_choices c on c.owner=actor and c.a=m.person and c.b=n.person
 where not coalesce(c.dismissed,false) and hearth_private.introduction_eligible(actor,m.person,n.person)
 order by exists(
  select 1 from public.hearth_kin_group_members gm join public.hearth_kin_group_members gn
   on gn.group_id=gm.group_id and gn.owner=actor
  where gm.owner=actor and gm.person=m.person and gn.person=n.person
 ) desc,c.viewed_at nulls first,m.person,n.person limit 1;
 if x is null then return null; end if;
 insert into hearth_private.introduction_choices(owner,a,b) values(actor,x,y)
 on conflict(owner,a,b) do update set viewed_at=clock_timestamp();
 return jsonb_build_object('a',x,'b',y);
 end; $$;
