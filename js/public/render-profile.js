import { DB_TABLES, supabase } from "../config/supabase-client.js";
import {
  escapeHtml,
  normalizeDashes,
  parseDescriptionList,
  renderEmptyState,
  renderErrorState,
  renderLoadingState,
  sanitizeRichText,
  sanitizeUrl,
} from "../utils/dom.js";

const HIGH_SCHOOL_PATTERN = /sman\s*3|sma\s+negeri|high\s*school|rohis|triple\s*magazine/i;

function isHighSchoolEntry(record) {
  const combined = `${record.institution || ""} ${record.company || ""} ${record.degree || ""} ${record.role || ""}`;
  return HIGH_SCHOOL_PATTERN.test(combined);
}

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

    const filtered = (data || []).filter((item) => !isHighSchoolEntry(item));
    if (filtered.length === 0) {
      renderEmptyState(container, {
        title: "No experience records published yet",
        message: "Professional roles and creative engagements will appear here once added.",
      });
      return;
    }

    container.innerHTML = filtered
      .map((exp) => {
        const role = normalizeDashes(exp.role || "Creative Specialist");
        const company = normalizeDashes(exp.company || "");
        const companyUrl = sanitizeUrl(exp.company_link);
        const location = normalizeDashes(exp.location || "");
        const period = normalizeDashes(exp.period || "");
        const type = normalizeDashes(exp.type || "");
        const points = parseDescriptionList(exp.description).map((pt) =>
          normalizeDashes(pt),
        );

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
          <article class="ledger-row reveal">
            <div class="ledger-meta">
              <p class="text-body-sm">${escapeHtml(period)}</p>
              ${location ? `<p class="text-caption">${escapeHtml(location)}</p>` : ""}
              ${type ? `<div><span class="tag-chip">${escapeHtml(type)}</span></div>` : ""}
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

// Excludes SMAN 3 Bogor high school records so only university degrees (BINUS & Brawijaya University) render.
export async function loadEducation(container, revealController) {
  if (!container) return;
  renderLoadingState(container, {
    title: "Loading university education",
    count: 2,
  });

  try {
    const { data, error } = await supabase
      .from(DB_TABLES.EDUCATION)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const universities = (data || []).filter((edu) => !isHighSchoolEntry(edu));
    if (universities.length === 0) {
      renderEmptyState(container, {
        title: "No university records published yet",
        message: "Academic degrees and university credentials will appear here.",
      });
      return;
    }

    container.innerHTML = universities
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
              ${description ? `<div class="text-body-sm text-secondary">${sanitizeRichText(description)}</div>` : ""}
            </div>
          </article>
        `;
      })
      .join("");

    if (revealController) revealController.observeNew(container);
  } catch (error) {
    renderErrorState(container, {
      title: "Unable to load university education",
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
            <h3 class="text-body-sm">Core Creative Software</h3>
            <ul class="toolset-grid" aria-label="Core creative software">
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
            <h3 class="text-body-sm">Strategic &amp; Production Capabilities</h3>
            <ul class="toolset-grid" aria-label="Strategic and production capabilities">
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
