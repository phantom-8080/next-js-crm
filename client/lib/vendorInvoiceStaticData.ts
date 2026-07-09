import type {
  ContractFieldFilterSelection,
  ContractFilterFieldMeta,
  ContractFilterSection,
} from "@/lib/contractFilterTypes";
import type { VendorInvoiceListField } from "@/lib/vendorInvoiceConfig";

export type StaticVendorInvoiceRecord = {
  id: string;
  fields: Record<VendorInvoiceListField | string, string>;
};

function picklistField(
  apiName: string,
  label: string,
  options: { value: string; label: string }[],
): ContractFilterFieldMeta {
  return {
    apiName,
    label,
    dataType: "picklist",
    operators: [],
    options,
    hasOptions: true,
    section: "fields",
  };
}

const STATUS_OPTIONS = [
  { value: "Open", label: "Open" },
  { value: "Submitted", label: "Submitted" },
  { value: "Paid", label: "Paid" },
  { value: "Closed", label: "Closed" },
];

const staticFieldFilters: ContractFilterFieldMeta[] = [
  picklistField("Status", "Status", STATUS_OPTIONS),
  picklistField("Vendor", "Vendor", [
    { value: "Ghazanfar Ali Dev Test", label: "Ghazanfar Ali Dev Test" },
    { value: "Standard Solar Maintenance LLC", label: "Standard Solar Maintenance LLC" },
  ]),
  picklistField("Month_of_Service", "Month of service", [
    { value: "January", label: "January" },
    { value: "February", label: "February" },
    { value: "March", label: "March" },
  ]),
];

const staticSystemViews: ContractFilterFieldMeta[] = [
  {
    apiName: "__custom_view__vi-all",
    label: "All vendor invoices",
    dataType: "custom_view",
    operators: [],
    options: [],
    hasOptions: true,
    section: "system_defined",
    customViewId: "vi-all",
  },
  {
    apiName: "__custom_view__vi-open",
    label: "Open",
    dataType: "custom_view",
    operators: [],
    options: [],
    hasOptions: true,
    section: "system_defined",
    customViewId: "vi-open",
  },
];

export const VENDOR_INVOICE_STATIC_ALL_VIEW_ID = "vi-all";

export const VENDOR_INVOICE_STATIC_FILTER_SECTIONS: ContractFilterSection[] = [
  { id: "system_defined", title: "System Defined Filters", fields: staticSystemViews },
  { id: "fields", title: "Filter By Fields", fields: staticFieldFilters },
];

export const VENDOR_INVOICE_STATIC_FILTER_FIELDS: ContractFilterFieldMeta[] = [
  ...staticSystemViews,
  ...staticFieldFilters,
];

export const VENDOR_INVOICE_STATIC_RECORDS: StaticVendorInvoiceRecord[] = [
  {
    id: "static-vi-1001",
    fields: {
      Name: "1780 - Test-Standard Solar_VC_2025-2 - JAN-25",
      Status: "Open",
      Vendor: "Ghazanfar Ali Dev Test",
      Site: "Standard Solar- SS2712",
      Month_of_Service: "January",
      Year_of_Service: "2025",
      Vendor_Contract: "Test-Standard Solar_VC_2025-2",
      Currency: "USD",
    },
  },
  {
    id: "static-vi-1002",
    fields: {
      Name: "1781 - Test-Standard Solar_VC_2025-2 - FEB-25",
      Status: "Submitted",
      Vendor: "Ghazanfar Ali Dev Test",
      Site: "Standard Solar- SS2712",
      Month_of_Service: "February",
      Year_of_Service: "2025",
      Vendor_Contract: "Test-Standard Solar_VC_2025-2",
      Currency: "USD",
    },
  },
  {
    id: "static-vi-1003",
    fields: {
      Name: "1790 - Metro Solar_VC_2024-1 - MAR-25",
      Status: "Open",
      Vendor: "Standard Solar Maintenance LLC",
      Site: "Metro Solar- MS1102",
      Month_of_Service: "March",
      Year_of_Service: "2025",
      Vendor_Contract: "Metro Solar_VC_2024-1",
      Currency: "USD",
    },
  },
];

function matchesCustomView(record: StaticVendorInvoiceRecord, customViewId: string | null) {
  if (!customViewId || customViewId === VENDOR_INVOICE_STATIC_ALL_VIEW_ID) return true;
  const status = record.fields.Status ?? "";
  if (customViewId === "vi-open") return status === "Open";
  return true;
}

function matchesFieldSelections(
  record: StaticVendorInvoiceRecord,
  selections: ContractFieldFilterSelection[],
) {
  if (selections.length === 0) return true;
  for (const selection of selections) {
    const fieldValue = (record.fields[selection.apiName] ?? "").trim();
    const values = selection.values.map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) continue;
    const normalized = values.map((v) => v.toLowerCase());
    if (!normalized.includes(fieldValue.toLowerCase())) return false;
  }
  return true;
}

export function filterStaticVendorInvoiceRecords(
  records: StaticVendorInvoiceRecord[],
  {
    fieldSelections = [],
    customViewId = null,
  }: {
    fieldSelections?: ContractFieldFilterSelection[];
    customViewId?: string | null;
  },
) {
  return records.filter(
    (record) =>
      matchesCustomView(record, customViewId) &&
      matchesFieldSelections(record, fieldSelections),
  );
}
