import {
  escapeZohoCriteriaValue,
  fetchZohoJson,
  getZohoModuleFieldsUrl,
  ZOHO_CRM_BASE,
  ZOHO_CRM_V8_BASE,
} from "@/lib/zoho";
import { fetchContractsByIds } from "@/lib/contracts/ourServicesFilter";

/** Marker prefix for related-module clauses inside Zoho filters JSON (stripped before Zoho list). */
export const RELATED_MODULE_FILTER_PREFIX = "$related.";

/** Hard cap on Get Records pages (200/page). page_token is required after 2000 rows. */
const MAX_RELATED_PAGES = 500;
const CHILD_PER_PAGE = 200;
const PARENT_MODULE = "Contracts";
const DISCRETE_PAGE_LIMIT_CODE = "DISCRETE_PAGINATION_LIMIT_EXCEEDED";

/**
 * System / known child modules → parent link field on the child record.
 * Notes/Emails use multi-module lookups, not a Contracts lookup field.
 * @type {Record<string, string>}
 */
const KNOWN_PARENT_LINK_FIELDS = {
  Notes: "Parent_Id",
  Emails: "Entity_Id",
  Attachments: "Parent_Id",
};

/** @type {Map<string, { field: string; kind: "lookup" | "multi_module_lookup"; cachedAt: number }>} */
const parentLinkCache = new Map();
const PARENT_LINK_TTL_MS = 10 * 60 * 1000;

/**
 * @param {string | null | undefined} apiName
 */
export function isRelatedModuleFilterApiName(apiName) {
  return String(apiName ?? "").startsWith(RELATED_MODULE_FILTER_PREFIX);
}

/**
 * @param {string} relatedListApiName
 */
export function relatedModuleFilterApiName(relatedListApiName) {
  return `${RELATED_MODULE_FILTER_PREFIX}${String(relatedListApiName ?? "").trim()}`;
}

/**
 * @param {unknown} parent
 * @returns {{ id: string; moduleApi: string }}
 */
function parentRefFromLookup(parent) {
  if (parent == null || parent === "") return { id: "", moduleApi: "" };
  if (typeof parent === "string") return { id: parent.trim(), moduleApi: "" };
  if (typeof parent === "object") {
    const obj = /** @type {Record<string, unknown>} */ (parent);
    const id = obj.id != null ? String(obj.id).trim() : "";
    let moduleApi = "";
    if (obj.module && typeof obj.module === "object") {
      moduleApi = String(
        /** @type {Record<string, unknown>} */ (obj.module).api_name ?? "",
      ).trim();
    } else if (typeof obj.module === "string") {
      moduleApi = obj.module.trim();
    }
    return { id, moduleApi };
  }
  return { id: "", moduleApi: "" };
}

/**
 * Prefer a Contracts lookup that matches the related-list name; else multi-module Parent_Id.
 * @param {string} childModule
 * @param {string} relatedListApiName
 * @returns {Promise<{ field: string; kind: "lookup" | "multi_module_lookup" }>}
 */
