import { KEY, topics, load, seed, visiblePosts } from "./hearth-store.js";
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem() {
      throw Error("Storage unavailable");
    },
    setItem() {
      throw Error("Storage unavailable");
    },
  };
}
const loaded = load(storage);
let state = loaded.state,
  filter = "all",
  person = "ella",
  page = 0,
  lastFocus;
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
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
const icons = {
  pulse: '<path d="M3 11 12 3l9 8v10h-6v-7H9v7H3z"/>',
  parlor: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z"/>',
  kin: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m1-17a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 6"/>',
  gatherings:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
};
const icon = (k) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${icons[k] || icons.pulse}</svg>`;
const brand = `<svg viewBox="0 0 34 40" fill="none" aria-hidden="true"><path d="M4 36V17L17 5l13 12v19H4Z" stroke="currentColor" stroke-width="1.6"/><path d="M13 31c-6-5 5-8 3-15 10 9 8 15 2 17-3 1-6-1-5-2Z" fill="#a77350"/></svg>`;
const sprig = `<svg class="sprig" viewBox="0 0 100 140" fill="none" aria-hidden="true"><path d="M48 142Q30 80 65 15" stroke="#748162" stroke-width="2"/><path d="M43 113Q-3 101 13 74q31 0 30 39M44 86Q73 95 87 61 52 59 44 86M49 62Q17 49 31 27q28 7 18 35M57 42Q87 38 84 8 57 14 57 42" fill="#a6b38c"/></svg>`;
const garden = `<div class="art" role="img" aria-label="An illustration of homegrown tomatoes and a sunny garden"><svg viewBox="0 0 600 180" preserveAspectRatio="xMidYMid slice"><rect width="600" height="180" fill="#e4e7d5"/><circle cx="501" cy="42" r="25" fill="#f8e9b5"/><path d="M0 140Q140 85 300 140T600 132V180H0" fill="#b7c19b"/><path d="M0 165Q190 120 390 168T600 140V180H0" fill="#929f76"/><ellipse cx="296" cy="159" rx="113" ry="12" fill="#71825e" opacity=".3"/><path d="m213 117 20 44h120l19-44" fill="#bb936e"/><path d="M220 132h144m-137 14h131m-117-27 8 40m25-40 3 40m24-40-1 40m27-40-8 40" stroke="#937651" stroke-width="2"/><g fill="#bd6b49"><circle cx="251" cy="104" r="27"/><circle cx="299" cy="110" r="30"/><circle cx="337" cy="99" r="25"/></g><g fill="#637653"><path d="m251 85-16-8 10 13-15 4 20 2 13-9-10 1 4-14ZM299 90l-15-9 7 13-11 2 19 3 15-12-14 4 3-15ZM337 79l-14-8 9 13-12 3 17 2 14-9-11 2 3-13Z"/></g><path d="M85 154Q68 74 99 36m-17 79q-39-5-33-33 34 2 33 33m1-29q32 0 37-29-33-3-37 29" fill="#7e936b" stroke="#7e936b" stroke-width="3"/></svg></div>`;
function save() {
  try {
    storage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    toast(
      "Storage is unavailable or full. This change will last only until you reload.",
    );
    return false;
  }
}
let toastTimer;
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function route() {
  const r = location.hash.slice(1);
  return [
    "pulse",
    "parlor",
    "kin",
    "gatherings",
    "settings",
    "notifications",
  ].includes(r)
    ? r
    : "pulse";
}
function initials(n) {
  return n
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
}
function avatar(k) {
  return `<span class="avatar ${k?.color || ""}">${esc(k?.initials || initials(state.name))}</span>`;
}
function time(t) {
  const h = Math.max(0, Math.floor((Date.now() - t) / 3600000));
  return h < 1
    ? "Just now"
    : h < 24
      ? `${h}h ago`
      : new Date(t).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
}
function heading(title, sub, action = "") {
  return `<header class="heading"><div><div class="eyebrow">A little closer, at your own pace</div><h1>${title}</h1><p>${sub}</p></div>${action}</header>`;
}
function render() {
  document.body.classList.toggle("dark", state.settings.dark);
  const r = route();
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><a class="brand" href="#pulse">${brand}hearth</a><p class="tagline">A place for your people.</p><nav class="nav" aria-label="Main navigation">${[
      ["pulse", "The living room"],
      ["parlor", "The parlor"],
      ["kin", "Your kin"],
      ["gatherings", "Gatherings"],
      ["settings", "Your preferences"],
    ]
      .map(
        ([k, n]) =>
          `<a href="#${k}" class="${r === k ? "active" : ""}" ${r === k ? 'aria-current="page"' : ""}>${icon(k)}${n}</a>`,
      )
      .join(
        "",
      )}</nav><div class="sidebar-bottom"><p>Less scrolling.<br>More living.</p><div class="user">${avatar()}<div><strong>${esc(state.name)}</strong><br><small>Your little corner</small></div></div></div></aside><div><div class="topbar"><span class="demo"><span class="dot"></span> A local demo · fictional kin · saved on this device</span><a href="#notifications">Notification inbox</a><button class="quiet" data-action="about">About this space ↗</button></div><main id="main" class="content" tabindex="-1">${{ pulse: feed, parlor: parlor, kin: kin, gatherings: gatherings, settings: settings, notifications: notifications }[r]()}</main><footer class="footer">Made for connection. Built with intention.<span>✳</span>Stay a little. Then go live a little.</footer></div></div>`;
}
function feed() {
  const all = visiblePosts(state, filter),
    pages = Math.max(1, Math.ceil(all.length / 5));
  page = Math.min(page, pages - 1);
  return (
    heading(
      `Make yourself at home.`,
      `The little things, from the people who matter.`,
      `<button class="primary" data-action="compose">＋ Share a moment</button>`,
    ) +
    `<div class="layout"><section aria-label="Updates"><div class="welcome"><div class="eyebrow">Your digital living room</div><h2>A quieter kind of connected.</h2><p>No rush to catch up. No algorithm to keep up with.<br>Just real life, shared with your people.</p>${sprig}</div>${!state.started ? `<div class="notice">Welcome in. Choose the name and topics you’d like to try. <button class="text-button" data-action="welcome">Make this space yours →</button></div>` : ""}<button class="composer" data-action="compose">${avatar()}<span>What’s a little moment from your day?</span><span>＋</span></button><div class="feed-tools"><div class="tabs" aria-label="Filter updates">${[
      ["all", "All kin"],
      ["circle", "Inner circle"],
      ["mine", "My moments"],
    ]
      .map(
        ([v, n]) =>
          `<button data-filter="${v}" aria-pressed="${filter === v}">${n}</button>`,
      )
      .join("")}</div><small>Newest first · always</small></div>${
      state.paused
        ? `<div class="panel paused"><h2>A little room to breathe.</h2><p>Your feed is paused. Come back whenever it feels right.</p><button data-action="resume">Welcome updates again</button></div>`
        : all
            .slice(page * 5, page * 5 + 5)
            .map(post)
            .join("") +
          (!all.length
            ? `<div class="panel empty"><h3>A quiet corner, for now.</h3><p>No moments match your choices. You can adjust topics or share something of your own.</p><a href="#settings">Choose what you see</a></div>`
            : "") +
          `<div class="end"><div class="end-icon">${page === pages - 1 ? "✳" : "· · ·"}</div><h3>${page === pages - 1 ? "You’re all caught up." : "A good place to take a breath."}</h3><p>${page === pages - 1 ? "That’s everything in your chosen feed. The rest of the day is yours." : `Page ${page + 1} of ${pages}. More moments are here when you choose.`}</p>${pages > 1 ? `<div class="actions"><button data-action="prev" ${page === 0 ? "disabled" : ""}>Previous</button><button data-action="next" ${page === pages - 1 ? "disabled" : ""}>Next 5 moments</button></div>` : ""}<button class="text-button" data-action="pause">Take a little break →</button></div>`
    }</section><aside class="aside"><div class="panel"><div class="eyebrow">The people, not the numbers</div><h3>A few familiar faces.</h3>${state.kin.map((k) => `<div class="kin-row">${avatar(k)}<div><strong>${esc(k.name)}</strong><small>${k.circle ? "Inner circle" : "Your kin"}</small></div></div>`).join("")}<a class="text-button" href="#kin">Spend a moment with your kin →</a></div><div class="panel"><div class="eyebrow">Something to look forward to</div><h3>Room at the table.</h3>${state.events
      .slice(0, 1)
      .map(
        (e) =>
          `<div class="gathering"><div class="date">${new Date(e.date + "T12:00:00").toLocaleDateString(undefined, { month: "short" })}<b>${new Date(e.date + "T12:00:00").getDate()}</b></div><div><strong>${esc(e.title)}</strong><br><small>${esc(e.place)}</small></div></div>`,
      )
      .join(
        "",
      )}<a class="text-button" href="#gatherings">See your gatherings →</a></div><div class="panel"><div class="eyebrow">A little peace of mind</div><h3>Your attention is yours.</h3><p>Quiet mode is ${state.settings.quiet ? "on" : "off"}. No urgency, no streaks, no public scores. You choose when to check in.</p>${
      !state.settings.quiet
        ? state.notifications
            .filter((n) => !state.read.includes(n.id))
            .map((n) => `<p>${esc(n.text)}</p>`)
            .join("")
        : ""
    }<a class="text-button" href="#notifications">Open your notification inbox →</a></div></aside></div>`
  );
}
function post(p) {
  const k = state.kin.find((k) => k.id === p.person);
  return `<article class="post"><div class="post-head">${avatar(k)}<div><strong>${esc(p.person === "me" ? state.name : p.name)}</strong><small>${time(p.time)} · ${p.person === "me" ? "Your moment" : "Demo moment"}</small></div><span class="badge">${esc(p.audience)}</span></div><p>${esc(p.content)}</p>${p.art ? garden : ""}<div class="post-footer"><button data-heart="${p.id}" aria-pressed="${state.hearts.includes(p.id)}">${state.hearts.includes(p.id) ? "♥ A little love sent" : "♡ Send a little love"}</button>${p.person !== "me" ? `<button data-reply="${p.person}">↗ Reply privately</button>` : ""}<button data-remove="${p.id}" aria-label="${p.person === "me" ? "Delete" : "Hide"} this moment">${p.person === "me" ? "Delete" : "Hide"}</button><span class="category">${esc(p.topic)}</span></div></article>`;
}
function parlor() {
  const k = state.kin.find((k) => k.id === person) || state.kin[0];
  person = k.id;
  return (
    heading("The parlor.", "Good conversations don’t need an audience.") +
    `<div class="notice">Demo conversations stay on this device. Messages are not delivered to another person.</div><div class="chat-layout"><nav aria-label="Conversations">${state.kin.map((k) => `<button class="conversation ${person === k.id ? "active" : ""}" data-person="${k.id}">${esc(k.name)}<br><small>A private conversation</small></button>`).join("")}</nav><section class="panel"><div class="post-head">${avatar(k)}<div><strong>${esc(k.name)}</strong><small>No read receipts. No pressure to reply.</small></div></div><div class="messages">${(state.messages[person] || []).map((m) => `<div class="bubble ${m.mine ? "mine" : ""}">${esc(m.text)}<small>${m.mine ? "You · saved locally" : "Fictional conversation"} · ${time(m.time)}</small></div>`).join("") || '<p class="empty muted">A fresh conversation. Start with a hello.</p>'}<p class="empty muted">You’ve reached the end of this conversation.</p></div><form id="message-form"><label class="field">A little note<textarea name="message" required maxlength="2000" placeholder="Take your time. Say it your way."></textarea></label><div class="actions"><button class="primary">Save demo message ↗</button></div></form></section></div>`
  );
}
function kin() {
  return (
    heading("Your people.", "A small circle. A meaningful connection.") +
    `<div class="narrow"><div class="notice">These are fictional people to explore the concept with. Real invitations and mutual connections will need a connected service.</div>${state.kin.map((k) => `<section class="panel"><div class="post-head">${avatar(k)}<div><strong>${esc(k.name)}</strong><small>${esc(k.note)}</small></div></div><div class="setting"><div>Include in your inner circle<p>A personal feed filter in this demo.</p></div><input type="checkbox" data-circle="${k.id}" aria-label="Include ${esc(k.name)} in inner circle" ${k.circle ? "checked" : ""}></div><div class="setting"><div>See their moments<p>You can take a break from someone’s updates.</p></div><input type="checkbox" data-unmute="${k.id}" aria-label="See ${esc(k.name)}’s moments" ${!state.muted.includes(k.id) ? "checked" : ""}></div><button data-reply="${k.id}">Visit the parlor →</button></section>`).join("")}</div>`
  );
}
function gatherings() {
  return (
    heading(
      "Good things, together.",
      "A reason to put the phone down and pull up a chair.",
      '<button class="primary" data-action="event">＋ Plan a gathering</button>',
    ) +
    `<div class="narrow"><div class="notice">Plans and RSVPs are saved locally in this demo. No invitations are sent.</div>${state.events.map((e) => `<section class="panel"><div class="eyebrow">${esc(new Date(e.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }))} · ${esc(e.time)}</div><h2>${esc(e.title)}</h2><p>${esc(e.note)}</p><p>⌂ ${esc(e.place)}</p><button data-rsvp="${e.id}" aria-pressed="${e.going}" class="${e.going ? "primary" : ""}">${e.going ? "✓ You’re going · change RSVP" : "I’d love to come"}</button>${e.mine ? ` <button data-delete-event="${e.id}">Delete gathering</button>` : ""}</section>`).join("") || "<p>No plans for now. A little spontaneity is welcome, too.</p>"}<div class="end"><h3>That’s everything in the diary.</h3><p>Something to look forward to, without filling every moment.</p></div></div>`
  );
}
function toggle(key, title, desc) {
  return `<label class="setting"><div>${title}<p>${desc}</p></div><input type="checkbox" data-setting="${key}" ${state.settings[key] ? "checked" : ""}></label>`;
}
function topicChoices() {
  return topics
    .map(
      (t) =>
        `<label class="setting"><span>${t}</span><input type="checkbox" data-topic="${t}" ${state.settings.topics.includes(t) ? "checked" : ""}></label>`,
    )
    .join("");
}
function settings() {
  return (
    heading(
      "Make room for what matters.",
      "Your space. Your pace. Your choices.",
    ) +
    `<div class="narrow"><section class="panel"><h3>A little about you</h3><form id="name-form"><label class="field">Display name<input name="name" maxlength="40" required value="${esc(state.name)}"></label><button>Save name</button></form></section><section class="panel"><h3>What comes into your living room</h3><p>Only chosen topics appear. Your own moments remain visible to you. Turning everything off is a perfectly good choice.</p>${topicChoices()}</section><section class="panel"><h3>At your own pace</h3>${toggle("quiet", "Quiet mode", "Keep notification previews out of your feed. The inbox is always there when you open it.")}${toggle("dark", "Evening palette", "A softer, darker space whenever you want it.")}</section><section class="panel"><h3>A fairer way to keep the lights on</h3><p>Hearth’s intention is no sale of personal data and no behavioural targeting. Optional advertising with a shared benefit is an idea being explored.</p>${toggle("ads", "I’d consider optional advertising", "Research preference only. No ads, tracking, payments, or profit sharing are active in this demo. You can withdraw this preference anytime.")}</section><section class="panel"><h3>Your demo data belongs to you</h3><p>Saved in this browser, without an account. Audience labels preview the concept; this demo does not provide secure private storage. Use fictional details for testing.</p><button data-action="export">Download my demo data</button> <button class="danger" data-action="reset">Reset this demo</button></section><section class="panel"><h3>Help shape Hearth</h3><p>What felt peaceful? What felt confusing? What would make this useful with your people?</p><button data-action="feedback">Write feedback</button><p>Download your note to share with the person who sent you Hearth.</p></section></div>`
  );
}
function notifications() {
  return (
    heading(
      "Whenever you’re ready.",
      "An inbox with an ending. Nothing needs an immediate reply.",
    ) +
    `<div class="narrow"><div class="notice">Quiet mode is ${state.settings.quiet ? "on" : "off"}. These are fictional demo notifications.</div>${state.notifications
      .filter((n) => !state.read.includes(n.id))
      .map(
        (n) =>
          `<div class="panel"><p>${esc(n.text)}</p><a href="#${n.route}">Take a look →</a> <button data-read="${n.id}">Mark as read</button></div>`,
      )
      .join(
        "",
      )}<div class="end"><h3>${state.read.length >= state.notifications.length ? "All clear." : "That’s all for now."}</h3><p>Your time is yours again.</p></div></div>`
  );
}
function modal(title, body) {
  lastFocus = document.activeElement;
  $("#dialog").innerHTML =
    `<div class="dialog-top"><h2>${title}</h2><button data-action="close" aria-label="Close dialog">×</button></div>${body}`;
  $("#dialog").showModal();
}
function close() {
  $("#dialog").close();
  lastFocus?.focus();
}
function download(name, value, type = "application/json") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function compose() {
  modal(
    "A little moment from your day.",
    `<p>It doesn’t have to be remarkable. It just has to be yours.</p><form id="post-form"><label class="field">Your moment<textarea name="content" maxlength="1500" required placeholder="Something you made, a small joy, or simply how you’re doing…"></textarea></label><div class="two"><label class="field">Who is this for?<select name="audience"><option>Only me</option><option>Inner circle</option><option>All kin</option></select></label><label class="field">A little about<select name="topic">${topics.map((t) => `<option>${t}</option>`).join("")}</select></label></div><p>This is a local preview. Nothing is published or sent to anyone.</p><div class="actions"><button type="button" data-action="close">Keep it for another time</button><button class="primary">Save moment</button></div></form>`,
  );
}
const actions = {
  compose,
  close,
  about: () =>
    modal(
      "A place for your people.",
      `<p>Hearth is a social space built around mutual connections, intentional sharing, and knowing when you’re caught up.</p><p>This proof of concept runs entirely in your browser. The kin, messages, and gatherings are fictional. Your changes stay on this device; they are not shared between visitors.</p><p>No analytics, external fonts, advertising requests, or engagement ranking are used by this demo. The hosting provider may keep standard access logs.</p><p>The intended community welcomes honest life, including difficult days. Harassment, hate, and extremist recruitment have no place here. A live service will need reporting, moderation, and properly enforced privacy before launch.</p><button class="primary" data-action="close">Make yourself at home</button>`,
    ),
  welcome: () =>
    modal(
      "Come as you are.",
      `<p>Try Hearth with a first name or a nickname. No email or password needed.</p><form id="welcome-form"><label class="field">What should we call you?<input name="name" maxlength="40" required value="${esc(state.name)}"></label><p>Choose what you’d like to see. You can change your mind anytime.</p>${topicChoices()}<div class="actions"><button class="primary">Settle in</button></div></form>`,
    ),
  pause: () => {
    state.paused = true;
    save();
    render();
  },
  resume: () => {
    state.paused = false;
    save();
    render();
  },
  next: () => {
    page++;
    render();
    $("#main").focus();
    window.scrollTo(0, 0);
  },
  prev: () => {
    page--;
    render();
    $("#main").focus();
    window.scrollTo(0, 0);
  },
  export: () =>
    download("hearth-demo-data.json", JSON.stringify(state, null, 2)),
  reset: () =>
    modal(
      "Start fresh?",
      `<p>This removes all your demo moments, messages, preferences, and RSVPs from this browser, then restores the fictional examples. Download your data first if you want to keep it.</p><div class="actions"><button data-action="close">Keep my space</button><button class="danger" data-action="confirm-reset">Reset demo</button></div>`,
    ),
  "confirm-reset": () => {
    state = seed();
    save();
    filter = "all";
    page = 0;
    close();
    render();
    toast("A fresh start. The sample moments are back.");
  },
  event: () =>
    modal(
      "Make a little time together.",
      `<form id="event-form"><label class="field">Gathering name<input name="title" required maxlength="80" placeholder="Tea in the garden"></label><div class="two"><label class="field">Date<input type="date" name="date" min="${new Date().toLocaleDateString("en-CA")}" required></label><label class="field">Time<input type="time" name="time" required value="11:00"></label></div><label class="field">Place<input name="place" required maxlength="100"></label><label class="field">A little note<textarea name="note" maxlength="500"></textarea></label><p>Only saved on this device. No invitations will be sent.</p><div class="actions"><button class="primary">Save gathering</button></div></form>`,
    ),
  feedback: () =>
    modal(
      "Help make Hearth feel like home.",
      `<form id="feedback-form"><label class="field">Your thoughts<textarea name="feedback" maxlength="10000" required placeholder="I liked… I found it difficult to… I wished…"></textarea></label><p>This downloads a text file. Share it with your host when you’re ready.</p><div class="actions"><button class="primary">Download feedback</button></div></form>`,
    ),
};
function flip(array, value) {
  return array.includes(value)
    ? array.filter((x) => x !== value)
    : [...array, value];
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (!Object.keys(d).length) return;
  if (d.action) {
    actions[d.action]?.();
    return;
  }
  if (d.filter) {
    filter = d.filter;
    page = 0;
    render();
    return;
  }
  if (d.reply) {
    person = d.reply;
    if (route() === "parlor") render();
    else location.hash = "parlor";
    return;
  }
  if (d.person) {
    person = d.person;
    render();
    return;
  }
  if (d.heart) state.hearts = flip(state.hearts, d.heart);
  if (d.remove) {
    const p = state.posts.find((p) => p.id === d.remove);
    if (p.person === "me") {
      modal(
        "Remove this moment?",
        `<p>This deletes your moment from this demo.</p><div class="actions"><button data-action="close">Keep it</button><button data-confirm-delete="${p.id}" class="danger">Delete moment</button></div>`,
      );
      return;
    }
    state.hidden.push(d.remove);
    toast("Moment hidden. Reset the demo to restore sample moments.");
  }
  if (d.confirmDelete) {
    state.posts = state.posts.filter((p) => p.id !== d.confirmDelete);
    close();
  }
  if (d.rsvp) {
    const event = state.events.find((x) => x.id === d.rsvp);
    event.going = !event.going;
    toast("Your demo RSVP is saved.");
  }
  if (d.deleteEvent) {
    state.events = state.events.filter((x) => x.id !== d.deleteEvent);
  }
  if (d.read) state.read.push(d.read);
  save();
  render();
});
document.addEventListener("change", (e) => {
  const d = e.target.dataset;
  if (d.setting) state.settings[d.setting] = e.target.checked;
  if (d.topic) state.settings.topics = flip(state.settings.topics, d.topic);
  if (d.circle)
    state.kin.find((k) => k.id === d.circle).circle = e.target.checked;
  if (d.unmute) state.muted = flip(state.muted, d.unmute);
  if (d.setting || d.topic || d.circle || d.unmute) {
    save();
    document.body.classList.toggle("dark", state.settings.dark);
    if (!$("#dialog").open) toast("Your preference is saved.");
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target,
    data = Object.fromEntries(new FormData(f));
  for (const key of Object.keys(data)) data[key] = data[key].trim();
  if ([...f.querySelectorAll("[required]")].some((el) => !el.value.trim())) {
    toast("Add a little something before saving.");
    return;
  }
  if (f.id === "post-form") {
    state.posts.push({
      id: crypto.randomUUID(),
      person: "me",
      name: state.name,
      content: data.content,
      topic: data.topic,
      audience: data.audience,
      time: Date.now(),
    });
    state.paused = false;
    filter = "all";
    page = 0;
    close();
    toast("Your moment is saved on this device.");
  }
  if (f.id === "message-form") {
    (state.messages[person] ??= []).push({
      text: data.message,
      mine: true,
      time: Date.now(),
    });
    toast("Saved locally. This demo does not deliver messages.");
  }
  if (f.id === "name-form" || f.id === "welcome-form") {
    state.name = data.name;
    state.started = true;
    if (f.id === "welcome-form") close();
    toast("Welcome home, " + state.name + ".");
  }
  if (f.id === "event-form") {
    state.events.push({
      ...data,
      id: crypto.randomUUID(),
      going: true,
      mine: true,
    });
    state.events.sort((a, b) => a.date.localeCompare(b.date));
    close();
    toast("Your gathering is saved locally.");
  }
  if (f.id === "feedback-form") {
    download(
      "hearth-feedback.txt",
      "Hearth feedback\n\n" + data.feedback,
      "text/plain",
    );
    close();
    return;
  }
  save();
  render();
});
$("#dialog").addEventListener("click", (e) => {
  if (e.target === $("#dialog")) {
    const r = $("#dialog").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      close();
  }
});
window.addEventListener("hashchange", () => {
  if (location.hash === "#main") {
    $("#main").focus();
    return;
  }
  page = 0;
  render();
  $("#main").focus();
  window.scrollTo(0, 0);
});
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    state = load(storage).state;
    render();
  }
});
render();
if (loaded.error)
  toast("Saved demo data could not be loaded. Showing a fresh preview.");
