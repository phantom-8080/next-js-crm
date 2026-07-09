import { loadContractsFilterMeta } from "@/lib/contractFilterMeta";
import { getZohoModuleFieldsUrl } from "@/lib/zoho";

export async function GET() {
  try {
    const { sections, fields, source } = await loadContractsFilterMeta();

    return Response.json({
      sections,
      fields,
      source,
      zohoUrl: getZohoModuleFieldsUrl("Contracts"),
      filterableCount: fields.length,
      sectionCount: sections.length,
    });
  } catch (err) {
    console.error("Contract filters metadata failed:", err);
    const message = err instanceof Error ? err.message : "Failed to load filter metadata";
    return Response.json(
      { error: message, sections: [], fields: [], source: "fallback" },
      { status: 502 },
    );
  }
}
