# CST2572 case study explained

Oct 20, 2026 · @Hamode

## The scenario in plain English

You are playing the security expert who gets called in after a break-in. The report is your written plan for what you would do, step by step, and why. Nobody expects you to have touched a real server.

What each bullet in the brief is quietly telling you:

| Clue in the brief | What it means for your answer |
| --- | --- |
| Saturday morning, client panicking | Time pressure and no staff around. Show you stay calm, follow a set incident-response process and keep the client informed. |
| Major national health conference, NHS promoter | High-profile target and reputational damage. Health data means UK GDPR and the Data Protection Act 2018 apply, and NHS links raise the stakes. |
| Auto-malware checks shut the site down | Good news: something detected it. Bad news: the site is offline and you don't yet know how far the attacker got. The scanner's logs are your first clue. |
| Apache server in a VM set up by a host | Layers: the hosting company owns the physical machine, the VM is the virtual server, Apache serves the web pages. You must say who controls which layer and what you can ask the host for (snapshots, logs, console access). |
| Same server also runs the main health website with a members' database | The worst part. Both sites share one box, so one hacked site can expose the other and its personal data. This is a possible data breach, not just a defaced page. |
| All sites run WordPress | WordPress is the most attacked CMS. Old plugins, themes and core versions are the usual way in. |
| Admin access by username and password only | No two-factor login, so passwords may have been guessed, reused or stolen. |
| Web developers say it's 'out of their remit' | No one else will fix it. You take ownership, and later you recommend a proper support contract and clear responsibilities. |

## What each question is really asking

The four questions are the standard stages of incident response (NIST SP 800-61 and the NCSC incident guidance follow the same order). Name that framework once and the whole report looks structured.

### 1. Reconnaissance: "What happened, how, and how bad is it?"

You are a detective. Before touching anything, collect evidence and work out the scope.

- Talk to the client: who noticed what, and when. Get the host's contact and the WordPress logins.
- Preserve evidence first: ask the host for a VM snapshot so nothing is lost if you change things.
- Read the malware scanner report: which files it flagged and when.
- Check Apache access and error logs for odd requests, such as floods of POSTs to wp-login.php or xmlrpc.php, or calls to strange .php files in /uploads.
- Check WordPress itself: unknown admin users, recently changed files, out-of-date plugins and themes, injected code in wp-config.php or .htaccess.
- Check the database: new admin accounts, spam links, and whether the members' table was read or exported.
- Check the server: other logins (SSH), unknown cron jobs and processes, and whether the second site was touched.
- Name tools: WPScan, Wordfence or Sucuri scanners, grep and find for recently modified files, log analysis.

The outcome is a short statement of the likely way in, what was changed, and whether member data was exposed.

### 2. Remedy: "Stop the bleeding."

This is containment. Lock the attacker out and stop it spreading, before you clean.

- Keep the site offline or show a maintenance page. Isolate the VM from the other site if possible.
- Change every password: WordPress admins, database user, hosting panel, SFTP/SSH. Kill all logged-in sessions and reset the WordPress secret keys (salts).
- Remove the attacker's accounts and any backdoor files you found.
- If member data may be exposed, it is a personal data breach. Report it to the ICO within 72 hours under UK GDPR, tell affected members if the risk is high, and inform the NHS partner.

### 3. Clean-up and restore: "Get back to a known-good state."

- Best option: rebuild a fresh VM, install clean WordPress core, plugins and themes from official sources, then bring back only the content (posts, uploads checked for .php files, and a cleaned database).
- Alternative: restore from the last backup taken before the hack. You need to know when the hack began, or you restore the infection too.
- Patch everything to current versions before going live, and change passwords again.
- Scan again, test both sites, then bring them back online and watch the logs closely for a few days.

### 4. Mitigate: "Make sure it doesn't happen again."

This is where you recommend upgrades. Good answers group them by layer:

- People and process: a named owner for security, a support contract that covers it, an incident response plan, staff training on phishing and passwords.
- WordPress: auto-updates, fewer plugins, two-factor login for admins, limit login attempts, rename or IP-restrict the admin area, disable XML-RPC and file editing in the dashboard.
- Server: separate the conference site and the members' site into different VMs, run a web application firewall (ModSecurity or Cloudflare), HTTPS only with TLS 1.2+, least-privilege file permissions and database users, SSH keys instead of passwords.
- Data: encrypt the members' database and backups, keep regular offsite backups and test restoring them.
- Monitoring: central logs, file-integrity alerts, uptime alerts, regular vulnerability scans and a penetration test.
- Compliance: Cyber Essentials Plus and the NHS Data Security and Protection Toolkit.

### 5. Diagrams: "Show it, don't just tell it."

The brief explicitly asks for diagrams of the system and of the upgrades. At minimum: the current (hacked) setup and the improved setup. The diagrams section below lists what to draw.

