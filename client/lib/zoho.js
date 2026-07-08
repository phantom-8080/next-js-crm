import {
  getZohoAccessToken,
  invalidateZohoAccessTokenCache,
  isZohoTokenExpiredResponse,
} from "@/lib/zoho-oauth";

export const ZOHO_CRM_BASE = "https://www.zohoapis.com/crm/v3";
export const ZOHO_CRM_V8_BASE = "https://www.zohoapis.com/crm/v8";
export const ZOHO_CRM_MODULE_CONTRACTS = "Contracts";

/** Field metadata (Manage columns) — CRM v8 */
export function getZohoModuleFieldsUrl(module = ZOHO_CRM_MODULE_CONTRACTS) {
  return `${ZOHO_CRM_V8_BASE}/settings/fields?module=${encodeURIComponent(module)}`;
}

/** Page layout sections (record detail grouping) — CRM v8 */
export function getZohoModuleLayoutsUrl(module = ZOHO_CRM_MODULE_CONTRACTS) {
  return `${ZOHO_CRM_V8_BASE}/settings/layouts?module=${encodeURIComponent(module)}`;
}

async function fetchWithToken(url, token) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

/**
 * Authenticated GET to Zoho CRM. Retries once after refreshing the access token.
 */
export async function fetchZohoJson(url) {
  let token = await getZohoAccessToken();
  let result = await fetchWithToken(url, token);

  if (isZohoTokenExpiredResponse(result.res, result.body)) {
    invalidateZohoAccessTokenCache();
    token = await getZohoAccessToken({ force: true });
    result = await fetchWithToken(url, token);
  }

  return result;
}
