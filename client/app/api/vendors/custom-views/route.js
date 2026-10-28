import {
  clearFilterMetaCache,
  createZohoCustomView,
  criteriaApiNameForFilterField,
} from "@/lib/contracts/filterMeta";
import { DEFAULT_VISIBLE_API_NAMES, ZOHO_VENDORS_MODULE } from "@/lib/vendors/columns";
import { deleteZohoCustomView, fetchZohoCustomViews } from "@/lib/zoho";

/**
 * GET /api/vendors/custom-views
 */
export async function GET() {
  try {
    const views = await fetchZohoCustomViews(ZOHO_VENDORS_MODULE);
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
    console.error("List Zoho Vendors custom views failed:", err);
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
 * DELETE /api/vendors/custom-views?id={customViewId}
 */
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() || "";
  if (!id) {
    return Response.json({ error: "Missing custom view id" }, { status: 400 });
  }

  try {
    await deleteZohoCustomView(id, ZOHO_VENDORS_MODULE);
    clearFilterMetaCache();
    return Response.json({ ok: true, id });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    console.error("Delete Zoho Vendors custom view failed:", err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Failed to delete custom view",
        details: err.details,
      },
      { status },
    );
  }
}

/**
 * POST /api/vendors/custom-views
 * Body: { name, accessType?, conditions: [{ apiName, operator, values }] }
 */
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
          ZOHO_VENDORS_MODULE,
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
      module: ZOHO_VENDORS_MODULE,
      name,
      accessType,
      conditions: normalized,
      displayFields: [...DEFAULT_VISIBLE_API_NAMES],
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
    console.error("Create Zoho Vendors custom view failed:", err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Failed to create custom view",
        details: err.details,
      },
      { status },
    );
  }
}
