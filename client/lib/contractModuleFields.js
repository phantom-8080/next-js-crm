import { fetchZohoJson, getZohoModuleFieldsUrl } from "@/lib/zoho";
import { FALLBACK_FIELD_CATALOG } from "@/lib/contractColumns";

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
/** @type {{ fields: import("@/lib/contractColumns").CrmFieldMeta[], source: "zoho" | "fallback", cachedAt: number } | null} */
let catalogCache = null;

/** @returns {Promise<{ fields: import("@/lib/contractColumns").CrmFieldMeta[], source: "zoho" | "fallback" }>} */
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