export async function resolveRelatedParentLinkField(childModule, relatedListApiName = "") {
  const moduleName = String(childModule ?? "").trim();
  const cacheKey = `${moduleName}::${relatedListApiName}`;
  const cached = parentLinkCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < PARENT_LINK_TTL_MS) {
    return { field: cached.field, kind: cached.kind };
  }

  const known = KNOWN_PARENT_LINK_FIELDS[moduleName];
  if (known) {
    const result = {
      field: known,
      kind: /** @type {const} */ ("multi_module_lookup"),
      cachedAt: Date.now(),
    };
    parentLinkCache.set(cacheKey, result);
    return { field: result.field, kind: result.kind };
  }

  if (!moduleName) {
    return { field: "Contract", kind: "lookup" };
  }

  try {
    const { res, body } = await fetchZohoJson(getZohoModuleFieldsUrl(moduleName));
    if (res.ok && Array.isArray(body.fields)) {
      /** @type {{ api_name: string; score: number; kind: "lookup" | "multi_module_lookup" }[]} */
      const candidates = [];
      for (const raw of body.fields) {
        if (!raw || typeof raw !== "object") continue;
        const field = /** @type {Record<string, unknown>} */ (raw);
        const apiName = String(field.api_name ?? "").trim();
        if (!apiName) continue;
        const dataType = String(field.data_type ?? "").toLowerCase();

        if (dataType === "multi_module_lookup") {
          let score = 3;
          if (apiName === "Parent_Id" || apiName === "Entity_Id") score += 4;
          candidates.push({ api_name: apiName, score, kind: "multi_module_lookup" });
          continue;
        }

        if (dataType !== "lookup") continue;

        const lookup =
          field.lookup && typeof field.lookup === "object" ?
            /** @type {Record<string, unknown>} */ (field.lookup)
          : null;
        const lookupModule =
          lookup?.module && typeof lookup.module === "object" ?
            String(/** @type {Record<string, unknown>} */ (lookup.module).api_name ?? "").trim()
          : String(lookup?.module ?? lookup?.api_name ?? "").trim();

        if (lookupModule !== PARENT_MODULE) continue;

        let score = 10;
        const related = String(relatedListApiName ?? "").toLowerCase();
        const lower = apiName.toLowerCase();
        if (apiName === "Contract") score += 5;
        if (related.includes("vendor") && lower.includes("vendor")) score += 8;
        if (!related.includes("vendor") && lower === "contract") score += 3;
        if (related && lower && related.includes(lower.replace(/_/g, ""))) score += 2;
        candidates.push({ api_name: apiName, score, kind: "lookup" });
      }

      candidates.sort((a, b) => b.score - a.score);
      if (candidates[0]) {
        const result = {
          field: candidates[0].api_name,
          kind: candidates[0].kind,
          cachedAt: Date.now(),
        };
        parentLinkCache.set(cacheKey, result);
        return { field: result.field, kind: result.kind };
      }
    }
  } catch (err) {
    console.error(`resolveRelatedParentLinkField(${moduleName}) failed:`, err);
  }

  const fallback = {
    field: "Contract",
    kind: /** @type {const} */ ("lookup"),
    cachedAt: Date.now(),
  };
  parentLinkCache.set(cacheKey, fallback);
  return { field: fallback.field, kind: fallback.kind };
}

/**
 * @param {{ apiName: string; operator: string; values: string[] }} nested
 */
function nestedClauseToZohoFilter(nested) {
  const apiName = String(nested.apiName ?? "").trim();
  if (!apiName) return null;

  const operator = String(nested.operator ?? "equals").toLowerCase();
  const values = (nested.values ?? []).map((v) => String(v ?? "").trim()).filter(Boolean);

  if (operator === "is_not_empty" || operator === "not_empty") {
    return {
      field: { api_name: apiName },
      comparator: "not_equal",
      value: "${EMPTY}",
    };
  }
  if (operator === "is_empty" || operator === "empty") {
    return {
      field: { api_name: apiName },
      comparator: "equal",
      value: "${EMPTY}",
    };
  }

  if (values.length === 0) return null;

  if (operator === "between") {
    if (values.length < 2) return null;
    return {
      field: { api_name: apiName },
      comparator: "between",
      value: [values[0], values[1]],
    };
  }

  const comparatorMap = {
    equals: "equal",
    equal: "equal",
    not_equal: "not_equal",
    contains: "contains",
    starts_with: "starts_with",
    in: "in",
    greater_than: "greater_than",
    greater_equal: "greater_equal",
    less_than: "less_than",
    less_equal: "less_equal",
    between: "between",
  };
  const comparator = comparatorMap[operator] ?? operator;
  const value =
    operator === "in" || operator === "between" || values.length > 1 ? values : values[0];

  return {
    field: { api_name: apiName },
    comparator,
    value,
  };
}

/**
 * Paginate Zoho Get Records using page_token after the first page.
 * Never send page>1 — Zoho returns DISCRETE_PAGINATION_LIMIT_EXCEEDED at 2000 rows.
 *
 * @param {{
 *   base: string;
 *   module: string;
 *   fields: string;
 *   extraParams?: Record<string, string>;
 * }} opts
 * @returns {Promise<{ rows: any[]; firstError?: { res: Response; body: any } }>}
 */
