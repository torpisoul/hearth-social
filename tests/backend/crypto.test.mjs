import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createIdentity,
  unlockIdentity,
  encryptMessage,
  decryptMessage,
  fingerprint,
} from "../../js/live/crypto.js";
test("two users and a restored device can decrypt; outsiders, tampering and wrong passwords cannot", async () => {
  const alice = await createIdentity("Alice has a long unique passphrase");
  const bob = await createIdentity("Bob has another long passphrase");
  const eve = await createIdentity("Eve has yet another long passphrase");
  const meta = {
    id: crypto.randomUUID(),
    sender: crypto.randomUUID(),
    recipient: crypto.randomUUID(),
  };
  const encrypted = await encryptMessage(
    alice.privateKey,
    bob.public_key,
    meta,
    "Hello 🌿 <script>",
  );
  assert.equal(JSON.stringify(encrypted).includes("Hello"), false);
  assert.equal(
    await decryptMessage(bob.privateKey, alice.public_key, encrypted),
    "Hello 🌿 <script>",
  );
  assert.equal(
    await decryptMessage(alice.privateKey, bob.public_key, encrypted),
    "Hello 🌿 <script>",
  );
  const restored = await unlockIdentity(
    bob.vault,
    "Bob has another long passphrase",
  );
  assert.equal(
    await decryptMessage(restored, alice.public_key, encrypted),
    "Hello 🌿 <script>",
  );
  await assert.rejects(unlockIdentity(bob.vault, "an incorrect passphrase"));
  await assert.rejects(
    decryptMessage(eve.privateKey, alice.public_key, encrypted),
  );
  await assert.rejects(
    decryptMessage(bob.privateKey, alice.public_key, {
      ...encrypted,
      recipient: crypto.randomUUID(),
    }),
  );
  await assert.rejects(
    decryptMessage(bob.privateKey, alice.public_key, {
      ...encrypted,
      ciphertext: "AAAA" + encrypted.ciphertext.slice(4),
    }),
  );
  await assert.rejects(
    encryptMessage(alice.privateKey, bob.public_key, meta, " "),
  );
  assert.equal(alice.privateKey.extractable, false);
  assert.notEqual(
    await fingerprint(alice.public_key),
    await fingerprint(bob.public_key),
  );
});
