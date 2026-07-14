import type {
  ContractFieldFilterSelection,
  ContractFilterFieldMeta,
  ContractFilterSection,
} from "@/lib/contractFilterTypes";

export type StaticContractRecord = {
  id: string;
  fields: Record<string, string>;
  lookups?: Record<string, string>;
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
  { value: "Active", label: "Active" },
  { value: "Closed", label: "Closed" },
];

const staticFieldFilters: ContractFilterFieldMeta[] = [
  picklistField("Contract_Status", "Contract status", STATUS_OPTIONS),
  picklistField("Vendor", "Vendor", [
    { value: "Ghazanfar Ali Dev Test", label: "Ghazanfar Ali Dev Test" },
    { value: "Test-Standard Solar", label: "Test-Standard Solar" },
    { value: "Carvana Fleet Services", label: "Carvana Fleet Services" },
  ]),
  picklistField("Company_Name", "Company", [
    { value: "Standard Solar", label: "Standard Solar" },
    { value: "Carvana", label: "Carvana" },
    { value: "Olio Group", label: "Olio Group" },
  ]),
];

const staticSystemViews: ContractFilterFieldMeta[] = [
  {
    apiName: "__custom_view__contracts-all",
    label: "All contracts",
    dataType: "custom_view",
    operators: [],
    options: [],
    hasOptions: true,
    section: "system_defined",
    customViewId: "contracts-all",
  },
  {
    apiName: "__custom_view__contracts-active",
    label: "Active contracts",
    dataType: "custom_view",
    operators: [],
    options: [],
    hasOptions: true,
    section: "system_defined",
    customViewId: "contracts-active",
  },
  {
    apiName: "__custom_view__contracts-closed",
    label: "Closed contracts",
    dataType: "custom_view",
    operators: [],
    options: [],
    hasOptions: true,
    section: "system_defined",
    customViewId: "contracts-closed",
  },
];

export const CONTRACTS_STATIC_ALL_VIEW_ID = "contracts-all";

export const CONTRACTS_STATIC_FILTER_SECTIONS: ContractFilterSection[] = [
  { id: "system_defined", title: "Custom Views", fields: staticSystemViews },
  { id: "fields", title: "Filter By Fields", fields: staticFieldFilters },
];

export const CONTRACTS_STATIC_FILTER_FIELDS: ContractFilterFieldMeta[] = [
  ...staticSystemViews,
  ...staticFieldFilters,
];

export const CONTRACTS_STATIC_RECORDS: StaticContractRecord[] = [
  {
    id: "static-contract-1001",
    fields: {
      Name: "Test-Standard Solar_VC_2025-2",
      Contract_Status: "Active",
      Vendor: "Ghazanfar Ali Dev Test",
      SOW_Name: "SOW30073",
      Company_Name: "Standard Solar",
      Site: "Standard Solar- SS2712",
      Contract_Start_Date: "2025-08-01",
      Contract_End_Date: "2026-08-30",
      Owner: "Gabriel Brent",
    },
    lookups: {
      Vendor: "static-vendor-1001",
      SOW_Name: "2168928000114292432",
    },
  },
  {
    id: "static-contract-1002",
    fields: {
      Name: "Carvana-CAR2548 Fleet Wash",
      Contract_Status: "Active",
      Vendor: "Carvana Fleet Services",
      Company_Name: "Carvana",
      Site: "Carvana-CAR2548",
      Contract_Start_Date: "2025-01-15",
      Contract_End_Date: "2025-12-31",
      Owner: "Olio Group",
    },
  },
  {
    id: "static-contract-1003",
    fields: {
      Name: "Metro Ops Scranton VC 2024",
      Contract_Status: "Closed",
      Vendor: "Test-Standard Solar",
      Company_Name: "Olio Group",
      Site: "Market Ops - Scranton",
      Contract_Start_Date: "2024-03-01",
      Contract_End_Date: "2025-02-28",
      Owner: "Jim Bjorgaard",
    },
  },
  {
    id: "static-contract-1004",
    fields: {
      Name: "Houston East Yard Maintenance",
      Contract_Status: "Active",
      Vendor: "Ghazanfar Ali Dev Test",
      Company_Name: "Carvana",
      Site: "Houston East Yard",
      Contract_Start_Date: "2025-04-01",
      Contract_End_Date: "2026-03-31",
      Owner: "Jake Bednar",
    },
  },
  {
    id: "static-contract-1005",
    fields: {
      Name: "Legacy Solar Panel VC 2023",
      Contract_Status: "Closed",
      Vendor: "Test-Standard Solar",
      Company_Name: "Standard Solar",
      Site: "Standard Solar- SS1100",
      Contract_Start_Date: "2023-06-01",
      Contract_End_Date: "2024-05-31",
      Owner: "Dan Nelson",
    },
  },
  {
    id: "static-contract-1006",
    fields: {
      Name: "Olio HQ Grounds VC 2025",
      Contract_Status: "Active",
      Vendor: "Carvana Fleet Services",
      Company_Name: "Olio Group",
      Site: "Olio HQ",
      Contract_Start_Date: "2025-01-01",
      Contract_End_Date: "2025-12-31",
      Owner: "Gabriel Brent",
    },
  },
];

function matchesCustomView(record: StaticContractRecord, customViewId: string | null) {
  if (!customViewId || customViewId === CONTRACTS_STATIC_ALL_VIEW_ID) return true;
  const status = (record.fields.Contract_Status ?? "").trim();
  if (customViewId === "contracts-active") return status.toLowerCase() === "active";
  if (customViewId === "contracts-closed") return status.toLowerCase() === "closed";
  return true;
}

function matchesFieldSelections(
  record: StaticContractRecord,
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

export function filterStaticContractRecords(
  records: StaticContractRecord[],
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

export function getContractsOfflineFilterMeta() {
  return {
    sections: CONTRACTS_STATIC_FILTER_SECTIONS,
    fields: CONTRACTS_STATIC_FILTER_FIELDS,
    source: "offline-demo" as const,
  };
}

export function buildOfflineContractsListResponse({
  page,
  perPage,
  visibleApiNames,
}: {
  page: number;
  perPage: number;
  visibleApiNames: string[];
}) {
  const staticRows = CONTRACTS_STATIC_RECORDS.map((r) => ({
    id: r.id,
    fields: Object.fromEntries(
      visibleApiNames.map((name) => [name, r.fields[name] ?? ""]),
    ),
    lookups: r.lookups,
  }));

  const start = (page - 1) * perPage;
  const slice = staticRows.slice(start, start + perPage);

  return {
    contracts: slice,
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

export function isStaticContractId(recordId: string) {
  return recordId.startsWith("static-contract-");
}
