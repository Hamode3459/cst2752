/* =========================================================
   data.js — decrypted read helpers shared by the dashboards
   Every function returns data decrypted in memory only; the
   ciphertext always stays in IndexedDB.
   ========================================================= */

const CMS_Data = (() => {
  async function patients() {
    return CMS_Encryption.decryptAll(await CMS_DB.getAllRecords("patients"));
  }
  async function patient(id) {
    const record = await CMS_DB.getRecord("patients", id);
    return record ? CMS_Encryption.decryptRecord(record) : null;
  }
  async function doctors() {
    return CMS_DB.getAllRecords("doctors");
  }
  async function doctor(id) {
    return CMS_DB.getRecord("doctors", id);
  }
  async function appointments(filter = {}) {
    let rows = filter.patientId
      ? await CMS_DB.getByIndex("appointments", "patientId", filter.patientId)
      : filter.doctorId
        ? await CMS_DB.getByIndex("appointments", "doctorId", filter.doctorId)
        : await CMS_DB.getAllRecords("appointments");
    return CMS_Encryption.decryptAll(rows);
  }
  async function prescriptions(filter = {}) {
    const rows = filter.patientId
      ? await CMS_DB.getByIndex("prescriptions", "patientId", filter.patientId)
      : filter.doctorId
        ? await CMS_DB.getByIndex("prescriptions", "doctorId", filter.doctorId)
        : await CMS_DB.getAllRecords("prescriptions");
    return CMS_Encryption.decryptAll(rows);
  }
  async function medicalRecords(filter = {}) {
    const rows = filter.patientId
      ? await CMS_DB.getByIndex("medicalRecords", "patientId", filter.patientId)
      : filter.doctorId
        ? await CMS_DB.getByIndex("medicalRecords", "doctorId", filter.doctorId)
        : await CMS_DB.getAllRecords("medicalRecords");
    return CMS_Encryption.decryptAll(rows);
  }

  /** id -> record lookup map. */
  function indexById(list) {
    const map = new Map();
    list.forEach((item) => map.set(item.id, item));
    return map;
  }

  /** Generate a readable unique ID, e.g. nextId('APT'). */
  function nextId(prefix) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
  }

  /** Text search across a patient's identifying fields. */
  function matchesPatient(patientRecord, query) {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    return [
      patientRecord.firstName,
      patientRecord.lastName,
      `${patientRecord.firstName} ${patientRecord.lastName}`,
      patientRecord.email,
      patientRecord.nhsNumber,
    ]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q));
  }

  return {
    patients,
    patient,
    doctors,
    doctor,
    appointments,
    prescriptions,
    medicalRecords,
    indexById,
    nextId,
    matchesPatient,
  };
})();
