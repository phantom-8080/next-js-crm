import {
  buildFieldCriterion,
  fetchZohoJson,
  formatFieldValue,
  getZohoModuleFieldsUrl,
  getZohoModuleLayoutsUrl,
  getZohoModuleSearchUrl,
  ZOHO_CRM_BASE,
} from "@/lib/zoho";
import {
  getKnownLookupFieldConfig,
  isLookupLikeDataType,
  isUserLikeDataType,
  looksLikeZohoId,
} from "@/lib/contracts/filterMeta";

/** @type {Set<string>} */
export const ALLOWED_SUGGESTION_MODULES = new Set([
  "Contracts",
  "Vendors",
  "Deals",
  "Accounts",
  "Contacts",
  "Products",
  "ServiceCompletions",
  "Notes",
  "Bids",
  "Emails",
  "Vendor_Invoices",
  "Team_Commissions",
]);

/** Picklists that load options via suggestion API on focus (not checkbox lists). */
const PICKLIST_SUGGESTION_FIELDS = new Set([
  "Category",
  "Status", // Work Status
  "Scheduling_Status", // Schedule / Scheduling Status
  "CTI_Round",
]);

const MAX_SUGGESTIONS = 100;
const FETCH_PER_PAGE = 200;

/**
 * @param {string} apiName
 * @returns {string | null}
 */
export function normalizeSuggestionFieldApiName(apiName) {
  const raw = String(apiName ?? "").trim();
  if (!raw || raw.startsWith("__")) return null;
  if (raw.includes(".")) {
    const parts = raw.split(".");
    const leaf = parts[parts.length - 1]?.trim();
    return leaf || null;
  }
  return raw;
}

/** @param {unknown} raw */
function displayValue(raw) {
  return formatFieldValue(raw).trim();
}

/** @param {unknown} raw */
function lookupObjectName(raw) {
  if (raw == null || raw === "") return "";
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const name =
      raw.name ??
      raw.Name ??
      raw.Product_Name ??
      raw.full_name ??
      raw.display_value ??
      raw.Deal_Name ??
      raw.SOWID;
    if (name != null && String(name).trim() !== "") return String(name).trim();
    return "";
  }
  const str = String(raw).trim();
  if (looksLikeZohoId(str)) return "";
  return str;
}

/** @param {string} label @param {string} id */
function isIdOnlyLabel(label, id) {
  const trimmed = String(label ?? "").trim();
  if (!trimmed) return true;
  if (id && trimmed === id) return true;
  return looksLikeZohoId(trimmed);
}

/**
 * @param {Record<string, unknown>} row
 * @param {string[]} displayFields
 */
function labelFromRelatedRow(row, displayFields) {
  for (const key of displayFields) {
    const value = displayValue(row?.[key]);
    if (value && !isIdOnlyLabel(value, String(row?.id ?? ""))) return value;
  }
  for (const key of [
    "Name",
    "Product_Name",
    "Deal_Name",
    "SOWID",
    "Account_Name",
    "Vendor_Name",
    "Full_Name",
    "full_name",
    "Last_Name",
    "First_Name",
  ]) {
    const value = displayValue(row?.[key]);
    if (value && !isIdOnlyLabel(value, String(row?.id ?? ""))) return value;
  }
  return "";
}

/** @typedef {{ value: string; label: string }} FieldSuggestion */

/**
 * @param {unknown} raw
 * @returns {{ id: string; label: string }[]}
 */
