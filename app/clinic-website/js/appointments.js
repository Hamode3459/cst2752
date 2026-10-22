/* =========================================================
   appointments.js — booking and appointment management
   Patient: book, view and request cancellation of own appointments
   Doctor:  view own clinic, confirm / complete / cancel
   Admin:   view and filter every appointment
   ========================================================= */

CMS.bootDashboard({
  roles: [CMS_Auth.ROLES.PATIENT, CMS_Auth.ROLES.DOCTOR, CMS_Auth.ROLES.ADMIN],
  title: "Appointments",
  active: "appointments.html",
  render: async (session, content) => {
    const { PATIENT, DOCTOR, ADMIN } = CMS_Auth.ROLES;
    const profile = await CMS_Auth.currentProfile();
    const [patients, doctors] = await Promise.all([
      session.role === PATIENT ? Promise.resolve([]) : CMS_Data.patients(),
      CMS_Data.doctors(),
    ]);
    const patientMap = CMS_Data.indexById(patients);
    const doctorMap = CMS_Data.indexById(doctors);

    const filter =
      session.role === PATIENT ? { patientId: profile.id } : session.role === DOCTOR ? { doctorId: profile.id } : {};

    async function load() {
      return (await CMS_Data.appointments(filter)).sort(CMS.byDateDesc);
    }
    let rows = await load();

    /* ---------------- Toolbar ---------------- */
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const statusFilter = document.createElement("select");
    statusFilter.setAttribute("aria-label", "Filter by status");
    [["", "All statuses"], ["Requested", "Requested"], ["Confirmed", "Confirmed"], ["Completed", "Completed"], ["Cancelled", "Cancelled"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      statusFilter.appendChild(option);
    });
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = session.role === PATIENT ? "Search by reason or doctor" : "Search patient, doctor or reason";
    search.setAttribute("aria-label", "Search appointments");
    toolbar.append(statusFilter, search);

    if (session.role === PATIENT) {
      const bookBtn = document.createElement("button");
      bookBtn.type = "button";
      bookBtn.className = "btn btn-primary btn-sm";
      bookBtn.textContent = "Book appointment";
      bookBtn.addEventListener("click", openBookingForm);
      toolbar.appendChild(bookBtn);
      if (location.hash === "#book") setTimeout(openBookingForm, 200);
    }

    const tableHost = document.createElement("div");
    content.appendChild(CMS.panel("Appointments", tableHost, toolbar));

    /* ---------------- Status changes ---------------- */
    async function setStatus(row, status, message) {
      try {
        await CMS_DB.updateRecord("appointments", row.id, { status });
        await CMS_DB.log("APPOINTMENT_STATUS", `${row.id} -> ${status}`);
        CMS.toast(message, "success");
        rows = await load();
        draw();
      } catch (error) {
        console.error(error);
        CMS.toast("Something went wrong.", "error");
      }
    }

    function actionsFor(row) {
      const buttons = [];
      if (session.role === PATIENT && ["Requested", "Confirmed"].includes(row.status)) {
        buttons.push({
          label: "Cancel",
          className: "btn-ghost",
          onClick: async () => {
            const ok = await CMS.confirmAction("Request cancellation of this appointment?", "Cancel appointment");
            if (ok) setStatus(row, "Cancelled", "Appointment cancelled.");
          },
        });
      }
      if (session.role === DOCTOR) {
        if (row.status === "Requested") buttons.push({ label: "Confirm", className: "btn-primary", onClick: () => setStatus(row, "Confirmed", "Appointment confirmed.") });
        if (["Requested", "Confirmed"].includes(row.status)) {
          buttons.push({ label: "Complete", className: "btn-secondary", onClick: () => setStatus(row, "Completed", "Appointment completed.") });
          buttons.push({ label: "Cancel", className: "btn-ghost", onClick: () => setStatus(row, "Cancelled", "Appointment cancelled.") });
        }
        buttons.push({ label: "History", className: "btn-ghost", onClick: () => { window.location.href = `patients.html?id=${encodeURIComponent(row.patientId)}`; } });
      }
      if (session.role === ADMIN) {
        buttons.push({ label: "Patient", className: "btn-secondary", onClick: () => { window.location.href = `patients.html?id=${encodeURIComponent(row.patientId)}`; } });
      }
      return buttons.length ? CMS.actionGroup(buttons) : document.createTextNode("—");
    }

    /* ---------------- Table ---------------- */
    function draw() {
      const query = search.value.toLowerCase().trim();
      const status = statusFilter.value;
      const visible = rows.filter((row) => {
        if (status && row.status !== status) return false;
        if (!query) return true;
        const patient = patientMap.get(row.patientId);
        const doctor = doctorMap.get(row.doctorId);
        return [row.reason, CMS.doctorName(doctor), patient ? CMS.personName(patient) : ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });

      const columns = [
        { label: "Date", get: (r) => CMS.formatDate(r.date) },
        { label: "Time", get: (r) => r.time },
      ];
      if (session.role !== PATIENT) columns.push({ label: "Patient", get: (r) => CMS.personName(patientMap.get(r.patientId)) });
      columns.push(
        { label: "Doctor", get: (r) => CMS.doctorName(doctorMap.get(r.doctorId)) },
        { label: "Reason", get: (r) => r.reason },
        { label: "Status", get: (r) => CMS.badge(r.status) },
        { label: "Actions", get: actionsFor }
      );

      tableHost.replaceChildren(CMS.buildTable(columns, visible.slice(0, 60), "No appointments found."));
      const pager = document.createElement("div");
      pager.className = "pager";
      pager.appendChild(CMS_Security.text("span", `Showing ${Math.min(visible.length, 60)} of ${visible.length} appointments`));
      tableHost.appendChild(pager);
    }

    search.addEventListener("input", draw);
    statusFilter.addEventListener("change", draw);
    draw();

    /* ---------------- Booking (patients) ---------------- */
    function openBookingForm() {
      const form = document.createElement("form");
      form.className = "form-grid";
      form.noValidate = true;
      form.innerHTML = `
        <div class="field"><label for="b-doctor">Doctor</label><select id="b-doctor"></select><span class="error" role="alert"></span></div>
        <div class="field"><label for="b-date">Date</label><input id="b-date" type="date" /><span class="error" role="alert"></span></div>
        <div class="field"><label for="b-time">Time</label><select id="b-time"></select><span class="error" role="alert"></span></div>
        <div class="field"><label for="b-reason">Reason for appointment</label><textarea id="b-reason" maxlength="400"></textarea><span class="error" role="alert"></span></div>`;

      const doctorSelect = form.querySelector("#b-doctor");
      [...doctors]
        .sort((a, b) => a.lastName.localeCompare(b.lastName))
        .forEach((doctor) => {
          const option = document.createElement("option");
          option.value = doctor.id;
          option.textContent = `${CMS.doctorName(doctor)} — ${doctor.speciality}`;
          doctorSelect.appendChild(option);
        });

      const timeSelect = form.querySelector("#b-time");
      for (let hour = 8; hour <= 16; hour += 1) {
        ["00", "30"].forEach((minute) => {
          const option = document.createElement("option");
          option.value = `${String(hour).padStart(2, "0")}:${minute}`;
          option.textContent = option.value;
          timeSelect.appendChild(option);
        });
      }

      const dateInput = form.querySelector("#b-date");
      dateInput.min = CMS.todayISO();

      CMS.openModal("Book an appointment", form, [
        { label: "Cancel", className: "btn-ghost", onClick: (close) => close() },
        {
          label: "Request appointment",
          className: "btn-primary",
          onClick: async (close) => {
            const doctorId = doctorSelect.value;
            const date = dateInput.value;
            const time = timeSelect.value;
            const reason = form.querySelector("#b-reason").value;

            const ok = CMS_Validate.apply({
              "b-doctor": CMS_Validate.required(doctorId, "Doctor"),
              "b-date": CMS_Validate.futureOrToday(date, "Appointment date"),
              "b-reason": CMS_Validate.minLength(reason, 5, "Reason"),
            });
            if (!ok) return;

            try {
              const record = await CMS_Encryption.encryptFields(
                {
                  id: CMS_Data.nextId("APT"),
                  patientId: profile.id,
                  doctorId,
                  date,
                  time,
                  reason: CMS_Security.sanitise(reason),
                  status: "Requested",
                  notes: "",
                  createdAt: new Date().toISOString(),
                },
                CMS_Encryption_FIELDS.appointments
              );
              await CMS_DB.addRecord("appointments", record);
              await CMS_DB.log("APPOINTMENT_BOOKED", record.id);
              close();
              CMS.toast("Appointment booked successfully. Your clinic will confirm it shortly.", "success");
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
