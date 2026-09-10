// Versioned P-256 ECDH + AES-256-GCM envelopes; no forward secrecy.
const utf8 = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const bytes = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const aad = ({ id, sender, recipient, version }) =>
  utf8.encode(JSON.stringify([version, id, sender, recipient]));
async function wrappingKey(passphrase, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function createIdentity(passphrase) {
  if (passphrase.length < 16)
    throw Error("Use a messaging passphrase of at least 16 characters.");
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );
  const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const secret = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await wrappingKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8.encode("hearth-vault-v1") },
    key,
    utf8.encode(JSON.stringify(secret)),
  );
  return {
    public_key: pub,
    vault: {
      version: 1,
      salt: b64(salt),
      iv: b64(iv),
      ciphertext: b64(ciphertext),
    },
    privateKey: await crypto.subtle.importKey(
      "jwk",
      secret,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey"],
    ),
  };
}
export async function unlockIdentity(vault, passphrase) {
  if (vault.version !== 1) throw Error("Unsupported messaging vault version.");
  try {
    const key = await wrappingKey(passphrase, bytes(vault.salt));
    const raw = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(vault.iv),
        additionalData: utf8.encode("hearth-vault-v1"),
      },
      key,
      bytes(vault.ciphertext),
    );
    return await crypto.subtle.importKey(
      "jwk",
      JSON.parse(new TextDecoder().decode(raw)),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey"],
    );
  } catch {
    throw Error("Could not unlock messages. Check your messaging passphrase.");
  }
}
async function conversationKey(privateKey, publicKey) {
  const peer = await crypto.subtle.importKey(
    "jwk",
    publicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peer },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptMessage(privateKey, publicKey, meta, text) {
  if (!text.trim() || text.length > 2000)
    throw Error("Messages must contain 1–2,000 characters.");
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    envelope = { ...meta, version: 1 };
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad(envelope) },
    await conversationKey(privateKey, publicKey),
    utf8.encode(text),
  );
  return { ...envelope, iv: b64(iv), ciphertext: b64(ciphertext) };
}
export async function decryptMessage(privateKey, publicKey, envelope) {
  if (envelope.version !== 1) throw Error("Unsupported message version.");
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(envelope.iv), additionalData: aad(envelope) },
    await conversationKey(privateKey, publicKey),
    bytes(envelope.ciphertext),
  );
  return new TextDecoder().decode(raw);
}
export async function fingerprint(key) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    utf8.encode(
      JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x, y: key.y }),
    ),
  );
  return [...new Uint8Array(hash)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")
    .match(/.{1,8}/g)
    .join(" ");
}
