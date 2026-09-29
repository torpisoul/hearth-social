alter table public.hearth_preferences add column channel_workflow text not null default 'moderate' check(channel_workflow in('open','moderate','safeguard'));
create table hearth_private.hearth_conversations(
 id uuid primary key default gen_random_uuid(), owner uuid not null references public.hearth_profiles(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 60), kin_group uuid references public.hearth_kin_groups(id) on delete set null,
 revision integer not null default 1, created_at timestamptz not null default now()
);
create table hearth_private.hearth_conversation_members(
 id uuid primary key default gen_random_uuid(), conversation uuid not null references hearth_private.hearth_conversations(id) on delete cascade,
 person uuid references public.hearth_profiles(id) on delete set null, label text not null,
 joined_at timestamptz not null default now(), left_at timestamptz,
 workflow text check(workflow in('open','moderate','safeguard')), read_at timestamptz not null default '-infinity'
);
create unique index conversation_active_person on hearth_private.hearth_conversation_members(conversation,person) where left_at is null;
create index conversation_person on hearth_private.hearth_conversation_members(person,conversation);
create table hearth_private.hearth_group_messages(
 id uuid primary key, conversation uuid not null references hearth_private.hearth_conversations(id) on delete cascade,
 sender uuid not null references hearth_private.hearth_conversation_members(id), public_key jsonb not null,
 ciphertext text not null check(length(ciphertext)=10944), iv text not null check(length(iv)=16), created_at timestamptz not null default clock_timestamp()
);
create index group_message_order on hearth_private.hearth_group_messages(conversation,created_at,id);
create table hearth_private.hearth_group_envelopes(
 message uuid not null references hearth_private.hearth_group_messages(id) on delete cascade,
 member uuid not null references hearth_private.hearth_conversation_members(id),
 envelope jsonb not null check(octet_length(envelope::text)<2000), primary key(message,member)
);
alter table hearth_private.hearth_conversations enable row level security;
alter table hearth_private.hearth_conversation_members enable row level security;
alter table hearth_private.hearth_group_messages enable row level security;
alter table hearth_private.hearth_group_envelopes enable row level security;
revoke all on hearth_private.hearth_conversations,hearth_private.hearth_conversation_members,hearth_private.hearth_group_messages,hearth_private.hearth_group_envelopes from public,anon,authenticated;

-- All privileged helpers are private; public wrappers are invoker-only.
create function hearth_private.group_member(chat uuid) returns uuid language sql stable security definer set search_path='' as $$
 select m.id from hearth_private.hearth_conversation_members m join hearth_private.hearth_conversations c on c.id=m.conversation
 where m.conversation=chat and m.person=auth.uid() and m.left_at is null
 and (c.owner=auth.uid() or hearth_private.connected(auth.uid(),c.owner));
$$;
create function hearth_private.group_workflow(chat uuid) returns text language sql stable security definer set search_path='' as $$
 select case when abs(array_position(array['open','moderate','safeguard'],m.workflow)-array_position(array['open','moderate','safeguard'],coalesce(p.channel_workflow,'moderate')))<=1 then m.workflow else coalesce(p.channel_workflow,'moderate') end
 from hearth_private.hearth_conversation_members m left join public.hearth_preferences p on p.owner=m.person where m.id=hearth_private.group_member(chat);
