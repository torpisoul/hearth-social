import { palettes, savedPalette, applyPalette, rememberPalette } from "./palettes.js";
import { deviceKey } from "./device-key.js";
import { icon, brand, sprig } from "./art.js";
import { prepareAvatar } from "./avatar.js";
import { createClient } from "@supabase/supabase-js";
import { inviteQrSvg } from "./invite-qr.js";
import { readInvite, inviteUrl } from "./invites.js";
import { topics } from "../hearth-store.js";
import {
  createIdentity,
  unlockIdentity,
  encryptMessage,
  decryptMessage,
  fingerprint,
} from "./crypto.js";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let colourPalette = applyPalette(savedPalette());
const inviteStorageKey = "hearth-pending-invite";
let referral = readInvite(location.href);
try {
  if (referral) sessionStorage.setItem(inviteStorageKey, referral);
  else referral = readInvite(new URL(`?ref=${sessionStorage.getItem(inviteStorageKey) || ""}`, location.href));
} catch { /* Invitations still work when browser storage is unavailable. */ }
function clearInvite() {
  referral = null;
  try { sessionStorage.removeItem(inviteStorageKey); } catch {}
  const url = new URL(location.href);
  url.searchParams.delete("ref");
  history.replaceState(null, "", url);
}
let feedFilter = "all";
let kinSearch = "";
let events = [], rsvps = [], waitingNotes = [];
let peerReady = true, waitingError = "", draftDirty = false;
let newestStatus = null, recentIncoming = [];
let preferences = {topics: [], update_mode: "manual"};
let emailDeliveryEnabled = false;
let client,
  user,
  profile,
  privateKey,
  ownPublicKey,
  vault,
  connections = [],
  profiles = [],
  statuses = [],
  circle = [],
  blocks = [],
  messages = [],
  peer = "",
  tab = "pulse",
  mode = referral ? "signup" : "login",
  busy = false,
  page = 0,
  msgPage = 0,
  recovery = false;
const pageSize = 20;
const say = (text) => {
  $("#notice").textContent = text;
};
const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};
const name = (id) => profiles.find((p) => p.id === id)?.name || "Your kin";
const friends = () =>
  connections
    .filter((c) => c.accepted)
    .map((c) => (c.requester === user.id ? c.recipient : c.requester));
const date = (v) =>
  new Date(v).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
const field = (label, input) => `<label class="field">${label}${input}</label>`;
const button = (text, action, extra = "") =>
  `<button data-action="${action}" ${extra}>${text}</button>`;
