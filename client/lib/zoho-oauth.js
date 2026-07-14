// Credentials for Zoho OAuth (env vars override these defaults in development/production).

export const ZOHO_ACCOUNTS_URL =
  process.env.ZOHO_ACCOUNTS_URL?.trim() || "https://accounts.zoho.com";

export const ZOHO_CLIENT_ID =
  process.env.ZOHO_CLIENT_ID?.trim() || "1000.TP98XTZY6ND55UF99POR87TXHGL5IN";

export const ZOHO_CLIENT_SECRET =
  process.env.ZOHO_CLIENT_SECRET?.trim() || "f9652b7dbde5870260bdbe9043b814d4662e20eb26";

export const ZOHO_REFRESH_TOKEN =
  process.env.ZOHO_REFRESH_TOKEN?.trim() ||
  "1000.aec79cc655488390ee24a2775897eb81.d8f701534a016d73f1c89865102e7ef5";

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
  console.log(`[Zoho] access_token: ${cachedAccessToken}`);
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
    const hint =
      String(detail).toLowerCase().includes("access denied") ?
        " Check ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, and ZOHO_ACCOUNTS_URL (e.g. accounts.zoho.com vs accounts.zoho.eu) in lib/zoho-oauth.js or environment variables."
      : "";
    throw new Error(`Zoho token refresh failed: ${detail}.${hint}`);
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

  if (force) {
    invalidateZohoAccessTokenCache();
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = requestAccessTokenFromRefresh()
    .then((token) => {
      logAccessTokenInDev(force ? "forced refresh" : "refresh");
      return token;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

// Check if the response is an expired token

export function isZohoTokenExpiredResponse(res, body) {
  const code = String(body?.code ?? "").toUpperCase();
  if (code === "INVALID_TOKEN" || code === "AUTHENTICATION_FAILURE") {
    return true;
  }
  if (
    code === "OAUTH_SCOPE_MISMATCH" ||
    code === "NO_PERMISSION" ||
    code === "INVALID_MODULE" ||
    code === "AUTHORIZATION_FAILED"
  ) {
    return false;
  }
  if (res.status !== 401) return false;

  const message = String(body?.message ?? body?.error ?? "").toLowerCase();
  return (
    message.includes("invalid oauth") ||
    message.includes("invalid token") ||
    message.includes("authentication failed")
  );
}
