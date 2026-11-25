import {
  DB_TABLES,
  STORAGE_BUCKETS,
  supabase,
} from "../config/supabase-client.js";
import {
  escapeHtml,
  normalizeDashes,
  renderEmptyState,
  renderErrorState,
  renderLoadingState,
  sanitizeUrl,
} from "../utils/dom.js";

const PORTFOLIO_CACHE_KEY = "ft_portfolio_sections_v1";
const MAX_WEBP_WIDTH = 1600;
const MAX_WEBP_BYTES = 200 * 1024;

// Fallback display titles for legacy Supabase section rows whose title column is empty.
const SECTION_TITLE_FALLBACKS = {
  brandoctors: "BPOM RI (Brandoctors Indonesia)",
  "brandoctors-2": "Wellfest 2025",
  "brandoctors-3": "HAI-FEST 2025",
};

let sectionsCache = [];
let itemsCache = [];
let expandedSectionIds = null;

export function getSectionDisplayTitle(section) {
  if (!section) return "Untitled Section";
  const rawTitle = normalizeDashes(section.title || "").trim();
  if (rawTitle) return rawTitle;
  if (SECTION_TITLE_FALLBACKS[section.id]) {
    return SECTION_TITLE_FALLBACKS[section.id];
  }
  const rawTagline = normalizeDashes(section.tagline || "").trim();
  return rawTagline || String(section.id || "Untitled Section");
}

function invalidatePublicPortfolioCache() {
  try {
    sessionStorage.removeItem(PORTFOLIO_CACHE_KEY);
  } catch {
    // Ignore storage access errors.
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to decode image file."));
    };
    img.src = objectUrl;
  });
}

function canvasToWebPBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("WebP encoding is not supported in this browser."));
      },
      "image/webp",
      quality,
    );
  });
}

// Resizes images to max 1600px width and compresses to WebP under 200 KB before Supabase upload.
export async function compressImageToWebP(
  file,
  { maxWidth = MAX_WEBP_WIDTH, maxBytes = MAX_WEBP_BYTES } = {},
) {
  const img = await loadImageElement(file);
  let targetWidth = img.naturalWidth || img.width;
  let targetHeight = img.naturalHeight || img.height;

  if (targetWidth > maxWidth) {
    const ratio = maxWidth / targetWidth;
    targetWidth = maxWidth;
    targetHeight = Math.max(1, Math.round(targetHeight * ratio));
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable.");

  const qualitySteps = [0.86, 0.76, 0.66, 0.56, 0.46, 0.36];
  let currentScale = 1;
  let lastBlob = null;

  for (let pass = 0; pass < 3; pass += 1) {
    const w = Math.max(1, Math.round(targetWidth * currentScale));
    const h = Math.max(1, Math.round(targetHeight * currentScale));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    for (const quality of qualitySteps) {
      const blob = await canvasToWebPBlob(canvas, quality);
      lastBlob = blob;
      if (blob.size <= maxBytes) {
        return { blob, width: w, height: h };
      }
    }
    currentScale *= 0.82;
  }

  if (lastBlob && lastBlob.size <= maxBytes) {
    return { blob: lastBlob, width: canvas.width, height: canvas.height };
  }
  throw new Error("Image could not be compressed under 200 KB. Try a simpler crop.");
}

export async function uploadPortfolioWebP(file, sectionId = "general") {
  const { blob, width, height } = await compressImageToWebP(file);
  const safeSection = String(sectionId || "general")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-");
  const baseName = String(file.name || "artifact")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .slice(0, 40);
  const storagePath = `${safeSection}/${Date.now()}-${baseName || "artifact"}.webp`;

  // 1-year cacheControl minimizes repeat Supabase Storage egress on portfolio images.
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.PORTFOLIO_IMAGES)
    .upload(storagePath, blob, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(STORAGE_BUCKETS.PORTFOLIO_IMAGES)
    .getPublicUrl(storagePath);

  return {
    publicUrl: data?.publicUrl || "",
    sizeKb: Math.round((blob.size / 1024) * 10) / 10,
    width,
    height,
  };
}

export function getSectionsCache() {
  return sectionsCache;
}

function populateSectionFilterDropdown(sections) {
  const select = document.getElementById("items-section-filter");
  if (!select) return;
  const previous = select.value;
  select.innerHTML =
    '<option value="">All Sections</option>' +
    sections
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}">${escapeHtml(getSectionDisplayTitle(s))}</option>`,
      )
      .join("");
  select.value = previous;
}