$$;
create function hearth_private.group_create(chat_title text, people uuid[], linked_group uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare chat uuid; person uuid;
begin
 if auth.uid() is null then raise exception 'Not authorized'; end if;
 if cardinality(people)>30 then raise exception 'Choose up to 30 people'; end if;
 if linked_group is not null and not exists(select 1 from public.hearth_kin_groups where id=linked_group and owner=auth.uid()) then raise exception 'Not your kin group'; end if;
 if not exists(select 1 from public.hearth_keys where owner=auth.uid()) then raise exception 'Open your encrypted messages first'; end if;
 foreach person in array people loop
  if person=auth.uid() or not hearth_private.connected(auth.uid(),person) then raise exception 'Invite only your connected kin'; end if;
  if not exists(select 1 from public.hearth_keys where owner=person) then raise exception 'Each invited person needs to set up messages first'; end if;
 end loop;
 insert into hearth_private.hearth_conversations(owner,title,kin_group) values(auth.uid(),chat_title,linked_group) returning id into chat;
 insert into hearth_private.hearth_conversation_members(conversation,person,label) select chat,p.id,p.name from public.hearth_profiles p where p.id=auth.uid() or p.id=any(people);
 return chat;
end; $$;
create function hearth_private.group_membership(chat uuid, person uuid, removing boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from hearth_private.hearth_conversations where id=chat and owner=auth.uid() for update;
 if not found or person=auth.uid() then raise exception 'Only the owner can change other members'; end if;
 if removing then
  update hearth_private.hearth_conversation_members set left_at=clock_timestamp() where conversation=chat and hearth_conversation_members.person=group_membership.person and left_at is null;
 else
  if not hearth_private.connected(auth.uid(),person) then raise exception 'Invite only your connected kin'; end if;
  if not exists(select 1 from public.hearth_keys where owner=person) then raise exception 'Your kin needs to set up messages first'; end if;
  if (select count(*) from hearth_private.hearth_conversation_members where conversation=chat and left_at is null)>=31 then raise exception 'This group is full'; end if;
  insert into hearth_private.hearth_conversation_members(conversation,person,label) select chat,id,name from public.hearth_profiles where id=person;
 end if;
 update hearth_private.hearth_conversations set revision=revision+1 where id=chat;
end; $$;
create function hearth_private.group_override(chat uuid, choice text) returns void language plpgsql security definer set search_path='' as $$
declare main text; member uuid:=hearth_private.group_member(chat);
begin
 if member is null then raise exception 'Not an active member'; end if;
 select channel_workflow into main from public.hearth_preferences where owner=auth.uid(); main:=coalesce(main,'moderate');
 if choice is not null and (choice not in('open','moderate','safeguard') or abs(array_position(array['open','moderate','safeguard'],choice)-array_position(array['open','moderate','safeguard'],main))>1) then raise exception 'Choose only one step from your default'; end if;
 update hearth_private.hearth_conversation_members set workflow=choice where id=member;
end; $$;
create function hearth_private.group_list() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'owner',c.owner,'kin_group',c.kin_group,'workflow',hearth_private.group_workflow(c.id),'unread',exists(
 select 1 from hearth_private.hearth_group_messages msg join hearth_private.hearth_group_envelopes e on e.message=msg.id join hearth_private.hearth_conversation_members sender on sender.id=msg.sender
 where msg.conversation=c.id and e.member=m.id and msg.sender<>m.id and msg.created_at>m.read_at and not hearth_private.blocked(auth.uid(),sender.person)
 and (hearth_private.group_workflow(c.id)<>'safeguard' or hearth_private.connected(auth.uid(),sender.person))
 )) order by c.created_at), '[]'::jsonb)
 from hearth_private.hearth_conversations c join hearth_private.hearth_conversation_members m on m.conversation=c.id and m.id=hearth_private.group_member(c.id);
