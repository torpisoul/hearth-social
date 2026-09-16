# Hearth notifications

send-push is an authenticated, rate-limited self-test. dispatch-push runs from the
hearth-notifications cron job every minute using a dedicated secret from Supabase
Vault. Neither accepts arbitrary notification copy or destinations.

Messages, shared moments, gathering invitations and connection requests queue
references only, never text or ciphertext. The dispatcher rechecks preferences,
topics, connections, blocks and source visibility before sending fixed gentle copy.
Only devices deliberately enabled by their user receive notifications.

- Immediate: normally within one minute.
- Hourly: after the oldest arrival has waited an hour, no more than hourly.
- Daily: the next selected local check-in after an arrival, once per local date.
  Saving preferences records the device's IANA time zone; DST follows that zone.
  No notification on an empty day.

Leases prevent concurrent workers from claiming the same batch. Acknowledgements
preserve arrivals received during delivery. Failures back off for five minutes
with up to five handled attempts. Crashed workers retry after five-minute lease
expiry. A crash after push acceptance can cause a duplicate; a shared notification
tag replaces earlier cards. Queue references expire after seven days. One successful
device completes a batch to avoid repeatedly nudging other devices. Expired
subscriptions (404/410) are removed. Accepted browser pushes cannot be recalled;
their TTL is five minutes.

## Setup / recovery

Use the project CLI via npx supabase. Never commit .temp/ secrets.

1. Run node scripts/prepare-push-secrets.mjs. It generates permission-restricted
   credentials in supabase/.temp/ and prints only the public key. Reusing the file
   keeps deployed keys stable. Back it up securely; do not casually rotate keys.
2. Preview and apply the two notification migrations using db push --dry-run and
   db push. Never reset or use --include-all to work around migration drift.
3. Upload secrets with secrets set --env-file supabase/.temp/push-secrets.env.
4. Store the matching cron secret using db query --linked --file supabase/.temp/push-vault.sql.
5. Deploy with functions deploy send-push dispatch-push --use-api. The config file
   disables gateway JWT checks because each handler verifies its own credentials.
6. Run db query --linked --file supabase/notification-schedule.sql to create or update
   the single named cron job.
7. Put only the public VAPID key in public-config.json, build, review and publish.

To pause delivery, deactivate only hearth-notifications in Supabase Cron. Inspect
cron.job_run_details and net._http_response for failures. Do not log request headers,
device endpoints or private keys. Operators should not send real-user tests:
each user deliberately clicks their own test button.

Manual device acceptance still requires Android Chrome and an installed iOS Home
Screen app: verify denial, opt-out, sign-out, two devices and delivery timing.
Automated tests cover queue privacy, eligibility, leases, grouping, backoff, consent
and fixed notification destinations.
