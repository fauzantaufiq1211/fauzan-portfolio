import { DB_TABLES, supabase } from "../config/supabase-client.js";
import { escapeHtml } from "../utils/dom.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBMISSION_COOLDOWN_MS = 60_000;
const COOLDOWN_STORAGE_KEY = "contact-last-submitted-at";
const FIELD_LIMITS = Object.freeze({
  name: 100,
  email: 150,
  phone: 25,
  message: 2000,
});

function getRemainingCooldownSeconds() {
  try {
    const rawTimestamp = sessionStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!rawTimestamp) return 0;
    const elapsed = Date.now() - Number.parseInt(rawTimestamp, 10);
    if (Number.isNaN(elapsed) || elapsed >= SUBMISSION_COOLDOWN_MS) return 0;
    return Math.ceil((SUBMISSION_COOLDOWN_MS - elapsed) / 1000);
  } catch {
    return 0;
  }
}

function recordSubmissionTimestamp() {
  try {
    sessionStorage.setItem(COOLDOWN_STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures in restricted browsing modes.
  }
}

const STATUS_ICONS = {
  success: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  `,
  error: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  `,
};

function showFormStatus(statusEl, type, title, detail) {
  if (!statusEl) return;
  statusEl.className = `form-status form-status--${type}`;
  statusEl.setAttribute("role", type === "error" ? "alert" : "status");
  statusEl.innerHTML = `
    <span class="form-status-icon">${STATUS_ICONS[type] || ""}</span>
    <div class="form-status-copy">
      <p class="text-body-sm"><strong>${escapeHtml(title)}</strong></p>
      <p class="text-caption">${escapeHtml(detail)}</p>
    </div>
  `;
  statusEl.hidden = false;
}

function setFieldInvalid(inputEl, errorEl, errorMessage) {
  if (!inputEl) return;
  if (errorMessage) {
    inputEl.setAttribute("aria-invalid", "true");
    if (errorEl) {
      errorEl.textContent = errorMessage;
      errorEl.hidden = false;
    }
  } else {
    inputEl.removeAttribute("aria-invalid");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
  }
}

// Writes to the live "messages" table first and falls back to "contact_messages" if migrated.
async function insertInquiryRecord(payload) {
  const primaryResult = await supabase
    .from(DB_TABLES.MESSAGES)
    .insert([payload]);

  if (!primaryResult.error) return primaryResult;

  const errCode = primaryResult.error.code || "";
  const errMsg = (primaryResult.error.message || "").toLowerCase();
  if (
    errCode === "42P01" ||
    errCode === "PGRST205" ||
    errMsg.includes("messages")
  ) {
    return supabase.from("contact_messages").insert([payload]);
  }

  return primaryResult;
}

export function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const nameInput = document.getElementById("contact-name");
  const emailInput = document.getElementById("contact-email");
  const phoneInput = document.getElementById("contact-phone");
  const messageInput = document.getElementById("contact-message");
  const honeypotInput = document.getElementById("contact-website");
  const submitBtn = document.getElementById("contact-submit");
  const statusEl = document.getElementById("contact-status");

  const nameError = document.getElementById("contact-name-error");
  const emailError = document.getElementById("contact-email-error");
  const phoneError = document.getElementById("contact-phone-error");
  const messageError = document.getElementById("contact-message-error");

  if (phoneInput) {
    phoneInput.addEventListener("focus", () => {
      if (!phoneInput.value.trim()) {
        phoneInput.value = "+62 ";
      }
    });

    phoneInput.addEventListener("blur", () => {
      if (phoneInput.value.trim() === "+62") {
        phoneInput.value = "";
      }
    });

    phoneInput.addEventListener("input", () => {
      const cleaned = phoneInput.value.replace(/[^0-9+\s-]/g, "");
      phoneInput.value = cleaned.startsWith("+")
        ? `+${cleaned.slice(1).replace(/\+/g, "")}`
        : `+${cleaned.replace(/\+/g, "")}`;
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (statusEl) statusEl.hidden = true;

    // Silently abort when an automated bot populates the hidden honeypot trap.
    if (honeypotInput && honeypotInput.value.trim() !== "") {
      return;
    }

    const remainingCooldown = getRemainingCooldownSeconds();
    if (remainingCooldown > 0) {
      showFormStatus(
        statusEl,
        "error",
        "Submission cooldown active",
        `Please wait ${remainingCooldown} seconds before sending another inquiry.`,
      );
      return;
    }

    const name = (nameInput?.value || "").trim();
    const email = (emailInput?.value || "").trim();
    const phone = (phoneInput?.value || "").trim();
    const message = (messageInput?.value || "").trim();
    const phoneDigits = phone.replace(/\D/g, "");

    let hasValidationError = false;

    if (name.length < 2 || name.length > FIELD_LIMITS.name) {
      setFieldInvalid(
        nameInput,
        nameError,
        name.length < 2
          ? "Enter your full name."
          : `Full name must be ${FIELD_LIMITS.name} characters or fewer.`,
      );
      hasValidationError = true;
    } else {
      setFieldInvalid(nameInput, nameError, "");
    }

    if (!EMAIL_PATTERN.test(email) || email.length > FIELD_LIMITS.email) {
      setFieldInvalid(
        emailInput,
        emailError,
        email.length > FIELD_LIMITS.email
          ? `Email address must be ${FIELD_LIMITS.email} characters or fewer.`
          : "Enter a valid email address (for example, name@company.com).",
      );
      hasValidationError = true;
    } else {
      setFieldInvalid(emailInput, emailError, "");
    }

    if (phoneDigits.length < 10 || phone.length > FIELD_LIMITS.phone) {
      setFieldInvalid(
        phoneInput,
        phoneError,
        phone.length > FIELD_LIMITS.phone
          ? `Phone number must be ${FIELD_LIMITS.phone} characters or fewer.`
          : "Enter a phone or WhatsApp number with country code (at least 10 digits).",
      );
      hasValidationError = true;
    } else {
      setFieldInvalid(phoneInput, phoneError, "");
    }

    if (message.length < 10 || message.length > FIELD_LIMITS.message) {
      setFieldInvalid(
        messageInput,
        messageError,
        message.length > FIELD_LIMITS.message
          ? `Message must be ${FIELD_LIMITS.message} characters or fewer.`
          : "Include a short project brief or inquiry message (at least 10 characters).",
      );
      hasValidationError = true;
    } else {
      setFieldInvalid(messageInput, messageError, "");
    }

    if (hasValidationError) {
      showFormStatus(
        statusEl,
        "error",
        "Please check the highlighted fields",
        "Complete all required contact details before sending your inquiry.",
      );
      return;
    }

    const originalLabel = submitBtn ? submitBtn.textContent : "Send Project Inquiry";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
      submitBtn.textContent = "Sending inquiry...";
    }

    try {
      const { error } = await insertInquiryRecord({
        name: name.slice(0, FIELD_LIMITS.name),
        email: email.slice(0, FIELD_LIMITS.email),
        phone: phone.slice(0, FIELD_LIMITS.phone),
        message: message.slice(0, FIELD_LIMITS.message),
      });

      if (error) throw error;

      recordSubmissionTimestamp();
      form.reset();
      showFormStatus(
        statusEl,
        "success",
        "Inquiry received",
        "Thank you for reaching out. I will review your brief and reply via email or WhatsApp shortly.",
      );
    } catch (error) {
      showFormStatus(
        statusEl,
        "error",
        "Unable to send your inquiry right now",
        error?.message ||
          "Please try again or contact me directly at contact@fauzantaufiq.id.",
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
        submitBtn.textContent = originalLabel;
      }
    }
  });
}
