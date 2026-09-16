import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
let db;
const admin=async sql=>{await db.exec('reset role');return (await db.exec(sql)).at(-1).rows};
const as=async(id,sql,args=[])=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`);return(await db.query(sql,args)).rows};
const service=async(sql,args=[])=>{await db.exec('reset role;set role service_role');return(await db.query(sql,args)).rows};
const post=()=>as(a,"insert into hearth_statuses(author,content,topic,audience) values($1,'A walk','Outdoors','All kin') returning id",[a]);
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values('${a}'),('${b}');`);
 for(const file of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())
  await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await as(a,"insert into hearth_profiles(id,name) values($1,'A')",[a]);await as(b,"insert into hearth_profiles(id,name) values($1,'B')",[b]);
 await as(a,'select hearth_request_friend($1)',[b]);await as(b,'select hearth_accept_friend($1)',[a]);
});
beforeEach(async()=>{
 await admin('delete from public.hearth_blocks;delete from public.hearth_preferences;delete from public.hearth_push_subscriptions;delete from hearth_private.notification_queue;delete from hearth_private.notification_delivery;');
 await as(b,"insert into hearth_preferences(owner,topics,notification_mode,notification_time,notification_zone) values($1,array['Outdoors'],'immediate','00:00','Europe/London')",[b]);
 await as(b,"insert into hearth_push_subscriptions(owner,endpoint,p256dh,auth) values($1,'https://fcm.googleapis.com/test',repeat('a',87),repeat('b',22))",[b]);
});
after(async()=>{await db.close()});
test('claims require service role and cannot be claimed twice',async()=>{
 await post();
 await assert.rejects(as(b,'select * from hearth_claim_notifications()'),/permission denied/);
 const [claim]=await service('select * from hearth_claim_notifications()');assert.equal(claim.owner,b);
 assert.equal((await service('select * from hearth_claim_notifications()')).length,0);
 assert.equal((await service('select * from hearth_notification_targets($1,$2)',[b,claim.token])).length,1);
 await service('select hearth_finish_notifications($1,$2,true)',[b,claim.token]);
 assert.equal((await admin('select * from hearth_private.notification_queue')).length,0);
});
test('hourly digest waits an hour and respects the last delivery',async()=>{
 await as(b,"update hearth_preferences set notification_mode='hourly'");await post();
 assert.equal((await service('select * from hearth_claim_notifications()')).length,0);
 await admin("update hearth_private.notification_queue set created_at=now()-interval '61 minutes'");
 const [claim]=await service('select * from hearth_claim_notifications()');assert.equal(claim.mode,'hourly');
 await service('select hearth_finish_notifications($1,$2,true)',[b,claim.token]);await post();
 await admin("update hearth_private.notification_queue set created_at=now()-interval '61 minutes'");
 assert.equal((await service('select * from hearth_claim_notifications()')).length,0);
});
test('daily digest sends once per local calendar day and rejects invalid time zones',async()=>{
 await as(b,"update hearth_preferences set notification_mode='daily'");await post();
 await admin("update hearth_private.notification_queue set created_at=now()-interval '1 day'");
 const [claim]=await service('select * from hearth_claim_notifications()');assert.equal(claim.mode,'daily');
 await service('select hearth_finish_notifications($1,$2,true)',[b,claim.token]);await post();
 await admin("update hearth_private.notification_queue set created_at=now()-interval '1 day'");
 assert.equal((await service('select * from hearth_claim_notifications()')).length,0);
 await assert.rejects(as(b,"update hearth_preferences set notification_zone='Invalid/Zone'"),/valid time zone/);
 await assert.rejects(as(b,"update hearth_preferences set notification_time='25:99'"),/valid check-in time/);
});
test('opt-out and blocks revoke an already claimed notification',async()=>{
 await post();let [claim]=await service('select * from hearth_claim_notifications()');
 await as(b,"update hearth_preferences set notification_mode='in_app'");
 assert.equal((await service('select * from hearth_notification_targets($1,$2)',[b,claim.token])).length,0);
 assert.equal((await admin('select * from hearth_private.notification_queue')).length,0);
 await post();assert.equal((await admin('select * from hearth_private.notification_queue')).length,0);
 await as(b,"update hearth_preferences set notification_mode='immediate'");await post();
 [claim]=await service('select * from hearth_claim_notifications()');
 await as(b,'insert into hearth_blocks(owner,target) values($1,$2)',[b,a]);
 assert.equal((await service('select * from hearth_notification_targets($1,$2)',[b,claim.token])).length,0);
});
test('a deleted source or deselected topic never produces a notification',async()=>{
 const [status]=await post();await as(a,'delete from hearth_statuses where id=$1',[status.id]);
 assert.equal((await service('select * from hearth_claim_notifications()')).length,0);
 await post();await as(b,"update hearth_preferences set topics='{}'");
 assert.equal((await service('select * from hearth_claim_notifications()')).length,0);
});
test('acknowledging a batch preserves events received while sending and failures back off',async()=>{
 await post();const [claim]=await service('select * from hearth_claim_notifications()');await post();
 await service('select hearth_finish_notifications($1,$2,true)',[b,claim.token]);
 assert.equal((await admin('select * from hearth_private.notification_queue')).length,1);
 await admin("update hearth_private.notification_delivery set last_sent=now()-interval '2 minutes'");
 const [retry]=await service('select * from hearth_claim_notifications()');
 await service('select hearth_finish_notifications($1,$2,false)',[b,retry.token]);
 assert.equal((await service('select * from hearth_claim_notifications()')).length,0);
 assert.equal((await admin('select * from hearth_private.notification_queue')).length,1);
});
