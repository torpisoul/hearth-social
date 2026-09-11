// Explicit opt-in: creates three temporary accounts in the configured project,
// exercises real Auth/Data APIs, and deletes them through the self-service RPC.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  createIdentity,
  encryptMessage,
  decryptMessage,
  unlockIdentity,
} from "../js/live/crypto.js";
if (process.env.HEARTH_RUN_LIVE_TESTS !== "yes")
  throw Error(
    "Set HEARTH_RUN_LIVE_TESTS=yes to run disposable hosted-account tests.",
  );
const config = JSON.parse(
  await readFile(new URL("../public-config.json", import.meta.url), "utf8"),
);
const clients = [];
const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};
try {
  for (const name of ["Alice", "Bob", "Outsider"]) {
    const client = createClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const result = check(
      await client.auth.signUp({
        email: `hearth-test-${crypto.randomUUID()}@example.com`,
        password: crypto.randomUUID() + crypto.randomUUID(),
      }),
    );
    if (!result.session)
      throw Error(
        "Live disposable tests need email confirmation disabled on a test/beta project.",
      );
    clients.push({ client, id: result.user.id });
    check(
      await client
        .from("hearth_profiles")
        .insert({ id: result.user.id, name: `Test ${name}` }),
    );
  }
  const [a, b, c] = clients;
  check(
    await a.client.from("hearth_statuses").insert([
      {
        author: a.id,
        content: "Private hosted test",
        audience: "Only me",
        topic: "Everyday life",
      },
      {
        author: a.id,
        content: "Shared hosted test",
        audience: "All kin",
        topic: "Everyday life",
      },
    ]),
  );
  assert.equal(
    check(await b.client.from("hearth_statuses").select("*")).length,
    0,
  );
  check(await a.client.rpc("hearth_request_friend", { person: b.id }));
  assert.equal(
    check(await b.client.from("hearth_statuses").select("*")).length,
    0,
  );
  check(await b.client.rpc("hearth_accept_friend", { person: a.id }));
  assert.equal(
    check(await b.client.from("hearth_statuses").select("*")).length,
    1,
  );
  const alice = await createIdentity("Disposable Alice messaging passphrase");
  const pending = await encryptMessage(alice.privateKey,alice.public_key,{id:crypto.randomUUID(),sender:a.id,recipient:b.id},'A waiting hello');
  check(await a.client.from('hearth_waiting_notes').insert(pending));
  assert.equal(check(await b.client.from('hearth_waiting_notes').select('*')).length,1);
  assert.equal(check(await c.client.from('hearth_waiting_notes').select('*')).length,0);
  check(await a.client.from('hearth_preferences').insert({owner:a.id}));
  assert.deepEqual(check(await a.client.from('hearth_preferences').select('topics')).at(0).topics,[]);
  assert.equal(check(await b.client.from('hearth_preferences').select('*')).length,0);
  check(await a.client.from('hearth_profiles').update({avatar:'data:image/png;base64,aGVsbG8='}).eq('id',a.id));
  assert.equal(check(await b.client.from('hearth_profiles').select('avatar').eq('id',a.id)).at(0).avatar,'data:image/png;base64,aGVsbG8=');
  const eventArgs={plan:null,plan_title:'Test walk',plan_place:'Test park',plan_start:new Date(Date.now()+86400000).toISOString(),plan_details:'',invitees:[b.id]};
  const event={id:check(await a.client.rpc('hearth_save_event',eventArgs))};
  assert.equal(check(await a.client.from('hearth_event_invites').select('*').eq('event',event.id)).length,1);
  assert.equal(check(await b.client.from('hearth_event_invites').select('*').eq('event',event.id)).length,0);
  assert.ok((await b.client.rpc('hearth_save_event',{...eventArgs,plan:event.id})).error);
  check(await b.client.from('hearth_rsvps').insert({event:event.id}));
  assert.equal(check(await a.client.from('hearth_rsvps').select('*')).length,1);
  assert.equal(check(await c.client.from('hearth_rsvps').select('*')).length,0);
  assert.equal(check(await b.client.rpc('hearth_event_attendees',{plans:[event.id]})).length,1);
  assert.equal(check(await c.client.rpc('hearth_event_attendees',{plans:[event.id]})).length,0);
  check(await a.client.rpc('hearth_save_event',{...eventArgs,plan:event.id,plan_title:'An edited walk',invitees:[]}));
  assert.equal(check(await b.client.from('hearth_events').select('*').eq('id',event.id)).length,0);
  assert.equal(check(await a.client.from('hearth_rsvps').select('*').eq('event',event.id)).length,0);
  assert.ok((await b.client.from('hearth_rsvps').insert({event:event.id})).error);
  check(await a.client.rpc('hearth_save_event',{...eventArgs,plan:event.id}));

  const bob = await createIdentity("Disposable Bob messaging passphrase");
  for (const [u, key] of [
    [a, alice],
    [b, bob],
  ])
    check(
      await u.client
        .from("hearth_keys")
        .insert({ owner: u.id, public_key: key.public_key, vault: key.vault }),
    );
  const pendingText = await decryptMessage(alice.privateKey,alice.public_key,pending);
  const forwarded = await encryptMessage(alice.privateKey,bob.public_key,{id:pending.id,sender:a.id,recipient:b.id},pendingText);
  check(await a.client.from('hearth_messages').insert(forwarded));
  assert.equal(await decryptMessage(bob.privateKey,alice.public_key,forwarded),'A waiting hello');
  check(await a.client.from('hearth_waiting_notes').delete().eq('id',pending.id));
  const pub = check(await a.client.rpc("hearth_public_key", { person: b.id }));
  assert.deepEqual(pub, bob.public_key);
  const envelope = await encryptMessage(
    alice.privateKey,
    pub,
    { id: crypto.randomUUID(), sender: a.id, recipient: b.id },
    "A real encrypted hello 🌿",
  );
  check(await a.client.from("hearth_messages").insert(envelope));
  const received = check(
    await b.client.from("hearth_messages").select("*").eq("id", envelope.id),
  ).at(0);
  assert.equal(
    await decryptMessage(bob.privateKey, alice.public_key, received),
    "A real encrypted hello 🌿",
  );
  const restored = await unlockIdentity(
    check(await b.client.rpc("hearth_my_vault")),
    "Disposable Bob messaging passphrase",
  );
  assert.equal(
    await decryptMessage(restored, alice.public_key, received),
    "A real encrypted hello 🌿",
  );
  assert.equal(
    check(await c.client.from("hearth_messages").select("*")).length,
    0,
  );
  assert.equal(
    check(await c.client.rpc("hearth_public_key", { person: a.id })),
    null,
  );
  assert.ok((await b.client.from("hearth_keys").select("*")).error);
  check(
    await b.client.from("hearth_blocks").insert({ owner: b.id, target: a.id }),
  );
  assert.equal(
    check(await b.client.from("hearth_statuses").select("*")).length,
    0,
  );
  assert.ok(
    (
      await a.client
        .from("hearth_messages")
        .insert({ ...envelope, id: crypto.randomUUID() })
    ).error,
  );
  console.log(
    "PASS: hosted signup, profiles, friendship consent, audience isolation, encrypted send/read, restored vault, outsider denial, blocking, topic preferences, avatars, gatherings, RSVP privacy and waiting-note forwarding.",
  );
} finally {
  let failed = false;
  for (const u of clients) {
    const result = await u.client.rpc("hearth_delete_account");
    if (result.error) {
      console.error(
        "Temporary account cleanup failed:",
        u.id,
        result.error.message,
      );
      failed = true;
    } else {
      const { data } = await u.client.from("hearth_profiles").select("*");
      assert.equal(data?.length, 0);
    }
  }
  if (failed) process.exitCode = 1;
  else
    console.log(
      `Cleaned up ${clients.length} temporary accounts and their data.`,
    );
}
