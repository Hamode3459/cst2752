# CST2572 Assessment 1: what we need to do

Oct 20, 2026 · @Hamode

## The short answer

This is one assessment with two parts, and both are required. You build a secure, offline-capable medical appointment web app (worth 80%) and write a 2,000-word case study report on a hacked WordPress server (worth 20%). Everything goes in one .zip with a \~7-minute Zoom video, a readme and the signed self-assessment marksheet.

The deadline is the end of Week 7: **8 November, 11:59 PM**. That is about 19 days from today.

## How the four files fit together

| File | What it is | Why it matters |
| --- | --- | --- |
| Coursework-1-WebApplications\_Brief.pdf | The main brief: app requirements, mark scheme, checklist, technical notes | Defines 100% of the marks, including the 20% for the report |
| Coursework-1-CaseStudy\_Brief.pdf | The scenario for the report part | This is the "small case study" the main brief points to |
| Assessment 1 Case Study Prompt.pdf | The same scenario on university letterhead | Only file that states the deadline (8 Nov, 11:59 PM) |
| 1st assessment(1).docx | The self-assessment marksheet you fill in and submit | Same mark scheme, plus a Student ID line and signed declaration |

The Case Study is not a separate option. The Web Applications brief lists "Case Study / Report (20%)" as one of its marked sections.

## Part A: the medical appointment web app (80%)

You build a website for a local doctor's surgery that runs entirely in Google Chrome, with no backend server of your own.

**Technology rules**

- Plain HTML, CSS and JavaScript (or compiled TypeScript). No frameworks are required.
- Data lives in **IndexedDB** in the browser. Cookies or localStorage only for small things like the logged-in user.
- On first load, **fetch the four JSON files** (doctors, patients, admin, medicines), process them and store them in IndexedDB.
- Works **offline as a PWA**: a manifest plus a service worker that caches the HTML, CSS, JS and images.
- Sensitive data and passwords **encrypted with AES-256 or better**, using the browser's Web Crypto API or a crypto library, then decrypted for use.
- Writing back to a real server is not needed; a dummy "sync to server" function is enough.

**Three user roles**

| Role | Must be able to |
| --- | --- |
| Patient | Log in, book an appointment with a specific doctor, request a prescription, view own details, medical notes and medication instructions |
| Doctor | Log in, view a patient's history and notes, add notes, treatments and prescriptions |
| Admin | Log in, add patients (name, address, phone, DOB, NHS number), update and delete them |

**Security and validation**: every account needs a password, inputs are sanitised against script injection, passwords meet a strength rule, and emails are validated. The whole thing should be framed as GDPR compliant.

**Design work**: front-page designs (wireframes or mock-ups) and an E/R diagram of the database.

## Part B: the case study report (20%)

You write a 2,000-word report (plus or minus 100) acting as the security consultant called in on a Saturday morning.

**The scenario**: a major national health conference website, promoted by the NHS, has been hacked. Automatic malware checks shut it down. It runs WordPress on Apache inside a VM supplied by a hosting company. The same setup hosts the company's main health website and its members' database. Admin login is a plain username and password, and the web developers say the incident is "out of their remit".

**Four questions to answer**

1. Reconnaissance: how you find out what happened (logs, file changes, plugins, accounts, scope of the breach).
2. Remedy: how you contain and fix it.
3. Clean-up and restore: how you get the sites back safely from clean backups.
4. Mitigation: how you stop it happening again.

**Must include diagrams** of the system as it is and of the upgraded, hardened setup. The mark scheme says marks go on servers and protocols, VMs, and hacking detection and mitigation. Because members' health data may be exposed, GDPR breach reporting (72 hours to the ICO) is worth covering.

## What you hand in

One **.zip** file (not .rar or anything else) uploaded to the submission link, containing:

- [ ] The code, neatly organised into folders, commented and split into functions
- [ ] A **readme.txt** in each relevant folder with usage notes and references
- [ ] A **Zoom video, about 7 minutes**, with clear spoken narration walking through each marked section. Without a clear Zoom recording, the work will not be marked.
- [ ] The **report** (2,000 words, plus or minus 100), with its diagrams
- [ ] The **marksheet** (the .docx) with your Student ID, the boxes ticked, video length, word count, and the signed declaration

Use your Student ID rather than your name, because code is marked anonymously.

## Where the marks are

The report is the single biggest item at 20%. The rest is spread evenly, so every feature needs to exist and be shown in the video.

| Section | Marks | What earns them |
| --- | --- | --- |
| Case study report | 20% | Servers and protocols, VMs, hack detection and mitigation |
| Designs | 10% | Front-page designs 8%, E/R diagram 2% |
| IndexedDB | 10% | Create DB from server JSON 5%, add 2%, delete 1%, update 2% |
| Admin functions | 10% | Add patient details 5%, update and delete 5% |
| Patient functions | 10% | Book appointments and request prescriptions 5%, view own info and notes 5% |
| Doctor functions | 10% | View history and notes 5%, add notes and prescriptions 5% |
| Encryption | 10% | Encrypt passwords and data 5%, decrypt and use after storage 5% |
| Advanced | 10% | JSON fetched and processed 5%, AES-256 via crypto library 5% |
| Account types | 5% | Patient 1%, admin 2%, doctor 2% |
| Validation | 5% | Password-protected accounts 2%, sanitised inputs, password strength and email checks 3% |

## Things to check with your tutor

- **Which JSON URLs to use.** The PDF brief lists `jsethi-mdx.github.io/cst2572.github.io/` (doctors, patients, admin, medicines). The marksheet lists older `simulacra.uk/CST2572/` links (doctor, people, admin, medicine). The PDF looks current. I could not reach either from here, so try them in your browser.
- **The year on the deadline.** "End of Week 7, 8 November" fits this term, but confirm it on the module page in case the PDF is reused from a previous year.
- **Whether "Zoom" is strict.** The brief says unclear or non-Zoom videos may go unmarked, so record with Zoom to be safe.

## Suggested plan (about 19 days)

Build the app's foundations first, because encryption and IndexedDB underpin every feature. Write the report alongside it, and leave the last few days for the video and packaging.

| Dates | Focus | Output |
| --- | --- | --- |
| 20 to 22 Oct | Designs and setup | Wireframes, E/R diagram, folder structure, JSON fetched into IndexedDB |
| 23 to 26 Oct | Core security | Login for all three roles, AES-256 encryption, password hashing, validation |
| 27 Oct to 1 Nov | Role features | Admin patient CRUD, patient booking and prescriptions, doctor notes |
| 20 Oct to 2 Nov, in parallel | Report | System diagrams, then recon, remedy, restore and mitigation sections |
| 2 to 4 Nov | PWA and polish | Service worker, offline test, comments, readme files |
| 5 to 7 Nov | Wrap-up | Zoom video, fill in marksheet, word count, zip and submit early |

I can help with any step, starting with the designs and project skeleton or the report outline.
