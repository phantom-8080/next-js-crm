import type {
  ContractFieldFilterSelection,
  ContractFilterFieldMeta,
  ContractFilterSection,
} from "@/lib/contracts/filterTypes";
import type { VendorRecord } from "@/lib/vendors/columns";

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
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Pending", label: "Pending" },
];

const staticFieldFilters: ContractFilterFieldMeta[] = [
  picklistField("Status", "Status", STATUS_OPTIONS),
  picklistField("City", "City", [
    { value: "Minneapolis", label: "Minneapolis" },
    { value: "Arlington", label: "Arlington" },
    { value: "Tempe", label: "Tempe" },
    { value: "Scranton", label: "Scranton" },
  ]),
  picklistField("State", "State", [
    { value: "MN", label: "MN" },
    { value: "VA", label: "VA" },
    { value: "AZ", label: "AZ" },
    { value: "PA", label: "PA" },
  ]),
];

const staticSystemViews: ContractFilterFieldMeta[] = [
  {
    apiName: "__custom_view__vendors-all",
    label: "All vendors",
    dataType: "custom_view",
    operators: [],
    options: [],
    hasOptions: true,
    section: "system_defined",
    customViewId: "vendors-all",
  },
  {
    apiName: "__custom_view__vendors-active",
    label: "Active vendors",
    dataType: "custom_view",
    operators: [],
    options: [],
    hasOptions: true,
    section: "system_defined",
    customViewId: "vendors-active",
  },
  {
    apiName: "__custom_view__vendors-inactive",
    label: "Inactive vendors",
    dataType: "custom_view",
    operators: [],
    options: [],
    hasOptions: true,
    section: "system_defined",
    customViewId: "vendors-inactive",
  },
];

export const VENDORS_STATIC_ALL_VIEW_ID = "vendors-all";

export const VENDORS_STATIC_FILTER_SECTIONS: ContractFilterSection[] = [
  { id: "system_defined", title: "System Defined Filters", fields: staticSystemViews },
  { id: "fields", title: "Filter By Fields", fields: staticFieldFilters },
];

export const VENDORS_STATIC_FILTER_FIELDS: ContractFilterFieldMeta[] = [
  ...staticSystemViews,
  ...staticFieldFilters,
];

export const VENDORS_STATIC_RECORDS: VendorRecord[] = [
  {
    id: "static-vendor-1001",
    fields: {
      Vendor_Name: "Ghazanfar Ali Dev Test",
      Status: "Active",
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
      Vendor_Name: "Test-Standard Solar",
      Status: "Active",
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
      Vendor_Name: "Carvana Fleet Services",
      Status: "Active",
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
      Vendor_Name: "A+ Plus Power Wash Inc - PA-6826",
      Status: "Pending",
      Email: "dispatch@apluswash.example",
      Phone: "(570) 555-0166",
      City: "Scranton",
      State: "PA",
      Owner: "Jim Bjorgaard",
    },
  },
  {
    id: "static-vendor-1005",
    fields: {
      Vendor_Name: "Metro Grounds LLC",
      Status: "Inactive",
      Email: "hello@metrogrounds.example",
      Phone: "(215) 555-0188",
      City: "Philadelphia",
      State: "PA",
      Owner: "Dan Nelson",
    },
  },
];

function matchesCustomView(record: VendorRecord, customViewId: string | null) {
  if (!customViewId || customViewId === VENDORS_STATIC_ALL_VIEW_ID) return true;
  const status = (record.fields.Status ?? "").trim().toLowerCase();
  if (customViewId === "vendors-active") return status === "active";
  if (customViewId === "vendors-inactive") return status === "inactive";
  return true;
}

function matchesFieldSelections(
  record: VendorRecord,
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

export function filterStaticVendorRecords(
  records: VendorRecord[],
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

export function getVendorsOfflineFilterMeta() {
  return {
    sections: VENDORS_STATIC_FILTER_SECTIONS,
    fields: VENDORS_STATIC_FILTER_FIELDS,
    source: "offline-demo" as const,
  };
}

export function buildOfflineVendorsListResponse({
  page,
  perPage,
  visibleApiNames,
}: {
  page: number;
  perPage: number;
  visibleApiNames: string[];
}) {
  const staticRows = VENDORS_STATIC_RECORDS.map((r) => ({
    id: r.id,
    fields: Object.fromEntries(visibleApiNames.map((name) => [name, r.fields[name] ?? ""])),
    lookups: r.lookups,
  }));

  const start = (page - 1) * perPage;
  const slice = staticRows.slice(start, start + perPage);

  return {
    records: slice,
    totalCount: staticRows.length,
    loadedCount: slice.length,
    page,
    perPage,
    hasMore: start + perPage < staticRows.length,
    visibleFields: visibleApiNames,
    criteria: null,
    cvid: null,
    filtered: false,
    offlineDemo: true,
  };
}
