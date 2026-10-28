import { inviteVendorsToPortal } from "@/widgets/vendor/invite-to-vendor-portal/server/inviteToVendorPortal";
import type { InviteToVendorPortalPayload } from "@/widgets/vendor/invite-to-vendor-portal/types";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<
      InviteToVendorPortalPayload
    >;
    const payload: InviteToVendorPortalPayload = {
      selectedRecordIds: stringArray(body.selectedRecordIds),
      module: typeof body.module === "string" ? body.module : "Vendors",
    };

    const result = await inviteVendorsToPortal(payload);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[widgets/invite-to-vendor-portal]", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 },
    );
  }
}
