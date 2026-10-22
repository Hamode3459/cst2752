/* =========================================================
   admin.js — administrator dashboard and database tools
   ========================================================= */

CMS.bootDashboard({
  roles: [CMS_Auth.ROLES.ADMIN],
  title: "Administrator Dashboard",
  active: "admin.html",
  render: async (session, content) => {
    const [patients, doctors, appointments, prescriptions, records, audit] = await Promise.all([
      CMS_Data.patients(),
      CMS_Data.doctors(),
      CMS_Data.appointments(),
      CMS_Data.prescriptions(),
      CMS_Data.medicalRecords(),
      CMS_DB.getAllRecords("auditLog"),
    ]);
    const patientMap = CMS_Data.indexById(patients);
    const doctorMap = CMS_Data.indexById(doctors);
    const today = CMS.todayISO();

    const stats = document.createElement("div");
    stats.className = "stat-grid";
    stats.append(
      CMS.statCard("Total patients", patients.length, "Registered in the system"),
      CMS.statCard("Total doctors", doctors.length, "Across all specialities"),
      CMS.statCard("Today's appointments", appointments.filter((a) => a.date === today).length, CMS.formatDate(today)),
      CMS.statCard("Pending prescription requests", prescriptions.filter((p) => p.status === "Requested").length, "Awaiting doctor review")
    );

    /* ---------- Recent patients ---------- */
    const recentPatients = [...patients].slice(-8).reverse();
    const patientsPanel = CMS.panel(
      "Recently added patients",
      CMS.buildTable(
        [
          { label: "Name", get: (r) => `${r.firstName} ${r.lastName}` },
          { label: "Date of birth", get: (r) => CMS.formatDate(r.dateOfBirth) },
          { label: "NHS number", get: (r) => r.nhsNumber },
          { label: "Telephone", get: (r) => r.telephone },
          { label: "Email", get: (r) => r.email },
          {
            label: "Actions",
            get: (r) =>
              CMS.actionGroup([
                { label: "View", className: "btn-secondary", onClick: () => { window.location.href = `patients.html?id=${encodeURIComponent(r.id)}`; } },
              ]),
          },
        ],
        recentPatients
      ),
      (() => {
        const link = document.createElement("a");
        link.className = "btn btn-primary btn-sm";
        link.href = "patients.html";
        link.textContent = "Manage all patients";
        return link;
      })()
    );

    /* ---------- Today's schedule ---------- */
    const schedule = CMS.panel(
      "Today's schedule",
      CMS.buildTable(
        [
          { label: "Time", get: (r) => r.time },
          { label: "Patient", get: (r) => CMS.personName(patientMap.get(r.patientId)) },
          { label: "Doctor", get: (r) => CMS.doctorName(doctorMap.get(r.doctorId)) },
          { label: "Reason", get: (r) => r.reason },
          { label: "Status", get: (r) => CMS.badge(r.status) },
        ],
        appointments.filter((a) => a.date === today).sort((a, b) => a.time.localeCompare(b.time)),
        "No appointments scheduled today."
      )
    );

    /* ---------- Database tools ---------- */
    const tools = document.createElement("div");
    tools.className = "panel-body";
    tools.appendChild(
      CMS_Security.text(
        "p",
        `Database: ClinicalManagementDB (version ${CMS_DB.DB_VERSION}) — ${patients.length} patients, ${doctors.length} doctors, ${appointments.length} appointments, ${prescriptions.length} prescriptions, ${records.length} medical records.`
      )
    );
    const toolRow = document.createElement("div");
    toolRow.style.display = "flex";
    toolRow.style.gap = ".6rem";
    toolRow.style.flexWrap = "wrap";

    const reload = document.createElement("button");
    reload.type = "button";
    reload.className = "btn btn-secondary";
    reload.textContent = "Load Demo Data";
    reload.addEventListener("click", async () => {
      try {
        const result = await CMS_Seed.loadDemoData();
        CMS.toast(result.skipped ? "Demo data is already loaded." : "Demo data loaded successfully.", result.skipped ? "info" : "success");
        if (!result.skipped) setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        console.error(error);
        CMS.toast("Something went wrong.", "error");
      }
    });

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn btn-danger";
    reset.textContent = "Reset Demo Database";
    reset.addEventListener("click", async () => {
      const confirmed = await CMS.confirmAction(
        "This deletes the entire local demonstration database and reloads the fictional JSON data. Continue?",
        "Reset database"
      );
      if (!confirmed) return;
      CMS.toast("Rebuilding the demonstration database…", "warn");
      try {
        await CMS_Seed.resetDemoDatabase();
        CMS.toast("Demo database reset successfully.", "success");
        setTimeout(() => window.location.reload(), 900);
      } catch (error) {
        console.error(error);
        CMS.toast("Something went wrong.", "error");
      }
    });

    toolRow.append(reload, reset);
    tools.appendChild(toolRow);

    /* ---------- Audit log ---------- */
    const auditPanel = CMS.panel(
      "Recent activity log",
      CMS.buildTable(
        [
          { label: "Time", get: (r) => new Date(r.at).toLocaleString("en-GB") },
          { label: "Action", get: (r) => r.action },
          { label: "Detail", get: (r) => r.detail || "—" },
          { label: "User", get: (r) => r.userId },
        ],
        [...audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12),
        "No activity recorded yet."
      )
    );

    content.append(stats, patientsPanel, schedule, CMS.panel("Database tools", tools), auditPanel);
  },
});
