import { createSign } from "node:crypto";

const DEFAULT_SUPABASE_URL = "https://mrxttnlcpoixnvhngvtw.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeHR0bmxjcG9peG52aG5ndnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDM2MDIsImV4cCI6MjA4MzQ3OTYwMn0.1tK-18DVOokyI_uDiqkelHmALgmgeVyI9JXwPgt5sQM";
const DEFAULT_ALLOWED_EMAILS = "admin@fauzantaufiq.id";
const PROVIDER_TIMEOUT_MS = 8000;

const CLOUDFLARE_GRAPHQL_QUERY = `
  query ZoneTraffic30d($zoneTag: string!, $since: Date!, $until: Date!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        httpRequests1dGroups(
          limit: 31
          filter: { date_geq: $since, date_leq: $until }
          orderBy: [date_ASC]
        ) {
          dimensions {
            date
          }
          sum {
            requests
            bytes
            cachedBytes
            threats
            pageViews
          }
          uniq {
            uniques
          }
        }
      }
    }
  }
`;

function sendJson(res, statusCode, body, headers = {}) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  if (typeof res.status === "function") {
    return res.status(statusCode).json(body);
  }
  res.statusCode = statusCode;
  res.end(JSON.stringify(body));
  return undefined;
}

function getAllowedAdminEmails() {
  const raw = process.env.ADMIN_ALLOWED_EMAILS || DEFAULT_ALLOWED_EMAILS;
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getUtcDateWindow30d() {
  const now = Date.now();
  const until = new Date(now).toISOString().slice(0, 10);
  const since = new Date(now - 29 * 86_400_000).toISOString().slice(0, 10);
  return { since, until };
}

function scrubSecrets(message) {
  const raw = String(message || "Upstream provider request failed.");
  const secrets = [
    process.env.CLOUDFLARE_API_TOKEN,
    process.env.CLOUDFLARE_ZONE_ID,
    process.env.GOOGLE_PRIVATE_KEY,
    process.env.GOOGLE_CLIENT_EMAIL,
    process.env.VERCEL_API_TOKEN,
  ].filter((val) => val && String(val).length >= 6);

  let safe = raw;
  secrets.forEach((secret) => {
    safe = safe.split(String(secret)).join("[REDACTED]");
  });
  return safe.length > 180 ? `${safe.slice(0, 177)}...` : safe;
}

function normalizePrivateKey(rawKey) {
  return String(rawKey || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
}

// Signs an RS256 service-account JWT via node:crypto without external Google SDKs.
async function fetchGoogleAccessToken(clientEmail, rawPrivateKey, scopes) {
  const nowSec = Math.floor(Date.now() / 1000);
  const headerB64 = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const claimsB64 = Buffer.from(
    JSON.stringify({
      iss: clientEmail.trim(),
      scope: scopes.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  ).toString("base64url");

  const unsignedJwt = `${headerB64}.${claimsB64}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();

  const signature = signer.sign(normalizePrivateKey(rawPrivateKey), "base64url");
  const assertion = `${unsignedJwt}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google OAuth token exchange returned HTTP ${tokenRes.status}.`);
  }

  const tokenJson = await tokenRes.json();
  if (!tokenJson?.access_token) {
    throw new Error("Google OAuth response did not include an access token.");
  }
  return tokenJson.access_token;
}

async function verifyAdminBearerToken(req) {
  const authHeader =
    req.headers?.authorization || req.headers?.Authorization || "";
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : "";

  if (!token) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const supabaseUrl = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(
    /\/+$/,
    "",
  );
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  let userRes;
  try {
    userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Supabase auth verification network error:", error);
    return {
      ok: false,
      status: 502,
      error: "Unable to verify session with authentication service.",
    };
  }

  if (!userRes.ok) {
    return {
      ok: false,
      status: 401,
      error: "Invalid or expired administrator session.",
    };
  }

  const user = await userRes.json();
  const email = String(user?.email || "").trim().toLowerCase();
  const allowedEmails = getAllowedAdminEmails();

  if (!email || !allowedEmails.has(email)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden. Account is not authorized for administrator metrics.",
    };
  }

  return { ok: true, email };
}

async function queryCloudflare(updatedAt) {
  const token = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();
  const zoneTag = String(process.env.CLOUDFLARE_ZONE_ID || "").trim();
  const missingEnv = [
    !token ? "CLOUDFLARE_API_TOKEN" : "",
    !zoneTag ? "CLOUDFLARE_ZONE_ID" : "",
  ].filter(Boolean);

  if (missingEnv.length > 0) {
    return {
      status: "unconfigured",
      missingEnv,
      data: null,
      error: "Environment variables not configured on Vercel.",
    };
  }

  const { since, until } = getUtcDateWindow30d();
  const cfRes = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: CLOUDFLARE_GRAPHQL_QUERY,
      variables: { zoneTag, since, until },
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!cfRes.ok) {
    throw new Error(`Cloudflare API returned HTTP ${cfRes.status}.`);
  }

  const payload = await cfRes.json();
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new Error(
      payload.errors[0]?.message || "Cloudflare GraphQL query returned an error.",
    );
  }

  const groups = payload?.data?.viewer?.zones?.[0]?.httpRequests1dGroups;
  if (!Array.isArray(groups)) {
    throw new Error("Cloudflare zone analytics payload was empty or inaccessible.");
  }

  let requests30d = 0;
  let bandwidthBytes30d = 0;
  let cachedBytes30d = 0;
  let threats30d = 0;
  let pageViews30d = 0;
  let uniqueVisitors30d = 0;

  groups.forEach((bucket) => {
    requests30d += Number(bucket?.sum?.requests || 0);
    bandwidthBytes30d += Number(bucket?.sum?.bytes || 0);
    cachedBytes30d += Number(bucket?.sum?.cachedBytes || 0);
    threats30d += Number(bucket?.sum?.threats || 0);
    pageViews30d += Number(bucket?.sum?.pageViews || 0);
    uniqueVisitors30d += Number(bucket?.uniq?.uniques || 0);
  });

  const cacheHitRatioPct =
    bandwidthBytes30d === 0
      ? null
      : Math.round((cachedBytes30d / bandwidthBytes30d) * 1000) / 10;

  return {
    status: "ok",
    missingEnv: [],
    updatedAt,
    data: {
      windowLabel: "Last 30 days",
      since,
      until,
      requests30d,
      pageViews30d,
      bandwidthBytes30d,
      cachedBytes30d,
      cacheHitRatioPct,
      threats30d,
      uniqueVisitors30d,
    },
  };
}

async function queryGa4(getSharedGoogleToken, updatedAt) {
  const clientEmail = String(process.env.GOOGLE_CLIENT_EMAIL || "").trim();
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || "").trim();
  const rawPropertyId = String(process.env.GA4_PROPERTY_ID || "").trim();
  const missingEnv = [
    !clientEmail ? "GOOGLE_CLIENT_EMAIL" : "",
    !privateKey ? "GOOGLE_PRIVATE_KEY" : "",
    !rawPropertyId ? "GA4_PROPERTY_ID" : "",
  ].filter(Boolean);

  if (missingEnv.length > 0) {
    return {
      status: "unconfigured",
      missingEnv,
      data: null,
      error: "Environment variables not configured on Vercel.",
    };
  }

  const propertyId = rawPropertyId.replace(/^properties\//i, "");
  if (!/^\d+$/.test(propertyId)) {
    throw new Error("GA4_PROPERTY_ID must be a numeric property identifier.");
  }

  const accessToken = await getSharedGoogleToken();
  const gaRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "29daysAgo", endDate: "today" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagementRate" },
        ],
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    },
  );

  if (!gaRes.ok) {
    throw new Error(`Google Analytics Data API returned HTTP ${gaRes.status}.`);
  }

  const report = await gaRes.json();
  const values = report?.rows?.[0]?.metricValues || [];
  const activeUsers30d = Number(values[0]?.value || 0);
  const sessions30d = Number(values[1]?.value || 0);
  const pageViews30d = Number(values[2]?.value || 0);
  const rawEngagement = values[3]?.value;
  const engagementRatePct =
    rawEngagement !== undefined && sessions30d > 0
      ? Math.round(Number(rawEngagement) * 1000) / 10
      : null;

  return {
    status: "ok",
    missingEnv: [],
    updatedAt,
    data: {
      windowLabel: "Last 30 days",
      activeUsers30d,
      sessions30d,
      pageViews30d,
      engagementRatePct,
    },
  };
}

async function querySearchConsole(getSharedGoogleToken, updatedAt) {
  const clientEmail = String(process.env.GOOGLE_CLIENT_EMAIL || "").trim();
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || "").trim();
  const siteUrl = String(process.env.GSC_SITE_URL || "").trim();
  const missingEnv = [
    !clientEmail ? "GOOGLE_CLIENT_EMAIL" : "",
    !privateKey ? "GOOGLE_PRIVATE_KEY" : "",
    !siteUrl ? "GSC_SITE_URL" : "",
  ].filter(Boolean);

  if (missingEnv.length > 0) {
    return {
      status: "unconfigured",
      missingEnv,
      data: null,
      error: "Environment variables not configured on Vercel.",
    };
  }

  const { since, until } = getUtcDateWindow30d();
  const accessToken = await getSharedGoogleToken();
  const gscRes = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: since,
        endDate: until,
        dataState: "all",
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    },
  );

  if (!gscRes.ok) {
    throw new Error(`Search Console API returned HTTP ${gscRes.status}.`);
  }

  const payload = await gscRes.json();
  const row = payload?.rows?.[0] || null;
  const clicks30d = Math.round(Number(row?.clicks || 0));
  const impressions30d = Math.round(Number(row?.impressions || 0));
  const ctrPct =
    impressions30d === 0
      ? null
      : Math.round(Number(row?.ctr || 0) * 1000) / 10;
  const avgPosition =
    impressions30d === 0
      ? null
      : Math.round(Number(row?.position || 0) * 10) / 10;

  return {
    status: "ok",
    missingEnv: [],
    updatedAt,
    data: {
      windowLabel: "Last 30 days",
      since,
      until,
      clicks30d,
      impressions30d,
      ctrPct,
      avgPosition,
    },
  };
}

async function queryVercelDeployments(updatedAt) {
  const token = String(process.env.VERCEL_API_TOKEN || "").trim();
  const projectId = String(process.env.VERCEL_PROJECT_ID || "").trim();
  const teamId = String(process.env.VERCEL_TEAM_ID || "").trim();
  const missingEnv = [
    !token ? "VERCEL_API_TOKEN" : "",
    !projectId ? "VERCEL_PROJECT_ID" : "",
  ].filter(Boolean);

  if (missingEnv.length > 0) {
    return {
      status: "unconfigured",
      missingEnv,
      data: null,
      error: "Environment variables not configured on Vercel.",
    };
  }

  const params = new URLSearchParams({
    projectId,
    limit: "5",
  });
  if (teamId) params.set("teamId", teamId);

  const vercelRes = await fetch(
    `https://api.vercel.com/v6/deployments?${params.toString()}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    },
  );

  if (!vercelRes.ok) {
    throw new Error(`Vercel REST API returned HTTP ${vercelRes.status}.`);
  }

  const payload = await vercelRes.json();
  const deployments = Array.isArray(payload?.deployments)
    ? payload.deployments
    : [];
  const latest = deployments[0] || null;

  const createdMs = latest?.created ?? latest?.createdAt ?? null;
  const readyMs = latest?.ready ?? null;
  const buildingMs = latest?.buildingAt ?? createdMs;
  const buildDurationSec =
    readyMs && buildingMs && readyMs >= buildingMs
      ? Math.round((readyMs - buildingMs) / 1000)
      : null;

  const rawCommit = String(
    latest?.meta?.githubCommitMessage ||
      latest?.meta?.gitlabCommitMessage ||
      latest?.meta?.bitbucketCommitMessage ||
      "",
  )
    .split(/\r?\n/)[0]
    .trim();

  const recentReadyCount = deployments.filter(
    (d) => String(d?.state || d?.readyState || "").toUpperCase() === "READY",
  ).length;

  return {
    status: "ok",
    missingEnv: [],
    updatedAt,
    data: {
      windowLabel: "Latest 5 deployments",
      latestState: String(
        latest?.state || latest?.readyState || "UNKNOWN",
      ).toUpperCase(),
      latestTarget: latest?.target === "production" ? "Production" : "Preview",
      latestCreatedAt: createdMs ? new Date(createdMs).toISOString() : null,
      buildDurationSec,
      commitSubject: rawCommit
        ? rawCommit.length > 72
          ? `${rawCommit.slice(0, 69)}...`
          : rawCommit
        : "",
      recentReadyCount,
      recentTotalCount: deployments.length,
    },
  };
}

function unwrapSettledResult(providerName, settled) {
  if (settled.status === "fulfilled") {
    return settled.value;
  }
  const safeError = scrubSecrets(settled.reason?.message);
  console.error(`Analytics provider "${providerName}" failed: ${safeError}`);
  return {
    status: "error",
    missingEnv: [],
    data: null,
    error: safeError,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(
      res,
      405,
      { error: "Method not allowed. Use GET." },
      { Allow: "GET", "Cache-Control": "no-store" },
    );
  }

  const authCheck = await verifyAdminBearerToken(req);
  if (!authCheck.ok) {
    return sendJson(
      res,
      authCheck.status,
      { error: authCheck.error },
      { "Cache-Control": "no-store" },
    );
  }

  const updatedAt = new Date().toISOString();
  let sharedGoogleTokenPromise = null;

  const getSharedGoogleToken = () => {
    if (!sharedGoogleTokenPromise) {
      sharedGoogleTokenPromise = fetchGoogleAccessToken(
        process.env.GOOGLE_CLIENT_EMAIL || "",
        process.env.GOOGLE_PRIVATE_KEY || "",
        [
          "https://www.googleapis.com/auth/analytics.readonly",
          "https://www.googleapis.com/auth/webmasters.readonly",
        ],
      );
    }
    return sharedGoogleTokenPromise;
  };

  const [cfSettled, gaSettled, gscSettled, vercelSettled] =
    await Promise.allSettled([
      queryCloudflare(updatedAt),
      queryGa4(getSharedGoogleToken, updatedAt),
      querySearchConsole(getSharedGoogleToken, updatedAt),
      queryVercelDeployments(updatedAt),
    ]);

  return sendJson(
    res,
    200,
    {
      updatedAt,
      providers: {
        cloudflare: unwrapSettledResult("cloudflare", cfSettled),
        ga4: unwrapSettledResult("ga4", gaSettled),
        gsc: unwrapSettledResult("gsc", gscSettled),
        vercel: unwrapSettledResult("vercel", vercelSettled),
      },
    },
    { "Cache-Control": "private, max-age=300" },
  );
}
