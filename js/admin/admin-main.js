import { DB_TABLES, supabase } from "../config/supabase-client.js";
import {
  closeModalDialog,
  escapeHtml,
  normalizeDashes,
  openModalDialog,
  parseDescriptionList,
  renderErrorState,
  renderLoadingState,
  sanitizeUrl,
} from "../utils/dom.js";
import { initAuth } from "./auth.js";
import {
  initInfrastructureControls,
  loadInfrastructureMetrics,
} from "./analytics-overview.js";
import {
  getSectionDisplayTitle,
  getSectionsCache,
  invalidatePublicPortfolioCache,
  loadPortfolioItems,
  loadPortfolioSections,
  uploadCompetencyIcon,
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
import {
  dismissOpenCityPicker,
  initCityPickers,
  renderCityComboboxFieldHtml,
  validateCityPickerField,
} from "./city-picker.js";
import {
  dismissOpenRichLinkBar,
  initRichEditors,
  renderRichEditorFieldHtml,
  serializeRichEditorValue,
} from "./rich-editor.js";

let currentTab = "overview";
let clockTimer = null;
let activeModalConfig = null;
let pendingConfirmAction = null;
const activeFieldCleanups = [];

function runActiveFieldCleanups() {
  while (activeFieldCleanups.length > 0) {
    const cleanupFn = activeFieldCleanups.pop();
    if (typeof cleanupFn === "function") cleanupFn();
  }
}

function formatMetricsFieldValue(rawMetrics) {
  if (!rawMetrics) return "";
  let list = rawMetrics;
  if (typeof rawMetrics === "string") {
    try {
      list = JSON.parse(rawMetrics);
    } catch {
      return "";
    }
  }
  if (!Array.isArray(list)) return "";
  return list
    .filter((item) => item && (item.label || item.value))
    .map(
      (item) =>
        `${String(item.label || "").trim()} | ${String(item.value || "").trim()}`,
    )
    .join("\n");
}

function parseMetricsFieldInput(rawText) {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) return { metrics: [], invalidLine: null };

  const metrics = [];
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const pipeIdx = line.indexOf("|");
    if (pipeIdx === -1) {
      return { metrics: [], invalidLine: line };
    }
    const label = line.slice(0, pipeIdx).trim();
    const value = line.slice(pipeIdx + 1).trim();
    if (!label || !value) {
      return { metrics: [], invalidLine: line };
    }
    metrics.push({ label, value });
  }

  return { metrics, invalidLine: null };
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_LOOKUP = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function parseMonthYearPart(partText) {
  const clean = String(partText || "").trim();
  if (!clean) return { month: null, year: null };

  const monthYearMatch = clean.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (monthYearMatch) {
    const monthNum = MONTH_LOOKUP[monthYearMatch[1].toLowerCase()] || null;
    const yearNum = Number.parseInt(monthYearMatch[2], 10);
    return { month: monthNum, year: yearNum };
  }

  const yearOnlyMatch = clean.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    return { month: null, year: Number.parseInt(yearOnlyMatch[1], 10) };
  }

  return { month: null, year: null };
}

