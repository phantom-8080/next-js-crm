import { mapZohoRecord } from "@/lib/zoho";

/** Zoho CRM module API name for vendors. */
export const ZOHO_VENDORS_MODULE = "Vendors";

export const VENDOR_FIELD_LABELS: Record<string, string> = {
  Name: "Vendor name",
  Vendor_Name: "Vendor name",
  Vendor_Status: "Status",
  Email: "Email",
  Phone: "Phone",
  City: "City",
  State: "State",
  Owner: "Owner",
  Website: "Website",
  Street: "Street",
  Zip_Code: "Zip code",
  Country: "Country",
  Vendor_Type: "Vendor type",
  Tax_ID: "Tax ID",
  Payment_Terms: "Payment terms",
  Description: "Description",
  Created_Time: "Created",
  Modified_Time: "Modified",
  Created_By: "Created by",
  Modified_By: "Modified by",
};

export const VENDOR_DETAIL_SECTIONS = [
  {
    title: "Vendor overview",
    defaultOpen: true,
    fields: [
      "Name",
      "Vendor_Name",
      "Vendor_Status",
      "Vendor_Type",
      "Description",
      "Created_Time",
      "Modified_Time",
    ],
  },
  {
    title: "Contact",
    defaultOpen: true,
    fields: ["Email", "Phone", "Website"],
  },
  {
    title: "Address",
    defaultOpen: true,
    fields: ["Street", "City", "State", "Zip_Code", "Country"],
  },
  {
    title: "Billing",
    defaultOpen: true,
    fields: ["Tax_ID", "Payment_Terms", "Owner"],
  },
  {
    title: "Audit",
    defaultOpen: false,
    fields: ["Created_By", "Modified_By"],
  },
] as const;

export function allVendorDetailApiNames() {
  const names = new Set<string>();
  for (const section of VENDOR_DETAIL_SECTIONS) {
    for (const f of section.fields) names.add(f);
  }
  return [...names];
}

export function labelForVendorField(apiName: string) {
  return VENDOR_FIELD_LABELS[apiName] ?? apiName.replace(/_/g, " ");
}

/* ─── Static vendor list seed ─── */

export type StaticVendorRecord = {
  id: string;
  fields: Record<string, string>;
};

export const VENDOR_STATIC_RECORDS: StaticVendorRecord[] = [
  {
    id: "static-vendor-1001",
    fields: {
      Name: "Ghazanfar Ali Dev Test",
      Vendor_Status: "Active",
      Email: "ghazanfar.dev@example.com",
      Phone: "(612) 555-0142",
      City: "Minneapolis",
      State: "MN",
      Owner: "Gabriel Brent",
    },
  },
  {
    id: "static-vendor-1002",
    fields: {
      Name: "Test-Standard Solar",
      Vendor_Status: "Active",
      Email: "ops@standardsolar.example",
      Phone: "(703) 555-0198",
      City: "Arlington",
      State: "VA",
      Owner: "Olio Group",
    },
  },
  {
    id: "static-vendor-1003",
    fields: {
      Name: "Carvana Fleet Services",
      Vendor_Status: "Active",
      Email: "fleet@carvana.example",
      Phone: "(480) 555-0100",
      City: "Tempe",
      State: "AZ",
      Owner: "Jake Bednar",
    },
  },
  {
    id: "static-vendor-1004",
    fields: {
      Name: "A+ Plus Power Wash Inc - PA-6826",
      Vendor_Status: "Pending",
      Email: "dispatch@apluswash.example",
      Phone: "(570) 555-0166",
      City: "Scranton",
      State: "PA",
      Owner: "Jim Bjorgaard",
    },
  },
];

/* ─── Static vendor detail ─── */

const STATIC_VENDOR_1001_RAW: Record<string, unknown> = {
  id: "2168928000037970160",
  Name: "Ghazanfar Ali Dev Test",
  Vendor_Status: "Active",
  Vendor_Type: "Service provider",
  Description: "Dev/test vendor used for SOW, bids, and vendor invoice demos.",
  Email: "ghazanfar.dev@example.com",
  Phone: "(612) 555-0142",
  Website: "https://example.com/ghazanfar-dev",
  Street: "100 Demo Boulevard",
  City: "Minneapolis",
  State: "MN",
  Zip_Code: "55401",
  Country: "United States",
  Tax_ID: "XX-1234567",
  Payment_Terms: "Net 30",
  Owner: {
    name: "Gabriel Brent",
    id: "2168928000027767001",
    email: "gabrielbrent@oliogroupmn.com",
  },
  Created_Time: "2024-11-02T10:15:00-06:00",
  Modified_Time: "2026-05-28T14:22:00-05:00",
  Created_By: {
    name: "Gabriel Brent",
    id: "2168928000027767001",
    email: "gabrielbrent@oliogroupmn.com",
  },
  Modified_By: {
    name: "Dan Nelson",
    id: "2168928000000107007",
    email: "dan@oliogroupmn.com",
  },
  $layout_id: {
    display_label: "Standard",
    name: "Standard",
    id: "2168928000033656001",
  },
};

const STATIC_RAW_BY_ID: Record<string, Record<string, unknown>> = {
  "static-vendor-1001": STATIC_VENDOR_1001_RAW,
  "2168928000037970160": STATIC_VENDOR_1001_RAW,
};

for (const listRow of VENDOR_STATIC_RECORDS) {
  if (listRow.id in STATIC_RAW_BY_ID) continue;
  STATIC_RAW_BY_ID[listRow.id] = {
    id: listRow.id,
    ...listRow.fields,
    $layout_id: { display_label: "Standard", name: "Standard" },
  };
}

export function isStaticVendorId(recordId: string) {
  return recordId.startsWith("static-vendor-") || recordId in STATIC_RAW_BY_ID;
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

export function getStaticVendorDetail(recordId: string) {
  const row = STATIC_RAW_BY_ID[recordId];
  if (!row) return null;

  const apiNames = allVendorDetailApiNames();
  const mapped = mapZohoRecord(row, apiNames);
  mapped.id = recordId;

  return {
    record: mapped,
    layoutLabel: layoutLabelFromRow(row),
    zohoRecordId: row.id != null ? String(row.id) : "",
  };
}
