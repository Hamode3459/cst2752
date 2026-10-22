/* =========================================================
   auth.js — authentication, sessions and role-based access
   Session storage holds ONLY: userId, role, name, expiry.
   Passwords are never stored in the browser session.
   ========================================================= */

const CMS_Auth = (() => {
  const SESSION_KEY = "cms_session";
  const TIMEOUT_MS = 20 * 60 * 1000; // 20-minute inactivity timeout
  const ROLES = { PATIENT: "PATIENT", DOCTOR: "DOCTOR", ADMIN: "ADMIN" };
  const HOME = { PATIENT: "patient.html", DOCTOR: "doctor.html", ADMIN: "admin.html" };

  function getSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (!session) return null;
      if (Date.now() > session.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function setSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, expiresAt: Date.now() + TIMEOUT_MS }));
  }

  function touch() {
    const session = getSession();
    if (session) setSession(session);
  }

  /** Authenticate by email + password against hashed credentials in IndexedDB. */
  async function login(email, password) {
    const cleanEmail = CMS_Security.sanitise(email).toLowerCase();
    const lock = CMS_Security.lockStatus(cleanEmail);
    if (lock.locked) {
      return { ok: false, message: `Too many failed attempts. Try again in ${lock.seconds} seconds.` };
    }

    const users = await CMS_DB.getByIndex("users", "email", cleanEmail);
    const user = users[0];
    if (!user) {
      CMS_Security.registerFailure(cleanEmail);
      await CMS_DB.log("LOGIN_FAILED", cleanEmail);
      return { ok: false, message: "Invalid email or password." };
    }

    const valid = await CMS_Security.verifyPassword(password, user.passwordHash);
    if (!valid) {
      const left = CMS_Security.registerFailure(cleanEmail);
      await CMS_DB.log("LOGIN_FAILED", cleanEmail);
      return { ok: false, message: `Invalid email or password. ${left > 0 ? `${left} attempt(s) left.` : ""}`.trim() };
    }

    CMS_Security.clearFailures(cleanEmail);
    const profile = await getProfile(user);
    setSession({
      userId: user.id,
      role: user.role,
      profileId: profile ? profile.id : null,
      name: profile ? `${profile.firstName} ${profile.lastName}` : cleanEmail,
      email: user.email,
    });
    await CMS_DB.log("LOGIN_SUCCESS", user.id);
    return { ok: true, role: user.role, redirect: HOME[user.role] };
  }

  /** Find the patient/doctor/admin profile linked to a user account. */
  async function getProfile(user) {
    const store = user.role === ROLES.PATIENT ? "patients" : user.role === ROLES.DOCTOR ? "doctors" : "admins";
    const matches = await CMS_DB.getByIndex(store, "userId", user.id);
    return matches[0] || null;
  }

  async function currentProfile() {
    const session = getSession();
    if (!session || !session.profileId) return null;
    const store = session.role === ROLES.PATIENT ? "patients" : session.role === ROLES.DOCTOR ? "doctors" : "admins";
    const record = await CMS_DB.getRecord(store, session.profileId);
    return record ? CMS_Encryption.decryptRecord(record) : null;
  }

  /** Register a new patient self-service account. */
  async function registerPatient(data) {
    const email = CMS_Security.sanitise(data.email).toLowerCase();
    const existing = await CMS_DB.getByIndex("users", "email", email);
    if (existing.length) return { ok: false, message: "An account with that email already exists." };

    const userId = `U-${Date.now().toString(36).toUpperCase()}`;
    const patientId = `P-${Date.now().toString(36).toUpperCase()}`;
    const passwordHash = await CMS_Security.hashPassword(data.password);

    await CMS_DB.addRecord("users", {
      id: userId,
      email,
      passwordHash,
      role: ROLES.PATIENT,
      createdAt: new Date().toISOString(),
    });

    const patient = {
      id: patientId,
      userId,
      firstName: CMS_Security.sanitise(data.firstName),
      lastName: CMS_Security.sanitise(data.lastName),
      lastNameSearch: CMS_Security.sanitise(data.lastName).toLowerCase(),
      emailSearch: email,
      nhsSearch: CMS_Security.sanitise(data.nhsNumber).replace(/\s/g, ""),
      email,
      dateOfBirth: data.dateOfBirth,
      createdAt: new Date().toISOString(),
      address: CMS_Security.sanitise(data.address),
      telephone: CMS_Security.sanitise(data.telephone),
      nhsNumber: CMS_Security.sanitise(data.nhsNumber),
      emergencyContact: CMS_Security.sanitise(data.emergencyContact || ""),
    };

    await CMS_DB.addRecord("patients", await CMS_Encryption.encryptFields(patient, CMS_Encryption_FIELDS.patients));
    await CMS_DB.log("REGISTER", patientId);
    return { ok: true, message: "Account created. You can now sign in." };
  }

  function logout() {
    CMS_DB.log("LOGOUT", (getSession() || {}).userId || "");
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
  }

  /**
   * Page protection. Call at the top of every dashboard page.
   * Redirects unauthenticated users to login and wrong roles to their own home.
   */
  function requireRole(...allowed) {
    const session = getSession();
    if (!session) {
      sessionStorage.setItem("cms_flash", "Please sign in to continue.");
      window.location.replace("login.html");
      return null;
    }
    if (allowed.length && !allowed.includes(session.role)) {
      sessionStorage.setItem("cms_flash", "Access denied. You do not have permission to view that page.");
      CMS_DB.log("ACCESS_DENIED", window.location.pathname);
      window.location.replace(HOME[session.role]);
      return null;
    }
    touch();
    return session;
  }

  return { ROLES, HOME, login, logout, registerPatient, getSession, setSession, touch, requireRole, currentProfile, getProfile };
})();

/** Fields encrypted at rest with AES-256-GCM, per object store. */
const CMS_Encryption_FIELDS = {
  patients: ["address", "telephone", "nhsNumber", "emergencyContact"],
  medicalRecords: ["diagnosis", "notes", "treatment"],
  prescriptions: ["instructions"],
  appointments: ["reason", "notes"],
};