function authView() {
  $("#app").innerHTML =
    `<main id="main" class="auth"><a class="brand" href="./index.html">${brand}hearth</a><div class="eyebrow">A place for your people</div><h1>A little closer,<br>at your own pace.</h1><p>Real moments. Quiet conversations. A small circle that feels like home.</p><section class="panel"><div class="live-auth-tabs">${button("Sign in", "login", `aria-pressed="${mode === "login"}"`)}${button("Create account", "signup", `aria-pressed="${mode === "signup"}"`)}</div><p>${referral ? "Someone has invited you to Hearth. Create an account or sign in, then choose whether to connect." : ""}</p><h2>${mode === "signup" ? "Come as you are." : mode === "reset" ? "Find your way back." : "Welcome home."}</h2><form id="auth" class="live-form">${field("Email", '<input name="email" type="email" autocomplete="email" required maxlength="254">')}${mode === "reset" ? "" : field("Password", '<input name="password" type="password" autocomplete="' + (mode === "signup" ? "new-password" : "current-password") + '" required minlength="12" maxlength="128">')}<button class="primary">${mode === "signup" ? "Create my account" : mode === "reset" ? "Send reset link" : "Sign in"}</button></form>${emailDeliveryEnabled ? button("Forgot password?", "reset") : "<p>Email confirmation and password-reset emails are unavailable in this friends beta. Save your password and only accept friend codes from people you know.</p>"}<p class="live-muted">Friends beta · No public directory or popularity scores.</p></section><p><a href="./demo.html">Explore the fictional demo</a></p></main>`;
}
function profileView() {
  $("#app").innerHTML =
    `<main id="main" class="auth"><h1>Come as you are.</h1><section class="panel"><form id="profile" class="live-form">${field("What should we call you?", '<input name="name" required maxlength="40" autocomplete="nickname">')}<button class="primary">Settle in</button></form></section>${button("Sign out", "logout")}</main>`;
}
function recoveryView() {
  $("#app").innerHTML =
    `<main id="main" class="auth"><h1>Choose a new password.</h1><form id="password" class="panel live-form">${field("New account password", '<input name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128">')}<button class="primary">Save password</button></form><p>Your separate messaging passphrase stays the same.</p></main>`;
}
function lastSeen(key) { try { return localStorage.getItem(`hearth-seen:${user.id}:${key}`) || ""; } catch {return "";} }
function markSeen(key, time) { if (!time) return; try { if(time > lastSeen(key)) localStorage.setItem(`hearth-seen:${user.id}:${key}`,time); } catch {} }
function hasNew(id) {
  if(id === "all") return ["pulse","parlor","kin"].some(hasNew);
  if(id === "pulse") return newestStatus && newestStatus > lastSeen("pulse");
  if(id === "parlor") return recentIncoming.some(m=>m.created_at > lastSeen(`parlor:${m.sender}`)) || waitingNotes.some(n=>n.recipient===user.id);
  if(id === "kin") return connections.some(c=>!c.accepted && c.recipient===user.id);
  return false;
}
function navigationLinks() {
  return `${[
      ["pulse", "The living room"],
      ["parlor", "The parlor"],
      ["kin", "Your kin"],
      ["gatherings", "Gatherings"],
      ["settings", "Your preferences"],
    ]
      .map(
        ([id, label]) =>
          `<button data-tab="${id}" class="${tab === id ? "active" : ""}" ${tab === id ? 'aria-current="page"' : ""}>${icon(id)}<span>${label}</span><span class="new-indicator" data-indicator="${id}" ${hasNew(id) ? "" : "hidden"} aria-label="Something new">●</span></button>`,
      )
      .join(
        "",
      )}`;
}
function render() {
  if (recovery) return recoveryView();
  if (!user) return authView();
  if (!profile) return profileView();
  draftDirty = false;
  if(tab === "pulse" && page===0) markSeen("pulse",statuses.filter(p=>p.author!==user.id).map(p=>p.created_at).sort().at(-1));
  $("#app").innerHTML =
    `<header class="mobile-header"><a class="brand" href="./live.html">${brand}hearth</a><button data-action="open-menu" aria-label="Open menu" aria-haspopup="dialog" aria-controls="mobile-menu" aria-expanded="false"><span class="hamburger" aria-hidden="true"><span></span><span></span><span></span></span><span>Menu</span><span class="new-indicator" ${hasNew("all") ? "" : "hidden"} aria-label="Something new">●</span></button></header><dialog id="mobile-menu" aria-labelledby="menu-title"><div class="menu-heading"><h2 id="menu-title">Make yourself at home.</h2>${button("Close", "close-menu", 'aria-label="Close menu" autofocus')}</div><nav class="nav" aria-label="Mobile navigation">${navigationLinks()}</nav><div class="menu-actions">${button("Refresh", "refresh")}${button("Sign out", "logout")}</div><p class="live-muted">A little space for you and your people.</p></dialog><div class="shell"><aside class="sidebar"><a class="brand" href="./live.html">${brand}hearth</a><p class="tagline">A place for your people.</p><nav class="nav" aria-label="Main navigation">${navigationLinks()}</nav><div class="sidebar-bottom"><p>Less scrolling.<br>More living.</p><strong>${esc(profile.name)}</strong></div></aside><div><div class="topbar"><span class="demo"><span class="dot"></span> Friends beta · Connected</span><div>${button("Refresh", "refresh")}${button("Sign out", "logout")}</div></div><main id="main" class="content" tabindex="-1"><header class="heading"><div><div class="eyebrow">A little closer, at your own pace</div><h1>${{ gatherings: "Something to look forward to.", pulse: "Make yourself at home.", kin: "Your people.", parlor: "The parlor.", settings: "Your little corner." }[tab]}</h1><p>${{ gatherings: "A little plan. Good company.", pulse: "Real life, shared with the people who matter.", kin: "A small circle. A meaningful connection.", parlor: "Good conversations don’t need an audience.", settings: "Your choices. Your attention. Your space." }[tab]}</p></div></header>${invitePrompt()}${{ gatherings: gatherings, pulse: feed, kin: kin, parlor: parlor, settings: settings }[tab]()}</main><footer class="footer">Made for connection. Built with intention.</footer></div></div>`;
}
function topicChoices() {
  return `<div class="topic-pills" role="group" aria-label="Topics in your living room">${topics.map(t => `<button data-topic="${esc(t)}" aria-pressed="${(preferences.topics || []).includes(t)}">${esc(t)}</button>`).join("")}</div><p class="live-muted">Choose what comes into your living room. Everything starts switched off.</p>`;
}
function kinIdentity(id, showAvatar = true) {
 const label = id === user.id ? profile.name : name(id);
 const content = (showAvatar ? avatar(id) : "") + `<span>${esc(label)}</span>`;
 return friends().includes(id) ? `<button type="button" class="kin-identity ${showAvatar ? "" : "kin-name"}" data-chat="${id}" aria-label="Open conversation with ${esc(label)}">${content}</button>` : `<span class="kin-identity-static">${content}</span>`;
}
function companionCards() {
 return `<aside class="live-companions"><section class="panel"><div class="eyebrow">The people, not the numbers</div><h2>A few familiar faces.</h2>${friends().slice(0,3).map(id => `<div class="kin-row">${kinIdentity(id)}</div>`).join("") || '<p>A little room for your people. Invite someone you know.</p>'}<button data-tab="kin">Visit your kin</button></section><section class="panel"><div class="eyebrow">Something to look forward to</div><h2>Room at the table.</h2>${events[0] ? `<p><strong>${esc(events[0].title)}</strong><br>${esc(date(events[0].starts_at))}<br>${esc(events[0].place)}</p>` : '<p>No plans yet. A walk or a cup of tea is a good place to start.</p>'}<button data-tab="gatherings">See your gatherings</button></section><section class="panel"><div class="eyebrow">A little peace of mind</div><h2>Your attention is yours.</h2><p>No read receipts. No pressure to reply. Choose what comes into your living room and when to check in.</p><button data-tab="settings">Make this space yours</button></section></aside>`;
}
function gatherings() {
 return `<div class="narrow"><section class="panel"><h2>Fancy making a little plan?</h2><form id="event" class="live-form">${field("What shall we do?",'<input name="title" required maxlength="100" placeholder="A walk, dinner, a game…">')}${field("Where?",'<input name="place" required maxlength="200">')}${field("When?",'<input name="starts_at" type="datetime-local" required>')}${field("Anything else?",'<textarea name="details" maxlength="1500"></textarea>')}<small>Shared with all your kin. They can see the plan and who’s coming. Times are shown in each person’s local time.</small><button class="primary">Share the plan</button></form></section>${events.map(e => `<section class="panel"><h2>${esc(e.title)}</h2><p>${esc(date(e.starts_at))} · ${esc(e.place)}</p><p class="live-text">${esc(e.details)}</p><p>Hosted by ${kinIdentity(e.owner, false)}</p><p>${rsvps.filter(r=>r.event===e.id).map(r=>r.person===user.id ? 'You' : kinIdentity(r.person, false)).join(', ') || 'No replies yet. No rush.'}</p><div class="live-actions"><button data-rsvp="${e.id}">${rsvps.some(r=>r.event===e.id && r.person===user.id) ? 'I can’t make it now' : 'I’d like to come'}</button>${e.owner===user.id ? `<button data-cancel-event="${e.id}">Cancel this plan</button>` : ''}</div></section>`).join('') || '<p>A quiet calendar, for now.</p>'}<p class="live-muted">Showing the next 20 upcoming gatherings.</p></div>`;
}
function feed() {
  return `<div class="live-feed-layout"><div class="narrow">${topicChoices()}<div class="topic-pills" role="group" aria-label="People in your living room">${[["all","All chosen topics"],["circle","Inner circle"],["mine","My moments"]].map(([id,label])=>`<button data-feed-filter="${id}" aria-pressed="${feedFilter===id}">${label}</button>`).join("")}</div><section class="welcome"><div class="eyebrow">Your digital living room</div><h2>A quieter kind of connected.</h2><p>No algorithm to keep up with. Just little moments from your people.</p>${sprig}</section><form id="status" class="panel live-form">${field("A little moment from your day", '<textarea name="content" required maxlength="1500" placeholder="Something you made, a small joy, or simply how you’re doing…"></textarea>')}<div class="live-pair">${field("Who is this for?", '<select name="audience"><option>Only me</option><option>Inner circle</option><option>All kin</option></select>')}${field("A little about", `<select name="topic">${topics.map((t) => `<option>${esc(t)}</option>`).join("")}</select>`)}</div><small>Audience access is enforced by the server. Status text is not end-to-end encrypted.</small><button class="primary">Share moment</button></form>${statuses.map((p) => `<article class="post"><div class="post-head">${kinIdentity(p.author)}<span class="badge">${esc(p.audience)}</span></div><p class="live-text">${esc(p.content)}</p><div class="post-footer"><small>${esc(date(p.created_at))} · ${esc(p.topic)}</small>${p.author === user.id ? `<button data-delete="${p.id}">Delete</button>` : `<button data-chat="${p.author}">Reply privately</button>`}</div></article>`).join("")}<div class="end"><h3>${!preferences.topics.length ? "A quiet corner, for now." : statuses.length === pageSize ? "A good place to pause." : "You’re all caught up."}</h3><p>${!preferences.topics.length ? "Choose a topic above whenever you’d like to see some moments." : "The rest of the day is yours."}</p><div class="live-actions">${button("Previous", "prev", page === 0 ? "disabled" : "")}${button("Next moments", "next", statuses.length < pageSize ? "disabled" : "")}</div></div></div>${companionCards()}</div>`;
}
function invitePrompt() {
  if (!referral || referral === user.id) return "";
  const connection = connections.find(c => c.requester === referral || c.recipient === referral);
  const incoming = connection && !connection.accepted && connection.recipient === user.id;
  return `<section class="panel narrow"><h2>${connection?.accepted ? "You’re connected." : connection && !incoming ? "Your request is on its way." : "Say hello to the person who invited you."}</h2><p>${connection ? connection.accepted ? "Find your friend in Your kin." : incoming ? "They have already asked to connect. Accept to start sharing." : "They can accept your request in Your kin. You don’t need to send your code separately." : "Send them a connection request here—no need to copy your friend code back. They’ll accept before you share moments or messages."}</p><p class="live-code">${esc(referral)}</p><div class="live-actions">${!connection || incoming ? button(incoming ? "Accept connection" : "Connect with my inviter", "connect-inviter", 'class="primary"') : ""}${button(connection ? "Done" : "Not now", "dismiss-invite")}</div></section>`;
}
function kin() {
  return `<div class="narrow"><section class="panel"><h2>Invite your people.</h2><p>Send one invite link, or let a friend scan your QR code. They’ll be guided to create an account and send you a connection request.</p><div class="live-actions">${button("Copy invite link", "copy-invite", 'class="primary"')}</div><figure class="invite-code">${inviteQrSvg(inviteUrl(location.href, user.id))}<figcaption>Together in person? Scan with your phone’s camera.</figcaption></figure><label class="field">Your invite link<input id="invite-link" readonly value="${esc(inviteUrl(location.href, user.id))}"></label><details><summary>Use a friend code instead</summary><p class="live-code">${esc(user.id)}</p></details><form id="friend" class="live-form">${field("Their friend code", '<input name="person" required placeholder="Paste their friend code">')}<button class="primary">Send connection request</button></form></section>${
    connections
      .map((c) => {
        const id = c.requester === user.id ? c.recipient : c.requester;
        return `<section class="panel"><div class="kin-row">${kinIdentity(id)}</div><p>${c.accepted ? "Your kin" : c.recipient === user.id ? "Would like to connect" : "Waiting for them to accept"}</p><div class="live-actions">${c.accepted ? `<button data-chat="${id}">Say hello</button><button data-circle="${id}">${circle.some((x) => x.member === id) ? "Remove from" : "Add to"} inner circle</button>` : c.recipient === user.id ? `<button data-accept="${id}">Accept</button>` : ""}<button data-disconnect="${id}">${c.accepted ? "Disconnect" : "Cancel request"}</button><button data-block="${id}" class="danger">Block</button></div></section>`;
      })
      .join("") ||
    '<section class="panel"><h3>Room for familiar faces.</h3><p>Swap friend codes to start your circle.</p></section>'
  }<p>Inner circle controls who can read your inner-circle moments. Blocking stops new messages and hides shared statuses; messages already delivered remain in each person’s history.</p></div>`;
}
function unlockForm() {
  return `<section class="panel"><h2>${vault ? "Unlock your conversations." : "Make a private space."}</h2><p>${vault ? "Enter your separate messaging passphrase." : "Choose a separate messaging passphrase of at least 16 characters and save it in your password manager. It protects the backup of your message key."}</p><form id="unlock" class="live-form">${field("Messaging passphrase", `<input name="passphrase" type="password" placeholder="${vault ? "Your saved passphrase" : "Choose a long phrase"}" required minlength="16" maxlength="512" autocomplete="${vault ? "current-password" : "new-password"}">`)}${vault ? "" : field("Confirm messaging passphrase", '<input name="confirm" type="password" placeholder="Enter the same phrase again" required minlength="16" maxlength="512" autocomplete="new-password">')}<label class="remember-choice"><input name="remember" type="checkbox"><span>Remember messages on this personal device</span></label><small>Skip the extra unlock next time. Anyone using this browser while signed in as you could read your messages. Keep your passphrase for other devices.</small><button class="primary">${vault ? "Unlock messages" : "Set up encrypted messages"}</button></form><p>We cannot recover a forgotten messaging passphrase. Account password resets do not unlock message history.</p></section>`;
}

