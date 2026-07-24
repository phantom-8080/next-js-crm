import {
  DEFAULT_VISIBLE_API_NAMES,
  FALLBACK_FIELD_CATALOG,
  isExcludedContractCatalogField,
} from "@/lib/contracts/columns";

// Credentials for Zoho OAuth (env vars override these defaults in development/production).

export const ZOHO_ACCOUNTS_URL =
  process.env.ZOHO_ACCOUNTS_URL?.trim() || "https://accounts.zoho.com";

export const ZOHO_CLIENT_ID =
  process.env.ZOHO_CLIENT_ID?.trim() || "1000.TP98XTZY6ND55UF99POR87TXHGL5IN";

export const ZOHO_CLIENT_SECRET =
  process.env.ZOHO_CLIENT_SECRET?.trim() || "f9652b7dbde5870260bdbe9043b814d4662e20eb26";

export const ZOHO_REFRESH_TOKEN =
  process.env.ZOHO_REFRESH_TOKEN?.trim() ||
  "1000.476e128b37016b2a0f83416ce4762068.5a5cefee92eb3d44775f61774ab7e6a1";

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
      "Missing Zoho credentials in lib/zoho.js: set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.",
    );
  }

  return { clientId, clientSecret, refreshToken, accountsUrl: ZOHO_ACCOUNTS_URL };
}

function setCachedAccessToken(accessToken, expiresInSec) {
  cachedAccessToken = accessToken;
  const ttlMs = (Number(expiresInSec) > 0 ? Number(expiresInSec) : 3600) * 1000;
  cachedExpiresAt = Date.now() + ttlMs - EXPIRY_BUFFER_MS;
}

export function invalidateZohoAccessTokenCache() {
  cachedAccessToken = null;
  cachedExpiresAt = 0;
}

function logAccessTokenInDev(source) {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[Zoho] access_token refreshed (${source})`);
  console.log(`[Zoho] access_token: ${cachedAccessToken}`);
}

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
        " Check ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, and ZOHO_ACCOUNTS_URL (e.g. accounts.zoho.com vs accounts.zoho.eu) in lib/zoho.js or environment variables."
      : "";
    throw new Error(`Zoho token refresh failed: ${detail}.${hint}`);
  }

  setCachedAccessToken(json.access_token, json.expires_in);
  return json.access_token;
}

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

export const ZOHO_CRM_BASE = "https://www.zohoapis.com/crm/v7";
export const ZOHO_CRM_V8_BASE = "https://www.zohoapis.com/crm/v8";
export const ZOHO_CRM_MODULE_CONTRACTS = "Contracts";

/** ZAPI key for CRM function execute (`auth_type=apikey`). Env overrides default. */
export const ZOHO_FUNCTIONS_API_KEY =
  process.env.ZOHO_FUNCTIONS_API_KEY?.trim() ||
  "1003.70dbcb7d3d0747c200e13f9908cc6425.2b42b9673acd1f813fe12a82b5883ffa";

/** Field metadata (Manage columns) — CRM v8 */
export function getZohoModuleFieldsUrl(module = ZOHO_CRM_MODULE_CONTRACTS) {
  return `${ZOHO_CRM_V8_BASE}/settings/fields?module=${encodeURIComponent(module)}`;
}

/** Page layout sections (record detail grouping) — CRM v8 */
export function getZohoModuleLayoutsUrl(module = ZOHO_CRM_MODULE_CONTRACTS) {
  return `${ZOHO_CRM_V8_BASE}/settings/layouts?module=${encodeURIComponent(module)}`;
}

/**
 * Search records with criteria — CRM v3 (requires ZohoSearch.securesearch.READ)
 * @param {string} [module]
 * @param {{
 *   criteria?: string;
 *   fields?: string;
 *   page?: number;
 *   perPage?: number;
 *   word?: string;
 * }} [options]
 * @returns {string}
 */
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

/**
 * Execute a Zoho CRM custom function (same as ZOHO.CRM.FUNCTIONS.execute).
 *
 * @param {string} functionApiName
 * @param {Record<string, unknown>} functionArguments
 * @param {{ authType?: "apikey" | "oauth" }} [options]
 *   - `apikey` → auth_type=apikey&zapikey=… (recommended when OAuth lacks functions scope)
 *   - `oauth` → auth_type=oauth + Zoho-oauthtoken header
 * @returns {Promise<{ res: Response; body: any }>}
 */
export async function executeZohoCrmFunction(functionApiName, functionArguments, options = {}) {
  const name = String(functionApiName || "").trim();
  if (!name) {
    throw new Error("Zoho function API name is required.");
  }

  const authType = options.authType === "oauth" ? "oauth" : "apikey";
  const argumentsJson = JSON.stringify(functionArguments ?? {});
  // Zoho function execute often ignores body `arguments` for button/REST
  // functions — query-string `arguments` is what gets applied (verified).
  const formBody = new URLSearchParams({ arguments: argumentsJson });

  if (authType === "apikey") {
    const zapikey = ZOHO_FUNCTIONS_API_KEY.trim();
    if (!zapikey) {
      throw new Error("Missing Zoho functions API key: set ZOHO_FUNCTIONS_API_KEY.");
    }

    const url =
      `${ZOHO_CRM_BASE}/functions/${encodeURIComponent(name)}/actions/execute` +
      `?auth_type=apikey&zapikey=${encodeURIComponent(zapikey)}` +
      `&arguments=${encodeURIComponent(argumentsJson)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
      body: formBody,
    });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  }

  // OAuth2: https://www.zohoapis.com/crm/v7/functions/{name}/actions/execute?auth_type=oauth
  const url =
    `${ZOHO_CRM_BASE}/functions/${encodeURIComponent(name)}/actions/execute` +
    `?auth_type=oauth&arguments=${encodeURIComponent(argumentsJson)}`;

  async function postWithToken(token) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
      body: formBody,
    });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  }

  let token = await getZohoAccessToken();
  let result = await postWithToken(token);

  if (isZohoTokenExpiredResponse(result.res, result.body)) {
    invalidateZohoAccessTokenCache();
    token = await getZohoAccessToken({ force: true });
    result = await postWithToken(token);
  }

  return result;
}

