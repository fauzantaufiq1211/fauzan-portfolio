import { DB_TABLES, supabase } from "../config/supabase-client.js";
import {
  closeModalDialog,
  escapeHtml,
  openModalDialog,
  parseDescriptionList,
  renderErrorState,
  renderLoadingState,
} from "../utils/dom.js";
import { initAuth } from "./auth.js";
import {
  getSectionDisplayTitle,
  getSectionsCache,
  invalidatePublicPortfolioCache,
  loadPortfolioItems,
  loadPortfolioSections,
  uploadPortfolioWebP,
} from "./crud-portfolio.js";
import {
  loadAdminCompetencies,
  loadAdminEducation,
  loadAdminExperience,
} from "./crud-profile.js";
import {
  initInboxControls,
  loadInbox,
  updateInboxUnreadBadge,
} from "./inbox.js";

let currentTab = "overview";
let clockTimer = null;
let activeModalConfig = null;
let pendingConfirmAction = null;

// Form schemas define admin editor fields and WebP canvas upload options.
const FORM_SCHEMAS = {
  [DB_TABLES.PORTFOLIO_SECTIONS]: {
    title: "Portfolio Section",
    fields: [
      {
        key: "id",
        label: "Section ID (Slug)",
        type: "text",
        required: true,
        placeholder: "e.g. brand-campaign-2026",
        hint: "Unique identifier slug. Locked after creation.",
        lockOnEdit: true,
      },
      {
        key: "title",
        label: "Section or Client Title",
        type: "text",
        required: true,
        placeholder: "Client or Campaign Name",
      },
      {
        key: "tagline",
        label: "Editorial Tagline",
        type: "text",
        placeholder: "Concise positioning line",
      },
      {
        key: "description",
        label: "Case Study Narrative (HTML allowed)",
        type: "textarea",
        placeholder: "Describe the brief, deliverables, and measurable outcome...",
      },
      {
        key: "badge",
        label: "Engagement Role Badge",
        type: "text",
        placeholder: "e.g. On-site Staff or Remote Freelance",
      },
      {
        key: "layout",
        label: "Display Layout",
        type: "select",
        options: ["slider", "grid"],
      },
      {
        key: "sort_order",
        label: "Sort Order",
        type: "number",
        placeholder: "1",
      },
    ],
  },
  [DB_TABLES.PORTFOLIO_ITEMS]: {
    title: "Portfolio Item",
    fields: [
      {
        key: "section_id",
        label: "Parent Section",
        type: "section_select",
        required: true,
      },
      {
        key: "image_url",
        label: "Artifact Image (WebP Upload or URL)",
        type: "image_upload",
        required: true,
        placeholder: "https://...",
        hint: "Uploaded files are automatically resized to max 1600px and compressed to WebP under 200 KB.",
      },
      {
        key: "link_url",
        label: "External Post or Document URL",
        type: "text",
        placeholder: "https://www.instagram.com/p/...",
      },
      {
        key: "type",
        label: "Deliverable Format",
        type: "text",
        placeholder: "e.g. Instagram Feed, Instagram Story, Stage Backdrop",
      },
      {
        key: "button_text",
        label: "Action Button Label",
        type: "text",
        placeholder: "View Post",
      },
      {
        key: "title",
        label: "Artifact Title (Optional)",
        type: "text",
        placeholder: "Project or artifact title",
      },
      {
        key: "description",
        label: "Artifact Description (Optional)",
        type: "textarea",
        placeholder: "Context for archive or playground items...",
      },
      {
        key: "category",
        label: "Discipline Category (Optional)",
        type: "text",
        placeholder: "e.g. Visual Identity, Social Media Management",
      },
      {
        key: "sort_order",
        label: "Sort Order",
        type: "number",
        placeholder: "1",
      },
    ],
  },
  [DB_TABLES.EXPERIENCE]: {
    title: "Work Experience",
    fields: [
      {
        key: "role",
        label: "Role or Position",
        type: "text",
        required: true,
        placeholder: "Graphic Designer",
      },
      {
        key: "company",
        label: "Company or Organization",
        type: "text",
        required: true,
        placeholder: "Company Name",
      },
      {
        key: "company_link",
        label: "Company Website URL",
        type: "text",
        placeholder: "https://...",
      },
      {
        key: "location",
        label: "Location",
        type: "text",
        placeholder: "Jakarta, Indonesia",
      },
      {
        key: "period",
        label: "Engagement Period",
        type: "text",
        placeholder: "Jan 2024 - Present",
      },
      {
        key: "type",
        label: "Engagement Type",
        type: "text",
        placeholder: "On-site / Remote / Freelance",
      },
      {
        key: "description",
        label: "Key Achievements (One bullet per line or JSON array)",
        type: "bullets",
        placeholder: "Designed visual systems for national campaigns\nProduced 20+ event collateral assets",
      },
      {
        key: "is_featured",
        label: "Highlight as Featured Role",
        type: "checkbox",
      },
      {
        key: "sort_order",
        label: "Sort Order",
        type: "number",
        placeholder: "1",
      },
    ],
  },
  [DB_TABLES.EDUCATION]: {
    title: "Education",
    fields: [
      {
        key: "institution",
        label: "University or Institution",
        type: "text",
        required: true,
        placeholder: "University Name",
      },
      {
        key: "institution_link",
        label: "Institution Website URL",
        type: "text",
        placeholder: "https://...",
      },
      {
        key: "period",
        label: "Study Period",
        type: "text",
        placeholder: "2022 - Present",
      },
      {
        key: "degree",
        label: "Degree or Major",
        type: "text",
        placeholder: "Bachelor of Information Systems",
      },
      {
        key: "score_label",
        label: "Academic Metric Label",
        type: "text",
        placeholder: "GPA",
      },
      {
        key: "score_value",
        label: "Academic Metric Value",
        type: "text",
        placeholder: "3.85 / 4.00",
      },
      {
        key: "description",
        label: "Academic Notes (HTML allowed)",
        type: "textarea",
        placeholder: "Coursework, honors, or thesis focus...",
      },
      {
        key: "is_active",
        label: "Currently Enrolled",
        type: "checkbox",
      },
      {
        key: "sort_order",
        label: "Sort Order",
        type: "number",
        placeholder: "1",
      },
    ],
  },
  [DB_TABLES.COMPETENCIES]: {
    title: "Competency or Tool",
    fields: [
      {
        key: "name",
        label: "Tool or Capability Name",
        type: "text",
        required: true,
        placeholder: "e.g. Adobe Illustrator",
      },
      {
        key: "category",
        label: "Group",
        type: "select",
        options: ["arsenal", "other"],
      },
      {
        key: "icon_url",
        label: "Icon URL (Optional)",
        type: "text",
        placeholder: "https://...",
      },
      {
        key: "sort_order",
        label: "Sort Order",
        type: "number",
        placeholder: "1",
      },
    ],
  },
};

