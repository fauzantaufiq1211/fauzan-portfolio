import { DB_TABLES, supabase } from "../config/supabase-client.js";
import {
  escapeHtml,
  normalizeDashes,
  renderEmptyState,
  renderErrorState,
  renderLoadingState,
  sanitizeRichText,
  sanitizeUrl,
} from "../utils/dom.js";
import {
  openDocumentModal,
  openLightbox,
  registerGallery,
} from "./modal-lightbox.js";

const PORTFOLIO_CACHE_KEY = "ft_portfolio_sections_v1";
const SPOTLIGHT_IDS = ["brandoctors-2", "brandoctors", "brandoctors-3"];
const INITIAL_SPOTLIGHT_LIMIT = 6;

// Campaign titles and verified metrics for sections whose title is blank in legacy Supabase rows.
const SPOTLIGHT_META = {
  "brandoctors-2": {
    title: "Wellfest 2025",
    client: "Brandoctors Indonesia",
    role: "On-site Staff",
    metrics: [
      { value: "261,000+", label: "Festival Visitors Reached" },
      { value: "20+", label: "Digital & Environmental Assets" },
    ],
  },
  brandoctors: {
    title: "BPOM RI Public Health Campaign",
    client: "Brandoctors Indonesia",
    role: "On-site Staff",
    metrics: [
      { value: "", dynamicWorkCount: true, label: "Multi-Format Campaign Visuals" },
      { value: "3 Channels", label: "Feed, Story, and Web Banner" },
    ],
  },
  "brandoctors-3": {
    title: "HAI-FEST 2025 & 61st National Health Day",
    client: "Brandoctors Indonesia",
    role: "On-site Staff",
    metrics: [
      { value: "National", label: "CKG & SATUSEHAT Campaign Scope" },
      { value: "4 Systems", label: "Stage, Wayfinding & Credential Collateral" },
    ],
  },
};

let memoryPortfolioCache = null;

function isImageUrl(url) {
  if (!url) return false;
  return /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(url);
}

function isDocumentUrl(url) {
  if (!url) return false;
  return url.includes("drive.google.com") || /\.pdf(\?.*)?$/i.test(url);
}

// Legacy rows store unhosted relative paths like "images/portfolio/..." in link_url; use image_url instead.
function resolvePreviewImageUrl(item) {
  const link = item.link_url ? String(item.link_url).trim() : "";
  if (link.startsWith("http") && isImageUrl(link)) {
    return link;
  }
  return item.image_url || "";
}

function resolveExternalActionUrl(item) {
  const link = item.link_url ? String(item.link_url).trim() : "";
  if (!link || !link.startsWith("http")) return "";
  if (isImageUrl(link) || link === item.image_url) return "";
  return link;
}

function getAspectTreatment(item) {
  const descriptor = `${item.type || ""} ${item.title || ""} ${item.image_url || ""}`.toLowerCase();
  if (/banner|backdrop|giant-map|led-content|cue-card|voucher/.test(descriptor)) {
    return {
      itemClass: "showcase-item showcase-item--wide",
      frameClass: "media-frame media-frame--natural",
    };
  }
  return {
    itemClass: "showcase-item showcase-item--staggered",
    frameClass: "media-frame media-frame--natural",
  };
}

function normalizeSections(rawSections) {
  return (rawSections || []).map((section) => {
    const works = Array.isArray(section.works)
      ? [...section.works].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        )
      : [];

    return {
      id: String(section.id || ""),
      title: normalizeDashes(section.title || ""),
      tagline: normalizeDashes(section.tagline || ""),
      description: normalizeDashes(section.description || ""),
      badge: normalizeDashes(section.badge || ""),
      layout: section.layout || "slider",
      sort_order: section.sort_order ?? 0,
      works: works.map((item) => ({
        title: normalizeDashes(item.title || ""),
        description: normalizeDashes(item.description || ""),
        category: normalizeDashes(item.category || ""),
        type: normalizeDashes(item.type || "Campaign Visual"),
        button_text: normalizeDashes(item.button_text || "Inspect"),
        image_url: item.image_url || "",
        link_url: item.link_url || "",
      })),
    };
  });
}

