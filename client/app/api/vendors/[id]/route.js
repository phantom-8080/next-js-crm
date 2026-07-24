import {
  allVendorDetailApiNames,
  getStaticVendorDetail,
  isStaticVendorId,
  ZOHO_VENDORS_MODULE,
} from "@/lib/vendor";
import {
  collectRecordDetailApiNames,
  loadModuleRecordSections,
} from "@/lib/contracts/recordLayout";
import {
  fetchZohoRecordById,
  loadVendorsFieldCatalog,
  mapZohoRecord,
} from "@/lib/zoho";

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

  if (isStaticVendorId(recordId)) {
    const staticDetail = getStaticVendorDetail(recordId);
    if (!staticDetail) {
      return Response.json({ error: "Vendor not found" }, { status: 404 });
    }
    return Response.json(staticDetail);
  }

  let apiNames = allVendorDetailApiNames();
  let layoutSections = null;
  let droppedSectionFieldApiNames = [];

  try {
    const { fields, source } = await loadVendorsFieldCatalog();
    if (source === "zoho" && fields.length > 0) {
      const layout = await loadModuleRecordSections(ZOHO_VENDORS_MODULE, fields);
      layoutSections = layout.sections;
      droppedSectionFieldApiNames = layout.droppedSectionFieldApiNames ?? [];
      apiNames = collectRecordDetailApiNames(fields, layoutSections, {
        droppedSectionFieldApiNames,
      });
      // Ensure common vendor title/status keys are always requested.
      for (const extra of ["Name", "Vendor_Name", "Vendor_Status", "Status"]) {
        if (!apiNames.includes(extra)) apiNames.push(extra);
      }
    }
  } catch (err) {
    console.error("Failed to load Vendors field catalog for record:", err);
  }

  let row;
  try {
    row = await fetchZohoRecordById(ZOHO_VENDORS_MODULE, recordId, apiNames);
  } catch (err) {
    const status = err.status ?? 502;
    if (status === 404) {
      return Response.json({ error: "Vendor not found" }, { status: 404 });
    }
    console.error("Zoho CRM vendor record request failed:", err);
    const message = err instanceof Error ? err.message : "Failed to reach Zoho CRM";
    return Response.json(
      { error: message, status: err.status, details: err.details },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }

  const mapped = mapZohoRecord(row, apiNames);

  return Response.json({
    record: mapped,
    layoutLabel: layoutLabelFromRow(row),
    zohoRecordId: row.id != null ? String(row.id) : "",
    visibleFields: apiNames,
  });
}