async function paginateModuleRecords({ base, module, fields, extraParams = {} }) {
  /** @type {any[]} */
  const rows = [];
  /** @type {string | null} */
  let pageToken = null;

  for (let n = 1; n <= MAX_RELATED_PAGES; n += 1) {
    const params = new URLSearchParams();
    params.set("fields", fields);
    params.set("per_page", String(CHILD_PER_PAGE));
    for (const [key, value] of Object.entries(extraParams)) {
      if (value != null && value !== "") params.set(key, String(value));
    }
    if (pageToken) {
      params.set("page_token", pageToken);
    } else {
      params.set("page", "1");
    }

    const url = `${base}/${encodeURIComponent(module)}?${params}`;
    const { res, body } = await fetchZohoJson(url);

    if (res.status === 204 || body?.code === "NO_DATA") {
      return { rows };
    }

    if (!res.ok) {
      const code = String(body?.code ?? "");
      if (code === DISCRETE_PAGE_LIMIT_CODE && pageToken) {
        // Should not happen if we already switched to tokens; stop rather than loop.
        console.error(`Zoho pagination limit for ${module} despite page_token`);
        return { rows };
      }
      if (n === 1) {
        return { rows, firstError: { res, body } };
      }
      const err = new Error(
        body?.message || body?.code || `Related module list failed (HTTP ${res.status})`,
      );
      err.status = res.status;
      err.details = body;
      throw err;
    }

    if (Array.isArray(body?.data)) rows.push(...body.data);

    const more = Boolean(body?.info?.more_records);
    pageToken = body?.info?.next_page_token ? String(body.info.next_page_token) : null;
    if (!more) break;
    if (!pageToken) {
      console.error(
        `Zoho ${module} has more_records but no next_page_token; stopping at ${rows.length} rows`,
      );
      break;
    }
  }

  return { rows };
}

/**
 * @param {{ apiName: string; operator: string; values: string[] }} nested
 */
function nestedClauseToSearchCriteria(nested) {
  const apiName = String(nested.apiName ?? "").trim();
  if (!apiName) return null;
  const operator = String(nested.operator ?? "equals").toLowerCase();
  const values = (nested.values ?? []).map((v) => String(v ?? "").trim()).filter(Boolean);

  if (operator === "is_not_empty" || operator === "not_empty") {
    return `(${apiName}:not_equal:null)`;
  }
  if (operator === "is_empty" || operator === "empty") {
    return `(${apiName}:equals:null)`;
  }
  if (values.length === 0) return null;
  if (operator === "between") {
    if (values.length < 2) return null;
    const a = escapeZohoCriteriaValue(values[0]);
    const b = escapeZohoCriteriaValue(values[1]);
    return `(${apiName}:between:${a},${b})`;
  }
  if (operator === "in") {
    return `(${apiName}:in:${values.map(escapeZohoCriteriaValue).join(",")})`;
  }
  if (operator === "not_equal") {
    return `(${apiName}:not_equal:${escapeZohoCriteriaValue(values[0])})`;
  }
  if (operator === "contains") {
    return `(${apiName}:contains:${escapeZohoCriteriaValue(values[0])})`;
  }
  if (operator === "starts_with") {
    return `(${apiName}:starts_with:${escapeZohoCriteriaValue(values[0])})`;
  }
  if (
    operator === "greater_than" ||
    operator === "greater_equal" ||
    operator === "less_than" ||
    operator === "less_equal"
  ) {
    return `(${apiName}:${operator}:${escapeZohoCriteriaValue(values[0])})`;
  }
  return `(${apiName}:equals:${escapeZohoCriteriaValue(values[0])})`;
}

/**
 * Keep only IDs that exist on Contracts (for multi-module parents without module info).
 * @param {string[]} ids
 * @returns {Promise<string[]>}
 */
async function filterIdsThatAreContracts(ids) {
  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  /** @type {string[]} */
  const kept = [];
  const BATCH = 100;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const params = new URLSearchParams();
    params.set("ids", batch.join(","));
    params.set("fields", "id");
    params.set("per_page", String(batch.length));
    const url = `${ZOHO_CRM_BASE}/Contracts?${params}`;
    const { res, body } = await fetchZohoJson(url);
    if (res.status === 204 || body?.code === "NO_DATA") continue;
    if (!res.ok) {
      // If verification fails, keep batch (better than empty) — caller still has filters.
      console.error("Contracts id verification failed:", body?.message || res.status);
      kept.push(...batch);
      continue;
    }
    for (const row of body?.data ?? []) {
      if (row?.id != null) kept.push(String(row.id));
    }
  }
  return kept;
}

/**
 * @param {object} opts
 * @param {string} opts.childModule
 * @param {string} opts.parentLinkField
 * @param {"lookup" | "multi_module_lookup"} opts.linkKind
 * @param {unknown[]} opts.filterGroup
 * @param {Array<{ apiName: string; operator: string; values: string[] }>} opts.nested
 * @returns {Promise<{ ids: string[]; usedSearch: boolean }>}
 */
