/* =========================================================
   app.js — shared UI: shell, navigation, toasts, modals, helpers
   ========================================================= */

const CMS = (() => {
  /* ---------------- Notifications ---------------- */
  function toast(message, type = "info", ms = 3600) {
    let region = document.getElementById("toast-region");
    if (!region) {
      region = document.createElement("div");
      region.id = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message; // textContent, never innerHTML
    region.appendChild(node);
    setTimeout(() => node.remove(), ms);
  }

  /* ---------------- Modal ---------------- */
  function modalRoot() {
    let root = document.getElementById("modal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root";
      root.className = "modal-backdrop";
      root.hidden = true;
      document.body.appendChild(root);
    }
    return root;
  }

  function closeModal() {
    const root = modalRoot();
    root.hidden = true;
    root.replaceChildren();
  }

  /**
   * Open a modal. `body` is a DOM node; `actions` is a list of
   * { label, className, onClick } describing the footer buttons.
   */
  function openModal(title, body, actions = []) {
    const root = modalRoot();
    root.replaceChildren();

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", title);

    const header = document.createElement("header");
    header.appendChild(CMS_Security.text("h2", title));
    const close = document.createElement("button");
    close.className = "icon-btn";
    close.type = "button";
    close.setAttribute("aria-label", "Close dialog");
    close.textContent = "×";
    close.addEventListener("click", closeModal);
    header.appendChild(close);

    const content = document.createElement("div");
    content.className = "modal-body";
    content.appendChild(body);

    const footer = document.createElement("footer");
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn ${action.className || "btn-secondary"}`;
      button.textContent = action.label;
      button.addEventListener("click", () => action.onClick(closeModal));
      footer.appendChild(button);
    });

    modal.append(header, content, footer);
    root.appendChild(modal);
    root.hidden = false;
    modal.querySelector("input, select, textarea, button")?.focus();
  }

  /** Promise-based confirmation dialog (used before every deletion). */
  function confirmAction(message, confirmLabel = "Delete") {
    return new Promise((resolve) => {
      const body = document.createElement("div");
      body.appendChild(CMS_Security.text("p", message));
      openModal("Please confirm", body, [
        { label: "Cancel", className: "btn-ghost", onClick: (close) => { close(); resolve(false); } },
        { label: confirmLabel, className: "btn-danger", onClick: (close) => { close(); resolve(true); } },
      ]);
    });
  }

  /* ---------------- Formatting helpers ---------------- */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(date.getTime())) return "—";
    return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function age(dob) {
    if (!dob) return "—";
    const birth = new Date(dob);
    const diff = Date.now() - birth.getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  }

  function badge(status) {
    const span = document.createElement("span");
    span.className = `badge badge-${String(status || "").toLowerCase()}`;
    span.textContent = status || "—";
    return span;
  }

  function doctorName(doctor) {
    return doctor ? `Dr ${doctor.firstName} ${doctor.lastName}` : "Unknown doctor";
  }

  function personName(person) {
    return person ? `${person.firstName} ${person.lastName}` : "Unknown";
  }

  function byDateDesc(a, b) {
    return String(b.date).localeCompare(String(a.date));
  }
  function byDateAsc(a, b) {
    return String(a.date).localeCompare(String(b.date));
  }

  /* ---------------- Table helper ---------------- */
  /**
   * Build a table safely from data.
   * columns: [{ label, get(row) -> string|Node, actions?: true }]
   */
  function buildTable(columns, rows, emptyMessage = "No records found.") {
    const table = document.createElement("table");
    table.className = "data responsive-cards";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    columns.forEach((col) => headRow.appendChild(CMS_Security.text("th", col.label)));
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.className = "empty-row";
      const td = document.createElement("td");
      td.colSpan = columns.length;
      td.textContent = emptyMessage;
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      rows.forEach((row) => {
        const tr = document.createElement("tr");
        columns.forEach((col) => {
          const td = document.createElement("td");
          td.setAttribute("data-label", col.label);
          const value = col.get(row);
          if (value instanceof Node) td.appendChild(value);
          else td.textContent = value ?? "—";
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    table.append(thead, tbody);
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    wrap.appendChild(table);
    return wrap;
  }

  function actionGroup(buttons) {
    const box = document.createElement("div");
    buttons.forEach(({ label, className, onClick }) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `btn btn-sm ${className || "btn-secondary"}`;
      b.textContent = label;
      b.addEventListener("click", onClick);
      box.appendChild(b);
    });
    return box;
  }

  function panel(title, bodyNode, toolbarNode) {
    const section = document.createElement("section");
    section.className = "panel";
    const head = document.createElement("div");
    head.className = "panel-head";
    head.appendChild(CMS_Security.text("h2", title));
    if (toolbarNode) head.appendChild(toolbarNode);
    const body = document.createElement("div");
    body.className = "panel-body tight";
    body.appendChild(bodyNode);
    section.append(head, body);
    return section;
  }

  function statCard(label, value, sub) {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.appendChild(CMS_Security.text("div", label, "label"));
    card.appendChild(CMS_Security.text("div", String(value), "value"));
    if (sub) card.appendChild(CMS_Security.text("div", sub, "sub"));
    return card;
  }

  /* ---------------- Dashboard shell ---------------- */
  const NAV = {
    ADMIN: [
      ["admin.html", "Dashboard", "▦"],
      ["patients.html", "Patients", "▤"],
      ["appointments.html", "Appointments", "▦"],
      ["medical-records.html", "Medical Records", "▣"],
      ["prescriptions.html", "Prescriptions", "◈"],
      ["security.html", "Security", "▲"],
      ["er-diagram.html", "ER Diagram", "◇"],
    ],
    DOCTOR: [
      ["doctor.html", "Dashboard", "▦"],
      ["patients.html", "Patients", "▤"],
      ["appointments.html", "Appointments", "▦"],
      ["medical-records.html", "Medical Records", "▣"],
      ["prescriptions.html", "Prescriptions", "◈"],
      ["security.html", "Security", "▲"],
    ],
    PATIENT: [
      ["patient.html", "Dashboard", "▦"],
      ["appointments.html", "My Appointments", "▦"],
      ["medical-records.html", "My Records", "▣"],
      ["prescriptions.html", "My Prescriptions", "◈"],
      ["security.html", "Security", "▲"],
    ],
  };

  function renderShell(session, activeHref, pageTitle) {
    const sidebar = document.getElementById("sidebar");
    const topbar = document.getElementById("topbar");
    if (!sidebar || !topbar) return;

    sidebar.replaceChildren();
    const brand = document.createElement("a");
    brand.className = "brand";
    brand.href = CMS_Auth.HOME[session.role];
    const mark = document.createElement("span");
    mark.className = "brand-mark";
    mark.textContent = "✚";
    const nameBox = document.createElement("span");
    nameBox.className = "brand-name";
    nameBox.textContent = "Clinical CMS";
    const sub = document.createElement("span");
    sub.className = "brand-sub";
    sub.textContent = "Patient Management";
    nameBox.appendChild(sub);
    brand.append(mark, nameBox);

    const nav = document.createElement("nav");
    nav.className = "side-nav";
    nav.setAttribute("aria-label", "Dashboard navigation");
    (NAV[session.role] || []).forEach(([href, label, icon]) => {
      const link = document.createElement("a");
      link.href = href;
      if (href === activeHref) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
      const ic = document.createElement("span");
      ic.className = "nav-icon";
      ic.setAttribute("aria-hidden", "true");
      ic.textContent = icon;
      link.append(ic, document.createTextNode(label));
      nav.appendChild(link);
    });

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "btn btn-secondary btn-block";
    logout.textContent = "Log out";
    logout.addEventListener("click", () => CMS_Auth.logout());

    const foot = document.createElement("div");
    foot.className = "sidebar-foot";
    foot.append(logout, CMS_Security.text("p", "Academic demonstration system. All data is fictional."));

    sidebar.append(brand, nav, foot);

    topbar.replaceChildren();
    const titleBox = document.createElement("div");
    titleBox.appendChild(CMS_Security.text("h1", pageTitle));
    titleBox.appendChild(CMS_Security.text("p", `Signed in as ${session.name}`, "who"));

    const actions = document.createElement("div");
    actions.className = "topbar-actions";
    const rolePill = document.createElement("span");
    rolePill.className = "role-pill";
    rolePill.style.background = "var(--teal-50)";
    rolePill.style.color = "var(--teal-700)";
    rolePill.textContent = session.role;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn btn-ghost btn-sm sidebar-toggle";
    toggle.textContent = "☰ Menu";
    toggle.addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
      const scrim = document.getElementById("scrim");
      if (scrim) scrim.hidden = !document.getElementById("sidebar").classList.contains("open");
    });
    actions.append(rolePill, toggle);
    topbar.append(titleBox, actions);

    const scrim = document.getElementById("scrim");
    if (scrim) {
      scrim.addEventListener("click", () => {
        document.getElementById("sidebar").classList.remove("open");
        scrim.hidden = true;
      });
    }
  }

  function loading(message = "Loading…") {
    const box = document.createElement("div");
    box.className = "panel";
    const body = document.createElement("div");
    body.className = "panel-body";
    body.appendChild(CMS_Security.text("p", message));
    box.appendChild(body);
    return box;
  }

  /** Show any message left behind by a redirect (e.g. "Access denied"). */
  function flushFlash() {
    const flash = sessionStorage.getItem("cms_flash");
    if (flash) {
      sessionStorage.removeItem("cms_flash");
      toast(flash, flash.toLowerCase().includes("denied") ? "error" : "info");
    }
  }

  /**
   * Standard dashboard page boot sequence:
   * guard the route, prepare the database, render the shell, run the page.
   */
  async function bootDashboard({ roles, title, active, render }) {
    const session = CMS_Auth.requireRole(...roles);
    if (!session) return;
    flushFlash();
    renderShell(session, active, title);

    const content = document.getElementById("content");
    const spinner = loading("Preparing the clinical database…");
    content.replaceChildren(spinner);

    try {
      await CMS_Seed.ensureReady();
      content.replaceChildren();
      await render(session, content);
    } catch (error) {
      console.error(error);
      content.replaceChildren(loading("Something went wrong while loading this page. Please refresh and try again."));
      toast("Something went wrong.", "error");
    }

    // Refresh the inactivity timer on interaction.
    ["click", "keydown"].forEach((evt) => document.addEventListener(evt, () => CMS_Auth.touch(), { passive: true }));
  }

  /* ---------------- Public site nav toggle ---------------- */
  function initPublicNav() {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".main-nav");
    if (toggle && nav) toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }

  document.addEventListener("DOMContentLoaded", initPublicNav);

  return {
    toast,
    openModal,
    closeModal,
    confirmAction,
    formatDate,
    todayISO,
    age,
    badge,
    doctorName,
    personName,
    byDateAsc,
    byDateDesc,
    buildTable,
    actionGroup,
    panel,
    statCard,
    renderShell,
    bootDashboard,
    loading,
    flushFlash,
  };
})();
