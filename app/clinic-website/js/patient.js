/* =========================================================
   patient.js — patient dashboard
   Patients may only ever see their own data.
   ========================================================= */

CMS.bootDashboard({
  roles: [CMS_Auth.ROLES.PATIENT],
  title: "Patient Dashboard",
  active: "patient.html",
  render: async (session, content) => {
    const profile = await CMS_Auth.currentProfile();
    if (!profile) {
      content.appendChild(CMS.loading("Your patient profile could not be found."));
      return;
    }

    const [appointments, prescriptions, records, doctors] = await Promise.all([
      CMS_Data.appointments({ patientId: profile.id }),
      CMS_Data.prescriptions({ patientId: profile.id }),
      CMS_Data.medicalRecords({ patientId: profile.id }),
      CMS_Data.doctors(),
    ]);
    const doctorMap = CMS_Data.indexById(doctors);
    const today = CMS.todayISO();

    const upcoming = appointments
      .filter((a) => a.date >= today && ["Requested", "Confirmed"].includes(a.status))
      .sort(CMS.byDateAsc);
    const activeRx = prescriptions.filter((p) => ["Approved", "Active"].includes(p.status));
    const pendingRx = prescriptions.filter((p) => p.status === "Requested");

    /* ---------- Welcome ---------- */
    const welcome = document.createElement("section");
    welcome.className = "panel";
    const welcomeBody = document.createElement("div");
    welcomeBody.className = "panel-body";
    welcomeBody.appendChild(CMS_Security.text("h2", `Welcome back, ${profile.firstName}.`));
    welcomeBody.appendChild(
      CMS_Security.text(
        "p",
        upcoming.length
          ? `Your next appointment is on ${CMS.formatDate(upcoming[0].date)} at ${upcoming[0].time} with ${CMS.doctorName(doctorMap.get(upcoming[0].doctorId))}.`
          : "You have no upcoming appointments booked."
      )
    );
    const quick = document.createElement("div");
    quick.style.display = "flex";
    quick.style.gap = ".6rem";
    quick.style.flexWrap = "wrap";
    const book = document.createElement("a");
    book.className = "btn btn-primary";
    book.href = "appointments.html#book";
    book.textContent = "Book an appointment";
    const request = document.createElement("a");
    request.className = "btn btn-secondary";
    request.href = "prescriptions.html#request";
    request.textContent = "Request a prescription";
    quick.append(book, request);
    welcomeBody.appendChild(quick);
    welcome.appendChild(welcomeBody);

    /* ---------- Stats ---------- */
    const stats = document.createElement("div");
    stats.className = "stat-grid";
    stats.append(
      CMS.statCard("Upcoming appointments", upcoming.length, "Requested or confirmed"),
      CMS.statCard("Active prescriptions", activeRx.length, "Approved or active"),
      CMS.statCard("Pending requests", pendingRx.length, "Awaiting doctor review"),
      CMS.statCard("Medical records", records.length, "Entries in your history")
    );

    /* ---------- Upcoming appointments ---------- */
    const apptTable = CMS.buildTable(
      [
        { label: "Date", get: (r) => CMS.formatDate(r.date) },
        { label: "Time", get: (r) => r.time },
        { label: "Doctor", get: (r) => CMS.doctorName(doctorMap.get(r.doctorId)) },
        { label: "Reason", get: (r) => r.reason },
        { label: "Status", get: (r) => CMS.badge(r.status) },
      ],
      upcoming.slice(0, 6),
      "You have no upcoming appointments."
    );

    /* ---------- Prescriptions ---------- */
    const rxTable = CMS.buildTable(
      [
        { label: "Medicine", get: (r) => r.medicine },
        { label: "Dosage", get: (r) => r.dosage },
        { label: "Frequency", get: (r) => r.frequency },
        { label: "Instructions", get: (r) => r.instructions },
        { label: "Status", get: (r) => CMS.badge(r.status) },
      ],
      [...activeRx, ...pendingRx].slice(0, 6),
      "You have no current prescriptions."
    );

    /* ---------- Recent medical records ---------- */
    const timeline = document.createElement("div");
    timeline.className = "timeline";
    const recent = [...records].sort(CMS.byDateDesc).slice(0, 4);
    if (!recent.length) {
      timeline.appendChild(CMS_Security.text("p", "No medical records yet."));
    }
    recent.forEach((record) => {
      const item = document.createElement("article");
      item.className = "timeline-item";
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.append(
        CMS_Security.text("span", CMS.formatDate(record.date)),
        CMS_Security.text("span", CMS.doctorName(doctorMap.get(record.doctorId)))
      );
      item.append(meta, CMS_Security.text("h4", record.diagnosis), CMS_Security.text("p", record.notes));
      item.appendChild(CMS_Security.text("p", `Treatment: ${record.treatment}`));
      timeline.appendChild(item);
    });

    /* ---------- Profile / contact details ---------- */
    const details = document.createElement("div");
    details.className = "panel-body";
    const kv = document.createElement("dl");
    kv.className = "kv";
    [
      ["Name", `${profile.firstName} ${profile.lastName}`],
      ["Date of birth", `${CMS.formatDate(profile.dateOfBirth)} (age ${CMS.age(profile.dateOfBirth)})`],
      ["NHS number", profile.nhsNumber],
      ["Email", profile.email],
      ["Telephone", profile.telephone],
      ["Address", profile.address],
      ["Emergency contact", profile.emergencyContact || "—"],
    ].forEach(([label, value]) => {
      kv.append(CMS_Security.text("dt", label), CMS_Security.text("dd", value || "—"));
    });
    details.appendChild(kv);
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.style.marginTop = "1rem";
    editBtn.textContent = "Update contact details";
    editBtn.addEventListener("click", () => openContactEditor(profile));
    details.appendChild(editBtn);

    content.append(
      welcome,
      stats,
      CMS.panel("Upcoming appointments", apptTable),
      CMS.panel("Current prescriptions", rxTable),
      CMS.panel("Recent medical records", (() => { const b = document.createElement("div"); b.className = "panel-body"; b.appendChild(timeline); return b; })()),
      CMS.panel("My details", details)
    );

    /** Patients may update limited contact information only. */
    function openContactEditor(patientRecord) {
      const form = document.createElement("form");
      form.className = "form-grid";
      form.noValidate = true;
      form.innerHTML = `
        <div class="field"><label for="p-telephone">Telephone</label><input id="p-telephone" type="tel" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="p-address">Address</label><input id="p-address" type="text" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="p-emergency">Emergency contact</label><input id="p-emergency" type="text" /><span class="error" role="alert"></span></div>
        <p style="margin:0;font-size:.86rem;color:var(--ink-soft)">Medical notes and prescriptions can only be changed by your doctor.</p>`;
      form.querySelector("#p-telephone").value = patientRecord.telephone || "";
      form.querySelector("#p-address").value = patientRecord.address || "";
      form.querySelector("#p-emergency").value = patientRecord.emergencyContact || "";

      CMS.openModal("Update contact details", form, [
        { label: "Cancel", className: "btn-ghost", onClick: (close) => close() },
        {
          label: "Save changes",
          className: "btn-primary",
          onClick: async (close) => {
            const telephone = form.querySelector("#p-telephone").value;
            const address = form.querySelector("#p-address").value;
            const emergency = form.querySelector("#p-emergency").value;
            const ok = CMS_Validate.apply({
              "p-telephone": CMS_Validate.telephone(telephone),
              "p-address": CMS_Validate.minLength(address, 6, "Address"),
            });
            if (!ok) return;
            try {
              const patch = await CMS_Encryption.encryptFields(
                {
                  telephone: CMS_Security.sanitise(telephone),
                  address: CMS_Security.sanitise(address),
                  emergencyContact: CMS_Security.sanitise(emergency),
                },
                ["telephone", "address", "emergencyContact"]
              );
              await CMS_DB.updateRecord("patients", patientRecord.id, patch);
              await CMS_DB.log("PATIENT_CONTACT_UPDATED", patientRecord.id);
              close();
              CMS.toast("Contact details updated successfully.", "success");
              setTimeout(() => window.location.reload(), 700);
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
