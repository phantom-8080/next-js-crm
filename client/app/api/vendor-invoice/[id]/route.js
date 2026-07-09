import {
  getStaticVendorInvoiceDetail,
  isStaticVendorInvoiceId,
} from "@/lib/vendorInvoiceStaticDetail";
import { fetchZohoRecordById } from "@/lib/fetchZohoModuleRecord";
import {
  allVendorInvoiceDetailApiNames,
  ZOHO_VENDOR_INVOICE_MODULE,
} from "@/lib/vendorInvoiceConfig";
import { formatFieldValue, mapZohoRecord } from "@/lib/zohoContractMap";

function mapVendorInvoiceLineItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((row, index) => {
    const service = row?.Service;
    const name =
      service && typeof service === "object" && service.name != null ?
        String(service.name)
      : formatFieldValue(row?.Service);
    return {
      id: row?.id != null ? String(row.id) : `vi-line-${index}`,
      serviceName: name || "—",
      description: formatFieldValue(row?.Description),
      quantity: formatFieldValue(row?.Quantity),
      rate: formatFieldValue(row?.Rate),
      total: formatFieldValue(row?.Total),
      dateOfServiced: formatFieldValue(row?.Date_Of_Serviced),
      unitNumber: formatFieldValue(row?.Unit_Number),
      locationName: formatFieldValue(row?.Location_Name),
    };
  });
}

function layoutLabelFromRow(row) {
  const layout = row?.$layout_id ?? row?.Layout;
  if (layout && typeof layout === "object" && layout.display_label) {
    return String(layout.display_label);
  }
  if (layout?.name) return String(layout.name);
  return "";
}

export async function GET(_request, context) {
  const { id } = await context.params;
  if (!id || !String(id).trim()) {
    return Response.json({ error: "Missing record id" }, { status: 400 });
  }

  const recordId = String(id).trim();

  if (isStaticVendorInvoiceId(recordId)) {
    const staticDetail = getStaticVendorInvoiceDetail(recordId);
    if (!staticDetail) {
      return Response.json({ error: "Vendor invoice not found" }, { status: 404 });
    }
    return Response.json(staticDetail);
  }

  const apiNames = allVendorInvoiceDetailApiNames();

  let row;
  try {
    row = await fetchZohoRecordById(ZOHO_VENDOR_INVOICE_MODULE, recordId, apiNames);
  } catch (err) {
    const status = err.status ?? 502;
    if (status === 404) {
      return Response.json({ error: "Vendor invoice not found" }, { status: 404 });
    }
    console.error("Zoho CRM vendor invoice record request failed:", err);
    const message = err instanceof Error ? err.message : "Failed to reach Zoho CRM";
    return Response.json(
      { error: message, status: err.status, details: err.details },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }

  const mapped = mapZohoRecord(row, apiNames);
  const lineItems = mapVendorInvoiceLineItems(row.Line_Item_List);

  return Response.json({
    record: mapped,
    lineItems,
    layoutLabel: layoutLabelFromRow(row),
    zohoRecordId: row.id != null ? String(row.id) : "",
  });
}
