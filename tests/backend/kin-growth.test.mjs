import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const [a,b,c,d]=[1,2,3,4].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,group;
async function as(id,sql,args=[]) {
 await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`);
 return (await db.query(sql,args)).rows;
}
async function admin(sql){await db.exec('reset role');return db.exec(sql);}
const list=id=>as(id,'select hearth_my_introductions() as items').then(r=>r[0].items);
const next=()=>as(a,'select hearth_next_introduction() as pair').then(r=>r[0].pair);
const suggest=()=>as(a,'select hearth_suggest_kin($1,$2,true)',[b,c]);
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 for(const f of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())
  await db.exec(await readFile(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 for(const id of [a,b,c,d]){await admin(`insert into auth.users values('${id}')`);await as(id,'insert into hearth_profiles(id,name) values($1,$2)',[id,({[a]:'Alice',[b]:'Bob',[c]:'Carol',[d]:'Dana'})[id]]);}
});
beforeEach(async()=>{
 await admin('delete from hearth_connections;delete from hearth_blocks;delete from hearth_kin_groups;delete from hearth_private.introductions;delete from hearth_private.introduction_choices');
 for(const id of [b,c,d]) {await as(a,'select hearth_request_friend($1)',[id]);await as(id,'select hearth_accept_friend($1)',[a]);}
 group=(await as(a,"insert into hearth_kin_groups(name) values('School friends') returning id"))[0].id;
 for(const id of [b,c]) await as(a,'insert into hearth_kin_group_members(group_id,person) values($1,$2)',[group,id]);
});
after(async()=>{await db.close()});
test('groups and membership are private, cannot be forged and do not alter sharing',async()=>{
 assert.equal((await as(b,'select * from hearth_kin_groups')).length,0);
 assert.equal((await as(b,'select * from hearth_kin_group_members')).length,0);
 await assert.rejects(as(b,'insert into hearth_kin_group_members(owner,group_id,person) values($1,$2,$3)',[a,group,c]),/row-level security/);
 await assert.rejects(as(b,'insert into hearth_kin_group_members(group_id,person) values($1,$2)',[group,a]),/foreign key/);
 await assert.rejects(as(a,"insert into hearth_kin_groups(name) values(' school FRIENDS ' )"),/unique/);
 await assert.rejects(as(a,'select * from hearth_private.introductions'),/permission denied/);
 assert.equal((await as(b,'select * from hearth_profiles where id=$1',[c])).length,0);
 await as(a,'delete from hearth_kin_groups where id=$1',[group]);
 assert.equal((await as(a,'select * from hearth_kin_group_members')).length,0);
 assert.equal((await as(a,'select * from hearth_connections where accepted')).length,3);
});
test('eligible pairs rotate, deduplicate shared groups and dismissed pairs stay dismissed',async()=>{
 await as(a,'insert into hearth_kin_group_members(group_id,person) values($1,$2)',[group,d]);
 const pairs=[await next(),await next(),await next()];
 assert.equal(new Set(pairs.map(p=>p.a+p.b)).size,3);
 await as(a,'select hearth_suggest_kin($1,$2,false)',[pairs[0].a,pairs[0].b]);
 for(let n=0;n<4;n++) assert.notDeepEqual(await next(),pairs[0]);
 await assert.rejects(as(d,'select hearth_suggest_kin($1,$2,true)',[b,c]),/no longer available/);
});
test('only the two participants can answer; two yes replies connect exactly once',async()=>{
 await suggest();const [intro]=await list(b);
 assert.equal(intro.person,c);assert.equal(intro.person_name,'Carol');assert.equal(intro.introducer_name,'Alice');
 assert.deepEqual(await list(a),[]);assert.deepEqual(await list(d),[]);
 await assert.rejects(as(a,'select hearth_answer_introduction($1,true)',[intro.id]),/no longer available/);
 await as(b,'select hearth_answer_introduction($1,true)',[intro.id]);
 let pair=await as(b,'select * from hearth_connections where recipient=$1',[c]);
 assert.equal(pair.length,1);assert.equal(pair[0].accepted,false);
 await as(b,'select hearth_answer_introduction($1,true)',[intro.id]);
 assert.equal((await as(b,'select * from hearth_connections where recipient=$1',[c]))[0].accepted,false);
 await as(c,'select hearth_answer_introduction($1,true)',[intro.id]);
 assert.equal((await as(b,'select * from hearth_connections where recipient=$1',[c]))[0].accepted,true);
 assert.deepEqual(await list(b),[]);assert.deepEqual(await list(c),[]);
});
test('a decline cancels pending requests without exposing responses to the introducer',async()=>{
 await suggest();const [intro]=await list(b);
 await as(b,'select hearth_answer_introduction($1,true)',[intro.id]);
 await as(c,'select hearth_answer_introduction($1,false)',[intro.id]);
 assert.equal((await as(b,'select * from hearth_connections where recipient=$1',[c])).length,0);
 assert.deepEqual(await list(b),[]);assert.deepEqual(await list(a),[]);
 assert.equal(await next(),null);
 await assert.rejects(as(b,'select hearth_answer_introduction($1,true)',[intro.id]),/no longer available/);
});
test('blocks and cancellation prevent stale cards reconnecting users',async()=>{
 await suggest();const [intro]=await list(b);
 await as(b,'select hearth_answer_introduction($1,true)',[intro.id]);
 await as(b,'select hearth_remove_friend($1)',[c]);
 await assert.rejects(as(c,'select hearth_answer_introduction($1,true)',[intro.id]),/no longer available/);
 await as(c,'insert into hearth_blocks(owner,target) values($1,$2)',[c,a]);
 assert.deepEqual(await list(c),[]);
 assert.equal((await as(a,'select * from hearth_kin_group_members where person=$1',[c])).length,0);
});
test('hidden blocks, existing connections and ungrouped people are never suggested',async()=>{
 await as(b,'insert into hearth_blocks(owner,target) values($1,$2)',[b,c]);
 assert.equal(await next(),null);
 await as(b,'delete from hearth_blocks');
 await as(b,'select hearth_request_friend($1)',[c]);
 assert.equal(await next(),null);
 await assert.rejects(as(a,'select hearth_suggest_kin($1,$2,true)',[b,d]),/no longer available/);
});
test('reminders are sender-only, pending-only and limited to once a week',async()=>{
 await as(b,'select hearth_request_friend($1)',[c]);
 await assert.rejects(as(b,'select hearth_remind_connection($1)',[c]),/once a week/);
 await admin("update hearth_connections set created_at=now()-interval '8 days' where not accepted");
 await assert.rejects(as(c,'select hearth_remind_connection($1)',[b]),/once a week/);
 await as(b,'select hearth_remind_connection($1)',[c]);
 assert.ok((await as(c,'select reminded_at from hearth_connections where requester=$1',[b]))[0].reminded_at);
 await assert.rejects(as(b,'select hearth_remind_connection($1)',[c]),/once a week/);
});
test('reverse-order consent preserves private pending groups through acceptance',async()=>{
 await suggest();const [intro]=await list(c);
 await as(c,'select hearth_answer_introduction($1,true)',[intro.id]);
 const g=(await as(c,"insert into hearth_kin_groups(name) values('Old friends') returning id"))[0].id;
 await as(c,'insert into hearth_kin_group_members(group_id,person) values($1,$2)',[g,b]);
 await as(b,'select hearth_answer_introduction($1,true)',[intro.id]);
 assert.equal((await as(c,'select * from hearth_connections where recipient=$1',[b]))[0].accepted,true);
 assert.equal((await as(c,'select * from hearth_kin_group_members')).length,1);
 assert.equal((await as(b,'select * from hearth_kin_group_members')).length,0);
 await as(b,'select hearth_remove_friend($1)',[c]);
 assert.equal((await as(c,'select * from hearth_kin_group_members')).length,0);
});
test('anonymous callers cannot enumerate candidates, cards or private groups',async()=>{
 await db.exec('reset role;set role anon');
 for(const sql of ['select * from hearth_kin_groups','select * from hearth_kin_group_members','select hearth_next_introduction()','select hearth_my_introductions()'])
  await assert.rejects(db.query(sql),/permission denied/);
});
