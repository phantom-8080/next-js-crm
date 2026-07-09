import { VENDOR_INVOICE_STATIC_RECORDS } from "@/lib/vendorInvoiceStaticData";
import { parseVendorInvoiceListFields } from "@/lib/vendorInvoiceConfig";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = 100;
  const visibleApiNames = parseVendorInvoiceListFields(searchParams);

  const staticRows = VENDOR_INVOICE_STATIC_RECORDS.map((r) => ({
    id: r.id,
    fields: Object.fromEntries(
      visibleApiNames.map((name) => [name, r.fields[name] ?? ""]),
    ),
  }));

  const start = (page - 1) * perPage;
  const slice = staticRows.slice(start, start + perPage);

  return Response.json({
    records: slice,
    totalCount: staticRows.length,
    loadedCount: slice.length,
    page,
    perPage,
    hasMore: start + perPage < staticRows.length,
    visibleFields: visibleApiNames,
    filtered: false,
  });
}
