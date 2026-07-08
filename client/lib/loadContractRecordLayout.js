import { fetchZohoJson, getZohoModuleLayoutsUrl } from "@/lib/zoho";
import {
  buildFallbackRecordSections,
  parseZohoLayoutSections,
} from "@/lib/contractRecordLayout";

/**
 * @param {import("@/lib/contractColumns").CrmFieldMeta[]} catalog
 * @returns {Promise<{ sections: import("@/lib/contractRecordLayout").CrmRecordSection[], source: "zoho" | "fallback" }>}
 */
export async function loadContractsRecordSections(catalog) {
  const url = getZohoModuleLayoutsUrl("Contracts");

  try {
    const { res, body } = await fetchZohoJson(url);
    if (res.ok) {
      const sections = parseZohoLayoutSections(body);
      if (sections && sections.length > 0) {
        return { sections, source: "zoho" };
      }
    }
  } catch (err) {
    console.error("Zoho layouts request failed:", err);
  }

  return {
    sections: buildFallbackRecordSections(catalog),
    source: "fallback",
  };
}
