# Hearth account email (#89)

## Provider decision — 25 September 2026

Use **Resend Free through Supabase Auth’s custom SMTP** for confirmation and
password recovery. The [free plan](https://resend.com/pricing) currently includes
3,000 emails/month with a 100/day cap. A verified domain is required; domain
registration is separate from the free email service. Supabase’s built-in sender
only delivers to project-team addresses and is unsuitable for this beta.
Resend avoids another runtime or dependency, and standard SMTP lets us change
provider later without changing the browser auth flows.

Brevo is another Supabase-supported SMTP provider worth revisiting if Resend’s
limits become restrictive. Self-hosting adds mail reputation and server upkeep;
paid transactional services are unnecessary at this stage. Future notification
email should be a separate, opt-in delivery path so it cannot exhaust the auth
budget. Do not send private message content through email.

## Activate delivery

The host has chosen **torptcg.com temporarily**, with DNS managed by Netlify.
Use `hearth.torptcg.com` as the dedicated sending subdomain and
`Hearth <accounts@hearth.torptcg.com>` as the sender. The Resend account is created.
Add the exact verification records supplied by Resend to the
Netlify DNS zone for `torptcg.com`; preserve existing website and mail records.
No website or GitHub deployment change is needed to verify this mail subdomain.
A later Hearth domain can be verified and substituted in SMTP settings without
changing account identities.

1. Create a Resend Free account and add `hearth.torptcg.com` under Domains.
   Verify it using the supplied DNS instructions (SPF/DKIM; configure DMARC too).
   Keep open and click tracking disabled: authentication links must not be
   rewritten, and Hearth does not track readership.
2. Create a sending API key restricted to that domain. Set `RESEND_API_KEY`,
   `SUPABASE_ACCESS_TOKEN`, and `HEARTH_EMAIL_FROM` in your private host environment.
   Set `HEARTH_EMAIL_FROM=accounts@hearth.torptcg.com`.
   Do not paste secrets into GitHub, browser configuration, or source files.
3. Run `node scripts/configure-auth-email.mjs` for a credential-free dry run, then
   `node scripts/configure-auth-email.mjs --apply`. This installs Resend SMTP and
   the two templates in `supabase/templates/` on the project in `public-config.json`.
   It preserves existing confirmation settings and redirect allowlists.
4. In Supabase Auth URL Configuration, verify Site URL and allowed redirect URL
   are exactly `https://torpisoul.github.io/hearth-social/live.html`. Use the actual
   deployed URL if hosting changes. Avoid wildcard production redirects.
5. Send a password-reset request for a disposable existing account to an inbox
   outside the Supabase team. Open the email, save a new password, and confirm the
   new password signs in and the old one fails. Check expired/reused links fail.
6. Once delivery works, enable **Confirm email** under Supabase Auth’s email
   provider settings. Create a disposable account: it must stay signed out until
   the confirmation link is used, then permit login. Check spam folders and
   provider delivery failures. Delete the disposable accounts afterwards.
7. Set `emailDeliveryEnabled` to `true` in `public-config.json`, run
   `npm run test:release`, and publish. Update the beta status in README.md.
   The flag exposes reset controls; Supabase independently enforces confirmation.

Supabase initially limits custom SMTP to 30 emails/hour; review Auth rate limits
alongside Resend’s daily/monthly quotas. Keep the free plan and monitor usage
before increasing limits. A delivery outage should be fixed at the provider;
do not silently disable email verification to bypass it.

## Current state

On 25 September 2026, the five supplied DNS records were saved in Netlify with
its default 3600-second TTL. The existing website records were preserved.
Resend verified DKIM and both sending CNAME records; the optional receiving MX
record was still pending at the last check. Tracking has not been configured.

Custom SMTP is saved in Supabase using `smtp.resend.com:465`, username `resend`,
and the Hearth sender above. The provider credential is stored only in Supabase,
not in this repository. Both email templates were installed. Site URL and the
single allowed redirect are `https://torpisoul.github.io/hearth-social/live.html`.

A real account reset email and confirmation flow still need delivery testing.
`emailDeliveryEnabled` stays false until the live checks pass; confirmation
enforcement has not yet been changed. Browser tests use a mocked mail backend
and cannot establish inbox delivery.

References: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Resend SMTP and prerequisites](https://resend.com/docs/send-with-smtp),
[Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
