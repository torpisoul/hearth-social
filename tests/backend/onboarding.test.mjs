import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import esmock from 'esmock';

const me = '22222222-2222-4222-8222-222222222222';
const inviter = '11111111-1111-4111-8111-111111111111';
async function setup({profile = null, metadata = {}, ref = '', failSave = false} = {}) {
  const dom = new JSDOM('<div id="app"></div><div id="notice"></div>', {url: `https://example.org/live.html${ref ? '?ref='+ref : ''}`});
  for (const key of ['document','location','history','sessionStorage','localStorage','FormData']) globalThis[key] = dom.window[key];
  let user = {id: me, user_metadata: metadata};
  const tables = {hearth_profiles: profile ? [profile] : [], hearth_preferences: {topics: [], update_mode: 'manual'}, hearth_connections: []};
  const requests = [];
  const client = {
    auth: {onAuthStateChange(){}, async getSession(){return {data: {session: {user}}}}, async updateUser({data}) {
      if (failSave) return {error: {message: 'Could not save choices'}};
      user = {...user, user_metadata: {...user.user_metadata, ...data}};
      return {data: {user}};
    }},
    async rpc(action, args) {requests.push([action,args]); if(action === 'hearth_request_friend') tables.hearth_connections.push({requester:me, recipient:args.person, accepted:false}); return {data: action === 'hearth_event_attendees' ? [] : null}},
    from(table) {let single = false; const q = {select(){return q},eq(){return q},neq(){return q},order(){return q},gte(){return q},limit(){return q},range(){return q},in(){return q},maybeSingle(){single=true;return q},insert(row){tables[table].push(row);return q},upsert(row){tables[table]={...tables[table],...row};return q},then(resolve){return Promise.resolve({data: table==='hearth_profiles' && single ? tables[table][0] || null : tables[table] ?? (single ? null : [])}).then(resolve)}};return q}
  };
  globalThis.fetch = async()=>({ok:true,json:async()=>({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'public'})});
  await esmock('../../js/live/app.js', {'@supabase/supabase-js': {createClient:()=>client}});
  const settle = ()=>new Promise(r=>setTimeout(r,25)); await settle();
  return {dom,tables,requests,get user(){return user},async click(action){document.querySelector(`[data-action="${action}"]`).click();await settle()},async submit(id){document.querySelector('#'+id).dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await settle()}};
}

test('new profile gets optional preferences, saves choices, and completes into parlor', async()=>{
  const app=await setup();
  document.querySelector('#profile input').value='New friend'; await app.submit('profile');
  assert.match(document.querySelector('h2').textContent,/A familiar face/);
  assert.equal(app.user.user_metadata.hearth_onboarding.step,1);
  await app.click('onboarding-next');
  assert.match(document.querySelector('h2').textContent,/colours/);
  document.querySelector('[data-palette-choice="shore"]').click();
  assert.equal(document.documentElement.dataset.palette,'shore');
  await app.click('onboarding-next');
  document.querySelector('[data-topic]').click(); await new Promise(r=>setTimeout(r,25));
  assert.equal(app.tables.hearth_preferences.topics.length,1);
  await app.click('onboarding-next');
  document.querySelector('#updates select').value='foreground'; await app.submit('updates');
  assert.equal(app.tables.hearth_preferences.update_mode,'foreground');
  await app.click('onboarding-next');
  assert.match(document.querySelector('h2').textContent,/gentle nudge/);
  assert.equal(document.querySelector('#nudges select').value,'off');
  document.querySelector('#nudges select').value='on'; await app.submit('nudges');
  await app.click('onboarding-back');
  assert.equal(document.querySelector('#updates select').value,'foreground');
  await app.click('onboarding-next'); await app.click('onboarding-next');
  assert.equal(app.user.user_metadata.hearth_onboarding.complete,true);
  assert.equal(app.user.user_metadata.hearth_nudges,true);
  assert.ok(document.querySelector('#unlock'));
  assert.equal(document.querySelector('.onboarding'),null);
  app.dom.window.close();
});

test('inviter goes first, connects only by consent, and can be skipped', async()=>{
  const app=await setup({ref:inviter});
  document.querySelector('#profile input').value='Friend'; await app.submit('profile');
  assert.ok(document.querySelector('[data-action="connect-inviter"]'));
  assert.equal(app.requests.filter(([r])=>r==='hearth_request_friend').length,0);
  await app.click('connect-inviter');
  assert.deepEqual(app.requests.find(([r])=>r==='hearth_request_friend'),['hearth_request_friend',{person:inviter}]);
  assert.match(document.querySelector('h2').textContent,/on its way/);
  await app.click('dismiss-invite');
  assert.match(document.querySelector('h2').textContent,/familiar face/);
  await app.click('onboarding-finish');
  assert.equal(app.user.user_metadata.hearth_onboarding.complete,true);
  assert.equal(sessionStorage.getItem('hearth-pending-invite'),null);
  app.dom.window.close();
});

test('pending accounts resume on another browser and failed completion stays retryable', async()=>{
  const app=await setup({profile:{id:me,name:'Me'},metadata:{hearth_onboarding:{step:4,complete:false}},failSave:true});
  assert.match(document.querySelector('h2').textContent,/own pace/);
  await app.click('onboarding-finish');
  assert.match(document.querySelector('#notice').textContent,/Could not save/);
  assert.ok(document.querySelector('.onboarding'));
  assert.equal(document.querySelector('[data-action="onboarding-finish"]').disabled,false);
  app.dom.window.close();
});

for (const metadata of [{}, {hearth_onboarding:{step:6,complete:true}}]) test('existing or completed account stays out of onboarding', async()=>{
  const app=await setup({profile:{id:me,name:'Me'},metadata});
  assert.equal(document.querySelector('.onboarding'),null);
  assert.ok(document.querySelector('#status'));
  app.dom.window.close();
});
