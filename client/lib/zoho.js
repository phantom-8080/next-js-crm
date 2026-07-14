import {
  getZohoAccessToken,
  invalidateZohoAccessTokenCache,
  isZohoTokenExpiredResponse,
} from "@/lib/zoho-oauth";

export const ZOHO_CRM_BASE = "https://www.zohoapis.com/crm/v7";
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

/**
 * @param {string} url
 * @param {string} token
 * @param {{ method?: string; body?: unknown }} [options]
 */
async function fetchWithToken(url, token, options = {}) {
  const method = options.method ?? "GET";
  /** @type {Record<string, string>} */
  const headers = {
    Authorization: `Zoho-oauthtoken ${token}`,
  };
  /** @type {RequestInit} */
  const init = { method, headers, cache: "no-store" };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

/**
 * Authenticated request to Zoho CRM. Retries once after refreshing the access token.
 * @param {string} url
 * @param {{ method?: string; body?: unknown }} [options]
 */
export async function fetchZohoJson(url, options = {}) {
  let token = await getZohoAccessToken();
  let result = await fetchWithToken(url, token, options);

  if (isZohoTokenExpiredResponse(result.res, result.body)) {
    invalidateZohoAccessTokenCache();
    token = await getZohoAccessToken({ force: true });
    result = await fetchWithToken(url, token, options);
  }

  return result;
}
