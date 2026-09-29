import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createIdentity} from '../../js/live/crypto.js';
import {encryptGroupMessage,decryptGroupMessage} from '../../js/live/group-crypto.js';
import {allowedWorkflows} from '../../js/live/group-chats.js';
let db,identities,chat,post;
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003',d='00000000-0000-4000-8000-000000000004';
async function as(id,sql,args=[]){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`);return (await db.query(sql,args)).rows;}
async function rpc(id,fn,args=[]){return (await as(id,`select hearth_group_${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args))[0].result;}
async function send(id,text){const roster=await rpc(id,'roster',[chat]);const p=await encryptGroupMessage(identities[id].privateKey,roster,chat,text);await rpc(id,'send',[p.chat,p.expected_revision,p.message_id,p.body,p.nonce,JSON.stringify(p.envelopes)]);return p;}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
 for(const file of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 identities={};
 for(const [id,label] of [[a,'Alice'],[b,'Bob'],[c,'Carol'],[d,'Outsider']]){
  await db.exec(`reset role;insert into auth.users values('${id}')`);
  await as(id,'insert into hearth_profiles(id,name) values($1,$2)',[id,label]);
  identities[id]=await createIdentity('long recovery passphrase for '+label);
  await as(id,'insert into hearth_keys(owner,public_key,vault) values($1,$2,$3)',[id,JSON.stringify(identities[id].public_key),JSON.stringify(identities[id].vault)]);
 }
 for(const id of [b,c]){await as(a,'select hearth_request_friend($1)',[id]);await as(id,'select hearth_accept_friend($1)',[a]);}
 post=(await as(a,"insert into hearth_statuses(author,content,topic,audience) values($1,'Moment','Everyday life','All kin') returning id",[a]))[0].id;
});
after(async()=>{await db.close();});
test('dismissals are account-private and removed with the connection lifetime',async()=>{
 await as(a,'insert into hearth_invite_dismissals values($1,$1,$2)',[a,b]);
 assert.equal((await as(b,'select * from hearth_invite_dismissals')).length,0);
 await as(a,'select hearth_remove_friend($1)',[b]);assert.equal((await as(a,'select * from hearth_invite_dismissals')).length,0);
 await as(a,'select hearth_request_friend($1)',[b]);await as(b,'select hearth_accept_friend($1)',[a]);
});
test('waiting delivery keeps T1, cannot forge dates, and sorts before a T3 note',async()=>{
 const id=crypto.randomUUID();await as(a,"insert into hearth_waiting_notes(id,sender,recipient,version,iv,ciphertext) values($1,$2,$3,1,repeat('i',16),repeat('x',24))",[id,a,b]);
 await db.exec(`reset role;update hearth_waiting_notes set created_at='2020-01-01' where id='${id}'`);
 await as(a,"insert into hearth_messages(id,sender,recipient,iv,ciphertext,created_at) values($1,$2,$3,repeat('i',16),repeat('x',24),'2099-01-01')",[id,a,b]);
 await as(a,"insert into hearth_messages(id,sender,recipient,iv,ciphertext) values($1,$2,$3,repeat('i',16),repeat('x',24))",[crypto.randomUUID(),a,b]);
 const rows=await as(b,'select id,created_at from hearth_messages order by created_at,id');assert.equal(rows[0].id,id);assert.match(String(rows[0].created_at),/2020/);
});
test('public replies and reactions inherit visibility and reactions disclose only the caller’s state',async()=>{
 await as(b,"insert into hearth_post_replies(post,content) values($1,'Hello')",[post]);
 assert.equal((await as(c,'select * from hearth_post_replies')).length,1);
 await assert.rejects(as(d,"insert into hearth_post_replies(post,content) values($1,'Hidden')",[post]),/row-level security/);
 await as(b,"insert into hearth_post_reactions(post,emoji) values($1,'♥') on conflict(post,actor) do update set post=excluded.post,actor=excluded.actor,emoji=excluded.emoji",[post]);
 await as(b,"insert into hearth_post_reactions(post,emoji) values($1,'🌱') on conflict(post,actor) do update set post=excluded.post,actor=excluded.actor,emoji=excluded.emoji",[post]);
 assert.deepEqual((await as(b,'select emoji from hearth_post_reactions')).map(r=>r.emoji),['🌱']);
 assert.equal((await as(a,'select * from hearth_post_reactions')).length,0);assert.equal((await as(c,'select count(*) n from hearth_post_reactions'))[0].n,0);
 await assert.rejects(as(d,"insert into hearth_post_reactions(post,emoji) values($1,'♥')",[post]),/row-level security/);
});
test('storage and media enforce parent visibility, owner paths and four positions',async()=>{
 const path=a+'/photo.webp';await as(a,"insert into storage.objects(bucket_id,name) values('hearth-moments',$1)",[path]);
 assert.equal((await as(b,'select * from storage.objects')).length,0);
 await as(a,'insert into hearth_status_media(status,path,position) values($1,$2,0)',[post,path]);
 assert.equal((await as(b,'select * from storage.objects')).length,1);assert.equal((await as(d,'select * from storage.objects')).length,0);
 await assert.rejects(as(b,'insert into hearth_status_media(status,path,position) values($1,$2,1)',[post,b+'/fake.webp']),/row-level security/);
 await assert.rejects(as(a,'insert into hearth_status_media(status,path,position) values($1,$2,4)',[post,a+'/fifth.webp']),/check constraint/);
 await assert.rejects(as(b,"insert into storage.objects(bucket_id,name) values('hearth-moments',$1)",[a+'/forged.webp']),/row-level security/);
 assert.equal((await as(b,'delete from storage.objects returning *')).length,0);
});
test('group owner invitation, member access and independent encrypted envelopes',async()=>{
 await assert.rejects(rpc(b,'create',['Invalid',[c],null]),/connected kin/);
 chat=await rpc(a,'create',['Family',[b,c],null]);
 await assert.rejects(rpc(d,'roster',[chat]),/active member/);
 await assert.rejects(rpc(b,'membership',[chat,d,false]),/Only the owner/);
 await send(b,'Private group hello');
 await rpc(c,'override',[chat,'open']);
 const data=await rpc(c,'read',[chat]);assert.equal(await decryptGroupMessage(identities[c].privateKey,data.messages[0]),'Private group hello');
 await assert.rejects(decryptGroupMessage(identities[d].privateKey,data.messages[0]));
 const tampered={...data.messages[0],conversation:crypto.randomUUID()};await assert.rejects(decryptGroupMessage(identities[c].privateKey,tampered));
});
test('Moderate and Safeguard do not return hidden envelopes or sender identities',async()=>{
 await rpc(c,'override',[chat,'moderate']);let data=await rpc(c,'read',[chat]);
 assert.deepEqual(Object.keys(data.messages[0]).sort(),['hidden','left','name','sender']);assert.equal(data.messages[0].name,'Bob');
 await as(c,"insert into hearth_preferences(owner,channel_workflow) values($1,'safeguard')",[c]);
 await rpc(c,'override',[chat,null]);data=await rpc(c,'read',[chat]);assert.deepEqual(data,{workflow:'safeguard',hidden:true,messages:[]});
 const roster=await rpc(c,'roster',[chat]);assert.equal(roster.members.find(m=>m.key.x===identities[b].public_key.x).person,null);
 await assert.rejects(rpc(c,'override',[chat,'open']),/one step/);
 assert.deepEqual(allowedWorkflows('safeguard'),['moderate','safeguard']);
 await rpc(c,'override',[chat,'moderate']);assert.equal((await rpc(c,'read',[chat])).messages[0].hidden,true);
 assert.equal((await rpc(b,'read',[chat])).workflow,'moderate');
 await as(c,"update hearth_preferences set channel_workflow='open'");await rpc(c,'override',[chat,'open']);
 await as(c,"update hearth_preferences set channel_workflow='safeguard'");assert.equal((await rpc(c,'read',[chat])).workflow,'safeguard');
});
test('removal denies future access and stale sends, retains remaining members’ history',async()=>{
 await as(c,"update hearth_preferences set channel_workflow='open'");await rpc(c,'override',[chat,null]);
 const stale=await encryptGroupMessage(identities[a].privateKey,await rpc(a,'roster',[chat]),chat,'Stale');
 await rpc(a,'membership',[chat,b,true]);
 await assert.rejects(rpc(b,'read',[chat]),/active member/);
 await assert.rejects(rpc(a,'send',[chat,stale.expected_revision,stale.message_id,stale.body,stale.nonce,JSON.stringify(stale.envelopes)]),/Membership changed/);
 let data=await rpc(c,'read',[chat]);assert.equal(data.messages[0].left,true);assert.equal(await decryptGroupMessage(identities[c].privateKey,data.messages[0]),'Private group hello');
 await send(a,'After removal');
 await rpc(a,'membership',[chat,b,false]);assert.equal((await rpc(b,'read',[chat])).messages.length,0);
 await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select * from hearth_private.hearth_group_messages'),/permission denied/);
});
test('incomplete recipient sets fail atomically, and every encrypted body has the same size',async()=>{
 const roster=await rpc(a,'roster',[chat]);const short=await encryptGroupMessage(identities[a].privateKey,roster,chat,'Hi');const long=await encryptGroupMessage(identities[a].privateKey,roster,chat,'🌱'.repeat(900));assert.equal(short.body.length,long.body.length);
 await assert.rejects(rpc(a,'send',[chat,short.expected_revision,short.message_id,short.body,short.nonce,JSON.stringify(short.envelopes.slice(1))]),/Every active member/);
 const duplicate=[short.envelopes[0],short.envelopes[0],short.envelopes[0]];
 await assert.rejects(rpc(a,'send',[chat,short.expected_revision,short.message_id,short.body,short.nonce,JSON.stringify(duplicate)]),/duplicate key/);
 assert.ok(!(await rpc(a,'read',[chat])).messages.some(m=>m.id===short.message_id));
});
test('blocked senders stay hidden even in Open and owner disconnection removes membership',async()=>{
 await send(b,'Should disappear on block');
 await as(c,'insert into hearth_blocks(owner,target) values($1,$2)',[c,b]);
 assert.ok(!(await rpc(c,'read',[chat])).messages.some(m=>m.name==='Bob'));
 const roster=await rpc(a,'roster',[chat]);await as(a,'select hearth_remove_friend($1)',[b]);await assert.rejects(rpc(b,'read',[chat]),/active member/);
 assert.equal((await rpc(a,'roster',[chat])).members.length,roster.members.length-1);
});
test('orphan cleanup is service-only and preserves referenced or recent uploads',async()=>{
 await db.exec(`reset role;insert into storage.objects(bucket_id,name,created_at) values('hearth-moments','orphan','2020-01-01'),('hearth-moments','recent',now());update storage.objects set created_at='2020-01-01' where name='${a}/photo.webp';set role service_role`);
 assert.deepEqual((await db.query('select * from hearth_orphan_moment_images()')).rows,[{path:'orphan'}]);
 await assert.rejects(as(a,'select * from hearth_orphan_moment_images()'),/permission denied/);
});
test('anonymous callers cannot invoke any group endpoints',async()=>{
 await db.exec('reset role;set role anon');
 await assert.rejects(db.query('select hearth_group_list()'),/permission denied/);
 await assert.rejects(db.query('select hearth_group_read($1)',[chat]),/permission denied/);
});
test('deleting a member account retains history and leaves remaining members able to send',async()=>{
 await send(c,'My last group note');await as(c,'select hearth_delete_account()');
 const roster=await rpc(a,'roster',[chat]);assert.equal(roster.members.length,1);
 await send(a,'Still here');const data=await rpc(a,'read',[chat]);
 assert.ok(data.messages.some(m=>m.name==='Carol'&&m.left));
});
