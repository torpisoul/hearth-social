import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Run on the host only. SMTP and management credentials never enter the site build.
export async function configureAuthEmail({env = process.env, apply = false, fetcher = fetch} = {}) {
  const sender = env.HEARTH_EMAIL_FROM;
  if (!sender || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sender)) throw Error('Set HEARTH_EMAIL_FROM to your verified sender address.');
  const config = JSON.parse(await readFile(new URL('../public-config.json', import.meta.url), 'utf8'));
  const project = new URL(config.supabaseUrl).hostname.split('.')[0];
  const payload = {
    smtp_host: 'smtp.resend.com', smtp_port: 465, smtp_user: 'resend',
    smtp_admin_email: sender, smtp_sender_name: 'Hearth',
    mailer_subjects_confirmation: 'Confirm your Hearth account',
    mailer_subjects_recovery: 'Reset your Hearth password',
    mailer_templates_confirmation_content: await readFile(new URL('../supabase/templates/confirmation.html', import.meta.url), 'utf8'),
    mailer_templates_recovery_content: await readFile(new URL('../supabase/templates/recovery.html', import.meta.url), 'utf8'),
  };
  if (!apply) return {project, sender, host: payload.smtp_host, applied: false};
  if (!env.SUPABASE_ACCESS_TOKEN || !env.RESEND_API_KEY) throw Error('Set SUPABASE_ACCESS_TOKEN and RESEND_API_KEY in the host environment.');
  const response = await fetcher(`https://api.supabase.com/v1/projects/${project}/config/auth`, {
    method: 'PATCH',
    headers: {Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({...payload, smtp_pass: env.RESEND_API_KEY}),
  });
  // Never log the response body: management responses can contain credentials.
  if (!response.ok) throw Error(`Auth email configuration failed (HTTP ${response.status}).`);
  return {project, sender, applied: true};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(await configureAuthEmail({apply: process.argv.includes('--apply')})); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
