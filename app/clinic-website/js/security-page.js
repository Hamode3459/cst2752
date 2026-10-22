/* =========================================================
   security-page.js — in-app security status demonstration
   ========================================================= */

CMS.bootDashboard({
  roles: [CMS_Auth.ROLES.PATIENT, CMS_Auth.ROLES.DOCTOR, CMS_Auth.ROLES.ADMIN],
  title: "Security Status",
  active: "security.html",
  render: async (session, content) => {
    /* ---------- Status checklist ---------- */
    const statusBody = document.createElement("div");
    statusBody.className = "panel-body";
    const list = document.createElement("ul");
    list.className = "security-list";
    [
      "Passwords hashed — PBKDF2-SHA256, 210,000 iterations, unique salt per account",
      "AES-256-GCM encryption — sensitive fields encrypted before storage",
      "Input validation — email, password strength, NHS number, telephone, dates",
      "Input sanitisation — markup stripped and rendered with textContent",
      "Role-based access — every dashboard page checks the session role",
      "IndexedDB storage — ClinicalManagementDB with indexed object stores",
      "Session handling — minimal session data with a 20-minute inactivity timeout",
      "Brute-force mitigation — account lockout after 5 failed sign-in attempts",
    ].forEach((item) => {
      const li = document.createElement("li");
      li.append(CMS_Security.text("span", "✓"), CMS_Security.text("span", item));
      list.appendChild(li);
    });
    statusBody.appendChild(list);

    /* ---------- Live ciphertext demonstration ---------- */
    const cipherBody = document.createElement("div");
    cipherBody.className = "panel-body";
    cipherBody.appendChild(
      CMS_Security.text(
        "p",
        "The sample below is read straight out of IndexedDB. Sensitive fields are stored as AES-256-GCM ciphertext and only decrypted in memory when a permitted user views them."
      )
    );

    const raw = (await CMS_DB.getAllRecords("patients"))[0];
    if (raw) {
      const kv = document.createElement("dl");
      kv.className = "kv";
      ["address", "telephone", "nhsNumber"].forEach((field) => {
        kv.append(CMS_Security.text("dt", `${field} (stored)`));
        const dd = document.createElement("dd");
        dd.appendChild(CMS_Security.text("div", CMS_Encryption.preview(raw[field]), "encrypted-peek"));
        kv.appendChild(dd);
      });
      const decrypted = await CMS_Encryption.decryptRecord(raw);
      kv.append(CMS_Security.text("dt", "nhsNumber (decrypted in memory)"), CMS_Security.text("dd", decrypted.nhsNumber));
      cipherBody.appendChild(kv);
    } else {
      cipherBody.appendChild(CMS_Security.text("p", "No patient records available to demonstrate."));
    }

    /* ---------- Session ---------- */
    const sessionBody = document.createElement("div");
    sessionBody.className = "panel-body";
    const sessionKv = document.createElement("dl");
    sessionKv.className = "kv";
    [
      ["Signed in as", session.name],
      ["Role", session.role],
      ["User ID", session.userId],
      ["Stored in session", "currentUserId, role, display name and expiry only"],
      ["Inactivity timeout", "20 minutes"],
      ["Passwords in storage", "Never — only salt and derived hash"],
    ].forEach(([label, value]) => sessionKv.append(CMS_Security.text("dt", label), CMS_Security.text("dd", value)));
    sessionBody.appendChild(sessionKv);

    /* ---------- Limitations ---------- */
    const limitsBody = document.createElement("div");
    limitsBody.className = "panel-body";
    const note = document.createElement("div");
    note.className = "note";
    note.appendChild(
      CMS_Security.text(
        "p",
        "This is a demonstration of security techniques, not a claim of production-level security. IndexedDB is client-side storage that the user fully controls, so authorisation enforced in JavaScript can be bypassed. Encryption keys held in a browser cannot be protected the way a server-side HSM or KMS protects them."
      )
    );
    note.appendChild(
      CMS_Security.text(
        "p",
        "A real healthcare system would require server-side authentication and authorisation, HTTPS/TLS in transit, audit logging, secure database controls and regular penetration testing. No real patient data may ever be used in this prototype."
      )
    );
    limitsBody.appendChild(note);

    content.append(
      CMS.panel("Security status", statusBody),
      CMS.panel("Encryption at rest — live sample", cipherBody),
      CMS.panel("Session details", sessionBody),
      CMS.panel("Important security limitations", limitsBody)
    );
  },
});
