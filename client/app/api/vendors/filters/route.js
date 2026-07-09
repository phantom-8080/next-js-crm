import { loadModuleFilterMeta } from "@/lib/contractFilterMeta";
import { ZOHO_VENDORS_MODULE } from "@/lib/vendorConfig";
import { getZohoModuleFieldsUrl } from "@/lib/zoho";

export async function GET() {
  try {
    const { sections, fields, source } = await loadModuleFilterMeta(ZOHO_VENDORS_MODULE);

    return Response.json({
      sections,
      fields,
      source,
      zohoUrl: getZohoModuleFieldsUrl(ZOHO_VENDORS_MODULE),
      filterableCount: fields.length,
      sectionCount: sections.length,
    });
  } catch (err) {
    console.error("Vendor filters metadata failed:", err);
    const message = err instanceof Error ? err.message : "Failed to load filter metadata";
    return Response.json(
      { error: message, sections: [], fields: [], source: "fallback" },
      { status: 502 },
    );
  }
}
