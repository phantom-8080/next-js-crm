import { loadNestedFilterFieldsForModule } from "@/lib/contracts/filterMeta";

/**
 * GET /api/modules/[module]/filter-fields
 * Nested filter field picker for Filter By Related Modules.
 */
export async function GET(_request, context) {
  const params = await context.params;
  const moduleName = String(params?.module ?? "").trim();
  if (!moduleName) {
    return Response.json({ error: "Missing module" }, { status: 400 });
  }

  try {
    const fields = await loadNestedFilterFieldsForModule(moduleName);
    return Response.json({
      module: moduleName,
      fields,
      count: fields.length,
      source: "zoho",
    });
  } catch (err) {
    console.error(`Nested filter fields failed (${moduleName}):`, err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Failed to load module fields",
        module: moduleName,
        fields: [],
        count: 0,
      },
      { status: 502 },
    );
  }
}