export function parsePeriodString(rawPeriod, fallbackOngoing = false) {
  const normalized = normalizeDashes(String(rawPeriod || "")).trim();
  if (!normalized) {
    return {
      startMonth: null,
      startYear: null,
      endMonth: null,
      endYear: null,
      isOngoing: Boolean(fallbackOngoing),
    };
  }

  const parts = normalized
    .split(/\s*-\s*|\s+to\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const start = parseMonthYearPart(parts[0] || "");
  const rightRaw = parts[1] || "";
  const isPresent = /\b(present|current|now|ongoing)\b/i.test(rightRaw);

  if (isPresent || (!rightRaw && fallbackOngoing)) {
    return {
      startMonth: start.month,
      startYear: start.year,
      endMonth: null,
      endYear: null,
      isOngoing: true,
    };
  }

  const end = parseMonthYearPart(rightRaw);
  return {
    startMonth: start.month,
    startYear: start.year,
    endMonth: end.month,
    endYear: end.year,
    isOngoing: Boolean(fallbackOngoing),
  };
}

export function serializePeriodSelection({
  startMonth,
  startYear,
  endMonth,
  endYear,
  isOngoing,
}) {
  const sMonth = Number.parseInt(String(startMonth || ""), 10);
  const sYear = Number.parseInt(String(startYear || ""), 10);

  if (!sMonth || sMonth < 1 || sMonth > 12 || !sYear) {
    return { value: null, error: "Select both a Start Month and Start Year." };
  }

  const startLabel = `${MONTH_LABELS[sMonth - 1]} ${sYear}`;
  if (isOngoing) {
    return { value: `${startLabel} - Present`, error: null };
  }

  const eMonth = Number.parseInt(String(endMonth || ""), 10);
  const eYear = Number.parseInt(String(endYear || ""), 10);
  if (!eMonth || eMonth < 1 || eMonth > 12 || !eYear) {
    return {
      value: null,
      error: "Select an End Month and End Year, or mark the period as Present.",
    };
  }

  if (eYear * 12 + eMonth < sYear * 12 + sMonth) {
    return {
      value: null,
      error: "End date cannot be earlier than start date.",
    };
  }

  const endLabel = `${MONTH_LABELS[eMonth - 1]} ${eYear}`;
  return { value: `${startLabel} - ${endLabel}`, error: null };
}

function buildYearOptionsList(...extraYears) {
  const maxYear = new Date().getFullYear() + 1;
  const years = new Set();
  for (let y = maxYear; y >= 2010; y -= 1) {
    years.add(y);
  }
  extraYears.forEach((yr) => {
    if (Number.isInteger(yr) && yr >= 1970 && yr <= maxYear + 5) {
      years.add(yr);
    }
  });
  return Array.from(years).sort((a, b) => b - a);
}

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
        label: "Case Study Narrative",
        type: "richtext",
        placeholder: "Describe the brief, deliverables, and measurable outcome...",
      },
      {
        key: "badge",
        label: "Engagement Role Badge",
        type: "text",
        placeholder: "e.g. On-site Staff or Remote Freelance",
      },
      {
        key: "metrics",
        label: "Highlight Metrics (Optional: Label | Value, one per line)",
        type: "metrics",
        placeholder:
          "Festival Visitors Reached | 261,000+\nDigital & Environmental Assets | 20+",
      },
      {
        key: "layout",
        label: "Display Layout",
        type: "select",
        options: [
          { value: "spotlight", label: "Spotlight (Featured Dark Band)" },
          { value: "slider", label: "Slider (Curated Work Carousel)" },
          { value: "grid", label: "Grid (Experimental Archive)" },
        ],
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
        type: "location_search",
        placeholder: "Search city worldwide (e.g. Jakarta, Tokyo, London)...",
      },
      {
        key: "period",
        label: "Engagement Period",
        type: "period_range",
        ongoingLabel: "Currently working here (Present)",
      },
      {
        key: "type",
        label: "Engagement Type",
        type: "select",
        allowEmpty: true,
        emptyLabel: "Select work type (optional)...",
        preserveCustom: true,
        options: ["On-site", "Remote", "Hybrid", "Freelance", "Volunteer"],
      },
      {
        key: "description",
        label: "Key Achievements",
        type: "bullets",
        placeholder: "Designed visual systems for national campaigns",
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
        type: "period_range",
        ongoingLabel: "Currently Enrolled (Present)",
        syncCheckboxKey: "is_active",
      },
      {
        key: "degree",
        label: "Degree or Major",
        type: "text",
        placeholder: "Bachelor of Information Systems",
      },
      {
        key: "score_value",
        label: "GPA (Optional)",
        type: "text",
        placeholder: "e.g. 3.67",
        hint: "Leave blank for non-GPA records (such as high school).",
      },
      {
        key: "description",
        label: "Academic Notes",
        type: "richtext",
        placeholder: "Coursework, honors, or thesis focus...",
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
        options: [
          { value: "arsenal", label: "Core Creative Software (arsenal)" },
          {
            value: "other",
            label: "Strategic & Production Capabilities (other)",
          },
        ],
      },
      {
        key: "icon_url",
        label: "Software Icon (SVG, WebP, PNG, JPG, or URL)",
        type: "icon_upload",
        placeholder: "https://... or /images/...",
        hint: "SVGs are sanitized (< 100 KB); raster icons are resized to 128px WebP (< 40 KB).",
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
    <button type="button" class="text-link-btn toast-dismiss" aria-label="Dismiss notification">Dismiss</button>
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
    existingRecord && String(existingRecord.id ?? "").trim() !== "",
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
  runActiveFieldCleanups();

  fieldsContainer.innerHTML = schema.fields
    .map((field) => {
      const rawVal = existingRecord ? (existingRecord[field.key] ?? "") : "";
      const isLocked = Boolean(isEdit && field.lockOnEdit);
      const reqAttr = field.required && !isLocked ? "required" : "";
      const disabledAttr = isLocked ? "disabled" : "";
      const lockedAttrs = isLocked
        ? 'disabled readonly aria-disabled="true" tabindex="-1"'
        : "";
      const inputClass = isLocked
        ? "form-input form-input--locked"
        : "form-input";
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
        const strVal = String(rawVal ?? "").trim();
        const optionEntries = field.options.map((opt) =>
          typeof opt === "object" ? opt : { value: opt, label: opt },
        );
        const hasMatch = optionEntries.some((opt) => opt.value === strVal);
        if (field.preserveCustom && strVal && !hasMatch) {
          optionEntries.push({ value: strVal, label: strVal });
        }

        const emptyOptionHtml = field.allowEmpty
          ? `<option value="" ${strVal === "" ? "selected" : ""}>${escapeHtml(field.emptyLabel || "Select option...")}</option>`
          : "";

        return `
          <div class="form-group">
            <label for="${escapeHtml(inputId)}" class="form-label">${escapeHtml(field.label)}</label>
            <select
              id="${escapeHtml(inputId)}"
              name="${escapeHtml(field.key)}"
              class="form-select"
              ${disabledAttr}
            >
              ${emptyOptionHtml}
              ${optionEntries
                .map(
                  (opt) =>
                    `<option value="${escapeHtml(opt.value)}" ${strVal === opt.value ? "selected" : ""}>${escapeHtml(opt.label)}</option>`,
                )
                .join("")}
            </select>
          </div>
        `;
      }

      if (field.type === "location_search") {
        return renderCityComboboxFieldHtml({
          inputId,
          name: field.key,
          label: field.label,
          rawValue: rawVal,
          placeholder: field.placeholder || "",
          hint: field.hint || "",
        });
      }

      if (field.type === "period_range") {
        const syncActive = field.syncCheckboxKey
          ? Boolean(existingRecord?.[field.syncCheckboxKey])
          : false;
        const parsed = parsePeriodString(rawVal, syncActive);
        const years = buildYearOptionsList(parsed.startYear, parsed.endYear);
        const ongoingId = field.syncCheckboxKey
          ? `crud-field-${field.syncCheckboxKey}`
          : `crud-field-${field.key}-ongoing`;
        const ongoingNameAttr = field.syncCheckboxKey
          ? `name="${escapeHtml(field.syncCheckboxKey)}"`
          : "";
        const endDisabledAttr = parsed.isOngoing
          ? 'disabled aria-disabled="true"'
          : "";

        const renderMonthOptions = (selectedMonth, placeholderLabel) =>
          `<option value="">${escapeHtml(placeholderLabel)}</option>` +
          MONTH_LABELS.map(
            (mLabel, idx) =>
              `<option value="${idx + 1}" ${selectedMonth === idx + 1 ? "selected" : ""}>${mLabel}</option>`,
          ).join("");

        const renderYearOptions = (selectedYear, placeholderLabel) =>
          `<option value="">${escapeHtml(placeholderLabel)}</option>` +
          years
            .map(
              (yr) =>
                `<option value="${yr}" ${selectedYear === yr ? "selected" : ""}>${yr}</option>`,
            )
            .join("");

        return `
          <fieldset class="form-group period-picker" data-period-picker="${escapeHtml(field.key)}">
            <legend class="form-label">${escapeHtml(field.label)}</legend>
            <div class="period-picker-block">
              <span class="period-picker-sublabel">Start Date</span>
              <div class="period-picker-grid">
                <div>
                  <label for="${escapeHtml(inputId)}-start-month" class="sr-only">Start Month</label>
                  <select id="${escapeHtml(inputId)}-start-month" class="form-select" data-period-start-month>
                    ${renderMonthOptions(parsed.startMonth, "Start Month")}
                  </select>
                </div>
                <div>
                  <label for="${escapeHtml(inputId)}-start-year" class="sr-only">Start Year</label>
                  <select id="${escapeHtml(inputId)}-start-year" class="form-select" data-period-start-year>
                    ${renderYearOptions(parsed.startYear, "Start Year")}
                  </select>
                </div>
              </div>
            </div>

            <div class="checkbox-row period-ongoing-row">
              <input
                type="checkbox"
                id="${escapeHtml(ongoingId)}"
                ${ongoingNameAttr}
                data-period-ongoing
                ${parsed.isOngoing ? "checked" : ""}
              />
              <label for="${escapeHtml(ongoingId)}" class="form-label">${escapeHtml(field.ongoingLabel || "Present")}</label>
            </div>

            <div class="period-picker-block" data-period-end-block data-disabled="${String(parsed.isOngoing)}">
              <span class="period-picker-sublabel">End Date</span>
              <div class="period-picker-grid">
                <div>
                  <label for="${escapeHtml(inputId)}-end-month" class="sr-only">End Month</label>
                  <select id="${escapeHtml(inputId)}-end-month" class="form-select" data-period-end-month ${endDisabledAttr}>
                    ${renderMonthOptions(parsed.endMonth, "End Month")}
                  </select>
                </div>
                <div>
                  <label for="${escapeHtml(inputId)}-end-year" class="sr-only">End Year</label>
                  <select id="${escapeHtml(inputId)}-end-year" class="form-select" data-period-end-year ${endDisabledAttr}>
                    ${renderYearOptions(parsed.endYear, "End Year")}
                  </select>
                </div>
              </div>
            </div>
          </fieldset>
        `;
      }

      if (field.type === "icon_upload") {
        const currentCategory = String(
          existingRecord?.category || "arsenal",
        ).toLowerCase();
        const isHidden = currentCategory === "other";
        const safePreviewUrl = sanitizeUrl(String(rawVal || ""));

        return `
          <div class="form-group" id="crud-icon-upload-group" ${isHidden ? "hidden" : ""}>
            <label for="${escapeHtml(inputId)}" class="form-label">${escapeHtml(field.label)}</label>
            ${hintHtml}
            <div class="upload-panel">
              <input
                type="file"
                id="crud-icon-file-input"
                accept=".svg,image/svg+xml,image/webp,image/png,image/jpeg"
                class="form-input"
              />
              <p id="crud-icon-status" class="text-caption">Upload an SVG or raster icon, or paste an icon URL below.</p>
            </div>
            <div class="icon-upload-url-row">
              <div class="icon-upload-preview" id="crud-icon-preview" aria-hidden="true">
                ${
                  safePreviewUrl
                    ? `<img src="${escapeHtml(safePreviewUrl)}" alt="" width="28" height="28" />`
                    : '<span class="text-caption">None</span>'
                }
              </div>
              <input
                type="text"
                id="${escapeHtml(inputId)}"
                name="${escapeHtml(field.key)}"
                value="${escapeHtml(String(rawVal))}"
                placeholder="${escapeHtml(field.placeholder || "")}"
                class="form-input"
              />
            </div>
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

      if (field.type === "metrics") {
        const metricsText = formatMetricsFieldValue(rawVal);
        return `
          <div class="form-group">
            <label for="${escapeHtml(inputId)}" class="form-label">${escapeHtml(field.label)}</label>
            ${hintHtml}
            <textarea
              id="${escapeHtml(inputId)}"
              name="${escapeHtml(field.key)}"
              rows="4"
              placeholder="${escapeHtml(field.placeholder || "")}"
              class="form-textarea"
            >${escapeHtml(metricsText)}</textarea>
          </div>
        `;
      }

      if (field.type === "richtext" || field.type === "bullets") {
        return renderRichEditorFieldHtml({
          inputId,
          name: field.key,
          label: field.label,
          hint: field.hint || "",
          mode: field.type === "bullets" ? "bullets" : "prose",
          rawValue: rawVal,
          placeholder: field.placeholder || "",
        });
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
            class="${inputClass}"
            ${reqAttr}
            ${lockedAttrs}
          />
        </div>
      `;
    })
    .join("");

  const cleanupRich = initRichEditors(fieldsContainer, { showToast });
  const cleanupCity = initCityPickers(fieldsContainer);
  if (typeof cleanupRich === "function") activeFieldCleanups.push(cleanupRich);
  if (typeof cleanupCity === "function") activeFieldCleanups.push(cleanupCity);

  fieldsContainer.querySelectorAll("[data-period-picker]").forEach((pickerEl) => {
    const ongoingCb = pickerEl.querySelector("[data-period-ongoing]");
    const endBlock = pickerEl.querySelector("[data-period-end-block]");
    const endMonth = pickerEl.querySelector("[data-period-end-month]");
    const endYear = pickerEl.querySelector("[data-period-end-year]");

    ongoingCb?.addEventListener("change", () => {
      const isOngoing = Boolean(ongoingCb.checked);
      if (endBlock) endBlock.setAttribute("data-disabled", String(isOngoing));
      [endMonth, endYear].forEach((sel) => {
        if (!sel) return;
        sel.disabled = isOngoing;
        if (isOngoing) sel.setAttribute("aria-disabled", "true");
        else sel.removeAttribute("aria-disabled");
      });
    });
  });

  const categorySelect = document.getElementById("crud-field-category");
  const iconUploadGroup = document.getElementById("crud-icon-upload-group");
  const iconFileInput = document.getElementById("crud-icon-file-input");
  const iconStatus = document.getElementById("crud-icon-status");
  const iconPreview = document.getElementById("crud-icon-preview");
  const iconUrlInput = document.getElementById("crud-field-icon_url");

  function updateIconPreviewBox(rawUrl) {
    if (!iconPreview) return;
    const safeUrl = sanitizeUrl(String(rawUrl || "").trim());
    if (!safeUrl) {
      iconPreview.innerHTML = '<span class="text-caption">None</span>';
      return;
    }
    iconPreview.innerHTML = `<img src="${escapeHtml(safeUrl)}" alt="" width="28" height="28" />`;
    const imgEl = iconPreview.querySelector("img");
    imgEl?.addEventListener("error", () => {
      iconPreview.innerHTML = '<span class="text-caption">None</span>';
    });
  }

  if (categorySelect && iconUploadGroup) {
    categorySelect.addEventListener("change", () => {
      iconUploadGroup.hidden = categorySelect.value === "other";
    });
  }

  if (iconUrlInput) {
    iconUrlInput.addEventListener("input", () => {
      updateIconPreviewBox(iconUrlInput.value);
    });
  }

  if (iconFileInput && iconUrlInput) {
    iconFileInput.addEventListener("change", async () => {
      const file = iconFileInput.files?.[0];
      if (!file) return;

      if (iconStatus) {
        iconStatus.textContent = "Sanitizing/compressing icon and uploading...";
      }
      if (submitBtn) submitBtn.disabled = true;

      try {
        const result = await uploadCompetencyIcon(file);
        iconUrlInput.value = result.publicUrl;
        updateIconPreviewBox(result.publicUrl);
        if (iconStatus) {
          iconStatus.textContent = `Uploaded ${result.format} icon (${result.sizeKb} KB) to Supabase Storage.`;
        }
        showToast(`Uploaded ${result.format} icon (${result.sizeKb} KB).`);
      } catch (error) {
        if (iconStatus) {
          iconStatus.textContent =
            error?.message || "Icon upload failed. Paste a direct URL below.";
        }
        showToast(error?.message || "Icon upload failed.", "error");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

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
  if (tabName === "overview") {
    loadOverviewSummary();
    loadInfrastructureMetrics({ showToast });
  } else if (tabName === "inbox") loadInbox(callbacks);
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

  if (crudDialog) {
    let lastInnerPopoverEscapeAt = 0;

    function dismissActiveCrudPopover() {
      if (dismissOpenCityPicker(crudDialog)) return true;
      if (dismissOpenRichLinkBar(crudDialog)) return true;
      return false;
    }

    crudDialog.addEventListener("cancel", (event) => {
      if (
        dismissActiveCrudPopover() ||
        Date.now() - lastInnerPopoverEscapeAt < 100
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    });

    crudDialog.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && dismissActiveCrudPopover()) {
          lastInnerPopoverEscapeAt = Date.now();
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true,
    );

    crudDialog.addEventListener("close", () => {
      runActiveFieldCleanups();
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

        if (field.type === "period_range") {
          const pickerEl = crudForm.querySelector(
            `[data-period-picker="${field.key}"]`,
          );
          if (!pickerEl) continue;
          const startMonthEl = pickerEl.querySelector("[data-period-start-month]");
          const startYearEl = pickerEl.querySelector("[data-period-start-year]");
          const endMonthEl = pickerEl.querySelector("[data-period-end-month]");
          const endYearEl = pickerEl.querySelector("[data-period-end-year]");
          const ongoingEl = pickerEl.querySelector("[data-period-ongoing]");
          const isOngoing = Boolean(ongoingEl?.checked);

          const result = serializePeriodSelection({
            startMonth: startMonthEl?.value,
            startYear: startYearEl?.value,
            endMonth: endMonthEl?.value,
            endYear: endYearEl?.value,
            isOngoing,
          });

          if (result.error) {
            const focusTarget =
              !startMonthEl?.value
                ? startMonthEl
                : !startYearEl?.value
                  ? startYearEl
                  : !endMonthEl?.value
                    ? endMonthEl
                    : endYearEl;
            focusTarget?.focus();
            showToast(`${field.label}: ${result.error}`, "error");
            return;
          }
          continue;
        }

        if (field.type === "location_search") {
          const check = validateCityPickerField(crudForm);
          if (!check.valid) {
            check.inputEl?.focus();
            showToast(check.error, "error");
            return;
          }
          continue;
        }

        const inputEl = crudForm.querySelector(`[name="${field.key}"]`);
        if (!inputEl) continue;

        if (field.type === "metrics") {
          const { invalidLine } = parseMetricsFieldInput(inputEl.value);
          if (invalidLine) {
            inputEl.focus();
            showToast(
              'Format each Highlight Metrics line as "Label | Value".',
              "error",
            );
            return;
          }
        }

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
        } else if (field.type === "metrics") {
          const { metrics } = parseMetricsFieldInput(formData.get(field.key));
          record[field.key] = metrics;
        } else if (field.type === "richtext" || field.type === "bullets") {
          const editorRoot = crudForm.querySelector(
            `[data-rich-editor][data-field-name="${field.key}"]`,
          );
          record[field.key] = serializeRichEditorValue(editorRoot);
        } else if (field.type === "period_range") {
          const pickerEl = crudForm.querySelector(
            `[data-period-picker="${field.key}"]`,
          );
          const ongoingEl = pickerEl?.querySelector("[data-period-ongoing]");
          const isOngoing = Boolean(ongoingEl?.checked);
          const { value } = serializePeriodSelection({
            startMonth: pickerEl?.querySelector("[data-period-start-month]")
              ?.value,
            startYear: pickerEl?.querySelector("[data-period-start-year]")
              ?.value,
            endMonth: pickerEl?.querySelector("[data-period-end-month]")?.value,
            endYear: pickerEl?.querySelector("[data-period-end-year]")?.value,
            isOngoing,
          });
          record[field.key] = value;
          if (field.syncCheckboxKey) {
            record[field.syncCheckboxKey] = isOngoing;
          }
        } else if (field.type === "location_search") {
          const { value } = validateCityPickerField(crudForm);
          record[field.key] = value;
        } else {
          const val = String(formData.get(field.key) || "").trim();
          record[field.key] = val || null;
        }
      });

      if (table === DB_TABLES.EDUCATION) {
        const gpaVal = String(record.score_value || "").trim();
        if (gpaVal) {
          record.score_label = "GPA";
          record.score_value = gpaVal;
        } else {
          record.score_label = null;
          record.score_value = null;
        }
      }

      if (table === DB_TABLES.COMPETENCIES && record.category === "other") {
        record.icon_url = null;
      }

      if (mode === "edit") {
        schema.fields.forEach((field) => {
          if (field.lockOnEdit) delete record[field.key];
        });
      }

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
  initInfrastructureControls({ showToast });
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
