/* =========================================================
   database.js — reusable IndexedDB service
   Database: ClinicalManagementDB
   Object stores: users, patients, doctors, admins,
                  appointments, medicalRecords, prescriptions,
                  keystore, meta, auditLog
   ========================================================= */

const CMS_DB = (() => {
  const DB_NAME = "ClinicalManagementDB";
  const DB_VERSION = 1;
  let dbPromise = null;

  const SCHEMA = {
    users: { keyPath: "id", indexes: [["email", "email", { unique: true }], ["role", "role"]] },
    patients: {
      keyPath: "id",
      indexes: [["userId", "userId"], ["lastName", "lastNameSearch"], ["email", "emailSearch"], ["nhsNumber", "nhsSearch"]],
    },
    doctors: { keyPath: "id", indexes: [["userId", "userId"], ["speciality", "speciality"]] },
    admins: { keyPath: "id", indexes: [["userId", "userId"]] },
    appointments: {
      keyPath: "id",
      indexes: [["patientId", "patientId"], ["doctorId", "doctorId"], ["date", "date"], ["status", "status"]],
    },
    medicalRecords: { keyPath: "id", indexes: [["patientId", "patientId"], ["doctorId", "doctorId"], ["date", "date"]] },
    prescriptions: {
      keyPath: "id",
      indexes: [["patientId", "patientId"], ["doctorId", "doctorId"], ["status", "status"]],
    },
    keystore: { keyPath: "id", indexes: [] },
    meta: { keyPath: "id", indexes: [] },
    auditLog: { keyPath: "id", indexes: [["at", "at"]] },
  };

  /** Open (and upgrade if needed) the IndexedDB database. */
  function initDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB is not supported by this browser."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        Object.entries(SCHEMA).forEach(([storeName, config]) => {
          let store;
          if (!db.objectStoreNames.contains(storeName)) {
            store = db.createObjectStore(storeName, { keyPath: config.keyPath });
          } else {
            store = event.target.transaction.objectStore(storeName);
          }
          config.indexes.forEach(([indexName, keyPath, options]) => {
            if (!store.indexNames.contains(indexName)) store.createIndex(indexName, keyPath, options || {});
          });
        });
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Database upgrade blocked — close other tabs of this app."));
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await initDatabase();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** CREATE — fails if the key already exists (prevents duplicate seeding). */
  async function addRecord(storeName, record) {
    const store = await tx(storeName, "readwrite");
    await wrap(store.add(record));
    return record;
  }

  /** CREATE or UPDATE (upsert). */
  async function putRecord(storeName, record) {
    const store = await tx(storeName, "readwrite");
    await wrap(store.put(record));
    return record;
  }

  /** READ one record by primary key. */
  async function getRecord(storeName, id) {
    const store = await tx(storeName, "readonly");
    return wrap(store.get(id));
  }

  /** READ every record in a store. */
  async function getAllRecords(storeName) {
    const store = await tx(storeName, "readonly");
    return wrap(store.getAll());
  }

  /** READ by index value, e.g. getByIndex('appointments','patientId','P001'). */
  async function getByIndex(storeName, indexName, value) {
    const store = await tx(storeName, "readonly");
    return wrap(store.index(indexName).getAll(value));
  }

  /** UPDATE — merges the patch into the existing record. */
  async function updateRecord(storeName, id, patch) {
    const existing = await getRecord(storeName, id);
    if (!existing) throw new Error(`Record ${id} not found in ${storeName}`);
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    const store = await tx(storeName, "readwrite");
    await wrap(store.put(updated));
    return updated;
  }

  /** DELETE one record. */
  async function deleteRecord(storeName, id) {
    const store = await tx(storeName, "readwrite");
    await wrap(store.delete(id));
    return true;
  }

  /** DELETE every record in a store. */
  async function clearStore(storeName) {
    const store = await tx(storeName, "readwrite");
    await wrap(store.clear());
    return true;
  }

  async function countRecords(storeName) {
    const store = await tx(storeName, "readonly");
    return wrap(store.count());
  }

  /** Delete the whole database (admin "Reset Demo Database"). */
  function deleteDatabase() {
    dbPromise = null;
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve(true);
    });
  }

  /** Simple client-side audit trail (demonstration of logging). */
  async function log(action, detail) {
    try {
      await putRecord("auditLog", {
        id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        action,
        detail: detail || "",
        userId: (CMS_Auth.getSession() || {}).userId || "anonymous",
      });
    } catch (error) {
      console.error("Audit log failed", error);
    }
  }

  return {
    DB_NAME,
    DB_VERSION,
    STORES: Object.keys(SCHEMA),
    initDatabase,
    addRecord,
    putRecord,
    getRecord,
    getAllRecords,
    getByIndex,
    updateRecord,
    deleteRecord,
    clearStore,
    countRecords,
    deleteDatabase,
    log,
  };
})();
