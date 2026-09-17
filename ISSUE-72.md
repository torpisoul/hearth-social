# Kin groups and introductions — issue 72

## What changed

Your kin now includes searchable **Your groups** and **Pending connections** panels.
All three people widgets share the kin sidebar. The selected group appears below
the invite card and above individual kin cards; its member editor opens on demand.
Group names and membership are private to their owner. Groups never change sharing
permissions or the existing Inner circle. Create a group, select it, and press
people to add or remove them. The Groups button on each kin or pending card opens
the assignment controls. Removing a group requires confirmation and preserves kin.

A few familiar faces offers pairs of accepted kin in the same private group who
have no existing connection or request. “Another pair” rotates through least
recently shown candidates. Quiet refreshes keep the current pair still. “No”
dismisses that pair for the organiser. “Yes” creates one introduction for both
participants, without exposing the organiser’s group name.

Introductions appear as **connection cards in the parlor**, available even when
encrypted chat is locked. These are server-stored relationship metadata, not
encrypted messages. They disclose only the names needed for the introduction.
The organiser does not receive participants’ answers. Each participant can agree
or decline; one yes creates an ordinary pending connection, and both yes replies
accept it. Existing Accept, Cancel request and Block controls still work. Cancelling
or blocking closes stale introductions. Declined/cancelled pairs are not suggested
again automatically; direct friend-code requests remain available.

Sent introductions remain visible to their author in the parlor overview and in
both recipient conversations, including introductions created before this update.
These show only the original introduction, with no read receipts or reply status.
The familiar-faces widget now shows suggestions only, without a duplicate kin list.

Outgoing pending cards offer a fixed-text reminder in the recipient’s parlor,
at most once a week after the original request. Reminders do not send free text
or request notification permission. Introductions/reminders use in-app indicators;
this change adds no new system-push categories.

Clear labels carry the meaning; seedling imagery is decorative. There is no tree
diagram, growth score, automatic animation, or group merge operation.

## Deployment

Run from the repository, before publishing the rebuilt `docs/` frontend:

```sh
npx supabase db push --dry-run
npx supabase db push
```

The initial migration is `20260916231551_hearth_kin_groups_introductions.sql`.
The follow-up `20260916235008_hearth_sent_introductions.sql` adds the private sent
history lookup. Apply it even if the initial groups migration is already deployed.
It adds tables/functions and one nullable reminder timestamp; no existing account,
message, key backup or production row is removed by the migration. Normal later
disconnect/block actions clean up private group membership and close introductions.
No Edge Function redeployment or new secrets are required. The frontend tolerates
the groups table being absent until migration deployment.

## Acceptance checks

1. With three consenting testers A, B and C, connect A to B and C. Put B and C in
   A’s group. Confirm B/C cannot see A’s group or each other’s profiles yet.
2. In A’s living room, introduce B and C. Each sees a card in the parlor even with
   chat locked. B says yes: C appears pending. C says yes: each appears as kin.
3. Use another pair to test decline, cancel and block; stale cards must not restore
   cancelled connections. Confirm ordinary friend-code requests still work.
4. Search groups/people, toggle membership, delete a group, and use a keyboard at
   narrow phone and desktop sizes. Focus should remain visible and controls usable.
5. Verify manual notification mode remains quiet. Existing encrypted chat and
   legacy passphrases should behave as before.

Automated tests cover RLS, ownership forgery, candidate rotation, mutual consent,
duplicate answers, decline/cancel/block handling, reminder limits, DOM escaping,
search focus and member selection. Real-device multi-account acceptance remains
a deployment check; local tests do not substitute for that.
