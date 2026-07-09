/** Zoho CRM module API name for vendors. */
export const ZOHO_VENDORS_MODULE = "Vendors";

export const VENDOR_LIST_FIELDS = [
  "Name",
  "Vendor_Status",
  "Email",
  "Phone",
  "City",
  "State",
  "Owner",
  "Record_Status__s",
] as const;

export type VendorListField = (typeof VENDOR_LIST_FIELDS)[number];

export const VENDOR_FIELD_LABELS: Record<string, string> = {
  Name: "Vendor name",
  Vendor_Status: "Status",
  Email: "Email",
  Phone: "Phone",
  City: "City",
  State: "State",
  Owner: "Owner",
  Record_Status__s: "Record status",
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
      "Vendor_Status",
      "Vendor_Type",
      "Record_Status__s",
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

export function parseVendorListFields(searchParams: URLSearchParams) {
  const raw = searchParams.get("fields");
  if (!raw?.trim()) return [...VENDOR_LIST_FIELDS];
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((name) => name !== "id");
  return names.length > 0 ? names : [...VENDOR_LIST_FIELDS];
}
