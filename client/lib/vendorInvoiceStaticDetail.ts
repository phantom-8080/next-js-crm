import { VENDOR_INVOICE_STATIC_RECORDS } from "@/lib/vendorInvoiceStaticData";
import { allVendorInvoiceDetailApiNames } from "@/lib/vendorInvoiceConfig";
import { formatFieldValue, mapZohoRecord } from "@/lib/zohoContractMap";

const STATIC_VI_1001_RAW: Record<string, unknown> = {
  Owner: {
    name: "Gabriel Brent",
    id: "2168928000027767001",
    email: "gabrielbrent@oliogroupmn.com",
  },
  $currency_symbol: "$",
  $field_states: null,
  $sharing_permission: "full_access",
  Month_of_Service: "January",
  CBRE_Work_Order: null,
  Folder_ID: null,
  Name: "1780 - Test-Standard Solar_VC_2025-2 - JAN-25",
  Last_Activity_Time: "2026-06-08T08:49:20-05:00",
  No_Invoice_needed: false,
  Document_2: null,
  Document_3: null,
  Vendor_Contract: {
    name: "Test-Standard Solar_VC_2025-2",
    id: "2168928000076997544",
  },
  Document_1: null,
  Unsubscribed_Mode: null,
  $process_flow: false,
  Exchange_Rate: 1,
  Currency: "USD",
  $locked_for_me: false,
  id: "2168928000119268001",
  Status: "Open",
  $approval: {
    delegate: false,
    takeover: false,
    approve: false,
    reject: false,
    resubmit: false,
  },
  Created_Time: "2026-06-08T08:49:18-05:00",
  $wizard_connection_path: null,
  $editable: true,
  Document_2_Description: null,
  Document_3_Description: null,
  Created_from_Widget: false,
  Vendor_Invoice_Number: null,
  Created_By: {
    name: "Gabriel Brent",
    id: "2168928000027767001",
    email: "gabrielbrent@oliogroupmn.com",
  },
  $zia_owner_assignment: "owner_recommendation_unavailable",
  Document_1_Description: null,
  Site: {
    name: "Standard Solar- SS2712",
    id: "2168928000071188028",
  },
  $review_process: {
    approve: false,
    reject: false,
    resubmit: false,
  },
  Operation_Associate: {
    name: "Gabriel Brent",
    id: "2168928000027767001",
  },
  $layout_id: {
    display_label: "Standard",
    name: "Standard",
    id: "2168928000033656051",
  },
  Invoice_Upload: null,
  Record_Image: null,
  Modified_By: {
    name: "Dan Nelson",
    id: "2168928000000107007",
    email: "dan@oliogroupmn.com",
  },
  $review: null,
  Progress_Notes1: null,
  Bill_URL_in_books: null,
  Invoice_Print_URL:
    "https://workdrive.zoho.com/print/d3ob51e18433acb3e43a294d6fcc36ab9cebb",
  Client_Invoice_Number: null,
  $zia_visions: null,
  Document_3_URL: null,
  Late_Invoice: null,
  Year_of_Service: "2025",
  Contract_End_Date: "2026-08-30",
  Modified_Time: "2026-06-08T08:49:20-05:00",
  InvoiceUrl: "https://workdrive.zoho.com/file/d3ob51e18433acb3e43a294d6fcc36ab9cebb",
  Payment_Remittance: null,
  Unsubscribed_Time: null,
  Document_2_URL: null,
  Vendor: {
    name: "Ghazanfar Ali Dev Test",
    id: "2168928000037970160",
  },
  Record_Status__s: "Available",
  $orchestration: false,
  Status_Validation: false,
  Contract_Start_Date: "2025-08-01",
  $in_merge: false,
  Locked__s: false,
  Line_Item_List: [
    {
      Unit_Number: null,
      Location_of_Recent_Service: null,
      Modified_Time: "2026-06-08T08:49:19-05:00",
      Location_Name: null,
      Description: "12/12/20204",
      $field_states: null,
      Created_Time: "2026-06-08T08:49:19-05:00",
      Rate: 12,
      Parent_Id: {
        name: "1780 - Test-Standard Solar_VC_2025-2 - JAN-25",
        id: "2168928000119268001",
      },
      Service: {
        name: "Solar Panel Cleaning (Per Service)",
        id: "2168928000030426100",
      },
      Quantity: 1,
      Tax: null,
      $layout_id: {
        display_label: "Standard",
        name: "Standard",
        id: "2168928000037476179",
      },
      Date_Of_Serviced: null,
      Site_Number: null,
      Type: null,
      $in_merge: false,
      Total: 12,
      id: "2168928000119251002",
      $zia_visions: null,
    },
  ],
  Tag: [],
  Document_1_URL: null,
  $approval_state: "approved",
  $pathfinder: false,
  $has_more: {
    Line_Item_List: false,
  },
};

const STATIC_RAW_BY_ID: Record<string, Record<string, unknown>> = {
  "static-vi-1001": STATIC_VI_1001_RAW,
  "2168928000119268001": STATIC_VI_1001_RAW,
};

for (const listRow of VENDOR_INVOICE_STATIC_RECORDS) {
  if (listRow.id in STATIC_RAW_BY_ID) continue;
  STATIC_RAW_BY_ID[listRow.id] = {
    id: listRow.id,
    ...listRow.fields,
    Line_Item_List: [],
    $layout_id: { display_label: "Standard", name: "Standard" },
  };
}

export type VendorInvoiceLineItemRow = {
  id: string;
  serviceName: string;
  description: string;
  quantity: string;
  rate: string;
  total: string;
  dateOfServiced: string;
  unitNumber: string;
  locationName: string;
};

export function isStaticVendorInvoiceId(recordId: string) {
  return recordId.startsWith("static-vi-") || recordId in STATIC_RAW_BY_ID;
}

function mapVendorInvoiceLineItems(raw: unknown): VendorInvoiceLineItemRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row, index) => {
    const r = row as Record<string, unknown>;
    const service = r.Service as { name?: string } | undefined;
    return {
      id: r.id != null ? String(r.id) : `vi-line-${index}`,
      serviceName:
        service?.name != null ? String(service.name) : formatFieldValue(r.Service),
      description: formatFieldValue(r.Description),
      quantity: formatFieldValue(r.Quantity),
      rate: formatFieldValue(r.Rate),
      total: formatFieldValue(r.Total),
      dateOfServiced: formatFieldValue(r.Date_Of_Serviced),
      unitNumber: formatFieldValue(r.Unit_Number),
      locationName: formatFieldValue(r.Location_Name),
    };
  });
}

function layoutLabelFromRow(row: Record<string, unknown>) {
  const layout = row.$layout_id ?? row.Layout;
  if (layout && typeof layout === "object" && "display_label" in layout && layout.display_label) {
    return String(layout.display_label);
  }
  if (layout && typeof layout === "object" && "name" in layout && layout.name) {
    return String(layout.name);
  }
  return "";
}

export function getStaticVendorInvoiceDetail(recordId: string) {
  const row = STATIC_RAW_BY_ID[recordId];
  if (!row) return null;

  const apiNames = allVendorInvoiceDetailApiNames();
  const mapped = mapZohoRecord(row, apiNames);
  mapped.id = recordId;

  const lineItems = mapVendorInvoiceLineItems(row.Line_Item_List);
  const layoutLabel = layoutLabelFromRow(row);

  return {
    record: mapped,
    lineItems,
    layoutLabel,
    zohoRecordId: row.id != null ? String(row.id) : "",
  };
}
