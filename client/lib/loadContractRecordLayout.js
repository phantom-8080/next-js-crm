import { fetchZohoJson, getZohoModuleLayoutsUrl } from "@/lib/zoho";
import {
  finalizeRecordSections,
  buildFallbackRecordSections,
  parseZohoLayout,
} from "@/lib/contractRecordLayout";

/**
 * @param {import("@/lib/contractColumns").CrmFieldMeta[]} catalog
 * @returns {Promise<{ sections: import("@/lib/contractRecordLayout").CrmRecordSection[], droppedSectionFieldApiNames: string[], source: "zoho" | "fallback" }>}
 */
export async function loadContractsRecordSections(catalog) {
  const url = getZohoModuleLayoutsUrl("Contracts");

  try {
    const { res, body } = await fetchZohoJson(url);
    if (res.ok) {
      const parsed = parseZohoLayout(body);
      if (parsed && (parsed.sections.length > 0 || parsed.droppedSectionFieldApiNames.length > 0)) {
        return {
          sections: finalizeRecordSections(parsed.sections, catalog),
          droppedSectionFieldApiNames: parsed.droppedSectionFieldApiNames,
          source: /** @type {const} */ ("zoho"),
        };
      }
    }
  } catch (err) {
    console.error("Zoho layouts request failed:", err);
  }

  return {
    sections: finalizeRecordSections(buildFallbackRecordSections(catalog), catalog),
    droppedSectionFieldApiNames: [],
    source: /** @type {const} */ ("fallback"),
  };
}