function lookupEntriesFromRaw(raw) {
  /** @type {{ id: string; label: string }[]} */
  const entries = [];

  const pushOne = (item) => {
    if (item == null || item === "") return;
    if (typeof item === "object" && !Array.isArray(item)) {
      const id = item.id != null ? String(item.id) : "";
      const label = lookupObjectName(item);
      if (id && label) entries.push({ id, label });
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) pushOne(item);
    return entries;
  }

  // Multi-user lookup sometimes nests users under `.users` / `.data`.
  if (raw && typeof raw === "object") {
    const obj = /** @type {Record<string, unknown>} */ (raw);
    if (Array.isArray(obj.users) || Array.isArray(obj.data)) {
      for (const item of /** @type {unknown[]} */ (obj.users ?? obj.data)) pushOne(item);
      if (entries.length) return entries;
    }
  }

  pushOne(raw);
  return entries;
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string} fieldApiName
 * @param {string} [query]
 * @returns {FieldSuggestion[]}
 */
function uniqueSuggestionsFromLookupObjects(rows, fieldApiName, query = "") {
  const q = query.trim().toLowerCase();
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {FieldSuggestion[]} */
  const out = [];

  for (const row of rows) {
    const entries = lookupEntriesFromRaw(row?.[fieldApiName]);
    for (const { id, label } of entries) {
      if (!label || !id) continue;
      if (seen.has(id)) continue;
      if (q && !label.toLowerCase().includes(q)) continue;
      seen.add(id);
      out.push({ value: id, label });
      if (out.length >= MAX_SUGGESTIONS) return out;
    }
  }

  return out;
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} displayFields
 * @param {string} [query]
 * @returns {FieldSuggestion[]}
 */
function uniqueSuggestionsFromRelatedRows(rows, displayFields, query = "") {
  const q = query.trim().toLowerCase();
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {FieldSuggestion[]} */
  const out = [];

  for (const row of rows) {
    const id = row?.id != null ? String(row.id) : "";
    if (!id) continue;
    const label = labelFromRelatedRow(row, displayFields);
    if (!label || isIdOnlyLabel(label, id)) continue;
    if (seen.has(id)) continue;
    if (q && !label.toLowerCase().includes(q)) continue;
    seen.add(id);
    out.push({ value: id, label });
    if (out.length >= MAX_SUGGESTIONS) break;
  }

  return out;
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string} fieldApiName
 * @param {string} [query]
 * @returns {FieldSuggestion[]}
 */
