# Hearth

A digital living room for your people: real accounts, mutual friend connections, chronological statuses, and encrypted direct messages.

**Current beta signup:** email verification is disabled by the host. Email ownership is not checked. Password-reset email is unavailable until custom SMTP is configured. Save account passwords and messaging passphrases. Verify friend codes directly with people you know.

The friends beta is built for GitHub Pages with Supabase Auth and Postgres. The original fictional prototype is preserved at `demo.html`; its gatherings, notifications, local preferences and other experiments remain separate from real user data.

## Run locally

Requires Node.js 22+ and Python 3.

```sh
npm ci
npm test
npm run build
npm run preview
```

Open http://localhost:4173. The build bundles the Supabase client locally and publishes an explicit file allowlist into `docs/`. Serve over localhost or HTTPS so Web Crypto works. Do not open HTML via `file://`.

## Backend setup

The configured project is Hearth (`nkpzdvpzlxiwrtivpiwv`) in Frankfurt. Its public URL and publishable key live in `public-config.json`. A publishable key is deliberately public; authorization comes from database grants and row-level security (RLS). Never put database passwords, secret keys or service-role keys in the frontend or repository.

For a new project:

1. Create a Supabase project with the Data API enabled, automatic table exposure disabled and RLS enabled.
2. Run both SQL files in `supabase/migrations/` in filename order against the empty database. This defines the seven Hearth tables, access policies, guarded RPCs, and write limits. The initial Hearth project was provisioned through the dashboard SQL editor; it is not recorded in the Supabase migration-history table. Reconcile migration history before adopting automatic CLI deployment; do not blindly replay the initial migration. The account-deletion/policy-hardening migration is recorded in hosted history.
3. Set `supabaseUrl` and `supabasePublishableKey` in `public-config.json`. The build rejects secret keys and incomplete settings.
4. Set Auth Site URL and allowed redirect URL to `https://torpisoul.github.io/hearth-social/live.html`. For a different host, use its exact `live.html` URL. The site works at the repository subpath.
5. Configure custom SMTP before relying on email confirmation or password resets for friends. Supabase's default sender only delivers to project-team addresses. See https://supabase.com/docs/guides/auth/auth-smtp.
6. Run tests, build and deploy. Test with two real accounts before inviting a wider group.

Blank public settings produce an honest setup screen with a link to the fictional demo; there is no silent fake multi-user fallback.

## Sharing with friends

- Create an account and choose a nickname.
- In **Your kin**, share the site link and your friend code privately with someone you know. They send a request; you accept it. There is no public user directory.
- Share a status with **Only me**, **All kin**, or **Inner circle**. Inner-circle membership is controlled by the author, and enforced on the server.
- Both people open **The parlor**, choose a separate messaging passphrase (at least 16 characters), and save it in a password manager. Then select each other and send a note.
- Use **Refresh** when you choose to check in. Feeds and message history load in finite pages of 20, with no background urgency or read receipts.
- Test on another device by signing in and unlocking with the same messaging passphrase.
- Block or disconnect in **Your kin**. Blocking prevents new messages and hides shared statuses. Already delivered messages remain available to their participants; disconnecting removes the conversation from the active UI.
- **Your preferences** exports account/profile details, connections, own statuses, ciphertext messages and the encrypted key backup. Downloads contain private data: keep them somewhere safe.

## Encryption and privacy

Messages use the browser's Web Crypto API: P-256 ECDH to derive an AES-256-GCM conversation key, a random 96-bit nonce per message, and authenticated metadata binding version, message ID, sender and recipient. The backend receives ciphertext and routing metadata, never message plaintext. Rendering uses escaped text.

Private keys are backed up as AES-GCM ciphertext protected by a separate passphrase using PBKDF2-SHA-256 with 600,000 iterations and a random salt. Only the owner can retrieve their encrypted vault. Private keys are non-extractable in memory after setup/unlock; plaintext messages and private keys are not written to localStorage. The account session and peer public-key fingerprints are persisted in browser storage.

Public keys are immutable through the client API. The app pins a peer's first-seen key on each browser and refuses a changed key. Compare fingerprints through a separate trusted channel. First contact still trusts the key directory; a compromised frontend, device or backend distributing a false first key is outside this beta's protection. This is a static-key protocol without forward secrecy or independent cryptographic audit. Losing the messaging passphrase makes history unrecoverable; resetting the account password does not reset the messaging key.

Statuses are **not** end-to-end encrypted. Supabase stores status text, profile names, connection records, timestamps and message routing metadata. RLS controls access. The hosting and backend providers may retain infrastructure logs. No analytics, ads, tracking pixels or external fonts are included.

This is a small friends beta, not a fully moderated public network. There is blocking, but no reporting queue, media attachments, live gatherings yet. Self-service account deletion is available in Your preferences and revokes sessions before cascading account data. Contact the host for abuse reports. Before deleting an account administratively, revoke its sessions first; Supabase access tokens can otherwise remain valid until expiry. Database foreign keys cascade account data deletion; recipients may retain previously downloaded data.

## Verification

`npm test` runs the fictional-demo behavior suite plus:

- Real Postgres policy tests through PGlite for anonymous access denial, impersonation prevention, mutual friend acceptance, audience privacy, author-controlled inner circles, vault isolation, immutable keys, blocking, server timestamps and write limits.
- Encryption tests for two users, a restored device, wrong passphrases, unrelated keys, modified ciphertext and modified recipient metadata.

The database limits each account to 30 messages/minute, 30 retained statuses/hour, and 20 retained requests/hour. These are beta safeguards, not a full anti-abuse system; deleted statuses/requests no longer count. Supabase Auth has separate signup/IP limits. Add CAPTCHA and operational monitoring before broader promotion.

`npm run test:legacy` retains the old Netlify/Vitest suite for reference. That implementation is not deployed by this build and has pre-existing failing pulse tests. The new Pages workflow tests the live backend and demo, then builds only the static allowlist. `npm audit` should be reviewed during dependency updates.

## Publish

Push to `main`. In GitHub Settings → Pages, choose **GitHub Actions** as the source. **Deploy Hearth to Pages** tests and builds the app, then deploys `docs/`. Alternatively use the `main` branch `/docs` source, but choose one deployment method.

The older HTML/Netlify implementation and tests remain in source as reference, and are excluded from published assets. Old login/profile/parlor URLs serve the live app; the old notice board points to fictional demo gatherings.

Hosted verification on 10 September 2026 passed signup, profile storage, mutual connections, status isolation, encrypted delivery, key-backup unlock, outsider denial and blocking with three disposable accounts; all were cleaned up. Supabase Security Advisor reports only leaked-password protection disabled (an Auth setting); database policy/function warnings were resolved.
