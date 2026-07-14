import { createZohoCustomView } from "@/lib/createZohoCustomView";
import { clearFilterMetaCache } from "@/lib/contractFilterMeta";
import { criteriaApiNameForFilterField } from "@/lib/resolveFilterValues";
import { deleteZohoCustomView, fetchZohoCustomViews } from "@/lib/zohoCustomViews";

/**
 * GET /api/contracts/custom-views
 * Live Zoho custom views for the Contracts dropdown (not cached with field filters).
 */
export async function GET() {
  try {
    const views = await fetchZohoCustomViews("Contracts");
    return Response.json(
      {
        views,
        count: views.length,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    console.error("List Zoho custom views failed:", err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Failed to load custom views",
        views: [],
      },
      { status: 502 },
    );
  }
}

/**
 * POST /api/contracts/custom-views
 * Body: { name, accessType?, conditions: [{ apiName, operator, values }] }
 * Creates a Zoho CRM custom view and returns its id for the Next.js dropdown.
 */
/**
 * DELETE /api/contracts/custom-views?id={customViewId}
 * Deletes a Zoho CRM custom view.
 */
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() || "";
  if (!id) {
    return Response.json({ error: "Missing custom view id" }, { status: 400 });
  }

  try {
    await deleteZohoCustomView(id, "Contracts");
    clearFilterMetaCache();
    return Response.json({ ok: true, id });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    console.error("Delete Zoho custom view failed:", err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Failed to delete custom view",
        details: err.details,
      },
      { status },
    );
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const accessType = body?.accessType === "public" ? "public" : "only_to_me";
  const conditions = Array.isArray(body?.conditions) ? body.conditions : [];

  const normalized = conditions
    .map((c) => {
      const rawApiName = String(c?.apiName ?? "").trim();
      return {
        apiName: criteriaApiNameForFilterField(
          rawApiName,
          rawApiName === "Layout" || rawApiName.endsWith(".Layout") ? "layout" : "",
          "Contracts",
        ),
        operator: String(c?.operator ?? "equals").trim() || "equals",
        values: Array.isArray(c?.values) ?
            c.values.map((v) => String(v).trim()).filter(Boolean)
          : c?.value != null ? [String(c.value).trim()].filter(Boolean)
          : [],
      };
    })
    .filter((c) => c.apiName && c.values.length > 0);

  try {
    const created = await createZohoCustomView({
      module: "Contracts",
      name,
      accessType,
      conditions: normalized,
    });

    clearFilterMetaCache();

    return Response.json({
      ok: true,
      id: created.id,
      name: created.name,
      accessType: created.accessType,
      customViewId: created.id,
    });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    console.error("Create Zoho custom view failed:", err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Failed to create custom view",
        details: err.details,
      },
      { status },
    );
  }
}