/* ─── Record mapping ─── */

export function formatFieldValue(value) {
  if (value == null || value === "") return "";

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "object" && !Array.isArray(value)) {
    if (value.name != null && String(value.name) !== "") return String(value.name);
    if (value.id != null) return String(value.id);
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((v) => formatFieldValue(v))
      .filter(Boolean)
      .join(", ");
  }

  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const date = new Date(str);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  return str;
}

function extractLookupId(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object" && !Array.isArray(value) && value.id != null) {
    return String(value.id);
  }
  return "";
}

export function mapZohoRecord(row, visibleApiNames) {
  const fields = {};
  const lookups = {};

  for (const apiName of visibleApiNames) {
    const raw = row[apiName];
    fields[apiName] = formatFieldValue(raw);
    const lookupId = extractLookupId(raw);
    if (lookupId) lookups[apiName] = lookupId;
  }

  return {
    id: row.id != null ? String(row.id) : "",
    fields,
    lookups: Object.keys(lookups).length > 0 ? lookups : undefined,
  };
}

export function parseVisibleFields(searchParams) {
  const raw = searchParams.get("fields");
  if (!raw || !raw.trim()) {
    return [...DEFAULT_VISIBLE_API_NAMES];
  }

  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((name) => name !== "id");

  return names.length > 0 ? names : [...DEFAULT_VISIBLE_API_NAMES];
}

/* ─── List query helpers ─── */

/**
 * Field filters that need `contains` (and related) use Zoho's `filters` JSON param,
 * which is encoded into the existing `criteria` query string with this prefix so
 * pages/tables do not need a separate state field.
 */
export const ZOHO_FILTERS_PREFIX = "__zoho_filters__:";

/** @param {unknown} filtersObj */
export function encodeZohoFiltersParam(filtersObj) {
  return `${ZOHO_FILTERS_PREFIX}${JSON.stringify(filtersObj)}`;
}

/**
 * @param {string | null | undefined} raw
 * @returns {{ criteria: string | null; filters: string | null }}
 */
export function parseListSearchParam(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return { criteria: null, filters: null };
  if (value.startsWith(ZOHO_FILTERS_PREFIX)) {
    const filters = value.slice(ZOHO_FILTERS_PREFIX.length).trim();
    return { criteria: null, filters: filters || null };
  }
  return { criteria: value, filters: null };
}

/**
 * Build list + count URLs for a Zoho module.
 * @param {{
 *   module: string;
 *   base?: string;
 *   fields: string;
 *   page: number;
 *   perPage: number;
 *   criteria?: string | null;
 *   filters?: string | null;
 *   cvid?: string | null;
 * }} opts
 */
