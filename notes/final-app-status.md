# Final web app: status

`app/clinic-website/` is the final version of the web app for Assessment 1 (confirmed 22 Oct 2026). All notes and walkthroughs describe this version.

## What it is

- Plain HTML, CSS and JavaScript, no framework or build step. Run it from a local web server (for example `python -m http.server`) and open `login.html` in Chrome.
- IndexedDB database `ClinicalManagementDB` (version 2). `js/seed.js` fetches doctors, patients, admins and medicines from the course JSON server (`https://jsethi-mdx.github.io/cst2572.github.io/`), and falls back to the copies in `data/course/` when offline. Sample appointments, records and prescriptions in `data/` are linked to the imported people.
- Three roles: patient, doctor, admin. Each has its own dashboard and is kept out of the others' pages.
- Passwords hashed with PBKDF2-SHA256 (210,000 iterations, salted). Lockout after 5 failed logins. Sessions time out after 20 minutes.
- Sensitive fields (patient and doctor address and telephone, NHS number, notes, reasons) encrypted with AES-256-GCM through Web Crypto, decrypted only in memory for display.
- Input is validated and sanitised, and pages build tables with textContent, not innerHTML.
- `er-diagram.html` is the E/R diagram. `security.html` shows the stored ciphertext.

Demo logins (from the course JSON): admin `skestian0@telegraph.co.uk` / `AdminDemo!12345`, doctor `vrilton0@discuz.net` / `DoctorDemo!12345`, patient `lvasilik0@java.com` / `PatientDemo!12345`. Every account of a role uses that role's demo password.

## Gaps against the brief and marksheet

1. Front-page designs (8%): no wireframes or mockups yet.
2. No service worker or manifest, so it does not work offline.
3. No GDPR features: privacy notice, consent, data access or erasure.
4. No `readme.txt` with references (only `README.md`).
5. Bug: when an admin changes a patient's email, the login email is not updated.
6. `er-diagram.html` does not show the new medicines store yet.
7. `rubric.html` does not match the marksheet.
8. Still to add to the zip: the ~7 min video, the filled marksheet and the case study report.
