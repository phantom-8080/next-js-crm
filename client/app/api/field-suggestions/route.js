import {
  ALLOWED_SUGGESTION_MODULES,
  fetchFieldSuggestions,
} from "@/lib/fieldSuggestions";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const module = searchParams.get("module")?.trim() || "";
  const field = searchParams.get("field")?.trim() || "";
  const q = searchParams.get("q")?.trim() || "";
  const dataType = searchParams.get("dataType")?.trim() || "";
  const lookupModule = searchParams.get("lookupModule")?.trim() || "";

  if (!module || !ALLOWED_SUGGESTION_MODULES.has(module)) {
    return Response.json(
      { error: "Invalid or unsupported module", suggestions: [] },
      { status: 400 },
    );
  }

  if (!field) {
    return Response.json({ error: "field is required", suggestions: [] }, { status: 400 });
  }

  try {
    const suggestions = await fetchFieldSuggestions({
      module,
      field,
      q,
      dataType,
      lookupModule,
    });
    return Response.json({ suggestions, module, field, q });
  } catch (err) {
    console.error("Field suggestions failed:", err);
    const message = err instanceof Error ? err.message : "Failed to load suggestions";
    return Response.json({ error: message, suggestions: [] }, { status: 502 });
  }
}
