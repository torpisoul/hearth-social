-- Private organisation; introductions disclose names only to their participants.
create table public.hearth_kin_groups (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null default auth.uid() references public.hearth_profiles on delete cascade,
 name text not null check(length(trim(name)) between 1 and 60),
 unique(owner,id)
);
create unique index hearth_group_name on public.hearth_kin_groups(owner,lower(trim(name)));
create table public.hearth_kin_group_members (
 owner uuid not null default auth.uid(),
 group_id uuid not null,
 person uuid not null references public.hearth_profiles on delete cascade,
 primary key(group_id,person),
 foreign key(owner,group_id) references public.hearth_kin_groups(owner,id) on delete cascade
);
create index hearth_group_members_owner on public.hearth_kin_group_members(owner,person);
create index hearth_group_members_person on public.hearth_kin_group_members(person);
create table hearth_private.introduction_choices (
 owner uuid not null references public.hearth_profiles on delete cascade,
 a uuid not null references public.hearth_profiles on delete cascade,
 b uuid not null references public.hearth_profiles on delete cascade,
 dismissed boolean not null default false,
 viewed_at timestamptz not null default now(),
 primary key(owner,a,b), check(a<b)
);
create table hearth_private.introductions (
 id uuid primary key default gen_random_uuid(),
 introducer uuid not null references public.hearth_profiles on delete cascade,
 a uuid not null references public.hearth_profiles on delete cascade,
 b uuid not null references public.hearth_profiles on delete cascade,
 a_yes boolean not null default false,
 b_yes boolean not null default false,
 closed boolean not null default false,
 created_at timestamptz not null default now(),
 unique(a,b), check(a<b and introducer not in(a,b))
);
create index hearth_introductions_a on hearth_private.introductions(a);
create index hearth_introductions_b on hearth_private.introductions(b);
create index hearth_introductions_sender on hearth_private.introductions(introducer);
alter table hearth_private.introduction_choices enable row level security;
alter table hearth_private.introductions enable row level security;
revoke all on hearth_private.introduction_choices,hearth_private.introductions from public,anon,authenticated;
alter table public.hearth_kin_groups enable row level security;
alter table public.hearth_kin_group_members enable row level security;
revoke all on public.hearth_kin_groups,public.hearth_kin_group_members from public,anon,authenticated;
grant select,insert,delete on public.hearth_kin_groups,public.hearth_kin_group_members to authenticated;
grant update(name) on public.hearth_kin_groups to authenticated;
create policy groups_own on public.hearth_kin_groups for all to authenticated
 using(owner=(select auth.uid())) with check(owner=(select auth.uid()));
create policy group_members_read on public.hearth_kin_group_members for select to authenticated using(owner=(select auth.uid()));
create policy group_members_delete on public.hearth_kin_group_members for delete to authenticated using(owner=(select auth.uid()));
create policy group_members_add on public.hearth_kin_group_members for insert to authenticated
 with check(owner=(select auth.uid()) and person<>owner and hearth_private.related(owner,person));

-- Eligibility is internal: never expose another person's connections or blocks.
create function hearth_private.introduction_eligible(actor uuid,x uuid,y uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select actor=auth.uid() and x<>y and actor not in(x,y)
 and hearth_private.connected(actor,x) and hearth_private.connected(actor,y)
 and exists(select 1 from public.hearth_kin_group_members m join public.hearth_kin_group_members n
   on m.group_id=n.group_id where m.owner=actor and m.person=x and n.person=y)
 and not exists(select 1 from public.hearth_connections where least(requester,recipient)=least(x,y) and greatest(requester,recipient)=greatest(x,y))
 and not exists(select 1 from public.hearth_blocks where least(owner,target)=least(x,y) and greatest(owner,target)=greatest(x,y))
 and not exists(select 1 from hearth_private.introductions where a=least(x,y) and b=greatest(x,y));
$$;
create function hearth_private.hearth_next_introduction() returns jsonb
 language plpgsql security definer set search_path='' as $$
 declare x uuid; y uuid; actor uuid:=auth.uid();
 begin
 if actor is null then raise exception 'Sign in first'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||'introductions',0));
 select m.person,n.person into x,y from public.hearth_kin_group_members m
 join public.hearth_kin_group_members n on n.group_id=m.group_id and m.person<n.person
 left join hearth_private.introduction_choices c on c.owner=actor and c.a=m.person and c.b=n.person
 where m.owner=actor and not coalesce(c.dismissed,false) and hearth_private.introduction_eligible(actor,m.person,n.person)
 order by c.viewed_at nulls first,m.person,n.person limit 1;
 if x is null then return null; end if;
 insert into hearth_private.introduction_choices(owner,a,b) values(actor,x,y)
 on conflict(owner,a,b) do update set viewed_at=clock_timestamp();
 return jsonb_build_object('a',x,'b',y);
 end; $$;
