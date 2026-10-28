import {
  loadTelzioSmsRecipients,
  sendTelzioMassSms,
} from "@/widgets/vendor/telzio-mass-sms/server/telzioMassSms";
import type { TelzioMassSmsPayload } from "@/widgets/vendor/telzio-mass-sms/types";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

/** Load Vendor_Name + Phone for selected vendor IDs. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleName = searchParams.get("module")?.trim() || "Vendors";
    const idsParam = searchParams.get("ids")?.trim() || "";
    const selectedRecordIds = idsParam
      ? idsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : [];

    const result = await loadTelzioSmsRecipients(selectedRecordIds, moduleName);
    return Response.json(result, {
      status: result.ok ? 200 : 400,
    });
  } catch (error) {
    console.error("[widgets/telzio-mass-sms] GET", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected error",
        recipients: [],
      },
      { status: 500 },
    );
  }
}

/** Send SMS via Zoho function Vendor_Mass_SMS for each recipient phone. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<
      TelzioMassSmsPayload
    >;
    const payload: TelzioMassSmsPayload = {
      selectedRecordIds: stringArray(body.selectedRecordIds),
      message: typeof body.message === "string" ? body.message : "",
      module: typeof body.module === "string" ? body.module : "Vendors",
    };

    const result = await sendTelzioMassSms(payload);
    return Response.json(result, {
      status: result.ok ? 200 : result.successCount ? 207 : 400,
    });
  } catch (error) {
    console.error("[widgets/telzio-mass-sms] POST", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 },
    );
  }
}
