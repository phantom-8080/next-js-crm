// Credentials for Zoho OAuth

export const ZOHO_ACCOUNTS_URL = "https://accounts.zoho.com";

export const ZOHO_CLIENT_ID = "1000.TP98XTZY6ND55UF99POR87TXHGL5IN";

export const ZOHO_CLIENT_SECRET = "f9652b7dbde5870260bdbe9043b814d4662e20eb26";

export const ZOHO_REFRESH_TOKEN =
  "1000.d49861119a2c5dea31a34d14784af87a.7e02deea52211a4c59fdb8c76dcd6391";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

let cachedAccessToken = null;
let cachedExpiresAt = 0;
let refreshInFlight = null;

function getOAuthConfig() {
  const clientId = ZOHO_CLIENT_ID.trim();
  const clientSecret = ZOHO_CLIENT_SECRET.trim();
  const refreshToken = ZOHO_REFRESH_TOKEN.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Zoho credentials in lib/zoho-oauth.js: set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.",
    );
  }

  return { clientId, clientSecret, refreshToken, accountsUrl: ZOHO_ACCOUNTS_URL };
}

// Set the cached access token

function setCachedAccessToken(accessToken, expiresInSec) {
  cachedAccessToken = accessToken;
  const ttlMs = (Number(expiresInSec) > 0 ? Number(expiresInSec) : 3600) * 1000;
  cachedExpiresAt = Date.now() + ttlMs - EXPIRY_BUFFER_MS;
}

// Invalidate the cached access token

export function invalidateZohoAccessTokenCache() {
  cachedAccessToken = null;
  cachedExpiresAt = 0;
}

// Log the access token in development

function logAccessTokenInDev(source) {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[Zoho] access_token refreshed (${source})`);
}

// Get access token from Refresh Token

async function requestAccessTokenFromRefresh() {
  const { clientId, clientSecret, refreshToken, accountsUrl } = getOAuthConfig();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
    body,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json.access_token) {
    const detail = json.error ?? json.message ?? JSON.stringify(json);
    throw new Error(`Zoho token refresh failed: ${detail}`);
  }

  setCachedAccessToken(json.access_token, json.expires_in);
  return json.access_token;
}

// Returns a valid access token, refreshing when cache is near expiry.

export async function getZohoAccessToken({ force = false } = {}) {
  if (!force && cachedAccessToken && Date.now() < cachedExpiresAt) {
    logAccessTokenInDev("cache");
    return cachedAccessToken;
  }

  if (!force && refreshInFlight) {
    return refreshInFlight;
  }

  const work = requestAccessTokenFromRefresh();
  if (!force) {
    refreshInFlight = work;
  }

  try {
    const token = await work;
    logAccessTokenInDev(force ? "forced refresh" : "refresh");
    return token;
  } finally {
    if (!force) {
      refreshInFlight = null;
    }
  }
}

// Check if the response is an expired token

export function isZohoTokenExpiredResponse(res, body) {
  if (res.status === 401) return true;
  const code = String(body?.code ?? "").toUpperCase();
  return code === "INVALID_TOKEN" || code === "AUTHENTICATION_FAILURE";
}