create function hearth_private.hearth_suggest_kin(x uuid,y uuid,introduce boolean) returns void
 language plpgsql security definer set search_path='' as $$
 declare actor uuid:=auth.uid();
 begin
 if actor is null or x is null or y is null or introduce is null then raise exception 'Unable to introduce'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||'introductions',0));
 if not hearth_private.introduction_eligible(actor,x,y) then raise exception 'This introduction is no longer available'; end if;
 insert into hearth_private.introduction_choices(owner,a,b,dismissed) values(actor,least(x,y),greatest(x,y),true)
 on conflict(owner,a,b) do update set dismissed=true;
 if introduce then
  if (select count(*) from hearth_private.introductions where introducer=actor and created_at>now()-interval '1 day')>=10 then raise exception 'Leave a little time before making more introductions'; end if;
  insert into hearth_private.introductions(introducer,a,b) values(actor,least(x,y),greatest(x,y)) on conflict(a,b) do nothing;
 end if;
 end; $$;
-- Return only the three names needed for a card, not avatars or profile access.
create function hearth_private.hearth_my_introductions() returns jsonb
 language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'introducer',i.introducer,'introducer_name',p.name,
 'person',case when i.a=auth.uid() then i.b else i.a end,'person_name',q.name,
 'agreed',case when i.a=auth.uid() then i.a_yes else i.b_yes end) order by i.created_at),'[]'::jsonb)
 from hearth_private.introductions i join public.hearth_profiles p on p.id=i.introducer
 join public.hearth_profiles q on q.id=case when i.a=auth.uid() then i.b else i.a end
 where auth.uid() in(i.a,i.b) and not i.closed and not (i.a_yes and i.b_yes)
 and not exists(select 1 from public.hearth_blocks where (owner in(i.a,i.b,i.introducer) and target in(i.a,i.b,i.introducer)))
 and not exists(select 1 from public.hearth_connections where accepted and least(requester,recipient)=i.a and greatest(requester,recipient)=i.b);
$$;
create function hearth_private.hearth_answer_introduction(introduction uuid,agree boolean) returns void
 language plpgsql security definer set search_path='' as $$
 declare actor uuid:=auth.uid(); i hearth_private.introductions; other uuid;
 begin
 if actor is null or agree is null then raise exception 'Sign in first'; end if;
 select * into i from hearth_private.introductions where id=introduction and actor in(a,b) for update;
 if not found or i.closed then raise exception 'This introduction is no longer available'; end if;
 if exists(select 1 from public.hearth_blocks where owner in(i.a,i.b,i.introducer) and target in(i.a,i.b,i.introducer)) then raise exception 'This introduction is no longer available'; end if;
 other:=case when actor=i.a then i.b else i.a end;
 if not agree then
  update hearth_private.introductions set closed=true where id=i.id;
  delete from public.hearth_connections where not accepted and least(requester,recipient)=i.a and greatest(requester,recipient)=i.b;
  return;
 end if;
 update hearth_private.introductions set a_yes=a_yes or actor=a,b_yes=b_yes or actor=b where id=i.id returning * into i;
 insert into public.hearth_connections(requester,recipient) values(actor,other) on conflict do nothing;
 if i.a_yes and i.b_yes then
  update public.hearth_connections set accepted=true where least(requester,recipient)=i.a and greatest(requester,recipient)=i.b;
 end if;
 end; $$;