function uniqueSuggestionsFromScalarField(rows, fieldApiName, query = "") {
  const q = query.trim().toLowerCase();
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {FieldSuggestion[]} */
  const out = [];

  for (const row of rows) {
    const raw = row?.[fieldApiName];
    if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
      const label = lookupObjectName(raw);
      const id =
        raw.id != null ? String(raw.id)
        : "";
      if (label && id) {
        if (seen.has(id)) continue;
        if (q && !label.toLowerCase().includes(q)) continue;
        seen.add(id);
        out.push({ value: id, label });
        if (out.length >= MAX_SUGGESTIONS) break;
        continue;
      }
    }

    const text = displayValue(raw);
    if (!text || looksLikeZohoId(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    if (q && !key.includes(q)) continue;
    seen.add(key);
    out.push({ value: text, label: text });
    if (out.length >= MAX_SUGGESTIONS) break;
  }

  return out;
}

/**
 * @param {string} parentModule
 * @param {string} fieldApiName
 * @param {string} query
 * @param {"lookup" | "text"} mode
 */
async function fetchSuggestionsFromParent(parentModule, fieldApiName, query, mode) {
  /** @type {{ res: Response; body: any } | null} */
  let result = null;

  if (query && mode === "text") {
    const criteria = buildFieldCriterion(fieldApiName, "starts_with", [query]);
    if (criteria) {
      result = await fetchZohoJson(
        getZohoModuleSearchUrl(parentModule, {
          criteria,
          fields: fieldApiName,
          page: 1,
          perPage: FETCH_PER_PAGE,
        }),
      );
    }
  }

  if (
    !result ||
    result.res.status === 204 ||
    !result.res.ok ||
    !Array.isArray(result.body?.data) ||
    result.body.data.length === 0
  ) {
    if (query) {
      const wordResult = await fetchZohoJson(
        getZohoModuleSearchUrl(parentModule, {
          word: query,
          fields: fieldApiName,
          page: 1,
          perPage: FETCH_PER_PAGE,
        }),
      );
      if (
        wordResult.res.ok &&
        Array.isArray(wordResult.body?.data) &&
        wordResult.body.data.length > 0
      ) {
        result = wordResult;
      }
    }
  }

  if (!result || result.res.status === 204 || !result.res.ok || !Array.isArray(result.body?.data)) {
    const listUrl = `${ZOHO_CRM_BASE}/${encodeURIComponent(parentModule)}?fields=${encodeURIComponent(fieldApiName)}&per_page=${FETCH_PER_PAGE}&page=1`;
    result = await fetchZohoJson(listUrl);
  }

  if (result.res.status === 204) return [];
  if (!result.res.ok || !Array.isArray(result.body?.data)) return [];

  if (mode === "lookup") {
    return uniqueSuggestionsFromLookupObjects(result.body.data, fieldApiName, query);
  }
  return uniqueSuggestionsFromScalarField(result.body.data, fieldApiName, query);
}

/** User-like API names commonly present on CRM modules (for suggestion fallback). */
const USER_SUGGESTION_FALLBACK_FIELDS = [
  "Owner",
  "Ops_Owner",
  "Sales_Manager",
  "Sales_Owner",
  "Sales_Associate",
  "Operations_Manager",
  "Contract_Owner",
];

/**
 * When Zoho Users API is unavailable (missing oauth scope), collect distinct users
 * from user-lookup columns already on the parent module records.
 * @param {string} parentModule
 * @param {string} preferredField
 * @param {string} query
 */
async function fetchUserSuggestionsFromParentRecords(parentModule, preferredField, query) {
  const fields = [
    ...new Set(
      [preferredField, ...USER_SUGGESTION_FALLBACK_FIELDS].map((f) => String(f ?? "").trim()).filter(Boolean),
    ),
  ];
  const fieldsParam = fields.join(",");
  const listUrl = `${ZOHO_CRM_BASE}/${encodeURIComponent(parentModule)}?fields=${encodeURIComponent(fieldsParam)}&per_page=${FETCH_PER_PAGE}&page=1`;
  const { res, body } = await fetchZohoJson(listUrl);
  if (res.status === 204) return [];
  if (!res.ok || !Array.isArray(body?.data)) return [];

  /** @type {Record<string, unknown>[]} */
  let rows = body.data;
  if (rows.length >= FETCH_PER_PAGE) {
    const page2Url = `${ZOHO_CRM_BASE}/${encodeURIComponent(parentModule)}?fields=${encodeURIComponent(fieldsParam)}&per_page=${FETCH_PER_PAGE}&page=2`;
    const page2 = await fetchZohoJson(page2Url);
    if (page2.res.ok && Array.isArray(page2.body?.data) && page2.body.data.length > 0) {
      rows = [...rows, ...page2.body.data];
    }
  }

  const q = query.trim().toLowerCase();
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {FieldSuggestion[]} */
  const out = [];

  for (const row of rows) {
    for (const fieldApiName of fields) {
      const entries = lookupEntriesFromRaw(row?.[fieldApiName]);
      for (const { id, label } of entries) {
        if (!id || !label) continue;
        if (seen.has(id)) continue;
        if (q && !label.toLowerCase().includes(q)) continue;
        seen.add(id);
        out.push({ value: id, label });
        if (out.length >= MAX_SUGGESTIONS) return out;
      }
    }
  }

  return out;
}

/**
 * @param {Record<string, unknown>} user
 * @returns {string}
 */
function userDisplayName(user) {
  const full = String(user?.full_name ?? user?.Full_Name ?? "").trim();
  if (full) return full;
  const first = String(user?.first_name ?? "").trim();
  const last = String(user?.last_name ?? "").trim();
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  const email = String(user?.email ?? "").trim();
  return email;
}

/** @param {string} query */
async function fetchUserSuggestions(query) {
  const types = ["ActiveUsers", "AllUsers", "ConfirmedUsers"];
  /** @type {FieldSuggestion[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  const q = query.trim().toLowerCase();
  let scopeDenied = false;

  for (const type of types) {
    const url = `${ZOHO_CRM_BASE}/users?type=${encodeURIComponent(type)}&per_page=200&page=1`;
    const { res, body } = await fetchZohoJson(url);
    if (!res.ok || !Array.isArray(body.users)) {
      if (body?.code === "OAUTH_SCOPE_MISMATCH") scopeDenied = true;
      if (!scopeDenied) {
        console.error(
          `Zoho users suggestion failed (${type}):`,
          res.status,
          body?.code,
          body?.message,
        );
      }
      // Missing users scope — skip remaining user-type probes.
      if (scopeDenied) break;
      continue;
    }

    for (const user of body.users) {
      const id = user?.id != null ? String(user.id) : "";
      const label = userDisplayName(user);
      if (!id || !label) continue;
      if (seen.has(id)) continue;
      if (
        q &&
        !label.toLowerCase().includes(q) &&
        !String(user.email ?? "")
          .toLowerCase()
          .includes(q)
      ) {
        continue;
      }
      seen.add(id);
      out.push({ value: id, label });
      if (out.length >= MAX_SUGGESTIONS) return out;
    }

    if (out.length > 0) break;
  }

  return out;
}

/**
 * @param {{ module: string; fields: string[]; displayFields: string[] }} config
 * @param {string} query
 */
async function fetchLookupModuleSuggestions(config, query) {
  const fields = [...new Set(config.fields.filter(Boolean))].join(",");
  const displayFields = config.displayFields.filter(Boolean);

  /** @type {{ res: Response; body: any } | null} */
  let result = null;

  if (query) {
    for (const primary of displayFields) {
      const criteria = buildFieldCriterion(primary, "starts_with", [query]);
      if (!criteria) continue;
      const attempt = await fetchZohoJson(
        getZohoModuleSearchUrl(config.module, {
          criteria,
          fields,
          page: 1,
          perPage: FETCH_PER_PAGE,
        }),
      );
      if (
        attempt.res.ok &&
        Array.isArray(attempt.body?.data) &&
        attempt.body.data.length > 0
      ) {
        result = attempt;
        break;
      }
    }
  }

  if (
    !result ||
    result.res.status === 204 ||
    !result.res.ok ||
    !Array.isArray(result.body?.data) ||
    result.body.data.length === 0
  ) {
    if (query) {
      const wordResult = await fetchZohoJson(
        getZohoModuleSearchUrl(config.module, {
          word: query,
          fields,
          page: 1,
          perPage: FETCH_PER_PAGE,
        }),
      );
      if (
        wordResult.res.ok &&
        Array.isArray(wordResult.body?.data) &&
        wordResult.body.data.length > 0
      ) {
        result = wordResult;
      }
    }
  }

  if (!result || result.res.status === 204 || !result.res.ok || !Array.isArray(result.body?.data)) {
    const listUrl = `${ZOHO_CRM_BASE}/${encodeURIComponent(config.module)}?fields=${encodeURIComponent(fields)}&per_page=${FETCH_PER_PAGE}&page=1`;
    result = await fetchZohoJson(listUrl);
  }

  if (result.res.status === 204) return [];
  if (!result.res.ok || !Array.isArray(result.body?.data)) {
    const message =
      result.body?.message ||
      result.body?.data?.[0]?.message ||
      `Zoho lookup suggestion search failed (${result.res.status})`;
    throw new Error(typeof message === "string" ? message : "Zoho lookup suggestion search failed");
  }

  /** @type {Record<string, unknown>[]} */
  let rows = result.body.data;

  // Pull a second page when the first page is full and we still need more options.
  if (!query && rows.length >= FETCH_PER_PAGE) {
    const page2Url = `${ZOHO_CRM_BASE}/${encodeURIComponent(config.module)}?fields=${encodeURIComponent(fields)}&per_page=${FETCH_PER_PAGE}&page=2`;
    const page2 = await fetchZohoJson(page2Url);
    if (page2.res.ok && Array.isArray(page2.body?.data) && page2.body.data.length > 0) {
      rows = [...rows, ...page2.body.data];
    }
  }

  return uniqueSuggestionsFromRelatedRows(rows, displayFields, query);
}

/**
 * @param {string} fieldApiName
 * @param {string} [lookupModule]
 */
function lookupConfigForField(fieldApiName, lookupModule = "") {
  const known = getKnownLookupFieldConfig(fieldApiName);
  if (lookupModule) {
    // Products CRM module uses Product_Name (legacy widget: Product_Name:starts_with:…).
    // Accounts CRM module uses Account_Name (Zoho filter UI: Account_Name:starts_with:…).
    const displayFields =
      lookupModule === "Products" ? ["Product_Name", "Name"]
      : lookupModule === "Accounts" ? ["Account_Name", "Name"]
      : lookupModule === "Contacts" ?
        ["Full_Name", "Last_Name", "First_Name", "Account_Name", "Name"]
      : lookupModule === "Deals" ? ["SOWID", "Deal_Name", "Name"]
      : lookupModule === "Vendors" ? ["Vendor_Name", "Name"]
      : (known?.searchFields ?? [
          "Name",
          "Vendor_Name",
          "SOWID",
          "Deal_Name",
          "Account_Name",
          "Product_Name",
          "Full_Name",
        ]);
    return {
      module: lookupModule,
      fields: ["id", ...displayFields],
      displayFields,
    };
  }
  if (known?.kind === "lookup" && known.module) {
    const displayFields = known.searchFields ?? ["Name"];
    return {
      module: known.module,
      fields: ["id", ...displayFields],
      displayFields,
    };
  }
  return null;
}

/**
 * Full picklist / multi-select options from Zoho field metadata.
 * @param {string} module
 * @param {string} fieldApiName
 * @param {string} [query]
 */
async function fetchPicklistSuggestionsFromZoho(module, fieldApiName, query = "") {
  const { res, body } = await fetchZohoJson(getZohoModuleFieldsUrl(module));
  if (!res.ok || !Array.isArray(body?.fields)) return [];

  const target = String(fieldApiName ?? "").trim().toLowerCase();
  const field = body.fields.find(
    (raw) =>
      raw &&
      typeof raw === "object" &&
      String(/** @type {Record<string, unknown>} */ (raw).api_name ?? "")
        .trim()
        .toLowerCase() === target,
  );
  if (!field || typeof field !== "object") return [];

  const values = /** @type {Record<string, unknown>} */ (field).pick_list_values;
  if (!Array.isArray(values)) return [];

  const q = String(query ?? "").trim().toLowerCase();
  /** @type {FieldSuggestion[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (const raw of values) {
    if (!raw || typeof raw !== "object") continue;
    const opt = /** @type {Record<string, unknown>} */ (raw);
    const value = String(opt.actual_value ?? "").trim();
    if (!value || value === "-None-") continue;
    const label = String(opt.display_value ?? value).trim() || value;
    if (seen.has(value)) continue;
    if (q && !label.toLowerCase().includes(q) && !value.toLowerCase().includes(q)) continue;
    seen.add(value);
    out.push({ value, label });
    if (out.length >= MAX_SUGGESTIONS) break;
  }

  return out;
}

/**
 * Module layout picker (Vendor / Client-Site / …).
 * @param {string} module
 * @param {string} [query]
 */
async function fetchLayoutSuggestions(module, query = "") {
  const { res, body } = await fetchZohoJson(getZohoModuleLayoutsUrl(module));
  if (!res.ok || !Array.isArray(body?.layouts)) return [];

  const q = String(query ?? "").trim().toLowerCase();
  /** @type {FieldSuggestion[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (const raw of body.layouts) {
    if (!raw || typeof raw !== "object") continue;
    const layout = /** @type {Record<string, unknown>} */ (raw);
    const status = String(layout.status ?? "").toLowerCase();
    if (status && status !== "active") continue;
    const id = layout.id != null ? String(layout.id).trim() : "";
    const label = String(
      layout.display_label ?? layout.name ?? layout.display_value ?? id,
    ).trim();
    if (!id || !label) continue;
    if (seen.has(id)) continue;
    if (q && !label.toLowerCase().includes(q)) continue;
    // Hide Fleet layout in filter UI (same as filterMeta applyLayoutOptionsToFields).
    if (/^fleet$/i.test(label)) continue;
    seen.add(id);
    out.push({ value: id, label });
    if (out.length >= MAX_SUGGESTIONS) break;
  }

  return out;
}

