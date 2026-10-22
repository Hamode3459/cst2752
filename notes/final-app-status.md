# Final web app: status

`app/clinic-website/` is the final version of the web app for Assessment 1 (confirmed 22 Oct 2026). All notes and walkthroughs describe this version.

## What it is

- Plain HTML, CSS and JavaScript, no framework or build step. Run it from a local web server (for example `python -m http.server`) and open `login.html` in Chrome.
- IndexedDB database `ClinicalManagementDB` (version 1), seeded by `js/seed.js` from the JSON files in `data/`.
- Three roles: patient, doctor, admin. Each has its own dashboard and is kept out of the others' pages.
- Passwords hashed with PBKDF2-SHA256 (210,000 iterations, salted). Lockout after 5 failed logins. Sessions time out after 20 minutes.
- Sensitive fields (address, telephone, NHS number, notes, reasons) encrypted with AES-256-GCM through Web Crypto, decrypted only in memory for display.
- Input is validated and sanitised, and pages build tables with textContent, not innerHTML.
- `er-diagram.html` is the E/R diagram. `security.html` shows the stored ciphertext.

Demo logins: `admin@example.com` / `AdminDemo!12345`, `patient001@example.com` / `PatientDemo!12345`. `doctor01@example.com` / `DoctorDemo!12345`.

## Gaps against the brief and marksheet

1. Course JSON: the site loads its own invented data from `data/`, not the course JSON URLs (affects about 10% of the marks).
2. Front-page designs (8%): no wireframes or mockups yet.
3. No service worker or manifest, so it does not work offline.
4. No medicines list. Prescriptions take free text.
5. No GDPR features: privacy notice, consent, data access or erasure.
6. No `readme.txt` with references (only `README.md`).
7. Bug: when an admin changes a patient's email, the login email is not updated.
8. The demo passwords are in plain text in the `data/*.json` files (they are hashed before storage).
9. `rubric.html` does not match the marksheet.
10. Still to add to the zip: the ~7 min video, the filled marksheet and the case study report.
