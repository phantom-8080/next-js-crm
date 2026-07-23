import {
  loadClientSendingRfp,
  loadSiteDetailsForClientSendingRfp,
  saveClientSendingRfp,
  searchSitesForClientSendingRfp,
} from "@/widgets/client-sending-rfp/server/clientSendingRfp";
import type { ClientSendingRfpSavePayload } from "@/widgets/client-sending-rfp/types";

/**
 * GET ?contractId= — load contract status + site prefill
 * GET ?q= — site suggestions
 * GET ?siteId= — shipping details for selected Account/Site
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const siteId = searchParams.get("siteId")?.trim() || "";
    const contractId = searchParams.get("contractId")?.trim() || "";

    if (q) {
      const result = await searchSitesForClientSendingRfp(q);
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }

    if (siteId) {
      const result = await loadSiteDetailsForClientSendingRfp(siteId);
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }

    if (contractId) {
      const result = await loadClientSendingRfp(contractId);
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }

    return Response.json(
      { ok: false, message: "Provide contractId, q, or siteId." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[widgets/client-sending-rfp GET]", error);
    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to load Client Sending RFP data",
      },
      { status: 502 },
    );
  }
}

/** POST — save site fields + status transition (Sourcing Vendor / Pending Sales Review). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<
      ClientSendingRfpSavePayload
    >;

    const payload: ClientSendingRfpSavePayload = {
      contractId: typeof body.contractId === "string" ? body.contractId : "",
      siteId: typeof body.siteId === "string" ? body.siteId : "",
      siteStreet: typeof body.siteStreet === "string" ? body.siteStreet : "",
      siteCity: typeof body.siteCity === "string" ? body.siteCity : "",
      siteState: typeof body.siteState === "string" ? body.siteState : "",
      siteZip: typeof body.siteZip === "string" ? body.siteZip : "",
    };

    const result = await saveClientSendingRfp(payload);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[widgets/client-sending-rfp POST]", error);
    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Failed to save fields",
      },
      { status: 500 },
    );
  }
}