async function fetchPortfolioData(forceRefresh = false) {
  if (!forceRefresh && memoryPortfolioCache) {
    return memoryPortfolioCache;
  }

  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem(PORTFOLIO_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryPortfolioCache = parsed;
          return parsed;
        }
      }
    } catch {
      // Proceed to network query if sessionStorage is unavailable.
    }
  }

  const { data, error } = await supabase
    .from(DB_TABLES.PORTFOLIO_SECTIONS)
    .select("*, works: portfolio_items(*)")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const normalized = normalizeSections(data);
  memoryPortfolioCache = normalized;

  try {
    sessionStorage.setItem(PORTFOLIO_CACHE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota errors.
  }

  return normalized;
}

function buildGalleryAndRegister(galleryId, sectionTitle, works) {
  const galleryItems = works.map((work, idx) => ({
    src: resolvePreviewImageUrl(work),
    title: work.title || `${sectionTitle}: ${work.type || `Artifact ${idx + 1}`}`,
    subtitle: work.category || work.type || sectionTitle,
    externalUrl: isDocumentUrl(work.link_url) ? "" : resolveExternalActionUrl(work),
    actionLabel: work.button_text || "Open Live Post",
  }));
  registerGallery(galleryId, galleryItems);
  return galleryItems;
}

function renderSpotlightSection(sections, container, revealController) {
  if (!container) return;

  const spotlightSections = SPOTLIGHT_IDS.map((id) =>
    sections.find((s) => s.id === id),
  ).filter(Boolean);

  if (spotlightSections.length === 0) {
    renderEmptyState(container, {
      title: "No featured campaigns published",
      message: "Flagship campaign spotlights will appear here once configured.",
    });
    return;
  }

  container.innerHTML = spotlightSections
    .map((section) => {
      const meta = SPOTLIGHT_META[section.id] || {
        title: section.title || "Featured Campaign",
        client: section.title || "Campaign Spotlight",
        role: section.badge || "Lead Creative",
        metrics: [],
      };
      const displayTitle = meta.title;
      const galleryId = `spotlight-${section.id}`;
      buildGalleryAndRegister(galleryId, displayTitle, section.works);

      const visibleWorks = section.works.slice(0, INITIAL_SPOTLIGHT_LIMIT);
      const resolvedMetrics = (meta.metrics || []).map((metric) =>
        metric.dynamicWorkCount || (section.id === "brandoctors" && metric.label === "Multi-Format Campaign Visuals")
          ? { ...metric, value: String(section.works.length) }
          : metric,
      );

      const metricsHtml =
        resolvedMetrics.length > 0
          ? `<dl class="spotlight-metrics">
              ${resolvedMetrics
                .map(
                  (m) => `
                <div class="spotlight-metric-item">
                  <dt class="text-caption">${escapeHtml(m.label)}</dt>
                  <dd class="spotlight-metric-value">${escapeHtml(m.value)}</dd>
                </div>
              `,
                )
                .join("")}
            </dl>`
          : "";

      const itemsHtml = visibleWorks
        .map((work, idx) => {
          const { itemClass, frameClass } = getAspectTreatment(work);
          const externalUrl = resolveExternalActionUrl(work);
          const docUrl = isDocumentUrl(work.link_url) ? work.link_url : "";
          const safeImg = sanitizeUrl(work.image_url);
          const itemLabel = work.title || work.type || `Artifact ${idx + 1}`;

          let secondaryActionHtml = "";
          if (docUrl) {
            secondaryActionHtml = `<button type="button" class="btn btn-subtle btn-compact" data-doc-url="${escapeHtml(sanitizeUrl(docUrl))}" data-doc-title="${escapeHtml(itemLabel)}">${escapeHtml(work.button_text || "Read Document")}</button>`;
          } else if (externalUrl) {
            secondaryActionHtml = `<a href="${escapeHtml(sanitizeUrl(externalUrl))}" target="_blank" rel="noopener noreferrer" class="btn btn-subtle btn-compact">${escapeHtml(work.button_text || "View Live Post")}</a>`;
          }

          return `
            <article class="${itemClass}">
              <div class="${frameClass}">
                <button
                  type="button"
                  class="media-trigger"
                  data-lightbox-gallery="${escapeHtml(galleryId)}"
                  data-lightbox-index="${idx}"
                  aria-label="Open ${escapeHtml(itemLabel)} from ${escapeHtml(displayTitle)}"
                >
                  <img
                    src="${escapeHtml(safeImg)}"
                    alt="${escapeHtml(itemLabel)} for ${escapeHtml(displayTitle)}"
                    loading="lazy"
                    decoding="async"
                  />
                  <span class="media-scrim">
                    <span class="text-body-sm">${escapeHtml(itemLabel)}</span>
                  </span>
                </button>
              </div>
              ${secondaryActionHtml ? `<div class="showcase-item-actions">${secondaryActionHtml}</div>` : ""}
            </article>
          `;
        })
        .join("");

      return `
        <article class="spotlight-campaign reveal" data-campaign-id="${escapeHtml(section.id)}">
          <div class="spotlight-narrative">
            <div class="spotlight-meta">
              <span class="tag-chip">${escapeHtml(meta.client)}</span>
              <span class="tag-chip">${escapeHtml(meta.role)}</span>
            </div>
            <div>
              <p class="text-caption spotlight-tagline">${escapeHtml(section.tagline)}</p>
              <h3 class="text-heading">${escapeHtml(displayTitle)}</h3>
            </div>
            <div class="text-body text-secondary spotlight-description">
              ${sanitizeRichText(section.description)}
            </div>
            ${metricsHtml}
            <div class="spotlight-actions">
              <button
                type="button"
                class="btn btn-primary"
                data-lightbox-gallery="${escapeHtml(galleryId)}"
                data-lightbox-index="0"
              >
                Inspect Campaign Gallery
              </button>
            </div>
          </div>
          <div class="spotlight-showcase" id="showcase-${escapeHtml(section.id)}">
            ${itemsHtml}
          </div>
        </article>
      `;
    })
    .join("");

  bindPortfolioInteractions(container);
  if (revealController) revealController.observeNew(container);
}