export function buildZohoModuleListUrls({
  module,
  base = "https://www.zohoapis.com/crm/v3",
  fields,
  page,
  perPage,
  criteria = null,
  filters = null,
  cvid = null,
}) {
  const encodedModule = encodeURIComponent(module);
  const fieldsQ = encodeURIComponent(fields);

  if (cvid) {
    return {
      listUrl: `${base}/${encodedModule}?cvid=${encodeURIComponent(cvid)}&fields=${fieldsQ}&per_page=${perPage}&page=${page}`,
      countUrl: `${base}/${encodedModule}/actions/count?cvid=${encodeURIComponent(cvid)}`,
    };
  }

  if (filters) {
    const filtersQ = encodeURIComponent(filters);
    return {
      listUrl: `${base}/${encodedModule}?fields=${fieldsQ}&per_page=${perPage}&page=${page}&filters=${filtersQ}`,
      countUrl: `${base}/${encodedModule}/actions/count?filters=${filtersQ}`,
    };
  }

  if (criteria) {
    const params = new URLSearchParams();
    params.set("criteria", criteria);
    params.set("fields", fields);
    params.set("page", String(page));
    params.set("per_page", String(perPage));
    return {
      listUrl: `${base}/${encodedModule}/search?${params.toString()}`,
      countUrl: `${base}/${encodedModule}/actions/count?criteria=${encodeURIComponent(criteria)}`,
    };
  }

  return {
    listUrl: `${base}/${encodedModule}?fields=${fieldsQ}&per_page=${perPage}&page=${page}`,
    countUrl: `${base}/${encodedModule}/actions/count`,
  };
}

/* ─── Search criteria ─── */

/**
 * Escape a criterion value for Zoho Search API (parentheses, comma, backslash).
 * @param {string} value
 */
