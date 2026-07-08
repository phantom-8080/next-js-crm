import { getZohoModuleFieldsUrl } from "@/lib/zoho";
import { FALLBACK_FIELD_CATALOG } from "@/lib/contractColumns";
import { buildFallbackRecordSections } from "@/lib/contractRecordLayout";
import { loadContractsFieldCatalog } from "@/lib/contractModuleFields";
import { loadContractsRecordSections } from "@/lib/loadContractRecordLayout";

function fallbackPayload(warning) {
  const fields = FALLBACK_FIELD_CATALOG.map((f) => ({ ...f, visible: true }));
  return {
    fields,
    sections: buildFallbackRecordSections(fields),
    sectionSource: "fallback",
    source: "fallback",
    warning,
    count: FALLBACK_FIELD_CATALOG.length,
  };
}

export async function GET() {
  const zohoUrl = getZohoModuleFieldsUrl("Contracts");

  try {
    const { fields, source } = await loadContractsFieldCatalog();
    const { sections, source: sectionSource } = await loadContractsRecordSections(fields);

    if (source === "zoho") {
      return Response.json({
        fields,
        sections,
        sectionSource,
        source: "zoho",
        zohoUrl,
        count: fields.length,
      });
    }

    return Response.json({
      ...fallbackPayload(
        "Could not load fields from Zoho. Add OAuth scope ZohoCRM.settings.fields.READ (or ZohoCRM.settings.ALL), generate a new token, and update credentials in lib/zoho-oauth.js. Showing a short fallback list.",
      ),
      sections: sections ?? null,
      sectionSource,
      zohoUrl,
    });
  } catch (err) {
    console.error("Zoho fields request failed:", err);
    const message = err instanceof Error ? err.message : "Failed to reach Zoho CRM";
    return Response.json(
      fallbackPayload(
        `Could not reach Zoho (${message}). Showing a short fallback list.`,
      ),
    );
  }
}
