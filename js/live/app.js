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
    `<main id="main" class="auth"><a class="brand" href="./index.html">hearth</a><div class="eyebrow">A place for your people</div><h1>A little closer,<br>at your own pace.</h1><p>Real moments. Quiet conversations. A small circle that feels like home.</p><section class="panel"><div class="live-auth-tabs">${button("Sign in", "login", `aria-pressed="${mode === "login"}"`)}${button("Create account", "signup", `aria-pressed="${mode === "signup"}"`)}</div><p>${referral ? "Someone has invited you to Hearth. Create an account or sign in, then choose whether to connect." : ""}</p><h2>${mode === "signup" ? "Come as you are." : mode === "reset" ? "Find your way back." : "Welcome home."}</h2><form id="auth" class="live-form">${field("Email", '<input name="email" type="email" autocomplete="email" required maxlength="254">')}${mode === "reset" ? "" : field("Password", '<input name="password" type="password" autocomplete="' + (mode === "signup" ? "new-password" : "current-password") + '" required minlength="12" maxlength="128">')}<button class="primary">${mode === "signup" ? "Create my account" : mode === "reset" ? "Send reset link" : "Sign in"}</button></form>${emailDeliveryEnabled ? button("Forgot password?", "reset") : "<p>Email confirmation and password-reset emails are unavailable in this friends beta. Save your password and only accept friend codes from people you know.</p>"}<p class="live-muted">Friends beta · No public directory or popularity scores.</p></section><p><a href="./demo.html">Explore the fictional demo</a></p></main>`;
}
function profileView() {
  $("#app").innerHTML =
    `<main id="main" class="auth"><h1>Come as you are.</h1><section class="panel"><form id="profile" class="live-form">${field("What should we call you?", '<input name="name" required maxlength="40" autocomplete="nickname">')}<button class="primary">Settle in</button></form></section>${button("Sign out", "logout")}</main>`;
}
function recoveryView() {
  $("#app").innerHTML =
    `<main id="main" class="auth"><h1>Choose a new password.</h1><form id="password" class="panel live-form">${field("New account password", '<input name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128">')}<button class="primary">Save password</button></form><p>Your separate messaging passphrase stays the same.</p></main>`;
}
function navigationLinks() {
  return `${[
      ["pulse", "The living room"],
      ["parlor", "The parlor"],
      ["kin", "Your kin"],
      ["settings", "Your preferences"],
    ]
      .map(
        ([id, label]) =>
          `<button data-tab="${id}" class="${tab === id ? "active" : ""}" ${tab === id ? 'aria-current="page"' : ""}>${label}</button>`,
      )
      .join(
        "",
      )}<a href="./demo.html#gatherings">Gatherings · demo</a>`;
}
function render() {
  if (recovery) return recoveryView();
  if (!user) return authView();
  if (!profile) return profileView();
  $("#app").innerHTML =
    `<header class="mobile-header"><a class="brand" href="./live.html">hearth</a><button data-action="open-menu" aria-label="Open menu" aria-haspopup="dialog" aria-controls="mobile-menu" aria-expanded="false"><span class="hamburger" aria-hidden="true"><span></span><span></span><span></span></span><span>Menu</span></button></header><dialog id="mobile-menu" aria-labelledby="menu-title"><div class="menu-heading"><h2 id="menu-title">Make yourself at home.</h2>${button("Close", "close-menu", 'aria-label="Close menu" autofocus')}</div><nav class="nav" aria-label="Mobile navigation">${navigationLinks()}</nav><div class="menu-actions">${button("Refresh", "refresh")}${button("Sign out", "logout")}</div><p class="live-muted">A little space for you and your people.</p></dialog><div class="shell"><aside class="sidebar"><a class="brand" href="./live.html">hearth</a><p class="tagline">A place for your people.</p><nav class="nav" aria-label="Main navigation">${navigationLinks()}</nav><div class="sidebar-bottom"><p>Less scrolling.<br>More living.</p><strong>${esc(profile.name)}</strong></div></aside><div><div class="topbar"><span class="demo"><span class="dot"></span> Friends beta · Connected</span><div>${button("Refresh", "refresh")}${button("Sign out", "logout")}</div></div><main id="main" class="content" tabindex="-1"><header class="heading"><div><div class="eyebrow">A little closer, at your own pace</div><h1>${{ pulse: "Make yourself at home.", kin: "Your people.", parlor: "The parlor.", settings: "Your little corner." }[tab]}</h1><p>${{ pulse: "Real life, shared with the people who matter.", kin: "A small circle. A meaningful connection.", parlor: "Good conversations don’t need an audience.", settings: "Your choices. Your attention. Your space." }[tab]}</p></div></header>${invitePrompt()}${{ pulse: feed, kin: kin, parlor: parlor, settings: settings }[tab]()}</main><footer class="footer">Made for connection. Built with intention.</footer></div></div>`;
}
function feed() {
  return `<div class="narrow"><section class="welcome"><h2>A quieter kind of connected.</h2><p>No algorithm to keep up with. Just little moments from your people.</p></section><form id="status" class="panel live-form">${field("A little moment from your day", '<textarea name="content" required maxlength="1500" placeholder="Something you made, a small joy, or simply how you’re doing…"></textarea>')}<div class="live-pair">${field("Who is this for?", '<select name="audience"><option>Only me</option><option>Inner circle</option><option>All kin</option></select>')}${field("A little about", `<select name="topic">${topics.map((t) => `<option>${esc(t)}</option>`).join("")}</select>`)}</div><small>Audience access is enforced by the server. Status text is not end-to-end encrypted.</small><button class="primary">Share moment</button></form>${statuses.map((p) => `<article class="post"><div class="post-head"><strong>${esc(p.author === user.id ? profile.name : name(p.author))}</strong><span class="badge">${esc(p.audience)}</span></div><p class="live-text">${esc(p.content)}</p><div class="post-footer"><small>${esc(date(p.created_at))} · ${esc(p.topic)}</small>${p.author === user.id ? `<button data-delete="${p.id}">Delete</button>` : `<button data-chat="${p.author}">Reply privately</button>`}</div></article>`).join("")}<div class="end"><h3>${statuses.length === pageSize ? "A good place to pause." : "You’re all caught up."}</h3><p>The rest of the day is yours.</p><div class="live-actions">${button("Previous", "prev", page === 0 ? "disabled" : "")}${button("Next moments", "next", statuses.length < pageSize ? "disabled" : "")}</div></div></div>`;
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
        return `<section class="panel"><h3>${esc(name(id))}</h3><p>${c.accepted ? "Your kin" : c.recipient === user.id ? "Would like to connect" : "Waiting for them to accept"}</p><div class="live-actions">${c.accepted ? `<button data-chat="${id}">Say hello</button><button data-circle="${id}">${circle.some((x) => x.member === id) ? "Remove from" : "Add to"} inner circle</button>` : c.recipient === user.id ? `<button data-accept="${id}">Accept</button>` : ""}<button data-disconnect="${id}">${c.accepted ? "Disconnect" : "Cancel request"}</button><button data-block="${id}" class="danger">Block</button></div></section>`;
      })
      .join("") ||
    '<section class="panel"><h3>Room for familiar faces.</h3><p>Swap friend codes to start your circle.</p></section>'
  }<p>Inner circle controls who can read your inner-circle moments. Blocking stops new messages and hides shared statuses; messages already delivered remain in each person’s history.</p></div>`;
}
function unlockForm() {
  return `<section class="panel"><h2>${vault ? "Unlock your conversations." : "Make a private space."}</h2><p>${vault ? "Enter your separate messaging passphrase." : "Choose a separate messaging passphrase of at least 16 characters and save it in your password manager. It protects the backup of your message key."}</p><form id="unlock" class="live-form">${field("Messaging passphrase", `<input name="passphrase" type="password" required minlength="16" maxlength="512" autocomplete="${vault ? "current-password" : "new-password"}">`)}${vault ? "" : field("Confirm messaging passphrase", '<input name="confirm" type="password" required minlength="16" maxlength="512" autocomplete="new-password">')}<button class="primary">${vault ? "Unlock messages" : "Set up encrypted messages"}</button></form><p>We cannot recover a forgotten messaging passphrase. Account password resets do not unlock message history.</p></section>`;
}
function parlor() {
  return `<div class="narrow"><div class="notice">Messages are encrypted in your browser before sending. Your message key stays in memory while unlocked; lock messages when you leave this device.</div>${
    privateKey
      ? `${button("Lock messages", "lock")}<section class="panel">${field(
          "Conversation",
          `<select id="peer"><option value="">Choose a friend</option>${friends()
            .map(
              (id) =>
                `<option value="${id}" ${peer === id ? "selected" : ""}>${esc(name(id))}</option>`,
            )
            .join("")}</select>`,
        )}${!friends().length ? "<p>Connect with a friend in Your kin first.</p>" : ""}</section>${peer ? `<section class="panel"><div class="messages">${messages.map((m) => `<div class="bubble ${m.sender === user.id ? "mine" : ""}"><span class="live-text">${esc(m.text)}</span><small>${m.sender === user.id ? "You" : esc(name(peer))} · ${esc(date(m.created_at))}</small></div>`).join("") || "<p>A fresh conversation. Start with a hello.</p>"}</div><div class="live-actions">${button("Newer", "newer", msgPage === 0 ? "disabled" : "")}${button("Older", "older", messages.length < pageSize ? "disabled" : "")}</div><form id="message" class="live-form">${field("A little note", '<textarea name="text" required maxlength="2000" placeholder="Take your time. Say it your way."></textarea>')}<button class="primary">Send encrypted note</button></form>${button("Compare security fingerprints", "fingerprints")}</section>` : ""}`
      : unlockForm()
  }</div>`;
}
function feedbackForm() {
  return `<section class="panel feedback-panel"><h2>What would you like to do here?</h2><p>Anything you wish we could do together? Or a little thing that got in the way? A sentence is plenty.</p><form id="feedback" class="live-form">${field("Leave a little note", '<textarea name="content" required maxlength="2000" placeholder="I’d love to…" aria-describedby="feedback-privacy"></textarea>')}<small id="feedback-privacy">This goes to Hearth’s host with your account, not to your kin. It isn’t an encrypted message.</small><button class="primary">Send note</button><p id="feedback-result" role="status" tabindex="-1"></p></form></section>`;
}
function settings() {
  return `<div class="narrow">${feedbackForm()}<form id="rename" class="panel live-form"><h2>Come as you are.</h2>${field("Your name", `<input name="name" required maxlength="40" value="${esc(profile.name)}">`)}<button>Save name</button></form><section class="panel"><h2>A little peace of mind.</h2><p>There are no read receipts, analytics, ads, or popularity scores. Refresh when you choose to check in.</p><p>Messages use end-to-end encryption with a passphrase-protected key backup. This beta has not had an independent security audit and does not offer forward secrecy. The service can see who messages whom and when. Compare fingerprints with your friend using a separate trusted channel.</p><p>Statuses are stored as text with server-enforced audience permissions.</p>${button("Download my data", "export")}<p>The export includes your own statuses, feedback notes, connections, encrypted messages and encrypted key backup. Decrypted conversations are not included.</p></section><section class="panel"><h2>Delete your account</h2><p>This permanently deletes your profile, statuses, feedback notes, connections, messages and encrypted key backup. Export your data first.</p><form id="delete-account" class="live-form">${field("Type DELETE to confirm", '<input name="confirmation" required pattern="DELETE" autocomplete="off">')}<button class="danger">Permanently delete my account</button></form></section><section class="panel"><h2>Blocked accounts</h2>${blocks.map((b) => `<p class="live-code">${esc(b.target)}</p><button data-unblock="${b.target}">Unblock</button>`).join("") || "<p>No blocked accounts.</p>"}<p>After unblocking, remove any existing connection before sending a new request if you want fresh consent.</p></section><section class="panel"><h2>Help shape Hearth.</h2><p>Try creating a moment, connecting with a friend, and exchanging a note. Tell your host what feels welcoming or confusing. Gatherings and the other demo features are not live yet.</p><a href="./demo.html">Explore the fictional feature demo</a></section></div>`;
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
  statuses = check(
    await client
      .from("hearth_statuses")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1),
  );
  if (peer && !friends().includes(peer)) {
    peer = "";
    messages = [];
  }
  if (privateKey && peer) await loadMessages();
}
async function peerKey() {
  const key = check(await client.rpc("hearth_public_key", { person: peer }));
  if (!key)
    throw Error(
      "Your friend needs to set up encrypted messages in The parlor first.",
    );
  const print = await fingerprint(key),
    pinKey = `hearth-key:${user.id}:${peer}`;
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
  const key = await peerKey();
  const rows = check(
    await client
      .from("hearth_messages")
      .select("*")
      .or(
        `and(sender.eq.${user.id},recipient.eq.${peer}),and(sender.eq.${peer},recipient.eq.${user.id})`,
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(msgPage * pageSize, (msgPage + 1) * pageSize - 1),
  );
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
    if (form.id === "message") {
      if (!privateKey || !peer)
        throw Error("Unlock messages and choose a friend first.");
      const envelope = await encryptMessage(
        privateKey,
        await peerKey(),
        { id: crypto.randomUUID(), sender: user.id, recipient: peer },
        data.text.trim(),
      );
      check(await client.from("hearth_messages").insert(envelope));
      form.reset();
      msgPage = 0;
    }
    await refresh();
    render();
  });
});
document.addEventListener("change", (event) => {
  if (event.target.id === "peer") {
    peer = event.target.value;
    messages = [];
    msgPage = 0;
    run(async () => {
      try {
        if (peer) await loadMessages();
      } finally {
        render();
      }
    });
  }
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
  if (d.action === "open-menu") {
    const menu = $("#mobile-menu");
    menu.showModal();
    b.setAttribute("aria-expanded", "true");
    return;
  }
  if (d.action === "close-menu") { $("#mobile-menu").close(); return; }
  if (b.closest("dialog")) $("#mobile-menu").close();
  run(async () => {
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
      const allRows = async (table, own = false) => {
        let rows = [];
        for (let offset = 0; ; offset += 1000) {
          let q = client.from(table).select("*");
          if (own) q = q.eq("author", user.id);
          const batch = check(
            await q
              .order(
                table === "hearth_statuses" || table === "hearth_messages"
                  ? "id"
                  : "created_at",
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
        statuses: await allRows("hearth_statuses", true),
        feedback: await allRows("hearth_feedback"),
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
        '<main id="main" class="auth"><a class="brand" href="./index.html">hearth</a><h1>A little space is taking shape.</h1><p>The live friends beta is waiting for its backend connection. Accounts and shared messages are not available yet.</p><a href="./demo.html">Explore the fictional demo →</a></main>';
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