async function collectParentIdsFromChildModule({
  childModule,
  parentLinkField,
  linkKind,
  filterGroup,
  nested,
}) {
  /** @type {Set<string>} */
  const parentIds = new Set();
  /** @type {Set<string>} */
  const needsVerification = new Set();

  const fields =
    linkKind === "multi_module_lookup" ?
      `id,${parentLinkField}`
    : `id,${parentLinkField}`;

  // Prefer v8 for Notes/Emails so Parent_Id includes module.api_name.
  const listBase = ZOHO_CRM_V8_BASE;

  async function ingestRows(rows) {
    for (const row of rows) {
      const ref = parentRefFromLookup(row?.[parentLinkField]);
      if (!ref.id) continue;
      if (linkKind === "multi_module_lookup") {
        if (ref.moduleApi) {
          if (ref.moduleApi === PARENT_MODULE) parentIds.add(ref.id);
          continue;
        }
        needsVerification.add(ref.id);
        continue;
      }
      parentIds.add(ref.id);
    }
  }

  // 1) Get Records + filters, paginated with page_token (required after 2000 rows).
  const listed = await paginateModuleRecords({
    base: listBase,
    module: childModule,
    fields,
    extraParams: {
      filters: JSON.stringify({ group_operator: "and", group: filterGroup }),
    },
  });

  if (!listed.firstError) {
    await ingestRows(listed.rows);
    if (needsVerification.size > 0) {
      const verified = await filterIdsThatAreContracts([...needsVerification]);
      for (const id of verified) parentIds.add(id);
    }
    return { ids: [...parentIds], usedSearch: false };
  }

  const firstCode = String(listed.firstError.body?.code ?? "");
  // Search API is capped at 2000 rows and does not support Emails — only use it
  // when Get Records filters are invalid, never as a way to page past 2000.
  if (firstCode === "NOT_SUPPORTED" || firstCode === DISCRETE_PAGE_LIMIT_CODE) {
    const err = new Error(
      listed.firstError.body?.message ||
        listed.firstError.body?.code ||
        `Related module list failed for ${childModule}`,
    );
    err.status = listed.firstError.res.status;
    err.details = listed.firstError.body;
    throw err;
  }

  // 2) Search API fallback (criteria string) — first 2000 only.
  const criteriaParts = [];
  for (const nestedRow of nested) {
    const part = nestedClauseToSearchCriteria(nestedRow);
    if (part) criteriaParts.push(part);
  }
  criteriaParts.unshift(`(${parentLinkField}:not_equal:null)`);

  let criteria;
  if (criteriaParts.length === 1) criteria = criteriaParts[0];
  else criteria = `(${criteriaParts.join("and")})`;

  for (let page = 1; page <= 10; page += 1) {
    const params = new URLSearchParams();
    params.set("criteria", criteria);
    params.set("fields", fields);
    params.set("page", String(page));
    params.set("per_page", String(CHILD_PER_PAGE));

    const url = `${ZOHO_CRM_BASE}/${encodeURIComponent(childModule)}/search?${params}`;
    const { res, body } = await fetchZohoJson(url);

    if (res.status === 204 || body?.code === "NO_DATA") break;
    if (!res.ok) {
      const code = String(body?.code ?? "");
      if (code === DISCRETE_PAGE_LIMIT_CODE || code === "NOT_SUPPORTED") break;
      const err = new Error(
        body?.message ||
          body?.code ||
          `Related module search failed for ${childModule} (HTTP ${res.status})`,
      );
      err.status = res.status;
      err.details = body;
      throw err;
    }

    await ingestRows(Array.isArray(body?.data) ? body.data : []);
    if (!body?.info?.more_records) break;
  }

  if (needsVerification.size > 0) {
    const verified = await filterIdsThatAreContracts([...needsVerification]);
    for (const id of verified) parentIds.add(id);
  }

  return { ids: [...parentIds], usedSearch: true };
}

/**
 * List Contract IDs that are NOT in `excludeIds` (Zoho "without" related-module semantics).
 * @param {string[]} excludeIds
 * @param {{ filters?: string | null; criteria?: string | null }} [opts]
 * @returns {Promise<string[]>}
 */
