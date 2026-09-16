import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {enablePush, disablePush} from '../../js/live/push.js';
import {allowedEndpoint, maySend} from '../../supabase/functions/send-push/policy.js';
test('push consent rejects quiet modes before requesting permission', async () => {
 let prompted=0;
 const env={isSecureContext:true,Notification:{requestPermission(){prompted++;}},PushManager:{},navigator:{serviceWorker:{}}};
 for (const mode of ['manual','in_app',undefined]) await assert.rejects(enablePush({},'me',mode,'key',env));
 assert.equal(prompted,0);
});
test('denied permission never creates a subscription',async()=>{
 const env={isSecureContext:true,Notification:{requestPermission:async()=> 'denied'},PushManager:{},navigator:{serviceWorker:{}}};
 await assert.rejects(enablePush({},'me','immediate','key',env),/remain off/);
});
test('failed persistence undoes a newly created subscription',async()=>{
 let removed=false;
 const sub={endpoint:'https://fcm.googleapis.com/x',toJSON:()=>({keys:{p256dh:'x',auth:'y'}}),unsubscribe:async()=>{removed=true}};
 const env={isSecureContext:true,Notification:{requestPermission:async()=> 'granted'},PushManager:{},navigator:{serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>null,subscribe:async()=>sub}})}}};
 await assert.rejects(enablePush({from:()=>({upsert:async()=>({error:Error()})})},'me','daily','key',env));
 assert.equal(removed,true);
});
test('sender rejects opt-out and endpoint redirects to arbitrary hosts',()=>{
 for (const mode of ['manual','in_app',undefined]) assert.equal(maySend(mode),false);
 assert.equal(allowedEndpoint('https://fcm.googleapis.com/x'),true);
 for (const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x']) assert.equal(allowedEndpoint(endpoint),false);
});
test('turning off a device removes its own record before unsubscribing',async()=>{
 const calls=[];
 const query={eq(field,value){calls.push([field,value]);return query},then(resolve){resolve({error:null})}};
 const client={from:()=>({delete:()=>query})};
 const env={navigator:{serviceWorker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>({endpoint:'endpoint',unsubscribe:async()=>calls.push('unsubscribe')})},getNotifications:async()=>[{close:()=>calls.push('close')}]})}}};
 await disablePush(client,'owner',env);
 assert.deepEqual(calls,[['owner','owner'],['endpoint','endpoint'],'unsubscribe','close']);
});
test('worker uses the project path and never opens payload URLs or displays payload text',async()=>{
 const handlers={};let notification,opened;
 const self={registration:{scope:'https://torpisoul.github.io/hearth-social/',showNotification:async(title,options)=>{notification={title,...options}}},
  addEventListener:(name,handler)=>handlers[name]=handler,
  clients:{matchAll:async()=>[],openWindow:async url=>{opened=url}}};
 vm.runInNewContext(await readFile(new URL('../../sw.js',import.meta.url),'utf8'),{self,URL});
 let pending;
 handlers.push({data:{json:()=>({body:'private text',url:'https://evil.test'})},waitUntil:p=>pending=p});await pending;
 assert.ok(!JSON.stringify(notification).includes('private text'));
 handlers.notificationclick({notification:{close(){},data:{url:'https://evil.test'}},waitUntil:p=>pending=p});await pending;
 assert.equal(opened,'https://torpisoul.github.io/hearth-social/live.html');
});
