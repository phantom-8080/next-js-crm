import { HIDDEN_API_NAMES, loadContractsFieldCatalog } from "@/lib/contractModuleFields";
import { isExcludedContractCatalogField } from "@/lib/contractColumns";
import { getContractsOfflineFilterMeta } from "@/lib/contractStaticData";
import { getOperatorsForDataType } from "@/lib/zohoFilterOperators";
import { fetchZohoJson, getZohoModuleFieldsUrl, ZOHO_CRM_BASE } from "@/lib/zoho";

const FILTER_META_CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { sections: import("@/lib/contractFilterTypes").ContractFilterSection[]; fields: import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]; source: "zoho" | "fallback" | "offline-demo"; cachedAt: number }>} */
const filterMetaCacheByModule = new Map();

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

/**
 * @param {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} systemFields
 * @param {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} moduleFields
 * @param {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} subformFields
 * @param {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} relatedFields
 */
function assembleFilterMetaSections(systemFields, moduleFields, subformFields, relatedFields) {
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

  return { sections, fields: allFields };
}

/** Build filter sidebar from Contracts field catalog (same source as manage columns). */
async function buildContractsFilterMetaFromCatalog() {
  const { fields: catalog } = await loadContractsFieldCatalog();

  /** @type {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} */
  const moduleFields = [];
  for (const field of catalog) {
    if (isExcludedContractCatalogField(field)) continue;
    const dataType = String(field.dataType ?? "text").toLowerCase();
    if (dataType === "subform" || dataType === "image" || dataType === "profileimage") continue;

    moduleFields.push({
      apiName: field.apiName,
      label: field.label,
      dataType,
      operators: getOperatorsForDataType(dataType),
      options: [],
      hasOptions: false,
      section: /** @type {const} */ ("fields"),
    });
  }
  moduleFields.sort((a, b) => a.label.localeCompare(b.label));

  const systemFields = await loadSystemDefinedFilters("Contracts").catch((err) => {
    console.error("Zoho custom views for filters failed:", err);
    return [];
  });

  const { sections, fields } = assembleFilterMetaSections(
    systemFields,
    moduleFields,
    [],
    [],
  );

  if (fields.length === 0) {
    return getContractsOfflineFilterMeta();
  }

  return { sections, fields, source: /** @type {const} */ ("fallback") };
}

async function resolveContractsFilterMetaFallback() {
  try {
    return await buildContractsFilterMetaFromCatalog();
  } catch (err) {
    console.error("Contracts catalog filter fallback failed:", err);
    return getContractsOfflineFilterMeta();
  }
}

/** @returns {Promise<import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]>} */
async function loadSystemDefinedFilters(module) {
  const url = `${ZOHO_CRM_BASE}/settings/custom_views?module=${encodeURIComponent(module)}`;
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
export async function loadModuleFilterMeta(module) {
  const cached = filterMetaCacheByModule.get(module);
  if (
    cached &&
    Date.now() - cached.cachedAt < FILTER_META_CACHE_TTL_MS &&
    cached.fields.length > 0
  ) {
    return {
      sections: cached.sections,
      fields: cached.fields,
      source: cached.source,
    };
  }

  const zohoUrl = getZohoModuleFieldsUrl(module);

  try {
    const { res, body } = await fetchZohoJson(zohoUrl);

    if (!res.ok || !Array.isArray(body.fields)) {
      throw new Error("Invalid fields response");
    }

    const systemFields = await loadSystemDefinedFilters(module).catch((err) => {
      console.error("Zoho custom views for filters failed:", err);
      return [];
    });

    /** @type {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} */
    const moduleFields = [];
    /** @type {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} */
    const relatedFields = [];

    for (const raw of body.fields) {
      if (isRelatedModuleField(raw)) {
        if (
          module === "Contracts" &&
          isExcludedContractCatalogField({
            apiName: String(raw.api_name ?? ""),
            label: String(raw.field_label ?? raw.api_name ?? ""),
            dataType: String(raw.data_type ?? "text"),
          })
        ) {
          continue;
        }
        const mapped = mapFilterField(raw, "related_modules");
        if (mapped) relatedFields.push(mapped);
      } else if (String(raw.data_type ?? "").toLowerCase() === "subform") {
        continue;
      } else {
        if (
          module === "Contracts" &&
          isExcludedContractCatalogField({
            apiName: String(raw.api_name ?? ""),
            label: String(raw.field_label ?? raw.api_name ?? ""),
            dataType: String(raw.data_type ?? "text"),
          })
        ) {
          continue;
        }
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

    if (allFields.length === 0) {
      throw new Error("No filterable fields from Zoho metadata");
    }

    const { sections, fields } = assembleFilterMetaSections(
      systemFields,
      moduleFields,
      subformFields,
      relatedFields,
    );

    const result = { sections, fields, source: /** @type {const} */ ("zoho") };
    filterMetaCacheByModule.set(module, { ...result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    console.error("Zoho filter metadata request failed:", err);
  }

  if (module === "Contracts") {
    const fallback = await resolveContractsFilterMetaFallback();
    filterMetaCacheByModule.set(module, { ...fallback, cachedAt: Date.now() });
    return fallback;
  }

  const fallback = getContractsOfflineFilterMeta();
  filterMetaCacheByModule.set(module, { ...fallback, cachedAt: Date.now() });
  return fallback;
}

/** @returns {Promise<{ sections: import("@/lib/contractFilterTypes").ContractFilterSection[]; fields: import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]; source: "zoho" | "fallback" }>} */
export async function loadContractsFilterMeta() {
  return loadModuleFilterMeta("Contracts");
}
