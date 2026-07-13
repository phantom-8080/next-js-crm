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

/** Search records with criteria — CRM v3 (requires ZohoSearch.securesearch.READ) */
export function getZohoModuleSearchUrl(
  module = ZOHO_CRM_MODULE_CONTRACTS,
  { criteria, fields, page = 1, perPage = 100, word } = {},
) {
  const params = new URLSearchParams();
  if (criteria) params.set("criteria", criteria);
  if (fields) params.set("fields", fields);
  if (word) params.set("word", String(word));
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  return `${ZOHO_CRM_BASE}/${encodeURIComponent(module)}/search?${params.toString()}`;
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
