export type CrmFieldMeta = {
  apiName: string;
  label: string;
  dataType: string;
};

export const CONTRACTS_COLUMNS_STORAGE_KEY = "contracts-visible-columns-v1";

const LEGACY_COLUMNS_STORAGE_KEY = "contracts-visible-columns-v2";

/** Fixes API names saved from older UI versions (e.g. truncated 1st_/2nd_/3rd_ prefixes). */
const LEGACY_COLUMN_ALIASES: Record<string, string> = {
  Status: "Contract_Status",
  Client: "Vendor",
  st_Service_Completed_Date: "1st_Service_Completed_Date",
  st_Service_Confirmed_Scheduled_Date: "1st_Service_Confirmed_Scheduled_Date",
  st_Service_Scheduling_Deadline: "1st_Service_Scheduling_Deadline",
  nd_Service_Completed_Date: "2nd_Service_Completed_Date",
  nd_Service_Confirmed_Scheduled_Date: "2nd_Service_Confirmed_Scheduled_Date",
  nd_Service_Scheduling_Deadline: "2nd_Service_Scheduling_Deadline",
  rd_Service_Completed_Date: "3rd_Service_Completed_Date",
  rd_Service_Confirmed_Scheduled_Date: "3rd_Service_Confirmed_Scheduled_Date",
  rd_Service_Scheduling_Deadline: "3rd_Service_Scheduling_Deadline",
};

function normalizeStoredApiName(name: string): string {
  return LEGACY_COLUMN_ALIASES[name] ?? name;
}

export function normalizeContractFieldApiName(apiName: string): string {
  return normalizeStoredApiName(apiName);
}

/** Fields from Zoho that are not used on the contracts UI. */
const EXCLUDED_CONTRACT_FIELD_API_NAMES = new Set([
  "Client_Addendum_old",
  "Client_Addendum_Old",
  "Vendor_Addendum_old",
  "Vendor_Addendum_Old",
  "Hide_Unsubscribe_Time",
  "Unsubscribe_Mode",
  "Unsubscribed_Mode",
  "Unsubscribed_Time",
  "Sales_Order_Id",
  "Sales_Order_ID",
  "Sales_Orders_Books_ID",
  "Sales_Orders_Books_Id",
  "Sales_Order_Books_ID",
  "Sales_Order_Books_Id",
  "Number_of_Locations_Open_For_Bid_Olio",
  "Record_Status",
  "Record_Status__s",
]);

const EXCLUDED_CONTRACT_FIELD_LABELS = new Set([
  "client addendum -old",
  "client addendum old",
  "vendor addendum -old",
  "vendor addendum old",
  "hide unsubscribe time",
  "unsubscribe mode",
  "unsubscribed mode",
  "unsubscribed time",
  "sales order id",
  "sales orders books id",
  "sales order books id",
  "number of locations open for bid (olio)",
  "record status",
]);

export function isExcludedContractFieldApiName(
  apiName: string,
  dataType?: string,
  label?: string,
): boolean {
  const canonical = normalizeStoredApiName(apiName);
  const type = (dataType ?? "").toLowerCase();
  const normalizedLabel = (label ?? "").trim().toLowerCase();

  if (EXCLUDED_CONTRACT_FIELD_API_NAMES.has(canonical)) return true;
  if (EXCLUDED_CONTRACT_FIELD_LABELS.has(normalizedLabel)) return true;

  if (/client.*addendum.*old/i.test(canonical)) return true;
  if (/vendor.*addendum.*old/i.test(canonical)) return true;
  if (/^hide_.*unsubscribe.*time$/i.test(canonical)) return true;
  if (/^unsubscrib(e|ed)_(mode|time)$/i.test(canonical)) return true;
  if (/^sales_order_id$/i.test(canonical)) return true;
  if (/sales.*order.*books.*id/i.test(canonical)) return true;

  if (type === "image" || type === "profileimage") return true;
  if (/^record_image$/i.test(canonical)) return true;
  if (/contract/i.test(canonical) && /image/i.test(canonical)) return true;
  if (/^contract\s+image/i.test(normalizedLabel)) return true;

  return false;
}

