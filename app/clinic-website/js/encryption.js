/* =========================================================
   encryption.js — AES-256-GCM demonstration (Web Crypto API)
   ---------------------------------------------------------
   Academic note:
   The master key is NOT hard-coded. On first run the app generates a
   random AES-256-GCM key with crypto.subtle.generateKey({extractable:false})
   and stores the CryptoKey handle itself inside IndexedDB. Because the key
   is non-extractable, page scripts can use it but cannot read its raw bytes.
   This is a browser-side demonstration only — see README "Security
   Limitations". A production healthcare system would keep keys in a server
   HSM / KMS, never in the browser.
   ========================================================= */

const CMS_Encryption = (() => {
  const KEY_STORE = "keystore";
  const KEY_ID = "master-aes-key";
  let cachedKey = null;

  /** Generate a fresh non-extractable AES-256-GCM key. */
  async function generateEncryptionKey() {
    return crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // non-extractable: raw key material can never be read back
      ["encrypt", "decrypt"]
    );
  }

  /** Get (or lazily create and persist) the application master key. */
  async function getKey() {
    if (cachedKey) return cachedKey;
    let stored = null;
    try {
      stored = await CMS_DB.getRecord(KEY_STORE, KEY_ID);
    } catch (error) {
      console.error("Keystore read failed", error);
    }
    if (stored && stored.key) {
      cachedKey = stored.key;
      return cachedKey;
    }
    cachedKey = await generateEncryptionKey();
    await CMS_DB.putRecord(KEY_STORE, { id: KEY_ID, key: cachedKey, createdAt: new Date().toISOString() });
    return cachedKey;
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function toBase64(bytes) {
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }
  function fromBase64(value) {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  }

  /** Encrypt a string -> envelope object { __enc, iv, data }. */
  async function encryptData(plainText) {
    if (plainText === undefined || plainText === null || plainText === "") return plainText;
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(String(plainText)));
    return { __enc: true, alg: "AES-256-GCM", iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) };
  }

  /** Decrypt an envelope produced by encryptData(). */
  async function decryptData(envelope) {
    if (!envelope || typeof envelope !== "object" || !envelope.__enc) return envelope;
    try {
      const key = await getKey();
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(envelope.iv) },
        key,
        fromBase64(envelope.data)
      );
      return dec.decode(plain);
    } catch (error) {
      console.error("Decryption failed", error);
      return "[unable to decrypt]";
    }
  }

  function isEncrypted(value) {
    return !!value && typeof value === "object" && value.__enc === true;
  }

  /** Encrypt the named fields of a record (returns a new object). */
  async function encryptFields(record, fields) {
    const copy = { ...record };
    for (const field of fields) {
      if (copy[field] !== undefined && !isEncrypted(copy[field])) {
        copy[field] = await encryptData(copy[field]);
      }
    }
    return copy;
  }

  /** Decrypt every encrypted field of a record (in memory only). */
  async function decryptRecord(record) {
    if (!record || typeof record !== "object") return record;
    const copy = { ...record };
    for (const [field, value] of Object.entries(copy)) {
      if (isEncrypted(value)) copy[field] = await decryptData(value);
    }
    return copy;
  }

  async function decryptAll(records) {
    return Promise.all(records.map(decryptRecord));
  }

  /** Short ciphertext preview for the security demonstration page. */
  function preview(value) {
    return isEncrypted(value) ? `${value.alg} | iv:${value.iv} | ct:${value.data.slice(0, 64)}…` : "(not encrypted)";
  }

  return {
    generateEncryptionKey,
    encryptData,
    decryptData,
    encryptFields,
    decryptRecord,
    decryptAll,
    isEncrypted,
    preview,
    KEY_STORE,
  };
})();