export async function fetchContractIdsExcluding(excludeIds, opts = {}) {
  const exclude = new Set(
    (excludeIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean),
  );
  const filters = opts.filters ?? null;

  /** @type {Record<string, string>} */
  const extraParams = {};
  if (filters) extraParams.filters = filters;

  const listed = await paginateModuleRecords({
    base: ZOHO_CRM_V8_BASE,
    module: PARENT_MODULE,
    fields: "id",
    extraParams,
  });

  if (listed.firstError) {
    const err = new Error(
      listed.firstError.body?.message ||
        listed.firstError.body?.code ||
        `Contracts scan for related "without" failed (HTTP ${listed.firstError.res.status})`,
    );
    err.status = listed.firstError.res.status;
    err.details = listed.firstError.body;
    throw err;
  }

  /** @type {string[]} */
  const kept = [];
  for (const row of listed.rows) {
    const id = row?.id != null ? String(row.id).trim() : "";
    if (!id) continue;
    if (!exclude.has(id)) kept.push(id);
  }

  return kept;
}

/**
 * @param {object} relatedFilter
 * @param {string} relatedFilter.lookupModule
 * @param {string} [relatedFilter.relatedListApiName]
 * @param {"with" | "without"} [relatedFilter.presence]
 * @param {Array<{ apiName: string; operator: string; values: string[] }>} [relatedFilter.nested]
 * @param {string} [relatedFilter.parentLinkField]
 * @returns {Promise<string[]>}
 */
export async function fetchContractIdsByRelatedModule(relatedFilter) {
  const childModule = String(relatedFilter.lookupModule ?? "").trim();
  if (!childModule) return [];

  const presence = relatedFilter.presence === "without" ? "without" : "with";
  const relatedListApiName = String(relatedFilter.relatedListApiName ?? "").trim();
  const resolved =
    String(relatedFilter.parentLinkField ?? "").trim() ?
      {
        field: String(relatedFilter.parentLinkField).trim(),
        kind:
          String(relatedFilter.parentLinkField).trim() === "Parent_Id" ||
          String(relatedFilter.parentLinkField).trim() === "Entity_Id" ?
            /** @type {const} */ ("multi_module_lookup")
          : /** @type {const} */ ("lookup"),
      }
    : await resolveRelatedParentLinkField(childModule, relatedListApiName);

  const parentLinkField = resolved.field;
  const linkKind = resolved.kind;
  const nested = Array.isArray(relatedFilter.nested) ? relatedFilter.nested : [];

  /** @type {unknown[]} */
  const group = [
    {
      field: { api_name: parentLinkField },
      comparator: "not_equal",
      value: "${EMPTY}",
    },
  ];

  // Emails store parent module name in Module text field when available.
  if (childModule === "Emails") {
    group.push({
      field: { api_name: "Module" },
      comparator: "equal",
      value: PARENT_MODULE,
    });
  }

  for (const nestedRow of nested) {
    const clause = nestedClauseToZohoFilter(nestedRow);
    if (clause) group.push(clause);
  }

  // Matching parents = Contracts that HAVE related rows matching nested criteria.
  const { ids: matchingParentIds } = await collectParentIdsFromChildModule({
    childModule,
    parentLinkField,
    linkKind,
    filterGroup: group,
    nested,
  });

  if (presence === "without") {
    // Zoho: Contracts WITHOUT any related rows matching the criteria.
    return fetchContractIdsExcluding(matchingParentIds);
  }

  return matchingParentIds;
}

/**
 * Parse related-module payload stored in a filters clause value.
 * @param {unknown} value
 */
export function parseRelatedModuleFilterValue(value) {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = /** @type {Record<string, unknown>} */ (value);
    if (obj.kind === "related_module" || obj.lookupModule) {
      return normalizeRelatedPayload(obj);
    }
    return null;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return normalizeRelatedPayload(/** @type {Record<string, unknown>} */ (parsed));
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} obj
 */
function normalizeRelatedPayload(obj) {
  const lookupModule = String(obj.lookupModule ?? "").trim();
  if (!lookupModule) return null;
  const nestedRaw = Array.isArray(obj.nested) ? obj.nested : [];
  const nested = nestedRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const n = /** @type {Record<string, unknown>} */ (row);
      const apiName = String(n.apiName ?? n.api_name ?? "").trim();
      if (!apiName) return null;
      const values = Array.isArray(n.values) ?
          n.values.map((v) => String(v ?? "").trim()).filter(Boolean)
        : n.value != null ? [String(n.value).trim()].filter(Boolean)
        : [];
      return {
        apiName,
        operator: String(n.operator ?? "equals").trim() || "equals",
        values,
      };
    })
    .filter(Boolean);

  return {
    kind: /** @type {const} */ ("related_module"),
    lookupModule,
    relatedListApiName: String(obj.relatedListApiName ?? obj.apiName ?? "").trim(),
    presence:
      obj.presence === "without" ? /** @type {const} */ ("without") : /** @type {const} */ ("with"),
    parentLinkField: String(obj.parentLinkField ?? "").trim() || undefined,
    nested,
  };
}

