/**
 * Single API for PO Addendum widget.
 * GET  ?action=record&id=&module=Contracts
 * POST ?action=save  { recordId, module, poAddendum } or Zoho updateRecord shape
 */

import {
  loadPoAddendumRecord,
  savePoAddendum,
} from "@/widgets/po-addendum/server/poAddendum";

function actionOf(request: Request) {
  return new URL(request.url).searchParams.get("action")?.trim() || "";
}

export async function GET(request: Request) {
  const action = actionOf(request) || "record";
  const { searchParams } = new URL(request.url);

  try {
    if (action === "record") {
      const id = searchParams.get("id")?.trim() || "";
      const moduleName = searchParams.get("module")?.trim() || "Contracts";
      if (!id) {
        return Response.json({ error: "Missing id" }, { status: 400 });
      }
      const body = await loadPoAddendumRecord(id, moduleName);
      return Response.json(body);
    }

    return Response.json(
      { error: `Unknown GET action: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    console.error("[widgets/po-addendum GET]", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to load record",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const action = actionOf(request) || "save";

  try {
    if (action !== "save") {
      return Response.json(
        { error: `Unknown POST action: ${action}` },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      recordId?: string;
      module?: string;
      moduleName?: string;
      poAddendum?: string;
      Entity?: string;
      APIData?: Record<string, unknown>;
    };

    let recordId = String(body.recordId ?? "").trim();
    let moduleName =
      String(body.moduleName ?? body.module ?? "Contracts").trim() ||
      "Contracts";
    let poAddendum = typeof body.poAddendum === "string" ? body.poAddendum : "";

    // Zoho updateRecord shape from widget.html
    if (body.APIData) {
      recordId = String(body.APIData.id ?? recordId).trim();
      moduleName = String(body.Entity ?? moduleName).trim() || "Contracts";
      poAddendum = String(body.APIData.PO_Addendum ?? poAddendum);
    }

    const result = await savePoAddendum({
      recordId,
      moduleName,
      poAddendum,
    });
    return Response.json(result);
  } catch (error) {
    console.error("[widgets/po-addendum POST]", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Save failed",
      },
      { status: 502 },
    );
  }
}
