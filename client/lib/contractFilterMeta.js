import { HIDDEN_API_NAMES } from "@/lib/contractModuleFields";
import { getOperatorsForDataType } from "@/lib/zohoFilterOperators";
import { fetchZohoJson, getZohoModuleFieldsUrl, ZOHO_CRM_BASE } from "@/lib/zoho";

const FILTER_META_CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {{ sections: import("@/lib/contractFilterTypes").ContractFilterSection[]; fields: import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]; source: "zoho" | "fallback"; cachedAt: number } | null} */
let filterMetaCache = null;

const RELATED_LOOKUP_TYPES = new Set([
  "lookup",
  "ownerlookup",
  "userlookup",
  "multiselectlookup",
  "multiuserlookup",
]);

/** @type {import("@/lib/contractFilterTypes").ContractFilterSectionId[]} */
export const FILTER_SECTION_ORDER = [
  "system_defined",
  "fields",
  "subforms",
  "related_modules",
];

/** @type {Record<import("@/lib/contractFilterTypes").ContractFilterSectionId, string>} */
export const FILTER_SECTION_TITLES = {
  system_defined: "System Defined Filters",
  fields: "Filter By Fields",
  subforms: "Filter By Subforms",
  related_modules: "Filter By Related Modules",
};

/**
 * @param {Record<string, unknown>} field
 * @returns {import("@/lib/contractFilterTypes").ContractFilterOption[]}
 */
function mapPickListOptions(field) {
  const dataType = String(field.data_type ?? "text").toLowerCase();

  if (dataType === "layout" && Array.isArray(field.layouts)) {
    return field.layouts.map((layout) => ({
      value: layout.name,
      label: layout.name,
    }));
  }

  if (dataType === "boolean") {
    return [
      { value: "true", label: "True" },
      { value: "false", label: "False" },
    ];
  }

  if (!Array.isArray(field.pick_list_values)) return [];

  return field.pick_list_values
    .filter((opt) => opt.actual_value && opt.actual_value !== "-None-")
    .map((opt) => ({
      value: opt.actual_value,
      label: opt.display_value ?? opt.actual_value,
    }));
}

/**
 * @param {Record<string, unknown>} field
 * @param {import("@/lib/contractFilterTypes").ContractFilterSectionId} section
 * @param {{ groupLabel?: string; customViewId?: string }} [extra]
 * @returns {import("@/lib/contractFilterTypes").ContractFilterFieldMeta | null}
 */
function mapFilterField(field, section, extra = {}) {
  const apiName = field.api_name;
  if (!apiName || typeof apiName !== "string") return null;
  if (HIDDEN_API_NAMES.has(apiName) || apiName === "id") return null;
  if (field.filterable === false) return null;

  const dataType = String(field.data_type ?? "text").toLowerCase();
  const options = mapPickListOptions(field);

  return {
    apiName,
    label: field.field_label ?? apiName,
    dataType,
    operators: getOperatorsForDataType(dataType),
    options,
    hasOptions: options.length > 0,
    section,
    groupLabel: extra.groupLabel,
    customViewId: extra.customViewId,
  };
}

function isRelatedModuleField(field) {
  const dataType = String(field.data_type ?? "").toLowerCase();
  return RELATED_LOOKUP_TYPES.has(dataType);
}

/**
 * @param {Record<string, unknown>[]} moduleFields
 * @returns {Map<string, string>}
 */
function discoverSubformModules(moduleFields) {
  /** @type {Map<string, string>} */
  const subforms = new Map();
  for (const field of moduleFields) {
    if (String(field.data_type ?? "").toLowerCase() !== "subform") continue;
    const moduleApi = field.associated_module?.module;
    if (!moduleApi || typeof moduleApi !== "string") continue;
    const label = field.field_label ?? field.display_label ?? moduleApi;
    subforms.set(moduleApi, label);
  }
  return subforms;
}

