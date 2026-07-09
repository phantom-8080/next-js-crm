export const ZOHO_VENDOR_INVOICE_MODULE = "Vendor_Invoices";

export const VENDOR_INVOICE_LIST_FIELDS = [
  "Name",
  "Status",
  "Vendor",
  "Site",
  "Month_of_Service",
  "Year_of_Service",
  "Vendor_Contract",
  "Currency",
] as const;

export type VendorInvoiceListField = (typeof VENDOR_INVOICE_LIST_FIELDS)[number];

export const VENDOR_INVOICE_FIELD_LABELS: Record<string, string> = {
  Name: "Name",
  Status: "Status",
  Vendor: "Vendor",
  Site: "Site",
  Month_of_Service: "Month of service",
  Year_of_Service: "Year of service",
  Vendor_Contract: "Vendor contract",
  Currency: "Currency",
  Vendor_Invoice_Number: "Vendor invoice number",
  Client_Invoice_Number: "Client invoice number",
  Exchange_Rate: "Exchange rate",
  No_Invoice_needed: "No invoice needed",
  Late_Invoice: "Late invoice",
  Status_Validation: "Status validation",
  Record_Status__s: "Record status",
  Contract_Start_Date: "Contract start date",
  Contract_End_Date: "Contract end date",
  CBRE_Work_Order: "CBRE work order",
  Owner: "Owner",
  Operation_Associate: "Operation associate",
  InvoiceUrl: "Invoice URL",
  Invoice_Print_URL: "Invoice print URL",
  Bill_URL_in_books: "Bill URL in books",
  Document_1_URL: "Document 1 URL",
  Document_2_URL: "Document 2 URL",
  Document_3_URL: "Document 3 URL",
  Document_1_Description: "Document 1 description",
  Document_2_Description: "Document 2 description",
  Document_3_Description: "Document 3 description",
  Invoice_Upload: "Invoice upload",
  Document_1: "Document 1",
  Document_2: "Document 2",
  Document_3: "Document 3",
  Progress_Notes1: "Progress notes",
  Payment_Remittance: "Payment remittance",
  Folder_ID: "Folder ID",
  Created_from_Widget: "Created from widget",
  Created_Time: "Created",
  Modified_Time: "Modified",
  Created_By: "Created by",
  Modified_By: "Modified by",
};

export const VENDOR_INVOICE_DETAIL_SECTIONS = [
  {
    title: "Invoice overview",
    defaultOpen: true,
    fields: [
      "Name",
      "Status",
      "Vendor_Invoice_Number",
      "Client_Invoice_Number",
      "Month_of_Service",
      "Year_of_Service",
      "Currency",
      "Exchange_Rate",
      "No_Invoice_needed",
      "Late_Invoice",
      "Status_Validation",
      "Record_Status__s",
      "Created_Time",
      "Modified_Time",
    ],
  },
  {
    title: "Vendor & contract",
    defaultOpen: true,
    fields: [
      "Vendor",
      "Vendor_Contract",
      "Site",
      "Contract_Start_Date",
      "Contract_End_Date",
      "CBRE_Work_Order",
      "Owner",
      "Operation_Associate",
    ],
  },
  {
    title: "Documents & URLs",
    defaultOpen: true,
    fields: [
      "InvoiceUrl",
      "Invoice_Print_URL",
      "Bill_URL_in_books",
      "Document_1_URL",
      "Document_2_URL",
      "Document_3_URL",
      "Document_1_Description",
      "Document_2_Description",
      "Document_3_Description",
      "Invoice_Upload",
      "Document_1",
      "Document_2",
      "Document_3",
    ],
  },
  {
    title: "Notes & billing",
    defaultOpen: true,
    fields: ["Progress_Notes1", "Payment_Remittance", "Folder_ID", "Created_from_Widget"],
  },
  {
    title: "Audit",
    defaultOpen: false,
    fields: ["Created_By", "Modified_By"],
  },
] as const;

export function allVendorInvoiceDetailApiNames() {
  const names = new Set<string>();
  for (const section of VENDOR_INVOICE_DETAIL_SECTIONS) {
    for (const f of section.fields) names.add(f);
  }
  return [...names];
}

export function labelForVendorInvoiceField(apiName: string) {
  return VENDOR_INVOICE_FIELD_LABELS[apiName] ?? apiName.replace(/_/g, " ");
}

export function parseVendorInvoiceListFields(searchParams: URLSearchParams) {
  const raw = searchParams.get("fields");
  if (!raw?.trim()) return [...VENDOR_INVOICE_LIST_FIELDS];
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((name) => name !== "id");
  return names.length > 0 ? names : [...VENDOR_INVOICE_LIST_FIELDS];
}
