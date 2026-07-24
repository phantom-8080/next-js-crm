import {
  escapeZohoCriteriaValue,
  fetchZohoJson,
  ZOHO_CRM_BASE,
} from "@/lib/zoho";

/** Subform module that holds the OurServices product lookup. */
export const OUR_SERVICES_SUBFORM_MODULE = "Our_Services_SubForm";

const OUR_SERVICES_FIELD = "OurServices";
const MAX_SUBFORM_PAGES = 10;
const SUBFORM_PER_PAGE = 200;

/**
 * @param {string | null | undefined} apiName
 */
export function isOurServicesFilterApiName(apiName) {
  const name = String(apiName ?? "").trim();
  return name === OUR_SERVICES_FIELD || name.endsWith(`.${OUR_SERVICES_FIELD}`);
}

/**
 * Pull OurServices clauses out of Zoho `filters` JSON — Contracts list filters
 * cannot use this subform lookup, so we resolve Parent_Id via the subform module.
 *
 * @param {string | null | undefined} filtersJson
 * @returns {{
 *   serviceFilter: { comparator: string; values: string[] } | null;
 *   remainingFiltersJson: string | null;
 * }}
 */
export function splitOurServicesFromFiltersJson(filtersJson) {
  const raw = String(filtersJson ?? "").trim();
  if (!raw) {
    return { serviceFilter: null, remainingFiltersJson: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { serviceFilter: null, remainingFiltersJson: raw };
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.group)) {
    return { serviceFilter: null, remainingFiltersJson: raw };
  }

  /** @type {unknown[]} */
  const remaining = [];
  /** @type {{ comparator: string; values: string[] } | null} */
  let serviceFilter = null;

  for (const clause of parsed.group) {
    if (!clause || typeof clause !== "object") {
      remaining.push(clause);
      continue;
    }
    const field = /** @type {{ field?: { api_name?: string }; comparator?: string; value?: unknown }} */ (
      clause
    );
    const apiName = field.field?.api_name;
    if (!isOurServicesFilterApiName(apiName)) {
      remaining.push(clause);
      continue;
    }

    const comparator = String(field.comparator ?? "equal").toLowerCase();
    const rawValue = field.value;
    const values = Array.isArray(rawValue)
      ? rawValue.map((v) => String(v ?? "").trim()).filter(Boolean)
      : [String(rawValue ?? "").trim()].filter(Boolean);

    if (values.length === 0) continue;
    serviceFilter = { comparator, values };
  }

  if (!serviceFilter) {
    return { serviceFilter: null, remainingFiltersJson: raw };
  }

  if (remaining.length === 0) {
    return { serviceFilter, remainingFiltersJson: null };
  }

  return {
    serviceFilter,
    remainingFiltersJson: JSON.stringify({
      group_operator: parsed.group_operator ?? "and",
      group: remaining,
    }),
  };
}

/**
 * @param {{ id?: unknown } | string | null | undefined} parent
 */
function parentIdFromSubformRow(parent) {
  if (parent == null || parent === "") return "";
  if (typeof parent === "string") return parent.trim();
  if (typeof parent === "object" && parent.id != null) return String(parent.id).trim();
  return "";
}

/**
 * Search Our_Services_SubForm for rows matching OurServices, return unique Contract Parent_Ids.
 * @param {{ comparator: string; values: string[] }} serviceFilter
 * @returns {Promise<string[]>}
 */
export async function fetchContractIdsByOurServices(serviceFilter) {
  const values = (serviceFilter.values ?? [])
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  if (values.length === 0) return [];

  const comparator = String(serviceFilter.comparator ?? "equal").toLowerCase();
  let criteria;
  if (comparator === "in" || values.length > 1) {
    criteria = `(${OUR_SERVICES_FIELD}:in:${values.map(escapeZohoCriteriaValue).join(",")})`;
  } else if (comparator === "not_equal") {
    criteria = `(${OUR_SERVICES_FIELD}:not_equal:${escapeZohoCriteriaValue(values[0])})`;
  } else {
    criteria = `(${OUR_SERVICES_FIELD}:equals:${escapeZohoCriteriaValue(values[0])})`;
  }

  /** @type {Set<string>} */
  const parentIds = new Set();

  for (let page = 1; page <= MAX_SUBFORM_PAGES; page += 1) {
    const params = new URLSearchParams();
    params.set("criteria", criteria);
    params.set("fields", "Parent_Id,OurServices");
    params.set("page", String(page));
    params.set("per_page", String(SUBFORM_PER_PAGE));

    const url = `${ZOHO_CRM_BASE}/${encodeURIComponent(OUR_SERVICES_SUBFORM_MODULE)}/search?${params}`;
    const { res, body } = await fetchZohoJson(url);

    if (res.status === 204 || body?.code === "NO_DATA") {
      break;
    }
    if (!res.ok) {
      const err = new Error(
        body?.message || body?.code || `OurServices subform search failed (HTTP ${res.status})`,
      );
      err.status = res.status;
      err.details = body;
      throw err;
    }

    const rows = Array.isArray(body?.data) ? body.data : [];
    for (const row of rows) {
      const id = parentIdFromSubformRow(row?.Parent_Id);
      if (id) parentIds.add(id);
    }

    if (!body?.info?.more_records) break;
  }

  return [...parentIds];
}

/**
 * Fetch Contracts by id list (preserves input order where Zoho returns them).
 * @param {string[]} contractIds
 * @param {string} zohoFields comma-separated field api names including id
 * @returns {Promise<{ res: Response; body: any; rows: any[] }>}
 */
export async function fetchContractsByIds(contractIds, zohoFields) {
  const ids = [...new Set(contractIds.map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { res: { ok: true, status: 204 }, body: { data: [] }, rows: [] };
  }

  // Zoho `ids` param — batch to stay within URL limits.
  const BATCH = 100;
  /** @type {any[]} */
  const rows = [];
  /** @type {Response | null} */
  let lastRes = null;
  /** @type {any} */
  let lastBody = {};

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const params = new URLSearchParams();
    params.set("ids", batch.join(","));
    params.set("fields", zohoFields);
    params.set("per_page", String(batch.length));

    const url = `${ZOHO_CRM_BASE}/Contracts?${params}`;
    const { res, body } = await fetchZohoJson(url);
    lastRes = res;
    lastBody = body;

    if (res.status === 204) continue;
    if (!res.ok) {
      return { res, body, rows: [] };
    }
    if (Array.isArray(body?.data)) {
      rows.push(...body.data);
    }
  }

  // Keep caller’s page order.
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  return {
    res: lastRes ?? { ok: true, status: 200 },
    body: { ...lastBody, data: ordered, info: { more_records: false, count: ordered.length } },
    rows: ordered,
  };
}