function parlorKinRows() {
 const ids = friends().sort((a,b)=>name(a).localeCompare(name(b),undefined,{sensitivity:"base"}) || a.localeCompare(b));
 const matches = ids.filter(id=>name(id).toLocaleLowerCase().includes(kinSearch.trim().toLocaleLowerCase()));
 return matches.map(id=>`<button type="button" class="parlor-person" data-chat="${id}" aria-pressed="${peer===id}">${avatar(id)}<span><strong>${esc(name(id))}</strong>${circle.some(c=>c.member===id) ? '<small class="circle-marker">Inner circle</small>' : ""}</span></button>`).join("") || `<p>${ids.length ? "No kin by that name. Try another name." : "Connect with a friend in Your kin to start a conversation."}</p>`;
}
function parlorKin() {
 return `<aside class="panel parlor-kin" aria-label="Choose your conversation"><h2>Your kin</h2><label class="field">Find your kin<input id="kin-search" type="search" value="${esc(kinSearch)}" placeholder="Search by name" autocomplete="off" aria-controls="parlor-kin-list"></label><div id="parlor-kin-list" class="parlor-kin-list">${parlorKinRows()}</div></aside>`;
}
function parlor() {
  return `<div class="parlor-layout">${parlorKin()}<div class="parlor-conversation" id="conversation" tabindex="-1"><h2>${peer ? "A conversation with " + esc(name(peer)) + "." : "Who shall we catch up with?"}</h2>${waitingError ? `<p class="notice">${esc(waitingError)}</p>` : ""}${waitingNotes.some(n=>n.recipient===user.id) ? `<section class="panel"><h2>A friend has reached out.</h2><p>There’s a note waiting for you. ${vault ? "Your messaging space is ready; your friend’s next unlocked check-in will bring it through." : "Set up your private space below when you’re ready. Your friend can then deliver it on their next unlocked check-in."}</p></section>` : ""}<div class="notice">Messages are encrypted in your browser before sending. Your message key is remembered only if you choose to trust this device. Lock and forget it before sharing the device.</div>${
    privateKey
      ? `${button("Lock and forget this device", "lock")}${peer ? `<section class="panel">${!peerReady ? '<p>Your friend hasn’t set up messages yet. You can leave an encrypted waiting note. It arrives after they set up and you next check in with messages unlocked.</p>' : ""}<div class="messages">${messages.map((m) => `<div class="bubble ${m.sender === user.id ? "mine" : ""}"><span class="live-text">${esc(m.text)}</span><small>${m.sender === user.id ? "You" : esc(name(peer))} · ${esc(date(m.created_at))}${m.pending ? " · Waiting to be delivered" : ""}</small></div>`).join("") || "<p>A fresh conversation. Start with a hello.</p>"}</div><div class="live-actions">${button("Newer", "newer", msgPage === 0 ? "disabled" : "")}${button("Older", "older", messages.length < pageSize ? "disabled" : "")}</div><form id="message" class="live-form">${field("A little note", '<textarea name="text" required maxlength="2000" placeholder="Take your time. Say it your way."></textarea>')}<button class="primary">Send encrypted note</button></form>${button("Compare security fingerprints", "fingerprints")}</section>` : ""}`
      : unlockForm()
  }</div></div>`;
}
function avatar(id) {
  const person = id === user.id ? profile : profiles.find(p => p.id === id);
  return person?.avatar ? `<img class="live-avatar" src="${esc(person.avatar)}" alt="${esc(person.name)}’s profile picture" width="44" height="44">` : `<span class="live-avatar initials" aria-hidden="true">${esc((person?.name || "?").slice(0,1))}</span>`;
}
function avatarForm() {
 return `<section class="panel"><h2>A familiar face</h2>${avatar(user.id)}<form id="avatar" class="live-form">${field("Your profile picture",'<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required>')}<p class="live-muted">Choose a picture up to 5 MB. We’ll crop it to a square and remove its file metadata. Your kin and people you connect with can see it.</p><button class="primary">Save picture</button></form>${profile.avatar ? button("Remove picture","remove-avatar") : ""}</section>`;
}
function feedbackForm() {
  return `<section class="panel feedback-panel"><h2>What would you like to do here?</h2><p>Anything you wish we could do together? Or a little thing that got in the way? A sentence is plenty.</p><form id="feedback" class="live-form">${field("Leave a little note", '<textarea name="content" required maxlength="2000" placeholder="I’d love to…" aria-describedby="feedback-privacy"></textarea>')}<small id="feedback-privacy">This goes to Hearth’s host with your account, not to your kin. It isn’t an encrypted message.</small><button class="primary">Send note</button><p id="feedback-result" role="status" tabindex="-1"></p></form></section>`;
}
function updateChoices() { return `<section class="panel"><h2>At your own pace</h2><form id="updates" class="live-form">${field("When should Hearth check in?",`<select name="mode"><option value="manual" ${preferences.update_mode==='manual'?'selected':''}>Only when I choose Refresh</option><option value="foreground" ${preferences.update_mode==='foreground'?'selected':''}>Quietly while I’m here</option></select>`)}<p>Quiet check-ins happen about once a minute while this tab is visible. They pause while you’re writing. A small dot marks new moments or notes; no pop-ups or sounds.</p><p class="live-muted">Closed-app background delivery isn’t enabled.</p><button>Save my pace</button></form></section>`; }
function preferenceTopics() { return `<section class="panel"><h2>What comes into your living room</h2>${topicChoices()}</section>`; }
function paletteChoices() {
  return `<section class="panel"><h2>What colours feel like home?</h2><p>A few quiet corners of the world. Pick one to try it here.</p><div class="palette-choices" role="group" aria-label="Colour palette">${palettes.map(([id,label,description,...colours])=>`<button type="button" data-palette-choice="${id}" aria-pressed="${colourPalette===id}"><span class="palette-swatches" aria-hidden="true">${colours.map(c=>`<span style="background:${c}"></span>`).join("")}</span><strong>${label}</strong><small>${description}</small></button>`).join("")}</div><p class="live-muted">Remembered in this browser. You can choose a different feeling on each device.</p></section>`;
}
function settings() {
  return `<div class="narrow">${paletteChoices()}${preferenceTopics()}${updateChoices()}${feedbackForm()}${avatarForm()}<form id="rename" class="panel live-form"><h2>Come as you are.</h2>${field("Your name", `<input name="name" required maxlength="40" value="${esc(profile.name)}">`)}<button>Save name</button></form><section class="panel"><h2>A little peace of mind.</h2><p>There are no read receipts, analytics, ads, or popularity scores. Refresh when you choose to check in.</p><p>Messages use end-to-end encryption with a passphrase-protected key backup. This beta has not had an independent security audit and does not offer forward secrecy. The service can see who messages whom and when. Compare fingerprints with your friend using a separate trusted channel.</p><p>Statuses are stored as text with server-enforced audience permissions.</p>${button("Download my data", "export")}<p>The export includes your profile, preferences, gatherings, RSVPs, statuses, feedback notes, connections, encrypted messages and encrypted key backup. Decrypted conversations are not included.</p></section><section class="panel"><h2>Delete your account</h2><p>This permanently deletes your profile, statuses, feedback notes, connections, messages and encrypted key backup. Export your data first.</p><form id="delete-account" class="live-form">${field("Type DELETE to confirm", '<input name="confirmation" required pattern="DELETE" autocomplete="off">')}<button class="danger">Permanently delete my account</button></form></section><section class="panel"><h2>Blocked accounts</h2>${blocks.map((b) => `<p class="live-code">${esc(b.target)}</p><button data-unblock="${b.target}">Unblock</button>`).join("") || "<p>No blocked accounts.</p>"}<p>After unblocking, remove any existing connection before sending a new request if you want fresh consent.</p></section><section class="panel"><h2>Help shape Hearth.</h2><p>Try creating a moment, connecting with a friend, and exchanging a note. Tell your host what feels welcoming or confusing. You can also make a plan together in Gatherings.</p><a href="./demo.html">Explore the fictional feature demo</a></section></div>`;
}
async function refresh() {
  profile = check(
    await client
      .from("hearth_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle(),
  );
  if (!profile) return;
  preferences = check(await client.from("hearth_preferences").select("*").eq("owner", user.id).maybeSingle()) || {topics: [], update_mode: "manual"};
  [profiles, connections, circle, blocks, vault, ownPublicKey] =
    await Promise.all(
      [
        client.from("hearth_profiles").select("*"),
        client.from("hearth_connections").select("*").order("created_at"),
        client.from("hearth_circle").select("*"),
        client.from("hearth_blocks").select("*"),
        client.rpc("hearth_my_vault"),
        client.rpc("hearth_public_key", { person: user.id }),
      ].map(async (p) => check(await p)),
    );
  let statusQuery = client.from("hearth_statuses").select("*");
  events = check(await client.from("hearth_events").select("*").gte("starts_at",new Date().toISOString()).order("starts_at").limit(20));
  rsvps = events.length ? check(await client.from("hearth_rsvps").select("*").in("event",events.map(e=>e.id))) : [];
  const selectedTopics = (preferences.topics || []).filter(t => topics.includes(t));
  statusQuery = selectedTopics.length ? statusQuery.in("topic", selectedTopics) : statusQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  if(feedFilter === "mine") statusQuery = statusQuery.eq("author",user.id);
  if(feedFilter === "circle") statusQuery = statusQuery.in("author",circle.length ? circle.map(c=>c.member) : ["00000000-0000-0000-0000-000000000000"]);
  recentIncoming = check(await client.from("hearth_messages").select("sender,created_at").eq("recipient",user.id).order("created_at",{ascending:false}).limit(100));
  newestStatus = selectedTopics.length ? check(await client.from("hearth_statuses").select("created_at").neq("author",user.id).in("topic",selectedTopics).order("created_at",{ascending:false}).limit(1)).at(0)?.created_at : null;
  statuses = check(
    await statusQuery
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1),
  );
  if (!privateKey && ownPublicKey) {
    try {
      const saved = await deviceKey("get",user.id);
      if (saved?.fingerprint === await fingerprint(ownPublicKey)) privateKey = saved.key;
    } catch { /* Device storage is optional; passphrase unlock remains available. */ }
  }
  if (peer && !friends().includes(peer)) {
    peer = "";
    messages = [];
  }
  waitingNotes = check(await client.from("hearth_waiting_notes").select("*").order("created_at").limit(100));
  waitingError = "";
  try { await deliverWaitingNotes(); } catch { waitingError = "Some waiting notes couldn’t be delivered yet. They’re still saved; try Refresh when you’re ready."; }
  if (privateKey && peer) await loadMessages();
}
async function peerKey(required = true, person = peer) {
  const key = check(await client.rpc("hearth_public_key", { person }));
  if (!key && !required) return null;
  if (!key)
    throw Error(
      "Your friend needs to set up encrypted messages in The parlor first.",
    );
  const print = await fingerprint(key),
    pinKey = `hearth-key:${user.id}:${person}`;
  const pinned = localStorage.getItem(pinKey);
  if (pinned && pinned !== print)
    throw Error(
      "Your friend’s security key changed. Sending is paused. Contact your host and compare fingerprints with your friend.",
    );
  localStorage.setItem(pinKey, print);
  return key;
}
async function loadMessages() {
  messages = [];
  const key = await peerKey(false);
  peerReady = Boolean(key);
  const rows = key ? check(
    await client
      .from("hearth_messages")
      .select("*")
      .or(
        `and(sender.eq.${user.id},recipient.eq.${peer}),and(sender.eq.${peer},recipient.eq.${user.id})`,
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(msgPage * pageSize, (msgPage + 1) * pageSize - 1),
  ) : [];
  messages = await Promise.all(
    rows.reverse().map(async (m) => {
      try {
        return { ...m, text: await decryptMessage(privateKey, key, m) };
      } catch {
        return {
          ...m,
          text: "This message could not be authenticated or decrypted.",
        };
      }
    }),
  );
  markSeen(`parlor:${peer}`,rows.filter(m=>m.sender===peer).map(m=>m.created_at).sort().at(-1));
  for (const note of waitingNotes.filter(n=>n.sender===user.id && n.recipient===peer)) {
    messages.push({...note,text:await decryptMessage(privateKey,ownPublicKey,note),pending:true});
  }

}
async function deliverWaitingNotes() {
  if (!privateKey) return;
  for (const note of waitingNotes.filter(n=>n.sender===user.id && friends().includes(n.recipient))) {
    const key = await peerKey(false,note.recipient);
    if (!key) continue;
    const text = await decryptMessage(privateKey,ownPublicKey,note);
    const envelope = await encryptMessage(privateKey,key,{id:note.id,sender:user.id,recipient:note.recipient},text);
    const result = await client.from("hearth_messages").insert(envelope);
    if (result.error?.code === "23505") {
      const existing = check(await client.from("hearth_messages").select("id").eq("id",note.id).eq("sender",user.id).eq("recipient",note.recipient).maybeSingle());
      if (!existing) throw result.error;
    } else check(result);
    check(await client.from("hearth_waiting_notes").delete().eq("id",note.id).eq("sender",user.id));
    waitingNotes = waitingNotes.filter(n=>n.id!==note.id);
  }
}
async function run(action) {
  if (busy) return;
  busy = true;
  say("Working…");
  const controls = [...document.querySelectorAll("button")];
  const disabled = controls.map((b) => b.disabled);
  controls.forEach((b) => (b.disabled = true));
  try {
    await action();
    say("");
  } catch (e) {
    say(e.message || "Something went wrong. Please try again.");
  } finally {
    busy = false;
    controls.forEach((b, i) => (b.disabled = disabled[i]));
  }
}
async function signOut() {
  check(await client.auth.signOut());
  privateKey = null;
  ownPublicKey = null;
  vault = null;
  user = null;
  profile = null;
  peer = "";
  messages = [];
  profiles = [];
  statuses = [];
  connections = [];
  blocks = [];
  circle = [];
  render();
}
document.addEventListener("input", event => { if(event.target.closest("form")) draftDirty = true; });
async function quietCheckIn() {
  if(!user || !profile || preferences.update_mode !== "foreground" || document.hidden || busy || draftDirty || $("#mobile-menu")?.open) return;
  busy = true;
  try { await refresh(); if (!draftDirty && !document.hidden && !$("#mobile-menu")?.open) render(); } catch { /* Keep the current page if connectivity drops. */ }
  finally { busy = false; }
}
const quietTimer = setInterval(quietCheckIn,60000);
quietTimer.unref?.();
document.addEventListener("visibilitychange", () => { if(!document.hidden) quietCheckIn(); });
document.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  run(async () => {
    if (form.id === "auth") {
      if (mode === "reset") {
        check(
          await client.auth.resetPasswordForEmail(data.email, {
            redirectTo: new URL("./live.html", location.href).href,
          }),
        );
        render();
        setTimeout(
          () =>
            say("If that account exists, check your email for a reset link."),
          0,
        );
        return;
      }
      const result = check(
        await (mode === "signup"
          ? client.auth.signUp({
              email: data.email,
              password: data.password,
              options: {
                emailRedirectTo: new URL("./live.html", location.href).href,
              },
            })
          : client.auth.signInWithPassword({
              email: data.email,
              password: data.password,
            })),
      );
      if (!result.session) {
        render();
        setTimeout(
          () => say("Check your email to confirm your account, then sign in."),
          0,
        );
        return;
      }
      user = result.user;
      await refresh();
      render();
      return;
    }
    if (form.id === "delete-account") {
      if (data.confirmation !== "DELETE")
        throw Error("Type DELETE to confirm.");
      check(await client.rpc("hearth_delete_account"));
      try { await deviceKey("delete",user.id); } catch {}
      await client.auth.signOut({ scope: "local" });
      privateKey = null;
      user = null;
      profile = null;
      render();
      return;
    }
    if (form.id === "password") {
      check(await client.auth.updateUser({ password: data.password }));
      recovery = false;
      await refresh();
      render();
      return;
    }
    if (form.id === "profile") {
      check(
        await client
          .from("hearth_profiles")
          .insert({ id: user.id, name: data.name.trim() }),
      );
    }
    if (form.id === "updates") {
      if (!["manual","foreground"].includes(data.mode)) throw Error("Choose an update pace.");
      check(await client.from("hearth_preferences").upsert({owner:user.id,topics:preferences.topics,update_mode:data.mode}));
    }
    if (form.id === "event") {
      const starts = new Date(data.starts_at);
      if (!Number.isFinite(starts.getTime()) || starts <= new Date()) throw Error("Choose a time in the future.");
      check(await client.from("hearth_events").insert({title:data.title.trim(),place:data.place.trim(),details:data.details.trim(),starts_at:starts.toISOString()}));
    }
    if (form.id === "avatar") {
      const picture = await prepareAvatar(form.elements.photo.files[0]);
      check(await client.from("hearth_profiles").update({avatar:picture}).eq("id",user.id));
    }
    if (form.id === "feedback") {
      const content = data.content.trim();
      if (!content) throw Error("Add a few words before sending your note.");
      check(await client.from("hearth_feedback").insert({ content }));
      form.reset();
      $("#feedback-result").textContent = "Thanks for sharing. Your note’s been sent.";
      $("#feedback-result").focus();
      return;
    }
    if (form.id === "rename") {
      check(
        await client
          .from("hearth_profiles")
          .update({ name: data.name.trim() })
          .eq("id", user.id),
      );
    }
    if (form.id === "friend") {
      const id = data.person.trim();
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        )
      )
        throw Error(
          "Paste the full friend code from your friend’s Your kin page.",
        );
      check(await client.rpc("hearth_request_friend", { person: id }));
    }
    if (form.id === "status") {
      check(
        await client
          .from("hearth_statuses")
          .insert({
            author: user.id,
            content: data.content.trim(),
            audience: data.audience,
            topic: data.topic,
          }),
      );
      form.reset();
      page = 0;
    }
    if (form.id === "unlock") {
      if (vault) privateKey = await unlockIdentity(vault, data.passphrase);
      else {
        if (data.passphrase !== data.confirm)
          throw Error("The messaging passphrases do not match.");
        const identity = await createIdentity(data.passphrase);
        check(
          await client
            .from("hearth_keys")
            .insert({
              owner: user.id,
              public_key: identity.public_key,
              vault: identity.vault,
            }),
        );
        privateKey = identity.privateKey;
      }
    }
    if (form.id === "unlock" && data.remember) {
      const key = check(await client.rpc("hearth_public_key", {person:user.id}));
      try { await deviceKey("put",user.id,{key:privateKey,fingerprint:await fingerprint(key)}); }
      catch { throw Error("Messages unlocked, but this browser could not remember them. You can still use messages after refreshing."); }
    }
    if (form.id === "message") {
      if (!privateKey || !peer)
        throw Error("Unlock messages and choose a friend first.");
      const recipientKey = await peerKey(false);
      const envelope = await encryptMessage(
        privateKey,
        recipientKey || ownPublicKey,
        { id: crypto.randomUUID(), sender: user.id, recipient: peer },
        data.text.trim(),
      );
      check(await client.from(recipientKey ? "hearth_messages" : "hearth_waiting_notes").insert(envelope));
      form.reset();
      msgPage = 0;
    }
    await refresh();
    render();
  });
});
document.addEventListener("input", event => {
 if (event.target.id !== "kin-search") return;
 kinSearch = event.target.value;
 $("#parlor-kin-list").innerHTML = parlorKinRows();
});
document.addEventListener("close", (event) => {
  if (event.target.id === "mobile-menu") {
    $('[data-action="open-menu"]')?.setAttribute("aria-expanded", "false");
  }
}, true);
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b || b.disabled) return;
  const d = b.dataset;
  // Submit buttons belong to the form handler. Do not disable them before
  // the browser dispatches its default submit action.
  if (!Object.keys(d).length) return;
  if (d.paletteChoice && palettes.some(p => p[0] === d.paletteChoice)) {
    colourPalette = d.paletteChoice;
    const saved = rememberPalette(colourPalette);
    document.querySelectorAll("[data-palette-choice]").forEach(control => control.setAttribute("aria-pressed", String(control.dataset.paletteChoice === colourPalette)));
    if (!saved) say("These colours are yours for now. This browser couldn’t save them for next time.");
    return;
  }
  if (d.action === "open-menu") {
    const menu = $("#mobile-menu");
    menu.showModal();
    b.setAttribute("aria-expanded", "true");
    return;
  }
  if (d.action === "close-menu") { $("#mobile-menu").close(); return; }
  if (b.closest("dialog")) $("#mobile-menu").close();
  run(async () => {
    if (d.feedFilter && ["all","circle","mine"].includes(d.feedFilter)) {
      feedFilter = d.feedFilter; page = 0; await refresh(); render(); return;
    }
    if (d.rsvp) {
      const going = rsvps.some(r=>r.event===d.rsvp && r.person===user.id);
      check(await (going ? client.from("hearth_rsvps").delete().eq("event",d.rsvp).eq("person",user.id) : client.from("hearth_rsvps").insert({event:d.rsvp})));
      await refresh(); render(); return;
    }
    if (d.cancelEvent) {
      if (!confirm("Cancel this gathering and remove its replies?")) return;
      check(await client.from("hearth_events").delete().eq("id",d.cancelEvent).eq("owner",user.id));
      await refresh(); render(); return;
    }
    if (d.action === "remove-avatar") {
      check(await client.from("hearth_profiles").update({avatar:null}).eq("id",user.id));
      await refresh(); render(); return;
    }
    if (d.topic && topics.includes(d.topic)) {
      const chosen = preferences.topics || [];
      const next = chosen.includes(d.topic) ? chosen.filter(t => t !== d.topic) : [...chosen, d.topic];
      check(await client.from("hearth_preferences").upsert({owner:user.id, topics:next, update_mode:preferences.update_mode}));
      page = 0; await refresh(); render(); return;
    }
    if (d.tab) {
      tab = d.tab;
      render();
      $("#main").focus();
      return;
    }
    if (["login", "signup", "reset"].includes(d.action)) {
      mode = d.action;
      render();
      return;
    }
    if (d.action === "copy-invite") {
      try {
        await navigator.clipboard.writeText(inviteUrl(location.href, user.id));
        setTimeout(() => say("Invite link copied. Send it to your friend."), 0);
      } catch {
        $("#invite-link").focus();
        $("#invite-link").select();
        setTimeout(() => say("Select and copy the invite link above."), 0);
      }
      return;
    }
    if (d.action === "dismiss-invite") { clearInvite(); render(); return; }
    if (d.action === "connect-inviter" && referral) {
      const incoming = connections.some(c => c.requester === referral && c.recipient === user.id && !c.accepted);
      check(await client.rpc(incoming ? "hearth_accept_friend" : "hearth_request_friend", { person: referral }));
      tab = "kin";
      await refresh(); render(); return;
    }
    if (d.action === "logout") {
      await signOut();
      return;
    }
    if (d.action === "lock") {
      try { await deviceKey("delete",user.id); } catch { throw Error("Could not forget this device. Clear this site’s browser storage before sharing the device."); }
      privateKey = null;
      messages = [];
      peer = "";
      render();
      return;
    }
    if (d.action === "next") page++;
    if (d.action === "prev") page = Math.max(0, page - 1);
    if (d.action === "older") msgPage++;
    if (d.action === "newer") msgPage = Math.max(0, msgPage - 1);
    if (d.action === "fingerprints") {
      const prints = `Your fingerprint:\n${await fingerprint(ownPublicKey)}\n\n${name(peer)}’s fingerprint:\n${await fingerprint(await peerKey())}`;
      setTimeout(() => say(prints), 0);
      return;
    }
    if (d.action === "export") {
      const allRows = async (table, ownerColumn = null, orderColumn = "id") => {
        let rows = [];
        for (let offset = 0; ; offset += 1000) {
          let q = client.from(table).select("*");
          if (ownerColumn) q = q.eq(ownerColumn, user.id);
          const batch = check(
            await q
              .order(
                orderColumn,
              )
              .range(offset, offset + 999),
          );
          rows.push(...batch);
          if (batch.length < 1000) return rows;
        }
      };
      const payload = {
        profile,
        connections,
        circle,
        blocks,
        vault,
        public_key: ownPublicKey,
        preferences,
        gatherings: await allRows("hearth_events", "owner"),
        rsvps: await allRows("hearth_rsvps", "person", "event"),
        statuses: await allRows("hearth_statuses", "author"),
        feedback: await allRows("hearth_feedback"),
        waiting_notes: await allRows("hearth_waiting_notes"),
        messages: await allRows("hearth_messages"),
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "hearth-data.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (d.chat) {
      if (!friends().includes(d.chat)) throw Error("Connect with this person in Your kin first.");
      if (peer !== d.chat && $("#message textarea")?.value.trim() && !confirm("Leave this unsent note and open another conversation?")) return;
      messages = [];
      peer = d.chat;
      tab = "parlor";
      msgPage = 0;
      if (privateKey) {
        try {
          await loadMessages();
        } finally {
          render();
        }
      } else render();
      $("#conversation")?.focus();
      return;
    }
    if (d.accept)
      check(await client.rpc("hearth_accept_friend", { person: d.accept }));
    if (d.disconnect)
      check(await client.rpc("hearth_remove_friend", { person: d.disconnect }));
    if (d.block) {
      check(
        await client
          .from("hearth_blocks")
          .insert({ owner: user.id, target: d.block }),
      );
      check(await client.rpc("hearth_remove_friend", { person: d.block }));
    }
    if (d.unblock)
      check(
        await client
          .from("hearth_blocks")
          .delete()
          .eq("owner", user.id)
          .eq("target", d.unblock),
      );
    if (d.circle) {
      check(
        await (circle.some((x) => x.member === d.circle)
          ? client
              .from("hearth_circle")
              .delete()
              .eq("owner", user.id)
              .eq("member", d.circle)
          : client
              .from("hearth_circle")
              .insert({ owner: user.id, member: d.circle })),
      );
    }
    if (d.delete) {
      if (!confirm("Delete this moment permanently?")) return;
      check(
        await client
          .from("hearth_statuses")
          .delete()
          .eq("id", d.delete)
          .eq("author", user.id),
      );
    }
    await refresh();
    render();
  });
});
async function start() {
  try {
    const response = await fetch("./public-config.json", { cache: "no-store" });
    if (!response.ok) throw Error("Could not load site configuration.");
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      $("#app").innerHTML =
        '<main id="main" class="auth"><a class="brand" href="./index.html">${brand}hearth</a><h1>A little space is taking shape.</h1><p>The live friends beta is waiting for its backend connection. Accounts and shared messages are not available yet.</p><a href="./demo.html">Explore the fictional demo →</a></main>';
      return;
    }
    emailDeliveryEnabled = config.emailDeliveryEnabled === true;
    client = createClient(config.supabaseUrl, config.supabasePublishableKey);
    client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        recovery = true;
        user = session?.user;
        render();
      }
      if (event === "SIGNED_OUT") {
        privateKey = null;
        ownPublicKey = null;
        vault = null;
        user = null;
        profile = null;
        messages = [];
        profiles = [];
        statuses = [];
        connections = [];
        blocks = [];
        circle = [];
        peer = "";
        render();
      }
      if (event === "SIGNED_IN" && user && session?.user?.id !== user.id) {
        privateKey = null;
        messages = [];
        location.reload();
      }
    });
    const session = check(await client.auth.getSession());
    user = session.session?.user;
    if (user) await refresh();
    render();
  } catch (e) {
    $("#app").innerHTML =
      '<main class="auth"><h1>We couldn’t open Hearth.</h1><p>Check your connection and try reloading.</p></main>';
    say(e.message);
  }
}
start();
