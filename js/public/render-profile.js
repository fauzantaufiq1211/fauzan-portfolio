import { DB_TABLES, supabase } from "../config/supabase-client.js";
import {
  escapeHtml,
  formatRichTextHtml,
  normalizeDashes,
  parseDescriptionList,
  renderEmptyState,
  renderErrorState,
  renderLoadingState,
  sanitizeRichText,
  sanitizeUrl,
} from "../utils/dom.js";

// Edit these labels to rename the two competency groups on the public portfolio.
export const COMPETENCY_GROUP_HEADINGS = Object.freeze({
  arsenal: "Core Creative Software",
  other: "Strategic & Production Capabilities",
});

export async function loadExperience(container, revealController) {
  if (!container) return;
  renderLoadingState(container, {
    title: "Loading professional experience",
    count: 2,
  });

  try {
    const { data, error } = await supabase
      .from(DB_TABLES.EXPERIENCE)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const entries = data || [];
    if (entries.length === 0) {
      renderEmptyState(container, {
        title: "No experience records published yet",
        message: "Professional roles and creative engagements will appear here once added.",
      });
      return;
    }

    container.innerHTML = entries
      .map((exp) => {
        const role = normalizeDashes(exp.role || "Creative Specialist");
        const company = normalizeDashes(exp.company || "");
        const companyUrl = sanitizeUrl(exp.company_link);
        const location = normalizeDashes(exp.location || "");
        const period = normalizeDashes(exp.period || "");
        const type = normalizeDashes(exp.type || "").trim();
        const points = parseDescriptionList(exp.description).map((pt) =>
          normalizeDashes(pt),
        );

        const isCurrentRole = /\bpresent\b/i.test(period);
        const isFeatured = Boolean(exp.is_featured) || isCurrentRole;
        const statusChip = isCurrentRole
          ? '<span class="tag-chip tag-chip--accent">Current Role</span>'
          : exp.is_featured
            ? '<span class="tag-chip tag-chip--accent">Featured</span>'
            : "";
        const typeChip = type
          ? `<span class="tag-chip">${escapeHtml(type)}</span>`
          : "";
        const badgesHtml =
          statusChip || typeChip
            ? `<div class="spotlight-meta">${statusChip}${typeChip}</div>`
            : "";

        const companyHtml = companyUrl
          ? `<a href="${escapeHtml(companyUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(company)}</a>`
          : escapeHtml(company);

        const pointsHtml =
          points.length > 0
            ? `<ul class="ledger-points">
                ${points.map((pt) => `<li class="text-body-sm">${sanitizeRichText(pt)}</li>`).join("")}
              </ul>`
            : "";

        return `
          <article class="ledger-row ${isFeatured ? "ledger-row--featured " : ""}reveal">
            <div class="ledger-meta">
              <p class="text-body-sm">${escapeHtml(period)}</p>
              ${location ? `<p class="text-caption">${escapeHtml(location)}</p>` : ""}
              ${badgesHtml}
            </div>
            <div class="ledger-body">
              <h4 class="text-heading-sm">${escapeHtml(role)}</h4>
              <p class="text-body-sm text-secondary">${companyHtml}</p>
              ${pointsHtml}
            </div>
          </article>
        `;
      })
      .join("");

    if (revealController) revealController.observeNew(container);
  } catch (error) {
    renderErrorState(container, {
      title: "Unable to load work experience",
      message: error?.message || "Check your connection and retry.",
      onRetry: () => loadExperience(container, revealController),
    });
  }
}