$$;
create function hearth_private.group_roster(chat uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; member uuid:=hearth_private.group_member(chat);
begin
 if member is null then raise exception 'Not an active member'; end if;
 select jsonb_build_object('revision',c.revision,'self',member,'members',(select jsonb_agg(jsonb_build_object('id',m.id,'key',k.public_key,
 'person',case when c.owner=auth.uid() or m.person=auth.uid() or hearth_private.connected(auth.uid(),m.person) then m.person end,
 'name',case when c.owner=auth.uid() or m.person=auth.uid() or hearth_private.connected(auth.uid(),m.person) then m.label end))
 from hearth_private.hearth_conversation_members m join public.hearth_keys k on k.owner=m.person where m.conversation=c.id and m.left_at is null)) into result
 from hearth_private.hearth_conversations c where c.id=chat;
 return result;
end; $$;
create function hearth_private.group_send(chat uuid, expected_revision integer, message_id uuid, body text, nonce text, envelopes jsonb) returns void language plpgsql security definer set search_path='' as $$
declare member uuid; item jsonb; revision integer;
begin
 select c.revision into revision from hearth_private.hearth_conversations c where c.id=chat for update;
 member:=hearth_private.group_member(chat);
 if member is null then raise exception 'Not an active member'; end if;
 perform pg_advisory_xact_lock(hashtextextended('hearth-group-send:'||auth.uid()::text,0));
 if (select count(*) from hearth_private.hearth_group_messages g join hearth_private.hearth_conversation_members m on m.id=g.sender where m.person=auth.uid() and g.created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'Please wait a minute before sending more messages'; end if;
 if expected_revision is null or revision<>expected_revision then raise exception 'Membership changed. Refresh before sending again'; end if;
 if jsonb_typeof(envelopes)<>'array' or jsonb_array_length(envelopes)<>(select count(*) from hearth_private.hearth_conversation_members where conversation=chat and left_at is null) then raise exception 'Every active member needs an envelope'; end if;
 insert into hearth_private.hearth_group_messages(id,conversation,sender,public_key,ciphertext,iv) select message_id,chat,member,public_key,body,nonce from public.hearth_keys where owner=auth.uid();
 for item in select value from jsonb_array_elements(envelopes) loop
  if not exists(select 1 from hearth_private.hearth_conversation_members where id=(item->>'member')::uuid and conversation=chat and left_at is null) then raise exception 'Invalid recipient'; end if;
  if not ((item->'envelope'->>'version'='1' and length(item->'envelope'->>'iv')=16 and length(item->'envelope'->>'ciphertext') between 60 and 200 and item->'envelope'->>'id'=message_id::text and item->'envelope'->>'sender'=member::text and item->'envelope'->>'recipient'=item->>'member') is true) then raise exception 'Invalid envelope'; end if;
  insert into hearth_private.hearth_group_envelopes(message,member,envelope) values(message_id,(item->>'member')::uuid,item->'envelope');
 end loop;
end; $$;
create function hearth_private.group_read(chat uuid, page_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare viewer uuid:=hearth_private.group_member(chat); flow text:=hearth_private.group_workflow(chat); result jsonb;
begin
 if viewer is null then raise exception 'Not an active member'; end if;
 if page_offset is null or page_offset<0 or page_offset>1000000 then raise exception 'Invalid page'; end if;
 select jsonb_build_object('workflow',flow,'hidden',flow='safeguard' and exists(
 select 1 from hearth_private.hearth_group_messages g join hearth_private.hearth_group_envelopes e on e.message=g.id join hearth_private.hearth_conversation_members s on s.id=g.sender
 where g.conversation=chat and e.member=viewer and s.id<>viewer and not hearth_private.blocked(auth.uid(),s.person) and not hearth_private.connected(auth.uid(),s.person)),
 'messages',coalesce((select jsonb_agg(row.data order by row.created_at,row.id) from (
 select g.id,g.created_at,case when s.id<>viewer and flow='moderate' and not hearth_private.connected(auth.uid(),s.person)
 then jsonb_build_object('hidden',true,'sender',s.person,'name',s.label,'left',s.left_at is not null or s.person is null)
 else jsonb_build_object('id',g.id,'conversation',g.conversation,'sender',g.sender,'name',s.label,'left',s.left_at is not null or s.person is null,'created_at',g.created_at,'ciphertext',g.ciphertext,'iv',g.iv,'key',g.public_key,'envelope',e.envelope) end as data
 from hearth_private.hearth_group_messages g join hearth_private.hearth_group_envelopes e on e.message=g.id join hearth_private.hearth_conversation_members s on s.id=g.sender
 where g.conversation=chat and e.member=viewer and not hearth_private.blocked(auth.uid(),s.person) 
 and (flow<>'safeguard' or s.id=viewer or hearth_private.connected(auth.uid(),s.person))
 order by g.created_at desc,g.id desc limit 50 offset page_offset) row),'[]'::jsonb)) into result;
 return result;
end; $$;
create function hearth_private.group_seen(chat uuid, through_time timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 update hearth_private.hearth_conversation_members set read_at=greatest(read_at,least(through_time,clock_timestamp())) where id=hearth_private.group_member(chat);
end; $$;
-- Generate thin, explicitly granted public endpoints; no definer functions in public.
create function public.hearth_group_create(chat_title text,people uuid[],linked_group uuid default null) returns uuid language sql security invoker set search_path='' as $$select hearth_private.group_create(chat_title,people,linked_group)$$;
create function public.hearth_group_membership(chat uuid,person uuid,removing boolean) returns void language sql security invoker set search_path='' as $$select hearth_private.group_membership(chat,person,removing)$$;
create function public.hearth_group_override(chat uuid,choice text) returns void language sql security invoker set search_path='' as $$select hearth_private.group_override(chat,choice)$$;
create function public.hearth_group_list() returns jsonb language sql security invoker set search_path='' as $$select hearth_private.group_list()$$;
create function public.hearth_group_roster(chat uuid) returns jsonb language sql security invoker set search_path='' as $$select hearth_private.group_roster(chat)$$;
create function public.hearth_group_send(chat uuid,expected_revision integer,message_id uuid,body text,nonce text,envelopes jsonb) returns void language sql security invoker set search_path='' as $$select hearth_private.group_send(chat,expected_revision,message_id,body,nonce,envelopes)$$;
create function public.hearth_group_read(chat uuid,page_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select hearth_private.group_read(chat,page_offset)$$;
create function public.hearth_group_seen(chat uuid,through_time timestamptz) returns void language sql security invoker set search_path='' as $$select hearth_private.group_seen(chat,through_time)$$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='hearth_private' and p.proname like 'group_%') or (n.nspname='public' and p.proname like 'hearth_group_%') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;

-- Losing the owner's connection removes that membership, including on a block.
-- Locking follows the same conversation lock as send/invite/remove.
create function hearth_private.group_connection_ended() returns trigger language plpgsql security definer set search_path='' as $$
declare first_person uuid; second_person uuid; chat record;
begin
 if tg_table_name='hearth_connections' then first_person:=old.requester;second_person:=old.recipient;
 else first_person:=new.owner;second_person:=new.target; end if;
 for chat in select c.id,c.owner from hearth_private.hearth_conversations c where c.owner in(first_person,second_person) order by c.id for update loop
  update hearth_private.hearth_conversation_members set left_at=clock_timestamp() where conversation=chat.id and person=case when chat.owner=first_person then second_person else first_person end and left_at is null;
  if found then update hearth_private.hearth_conversations set revision=revision+1 where id=chat.id; end if;
 end loop;
 return null;
end; $$;
revoke all on function hearth_private.group_connection_ended() from public,anon,authenticated;
create trigger group_disconnect after delete on public.hearth_connections for each row execute function hearth_private.group_connection_ended();
create trigger group_block after insert on public.hearth_blocks for each row execute function hearth_private.group_connection_ended();
-- Foreign-key SET NULL can run before connection cascades on account deletion.
-- Close that membership explicitly so it cannot remain a phantom key recipient.
create function hearth_private.group_account_departure() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.person is null and old.person is not null and new.left_at is null then
  new.left_at:=clock_timestamp();
  update hearth_private.hearth_conversations set revision=revision+1 where id=new.conversation;
 end if;
 return new;
end; $$;
revoke all on function hearth_private.group_account_departure() from public,anon,authenticated;
create trigger group_account_departure before update of person on hearth_private.hearth_conversation_members for each row execute function hearth_private.group_account_departure();

create index conversation_owner on hearth_private.hearth_conversations(owner);
create index conversation_kin_group on hearth_private.hearth_conversations(kin_group);
create index conversation_members_history on hearth_private.hearth_conversation_members(conversation);
create index group_message_sender on hearth_private.hearth_group_messages(sender,created_at);
create index group_envelope_member on hearth_private.hearth_group_envelopes(member);