export function escapeZohoCriteriaValue(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * @param {string} apiName
 * @param {string} operator
 * @param {string[]} values
 */
export function buildFieldCriterion(apiName, operator, values) {
  const cleaned = values.map((v) => String(v).trim()).filter(Boolean);
  if (!apiName || cleaned.length === 0) return null;

  const op = operator || "equals";

  if (op === "between") {
    if (cleaned.length < 2) return null;
    const a = escapeZohoCriteriaValue(cleaned[0]);
    const b = escapeZohoCriteriaValue(cleaned[1]);
    return `(${apiName}:between:${a},${b})`;
  }

  if (op === "in") {
    const joined = cleaned.map(escapeZohoCriteriaValue).join(",");
    return `(${apiName}:in:${joined})`;
  }

  const single = escapeZohoCriteriaValue(cleaned[0]);
  return `(${apiName}:${op}:${single})`;
}

/**
 * @param {{ apiName: string; operator: string; values: string[] }[]} clauses
 * @returns {string | null}
 */
export function buildAndCriteria(clauses) {
  const parts = clauses
    .map((c) => buildFieldCriterion(c.apiName, c.operator, c.values))
    .filter(Boolean);

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return parts.map((p) => `(${p})`).join("and");
}

/* ─── Record fetch (batched fields) ─── */

const FIELDS_PER_REQUEST = 45;

function chunkApiNames(apiNames, size) {
  const chunks = [];
  for (let i = 0; i < apiNames.length; i += size) {
    chunks.push(apiNames.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetches a Zoho Contracts record, batching the `fields` query to avoid URL length limits (413).
 * @param {string} recordId
 * @param {string[]} apiNames CRM field API names (without id)
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchZohoContractRecordById(recordId, apiNames) {
  let unique = [...new Set(apiNames.filter(Boolean))];
  if (unique.length === 0) {
    unique = ["Name"];
  }

  const groups = chunkApiNames(unique, FIELDS_PER_REQUEST);
  let merged = null;

  for (const group of groups) {
    const fieldSet = new Set(["id", ...group]);
    const zohoFields = [...fieldSet].join(",");
    const recordUrl = `${ZOHO_CRM_BASE}/Contracts/${encodeURIComponent(recordId)}?fields=${encodeURIComponent(zohoFields)}`;

    const { res, body } = await fetchZohoJson(recordUrl);

    if (!res.ok) {
      const err = new Error("Zoho CRM error");
      err.status = res.status;
      err.details = body;
      throw err;
    }

    const row = Array.isArray(body.data) ? body.data[0] : null;
    if (!row) {
      const err = new Error("Contract not found");
      err.status = 404;
      throw err;
    }

    merged = merged ? { ...merged, ...row } : { ...row };
  }

  if (!merged) {
    const err = new Error("Contract not found");
    err.status = 404;
    throw err;
  }

  return merged;
}

/**
 * @param {string} module Zoho CRM module API name
 * @param {string} recordId
 * @param {string[]} apiNames CRM field API names (without id)
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchZohoRecordById(module, recordId, apiNames) {
  let unique = [...new Set(apiNames.filter(Boolean))];
  if (unique.length === 0) {
    unique = ["Name"];
  }

  const groups = chunkApiNames(unique, FIELDS_PER_REQUEST);
  let merged = null;

  for (const group of groups) {
    const fieldSet = new Set(["id", ...group]);
    const zohoFields = [...fieldSet].join(",");
    const recordUrl = `${ZOHO_CRM_BASE}/${encodeURIComponent(module)}/${encodeURIComponent(recordId)}?fields=${encodeURIComponent(zohoFields)}`;

    const { res, body } = await fetchZohoJson(recordUrl);

    if (!res.ok) {
      const err = new Error("Zoho CRM error");
      err.status = res.status;
      err.details = body;
      throw err;
    }

    const row = Array.isArray(body.data) ? body.data[0] : null;
    if (!row) {
      const err = new Error("Record not found");
      err.status = 404;
      throw err;
    }

    merged = merged ? { ...merged, ...row } : { ...row };
  }

  if (!merged) {
    const err = new Error("Record not found");
    err.status = 404;
    throw err;
  }

  return merged;
}

/* ─── Custom views ─── */

/** Display order for Zoho custom-view categories. */
const CUSTOM_VIEW_CATEGORY_ORDER = [
  "created_by_me",
  "shared_with_me",
  "public_views",
  "other_users_views",
];

/** @type {Record<string, string>} */
const CUSTOM_VIEW_CATEGORY_LABELS = {
  created_by_me: "Created By Me",
  shared_with_me: "Shared With Me",
  public_views: "Public Views",
  other_users_views: "Other Users' Views",
};

/**
 * Fetch all Zoho custom views for a module (paginated, always live — no app cache).
 * @param {string} [module]
 * @returns {Promise<import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]>}
 */
export async function fetchZohoCustomViews(module = "Contracts") {
  /** @type {Record<string, unknown>[]} */
  const allViews = [];
  /** @type {Record<string, string>} */
  let translations = {};
  let page = 1;
  let more = true;

  while (more && page <= 20) {
    const url = `${ZOHO_CRM_BASE}/settings/custom_views?module=${encodeURIComponent(module)}&page=${page}&per_page=200`;
    const { res, body } = await fetchZohoJson(url);
    if (!res.ok || !Array.isArray(body.custom_views)) {
      if (page === 1) return [];
      break;
    }

    if (body.info?.translation && typeof body.info.translation === "object") {
      translations = { ...translations, ...body.info.translation };
    }

    allViews.push(...body.custom_views);
    more = body.info?.more_records === true;
    page += 1;
  }

  /** @type {import("@/lib/contracts/filterTypes").ContractFilterFieldMeta[]} */
  const views = allViews
    .filter((view) => view?.id != null && String(view.id).trim() !== "")
    .map((view) => {
      const categoryKey = String(view.category ?? "").trim() || "public_views";
      const groupLabel =
        translations[categoryKey] ||
        CUSTOM_VIEW_CATEGORY_LABELS[categoryKey] ||
        (view.system_defined ? "Public Views" : "Created By Me");

      return {
        apiName: `__custom_view__${view.id}`,
        label: String(view.display_value ?? view.name ?? "View").trim() || "View",
        dataType: "custom_view",
        operators: [],
        options: [],
        hasOptions: true,
        section: /** @type {const} */ ("system_defined"),
        groupLabel,
        customViewId: String(view.id),
        favorite: view.favorite != null && Number(view.favorite) > 0,
        defaultView: view.default === true,
        systemDefined: view.system_defined === true,
      };
    });

  const categoryRank = (key) => {
    const idx = CUSTOM_VIEW_CATEGORY_ORDER.indexOf(key);
    return idx === -1 ? CUSTOM_VIEW_CATEGORY_ORDER.length : idx;
  };

  const labelToKey = new Map(
    Object.entries({ ...CUSTOM_VIEW_CATEGORY_LABELS, ...translations }).map(([key, label]) => [
      label,
      key,
    ]),
  );

  views.sort((a, b) => {
    const aKey = labelToKey.get(a.groupLabel ?? "") ?? "";
    const bKey = labelToKey.get(b.groupLabel ?? "") ?? "";
    const byCat = categoryRank(aKey) - categoryRank(bKey);
    if (byCat !== 0) return byCat;
    if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return views;
}

/**
 * Delete a Zoho custom view.
 * Endpoint: DELETE /crm/v7/settings/custom_views?module={module}&ids={id}
 * Requires OAuth scope ZohoCRM.settings.custom_views.DELETE (or .ALL).
 *
 * @param {string} customViewId
 * @param {string} [module]
 */
export async function deleteZohoCustomView(customViewId, module = "Contracts") {
  const id = String(customViewId ?? "").trim();
  if (!id) {
    const err = new Error("Custom view id is required");
    err.status = 400;
    throw err;
  }

  const url = `${ZOHO_CRM_BASE}/settings/custom_views?module=${encodeURIComponent(module)}&ids=${encodeURIComponent(id)}`;
  const { res, body } = await fetchZohoJson(url, { method: "DELETE" });

  const row = Array.isArray(body?.custom_views) ? body.custom_views[0] : null;
  const rowStatus = String(row?.status ?? "").toLowerCase();
  const rowCode = String(row?.code ?? body?.code ?? "").toUpperCase();

  if (!res.ok || rowStatus === "error") {
    let message =
      row?.message ?? body?.message ?? body?.error ?? "Failed to delete custom view in Zoho CRM";
    if (rowCode === "OAUTH_SCOPE_MISMATCH" || body?.code === "OAUTH_SCOPE_MISMATCH") {
      message =
        "Zoho OAuth is missing custom-view delete permission. Add scope ZohoCRM.settings.custom_views.ALL, regenerate the refresh token, and update ZOHO_REFRESH_TOKEN.";
    }
    const err = new Error(message);
    err.status = res.status >= 400 ? res.status : 400;
    err.details = body;
    throw err;
  }

  return { id, raw: body };
}

/* ─── Contracts field catalog ─── */

export const HIDDEN_API_NAMES = new Set([
  "$approval_state",
  "$approved",
  "$editable",
  "$field_states",
  "$process_flow",
  "$review_process",
  "$review",
  "$state",
  "$status",
  "$zia_owner_assignment",
  "$orchestration",
  "$in_merge",
  "$pathfinder",
  "$followed",
  "$followers",
]);

function mapZohoField(field) {
  return {
    apiName: field.api_name,
    label: field.field_label ?? field.api_name,
    dataType: field.data_type ?? "text",
    visible: field.visible !== false,
  };
}

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
/** @type {{ fields: import("@/lib/contracts/columns").CrmFieldMeta[], source: "zoho" | "fallback", cachedAt: number } | null} */
let catalogCache = null;

/** @returns {Promise<{ fields: import("@/lib/contracts/columns").CrmFieldMeta[], source: "zoho" | "fallback" }>} */
export async function loadContractsFieldCatalog() {
  if (catalogCache && Date.now() - catalogCache.cachedAt < CATALOG_CACHE_TTL_MS) {
    return { fields: catalogCache.fields, source: catalogCache.source };
  }

  const zohoUrl = getZohoModuleFieldsUrl("Contracts");

  try {
    const { res, body } = await fetchZohoJson(zohoUrl);

    if (res.ok && Array.isArray(body.fields)) {
      const fields = body.fields
        .filter((f) => f.api_name && !HIDDEN_API_NAMES.has(f.api_name))
        .filter((f) => f.api_name !== "id")
        .map(mapZohoField)
        .filter((f) => !isExcludedContractCatalogField(f))
        .sort((a, b) => a.label.localeCompare(b.label));

      const result = { fields, source: /** @type {const} */ ("zoho") };
      catalogCache = { ...result, cachedAt: Date.now() };
      return result;
    }
  } catch (err) {
    console.error("Zoho fields request failed:", err);
  }

  const fallback = {
    fields: FALLBACK_FIELD_CATALOG.map((f) => ({ ...f })),
    source: /** @type {const} */ ("fallback"),
  };
  catalogCache = { ...fallback, cachedAt: Date.now() };
  return fallback;
}
