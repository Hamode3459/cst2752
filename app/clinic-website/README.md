# Clinical Patient Management System — HTML, CSS, JavaScript + IndexedDB

This is the standalone, framework-free version of the project. It uses only:
- HTML
- CSS
- Vanilla JavaScript
- IndexedDB (browser database)
- JSON files for fictional demo seed data

No React, TypeScript, Vite, Node.js packages, build step, or external database is required.

## Run it

Because the app loads its demo JSON files with `fetch()` and uses the Web Crypto API, open it through a local web server rather than double-clicking `index.html`.

### Option 1: Python
From this folder, run:

```bash
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

### Option 2: VS Code
Open this folder in VS Code, install/use the Live Server extension, and choose **Open with Live Server** on `index.html`.

## Included pages

- `index.html` — landing page
- `login.html` / `register.html` — authentication and patient registration
- `patient.html` — patient dashboard
- `doctor.html` — doctor dashboard
- `admin.html` — admin dashboard
- `patients.html` — patient management
- `appointments.html` — appointment booking and management
- `medical-records.html` — medical records
- `prescriptions.html` — prescriptions
- `security.html` — security status
- `er-diagram.html` — database diagram
- `rubric.html` — assessment rubric

Styles are in `css/`, JavaScript in `js/`, and fictional seed data in `data/`.

## Demo accounts

Use **Load Demo Data** on the landing page first. Demo passwords are:
- Patient: `PatientDemo!12345`
- Doctor: `DoctorDemo!12345`
- Admin: `AdminDemo!12345`

Use the email addresses listed in `data/patients.json`, `data/doctors.json`, and `data/admins.json`.

## Important

This is an academic demonstration with fictional data only. Do not use it for real patient information. Browser-side security features are educational and are not a replacement for a server-backed clinical system.
