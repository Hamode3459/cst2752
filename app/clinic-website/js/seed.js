/* =========================================================
   seed.js — loads fictional JSON "server" data into IndexedDB
   Uses fetch() against /data/*.json, hashes demo passwords and
   encrypts sensitive fields before storing.
   ========================================================= */

const CMS_Seed = (() => {
  const SEED_FLAG = "seed-complete";

  async function isSeeded() {
    const flag = await CMS_DB.getRecord("meta", SEED_FLAG);
    return !!(flag && flag.value);
  }

  async function fetchJson(file) {
    const response = await fetch(`./data/${file}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`);
    return response.json();
  }

  function searchable(patient) {
    return {
      lastNameSearch: String(patient.lastName || "").toLowerCase(),
      emailSearch: String(patient.email || "").toLowerCase(),
      nhsSearch: String(patient.nhsNumber || "").replace(/\s/g, ""),
    };
  }

  /**
   * Seed the database. Safe to call repeatedly: it exits early when the
   * seed flag exists, and uses put() keyed on stable IDs so a partial
   * re-run can never create duplicates.
   */
  async function loadDemoData(onProgress = () => {}) {
    await CMS_DB.initDatabase();
    if (await isSeeded()) return { ok: true, skipped: true };

    onProgress("Fetching JSON data from the server…");
    const [patients, doctors, admins, appointments, prescriptions, medicalRecords] = await Promise.all([
      fetchJson("patients.json"),
      fetchJson("doctors.json"),
      fetchJson("admins.json"),
      fetchJson("appointments.json"),
      fetchJson("prescriptions.json"),
      fetchJson("medical-records.json"),
    ]);

    onProgress("Hashing demonstration passwords (PBKDF2-SHA256)…");
    // Every demo account of a role shares one demo password, so the expensive
    // key derivation only runs three times instead of 134 times.
    const hashes = {
      PATIENT: await CMS_Security.hashPassword("PatientDemo!12345"),
      DOCTOR: await CMS_Security.hashPassword("DoctorDemo!12345"),
      ADMIN: await CMS_Security.hashPassword("AdminDemo!12345"),
    };

    const now = new Date().toISOString();

    onProgress("Creating user accounts…");
    const makeUser = (entity, role) => ({
      id: entity.userId,
      email: String(entity.email).toLowerCase(),
      passwordHash: hashes[role],
      role,
      createdAt: now,
    });
    for (const p of patients) await CMS_DB.putRecord("users", makeUser(p, "PATIENT"));
    for (const d of doctors) await CMS_DB.putRecord("users", makeUser(d, "DOCTOR"));
    for (const a of admins) await CMS_DB.putRecord("users", makeUser(a, "ADMIN"));

    onProgress("Encrypting and storing patient records (AES-256-GCM)…");
    for (const p of patients) {
      const { password, ...rest } = p;
      const record = { ...rest, ...searchable(p), createdAt: now, updatedAt: now };
      await CMS_DB.putRecord("patients", await CMS_Encryption.encryptFields(record, CMS_Encryption_FIELDS.patients));
    }

    onProgress("Storing doctors and administrators…");
    for (const d of doctors) {
      const { password, ...rest } = d;
      await CMS_DB.putRecord("doctors", { ...rest, createdAt: now });
    }
    for (const a of admins) {
      const { password, ...rest } = a;
      await CMS_DB.putRecord("admins", { ...rest, createdAt: now });
    }

    onProgress("Storing appointments…");
    for (const apt of appointments) {
      await CMS_DB.putRecord(
        "appointments",
        await CMS_Encryption.encryptFields({ ...apt, createdAt: now }, CMS_Encryption_FIELDS.appointments)
      );
    }

    onProgress("Encrypting clinical notes and prescriptions…");
    for (const rx of prescriptions) {
      await CMS_DB.putRecord(
        "prescriptions",
        await CMS_Encryption.encryptFields({ ...rx, createdAt: now }, CMS_Encryption_FIELDS.prescriptions)
      );
    }
    for (const mr of medicalRecords) {
      await CMS_DB.putRecord(
        "medicalRecords",
        await CMS_Encryption.encryptFields({ ...mr, createdAt: now }, CMS_Encryption_FIELDS.medicalRecords)
      );
    }

    await CMS_DB.putRecord("meta", { id: SEED_FLAG, value: true, seededAt: now });
    await CMS_DB.log("SEED_COMPLETE", `${patients.length} patients, ${doctors.length} doctors`);
    onProgress("Demo data loaded.");
    return {
      ok: true,
      counts: {
        patients: patients.length,
        doctors: doctors.length,
        admins: admins.length,
        appointments: appointments.length,
        prescriptions: prescriptions.length,
        medicalRecords: medicalRecords.length,
      },
    };
  }

  /** Destroy the database and reload fresh demo data. */
  async function resetDemoDatabase(onProgress = () => {}) {
    onProgress("Deleting ClinicalManagementDB…");
    await CMS_DB.deleteDatabase();
    await CMS_DB.initDatabase();
    return loadDemoData(onProgress);
  }

  /** Called on every page: make sure the database exists and is populated. */
  async function ensureReady(onProgress) {
    await CMS_DB.initDatabase();
    if (!(await isSeeded())) return loadDemoData(onProgress || (() => {}));
    return { ok: true, skipped: true };
  }

  return { loadDemoData, resetDemoDatabase, ensureReady, isSeeded };
})();
