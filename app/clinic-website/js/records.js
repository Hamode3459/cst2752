/* =========================================================
   records.js — medical records
   Patient: read-only timeline of their own history
   Doctor:  add and edit clinical entries
   Admin:   oversight list (no clinical editing)
   ========================================================= */

CMS.bootDashboard({
  roles: [CMS_Auth.ROLES.PATIENT, CMS_Auth.ROLES.DOCTOR, CMS_Auth.ROLES.ADMIN],
  title: "Medical Records",
  active: "medical-records.html",
  render: async (session, content) => {
    const { PATIENT, DOCTOR } = CMS_Auth.ROLES;
    const profile = await CMS_Auth.currentProfile();
    const [patients, doctors] = await Promise.all([
      session.role === PATIENT ? Promise.resolve([]) : CMS_Data.patients(),
      CMS_Data.doctors(),
    ]);
    const patientMap = CMS_Data.indexById(patients);
    const doctorMap = CMS_Data.indexById(doctors);
    const filter = session.role === PATIENT ? { patientId: profile.id } : session.role === DOCTOR ? { doctorId: profile.id } : {};

    async function load() {
      return (await CMS_Data.medicalRecords(filter)).sort(CMS.byDateDesc);
    }
    let rows = await load();

    /* ---------------- Patient view: timeline ---------------- */
    if (session.role === PATIENT) {
      const body = document.createElement("div");
      body.className = "panel-body";
      const timeline = document.createElement("div");
      timeline.className = "timeline";
      if (!rows.length) timeline.appendChild(CMS_Security.text("p", "No medical records yet."));
      rows.forEach((record) => {
        const item = document.createElement("article");
        item.className = "timeline-item";
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.append(
          CMS_Security.text("span", CMS.formatDate(record.date)),
          CMS_Security.text("span", CMS.doctorName(doctorMap.get(record.doctorId)))
        );
        item.append(meta, CMS_Security.text("h4", record.diagnosis), CMS_Security.text("p", record.notes));
        item.append(CMS_Security.text("p", `Treatment: ${record.treatment}`));
        if (record.followUp) item.append(CMS_Security.text("p", `Follow-up: ${record.followUp}`));
        timeline.appendChild(item);
      });
      body.appendChild(timeline);
      content.appendChild(CMS.panel("My medical history", body));
      return;
    }

    /* ---------------- Doctor / admin view: table ---------------- */
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search patient or diagnosis";
    search.setAttribute("aria-label", "Search medical records");
    toolbar.appendChild(search);

    if (session.role === DOCTOR) {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-primary btn-sm";
      addBtn.textContent = "Add medical record";
      addBtn.addEventListener("click", () => openRecordForm());
      toolbar.appendChild(addBtn);
      if (location.hash === "#new") setTimeout(() => openRecordForm(new URLSearchParams(location.search).get("patient")), 200);
    }

    const tableHost = document.createElement("div");
    content.appendChild(CMS.panel("Medical records", tableHost, toolbar));

    function draw() {
      const query = search.value.toLowerCase().trim();
      const visible = rows.filter((row) => {
        if (!query) return true;
        const patient = patientMap.get(row.patientId);
        return [row.diagnosis, row.treatment, patient ? CMS.personName(patient) : ""].join(" ").toLowerCase().includes(query);
      });

      const columns = [
        { label: "Date", get: (r) => CMS.formatDate(r.date) },
        { label: "Patient", get: (r) => CMS.personName(patientMap.get(r.patientId)) },
        { label: "Doctor", get: (r) => CMS.doctorName(doctorMap.get(r.doctorId)) },
        { label: "Diagnosis", get: (r) => r.diagnosis },
        { label: "Treatment", get: (r) => r.treatment },
        {
          label: "Actions",
          get: (r) => {
            const buttons = [
              { label: "Patient history", className: "btn-secondary", onClick: () => { window.location.href = `patients.html?id=${encodeURIComponent(r.patientId)}`; } },
            ];
            if (session.role === DOCTOR && r.doctorId === profile.id) {
              buttons.push({ label: "Edit", className: "btn-secondary", onClick: () => openRecordForm(r.patientId, r) });
            }
            return CMS.actionGroup(buttons);
          },
        },
      ];

      tableHost.replaceChildren(CMS.buildTable(columns, visible.slice(0, 60), "No medical records found."));
      const pager = document.createElement("div");
      pager.className = "pager";
      pager.appendChild(CMS_Security.text("span", `Showing ${Math.min(visible.length, 60)} of ${visible.length} records`));
      tableHost.appendChild(pager);
    }

    search.addEventListener("input", draw);
    draw();

    /* ---------------- Doctor record entry ---------------- */
    function openRecordForm(patientId, existing) {
      const form = document.createElement("form");
      form.className = "form-grid";
      form.noValidate = true;
      form.innerHTML = `
        <div class="field"><label for="m-patient">Patient</label><select id="m-patient"></select><span class="error" role="alert"></span></div>
        <div class="field"><label for="m-date">Date</label><input id="m-date" type="date" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="m-diagnosis">Diagnosis</label><input id="m-diagnosis" type="text" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="m-notes">Medical notes</label><textarea id="m-notes" maxlength="1200"></textarea><span class="error" role="alert"></span></div>
        <div class="field"><label for="m-treatment">Treatment</label><textarea id="m-treatment" maxlength="600"></textarea><span class="error" role="alert"></span></div>
        <div class="field"><label for="m-followup">Follow-up</label><input id="m-followup" type="text" placeholder="Review in 4 weeks" /><span class="error" role="alert"></span></div>
        <p style="margin:0;font-size:.86rem;color:var(--ink-soft)">Clinical notes are sanitised and encrypted with AES-256-GCM before being written to IndexedDB.</p>`;

      const patientSelect = form.querySelector("#m-patient");
      [...patients].sort((a, b) => a.lastName.localeCompare(b.lastName)).forEach((patient) => {
        const option = document.createElement("option");
        option.value = patient.id;
        option.textContent = `${patient.lastName}, ${patient.firstName} — ${patient.nhsNumber}`;
        patientSelect.appendChild(option);
      });
      form.querySelector("#m-date").value = CMS.todayISO();
      if (patientId) patientSelect.value = patientId;
      if (existing) {
        patientSelect.value = existing.patientId;
        patientSelect.disabled = true;
        form.querySelector("#m-date").value = existing.date;
        form.querySelector("#m-diagnosis").value = existing.diagnosis || "";
        form.querySelector("#m-notes").value = existing.notes || "";
        form.querySelector("#m-treatment").value = existing.treatment || "";
        form.querySelector("#m-followup").value = existing.followUp || "";
      }

      CMS.openModal(existing ? "Edit medical record" : "New medical record", form, [
        { label: "Cancel", className: "btn-ghost", onClick: (close) => close() },
        {
          label: existing ? "Save record" : "Save record",
          className: "btn-primary",
          onClick: async (close) => {
            const get = (id) => form.querySelector(id).value;
            const ok = CMS_Validate.apply({
              "m-patient": CMS_Validate.required(patientSelect.value, "Patient"),
              "m-date": CMS_Validate.required(get("#m-date"), "Date"),
              "m-diagnosis": CMS_Validate.minLength(get("#m-diagnosis"), 3, "Diagnosis"),
              "m-notes": CMS_Validate.minLength(get("#m-notes"), 10, "Medical notes"),
              "m-treatment": CMS_Validate.minLength(get("#m-treatment"), 4, "Treatment"),
            });
            if (!ok) return;

            const payload = {
              date: get("#m-date"),
              diagnosis: CMS_Security.sanitise(get("#m-diagnosis")),
              notes: CMS_Security.sanitise(get("#m-notes")),
              treatment: CMS_Security.sanitise(get("#m-treatment")),
              followUp: CMS_Security.sanitise(get("#m-followup")),
            };

            try {
              const encrypted = await CMS_Encryption.encryptFields(payload, CMS_Encryption_FIELDS.medicalRecords);
              if (existing) {
                await CMS_DB.updateRecord("medicalRecords", existing.id, encrypted);
                await CMS_DB.log("RECORD_UPDATED", existing.id);
              } else {
                await CMS_DB.addRecord("medicalRecords", {
                  id: CMS_Data.nextId("MR"),
                  patientId: patientSelect.value,
                  doctorId: profile.id,
                  createdAt: new Date().toISOString(),
                  ...encrypted,
                });
                await CMS_DB.log("RECORD_CREATED", patientSelect.value);
              }
              close();
              CMS.toast("Medical record saved successfully.", "success");
              rows = await load();
              draw();
            } catch (error) {
              console.error(error);
              CMS.toast("Something went wrong.", "error");
            }
          },
        },
      ]);
    }
  },
});
