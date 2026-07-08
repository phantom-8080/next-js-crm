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

const LEGACY_TRUNCATED_SERVICE_API_NAMES = new Set(
  Object.keys(LEGACY_COLUMN_ALIASES).filter((k) => /^(st|nd|rd)_Service_/.test(k)),
);

/** Zoho metadata sometimes exposes truncated API names (e.g. nd_ instead of 2nd_). */
export function isLegacyTruncatedServiceApiName(apiName: string): boolean {
  return LEGACY_TRUNCATED_SERVICE_API_NAMES.has(apiName);
}

export function normalizeContractFieldApiName(apiName: string): string {
  return normalizeStoredApiName(apiName);
}

/** Deduplicated canonical API names for visible columns (localStorage + UI). */
export function normalizeVisibleApiNames(apiNames: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of apiNames) {
    if (!name || typeof name !== "string") continue;
    const canonical = normalizeStoredApiName(name.trim());
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
  }
  return result;
}

export function filterCatalogForRecordView(catalog: CrmFieldMeta[]): CrmFieldMeta[] {
  const byCanonical = new Map<string, CrmFieldMeta>();

  for (const field of catalog) {
    const canonical = normalizeStoredApiName(field.apiName);
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

  const rawV1 = localStorage.getItem(CONTRACTS_COLUMNS_STORAGE_KEY);
  const needsPersist =
    !fromV1 ||
    fromV2 != null ||
    (rawV1 != null && JSON.stringify(loaded) !== rawV1);

  if (needsPersist) {
    localStorage.setItem(CONTRACTS_COLUMNS_STORAGE_KEY, JSON.stringify(loaded));
  }

  return loaded;
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
  return apiName === "Contract_Status" || apiName === "Record_Status";
}

export function isDateLikeField(apiName: string, dataType?: string) {
  if (dataType === "date" || dataType === "datetime") return true;
  return /_date$|_time$|deadline/i.test(apiName);
}