export function showToast(message, type = "success") {
  const region = document.getElementById("toast-region");
  if (!region) return;

  const banner = document.createElement("div");
  banner.className = `toast-banner toast-banner--${type}`;
  banner.setAttribute("role", type === "error" ? "alert" : "status");
  banner.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button type="button" class="text-link-btn" style="min-height: 2rem;" aria-label="Dismiss notification">Dismiss</button>
  `;

  const dismissBtn = banner.querySelector("button");
  dismissBtn?.addEventListener("click", () => banner.remove());
  region.appendChild(banner);

  setTimeout(() => {
    if (banner.isConnected) banner.remove();
  }, 4200);
}

function startOverviewClock() {
  const greetingEl = document.getElementById("overview-greeting");
  const dateEl = document.getElementById("overview-date");
  const clockEl = document.getElementById("overview-clock");
  const tzEl = document.getElementById("overview-timezone");

  function tick() {
    const now = new Date();
    const hour = now.getHours();
    if (greetingEl) {
      greetingEl.textContent =
        hour < 12
          ? "Good Morning"
          : hour < 17
            ? "Good Afternoon"
            : "Good Evening";
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    }
    if (tzEl) {
      tzEl.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  }

  tick();
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(tick, 1000);
}

async function loadOverviewSummary() {
  const container = document.getElementById("overview-stats-container");
  if (!container) return;

  renderLoadingState(container, {
    title: "Loading live database counts",
    count: 3,
  });

  try {
    const [sectionsRes, itemsRes, expRes, eduRes, compRes, msgRes] =
      await Promise.all([
        supabase
          .from(DB_TABLES.PORTFOLIO_SECTIONS)
          .select("*", { count: "exact", head: true }),
        supabase
          .from(DB_TABLES.PORTFOLIO_ITEMS)
          .select("*", { count: "exact", head: true }),
        supabase
          .from(DB_TABLES.EXPERIENCE)
          .select("*", { count: "exact", head: true }),
        supabase
          .from(DB_TABLES.EDUCATION)
          .select("*", { count: "exact", head: true }),
        supabase
          .from(DB_TABLES.COMPETENCIES)
          .select("*", { count: "exact", head: true }),
        supabase
          .from(DB_TABLES.MESSAGES)
          .select("*", { count: "exact", head: true }),
      ]);

    const failedQuery = [
      sectionsRes,
      itemsRes,
      expRes,
      eduRes,
      compRes,
      msgRes,
    ].find((res) => res?.error);
    if (failedQuery?.error) throw failedQuery.error;

    const cards = [
      {
        tab: "inbox",
        label: "Project Inquiries",
        count: msgRes.count ?? 0,
        action: "Open Inbox",
      },
      {
        tab: "portfolio-sections",
        label: "Campaign Sections",
        count: sectionsRes.count ?? 0,
        action: "Manage Sections",
      },
      {
        tab: "portfolio-items",
        label: "Portfolio Artifacts",
        count: itemsRes.count ?? 0,
        action: "Manage Items",
      },
      {
        tab: "experience",
        label: "Work Experience",
        count: expRes.count ?? 0,
        action: "Manage Roles",
      },
      {
        tab: "education",
        label: "Education Records",
        count: eduRes.count ?? 0,
        action: "Manage Degrees",
      },
      {
        tab: "competencies",
        label: "Tools & Capabilities",
        count: compRes.count ?? 0,
        action: "Manage Toolset",
      },
    ];

    container.innerHTML = `
      <div class="stats-ledger">
        ${cards
          .map(
            (card) => `
          <button
            type="button"
            class="stat-panel"
            data-jump-tab="${escapeHtml(card.tab)}"
          >
            <span class="text-caption">${escapeHtml(card.label)}</span>
            <span class="stat-value">${card.count}</span>
            <span class="text-body-sm text-secondary">${escapeHtml(card.action)}</span>
          </button>
        `,
          )
          .join("")}
      </div>
    `;

    container.querySelectorAll("[data-jump-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-jump-tab");
        if (targetTab) switchAdminTab(targetTab);
      });
    });
  } catch (error) {
    renderErrorState(container, {
      title: "Unable to load overview summary",
      message: error?.message || "Check your connection and retry.",
      onRetry: loadOverviewSummary,
    });
  }
}

function openConfirmModal({ title, message, onConfirm, triggerEl } = {}) {
  const dialog = document.getElementById("confirm-dialog");
  const titleEl = document.getElementById("confirm-dialog-title");
  const msgEl = document.getElementById("confirm-dialog-message");
  if (!dialog) return;

  if (titleEl) titleEl.textContent = title || "Confirm action";
  if (msgEl) msgEl.textContent = message || "This action cannot be undone.";
  pendingConfirmAction = onConfirm || null;

  openModalDialog(dialog, triggerEl);
}

function openFormModal(table, existingRecord = null, triggerEl = document.activeElement) {
  const dialog = document.getElementById("crud-dialog");
  const titleEl = document.getElementById("crud-dialog-title");
  const fieldsContainer = document.getElementById("crud-form-fields");
  const submitBtn = document.getElementById("crud-submit-btn");
  const schema = FORM_SCHEMAS[table];
  if (!dialog || !fieldsContainer || !schema) return;

  const isEdit = Boolean(
    existingRecord &&
      existingRecord.id !== undefined &&
      existingRecord.id !== null,
  );
  activeModalConfig = {
    table,
    mode: isEdit ? "edit" : "create",
    editId: isEdit ? existingRecord.id : null,
  };

  if (titleEl) {
    titleEl.textContent = `${isEdit ? "Edit" : "New"} ${schema.title}`;
  }
  if (submitBtn) {
    submitBtn.textContent = isEdit ? "Save Changes" : "Create Record";
  }

  const sections = getSectionsCache();

  fieldsContainer.innerHTML = schema.fields
    .map((field) => {
      const rawVal = existingRecord ? (existingRecord[field.key] ?? "") : "";
      const isLocked = isEdit && field.lockOnEdit;
      const reqAttr = field.required ? "required" : "";
      const disabledAttr = isLocked ? "disabled" : "";
      const inputId = `crud-field-${field.key}`;

      const hintHtml = field.hint
        ? `<p class="form-hint">${escapeHtml(field.hint)}</p>`
        : "";

      if (field.type === "checkbox") {
        return `
          <div class="checkbox-row">
            <input
              type="checkbox"
              id="${escapeHtml(inputId)}"
              name="${escapeHtml(field.key)}"
              ${rawVal ? "checked" : ""}
            />
            <label for="${escapeHtml(inputId)}" class="form-label">${escapeHtml(field.label)}</label>
          </div>
        `;
      }

      if (field.type === "select") {
        return `
          <div class="form-group">
            <label for="${escapeHtml(inputId)}" class="form-label">${escapeHtml(field.label)}</label>
            <select
              id="${escapeHtml(inputId)}"
              name="${escapeHtml(field.key)}"
              class="form-select"
              ${disabledAttr}
            >
              ${field.options
                .map(
                  (opt) =>
                    `<option value="${escapeHtml(opt)}" ${rawVal === opt ? "selected" : ""}>${escapeHtml(opt)}</option>`,
                )
                .join("")}
            </select>
          </div>
        `;
      }

      if (field.type === "section_select") {
        return `
          <div class="form-group">
            <label for="${escapeHtml(inputId)}" class="form-label">${escapeHtml(field.label)}</label>
            <select
              id="${escapeHtml(inputId)}"
              name="${escapeHtml(field.key)}"
              class="form-select"
              required
            >
              <option value="">Select section...</option>
              ${sections
                .map(
                  (sec) =>
                    `<option value="${escapeHtml(sec.id)}" ${rawVal === sec.id ? "selected" : ""}>${escapeHtml(getSectionDisplayTitle(sec))}</option>`,
                )
                .join("")}
            </select>
          </div>
        `;
      }

      if (field.type === "image_upload") {
        return `
          <div class="form-group">
            <label for="${escapeHtml(inputId)}" class="form-label">${escapeHtml(field.label)}</label>
            ${hintHtml}
            <div class="upload-panel">
              <input
                type="file"
                id="crud-webp-file-input"
                accept="image/png,image/jpeg,image/webp"
                class="form-input"
              />
              <p id="crud-webp-status" class="text-caption">Select a local image to compress to WebP (&lt; 200 KB, max 1600px) and upload to Supabase Storage.</p>
            </div>
            <input
              type="text"
              id="${escapeHtml(inputId)}"
              name="${escapeHtml(field.key)}"
              value="${escapeHtml(String(rawVal))}"
              placeholder="${escapeHtml(field.placeholder || "")}"
              class="form-input"
              ${reqAttr}
            />
          </div>
        `;
      }

      if (field.type === "bullets") {
        const bulletsText = parseDescriptionList(rawVal).join("\n");
        return `
          <div class="form-group">
            <label for="${escapeHtml(inputId)}" class="form-label">${escapeHtml(field.label)}</label>
            <textarea
              id="${escapeHtml(inputId)}"
              name="${escapeHtml(field.key)}"
              rows="4"
              placeholder="${escapeHtml(field.placeholder || "")}"
              class="form-textarea"
            >${escapeHtml(bulletsText)}</textarea>
          </div>
        `;
      }

      if (field.type === "textarea") {
        return `
          <div class="form-group">
            <label for="${escapeHtml(inputId)}" class="form-label">${escapeHtml(field.label)}</label>
            <textarea
              id="${escapeHtml(inputId)}"
              name="${escapeHtml(field.key)}"
              rows="3"
              placeholder="${escapeHtml(field.placeholder || "")}"
              class="form-textarea"
              ${reqAttr}
            >${escapeHtml(String(rawVal))}</textarea>
          </div>
        `;
      }

      return `
        <div class="form-group">
          <label for="${escapeHtml(inputId)}" class="form-label">${escapeHtml(field.label)}</label>
          ${hintHtml}
          <input
            type="${escapeHtml(field.type)}"
            id="${escapeHtml(inputId)}"
            name="${escapeHtml(field.key)}"
            value="${escapeHtml(String(rawVal))}"
            placeholder="${escapeHtml(field.placeholder || "")}"
            class="form-input"
            ${reqAttr}
            ${disabledAttr}
          />
        </div>
      `;
    })
    .join("");

  const fileInput = document.getElementById("crud-webp-file-input");
  const uploadStatus = document.getElementById("crud-webp-status");
  const urlInput = document.getElementById("crud-field-image_url");
  const sectionSelect = document.getElementById("crud-field-section_id");

  if (fileInput && urlInput) {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const targetSection = sectionSelect?.value || "general";
      if (uploadStatus) {
        uploadStatus.textContent = "Compressing image to WebP (max 1600px, < 200 KB) and uploading...";
      }
      if (submitBtn) submitBtn.disabled = true;

      try {
        const result = await uploadPortfolioWebP(file, targetSection);
        urlInput.value = result.publicUrl;
        if (uploadStatus) {
          uploadStatus.textContent = `Uploaded WebP (${result.sizeKb} KB, ${result.width}x${result.height}px) with 1-year Cache-Control.`;
        }
        showToast(`Compressed and uploaded WebP (${result.sizeKb} KB).`);
      } catch (error) {
        if (uploadStatus) {
          uploadStatus.textContent =
            error?.message || "Upload failed. You can still paste a direct image URL below.";
        }
        showToast(error?.message || "Image upload failed.", "error");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  openModalDialog(dialog, triggerEl);
}

function getSharedCallbacks() {
  return {
    openFormModal,
    openConfirmModal,
    showToast,
    onCountsChanged: () => {
      updateInboxUnreadBadge();
    },
  };
}

function switchAdminTab(tabName) {
  currentTab = tabName;

  document.querySelectorAll(".admin-view").forEach((view) => {
    const isTarget = view.id === `view-${tabName}`;
    view.classList.toggle("is-active", isTarget);
    view.hidden = !isTarget;
  });

  document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
    const isCurrent = btn.getAttribute("data-admin-tab") === tabName;
    btn.classList.toggle("is-active", isCurrent);
    if (isCurrent) {
      btn.setAttribute("aria-current", "page");
    } else {
      btn.removeAttribute("aria-current");
    }
  });

  const sidebar = document.getElementById("admin-sidebar");
  const navToggle = document.getElementById("admin-nav-toggle");
  if (sidebar && navToggle) {
    sidebar.setAttribute("data-open", "false");
    navToggle.setAttribute("aria-expanded", "false");
  }

  const callbacks = getSharedCallbacks();
  if (tabName === "overview") loadOverviewSummary();
  else if (tabName === "inbox") loadInbox(callbacks);
  else if (tabName === "portfolio-sections") loadPortfolioSections(callbacks);
  else if (tabName === "portfolio-items") loadPortfolioItems(callbacks);
  else if (tabName === "experience") loadAdminExperience(callbacks);
  else if (tabName === "education") loadAdminEducation(callbacks);
  else if (tabName === "competencies") loadAdminCompetencies(callbacks);
}

function initAdminModalsAndControls() {
  const crudDialog = document.getElementById("crud-dialog");
  const crudForm = document.getElementById("crud-form");
  const confirmDialog = document.getElementById("confirm-dialog");
  const confirmAcceptBtn = document.getElementById("confirm-accept-btn");
  const filterSelect = document.getElementById("items-section-filter");
  const navToggle = document.getElementById("admin-nav-toggle");
  const sidebar = document.getElementById("admin-sidebar");
  const accountToggle = document.getElementById("admin-account-toggle");
  const accountMenu = document.getElementById("admin-account-menu");

  function closeSidebar() {
    if (!sidebar || !navToggle) return;
    sidebar.setAttribute("data-open", "false");
    navToggle.setAttribute("aria-expanded", "false");
  }

  function closeAccountMenu() {
    if (!accountToggle || !accountMenu) return;
    accountMenu.setAttribute("data-open", "false");
    accountToggle.setAttribute("aria-expanded", "false");
  }

  if (navToggle && sidebar) {
    navToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = sidebar.getAttribute("data-open") === "true";
      sidebar.setAttribute("data-open", String(!isOpen));
      navToggle.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) closeAccountMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        sidebar.getAttribute("data-open") === "true" &&
        !document.querySelector("dialog[open]")
      ) {
        closeSidebar();
        navToggle.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (
        sidebar.getAttribute("data-open") === "true" &&
        !sidebar.contains(event.target) &&
        !navToggle.contains(event.target)
      ) {
        closeSidebar();
      }
    });
  }

  if (accountToggle && accountMenu) {
    accountToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = accountMenu.getAttribute("data-open") === "true";
      accountMenu.setAttribute("data-open", String(!isOpen));
      accountToggle.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) closeSidebar();
    });

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        accountMenu.getAttribute("data-open") === "true" &&
        !document.querySelector("dialog[open]")
      ) {
        closeAccountMenu();
        accountToggle.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (
        accountMenu.getAttribute("data-open") === "true" &&
        !accountMenu.contains(event.target) &&
        !accountToggle.contains(event.target)
      ) {
        closeAccountMenu();
      }
    });

    accountMenu.querySelectorAll("a, button").forEach((el) => {
      el.addEventListener("click", () => {
        closeAccountMenu();
      });
    });
  }

  document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-admin-tab");
      if (tab) switchAdminTab(tab);
    });
  });

  document.querySelectorAll("[data-create-record]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const table = btn.getAttribute("data-create-record");
      if (table) openFormModal(table, null, btn);
    });
  });

  if (filterSelect) {
    filterSelect.addEventListener("change", () => {
      loadPortfolioItems(getSharedCallbacks());
    });
  }

  document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dialog = btn.closest("dialog");
      if (dialog) closeModalDialog(dialog);
    });
  });

  if (confirmAcceptBtn && confirmDialog) {
    confirmAcceptBtn.addEventListener("click", async () => {
      if (typeof pendingConfirmAction === "function") {
        confirmAcceptBtn.disabled = true;
        try {
          await pendingConfirmAction();
        } finally {
          confirmAcceptBtn.disabled = false;
          pendingConfirmAction = null;
        }
      }
      closeModalDialog(confirmDialog);
    });
  }

  if (crudForm && crudDialog) {
    crudForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!activeModalConfig) return;

      const { table, mode, editId } = activeModalConfig;
      const schema = FORM_SCHEMAS[table];
      if (!schema) return;

      for (const el of crudForm.elements) {
        if (
          el.disabled ||
          el.type === "file" ||
          el.type === "checkbox" ||
          el.tagName === "SELECT" ||
          el.tagName === "BUTTON"
        ) {
          continue;
        }
        if (typeof el.value === "string") {
          el.value = el.value.trim();
        }
      }

      let firstInvalidField = null;
      let firstInvalidLabel = "";

      for (const field of schema.fields) {
        if (mode === "edit" && field.lockOnEdit) continue;
        const inputEl = crudForm.querySelector(`[name="${field.key}"]`);
        if (!inputEl) continue;

        const isEmptyRequired =
          field.required &&
          field.type !== "checkbox" &&
          String(inputEl.value || "").trim() === "";

        if (isEmptyRequired || !inputEl.checkValidity()) {
          firstInvalidField = inputEl;
          firstInvalidLabel = field.label || field.key;
          break;
        }
      }

      if (!firstInvalidField && !crudForm.checkValidity()) {
        firstInvalidField = crudForm.querySelector(":invalid");
        firstInvalidLabel =
          firstInvalidField?.getAttribute("name") || "required field";
      }

      if (firstInvalidField) {
        crudForm.reportValidity();
        firstInvalidField.focus();
        showToast(
          `Please complete "${firstInvalidLabel}" with a valid value.`,
          "error",
        );
        return;
      }

      const formData = new FormData(crudForm);
      const record = {};

      schema.fields.forEach((field) => {
        if (mode === "edit" && field.lockOnEdit) return;

        if (field.type === "checkbox") {
          const checkbox = crudForm.querySelector(`[name="${field.key}"]`);
          record[field.key] = Boolean(checkbox?.checked);
        } else if (field.type === "number") {
          const val = formData.get(field.key);
          record[field.key] = val ? Number.parseInt(String(val), 10) : 0;
        } else if (field.type === "bullets") {
          const rawText = String(formData.get(field.key) || "").trim();
          if (!rawText) {
            record[field.key] = JSON.stringify([]);
          } else {
            const list = parseDescriptionList(rawText);
            const lines =
              list.length > 1
                ? list
                : rawText
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);
            record[field.key] = JSON.stringify(lines);
          }
        } else {
          const val = String(formData.get(field.key) || "").trim();
          record[field.key] = val || null;
        }
      });

      const submitBtn = document.getElementById("crud-submit-btn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
      }

      try {
        if (mode === "create") {
          const { error } = await supabase.from(table).insert([record]);
          if (error) throw error;
          showToast(`${schema.title} created.`);
        } else {
          const { error } = await supabase
            .from(table)
            .update(record)
            .eq("id", editId);
          if (error) throw error;
          showToast(`${schema.title} updated.`);
        }

        if (
          table === DB_TABLES.PORTFOLIO_SECTIONS ||
          table === DB_TABLES.PORTFOLIO_ITEMS
        ) {
          invalidatePublicPortfolioCache();
        }

        closeModalDialog(crudDialog);
        switchAdminTab(currentTab);
      } catch (error) {
        showToast(error?.message || "Unable to save record.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent =
            mode === "edit" ? "Save Changes" : "Create Record";
        }
      }
    });
  }

  initInboxControls(getSharedCallbacks());
}

document.addEventListener("DOMContentLoaded", () => {
  const authScreen = document.getElementById("auth-screen");
  const adminShell = document.getElementById("admin-shell");
  const userEmailEl = document.getElementById("admin-user-email");

  initAdminModalsAndControls();

  initAuth({
    onAuthenticated(user) {
      if (authScreen) authScreen.hidden = true;
      if (adminShell) adminShell.hidden = false;
      if (userEmailEl) userEmailEl.textContent = user.email || "Authenticated";
      startOverviewClock();
      updateInboxUnreadBadge();
      switchAdminTab(currentTab);
    },
    onSignedOut() {
      if (adminShell) adminShell.hidden = true;
      if (authScreen) authScreen.hidden = false;
      if (clockTimer) clearInterval(clockTimer);
    },
  });
});