export async function loadEducation(container, revealController) {
  if (!container) return;
  renderLoadingState(container, {
    title: "Loading education",
    count: 2,
  });

  try {
    const { data, error } = await supabase
      .from(DB_TABLES.EDUCATION)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const educationRecords = data || [];
    if (educationRecords.length === 0) {
      renderEmptyState(container, {
        title: "No education records published yet",
        message: "Academic degrees and credentials will appear here.",
      });
      return;
    }

    container.innerHTML = educationRecords
      .map((edu) => {
        const institution = normalizeDashes(edu.institution || "");
        const institutionUrl = sanitizeUrl(edu.institution_link);
        const period = normalizeDashes(edu.period || "");
        const degree = normalizeDashes(edu.degree || "");
        const scoreLabel = normalizeDashes(edu.score_label || "");
        const scoreValue = normalizeDashes(edu.score_value || "");
        const description = normalizeDashes(edu.description || "");

        const institutionHtml = institutionUrl
          ? `<a href="${escapeHtml(institutionUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(institution)}</a>`
          : escapeHtml(institution);

        const scoreChip =
          scoreLabel && scoreValue
            ? `<span class="tag-chip">${escapeHtml(scoreLabel)}: ${escapeHtml(scoreValue)}</span>`
            : "";

        return `
          <article class="ledger-row reveal">
            <div class="ledger-meta">
              <p class="text-body-sm">${escapeHtml(period)}</p>
              <div class="spotlight-meta">
                ${edu.is_active ? '<span class="tag-chip tag-chip--accent">Current</span>' : ""}
                ${scoreChip}
              </div>
            </div>
            <div class="ledger-body">
              <h4 class="text-heading-sm">${institutionHtml}</h4>
              <p class="text-body-sm text-secondary">${escapeHtml(degree)}</p>
              ${description ? `<div class="text-body-sm text-secondary ledger-description">${formatRichTextHtml(description)}</div>` : ""}
            </div>
          </article>
        `;
      })
      .join("");

    if (revealController) revealController.observeNew(container);
  } catch (error) {
    renderErrorState(container, {
      title: "Unable to load education",
      message: error?.message || "Check your connection and retry.",
      onRetry: () => loadEducation(container, revealController),
    });
  }
}

export async function loadCompetencies(container, revealController) {
  if (!container) return;
  renderLoadingState(container, {
    title: "Loading toolset and capabilities",
    count: 1,
  });

  try {
    const { data, error } = await supabase
      .from(DB_TABLES.COMPETENCIES)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const items = data || [];
    if (items.length === 0) {
      renderEmptyState(container, {
        title: "No tools listed yet",
        message: "Design software and core competencies will appear here.",
      });
      return;
    }

    const arsenal = items.filter((item) => item.category === "arsenal");
    const other = items.filter((item) => item.category !== "arsenal");

    const arsenalHtml =
      arsenal.length > 0
        ? `
          <div class="toolset-group reveal">
            <h3 class="text-body-sm">${escapeHtml(COMPETENCY_GROUP_HEADINGS.arsenal)}</h3>
            <ul class="toolset-grid" aria-label="${escapeHtml(COMPETENCY_GROUP_HEADINGS.arsenal)}">
              ${arsenal
                .map((item) => {
                  const name = normalizeDashes(item.name || "");
                  const iconUrl = sanitizeUrl(item.icon_url);
                  const iconHtml = iconUrl
                    ? `<img src="${escapeHtml(iconUrl)}" alt="" width="18" height="18" loading="lazy" decoding="async" />`
                    : "";
                  return `<li class="tool-item">${iconHtml}<span>${escapeHtml(name)}</span></li>`;
                })
                .join("")}
            </ul>
          </div>
        `
        : "";

    const otherHtml =
      other.length > 0
        ? `
          <div class="toolset-group reveal">
            <h3 class="text-body-sm">${escapeHtml(COMPETENCY_GROUP_HEADINGS.other)}</h3>
            <ul class="toolset-grid" aria-label="${escapeHtml(COMPETENCY_GROUP_HEADINGS.other)}">
              ${other
                .map(
                  (item) =>
                    `<li class="tool-item"><span>${escapeHtml(normalizeDashes(item.name || ""))}</span></li>`,
                )
                .join("")}
            </ul>
          </div>
        `
        : "";

    container.innerHTML = `${arsenalHtml}${otherHtml}`;
    if (revealController) revealController.observeNew(container);
  } catch (error) {
    renderErrorState(container, {
      title: "Unable to load capabilities",
      message: error?.message || "Check your connection and retry.",
      onRetry: () => loadCompetencies(container, revealController),
    });
  }
}

export async function initProfile(revealController) {
  const experienceContainer = document.getElementById("experience-container");
  const educationContainer = document.getElementById("education-container");
  const competenciesContainer = document.getElementById("competencies-container");

  await Promise.all([
    loadExperience(experienceContainer, revealController),
    loadEducation(educationContainer, revealController),
    loadCompetencies(competenciesContainer, revealController),
  ]);
}
