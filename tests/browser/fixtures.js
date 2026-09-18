import { test as base, expect } from '@playwright/test';

export const me = '22222222-2222-4222-8222-222222222222';
export const friend = '11111111-1111-4111-8111-111111111111';
export const test = base.extend({
  backend: async ({ page }, use) => {
    const state = {
      user: { id: me, aud: 'authenticated', role: 'authenticated', email: 'friend@example.test', user_metadata: { hearth_onboarding: { complete: true } } },
      calls: [], unexpected: [], fail: null, pushPublicKey: '', introductions: [], suggestion: null,
      tables: {
        hearth_profiles: [{ id: me, name: 'Robin' }, { id: friend, name: 'Alex' }],
        hearth_preferences: [{ owner: me, topics: ['Everyday life'], update_mode: 'manual', notification_mode: 'in_app', notification_time: '20:00' }],
        hearth_connections: [{ requester: me, recipient: friend, accepted: true }],
        ...Object.fromEntries(['circle','blocks','statuses','events','rsvps','event_invites','messages','waiting_notes','kin_groups','kin_group_members','feedback','keys','push_subscriptions'].map(n => ['hearth_' + n, []])),
      },
      session() { return { access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user: state.user }; },
    };
    await page.route('**/public-config.json', route => route.fulfill({ json: { supabaseUrl: 'https://hearth-test.supabase.co', supabasePublishableKey: 'sb_publishable_browser_fixture', emailDeliveryEnabled: true, pushPublicKey: state.pushPublicKey } }));
    await page.route('https://*.supabase.co/**', async route => {
      const req = route.request(), url = new URL(req.url());
      const body = req.postData() ? req.postDataJSON() : null;
      const call = { path: url.pathname, method: req.method(), body, query: url.searchParams };
      state.calls.push(call);
      const reply = (json, status = 200) => route.fulfill({ status, json });
      if (state.fail?.(call)) return reply({ message: 'Test service unavailable', msg: 'Test service unavailable', code: 'test_failure' }, 400);
      if (url.pathname === '/auth/v1/token') return reply(state.session());
      if (url.pathname === '/auth/v1/signup') return reply(state.confirmEmail ? state.user : state.session());
      if (url.pathname === '/auth/v1/recover') return reply({});
      if (url.pathname === '/auth/v1/logout') return reply({});
      if (url.pathname === '/functions/v1/send-push') return reply({sent:1});
      if (url.pathname === '/auth/v1/user') { if (body?.data) Object.assign(state.user.user_metadata, body.data); return reply(state.user); }
      const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(.+)$/)?.[1];
      if (rpc) {
        if (rpc === 'hearth_my_introductions') return reply(state.introductions);
        const empty = ['hearth_sent_introductions','hearth_event_attendees'];
        if (empty.includes(rpc)) return reply([]);
        if (rpc === 'hearth_my_vault') return reply(state.tables.hearth_keys[0]?.vault || null);
        if (rpc === 'hearth_public_key') return reply(body.person === me ? state.tables.hearth_keys[0]?.public_key || null : null);
        if (rpc === 'hearth_next_introduction') return reply(state.suggestion);
        if (rpc === 'hearth_suggest_kin') {state.suggestion=null;return reply(null);}
        if (rpc === 'hearth_answer_introduction') {state.introductions=state.introductions.filter(i=>i.id!==body.introduction);return reply(null);}
        if (rpc === 'hearth_remind_connection') return reply(null);
        if (rpc === 'hearth_request_friend') { state.tables.hearth_connections.push({requester:me,recipient:body.person,accepted:false}); return reply(null); }
        if (rpc === 'hearth_accept_friend') { state.tables.hearth_connections.find(c=>c.requester===body.person).accepted=true; return reply(null); }
        if (rpc === 'hearth_remove_friend') { state.tables.hearth_connections=state.tables.hearth_connections.filter(c=>![c.requester,c.recipient].includes(body.person)); return reply(null); }
        if (rpc === 'hearth_delete_account') return reply(null);
        if (rpc === 'hearth_save_event') {
          const plan={id:body.plan || crypto.randomUUID(),owner:me,title:body.plan_title,place:body.plan_place,details:body.plan_details,starts_at:body.plan_start,ends_at:body.plan_end,all_day:body.plan_all_day,time_zone:body.plan_zone};
          state.tables.hearth_events=state.tables.hearth_events.filter(p=>p.id!==plan.id).concat(plan);
          state.tables.hearth_event_invites=state.tables.hearth_event_invites.filter(i=>i.event!==plan.id).concat(body.invitees.map(person=>({event:plan.id,person})));
          return reply(plan.id);
        }
        state.unexpected.push(call); return reply({message:'Unhandled test RPC: '+rpc}, 500);
      }
      const table = url.pathname.match(/^\/rest\/v1\/([^/]+)$/)?.[1];
      if (table && table in state.tables) {
        const matches = row => [...url.searchParams].every(([key,value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3));
        if (req.method() === 'POST') {
          for (const row of Array.isArray(body) ? body : [body]) {
            const existing = table === 'hearth_preferences' ? state.tables[table].find(r=>r.owner===row.owner) : null;
            if (existing) Object.assign(existing,row); else state.tables[table].push({id:crypto.randomUUID(),created_at:new Date().toISOString(),...(table==='hearth_rsvps'?{person:me}:{}),...row});
          }
          const created=state.tables[table].at(-1);
          return reply(req.headers().prefer?.includes('return=representation') ? (req.headers().accept?.includes('application/vnd.pgrst.object') ? created : [created]) : null, 201);
        }
        if (req.method() === 'PATCH') { state.tables[table].filter(matches).forEach(r=>Object.assign(r,body)); return reply(null); }
        if (req.method() === 'DELETE') { state.tables[table]=state.tables[table].filter(r=>!matches(r)); return reply(null); }
        const rows = state.tables[table].filter(matches);
        const single = req.headers().accept?.includes('application/vnd.pgrst.object');
        return reply(single ? rows[0] || null : rows);
      }
      state.unexpected.push(call); return reply({message:'Unhandled test request'}, 500);
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(state);
    expect(state.unexpected, 'Every API request needs an explicit fixture contract').toEqual([]);
    expect(errors, 'Browser runtime errors').toEqual([]);
  },
});
export { expect };

export class Hearth {
  constructor(page) { this.page = page; }
  async open() { await this.page.goto('live.html'); }
  async credentials() { await this.page.getByLabel('Email', {exact:true}).fill('friend@example.test'); await this.page.getByLabel('Password', {exact:true}).fill('a-test-password-123'); }
  async signIn() { await this.open(); await this.credentials(); await this.page.getByRole('button',{name:'Sign in',exact:true}).click(); await expect(this.page.locator('#auth')).toHaveCount(0); }
  async tab(id) {
    if (await this.page.getByRole('button',{name:'Open menu',exact:true}).isVisible()) await this.page.getByRole('button',{name:'Open menu',exact:true}).click();
    await this.page.locator(`[data-tab="${id}"]:visible`).first().click();
  }
  async choice(form, name, value) {
    const box = this.page.locator(`${form} .soft-choice`).filter({has:this.page.locator(`select[name="${name}"]`)});
    await box.locator('[data-soft-toggle]').click();
    await box.locator(`[data-soft-option="${value}"]`).click();
  }
}
