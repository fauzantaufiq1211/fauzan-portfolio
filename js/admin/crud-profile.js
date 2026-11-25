import { DB_TABLES, supabase } from "../config/supabase-client.js";
import {
  escapeHtml,
  normalizeDashes,
  parseDescriptionList,
  renderEmptyState,
  renderErrorState,
  renderLoadingState,
  sanitizeUrl,
} from "../utils/dom.js";

let experienceCache = [];
let educationCache = [];
let competenciesCache = [];

export async function loadAdminExperience({
  openFormModal,
  openConfirmModal,
  showToast,
  onCountsChanged,
} = {}) {
  const container = document.getElementById("admin-experience-list");
  if (!container) return;

  renderLoadingState(container, {
    title: "Loading work experience records",
    count: 3,
  });

  try {
    const { data, error } = await supabase
      .from(DB_TABLES.EXPERIENCE)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    experienceCache = data || [];
    if (experienceCache.length === 0) {
      renderEmptyState(container, {
        title: "No work experience records yet",
        message: "Use the New Experience button above to add your first professional role.",
      });
      return;
    }

    container.innerHTML = experienceCache
      .map((exp) => {
        const bullets = parseDescriptionList(exp.description);
        return `
          <article class="admin-record-card">
            <div class="admin-record-info">
              <div class="admin-record-header">
                <h3 class="text-heading-sm">${escapeHtml(normalizeDashes(exp.role || ""))}</h3>
                ${exp.is_featured ? '<span class="tag-chip tag-chip--accent">Featured</span>' : ""}
                ${exp.type ? `<span class="tag-chip">${escapeHtml(normalizeDashes(exp.type))}</span>` : ""}
              </div>
              <p class="text-body-sm">
                <strong>${escapeHtml(normalizeDashes(exp.company || ""))}</strong>
                ${exp.location ? ` · ${escapeHtml(normalizeDashes(exp.location))}` : ""}
                ${exp.period ? ` · ${escapeHtml(normalizeDashes(exp.period))}` : ""}
              </p>
              ${bullets.length > 0 ? `<p class="text-caption">${bullets.length} achievement bullet(s) · Sort Order: ${exp.sort_order ?? 0}</p>` : `<p class="text-caption">Sort Order: ${exp.sort_order ?? 0}</p>`}
            </div>
            <div class="admin-record-actions">
              <button
                type="button"
                class="btn btn-secondary btn-compact"
                data-edit-experience="${escapeHtml(exp.id)}"
              >
                Edit
              </button>
              <button
                type="button"
                class="btn btn-subtle btn-compact"
                data-delete-experience="${escapeHtml(exp.id)}"
              >
                Delete
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    container.querySelectorAll("[data-edit-experience]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit-experience");
        const record = experienceCache.find((e) => String(e.id) === String(id));
        if (record && typeof openFormModal === "function") {
          openFormModal(DB_TABLES.EXPERIENCE, record, btn);
        }
      });
    });

    container.querySelectorAll("[data-delete-experience]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-delete-experience");
        const record = experienceCache.find((e) => String(e.id) === String(id));
        if (typeof openConfirmModal === "function") {
          openConfirmModal({
            title: "Delete experience record?",
            message: `Remove "${normalizeDashes(record?.role || "")}" at "${normalizeDashes(record?.company || "")}"?`,
            triggerEl: btn,
            onConfirm: async () => {
              const { error: delErr } = await supabase
                .from(DB_TABLES.EXPERIENCE)
                .delete()
                .eq("id", id);
              if (delErr) {
                showToast?.(`Delete failed: ${delErr.message}`, "error");
                return;
              }
              showToast?.("Experience record deleted.");
              await loadAdminExperience({
                openFormModal,
                openConfirmModal,
                showToast,
                onCountsChanged,
              });
              onCountsChanged?.();
            },
          });
        }
      });
    });
  } catch (error) {
    renderErrorState(container, {
      title: "Unable to load work experience",
      message: error?.message || "Check your connection and retry.",
      onRetry: () =>
        loadAdminExperience({
          openFormModal,
          openConfirmModal,
          showToast,
          onCountsChanged,
        }),
    });
  }
}

export async function loadAdminEducation({
  openFormModal,
  openConfirmModal,
  showToast,
  onCountsChanged,
} = {}) {
  const container = document.getElementById("admin-education-list");
  if (!container) return;

  renderLoadingState(container, {
    title: "Loading education records",
    count: 2,
  });

  try {
    const { data, error } = await supabase
      .from(DB_TABLES.EDUCATION)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    educationCache = data || [];
    if (educationCache.length === 0) {
      renderEmptyState(container, {
        title: "No education records yet",
        message: "Use the New Education button above to add an academic qualification.",
      });
      return;
    }

    container.innerHTML = educationCache
      .map((edu) => {
        const score =
          edu.score_label && edu.score_value
            ? `${normalizeDashes(edu.score_label)}: ${normalizeDashes(edu.score_value)}`
            : "";

        return `
          <article class="admin-record-card">
            <div class="admin-record-info">
              <div class="admin-record-header">
                <h3 class="text-heading-sm">${escapeHtml(normalizeDashes(edu.institution || ""))}</h3>
                ${edu.is_active ? '<span class="tag-chip tag-chip--accent">Active</span>' : ""}
                ${score ? `<span class="tag-chip">${escapeHtml(score)}</span>` : ""}
              </div>
              <p class="text-body-sm">
                ${escapeHtml(normalizeDashes(edu.degree || ""))}
                ${edu.period ? ` · ${escapeHtml(normalizeDashes(edu.period))}` : ""}
              </p>
              <p class="text-caption">Sort Order: ${edu.sort_order ?? 0}</p>
            </div>
            <div class="admin-record-actions">
              <button
                type="button"
                class="btn btn-secondary btn-compact"
                data-edit-education="${escapeHtml(edu.id)}"
              >
                Edit
              </button>
              <button
                type="button"
                class="btn btn-subtle btn-compact"
                data-delete-education="${escapeHtml(edu.id)}"
              >
                Delete
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    container.querySelectorAll("[data-edit-education]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit-education");
        const record = educationCache.find((e) => String(e.id) === String(id));
        if (record && typeof openFormModal === "function") {
          openFormModal(DB_TABLES.EDUCATION, record, btn);
        }
      });
    });

    container.querySelectorAll("[data-delete-education]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-delete-education");
        const record = educationCache.find((e) => String(e.id) === String(id));
        if (typeof openConfirmModal === "function") {
          openConfirmModal({
            title: "Delete education record?",
            message: `Remove "${normalizeDashes(record?.institution || "")}"?`,
            triggerEl: btn,
            onConfirm: async () => {
              const { error: delErr } = await supabase
                .from(DB_TABLES.EDUCATION)
                .delete()
                .eq("id", id);
              if (delErr) {
                showToast?.(`Delete failed: ${delErr.message}`, "error");
                return;
              }
              showToast?.("Education record deleted.");
              await loadAdminEducation({
                openFormModal,
                openConfirmModal,
                showToast,
                onCountsChanged,
              });
              onCountsChanged?.();
            },
          });
        }
      });
    });
  } catch (error) {
    renderErrorState(container, {
      title: "Unable to load education records",
      message: error?.message || "Check your connection and retry.",
      onRetry: () =>
        loadAdminEducation({
          openFormModal,
          openConfirmModal,
          showToast,
          onCountsChanged,
        }),
    });
  }
}