/** @returns {Promise<import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]>} */
async function loadSystemDefinedFilters() {
  const url = `${ZOHO_CRM_BASE}/settings/custom_views?module=Contracts`;
  const { res, body } = await fetchZohoJson(url);
  if (!res.ok || !Array.isArray(body.custom_views)) return [];

  return body.custom_views
    .filter((view) => view.system_defined && view.id)
    .map((view) => ({
      apiName: `__custom_view__${view.id}`,
      label: view.display_value ?? view.name ?? "View",
      dataType: "custom_view",
      operators: [],
      options: [],
      hasOptions: true,
      section: /** @type {const} */ ("system_defined"),
      customViewId: String(view.id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** @returns {Promise<{ sections: import("@/lib/contractFilterTypes").ContractFilterSection[]; fields: import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]; source: "zoho" | "fallback" }>} */
export async function loadContractsFilterMeta() {
  if (filterMetaCache && Date.now() - filterMetaCache.cachedAt < FILTER_META_CACHE_TTL_MS) {
    return {
      sections: filterMetaCache.sections,
      fields: filterMetaCache.fields,
      source: filterMetaCache.source,
    };
  }

  const zohoUrl = getZohoModuleFieldsUrl("Contracts");

  try {
    const { res, body } = await fetchZohoJson(zohoUrl);

    if (!res.ok || !Array.isArray(body.fields)) {
      throw new Error("Invalid fields response");
    }

    const systemFields = await loadSystemDefinedFilters().catch((err) => {
      console.error("Zoho custom views for filters failed:", err);
      return [];
    });

    /** @type {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} */
    const moduleFields = [];
    /** @type {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} */
    const relatedFields = [];

    for (const raw of body.fields) {
      if (isRelatedModuleField(raw)) {
        const mapped = mapFilterField(raw, "related_modules");
        if (mapped) relatedFields.push(mapped);
      } else if (String(raw.data_type ?? "").toLowerCase() === "subform") {
        continue;
      } else {
        const mapped = mapFilterField(raw, "fields");
        if (mapped) moduleFields.push(mapped);
      }
    }

    moduleFields.sort((a, b) => a.label.localeCompare(b.label));
    relatedFields.sort((a, b) => a.label.localeCompare(b.label));

    /** @type {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} */
    const subformFields = [];
    const subformModules = discoverSubformModules(body.fields);

    await Promise.all(
      [...subformModules.entries()].map(async ([moduleApi, groupLabel]) => {
        try {
          const subUrl = getZohoModuleFieldsUrl(moduleApi);
          const { res: subRes, body: subBody } = await fetchZohoJson(subUrl);
          if (!subRes.ok || !Array.isArray(subBody.fields)) return;

          for (const raw of subBody.fields) {
            const mapped = mapFilterField(raw, "subforms", { groupLabel });
            if (mapped) {
              mapped.apiName = `${moduleApi}.${mapped.apiName}`;
              subformFields.push(mapped);
            }
          }
        } catch (err) {
          console.error(`Zoho subform fields failed (${moduleApi}):`, err);
        }
      }),
    );

    subformFields.sort((a, b) => {
      const g = (a.groupLabel ?? "").localeCompare(b.groupLabel ?? "");
      return g !== 0 ? g : a.label.localeCompare(b.label);
    });

    const allFields = [...systemFields, ...moduleFields, ...subformFields, ...relatedFields];

    /** @type {import("@/lib/contractFilterTypes").ContractFilterSection[]} */
    const sections = FILTER_SECTION_ORDER.map((id) => ({
      id,
      title: FILTER_SECTION_TITLES[id],
      fields:
        id === "system_defined" ? systemFields
        : id === "fields" ? moduleFields
        : id === "subforms" ? subformFields
        : relatedFields,
    })).filter((section) => section.fields.length > 0);

    const result = { sections, fields: allFields, source: /** @type {const} */ ("zoho") };
    filterMetaCache = { ...result, cachedAt: Date.now() };
    return result;
  } catch (err) {
    console.error("Zoho filter metadata request failed:", err);
  }

  const fallback = {
    sections: [],
    fields: [],
    source: /** @type {const} */ ("fallback"),
  };
  filterMetaCache = { ...fallback, cachedAt: Date.now() };
  return fallback;
}