export async function loadPortfolioSections({
  openFormModal,
  openConfirmModal,
  showToast,
  onCountsChanged,
} = {}) {
  const container = document.getElementById("portfolio-sections-list");
  if (!container) return;

  renderLoadingState(container, {
    title: "Loading portfolio sections",
    count: 3,
  });

  try {
    const { data, error } = await supabase
      .from(DB_TABLES.PORTFOLIO_SECTIONS)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    sectionsCache = data || [];
    populateSectionFilterDropdown(sectionsCache);

    if (sectionsCache.length === 0) {
      renderEmptyState(container, {
        title: "No portfolio sections created yet",
        message: "Use the New Section button above to create your first campaign or archive group.",
      });
      return;
    }

    container.innerHTML = sectionsCache
      .map((section) => {
        const plainDesc = normalizeDashes(
          (section.description || "").replace(/<[^>]*>/g, ""),
        );
        const summary =
          plainDesc.length > 110 ? `${plainDesc.slice(0, 110)}...` : plainDesc;

        return `
          <article class="admin-record-card">
            <div class="admin-record-info">
              <div class="admin-record-header">
                <h3 class="text-heading-sm">${escapeHtml(getSectionDisplayTitle(section))}</h3>
                <span class="tag-chip">${escapeHtml(section.layout || "slider")}</span>
                <span class="tag-chip">ID: ${escapeHtml(section.id)}</span>
                ${section.badge ? `<span class="tag-chip">${escapeHtml(normalizeDashes(section.badge))}</span>` : ""}
              </div>
              ${section.tagline ? `<p class="text-body-sm"><strong>${escapeHtml(normalizeDashes(section.tagline))}</strong></p>` : ""}
              ${summary ? `<p class="text-body-sm text-secondary">${escapeHtml(summary)}</p>` : ""}
              <p class="text-caption">Sort Order: ${section.sort_order ?? 0}</p>
            </div>
            <div class="admin-record-actions">
              <button
                type="button"
                class="btn btn-secondary btn-compact"
                data-edit-section="${escapeHtml(section.id)}"
              >
                Edit
              </button>
              <button
                type="button"
                class="btn btn-subtle btn-compact"
                data-delete-section="${escapeHtml(section.id)}"
              >
                Delete
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    container.querySelectorAll("[data-edit-section]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit-section");
        const record = sectionsCache.find((s) => String(s.id) === String(id));
        if (record && typeof openFormModal === "function") {
          openFormModal(DB_TABLES.PORTFOLIO_SECTIONS, record, btn);
        }
      });
    });

    container.querySelectorAll("[data-delete-section]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-delete-section");
        if (typeof openConfirmModal === "function") {
          openConfirmModal({
            title: `Delete section "${id}"?`,
            message:
              "Deleting a portfolio section removes its container record. Confirm before proceeding.",
            triggerEl: btn,
            onConfirm: async () => {
              const { error: delErr } = await supabase
                .from(DB_TABLES.PORTFOLIO_SECTIONS)
                .delete()
                .eq("id", id);
              if (delErr) {
                showToast?.(`Delete failed: ${delErr.message}`, "error");
                return;
              }
              invalidatePublicPortfolioCache();
              showToast?.("Portfolio section deleted.");
              await loadPortfolioSections({
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
      title: "Unable to load portfolio sections",
      message: error?.message || "Check your connection and retry.",
      onRetry: () =>
        loadPortfolioSections({
          openFormModal,
          openConfirmModal,
          showToast,
          onCountsChanged,
        }),
    });
  }
}

export async function loadPortfolioItems({
  openFormModal,
  openConfirmModal,
  showToast,
  onCountsChanged,
} = {}) {
  const container = document.getElementById("portfolio-items-container");
  const filterSelect = document.getElementById("items-section-filter");
  if (!container) return;

  renderLoadingState(container, {
    title: "Loading portfolio items by section",
    count: 3,
  });

  try {
    const [{ data: secData, error: secError }, { data: itemData, error: itemError }] =
      await Promise.all([
        supabase
          .from(DB_TABLES.PORTFOLIO_SECTIONS)
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase
          .from(DB_TABLES.PORTFOLIO_ITEMS)
          .select("*")
          .order("sort_order", { ascending: true }),
      ]);

    if (secError) throw secError;
    if (itemError) throw itemError;

    sectionsCache = (secData || []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    populateSectionFilterDropdown(sectionsCache);

    itemsCache = (itemData || []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );

    const sectionFilter = filterSelect?.value || "";
    const knownSectionIds = new Set(sectionsCache.map((s) => String(s.id)));

    const groups = [];
    sectionsCache.forEach((sec) => {
      if (sectionFilter && String(sec.id) !== String(sectionFilter)) {
        return;
      }
      const secItems = itemsCache
        .filter((it) => String(it.section_id) === String(sec.id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      groups.push({
        id: String(sec.id),
        displayTitle: getSectionDisplayTitle(sec),
        items: secItems,
        isOrphanGroup: false,
      });
    });

    if (!sectionFilter) {
      const orphanedItems = itemsCache
        .filter((it) => !knownSectionIds.has(String(it.section_id || "")))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      if (orphanedItems.length > 0) {
        groups.push({
          id: "unassigned",
          displayTitle: "Other / Unassigned Items",
          items: orphanedItems,
          isOrphanGroup: true,
        });
      }
    }

    if (groups.length === 0) {
      renderEmptyState(container, {
        title: "No portfolio sections found",
        message: "Create a portfolio section first, then add deliverables to it.",
      });
      return;
    }

    const renderGroupTable = (groupItems) => {
      if (groupItems.length === 0) {
        return `
          <div class="section-items-empty" role="status">
            <p class="text-body-sm text-secondary">No deliverables added to this section yet.</p>
          </div>
        `;
      }

      const rowsHtml = groupItems
        .map((item) => {
          const safeImg = sanitizeUrl(item.image_url);
          const typeLabel = normalizeDashes(item.type || "Visual Artifact");
          const titleLabel = normalizeDashes(item.title || item.type || "Untitled");

          return `
            <tr>
              <td data-label="Preview">
                <div class="admin-thumb">
                  ${safeImg ? `<img src="${escapeHtml(safeImg)}" alt="${escapeHtml(titleLabel)}" loading="lazy" decoding="async" />` : ""}
                </div>
              </td>
              <td data-label="Format">${escapeHtml(typeLabel)}</td>
              <td data-label="Title"><strong>${escapeHtml(titleLabel)}</strong></td>
              <td data-label="Order">${item.sort_order ?? 0}</td>
              <td data-label="Actions">
                <div class="admin-record-actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-compact"
                    data-edit-item="${escapeHtml(item.id)}"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn btn-subtle btn-compact"
                    data-delete-item="${escapeHtml(item.id)}"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      return `
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Preview</th>
              <th scope="col">Format</th>
              <th scope="col">Title</th>
              <th scope="col">Order</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    };

    if (expandedSectionIds === null) {
      expandedSectionIds = new Set(groups.length > 0 ? [groups[0].id] : []);
    }

    container.innerHTML = groups
      .map((group) => {
        const countLabel = `${group.items.length} ${group.items.length === 1 ? "item" : "items"}`;
        const isExpanded = sectionFilter
          ? true
          : expandedSectionIds.has(group.id);
        const bodyId = `section-body-${group.id}`;

        return `
          <section class="section-items-group" data-section-group="${escapeHtml(group.id)}">
            <header class="section-items-header">
              <button
                type="button"
                class="section-accordion-trigger"
                data-toggle-group="${escapeHtml(group.id)}"
                aria-expanded="${String(isExpanded)}"
                aria-controls="${escapeHtml(bodyId)}"
              >
                <svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span class="section-items-title-wrap">
                  <span class="text-heading-sm">${escapeHtml(group.displayTitle)}</span>
                  <span class="tag-chip">${escapeHtml(group.id)}</span>
                  <span class="tag-chip">${escapeHtml(countLabel)}</span>
                </span>
              </button>
              ${
                !group.isOrphanGroup
                  ? `<button
                      type="button"
                      class="btn btn-secondary btn-compact"
                      data-add-to-section="${escapeHtml(group.id)}"
                    >
                      + Add Item
                    </button>`
                  : ""
              }
            </header>
            <div
              id="${escapeHtml(bodyId)}"
              class="section-items-collapse"
              data-expanded="${String(isExpanded)}"
              ${isExpanded ? "" : "inert"}
            >
              <div class="section-items-collapse-inner">
                <div class="section-items-body">
                  ${renderGroupTable(group.items)}
                </div>
              </div>
            </div>
          </section>
        `;
      })
      .join("");

    container.querySelectorAll("[data-toggle-group]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const groupId = btn.getAttribute("data-toggle-group");
        const collapseEl = document.getElementById(`section-body-${groupId}`);
        if (!groupId || !collapseEl) return;

        const nextExpanded = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(nextExpanded));
        collapseEl.setAttribute("data-expanded", String(nextExpanded));

        if (nextExpanded) {
          collapseEl.removeAttribute("inert");
          expandedSectionIds.add(groupId);
        } else {
          collapseEl.setAttribute("inert", "");
          expandedSectionIds.delete(groupId);
        }
      });
    });

    container.querySelectorAll("[data-add-to-section]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const secId = btn.getAttribute("data-add-to-section");
        if (secId && expandedSectionIds) {
          expandedSectionIds.add(secId);
        }
        if (typeof openFormModal === "function") {
          openFormModal(
            DB_TABLES.PORTFOLIO_ITEMS,
            { section_id: secId },
            btn,
          );
        }
      });
    });

    container.querySelectorAll("[data-edit-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit-item");
        const record = itemsCache.find((it) => String(it.id) === String(id));
        if (record && typeof openFormModal === "function") {
          openFormModal(DB_TABLES.PORTFOLIO_ITEMS, record, btn);
        }
      });
    });

    container.querySelectorAll("[data-delete-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-delete-item");
        const record = itemsCache.find((it) => String(it.id) === String(id));
        if (typeof openConfirmModal === "function") {
          openConfirmModal({
            title: "Delete this portfolio item?",
            message: `Remove "${normalizeDashes(record?.title || record?.type || id)}" from section "${record?.section_id || ""}"?`,
            triggerEl: btn,
            onConfirm: async () => {
              const { error: delErr } = await supabase
                .from(DB_TABLES.PORTFOLIO_ITEMS)
                .delete()
                .eq("id", id);
              if (delErr) {
                showToast?.(`Delete failed: ${delErr.message}`, "error");
                return;
              }
              invalidatePublicPortfolioCache();
              showToast?.("Portfolio item deleted.");
              await loadPortfolioItems({
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
      title: "Unable to load portfolio items",
      message: error?.message || "Check your connection and retry.",
      onRetry: () =>
        loadPortfolioItems({
          openFormModal,
          openConfirmModal,
          showToast,
          onCountsChanged,
        }),
    });
  }
}

export { invalidatePublicPortfolioCache };