export async function loadAdminCompetencies({
  openFormModal,
  openConfirmModal,
  showToast,
  onCountsChanged,
} = {}) {
  const container = document.getElementById("admin-competencies-list");
  if (!container) return;

  renderLoadingState(container, {
    title: "Loading tools and competencies",
    count: 3,
  });

  try {
    const { data, error } = await supabase
      .from(DB_TABLES.COMPETENCIES)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    competenciesCache = data || [];
    if (competenciesCache.length === 0) {
      renderEmptyState(container, {
        title: "No competencies listed yet",
        message: "Use the New Competency button above to add creative software or strategic capabilities.",
      });
      return;
    }

    container.innerHTML = competenciesCache
      .map((comp) => {
        const safeIcon = sanitizeUrl(comp.icon_url);
        return `
          <article class="admin-record-card">
            <div class="admin-record-info">
              <div class="admin-record-header">
                ${
                  safeIcon
                    ? `<div class="admin-thumb" style="width: 2.25rem; height: 2.25rem;"><img src="${escapeHtml(safeIcon)}" alt="" loading="lazy" decoding="async" /></div>`
                    : ""
                }
                <h3 class="text-heading-sm">${escapeHtml(normalizeDashes(comp.name || ""))}</h3>
                <span class="tag-chip">${escapeHtml(comp.category || "arsenal")}</span>
              </div>
              <p class="text-caption">Sort Order: ${comp.sort_order ?? 0}</p>
            </div>
            <div class="admin-record-actions">
              <button
                type="button"
                class="btn btn-secondary btn-compact"
                data-edit-competency="${escapeHtml(comp.id)}"
              >
                Edit
              </button>
              <button
                type="button"
                class="btn btn-subtle btn-compact"
                data-delete-competency="${escapeHtml(comp.id)}"
              >
                Delete
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    container.querySelectorAll("[data-edit-competency]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit-competency");
        const record = competenciesCache.find((c) => String(c.id) === String(id));
        if (record && typeof openFormModal === "function") {
          openFormModal(DB_TABLES.COMPETENCIES, record, btn);
        }
      });
    });

    container.querySelectorAll("[data-delete-competency]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-delete-competency");
        const record = competenciesCache.find((c) => String(c.id) === String(id));
        if (typeof openConfirmModal === "function") {
          openConfirmModal({
            title: "Delete competency?",
            message: `Remove "${normalizeDashes(record?.name || "")}" from your capabilities list?`,
            triggerEl: btn,
            onConfirm: async () => {
              const { error: delErr } = await supabase
                .from(DB_TABLES.COMPETENCIES)
                .delete()
                .eq("id", id);
              if (delErr) {
                showToast?.(`Delete failed: ${delErr.message}`, "error");
                return;
              }
              showToast?.("Competency deleted.");
              await loadAdminCompetencies({
                openFormModal,
                openConfirmModal,
                showToast,
                onCountsChanged,
              });
              onCountsChanged?.();
            },
          });
        }
      });
    });
  } catch (error) {
    renderErrorState(container, {
      title: "Unable to load competencies",
      message: error?.message || "Check your connection and retry.",
      onRetry: () =>
        loadAdminCompetencies({
          openFormModal,
          openConfirmModal,
          showToast,
          onCountsChanged,
        }),
    });
  }
}
