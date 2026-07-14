import { clearFilterMetaCache } from "@/lib/contractFilterMeta";
import { criteriaApiNameForFilterField } from "@/lib/resolveFilterValues";
import { fetchZohoJson, ZOHO_CRM_BASE } from "@/lib/zoho";

/** Default columns shown in a new Contracts custom view. */
const DEFAULT_CONTRACT_VIEW_FIELDS = [
  "Name",
  "Contract_Status",
  "Vendor",
  "Company_Name",
  "Site",
  "Contract_Start_Date",
  "Contract_End_Date",
];

/** Map UI operators → Zoho custom-view comparators. */
const VIEW_COMPARATOR = {
  equals: "equal",
  equal: "equal",
  not_equal: "not_equal",
  starts_with: "starts_with",
  contains: "contains",
  not_contains: "not_contains",
  in: "in",
  between: "between",
  greater_than: "greater_than",
  greater_equal: "greater_equal",
  less_than: "less_than",
  less_equal: "less_equal",
};

/**
 * @typedef {{ apiName: string; operator: string; values: string[] }} CustomViewCondition
 */

/** @param {string} apiName */
function isLayoutCriteriaField(apiName) {
  const name = String(apiName ?? "").trim();
  return name === "Layout" || name.endsWith(".Layout");
}

/**
 * Zoho create-custom-view expects Layout values as `{ id }` (string id → INTERNAL_ERROR).
 * @param {string[]} values
 * @param {string} comparator
 */
function formatLayoutCriteriaValue(values, comparator) {
  const asObjects = values.map((id) => ({ id }));
  if (comparator === "in" || comparator === "between" || values.length > 1) {
    return asObjects;
  }
  return asObjects[0];
}

/**
 * Build create-view conditions from sidebar field selections / drafts.
 * @param {import("@/lib/contractFilterTypes").ContractFieldFilterSelection[]} selections
 * @param {string} [module]
 * @returns {CustomViewCondition[]}
 */
export function conditionsFromFieldFilterSelections(selections, module = "Contracts") {
  /** @type {CustomViewCondition[]} */
  const conditions = [];
  for (const selection of selections ?? []) {
    const apiName = criteriaApiNameForFilterField(
      String(selection?.apiName ?? "").trim(),
      isLayoutCriteriaField(selection?.apiName) ? "layout" : "",
      module,
    );
    const values = (selection?.values ?? []).map((v) => String(v).trim()).filter(Boolean);
    if (!apiName || values.length === 0) continue;
    const operator =
      selection.operator ||
      (values.length > 1 ? "in" : "equals");
    conditions.push({ apiName, operator, values });
  }
  return conditions;
}

/**
 * @param {CustomViewCondition[]} conditions
 * @returns {Record<string, unknown> | null}
 */
export function buildZohoCustomViewCriteria(conditions) {
  /** @type {Record<string, unknown>[]} */
  const group = [];

  for (const condition of conditions) {
    const apiName = criteriaApiNameForFilterField(
      String(condition.apiName ?? "").trim(),
      isLayoutCriteriaField(condition.apiName) ? "layout" : "",
      "Contracts",
    );
    const values = (condition.values ?? []).map((v) => String(v).trim()).filter(Boolean);
    if (!apiName || values.length === 0) continue;

    const operator = condition.operator || (values.length > 1 ? "in" : "equals");
    const comparator = VIEW_COMPARATOR[operator] ?? operator;

    let value;
    if (isLayoutCriteriaField(apiName)) {
      value = formatLayoutCriteriaValue(values, comparator);
    } else if (
      operator === "in" ||
      operator === "between" ||
      comparator === "in" ||
      comparator === "between"
    ) {
      value = values;
    } else {
      value = values[0];
    }

    group.push({
      comparator,
      field: { api_name: apiName },
      type: "value",
      value,
    });
  }

  if (group.length === 0) return null;
  if (group.length === 1) return group[0];
  return { group_operator: "AND", group };
}

/**
 * Create a Zoho CRM custom view for Contracts (or another module).
 * Requires OAuth scope: ZohoCRM.settings.custom_views.CREATE (or .ALL / settings.ALL)
 *
 * @param {{
 *   module?: string;
 *   name: string;
 *   accessType?: "only_to_me" | "public";
 *   conditions: CustomViewCondition[];
 *   displayFields?: string[];
 * }} input
 */
export async function createZohoCustomView(input) {
  const module = input.module?.trim() || "Contracts";
  const name = String(input.name ?? "").trim();
  if (!name) {
    const err = new Error("View name is required");
    err.status = 400;
    throw err;
  }

  const criteria = buildZohoCustomViewCriteria(input.conditions ?? []);
  if (!criteria) {
    const err = new Error("Add at least one filter condition");
    err.status = 400;
    throw err;
  }

  const accessType = input.accessType === "public" ? "public" : "only_to_me";
  const fieldNames =
    input.displayFields?.filter(Boolean).length ?
      input.displayFields.filter(Boolean)
    : DEFAULT_CONTRACT_VIEW_FIELDS;

  const payload = {
    custom_views: [
      {
        name,
        access_type: accessType,
        fields: fieldNames.map((api_name) => ({ api_name })),
        criteria,
      },
    ],
  };

  const url = `${ZOHO_CRM_BASE}/settings/custom_views?module=${encodeURIComponent(module)}`;
  const { res, body } = await fetchZohoJson(url, { method: "POST", body: payload });

  if (!res.ok) {
    const code = String(body?.code ?? "");
    let message = body?.message ?? body?.error ?? "Failed to create custom view in Zoho CRM";
    if (code === "OAUTH_SCOPE_MISMATCH") {
      message =
        "Zoho OAuth is missing custom-view create permission. Add scope ZohoCRM.settings.custom_views.CREATE (or ZohoCRM.settings.ALL), regenerate the refresh token, and update ZOHO_REFRESH_TOKEN.";
    }
    const err = new Error(message);
    err.status = res.status;
    err.details = body;
    throw err;
  }

  const row =
    (Array.isArray(body?.custom_views) && body.custom_views[0]) ||
    (Array.isArray(body?.data) && body.data[0]) ||
    null;
  const id =
    row?.details?.id != null ? String(row.details.id)
    : row?.id != null ? String(row.id)
    : "";

  if (!id) {
    const err = new Error("Zoho created the view but did not return an id");
    err.status = 502;
    err.details = body;
    throw err;
  }

  clearFilterMetaCache();

  return {
    id,
    name,
    accessType,
    raw: body,
  };
}
