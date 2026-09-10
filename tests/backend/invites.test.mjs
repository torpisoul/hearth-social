import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import esmock from 'esmock';
import { readInvite, inviteUrl } from '../../js/live/invites.js';
const inviter = '11111111-1111-4111-8111-111111111111';
const visitor = '22222222-2222-4222-8222-222222222222';
test('invite URLs preserve the repository path and reject malformed referrals', () => {
  const url = inviteUrl('https://example.org/hearth/index.html?old=1#secret', inviter);
  assert.equal(url, `https://example.org/hearth/live.html?ref=${inviter}`);
  assert.equal(readInvite(url), inviter);
  assert.equal(readInvite('https://example.org/?ref=<script>'), null);
});
test('invitation survives signup and nickname creation, then sends a consent-based request', async () => {
  const dom = new JSDOM('<div id="app"></div><div id="notice"></div>', { url: `https://example.org/hearth/live.html?ref=${inviter}` });
  for (const key of ['document', 'location', 'history', 'sessionStorage', 'localStorage', 'FormData']) globalThis[key] = dom.window[key];
  let profile = null, connections = [], calls = [];
  const client = {
    auth: { onAuthStateChange() {}, async getSession() { return { data: { session: null } }; }, async signUp() { return { data: { user: { id: visitor }, session: {} } }; } },
    from(table) {
      let single = false;
      const q = { select() { return q; }, eq() { return q; }, neq() { return q; }, order() { return q; }, gte() { return q; }, limit() { return q; }, range() { return q; }, in() {return q;}, maybeSingle() { single = true; return q; }, insert(value) { if (table === 'hearth_profiles') profile = value; return q; }, then(resolve) { return Promise.resolve({ data: table === 'hearth_profiles' ? (single ? profile : profile ? [profile] : []) : table === 'hearth_connections' ? connections : table === 'hearth_preferences' ? null : [] }).then(resolve); } };
      return q;
    },
    async rpc(action, args) { calls.push([action,args]); if (action === 'hearth_request_friend') connections = [{requester:visitor,recipient:args.person,accepted:false}]; return {data:null}; }
  };
  globalThis.fetch = async () => ({ok:true, json:async()=>({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'public'})});
  await esmock('../../js/live/app.js', {'@supabase/supabase-js':{createClient:()=>client}});
  const settle = () => new Promise(r=>setTimeout(r,20));
  await settle();
  assert.equal(document.querySelector('[data-action="signup"]').getAttribute('aria-pressed'),'true');
  assert.equal(sessionStorage.getItem('hearth-pending-invite'),inviter);
  document.querySelector('[name=email]').value='visitor@example.org';
  document.querySelector('[name=password]').value='test-password-only';
  document.querySelector('#auth').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await settle();
  document.querySelector('[name=name]').value='New friend';
  document.querySelector('#profile').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await settle();
  assert.ok(document.querySelector('[data-action="connect-inviter"]'));
  assert.equal(calls.filter(([name])=>name==='hearth_request_friend').length,0);
  document.querySelector('[data-action="connect-inviter"]').click();
  await settle();
  assert.deepEqual(calls.find(([name])=>name==='hearth_request_friend'),['hearth_request_friend',{person:inviter}]);
  assert.match(document.body.textContent,/Your request is on its way/);
  document.querySelector('[data-action="dismiss-invite"]').click();
  await settle();
  assert.equal(sessionStorage.getItem('hearth-pending-invite'),null);
  assert.equal(location.search,'');
  dom.window.close();
});
