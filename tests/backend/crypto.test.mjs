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

test("generated recovery codes restore the same identity and reject wrong codes", async()=>{
 const {createRecoveryCode,createRecoveryIdentity,normalizeRecoveryCode}=await import('../../js/live/crypto.js');
 const code=createRecoveryCode();
 assert.match(code,/^([0-9a-f]{8}-){7}[0-9a-f]{8}$/);
 const identity=await createRecoveryIdentity(code);
 assert.equal(identity.vault.recovery_code,true);
 assert.equal(JSON.stringify(identity.vault).includes(normalizeRecoveryCode(code)),false);
 const restored=await unlockIdentity(identity.vault,normalizeRecoveryCode(code.toUpperCase().replaceAll('-',' ')));
 const peer=await createIdentity('A distinct peer passphrase for this test');
 const meta={id:crypto.randomUUID(),sender:crypto.randomUUID(),recipient:crypto.randomUUID()};
 const envelope=await encryptMessage(peer.privateKey,identity.public_key,meta,'Recovered hello');
 assert.equal(await decryptMessage(restored,peer.public_key,envelope),'Recovered hello');
 await assert.rejects(unlockIdentity(identity.vault,normalizeRecoveryCode(createRecoveryCode())));
 assert.throws(()=>normalizeRecoveryCode('incomplete'));
 assert.equal(restored.extractable,false);
});
