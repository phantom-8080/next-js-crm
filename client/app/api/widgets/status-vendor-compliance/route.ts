import {
  loadStatusVendorCompliance,
  saveStatusVendorCompliance,
} from "@/widgets/status-vendor-compliance/server/statusVendorCompliance";
import type {
  StatusVendorComplianceSavePayload,
  VendorComplianceForm,
} from "@/widgets/status-vendor-compliance/types";

/** GET ?contractId= — load contract status + vendor compliance fields. */
export async function GET(request: Request) {
  try {
    const contractId =
      new URL(request.url).searchParams.get("contractId")?.trim() || "";
    if (!contractId) {
      return Response.json(
        { ok: false, message: "Provide contractId." },
        { status: 400 },
      );
    }
    const result = await loadStatusVendorCompliance(contractId);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[widgets/status-vendor-compliance GET]", error);
    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to load Vendor Compliance Review",
      },
      { status: 502 },
    );
  }
}

/** POST — save vendor compliance + set Contract_Status to Active. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<
      StatusVendorComplianceSavePayload
    > & { fields?: Partial<VendorComplianceForm> };

    const fields: VendorComplianceForm = {
      w9Url: typeof body.fields?.w9Url === "string" ? body.fields.w9Url : "",
      coiExpiration:
        typeof body.fields?.coiExpiration === "string"
          ? body.fields.coiExpiration
          : "",
      workersComp:
        typeof body.fields?.workersComp === "string"
          ? body.fields.workersComp
          : "",
      legalName:
        typeof body.fields?.legalName === "string" ? body.fields.legalName : "",
      bankAch:
        typeof body.fields?.bankAch === "string" ? body.fields.bankAch : "",
    };

    const payload: StatusVendorComplianceSavePayload = {
      contractId: typeof body.contractId === "string" ? body.contractId : "",
      vendorId: typeof body.vendorId === "string" ? body.vendorId : "",
      fields,
    };

    const result = await saveStatusVendorCompliance(payload);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[widgets/status-vendor-compliance POST]", error);
    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Failed to save compliance",
      },
      { status: 500 },
    );
  }
}
