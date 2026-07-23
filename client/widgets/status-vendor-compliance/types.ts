/** Button label on the contract record view (matches Zoho menu). */
export const STATUS_VENDOR_COMPLIANCE_BUTTON_LABEL =
  "Status Vendor Compliance" as const;

/** Widget modal title (matches widget.html). */
export const STATUS_VENDOR_COMPLIANCE_WIDGET_NAME =
  "Vendor Compliance Review" as const;

export const TRANSITION_LABEL_ACTIVATE_VENDOR = "Activate Vendor" as const;
export const STATUS_ACTIVE = "Active" as const;

export type VendorComplianceForm = {
  w9Url: string;
  coiExpiration: string;
  workersComp: string;
  legalName: string;
  bankAch: string;
};

export type StatusVendorComplianceLoadResult = {
  ok: boolean;
  message?: string;
  contractId?: string;
  contractName?: string;
  currentStatus?: string;
  vendorId?: string;
  vendorName?: string;
  vendorExists?: boolean;
  fields?: VendorComplianceForm;
};

export type StatusVendorComplianceSavePayload = {
  contractId: string;
  vendorId: string;
  fields: VendorComplianceForm;
};

export type StatusVendorComplianceSaveResult = {
  ok: boolean;
  message?: string;
  finalStatus?: string;
};
