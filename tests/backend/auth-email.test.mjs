import test from 'node:test';
import assert from 'node:assert/strict';
import { configureAuthEmail } from '../../scripts/configure-auth-email.mjs';

const env = {HEARTH_EMAIL_FROM: 'accounts@example.test', RESEND_API_KEY: 'secret-email-key', SUPABASE_ACCESS_TOKEN: 'secret-management-key'};
test('email setup dry run makes no request and exposes no credentials', async () => {
  const result = await configureAuthEmail({env, fetcher: () => {throw Error('Unexpected request');}});
  assert.equal(result.applied, false);
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test('email setup configures SMTP and templates without changing verification or redirects', async () => {
  let request;
  const result = await configureAuthEmail({env, apply:true, fetcher: async (url, options) => {
    request = {url, ...options}; return {ok:true};
  }});
  const payload = JSON.parse(request.body);
  assert.equal(request.method, 'PATCH');
  assert.equal(payload.smtp_pass, env.RESEND_API_KEY);
  assert.equal(payload.smtp_host, 'smtp.resend.com');
  assert.equal(payload.smtp_port, 465);
  assert.match(payload.mailer_templates_confirmation_content, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(payload.mailer_templates_recovery_content, /\{\{ \.ConfirmationURL \}\}/);
  assert.equal('mailer_autoconfirm' in payload, false);
  assert.equal('uri_allow_list' in payload, false);
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test('email setup validates inputs and suppresses sensitive failure bodies', async () => {
  await assert.rejects(configureAuthEmail({env:{}}), /verified sender/);
  await assert.rejects(configureAuthEmail({env:{HEARTH_EMAIL_FROM:env.HEARTH_EMAIL_FROM},apply:true}), /SUPABASE_ACCESS_TOKEN/);
  await assert.rejects(configureAuthEmail({env,apply:true,fetcher:async()=>({ok:false,status:401, text:()=>{throw Error('Do not read secrets');}})}), /HTTP 401/);
});