-- Cancelling or blocking closes outstanding introductions and removes private tags.
create function hearth_private.cleanup_kin_organisation() returns trigger language plpgsql security definer set search_path='' as $$
 declare x uuid; y uuid;
 begin
 if TG_TABLE_NAME='hearth_blocks' then x:=new.owner;y:=new.target;
 else x:=old.requester;y:=old.recipient; end if;
 update hearth_private.introductions set closed=true
 where (x in(a,b) and y in(a,b)) or (introducer=x and y in(a,b)) or (introducer=y and x in(a,b));
 delete from public.hearth_kin_group_members where(owner=x and person=y) or(owner=y and person=x);
 return null;
 end; $$;
create trigger cleanup_kin_disconnect after delete on public.hearth_connections for each row execute function hearth_private.cleanup_kin_organisation();
create trigger cleanup_kin_block after insert on public.hearth_blocks for each row execute function hearth_private.cleanup_kin_organisation();

alter table public.hearth_connections add column reminded_at timestamptz;
create function hearth_private.hearth_remind_connection(person uuid) returns void language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null or hearth_private.blocked(auth.uid(),person) then raise exception 'Unable to send reminder'; end if;
 update public.hearth_connections set reminded_at=now() where requester=auth.uid() and recipient=person and not accepted
 and coalesce(reminded_at,created_at)<now()-interval '7 days';
 if not found then raise exception 'Give them a little time. You can remind them once a week.'; end if;
 end; $$;

revoke all on function hearth_private.introduction_eligible(uuid,uuid,uuid),hearth_private.cleanup_kin_organisation() from public,anon,authenticated;
revoke all on function hearth_private.hearth_next_introduction(),hearth_private.hearth_suggest_kin(uuid,uuid,boolean),hearth_private.hearth_my_introductions(),hearth_private.hearth_answer_introduction(uuid,boolean),hearth_private.hearth_remind_connection(uuid) from public,anon,authenticated;
grant execute on function hearth_private.hearth_next_introduction(),hearth_private.hearth_suggest_kin(uuid,uuid,boolean),hearth_private.hearth_my_introductions(),hearth_private.hearth_answer_introduction(uuid,boolean),hearth_private.hearth_remind_connection(uuid) to authenticated;
create function public.hearth_next_introduction() returns jsonb language sql security invoker set search_path='' as $$select hearth_private.hearth_next_introduction()$$;
create function public.hearth_suggest_kin(x uuid,y uuid,introduce boolean) returns void language sql security invoker set search_path='' as $$select hearth_private.hearth_suggest_kin(x,y,introduce)$$;
create function public.hearth_my_introductions() returns jsonb language sql stable security invoker set search_path='' as $$select hearth_private.hearth_my_introductions()$$;
create function public.hearth_answer_introduction(introduction uuid,agree boolean) returns void language sql security invoker set search_path='' as $$select hearth_private.hearth_answer_introduction(introduction,agree)$$;
create function public.hearth_remind_connection(person uuid) returns void language sql security invoker set search_path='' as $$select hearth_private.hearth_remind_connection(person)$$;
revoke all on function public.hearth_next_introduction(),public.hearth_suggest_kin(uuid,uuid,boolean),public.hearth_my_introductions(),public.hearth_answer_introduction(uuid,boolean),public.hearth_remind_connection(uuid) from public,anon;
grant execute on function public.hearth_next_introduction(),public.hearth_suggest_kin(uuid,uuid,boolean),public.hearth_my_introductions(),public.hearth_answer_introduction(uuid,boolean),public.hearth_remind_connection(uuid) to authenticated;
