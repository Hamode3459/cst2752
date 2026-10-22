/* =========================================================
   validation.js — reusable input validation rules
   ========================================================= */

const CMS_Validate = (() => {
  const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const PHONE_RE = /^(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3}[\s-]?\d{3,4}$/;
  const NHS_RE = /^\d{3}\s?\d{3}\s?\d{4}$/;

  function required(value, label = "This field") {
    return String(value ?? "").trim() ? "" : `${label} is required.`;
  }

  function email(value) {
    if (!String(value || "").trim()) return "Email address is required.";
    return EMAIL_RE.test(String(value).trim()) ? "" : "Enter a valid email address, e.g. name@example.com.";
  }

  /** Minimum 12 chars with upper, lower, number and special character. */
  function password(value) {
    const v = String(value || "");
    if (v.length < 12) return "Password must be at least 12 characters long.";
    if (!/[A-Z]/.test(v)) return "Password must contain an uppercase letter.";
    if (!/[a-z]/.test(v)) return "Password must contain a lowercase letter.";
    if (!/\d/.test(v)) return "Password must contain a number.";
    if (!/[^A-Za-z0-9]/.test(v)) return "Password must contain a special character.";
    return "";
  }

  function passwordsMatch(a, b) {
    return a === b ? "" : "Passwords do not match.";
  }

  function nhsNumber(value) {
    const v = String(value || "").trim();
    if (!v) return "NHS number is required.";
    return NHS_RE.test(v) ? "" : "NHS number must be 10 digits, e.g. 123 456 7890.";
  }

  function telephone(value) {
    const v = String(value || "").trim();
    if (!v) return "Telephone number is required.";
    const digits = v.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return "Enter a telephone number with 10–15 digits.";
    return PHONE_RE.test(v) || /^\d{10,15}$/.test(digits) ? "" : "Enter a valid telephone number.";
  }

  function dateOfBirth(value) {
    if (!value) return "Date of birth is required.";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Enter a valid date.";
    const today = new Date();
    if (date > today) return "Date of birth cannot be in the future.";
    if (date < new Date("1900-01-01")) return "Date of birth is not plausible.";
    return "";
  }

  function futureOrToday(value, label = "Date") {
    if (!value) return `${label} is required.`;
    const date = new Date(`${value}T23:59:59`);
    if (Number.isNaN(date.getTime())) return "Enter a valid date.";
    if (date < new Date(new Date().toDateString())) return `${label} cannot be in the past.`;
    return "";
  }

  function name(value, label = "Name") {
    const v = String(value || "").trim();
    if (!v) return `${label} is required.`;
    if (v.length < 2) return `${label} must be at least 2 characters.`;
    if (!/^[A-Za-z' -]+$/.test(v)) return `${label} may only contain letters, spaces, apostrophes and hyphens.`;
    return "";
  }

  function minLength(value, length, label = "This field") {
    return String(value || "").trim().length >= length ? "" : `${label} must be at least ${length} characters.`;
  }

  /**
   * Run a map of { fieldId: errorMessage } against the DOM, showing errors
   * in the sibling .error element. Returns true when the form is valid.
   */
  function apply(errors) {
    let valid = true;
    Object.entries(errors).forEach(([fieldId, message]) => {
      const input = document.getElementById(fieldId);
      if (!input) return;
      const wrapper = input.closest(".field");
      const slot = wrapper ? wrapper.querySelector(".error") : null;
      if (message) valid = false;
      if (wrapper) wrapper.classList.toggle("invalid", !!message);
      if (slot) slot.textContent = message || "";
      input.setAttribute("aria-invalid", message ? "true" : "false");
    });
    return valid;
  }

  return {
    required,
    email,
    password,
    passwordsMatch,
    nhsNumber,
    telephone,
    dateOfBirth,
    futureOrToday,
    name,
    minLength,
    apply,
  };
})();