/**
 * Suggestions for any free-text filter field.
 * Lookup/user fields return `{ value: id, label: displayName }`.
 * Scalar fields return `{ value, label }` as the same string.
 * @param {{ module: string; field: string; q?: string; dataType?: string; lookupModule?: string }} params
 * @returns {Promise<FieldSuggestion[]>}
 */
export async function fetchFieldSuggestions({
  module,
  field,
  q = "",
  dataType = "",
  lookupModule = "",
}) {
  const hostAllowed = ALLOWED_SUGGESTION_MODULES.has(module);
  // Related-module nested filters may pass a child host; still allow when lookup target is known.
  if (!hostAllowed && !lookupModule) {
    throw new Error(`Unsupported module: ${module}`);
  }

  const fieldApiName = normalizeSuggestionFieldApiName(field);
  if (!fieldApiName) return [];

  const query = String(q ?? "").trim();
  const type = String(dataType ?? "").toLowerCase();
  const known = getKnownLookupFieldConfig(fieldApiName);
  const suggestionHost = hostAllowed ? module : "Contracts";

  if (type === "layout" || known?.kind === "layout" || fieldApiName === "Layout") {
    return fetchLayoutSuggestions(suggestionHost, query);
  }

  if (isUserLikeDataType(type) || known?.kind === "user") {
    const fromUsersApi = await fetchUserSuggestions(query);
    if (fromUsersApi.length > 0) return fromUsersApi;
    // Fallback when ZohoCRM.users.READ scope is missing (or field is multi-user empty on list).
    return fetchUserSuggestionsFromParentRecords(suggestionHost, fieldApiName, query);
  }

  if (isLookupLikeDataType(type) || known?.kind === "lookup" || lookupModule) {
    const config = lookupConfigForField(fieldApiName, lookupModule);
    if (config) {
      try {
        const fromRelated = await fetchLookupModuleSuggestions(config, query);
        if (fromRelated.length > 0) return fromRelated;
      } catch (err) {
        console.error(`Lookup module suggestions failed (${config.module}):`, err);
      }
    }
    return fetchSuggestionsFromParent(suggestionHost, fieldApiName, query, "lookup");
  }

  const isPicklistSuggestField =
    PICKLIST_SUGGESTION_FIELDS.has(fieldApiName) ||
    type === "picklist" ||
    type === "multiselectpicklist";

  if (isPicklistSuggestField && PICKLIST_SUGGESTION_FIELDS.has(fieldApiName)) {
    try {
      const fromMeta = await fetchPicklistSuggestionsFromZoho(
        suggestionHost,
        fieldApiName,
        query,
      );
      if (fromMeta.length > 0) return fromMeta;
    } catch (err) {
      console.error(`Picklist suggestions failed (${suggestionHost}.${fieldApiName}):`, err);
    }
    // Fallback: distinct values already used on records.
    return fetchSuggestionsFromParent(suggestionHost, fieldApiName, query, "text");
  }

  return fetchSuggestionsFromParent(suggestionHost, fieldApiName, query, "text");
}