/**
 * Pull related-module clauses out of Zoho `filters` JSON.
 * @param {string | null | undefined} filtersJson
 */
export function splitRelatedModulesFromFiltersJson(filtersJson) {
  const raw = String(filtersJson ?? "").trim();
  if (!raw) {
    return { relatedFilters: [], remainingFiltersJson: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { relatedFilters: [], remainingFiltersJson: raw };
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.group)) {
    return { relatedFilters: [], remainingFiltersJson: raw };
  }

  /** @type {unknown[]} */
  const remaining = [];
  /** @type {ReturnType<typeof normalizeRelatedPayload>[]} */
  const relatedFilters = [];

  for (const clause of parsed.group) {
    if (!clause || typeof clause !== "object") {
      remaining.push(clause);
      continue;
    }
    const field = /** @type {{ field?: { api_name?: string }; comparator?: string; value?: unknown }} */ (
      clause
    );
    const apiName = field.field?.api_name;
    if (!isRelatedModuleFilterApiName(apiName)) {
      remaining.push(clause);
      continue;
    }

    const payload = parseRelatedModuleFilterValue(field.value);
    if (!payload) continue;

    const relatedListApiName =
      payload.relatedListApiName ||
      String(apiName).slice(RELATED_MODULE_FILTER_PREFIX.length);
    const comparator = String(field.comparator ?? "equal").toLowerCase();
    const presence =
      payload.presence === "without" || comparator === "not_equal" ? "without" : "with";

    relatedFilters.push({
      ...payload,
      relatedListApiName,
      presence,
    });
  }

  if (relatedFilters.length === 0) {
    return { relatedFilters: [], remainingFiltersJson: raw };
  }

  if (remaining.length === 0) {
    return { relatedFilters, remainingFiltersJson: null };
  }

  return {
    relatedFilters,
    remainingFiltersJson: JSON.stringify({
      group_operator: parsed.group_operator ?? "and",
      group: remaining,
    }),
  };
}

/**
 * Encode a related-module selection for the contracts list search param.
 * @param {{
 *   relatedListApiName: string;
 *   lookupModule: string;
 *   presence?: "with" | "without";
 *   nested?: Array<{ apiName: string; operator: string; values: string[] }>;
 * }} input
 */
export function encodeRelatedModuleSelection(input) {
  const relatedListApiName = String(input.relatedListApiName ?? "").trim();
  const lookupModule = String(input.lookupModule ?? "").trim();
  if (!relatedListApiName || !lookupModule) return null;

  const nested = (input.nested ?? [])
    .map((n) => ({
      apiName: String(n.apiName ?? "").trim(),
      operator: String(n.operator ?? "equals").trim() || "equals",
      values: (n.values ?? []).map((v) => String(v ?? "").trim()).filter(Boolean),
    }))
    .filter((n) => {
      if (!n.apiName) return false;
      if (n.operator === "is_empty" || n.operator === "is_not_empty") return true;
      if (n.operator === "between") return n.values.length >= 2;
      return n.values.length > 0;
    });

  return {
    apiName: relatedModuleFilterApiName(relatedListApiName),
    operator: input.presence === "without" ? "not_equal" : "equals",
    values: [
      JSON.stringify({
        kind: "related_module",
        lookupModule,
        relatedListApiName,
        presence: input.presence === "without" ? "without" : "with",
        nested,
      }),
    ],
  };
}

/**
 * Intersect multiple related-module ID lists (AND across related modules).
 * @param {string[][]} idLists
 */
export function intersectIdLists(idLists) {
  if (!idLists.length) return [];
  let result = new Set(idLists[0]);
  for (let i = 1; i < idLists.length; i += 1) {
    const next = new Set(idLists[i]);
    result = new Set([...result].filter((id) => next.has(id)));
  }
  return [...result];
}

export { fetchContractsByIds };
