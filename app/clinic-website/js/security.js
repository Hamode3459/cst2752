/* =========================================================
   security.js — sanitisation, XSS prevention, password hashing
   ========================================================= */

const CMS_Security = (() => {
  /** Strip tags/entities from untrusted strings before they are shown. */
  function sanitise(value) {
    if (value === undefined || value === null) return "";
    return String(value)
      .replace(/<[^>]*>/g, "") // remove any HTML tags
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .replace(/[<>]/g, "")
      .trim();
  }

  /** Escape characters that are unsafe inside HTML. */
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /** Sanitise every string property of an object. */
  function sanitiseObject(object, skip = []) {
    const clean = {};
    Object.entries(object).forEach(([key, value]) => {
      clean[key] = typeof value === "string" && !skip.includes(key) ? sanitise(value) : value;
    });
    return clean;
  }

  /** Safe text node creation — used instead of innerHTML for user data. */
  function text(tag, value, className) {
    const el = document.createElement(tag);
    el.textContent = value ?? "";
    if (className) el.className = className;
    return el;
  }

  /* ---------- Password hashing: PBKDF2-SHA256, 210,000 iterations ---------- */
  const ITERATIONS = 210000;
  const encoder = new TextEncoder();

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function derive(password, saltHex) {
    const salt = Uint8Array.from(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
      baseKey,
      256
    );
    return toHex(bits);
  }

  /** Hash a password with a fresh random salt. Plaintext is never stored. */
  async function hashPassword(password) {
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await derive(password, salt);
    return { salt, hash, iterations: ITERATIONS, algorithm: "PBKDF2-SHA256" };
  }

  /** Constant-time-ish comparison of a candidate password against the stored hash. */
  async function verifyPassword(password, stored) {
    if (!stored || !stored.salt || !stored.hash) return false;
    const candidate = await derive(password, stored.salt);
    if (candidate.length !== stored.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i += 1) diff |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i);
    return diff === 0;
  }

  /* ---------- Brute-force mitigation (client-side demonstration) ---------- */
  const LOCK_KEY = "cms_login_attempts";
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 60 * 1000;

  function readAttempts() {
    try {
      return JSON.parse(localStorage.getItem(LOCK_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function lockStatus(email) {
    const record = readAttempts()[email.toLowerCase()];
    if (!record || !record.lockedUntil) return { locked: false };
    const remaining = record.lockedUntil - Date.now();
    return remaining > 0 ? { locked: true, seconds: Math.ceil(remaining / 1000) } : { locked: false };
  }

  function registerFailure(email) {
    const all = readAttempts();
    const key = email.toLowerCase();
    const record = all[key] || { count: 0 };
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = Date.now() + LOCK_MS;
      record.count = 0;
    }
    all[key] = record;
    localStorage.setItem(LOCK_KEY, JSON.stringify(all));
    return MAX_ATTEMPTS - (record.count || 0);
  }

  function clearFailures(email) {
    const all = readAttempts();
    delete all[email.toLowerCase()];
    localStorage.setItem(LOCK_KEY, JSON.stringify(all));
  }

  return {
    sanitise,
    sanitiseObject,
    escapeHtml,
    text,
    hashPassword,
    verifyPassword,
    lockStatus,
    registerFailure,
    clearFailures,
    MAX_ATTEMPTS,
  };
})();