## What the marker wants

The report is worth 20% of Assessment 1 and the marksheet grades it under three headings, so every heading needs visible coverage.

| Marksheet heading | Where it shows up in your report |
| --- | --- |
| Servers / Protocols | Apache, HTTP vs HTTPS/TLS, SSH vs FTP, how WordPress talks to MySQL, the web application firewall |
| VMs | The host's hypervisor, your VM, snapshots for evidence and rollback, splitting the two sites into separate VMs |
| Hacking detection / mitigation | Recon steps, logs and scanners (detection), plus the containment, clean-up and mitigation sections |

Format rules from the brief and marksheet:

- 2,000 words, plus or minus 100 (so 1,900 to 2,100). You write the word count on the marksheet.
- Diagrams of the system and the upgrades are required.
- Reference third-party sources; the marksheet has you sign that you did. Harvard style is a safe default unless your module says otherwise.
- The report goes in the same zip as the web app code, the video and the marksheet, due 8 Nov 2026 at 11:59 PM.
- Your \~7 minute video should spend about a minute on the report too, since the video must show every section you claim.

## Suggested report structure

Seven sections adding up to 2,000 words. Recon and mitigation get the most words because they carry the detection and mitigation marks. Captions, the reference list and text inside diagrams usually don't count, but check with your tutor.

| # | Section | Words | What goes in it |
| --- | --- | --- | --- |
| 1 | Introduction and scenario | 150 | The situation, why it is serious (NHS, member data), the incident-response stages you will follow |
| 2 | Current system | 200 | Diagram 1 plus a short walk-through: host, VM, Apache, two WordPress sites, MySQL, admin login |
| 3 | Reconnaissance and discovery | 450 | Evidence first, then logs, scanner, WordPress, database, server checks; likely attack routes; your findings |
| 4 | Remedy (containment) | 300 | Isolate, lock out, reset credentials, remove backdoors; legal duty to report to the ICO; client communication |
| 5 | Clean-up and restore | 300 | Rebuild vs restore from backup and why; patching; testing; going back live |
| 6 | Mitigation and upgrades | 450 | Layered defences (people, WordPress, server, data, monitoring), Diagram 2, a priority table |
| 7 | Conclusion | 150 | Lessons learned and the top three actions |
|  | Total | 2,000 | Plus a reference list (aim for 8 to 12 sources) |

## Diagrams to draw

You need at least two diagrams, ideally four. Below is a rough version of the first one, built only from what the brief states; redraw it in your own style.

&#91;embedded content: current system · one VM, two WordPress sites, one database\]

The red box is where the attack was detected; the blue box is what really matters, because a breach of the members' data is a legal and reputational problem.

| # | Diagram | Shows | Goes in section |
| --- | --- | --- | --- |
| 1 | Current system | Host, VM, Apache, both WordPress sites, MySQL, admin login, scanner (like above) | 2. Current system |
| 2 | Likely attack path | How an attacker gets in: a weak password or an old plugin, then a backdoor, then the database | 3. Recon |
| 3 | Incident response flow | Detect, contain, clean up, restore, learn, as a loop | 1 or 4 |
| 4 | Upgraded system | Firewall/CDN in front, HTTPS, two separate VMs, 2FA admin login, encrypted database, offsite backups, monitoring | 6. Mitigation |

Draw them in [diagrams.net](https://app.diagrams.net) (free, has server and cloud icons). Number and caption each one, and refer to it in the text.

## Effort and plan

The whole report takes about 14 to 18 hours, spread over two and a half weeks so most of your time stays on the web app (80%). A sensible target is a finished report by 2 Nov, leaving the last week for the app and video.

| Finish by | Task | Hours |
| --- | --- | --- |
| 23 Oct | Read up: NCSC incident response guidance, NIST SP 800-61, WordPress hardening guide, ICO breach-reporting page, OWASP Top 10. Save links for references. | 3 |
| 24 Oct | Write a bullet-point outline using the seven sections above | 1 |
| 26 Oct | Draw diagram 1 (current system) and diagram 4 (upgraded system) | 2 to 3 |
| 29 Oct | Write sections 1 to 4 (intro, system, recon, remedy) | 4 to 5 |
| 31 Oct | Write sections 5 to 7 and add diagrams 2 and 3 | 3 to 4 |
| 2 Nov | Edit to 1,900 to 2,100 words, check every marksheet heading is covered, finish references | 1 to 2 |
| 6 Nov | Record the report part of the video (about one minute) | 0.5 |
| 8 Nov | Put the report in the zip with the code, video and marksheet, and write the word count on the marksheet | 0.5 |

What you need: the brief (you have it), 8 to 12 sources, diagrams.net, and a word processor. No server, hacking tools or lab are needed; it is a written plan.

If you'd like, I can next write the outline with the key points for each section, draft diagram 4, or build a reading list with ready-made Harvard references.
