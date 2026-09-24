# Release verification

Run `npm ci`, `npx playwright install --with-deps chromium firefox webkit`, then
`npm run test:release`. The release command runs the existing low-level tests,
builds `docs`, and exercises that actual build in Playwright. To retest an
already-built artifact, use `npm run test:browser`.

Playwright runs desktop Chromium, Firefox, WebKit, and mobile Chromium. For a
host that cannot run every engine, select a project with
`npm run test:browser -- --project=chromium`. CI installs all browser dependencies
on Ubuntu. Tests use accessible labels and actual clicks/keyboard submission;
do not replace interactions with dispatched submit events or app function calls.

## Release pipeline

1. Pull requests to main build and serve their candidate in an isolated Actions
   runner at a repository subpath. All browser projects must pass the test job.
2. Main builds, runs the low-level checks and browser suite, then uploads **the
   same tested directory** as the Pages artifact. A failed check prevents deploy.
3. After deployment, Chromium repeats the suite at the returned Pages URL.
   The build marker must match the workflow commit, so a stale deployment fails.
   Failure makes the workflow red; it does not automatically roll back a release.
4. Reports, screenshots and failure traces are retained as Actions artifacts for
   14 days. Locally, open `npx playwright show-report` or `show-trace`.

This provides an ephemeral test environment for each PR without publishing it
over the production Pages site. It does not provision a second public staging
site. [GitHub Pages has one project site per repository](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages); a public staging URL
would need a separate hosting arrangement. Configure the `test` job as a required
branch-protection check in GitHub if merges must also be blocked; repository
settings are not changed by these files.

To verify another hosted candidate, set `PLAYWRIGHT_BASE_URL` to its complete
site URL (including the repository subpath) and run `npm run test:browser`.

## Page and interaction map

| Surface | Browser regression coverage |
| --- | --- |
| Sign in / create account | Both actual button clicks, exact credentials and one request, keyboard Enter, native validation, same light styling, failed login then signup retry, confirmation-email state, password-reset request and redirect |
| Onboarding | Profile creation, every step, palette/topic/pace selection, conditional daily time, saved completion, top-of-page focus on Continue/Back, accessible field help; Web App install acceptance, dismissal, unavailable-prompt guidance and optional decline |
| Navigation | All five pages through desktop navigation and the mobile menu; fixed short title with scrolling introduction |
| Living room | Composer, All kin default and explicit private draft preservation, publish, delete confirmation, hide/restore and private reply |
| Parlor | Real browser crypto, recovery setup, encrypted waiting note, forget-device lock, recovery unlock |
| Kin | Search, friend-code validation/request, incoming accept, outgoing remind/cancel, block/unblock, group create/membership/delete, ungrouped suggestion send/dismiss, introduction accept/decline |
| Gatherings | Required dates, calendar/all-day/error/cancel, solo confirmation, create/edit, RSVP/withdraw, guest note, cancel |
| Preferences | Palette persistence, rename, daily time and reload persistence, topic apply, inner-circle membership, save failure/retry, photo processing/removal, feedback, export download, deletion validation/confirmation, sign-out |
| Notifications | Opt-in subscription save, test request, server-error feedback and opt-out; device permission/push service is simulated |
| Published assets / API | Playwright HTTP checks for all live entrypoints and local assets, config, manifest/icons, service worker; real read-only Auth availability and anonymous profile access checks |

The original encryption, SQL/RLS, scheduling, and other unit/integration tests
remain as additional checks. Browser tests replace reliance on DOM-only tests
as the release gate; they do not replace the database authorization tests.

## Test boundaries

`quality-of-life.spec.js` also checks photos above 5 MB are resized with their
aspect ratio intact, Apply spans the card and changes appearance only for unsaved
choices, and all three dark palettes persist with readable text contrast.
Published-entrypoint checks include the old notice-board URL and reject links
to the removed fictional prototype.

The browser suite loads the real compiled app, real Supabase JS client, native
forms and browser crypto. `fixtures.js` intercepts the Supabase network boundary
with explicit, per-test data. Unknown API requests and browser runtime errors
fail tests. Tests never create accounts or modify data on production, even when
the frontend is loaded from the production URL. `api.spec.js` uses Playwright's
native `request` fixture for real **read-only** backend checks. Asset HTTP tests
also use `request` and are not intercepted.

These tests verify frontend/API contracts, not complete live-server mutation
behavior. Email delivery, browser/OS permission prompts, external push delivery,
PWA installation/offline updates and cross-device synchronization remain manual
release checks. Full live mutation tests require an isolated Supabase test
project and disposable users. No production credentials belong in fixtures.

For each new feature or changed interaction, update the relevant browser test
and this map in the same PR. Include success, validation/failure and resulting
UI state. Use Playwright's `request` fixture for new HTTP/API tests. Extend the
explicit fixture contract when adding endpoints; do not add an all-success
fallback. A bug fix should have a test that fails with the bug present.

## Auth regression evidence (#79)

The two `clicks submit` tests were run against the published JS bundle from
`da9353535bc13ab3e01d4d1ae99e3c1429ccf569`. Both failed waiting for the auth request:
clicking the old action-bearing submit button replaced/disabled the form before
its native submit. Both pass with the fixed bundle. This directly checks the
interaction missed by the previous synthetic-submit test.

Issues #86–#88: browser coverage checks hidden scrollbars with working keyboard scrolling and the forced-colour override. Database tests cover ungrouped introductions, shared-group priority, dismissal, consent, and existing privacy exclusions. Migration `20260924214716_hearth_ungrouped_introductions.sql` was applied to the hosted Hearth database on 24 September 2026; its filename matches hosted migration history.

On Linux hosts without Playwright’s supported browser libraries (including Nobara/Fedora), run `npm ci` and `npm run test:release:container`. This uses the official Ubuntu Playwright image matching the pinned package version, runs all four browser projects, and writes build/test artifacts as your user. Docker must be running; its first run downloads the image. No host library replacement is needed. See [Playwright’s container documentation](https://playwright.dev/docs/docker).

Calendar validation explicitly selects both dates and runs with daytime and near-midnight clocks, so a valid overnight default cannot accidentally bypass the invalid-range assertion.