export function isExcludedContractCatalogField(field: CrmFieldMeta): boolean {
  return isExcludedContractFieldApiName(field.apiName, field.dataType, field.label);
}

/** Deduplicated canonical API names for visible columns (localStorage + UI). */
export function normalizeVisibleApiNames(apiNames: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of apiNames) {
    if (!name || typeof name !== "string") continue;
    const canonical = normalizeStoredApiName(name.trim());
    if (!canonical || seen.has(canonical)) continue;
    if (isExcludedContractFieldApiName(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
  }
  return result;
}

export function filterCatalogForRecordView(catalog: CrmFieldMeta[]): CrmFieldMeta[] {
  const byCanonical = new Map<string, CrmFieldMeta>();

  for (const field of catalog) {
    const canonical = normalizeStoredApiName(field.apiName);
    if (isExcludedContractCatalogField({ ...field, apiName: canonical })) continue;
    const existing = byCanonical.get(canonical);

    if (!existing || field.apiName === canonical) {
      byCanonical.set(canonical, {
        apiName: canonical,
        label: field.label || canonical.replace(/_/g, " "),
        dataType: field.dataType,
      });
    }
  }

  return [...byCanonical.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function getContractFieldDisplayValue(
  fields: Record<string, string>,
  apiName: string,
): string {
  const direct = fields[apiName];
  if (direct != null && direct !== "") return direct;

  const canonical = normalizeStoredApiName(apiName);
  if (canonical !== apiName) {
    const fromCanonical = fields[canonical];
    if (fromCanonical != null && fromCanonical !== "") return fromCanonical;
  }

  for (const [legacy, canon] of Object.entries(LEGACY_COLUMN_ALIASES)) {
    if (canon === apiName || canon === canonical) {
      const legacyValue = fields[legacy];
      if (legacyValue != null && legacyValue !== "") return legacyValue;
    }
  }

  return fields[apiName] ?? "";
}

export function expandApiNamesForZohoFetch(apiNames: string[]): string[] {
  const set = new Set(apiNames.filter(Boolean));
  for (const name of apiNames) {
    const canonical = normalizeStoredApiName(name);
    set.add(canonical);
    set.add(name);
    for (const [legacy, canon] of Object.entries(LEGACY_COLUMN_ALIASES)) {
      if (canon === canonical) {
        set.add(legacy);
        set.add(canon);
      }
    }
  }
  return [...set];
}

export function mergeLegacyFieldValues(fields: Record<string, string>): Record<string, string> {
  const out = { ...fields };
  for (const [legacy, canon] of Object.entries(LEGACY_COLUMN_ALIASES)) {
    if ((!out[canon] || out[canon] === "") && out[legacy]) {
      out[canon] = out[legacy];
    }
    if ((!out[legacy] || out[legacy] === "") && out[canon]) {
      out[legacy] = out[canon];
    }
  }
  return out;
}

export function isUrlLikeField(apiName: string, dataType?: string) {
  if (dataType && /url|website|link/i.test(dataType)) return true;
  return /_url$/i.test(apiName) || /url/i.test(apiName);
}

export function looksLikeHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function parseStoredColumnList(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const normalized = normalizeStoredApiName(item);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

/** Default columns shown on first visit */
export const DEFAULT_VISIBLE_API_NAMES = [
  "Contract_Status",
  "Vendor",
  "Contract_End_Date",
  "Contract_Start_Date",
  "Company_Name",
  "Site",
] as const;

/** Used when Zoho Fields API is unavailable (OAuth scope) */
export const FALLBACK_FIELD_CATALOG: CrmFieldMeta[] = [
  { apiName: "Contract_Status", label: "Contract Status", dataType: "picklist" },
  { apiName: "Vendor", label: "Vendor", dataType: "lookup" },
  { apiName: "SOW_Name", label: "SOW Name", dataType: "lookup" },
  { apiName: "Contract_End_Date", label: "Contract End Date", dataType: "date" },
  { apiName: "Contract_Start_Date", label: "Contract Start Date", dataType: "date" },
  { apiName: "Company_Name", label: "Company Name", dataType: "lookup" },
  { apiName: "Site", label: "Site", dataType: "lookup" },
  { apiName: "Name", label: "Contract Name", dataType: "text" },
  { apiName: "Owner", label: "Owner", dataType: "ownerlookup" },
  { apiName: "Created_Time", label: "Created Time", dataType: "datetime" },
  { apiName: "Modified_Time", label: "Modified Time", dataType: "datetime" },
  { apiName: "Created_By", label: "Created By", dataType: "ownerlookup" },
  { apiName: "Modified_By", label: "Modified By", dataType: "ownerlookup" },
];

export function loadVisibleApiNames(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_VISIBLE_API_NAMES];

  const fromV1 = parseStoredColumnList(localStorage.getItem(CONTRACTS_COLUMNS_STORAGE_KEY));
  const fromV2 = parseStoredColumnList(localStorage.getItem(LEGACY_COLUMNS_STORAGE_KEY));
  const loaded = fromV1 ?? fromV2;

  if (!loaded) return [...DEFAULT_VISIBLE_API_NAMES];

  const normalized = normalizeVisibleApiNames(loaded);

  const rawV1 = localStorage.getItem(CONTRACTS_COLUMNS_STORAGE_KEY);
  const needsPersist =
    !fromV1 ||
    fromV2 != null ||
    (rawV1 != null && JSON.stringify(normalized) !== rawV1) ||
    normalized.length !== loaded.length;

  if (needsPersist) {
    localStorage.setItem(CONTRACTS_COLUMNS_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized.length > 0 ? normalized : [...DEFAULT_VISIBLE_API_NAMES];
}

export function saveVisibleApiNames(apiNames: string[]) {
  if (typeof window === "undefined") return;
  const normalized = normalizeVisibleApiNames(apiNames);
  localStorage.setItem(CONTRACTS_COLUMNS_STORAGE_KEY, JSON.stringify(normalized));
  localStorage.removeItem(LEGACY_COLUMNS_STORAGE_KEY);
}

export function buildFieldsQueryParam(visibleApiNames: string[]) {
  const set = new Set(["id", ...visibleApiNames]);
  return [...set].join(",");
}

export type ContractRecord = {
  id: string;
  fields: Record<string, string>;
  /** Zoho lookup record ids keyed by field api_name (e.g. Vendor, SOW_Name). */
  lookups?: Record<string, string>;
};

export function formatCellForDisplay(value: unknown, dataType?: string): string {
  if (value == null || value === "") return "";

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as { name?: string; id?: string };
    if (obj.name != null && String(obj.name) !== "") return String(obj.name);
    if (obj.id != null) return String(obj.id);
    return "";
  }

  if (Array.isArray(value)) {
    return value.map((v) => formatCellForDisplay(v, dataType)).filter(Boolean).join(", ");
  }

  const str = String(value);

  if (
    dataType === "date" ||
    dataType === "datetime" ||
    /^\d{4}-\d{2}-\d{2}/.test(str)
  ) {
    if (str.includes("/")) return str;
    const date = new Date(str);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    }
  }

  return str;
}

export function isStatusField(apiName: string) {
  return apiName === "Contract_Status";
}

/** Zoho / UI boolean values (record detail, filters). */
export function isContractBooleanTrue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1" || normalized === "on";
}

export function isDateLikeField(apiName: string, dataType?: string) {
  if (dataType === "date" || dataType === "datetime") return true;
  return /_date$|_time$|deadline/i.test(apiName);
}
