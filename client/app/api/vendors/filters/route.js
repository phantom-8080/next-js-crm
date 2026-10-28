import { loadModuleFilterMeta } from "@/lib/contracts/filterMeta";
import { ZOHO_VENDORS_MODULE } from "@/lib/vendors/columns";
import { getVendorsOfflineFilterMeta } from "@/lib/vendors/static";
import { getZohoModuleFieldsUrl, getZohoRelatedListsUrl } from "@/lib/zoho";

export async function GET() {
  try {
    const { sections, fields, source } = await loadModuleFilterMeta(ZOHO_VENDORS_MODULE);

    return Response.json({
      sections,
      fields,
      source,
      zohoUrl: getZohoModuleFieldsUrl(ZOHO_VENDORS_MODULE),
      relatedModulesUrl: getZohoRelatedListsUrl(ZOHO_VENDORS_MODULE),
      filterableCount: fields.length,
      sectionCount: sections.length,
      offlineDemo: source === "offline-demo",
    });
  } catch (err) {
    console.error("Vendor filters metadata failed:", err);
    const message = err instanceof Error ? err.message : "Failed to load filter metadata";
    const offline = getVendorsOfflineFilterMeta();
    return Response.json({
      error: message,
      sections: offline.sections,
      fields: offline.fields,
      source: offline.source,
      offlineDemo: true,
    });
  }
}
