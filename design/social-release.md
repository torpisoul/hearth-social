# Social interactions release

Apply the two September 29 migrations before publishing the rebuilt `docs/` output. Existing client behavior remains compatible with the additive tables and fields. The waiting-note trigger preserves the server's original note date; existing already-delivered notes cannot be backfilled after their waiting row was deleted.

Deploy `cleanup-moment-media` with the same `HEARTH_DISPATCH_SECRET` used by `dispatch-push`. Apply `supabase/media-cleanup-schedule.sql` to schedule an authenticated POST hourly using `x-hearth-dispatch-secret` from Vault. Its project URL matches the existing notification scheduler; update that URL when deploying to a different project. This removes up to 100 unreferenced private Storage objects older than 24 hours per run, covering interrupted uploads, deleted posts and account deletion. Never delete `storage.objects` rows directly: the function uses the Storage API to remove the actual bytes. Failed runs are retryable. Normal post deletion and failed-publish cleanup also run immediately in the client.

The private `hearth-moments` bucket accepts JPEG, PNG and WebP, up to 2 MiB per stored image. The browser accepts at most four source images up to 10 MiB each, resizes to 1600 pixels and strips metadata by rendering to WebP. Authenticated downloads recheck the post's current audience. There are no public or long-lived signed image links.

Group cryptography and its limits are documented in `group-chat-security.md`. Group notifications are in-app only; no message content or group preview is added to push payloads. Conversation read markers and workflow overrides are private. Direct-message read markers remain device-local, matching existing behavior. Public reactions expose only the requesting user's current selection.

Deployment validation on 29 September 2026: 89 backend tests and 320 Playwright tests passed in the release container across Chromium, Firefox, WebKit and mobile Chromium. The feature permutations and fixture boundaries are documented in `TESTING.md`.

Hosted migrations `20260929144831_social_interactions` and `20260929145609_group_conversations` are applied. The private bucket has a 2 MiB limit. The cleanup function is active, its authenticated smoke request returned HTTP 200, and `hearth-media-cleanup` runs hourly at minute 17.

Hosted Security Advisor reports the two pre-existing warnings: pg_net in public and leaked-password protection disabled. Private backend tables intentionally have RLS enabled without client policies; access goes through guarded RPCs. No new security warnings were introduced.
