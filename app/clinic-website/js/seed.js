/* =========================================================
   seed.js — loads the module's JSON server data into IndexedDB
   1. Fetches doctors, patients, admins and medicines from the
      course JSON server.
   2. Falls back to the copy in data/course/ when offline.
   3. Converts the records to this app's schema, hashes demo
      passwords and encrypts sensitive fields before storing.
   Sample appointments, records and prescriptions in data/ are
   then linked to the imported patients and doctors.
   ========================================================= */

const CMS_Seed = (() => {
  const SEED_FLAG = "seed-complete";

  /** Course JSON endpoints (from the coursework brief). */
  const COURSE_SOURCES = {
    doctors: "https://jsethi-mdx.github.io/cst2572.github.io/doctors.json",
    patients: "https://jsethi-mdx.github.io/cst2572.github.io/patients.json",
    admins: "https://jsethi-mdx.github.io/cst2572.github.io/admin.json",
    medicines: "https://jsethi-mdx.github.io/cst2572.github.io/medicines.json",
  };
  const LOCAL_COPY = { doctors: "course/doctors.json", patients: "course/patients.json", admins: "course/admin.json", medicines: "course/medicines.json" };
  const FETCH_TIMEOUT_MS = 8000;

  async function isSeeded() {
    const flag = await CMS_DB.getRecord("meta", SEED_FLAG);
    return !!(flag && flag.value);
  }

  async function fetchJson(file) {
    const response = await fetch(`./data/${file}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`);
    return response.json();
  }

  /** GET a remote JSON array, giving up after FETCH_TIMEOUT_MS. */
  async function fetchRemote(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Expected a JSON array");
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Try the course URL, then the local copy. Returns { rows, source }. */
  async function fetchCourseData(name) {
    const url = COURSE_SOURCES[name];
    try {
      return { rows: await fetchRemote(url), source: url };
    } catch (error) {
      console.warn(`Could not fetch ${name} from ${url}: ${error.message}`);
    }
    return { rows: await fetchJson(LOCAL_COPY[name]), source: `data/${LOCAL_COPY[name]} (offline copy)` };
  }

  function searchable(patient) {
    return {
      lastNameSearch: String(patient.lastName || "").toLowerCase(),
      emailSearch: String(patient.email || "").toLowerCase(),
      nhsSearch: String(patient.nhsNumber || "").replace(/\s/g, ""),
    };
  }

  /* ---------- Course JSON -> app schema ---------- */
  const pad = (n) => String(n).padStart(3, "0");
  const clean = (v) => CMS_Security.sanitise(v);

  /** "22/09/1984" -> "1984-09-22" */
  function ukDateToISO(value) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value || "").trim());
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  }

  /** "6538586104" -> "653 858 6104" (NHS display format) */
  function formatNhs(value) {
    const d = String(value || "").replace(/\D/g, "");
    return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : clean(value);
  }

  const toPatient = (r) => ({
    id: `P${pad(r.id)}`,
    userId: `U-P${pad(r.id)}`,
    title: clean(r.Title),
    firstName: clean(r.First),
    lastName: clean(r.Last),
    gender: clean(r.Gender),
    email: clean(r.Email).toLowerCase(),
    address: clean(r.Address),
    telephone: clean(r.Telephone),
    dateOfBirth: ukDateToISO(r.DOB),
    nhsNumber: formatNhs(r.NHS),
    emergencyContact: "",
  });

  const toDoctor = (r) => ({
    id: `D${pad(r.id)}`,
    userId: `U-D${pad(r.id)}`,
    firstName: clean(r.first_name),
    lastName: clean(r.last_name),
    gender: clean(r.gender),
    email: clean(r.email).toLowerCase(),
    address: clean(r.Address),
    telephone: clean(r.Telephone),
    speciality: "General Practice",
    doctorNumber: `GP-${pad(r.id)}`,
  });

  const toAdmin = (r) => ({
    id: `A${pad(r.id)}`,
    userId: `U-A${pad(r.id)}`,
    firstName: clean(r.first_name),
    lastName: clean(r.last_name),
    email: clean(r.email).toLowerCase(),
  });

  const toMedicine = (r) => ({ id: `M${pad(r.id)}`, name: clean(r.Drug) });

  /**
   * The sample clinical data was written for 100 patients and 30 doctors.
   * Map its ids onto the imported people so every row has a real owner.
   */
  function linker(patients, doctors) {
    const pIds = patients.map((p) => p.id);
    const dIds = doctors.map((d) => d.id);
    const pick = (ids, ref) => ids[(Number(String(ref).replace(/\D/g, "")) - 1) % ids.length];
    return (row) => ({ ...row, patientId: pick(pIds, row.patientId), doctorId: pick(dIds, row.doctorId) });
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
    const [patientSrc, doctorSrc, adminSrc, medicineSrc] = await Promise.all([
      fetchCourseData("patients"),
      fetchCourseData("doctors"),
      fetchCourseData("admins"),
      fetchCourseData("medicines"),
    ]);
    const patients = patientSrc.rows.map(toPatient);
    const doctors = doctorSrc.rows.map(toDoctor);
    const admins = adminSrc.rows.map(toAdmin);
    const medicines = medicineSrc.rows.map(toMedicine);

    onProgress("Loading sample appointments, records and prescriptions…");
    const link = linker(patients, doctors);
    const [appointments, prescriptions, medicalRecords] = (
      await Promise.all([fetchJson("appointments.json"), fetchJson("prescriptions.json"), fetchJson("medical-records.json")])
    ).map((rows) => rows.map(link));

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
      const record = { ...p, ...searchable(p), createdAt: now, updatedAt: now };
      await CMS_DB.putRecord("patients", await CMS_Encryption.encryptFields(record, CMS_Encryption_FIELDS.patients));
    }

    onProgress("Storing doctors and administrators…");
    for (const d of doctors) {
      await CMS_DB.putRecord("doctors", await CMS_Encryption.encryptFields({ ...d, createdAt: now }, CMS_Encryption_FIELDS.doctors));
    }
    for (const a of admins) await CMS_DB.putRecord("admins", { ...a, createdAt: now });
    for (const m of medicines) await CMS_DB.putRecord("medicines", m);

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

    const sources = { patients: patientSrc.source, doctors: doctorSrc.source, admins: adminSrc.source, medicines: medicineSrc.source };
    await CMS_DB.putRecord("meta", { id: SEED_FLAG, value: true, seededAt: now, sources });
    await CMS_DB.log("SEED_COMPLETE", `${patients.length} patients, ${doctors.length} doctors from ${patientSrc.source}`);
    onProgress("Demo data loaded.");
    return {
      ok: true,
      sources,
      counts: {
        medicines: medicines.length,
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
    // Databases created before v2 have no medicines yet: import just those.
    if ((await CMS_DB.countRecords("medicines")) === 0) {
      const { rows } = await fetchCourseData("medicines");
      for (const m of rows.map(toMedicine)) await CMS_DB.putRecord("medicines", m);
    }
    return { ok: true, skipped: true };
  }

  return { loadDemoData, resetDemoDatabase, ensureReady, isSeeded, COURSE_SOURCES };
})();