function renderArchiveSection(sections, container, revealController) {
  if (!container) return;

  const archiveSections = sections.filter(
    (s) => !SPOTLIGHT_IDS.includes(s.id),
  );

  const clientSections = [];
  const gridWorks = [];

  archiveSections.forEach((section) => {
    if (!section.works || section.works.length === 0) return;

    if (section.layout === "grid" || section.id === "personal") {
      section.works.forEach((work) => {
        gridWorks.push({ section, work });
      });
    } else {
      clientSections.push(section);
    }
  });

  if (clientSections.length === 0 && gridWorks.length === 0) {
    renderEmptyState(container, {
      title: "No archive projects published yet",
      message: "Client deliverables and visual studies will appear here once published.",
    });
    return;
  }

  let html = "";

  if (clientSections.length > 0) {
    html += clientSections
      .map((section) => {
        const galleryId = `client-${section.id}`;
        buildGalleryAndRegister(galleryId, section.title, section.works);
        const trackId = `track-${section.id}`;

        const slidesHtml = section.works
          .map((work, idx) => {
            const safeImg = sanitizeUrl(work.image_url);
            const itemLabel = work.title || work.type || `Visual ${idx + 1}`;
            const externalUrl = resolveExternalActionUrl(work);
            const docUrl = isDocumentUrl(work.link_url) ? work.link_url : "";

            let linkAction = "";
            if (docUrl) {
              linkAction = `<button type="button" class="btn btn-subtle btn-compact" data-doc-url="${escapeHtml(sanitizeUrl(docUrl))}" data-doc-title="${escapeHtml(itemLabel)}">${escapeHtml(work.button_text || "View Document")}</button>`;
            } else if (externalUrl) {
              linkAction = `<a href="${escapeHtml(sanitizeUrl(externalUrl))}" target="_blank" rel="noopener noreferrer" class="btn btn-subtle btn-compact">${escapeHtml(work.button_text || "View Post")}</a>`;
            } else {
              linkAction = `<button type="button" class="btn btn-subtle btn-compact" data-lightbox-gallery="${escapeHtml(galleryId)}" data-lightbox-index="${idx}">${escapeHtml(work.button_text || "View Image")}</button>`;
            }

            return `
              <div class="showcase-slide">
                <div class="case-card">
                  <div class="media-frame media-aspect-feed">
                    <button
                      type="button"
                      class="media-trigger"
                      data-lightbox-gallery="${escapeHtml(galleryId)}"
                      data-lightbox-index="${idx}"
                      aria-label="Preview ${escapeHtml(itemLabel)} from ${escapeHtml(section.title)}"
                    >
                      <img
                        src="${escapeHtml(safeImg)}"
                        alt="${escapeHtml(itemLabel)} for ${escapeHtml(section.title)}"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  </div>
                  <div class="case-card-body">
                    <div class="case-card-meta">
                      <span class="text-caption">${escapeHtml(work.type)}</span>
                    </div>
                    <div class="case-card-footer">
                      ${linkAction}
                    </div>
                  </div>
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <article class="archive-featured-block reveal">
            <div class="archive-featured-info">
              <div class="spotlight-meta">
                ${section.badge ? `<span class="tag-chip">${escapeHtml(section.badge)}</span>` : ""}
                <span class="tag-chip">${section.works.length} Deliverables</span>
              </div>
              <div>
                <p class="text-caption">${escapeHtml(section.tagline)}</p>
                <h3 class="text-heading-sm">${escapeHtml(section.title)}</h3>
              </div>
              <div class="text-body-sm text-secondary">
                ${sanitizeRichText(section.description)}
              </div>
              <div class="archive-featured-controls">
                <button
                  type="button"
                  class="btn btn-secondary btn-compact"
                  data-lightbox-gallery="${escapeHtml(galleryId)}"
                  data-lightbox-index="0"
                >
                  Open Gallery
                </button>
                <div class="showcase-controls">
                  <button
                    type="button"
                    class="btn-icon"
                    data-scroll-track="${escapeHtml(trackId)}"
                    data-scroll-dir="-1"
                    aria-label="Scroll ${escapeHtml(section.title)} gallery left"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="btn-icon"
                    data-scroll-track="${escapeHtml(trackId)}"
                    data-scroll-dir="1"
                    aria-label="Scroll ${escapeHtml(section.title)} gallery right"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div class="archive-featured-gallery">
              <div class="showcase-track" id="${escapeHtml(trackId)}" tabindex="0" aria-label="${escapeHtml(section.title)} deliverables">
                ${slidesHtml}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  if (gridWorks.length > 0) {
    const expGalleryId = "experimental-archive";
    buildGalleryAndRegister(
      expGalleryId,
      "Experimental & Visual Identity Archive",
      gridWorks.map((entry) => entry.work),
    );

    const cardsHtml = gridWorks
      .map(({ work }, idx) => {
        const safeImg = sanitizeUrl(work.image_url);
        const title = work.title || work.type || "Visual Exploration";
        const categoryLabel = work.category || work.type || "Archive";
        const docUrl = isDocumentUrl(work.link_url) ? work.link_url : "";
        const externalUrl = resolveExternalActionUrl(work);

        let primaryActionHtml = "";
        if (docUrl) {
          primaryActionHtml = `
            <button
              type="button"
              class="btn btn-secondary btn-compact"
              data-doc-url="${escapeHtml(sanitizeUrl(docUrl))}"
              data-doc-title="${escapeHtml(title)}"
            >
              ${escapeHtml(work.button_text || "View Project")}
            </button>
          `;
        } else if (externalUrl) {
          primaryActionHtml = `
            <a
              href="${escapeHtml(sanitizeUrl(externalUrl))}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-secondary btn-compact"
            >
              ${escapeHtml(work.button_text || "View Project")}
            </a>
          `;
        } else {
          primaryActionHtml = `
            <button
              type="button"
              class="btn btn-secondary btn-compact"
              data-lightbox-gallery="${escapeHtml(expGalleryId)}"
              data-lightbox-index="${idx}"
            >
              ${escapeHtml(work.button_text || "View Project")}
            </button>
          `;
        }

        return `
          <article class="case-card archive-card reveal">
            <div class="media-frame media-aspect-wide">
              <button
                type="button"
                class="media-trigger"
                data-lightbox-gallery="${escapeHtml(expGalleryId)}"
                data-lightbox-index="${idx}"
                aria-label="Open ${escapeHtml(title)}"
              >
                <img
                  src="${escapeHtml(safeImg)}"
                  alt="${escapeHtml(title)}"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </div>
            <div class="case-card-body">
              <div class="spotlight-meta">
                <span class="tag-chip">${escapeHtml(categoryLabel)}</span>
              </div>
              <h3 class="text-heading-sm">${escapeHtml(title)}</h3>
              ${work.description ? `<p class="text-body-sm text-secondary">${escapeHtml(work.description)}</p>` : ""}
              <div class="case-card-footer">
                ${primaryActionHtml}
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    html += `
      <div class="archive-experimental-block">
        <div class="archive-experimental-header reveal">
          <p class="text-caption">Selected Studies &amp; Identity Systems</p>
          <h3 class="text-heading-sm">Experimental &amp; Identity Archive</h3>
        </div>
        <div class="archive-asymmetric-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  bindPortfolioInteractions(container);
  if (revealController) revealController.observeNew(container);
}

function bindPortfolioInteractions(scope) {
  scope.querySelectorAll("[data-lightbox-gallery]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const galleryId = trigger.getAttribute("data-lightbox-gallery");
      const index = Number.parseInt(
        trigger.getAttribute("data-lightbox-index") || "0",
        10,
      );
      openLightbox(galleryId, index, trigger);
    });
  });

  scope.querySelectorAll("[data-doc-url]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-doc-url");
      const title = btn.getAttribute("data-doc-title") || "Document Preview";
      openDocumentModal(url, title, btn);
    });
  });

  scope.querySelectorAll("[data-scroll-track]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const trackId = btn.getAttribute("data-scroll-track");
      const direction = Number.parseInt(
        btn.getAttribute("data-scroll-dir") || "1",
        10,
      );
      const track = document.getElementById(trackId);
      if (!track) return;
      const step = Math.max(280, Math.floor(track.clientWidth * 0.75));
      track.scrollBy({ left: direction * step, behavior: "smooth" });
    });
  });
}

export async function initPortfolio(revealController) {
  const spotlightContainer = document.getElementById("spotlight-container");
  const archiveContainer = document.getElementById("archive-container");

  async function loadAndRender(forceRefresh = false) {
    renderLoadingState(spotlightContainer, {
      title: "Loading flagship campaign case studies",
      count: 2,
    });
    renderLoadingState(archiveContainer, {
      title: "Loading client and experimental work archive",
      count: 3,
    });

    try {
      const sections = await fetchPortfolioData(forceRefresh);
      if (!sections || sections.length === 0) {
        renderEmptyState(spotlightContainer, {
          title: "No campaigns available",
          message: "Campaign case studies will appear here once published.",
        });
        renderEmptyState(archiveContainer, {
          title: "No archive items available",
          message: "Client and experimental projects will appear here once published.",
        });
        return;
      }

      renderSpotlightSection(sections, spotlightContainer, revealController);
      renderArchiveSection(sections, archiveContainer, revealController);
    } catch (error) {
      const retry = () => loadAndRender(true);
      renderErrorState(spotlightContainer, {
        title: "Unable to load flagship campaign spotlight",
        message: error?.message || "Please check your connection and try again.",
        onRetry: retry,
      });
      renderErrorState(archiveContainer, {
        title: "Unable to load curated work archive",
        message: error?.message || "Please check your connection and try again.",
        onRetry: retry,
      });
    }
  }

  await loadAndRender(false);
}
