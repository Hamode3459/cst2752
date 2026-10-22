/* =========================================================
   doctor.js — doctor dashboard
   Doctors see their own caseload and may add clinical data.
   ========================================================= */

CMS.bootDashboard({
  roles: [CMS_Auth.ROLES.DOCTOR],
  title: "Doctor Dashboard",
  active: "doctor.html",
  render: async (session, content) => {
    const profile = await CMS_Auth.currentProfile();
    if (!profile) {
      content.appendChild(CMS.loading("Your clinician profile could not be found."));
      return;
    }

    const [appointments, prescriptions, records, patients] = await Promise.all([
      CMS_Data.appointments({ doctorId: profile.id }),
      CMS_Data.prescriptions({ doctorId: profile.id }),
      CMS_Data.medicalRecords({ doctorId: profile.id }),
      CMS_Data.patients(),
    ]);
    const patientMap = CMS_Data.indexById(patients);
    const today = CMS.todayISO();

    const todays = appointments.filter((a) => a.date === today).sort((a, b) => a.time.localeCompare(b.time));
    const upcoming = appointments.filter((a) => a.date > today && a.status !== "Cancelled").sort(CMS.byDateAsc);
    const pendingRx = prescriptions.filter((p) => p.status === "Requested");

    const header = document.createElement("section");
    header.className = "panel";
    const headerBody = document.createElement("div");
    headerBody.className = "panel-body";
    headerBody.append(
      CMS_Security.text("h2", `Good day, Dr ${profile.lastName}.`),
      CMS_Security.text("p", `${profile.speciality} · ${profile.doctorNumber}`)
    );
    header.appendChild(headerBody);

    const stats = document.createElement("div");
    stats.className = "stat-grid";
    stats.append(
      CMS.statCard("Today's appointments", todays.length, CMS.formatDate(today)),
      CMS.statCard("Upcoming appointments", upcoming.length, "Next 30 days and beyond"),
      CMS.statCard("Prescription requests", pendingRx.length, "Awaiting your review"),
      CMS.statCard("Records authored", records.length, "Clinical entries")
    );

    /* ---------- Appointment actions ---------- */
    function appointmentActions(row) {
      const buttons = [];
      if (row.status === "Requested") {
        buttons.push({ label: "Confirm", className: "btn-primary", onClick: () => setStatus(row, "Confirmed") });
      }
      if (["Requested", "Confirmed"].includes(row.status)) {
        buttons.push({ label: "Complete", className: "btn-secondary", onClick: () => setStatus(row, "Completed") });
        buttons.push({ label: "Cancel", className: "btn-ghost", onClick: () => setStatus(row, "Cancelled") });
      }
      buttons.push({
        label: "Patient history",
        className: "btn-ghost",
        onClick: () => { window.location.href = `patients.html?id=${encodeURIComponent(row.patientId)}`; },
      });
      return CMS.actionGroup(buttons);
    }

    async function setStatus(row, status) {
      try {
        await CMS_DB.updateRecord("appointments", row.id, { status });
        await CMS_DB.log("APPOINTMENT_STATUS", `${row.id} -> ${status}`);
        CMS.toast(`Appointment marked as ${status.toLowerCase()}.`, "success");
        setTimeout(() => window.location.reload(), 600);
      } catch (error) {
        console.error(error);
        CMS.toast("Something went wrong.", "error");
      }
    }

    const columns = [
      { label: "Date", get: (r) => CMS.formatDate(r.date) },
      { label: "Time", get: (r) => r.time },
      { label: "Patient", get: (r) => CMS.personName(patientMap.get(r.patientId)) },
      { label: "Reason", get: (r) => r.reason },
      { label: "Status", get: (r) => CMS.badge(r.status) },
      { label: "Actions", get: appointmentActions },
    ];

    /* ---------- Prescription requests ---------- */
    async function updateRx(row, status) {
      try {
        await CMS_DB.updateRecord("prescriptions", row.id, { status });
        await CMS_DB.log("PRESCRIPTION_STATUS", `${row.id} -> ${status}`);
        CMS.toast(`Prescription ${status.toLowerCase()}.`, "success");
        setTimeout(() => window.location.reload(), 600);
      } catch (error) {
        console.error(error);
        CMS.toast("Something went wrong.", "error");
      }
    }

    const rxTable = CMS.buildTable(
      [
        { label: "Patient", get: (r) => CMS.personName(patientMap.get(r.patientId)) },
        { label: "Medicine", get: (r) => r.medicine },
        { label: "Requested", get: (r) => CMS.formatDate(r.startDate) },
        { label: "Notes", get: (r) => r.instructions },
        { label: "Status", get: (r) => CMS.badge(r.status) },
        {
          label: "Actions",
          get: (r) =>
            CMS.actionGroup([
              { label: "Approve", className: "btn-primary", onClick: () => updateRx(r, "Approved") },
              { label: "Reject", className: "btn-ghost", onClick: () => updateRx(r, "Rejected") },
            ]),
        },
      ],
      pendingRx,
      "No prescription requests awaiting review."
    );

    const newRecordBtn = document.createElement("button");
    newRecordBtn.type = "button";
    newRecordBtn.className = "btn btn-primary btn-sm";
    newRecordBtn.textContent = "Add medical record";
    newRecordBtn.addEventListener("click", () => { window.location.href = "medical-records.html#new"; });

    content.append(
      header,
      stats,
      CMS.panel("Today's clinic", CMS.buildTable(columns, todays, "No appointments scheduled for today."), newRecordBtn),
      CMS.panel("Upcoming appointments", CMS.buildTable(columns, upcoming.slice(0, 10), "No upcoming appointments.")),
      CMS.panel("Prescription requests to review", rxTable)
    );
  },
});
