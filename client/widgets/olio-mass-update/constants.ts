/** File-upload field API name → companion URL field (legacy Zoho maps). */
export const MODULE_FILE_FIELD_MAPS: Record<string, Record<string, string>> = {
  Contracts: {
    PO_Attachment: "PO_URL",
    Billing_Attachments_Upload: "Billing_Attachment_URL",
  },
  Accounts: { Site_Map_Attachment: "Site_Link" },
  Bids: {
    Bid_Docs_Upload: "URL",
    Supporting_Docs_Upload: "Supporting_Docs_URL",
  },
  Deals: {
    Vendor_Specific_Attachments: "Vendor_Specific_Attachments_URL",
    Client_PO_Attachment: "Client_PO_URL",
    Site_Map: "SiteMap_URL",
    Billing_Attachment_Upload: "Billing_Attachment_URL",
  },
  Vendors: {
    Bank_ACH_Team_Upload: "Bank_ACH",
    Certificate_of_Insurance_Team_upload: "Certificate_of_Insurance",
    W9: "W9_URL",
    Workers_Comp_Team_Upload: "Workers_Compensation",
  },
  ServiceCompletions: {
    Form_1_File_Upload: "Form_1_Url",
    Form_2_File_Upload: "Form_2_Url",
    Form_3_File_Upload: "Form_3_Url",
    Upload_Files: "Uploaded_File_URL",
  },
  Vendor_Invoices: {
    Document_1: "Document_1_URL",
    Document_2: "Document_2_URL",
    Document_3: "Document_3_URL",
    Invoice_Upload: "InvoiceUrl",
  },
};

/** Modal subtitle per CRM module (matches Zoho widget headings). */
export const MODULE_UPDATE_HEADINGS: Record<string, string> = {
  Contacts: "People Update",
  Products: "Our Services Update",
  Fleet_Units: "Fleet Units Update",
  FleetWashs: "By Wash Report Update",
  Vendor_Invoices: "Vendor Invoices Update",
  Bids: "Bids Update",
  Vendors: "Vendors Update",
  Contracts: "Contracts Update",
  Deals: "SOW Update",
  Accounts: "Client/Sites Update",
  ServiceCompletions: "Service Completions Update",
};

/** Primary display field used when reading a record name for notifications. */
export const MODULE_NAME_FIELDS: Record<string, string> = {
  Contracts: "Name",
  Vendors: "Vendor_Name",
  Deals: "Deal_Name",
  Accounts: "Account_Name",
  Contacts: "Full_Name",
  Products: "Product_Name",
  Bids: "Name",
  ServiceCompletions: "Name",
  Vendor_Invoices: "Name",
};

export function isMappedFileField(module: string, fieldApiName: string) {
  return Boolean(MODULE_FILE_FIELD_MAPS[module]?.[fieldApiName]);
}

export function supportsSubformEditor(module: string) {
  return module === "Contracts" || module === "Deals";
}

export function moduleUpdateHeading(module: string) {
  return MODULE_UPDATE_HEADINGS[module] ?? `${module} Update`;
}

export function moduleNameField(module: string) {
  return MODULE_NAME_FIELDS[module] ?? "Name";
}
