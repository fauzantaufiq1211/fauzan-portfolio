import { supabase } from "../config/supabase-client.js";
import { escapeHtml, formatDateTime } from "../utils/dom.js";

const ANALYTICS_ENDPOINT = "/api/analytics";
const numberFormatter = new Intl.NumberFormat("en-US");

const ALERT_ICON_SVG = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
`;

let isFetchingInfra = false;

function formatInt(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return numberFormatter.format(Math.round(Number(value)));
}

function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }
  return `${Number(value).toFixed(1)}%`;
}

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes))) {
    return "N/A";
  }
  const num = Math.max(0, Number(bytes));
  if (num < 1024) return `${Math.round(num)} B`;
  const kb = num / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function renderStatusChip(status) {
  if (status === "ok") {
    return '<span class="tag-chip infra-status-chip infra-status-chip--ok">Connected</span>';
  }
  if (status === "error") {
    return '<span class="tag-chip infra-status-chip infra-status-chip--error">Error</span>';
  }
  return '<span class="tag-chip infra-status-chip">Not Configured</span>';
}

const PROVIDER_REQUIRED_ENV = Object.freeze({
  cloudflare: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"],
  ga4: ["GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "GA4_PROPERTY_ID"],
  gsc: ["GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "GSC_SITE_URL"],
  vercel: ["VERCEL_API_TOKEN", "VERCEL_PROJECT_ID"],
});

export function renderProviderBody(providerKey, providerPayload) {
  const status = providerPayload?.status || "unconfigured";

  if (status === "unconfigured") {
    const missing =
      Array.isArray(providerPayload?.missingEnv) &&
      providerPayload.missingEnv.length > 0
        ? providerPayload.missingEnv
        : PROVIDER_REQUIRED_ENV[providerKey] || [];
    const envPills =
      missing.length > 0
        ? `<div class="infra-env-list">${missing
            .map((envName) => `<code class="infra-env-code">${escapeHtml(envName)}</code>`)
            .join("")}</div>`
        : "";
    return `
      <div class="infra-notice" role="status">
        <p class="text-body-sm text-secondary">
          Add the required Vercel environment variables to activate live telemetry for this service.
        </p>
        ${envPills}
      </div>
    `;
  }

  if (status === "error") {
    const errMsg =
      providerPayload?.error || "Unable to reach provider API.";
    return `
      <div class="infra-notice infra-notice--error" role="alert">
        <div class="infra-error-row">
          <span class="infra-error-icon">${ALERT_ICON_SVG}</span>
          <p class="text-body-sm"><strong>Provider request failed:</strong> ${escapeHtml(errMsg)}</p>
        </div>
        <div>
          <button
            type="button"
            class="btn btn-secondary btn-compact"
            data-retry-infra
          >
            Retry
          </button>
        </div>
      </div>
    `;
  }

  const data = providerPayload?.data || {};
  let metrics = [];
  let footnote = "";

  if (providerKey === "cloudflare") {
    metrics = [
      { label: "HTTP Requests", value: formatInt(data.requests30d) },
      { label: "Bandwidth Served", value: formatBytes(data.bandwidthBytes30d) },
      { label: "Cache Hit Ratio", value: formatPct(data.cacheHitRatioPct) },
      { label: "Threats Mitigated", value: formatInt(data.threats30d) },
    ];
    footnote = `Cached transfer: ${formatBytes(data.cachedBytes30d)} · Unique visitors (30d daily sum): ${formatInt(data.uniqueVisitors30d)}`;
  } else if (providerKey === "ga4") {
    metrics = [
      { label: "Active Users", value: formatInt(data.activeUsers30d) },
      { label: "Sessions", value: formatInt(data.sessions30d) },
      { label: "Page Views", value: formatInt(data.pageViews30d) },
      { label: "Engagement Rate", value: formatPct(data.engagementRatePct) },
    ];
  } else if (providerKey === "gsc") {
    metrics = [
      { label: "Organic Clicks", value: formatInt(data.clicks30d) },
      { label: "Impressions", value: formatInt(data.impressions30d) },
      { label: "Click-Through Rate", value: formatPct(data.ctrPct) },
      {
        label: "Average Position",
        value:
          data.avgPosition !== null && data.avgPosition !== undefined
            ? Number(data.avgPosition).toFixed(1)
            : "N/A",
      },
    ];
  } else if (providerKey === "vercel") {
    metrics = [
      { label: "Latest State", value: String(data.latestState || "N/A") },
      { label: "Target", value: String(data.latestTarget || "N/A") },
      {
        label: "Build Duration",
        value:
          data.buildDurationSec !== null && data.buildDurationSec !== undefined
            ? `${formatInt(data.buildDurationSec)}s`
            : "N/A",
      },
      {
        label: "Recent Health",
        value: `${formatInt(data.recentReadyCount)} / ${formatInt(data.recentTotalCount)} Ready`,
      },
    ];
    const parts = [];
    if (data.latestCreatedAt) {
      parts.push(`Latest deploy: ${formatDateTime(data.latestCreatedAt)}`);
    }
    if (data.commitSubject) {
      parts.push(`Commit: ${data.commitSubject}`);
    }
    footnote = parts.join(" · ");
  }

  return `
    <dl class="infra-metrics-grid">
      ${metrics
        .map(
          (item) => `
        <div class="infra-metric-cell">
          <dt class="text-caption">${escapeHtml(item.label)}</dt>
          <dd class="infra-metric-value">${escapeHtml(item.value)}</dd>
        </div>
      `,
        )
        .join("")}
    </dl>
    ${footnote ? `<p class="text-caption infra-card-footnote">${escapeHtml(footnote)}</p>` : ""}
  `;
}

export function renderProviderCard({ key, title, windowDefault }, providerPayload) {
  const windowLabel =
    providerPayload?.data?.windowLabel || windowDefault;

  return `
    <article class="infra-card" data-infra-provider="${escapeHtml(key)}">
      <header class="infra-card-header">
        <div>
          <h3 class="text-body"><strong>${escapeHtml(title)}</strong></h3>
          <p class="text-caption">${escapeHtml(windowLabel)}</p>
        </div>
        ${renderStatusChip(providerPayload?.status)}
      </header>
      ${renderProviderBody(key, providerPayload)}
    </article>
  `;
}

function renderLoadingSkeletons(container) {
  const cards = Array.from({ length: 4 })
    .map(() => '<div class="skeleton-block infra-skeleton-card" aria-hidden="true"></div>')
    .join("");
  container.innerHTML = `
    <div class="infra-loading-wrap" role="status" aria-live="polite" aria-busy="true">
      <p class="text-body-sm text-secondary">Fetching infrastructure telemetry...</p>
      <div class="infra-grid">${cards}</div>
    </div>
  `;
}

function renderEndpointError(container, message, onRetry) {
  container.innerHTML = `
    <div class="infra-notice infra-notice--error" role="alert">
      <div class="infra-error-row">
        <span class="infra-error-icon">${ALERT_ICON_SVG}</span>
        <p class="text-body-sm"><strong>Unable to load infrastructure telemetry:</strong> ${escapeHtml(message)}</p>
      </div>
      <div>
        <button
          type="button"
          class="btn btn-secondary btn-compact"
          data-retry-infra
        >
          Retry
        </button>
      </div>
    </div>
  `;
  const retryBtn = container.querySelector("[data-retry-infra]");
  retryBtn?.addEventListener("click", () => onRetry(true));
}

const PROVIDER_META = [
  {
    key: "cloudflare",
    title: "Cloudflare Traffic & Cache",
    windowDefault: "Last 30 days",
  },
  {
    key: "ga4",
    title: "Google Analytics 4",
    windowDefault: "Last 30 days",
  },
  {
    key: "gsc",
    title: "Google Search Console",
    windowDefault: "Last 30 days",
  },
  {
    key: "vercel",
    title: "Vercel Deployments",
    windowDefault: "Latest 5 deployments",
  },
];

export async function loadInfrastructureMetrics({
  forceRefresh = false,
  showToast,
} = {}) {
  const container = document.getElementById("overview-infra-container");
  const refreshBtn = document.getElementById("overview-infra-refresh-btn");
  const syncedEl = document.getElementById("overview-infra-synced");
  if (!container || isFetchingInfra) return;

  isFetchingInfra = true;
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing...";
  }
  renderLoadingSkeletons(container);

  const retryHandler = (force = true) =>
    loadInfrastructureMetrics({ forceRefresh: force, showToast });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      renderEndpointError(
        container,
        "Active administrator session token not found. Sign in again to inspect telemetry.",
        retryHandler,
      );
      return;
    }

    const res = await fetch(ANALYTICS_ENDPOINT, {
      method: "GET",
      cache: forceRefresh ? "no-cache" : "default",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const contentType = res.headers.get("content-type") || "";
    if (res.status === 404 || !contentType.includes("application/json")) {
      renderEndpointError(
        container,
        "Serverless endpoint (/api/analytics) is unavailable on a static file server. Deploy to Vercel or run vercel dev to load live metrics.",
        retryHandler,
      );
      return;
    }

    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload?.error || `Endpoint returned HTTP ${res.status}.`);
    }

    const providers = payload?.providers || {};
    if (syncedEl && payload?.updatedAt) {
      syncedEl.textContent = `Last synced: ${formatDateTime(payload.updatedAt)}`;
    }

    container.innerHTML = `
      <div class="infra-grid">
        ${PROVIDER_META.map((meta) =>
          renderProviderCard(meta, providers[meta.key]),
        ).join("")}
      </div>
    `;

    container.querySelectorAll("[data-retry-infra]").forEach((btn) => {
      btn.addEventListener("click", () => retryHandler(true));
    });

    if (forceRefresh) {
      showToast?.("Infrastructure metrics refreshed.");
    }
  } catch (error) {
    renderEndpointError(
      container,
      error?.message || "Check your network connection and retry.",
      retryHandler,
    );
  } finally {
    isFetchingInfra = false;
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Refresh Metrics";
    }
  }
}

export function initInfrastructureControls({ showToast } = {}) {
  const refreshBtn = document.getElementById("overview-infra-refresh-btn");
  if (!refreshBtn) return;

  refreshBtn.addEventListener("click", () => {
    loadInfrastructureMetrics({ forceRefresh: true, showToast });
  });
}
