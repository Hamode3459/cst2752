/* =========================================================
   prescriptions.js — prescription requests and review
   Patient: request a prescription, view own medication
   Doctor:  review requests, issue and update prescriptions
   Admin:   read-only oversight of all prescriptions
   ========================================================= */

CMS.bootDashboard({
  roles: [CMS_Auth.ROLES.PATIENT, CMS_Auth.ROLES.DOCTOR, CMS_Auth.ROLES.ADMIN],
  title: "Prescriptions",
  active: "prescriptions.html",
  render: async (session, content) => {
    const { PATIENT, DOCTOR, ADMIN } = CMS_Auth.ROLES;
    const profile = await CMS_Auth.currentProfile();
    const [patients, doctors] = await Promise.all([
      session.role === PATIENT ? Promise.resolve([]) : CMS_Data.patients(),
      CMS_Data.doctors(),
    ]);
    const patientMap = CMS_Data.indexById(patients);
    const doctorMap = CMS_Data.indexById(doctors);
    const filter = session.role === PATIENT ? { patientId: profile.id } : session.role === DOCTOR ? { doctorId: profile.id } : {};

    async function load() {
      return (await CMS_Data.prescriptions(filter)).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
    }
    let rows = await load();

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const statusFilter = document.createElement("select");
    statusFilter.setAttribute("aria-label", "Filter by status");
    [["", "All statuses"], ["Requested", "Requested"], ["Approved", "Approved"], ["Active", "Active"], ["Completed", "Completed"], ["Rejected", "Rejected"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      statusFilter.appendChild(option);
    });
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search medicine or patient";
    search.setAttribute("aria-label", "Search prescriptions");
    toolbar.append(statusFilter, search);

    if (session.role === PATIENT) {
      const requestBtn = document.createElement("button");
      requestBtn.type = "button";
      requestBtn.className = "btn btn-primary btn-sm";
      requestBtn.textContent = "Request prescription";
      requestBtn.addEventListener("click", openRequestForm);
      toolbar.appendChild(requestBtn);
      if (location.hash === "#request") setTimeout(openRequestForm, 200);
    }
    if (session.role === DOCTOR) {
      const issueBtn = document.createElement("button");
      issueBtn.type = "button";
      issueBtn.className = "btn btn-primary btn-sm";
      issueBtn.textContent = "Issue prescription";
      issueBtn.addEventListener("click", () => openIssueForm());
      toolbar.appendChild(issueBtn);
      if (location.hash === "#new") setTimeout(() => openIssueForm(new URLSearchParams(location.search).get("patient")), 200);
    }

    const tableHost = document.createElement("div");
    content.appendChild(CMS.panel("Prescriptions", tableHost, toolbar));

    async function setStatus(row, status) {
      try {
        await CMS_DB.updateRecord("prescriptions", row.id, { status });
        await CMS_DB.log("PRESCRIPTION_STATUS", `${row.id} -> ${status}`);
        CMS.toast(`Prescription ${status.toLowerCase()}.`, "success");
        rows = await load();
        draw();
      } catch (error) {
        console.error(error);
        CMS.toast("Something went wrong.", "error");
      }
    }

    function actionsFor(row) {
      const buttons = [];
      if (session.role === DOCTOR) {
        if (row.status === "Requested") {
          buttons.push({ label: "Review & approve", className: "btn-primary", onClick: () => openIssueForm(row.patientId, row) });
          buttons.push({ label: "Reject", className: "btn-ghost", onClick: () => setStatus(row, "Rejected") });
        }
        if (row.status === "Approved") buttons.push({ label: "Mark active", className: "btn-secondary", onClick: () => setStatus(row, "Active") });
        if (row.status === "Active") buttons.push({ label: "Complete", className: "btn-secondary", onClick: () => setStatus(row, "Completed") });
      }
      return buttons.length ? CMS.actionGroup(buttons) : document.createTextNode("—");
    }

    function draw() {
      const query = search.value.toLowerCase().trim();
      const status = statusFilter.value;
      const visible = rows.filter((row) => {
        if (status && row.status !== status) return false;
        if (!query) return true;
        const patient = patientMap.get(row.patientId);
        return [row.medicine, patient ? CMS.personName(patient) : ""].join(" ").toLowerCase().includes(query);
      });

      const columns = [];
      if (session.role !== PATIENT) columns.push({ label: "Patient", get: (r) => CMS.personName(patientMap.get(r.patientId)) });
      columns.push(
        { label: "Medicine", get: (r) => r.medicine },
        { label: "Dosage", get: (r) => r.dosage || "—" },
        { label: "Frequency", get: (r) => r.frequency || "—" },
        { label: "Instructions", get: (r) => r.instructions || "—" },
        { label: "Start", get: (r) => CMS.formatDate(r.startDate) },
        { label: "End", get: (r) => CMS.formatDate(r.endDate) }
      );
      if (session.role === PATIENT) columns.push({ label: "Doctor", get: (r) => CMS.doctorName(doctorMap.get(r.doctorId)) });
      columns.push({ label: "Status", get: (r) => CMS.badge(r.status) }, { label: "Actions", get: actionsFor });

      tableHost.replaceChildren(CMS.buildTable(columns, visible.slice(0, 60), "No prescriptions found."));
      const pager = document.createElement("div");
      pager.className = "pager";
      pager.appendChild(CMS_Security.text("span", `Showing ${Math.min(visible.length, 60)} of ${visible.length} prescriptions`));
      tableHost.appendChild(pager);
    }

    search.addEventListener("input", draw);
    statusFilter.addEventListener("change", draw);
    draw();

    /* ---------------- Patient request ---------------- */
    function openRequestForm() {
      const form = document.createElement("form");
      form.className = "form-grid";
      form.noValidate = true;
      form.innerHTML = `
        <div class="field"><label for="r-doctor">Doctor</label><select id="r-doctor"></select><span class="error" role="alert"></span></div>
        <div class="field"><label for="r-medicine">Medicine</label><input id="r-medicine" type="text" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="r-reason">Reason for request</label><input id="r-reason" type="text" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="r-info">Additional information</label><textarea id="r-info" maxlength="400"></textarea><span class="error" role="alert"></span></div>
        <p style="margin:0;font-size:.86rem;color:var(--ink-soft)">Requests are reviewed by a doctor. No medicine is issued automatically.</p>`;

      const doctorSelect = form.querySelector("#r-doctor");
      [...doctors].sort((a, b) => a.lastName.localeCompare(b.lastName)).forEach((doctor) => {
        const option = document.createElement("option");
        option.value = doctor.id;
        option.textContent = `${CMS.doctorName(doctor)} — ${doctor.speciality}`;
        doctorSelect.appendChild(option);
      });

      CMS.openModal("Request a prescription", form, [
        { label: "Cancel", className: "btn-ghost", onClick: (close) => close() },
        {
          label: "Submit request",
          className: "btn-primary",
          onClick: async (close) => {
            const medicine = form.querySelector("#r-medicine").value;
            const reason = form.querySelector("#r-reason").value;
            const info = form.querySelector("#r-info").value;
            const ok = CMS_Validate.apply({
              "r-medicine": CMS_Validate.minLength(medicine, 3, "Medicine"),
              "r-reason": CMS_Validate.minLength(reason, 4, "Reason"),
            });
            if (!ok) return;
            try {
              const record = await CMS_Encryption.encryptFields(
                {
                  id: CMS_Data.nextId("RX"),
                  patientId: profile.id,
                  doctorId: doctorSelect.value,
                  medicine: CMS_Security.sanitise(medicine),
                  dosage: "",
                  frequency: "",
                  instructions: `Patient request — ${CMS_Security.sanitise(reason)}. ${CMS_Security.sanitise(info)}`.trim(),
                  startDate: CMS.todayISO(),
                  endDate: "",
                  status: "Requested",
                  createdAt: new Date().toISOString(),
                },
                CMS_Encryption_FIELDS.prescriptions
              );
              await CMS_DB.addRecord("prescriptions", record);
              await CMS_DB.log("PRESCRIPTION_REQUESTED", record.id);
              close();
              CMS.toast("Prescription request submitted.", "success");
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

    /* ---------------- Doctor issue / approve ---------------- */
    function openIssueForm(patientId, existing) {
      const form = document.createElement("form");
      form.className = "form-grid two";
      form.noValidate = true;
      form.innerHTML = `
        <div class="field" style="grid-column:1/-1"><label for="i-patient">Patient</label><select id="i-patient"></select><span class="error" role="alert"></span></div>
        <div class="field"><label for="i-medicine">Medicine</label><input id="i-medicine" type="text" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="i-dosage">Dosage</label><input id="i-dosage" type="text" placeholder="500mg" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="i-frequency">Frequency</label><input id="i-frequency" type="text" placeholder="Twice daily" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="i-start">Start date</label><input id="i-start" type="date" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="i-end">End date</label><input id="i-end" type="date" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="i-status">Status</label><select id="i-status"><option>Approved</option><option>Active</option><option>Completed</option></select><span class="error" role="alert"></span></div>
        <div class="field" style="grid-column:1/-1"><label for="i-instructions">Instructions</label><textarea id="i-instructions" maxlength="500"></textarea><span class="error" role="alert"></span></div>`;

      const patientSelect = form.querySelector("#i-patient");
      [...patients].sort((a, b) => a.lastName.localeCompare(b.lastName)).forEach((patient) => {
        const option = document.createElement("option");
        option.value = patient.id;
        option.textContent = `${patient.lastName}, ${patient.firstName} — ${patient.nhsNumber}`;
        patientSelect.appendChild(option);
      });
      if (patientId) patientSelect.value = patientId;
      form.querySelector("#i-start").value = CMS.todayISO();
      if (existing) {
        form.querySelector("#i-medicine").value = existing.medicine || "";
        form.querySelector("#i-instructions").value = existing.instructions || "";
        patientSelect.value = existing.patientId;
        patientSelect.disabled = true;
      }

      CMS.openModal(existing ? "Review prescription request" : "Issue a prescription", form, [
        { label: "Cancel", className: "btn-ghost", onClick: (close) => close() },
        {
          label: existing ? "Approve prescription" : "Issue prescription",
          className: "btn-primary",
          onClick: async (close) => {
            const get = (id) => form.querySelector(id).value;
            const ok = CMS_Validate.apply({
              "i-patient": CMS_Validate.required(patientSelect.value, "Patient"),
              "i-medicine": CMS_Validate.minLength(get("#i-medicine"), 3, "Medicine"),
              "i-dosage": CMS_Validate.required(get("#i-dosage"), "Dosage"),
              "i-frequency": CMS_Validate.required(get("#i-frequency"), "Frequency"),
              "i-start": CMS_Validate.required(get("#i-start"), "Start date"),
              "i-instructions": CMS_Validate.minLength(get("#i-instructions"), 8, "Instructions"),
            });
            if (!ok) return;

            const payload = {
              medicine: CMS_Security.sanitise(get("#i-medicine")),
              dosage: CMS_Security.sanitise(get("#i-dosage")),
              frequency: CMS_Security.sanitise(get("#i-frequency")),
              instructions: CMS_Security.sanitise(get("#i-instructions")),
              startDate: get("#i-start"),
              endDate: get("#i-end"),
              status: get("#i-status"),
            };

            try {
              const encrypted = await CMS_Encryption.encryptFields(payload, CMS_Encryption_FIELDS.prescriptions);
              if (existing) {
                await CMS_DB.updateRecord("prescriptions", existing.id, encrypted);
                await CMS_DB.log("PRESCRIPTION_APPROVED", existing.id);
                CMS.toast("Prescription approved and updated.", "success");
              } else {
                await CMS_DB.addRecord("prescriptions", {
                  id: CMS_Data.nextId("RX"),
                  patientId: patientSelect.value,
                  doctorId: profile.id,
                  createdAt: new Date().toISOString(),
                  ...encrypted,
                });
                await CMS_DB.log("PRESCRIPTION_ISSUED", patientSelect.value);
                CMS.toast("Prescription issued successfully.", "success");
              }
              close();
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
