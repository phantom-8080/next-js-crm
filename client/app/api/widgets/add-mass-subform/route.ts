import { addMassSubformRows } from "@/widgets/add-mass-subform/server/addMassSubform";
import type {
  AddMassSubformPayload,
  AddMassSubformRow,
} from "@/widgets/add-mass-subform/types";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function parseRows(value: unknown): AddMassSubformRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const ourServices = String(item.OurServices ?? "").trim();
      if (!ourServices) return null;

      const startDate = String(item.Start_Date ?? "").trim();
      const endDate = String(item.End_Date ?? "").trim();
      const clientPrice = String(item.Invoice_Price ?? "").trim();
      const vendorPrice = String(item.Vendor_Price ?? "").trim();

      return {
        OurServices: ourServices,
        ...(item.serviceName != null
          ? { serviceName: String(item.serviceName) }
          : {}),
        ...(startDate ? { Start_Date: startDate } : {}),
        ...(endDate ? { End_Date: endDate } : {}),
        ...(clientPrice ? { Invoice_Price: clientPrice } : {}),
        ...(vendorPrice ? { Vendor_Price: vendorPrice } : {}),
      } satisfies AddMassSubformRow;
    })
    .filter((row): row is AddMassSubformRow => Boolean(row));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<
      AddMassSubformPayload
    >;
    const payload: AddMassSubformPayload = {
      selectedRecordIds: stringArray(body.selectedRecordIds),
      module: typeof body.module === "string" ? body.module : "Contracts",
      rows: parseRows(body.rows),
    };

    const result = await addMassSubformRows(payload);
    return Response.json(result, {
      status: result.ok ? 200 : result.successCount ? 207 : 400,
    });
  } catch (error) {
    console.error("[widgets/add-mass-subform]", error);
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 },
    );
  }
}
