import { runContractListBulkUpdate } from "@/widgets/contract-list-bulk-update/server/contractListBulkUpdate";
import type { ContractListBulkUpdatePayload } from "@/widgets/contract-list-bulk-update/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<
      ContractListBulkUpdatePayload
    >;

    const recordIds = Array.isArray(body.recordIds)
      ? body.recordIds.map(String)
      : [];

    const payload: ContractListBulkUpdatePayload = {
      recordIds,
      fieldApiName:
        typeof body.fieldApiName === "string" ? body.fieldApiName : "",
      fieldValue: typeof body.fieldValue === "string" ? body.fieldValue : "",
      fieldType: typeof body.fieldType === "string" ? body.fieldType : "text",
    };

    const result = await runContractListBulkUpdate(payload);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("[widgets/contract-list-bulk-update]", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 },
    );
  }
}
