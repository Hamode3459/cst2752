/* =========================================================
   patients.js — patient directory, CRUD and patient history
   Admin: full create / read / update / delete
   Doctor: search, view profile and full clinical history
   ========================================================= */

CMS.bootDashboard({
  roles: [CMS_Auth.ROLES.ADMIN, CMS_Auth.ROLES.DOCTOR],
  title: "Patients",
  active: "patients.html",
  render: async (session, content) => {
    const isAdmin = session.role === CMS_Auth.ROLES.ADMIN;
    const doctors = await CMS_Data.doctors();
    const doctorMap = CMS_Data.indexById(doctors);
    let patients = await CMS_Data.patients();

    const requestedId = new URLSearchParams(location.search).get("id");
    if (requestedId) {
      const patient = patients.find((p) => p.id === requestedId);
      if (patient) {
        await renderHistory(patient);
        return;
      }
      CMS.toast("Patient not found.", "error");
    }

    renderDirectory();

    /* ---------------- Directory ---------------- */
    function renderDirectory() {
      content.replaceChildren();

      const toolbar = document.createElement("div");
      toolbar.className = "toolbar";
      const search = document.createElement("input");
      search.type = "search";
      search.id = "patient-search";
      search.placeholder = "Search name, NHS number or email";
      search.setAttribute("aria-label", "Search patients");
      const sort = document.createElement("select");
      sort.setAttribute("aria-label", "Sort patients");
      [["lastName", "Sort by surname"], ["firstName", "Sort by first name"], ["dateOfBirth", "Sort by date of birth"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        sort.appendChild(option);
      });
      toolbar.append(search, sort);

      if (isAdmin) {
        const add = document.createElement("button");
        add.type = "button";
        add.className = "btn btn-primary btn-sm";
        add.textContent = "Add patient";
        add.addEventListener("click", () => openPatientForm());
        toolbar.appendChild(add);
      }

      const tableHost = document.createElement("div");
      const panel = CMS.panel(`Patient directory (${patients.length})`, tableHost, toolbar);
      content.appendChild(panel);

      const draw = () => {
        const query = search.value;
        const rows = patients
          .filter((p) => CMS_Data.matchesPatient(p, query))
          .sort((a, b) => String(a[sort.value]).localeCompare(String(b[sort.value])));

        const columns = [
          { label: "Name", get: (r) => `${r.firstName} ${r.lastName}` },
          { label: "Date of birth", get: (r) => CMS.formatDate(r.dateOfBirth) },
          { label: "NHS number", get: (r) => r.nhsNumber },
          { label: "Telephone", get: (r) => r.telephone },
          { label: "Email", get: (r) => r.email },
          {
            label: "Actions",
            get: (r) => {
              const buttons = [{ label: "View", className: "btn-secondary", onClick: () => renderHistory(r) }];
              if (isAdmin) {
                buttons.push({ label: "Edit", className: "btn-secondary", onClick: () => openPatientForm(r) });
                buttons.push({ label: "Delete", className: "btn-danger", onClick: () => deletePatient(r) });
              }
              return CMS.actionGroup(buttons);
            },
          },
        ];

        tableHost.replaceChildren(CMS.buildTable(columns, rows.slice(0, 50), "No patients match your search."));
        const pager = document.createElement("div");
        pager.className = "pager";
        pager.appendChild(CMS_Security.text("span", `Showing ${Math.min(rows.length, 50)} of ${rows.length} matching patients`));
        tableHost.appendChild(pager);
      };

      search.addEventListener("input", draw);
      sort.addEventListener("change", draw);
      draw();
    }

    /* ---------------- Patient history ---------------- */
    async function renderHistory(patient) {
      content.replaceChildren();
      const [records, prescriptions, appointments] = await Promise.all([
        CMS_Data.medicalRecords({ patientId: patient.id }),
        CMS_Data.prescriptions({ patientId: patient.id }),
        CMS_Data.appointments({ patientId: patient.id }),
      ]);

      const back = document.createElement("button");
      back.type = "button";
      back.className = "btn btn-ghost btn-sm";
      back.textContent = "← Back to patient directory";
      back.addEventListener("click", () => { history.replaceState(null, "", "patients.html"); renderDirectory(); });
      content.appendChild(back);

      const detailsBody = document.createElement("div");
      detailsBody.className = "panel-body";
      const kv = document.createElement("dl");
      kv.className = "kv";
      [
        ["Name", `${patient.firstName} ${patient.lastName}`],
        ["Date of birth", `${CMS.formatDate(patient.dateOfBirth)} (age ${CMS.age(patient.dateOfBirth)})`],
        ["NHS number", patient.nhsNumber],
        ["Address", patient.address],
        ["Telephone", patient.telephone],
        ["Email", patient.email],
        ["Emergency contact", patient.emergencyContact || "—"],
      ].forEach(([label, value]) => kv.append(CMS_Security.text("dt", label), CMS_Security.text("dd", value || "—")));
      detailsBody.appendChild(kv);

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem";
      if (session.role === CMS_Auth.ROLES.DOCTOR) {
        const addRecord = document.createElement("a");
        addRecord.className = "btn btn-primary btn-sm";
        addRecord.href = `medical-records.html?patient=${encodeURIComponent(patient.id)}#new`;
        addRecord.textContent = "Add medical record";
        const addRx = document.createElement("a");
        addRx.className = "btn btn-secondary btn-sm";
        addRx.href = `prescriptions.html?patient=${encodeURIComponent(patient.id)}#new`;
        addRx.textContent = "Issue prescription";
        actions.append(addRecord, addRx);
      }
      if (isAdmin) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "btn btn-secondary btn-sm";
        edit.textContent = "Edit patient";
        edit.addEventListener("click", () => openPatientForm(patient));
        actions.appendChild(edit);
      }
      detailsBody.appendChild(actions);

      const timeline = document.createElement("div");
      timeline.className = "panel-body";
      const list = document.createElement("div");
      list.className = "timeline";
      const sorted = [...records].sort(CMS.byDateDesc);
      if (!sorted.length) list.appendChild(CMS_Security.text("p", "No medical history recorded."));
      sorted.forEach((record) => {
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
        list.appendChild(item);
      });
      timeline.appendChild(list);

      content.append(
        CMS.panel("Patient details", detailsBody),
        CMS.panel("Medical history", timeline),
        CMS.panel(
          "Prescriptions",
          CMS.buildTable(
            [
              { label: "Medicine", get: (r) => r.medicine },
              { label: "Dosage", get: (r) => r.dosage },
              { label: "Frequency", get: (r) => r.frequency },
              { label: "Instructions", get: (r) => r.instructions },
              { label: "Start", get: (r) => CMS.formatDate(r.startDate) },
              { label: "End", get: (r) => CMS.formatDate(r.endDate) },
              { label: "Status", get: (r) => CMS.badge(r.status) },
            ],
            prescriptions,
            "No prescriptions recorded."
          )
        ),
        CMS.panel(
          "Appointments",
          CMS.buildTable(
            [
              { label: "Date", get: (r) => CMS.formatDate(r.date) },
              { label: "Time", get: (r) => r.time },
              { label: "Doctor", get: (r) => CMS.doctorName(doctorMap.get(r.doctorId)) },
              { label: "Reason", get: (r) => r.reason },
              { label: "Status", get: (r) => CMS.badge(r.status) },
            ],
            [...appointments].sort(CMS.byDateDesc),
            "No appointments recorded."
          )
        )
      );
    }

    /* ---------------- Create / update (admin only) ---------------- */
    function openPatientForm(existing) {
      if (!isAdmin) return;
      const form = document.createElement("form");
      form.className = "form-grid two";
      form.noValidate = true;
      form.innerHTML = `
        <div class="field"><label for="f-first">First name</label><input id="f-first" type="text" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="f-last">Last name</label><input id="f-last" type="text" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="f-dob">Date of birth</label><input id="f-dob" type="date" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="f-nhs">NHS number</label><input id="f-nhs" type="text" placeholder="123 456 7890" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="f-phone">Telephone</label><input id="f-phone" type="tel" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="f-email">Email</label><input id="f-email" type="email" /><span class="error" role="alert"></span></div>
        <div class="field" style="grid-column:1/-1"><label for="f-address">Address</label><input id="f-address" type="text" /><span class="error" role="alert"></span></div>
        <div class="field" style="grid-column:1/-1"><label for="f-emergency">Emergency contact</label><input id="f-emergency" type="text" /><span class="error" role="alert"></span></div>`;

      const set = (id, value) => { form.querySelector(id).value = value || ""; };
      if (existing) {
        set("#f-first", existing.firstName); set("#f-last", existing.lastName);
        set("#f-dob", existing.dateOfBirth); set("#f-nhs", existing.nhsNumber);
        set("#f-phone", existing.telephone); set("#f-email", existing.email);
        set("#f-address", existing.address); set("#f-emergency", existing.emergencyContact);
      }

      CMS.openModal(existing ? "Edit patient" : "Add patient", form, [
        { label: "Cancel", className: "btn-ghost", onClick: (close) => close() },
        {
          label: existing ? "Save changes" : "Add patient",
          className: "btn-primary",
          onClick: async (close) => {
            const get = (id) => form.querySelector(id).value;
            const ok = CMS_Validate.apply({
              "f-first": CMS_Validate.name(get("#f-first"), "First name"),
              "f-last": CMS_Validate.name(get("#f-last"), "Last name"),
              "f-dob": CMS_Validate.dateOfBirth(get("#f-dob")),
              "f-nhs": CMS_Validate.nhsNumber(get("#f-nhs")),
              "f-phone": CMS_Validate.telephone(get("#f-phone")),
              "f-email": CMS_Validate.email(get("#f-email")),
              "f-address": CMS_Validate.minLength(get("#f-address"), 6, "Address"),
            });
            if (!ok) return;

            const clean = {
              firstName: CMS_Security.sanitise(get("#f-first")),
              lastName: CMS_Security.sanitise(get("#f-last")),
              dateOfBirth: get("#f-dob"),
              nhsNumber: CMS_Security.sanitise(get("#f-nhs")),
              telephone: CMS_Security.sanitise(get("#f-phone")),
              email: CMS_Security.sanitise(get("#f-email")).toLowerCase(),
              address: CMS_Security.sanitise(get("#f-address")),
              emergencyContact: CMS_Security.sanitise(get("#f-emergency")),
            };
            clean.lastNameSearch = clean.lastName.toLowerCase();
            clean.emailSearch = clean.email;
            clean.nhsSearch = clean.nhsNumber.replace(/\s/g, "");

            try {
              const encrypted = await CMS_Encryption.encryptFields(clean, CMS_Encryption_FIELDS.patients);
              if (existing) {
                await CMS_DB.updateRecord("patients", existing.id, encrypted);
                await CMS_DB.log("PATIENT_UPDATED", existing.id);
                CMS.toast("Patient successfully updated.", "success");
              } else {
                const id = CMS_Data.nextId("P");
                const userId = `U-${id}`;
                await CMS_DB.putRecord("users", {
                  id: userId,
                  email: clean.email,
                  passwordHash: await CMS_Security.hashPassword("PatientDemo!12345"),
                  role: CMS_Auth.ROLES.PATIENT,
                  createdAt: new Date().toISOString(),
                });
                await CMS_DB.addRecord("patients", { id, userId, createdAt: new Date().toISOString(), ...encrypted });
                await CMS_DB.log("PATIENT_CREATED", id);
                CMS.toast("Patient added successfully. Demo password: PatientDemo!12345", "success");
              }
              close();
              patients = await CMS_Data.patients();
              renderDirectory();
            } catch (error) {
              console.error(error);
              CMS.toast("Something went wrong.", "error");
            }
          },
        },
      ]);
    }

    /* ---------------- Delete (admin only) ---------------- */
    async function deletePatient(patient) {
      const confirmed = await CMS.confirmAction(
        `Are you sure you want to delete ${patient.firstName} ${patient.lastName}? Their appointments, prescriptions and medical records will also be removed.`
      );
      if (!confirmed) return;
      try {
        const [appointments, prescriptions, records] = await Promise.all([
          CMS_DB.getByIndex("appointments", "patientId", patient.id),
          CMS_DB.getByIndex("prescriptions", "patientId", patient.id),
          CMS_DB.getByIndex("medicalRecords", "patientId", patient.id),
        ]);
        for (const row of appointments) await CMS_DB.deleteRecord("appointments", row.id);
        for (const row of prescriptions) await CMS_DB.deleteRecord("prescriptions", row.id);
        for (const row of records) await CMS_DB.deleteRecord("medicalRecords", row.id);
        await CMS_DB.deleteRecord("patients", patient.id);
        if (patient.userId) await CMS_DB.deleteRecord("users", patient.userId);
        await CMS_DB.log("PATIENT_DELETED", patient.id);
        CMS.toast("Patient deleted successfully.", "success");
        patients = await CMS_Data.patients();
        renderDirectory();
      } catch (error) {
        console.error(error);
        CMS.toast("Something went wrong.", "error");
      }
    }
  },
});
