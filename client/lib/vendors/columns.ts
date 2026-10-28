import {
  formatCellForDisplay,
  isDateLikeField,
  type CrmFieldMeta,
} from "@/lib/contracts/columns";

export type { CrmFieldMeta };
export { formatCellForDisplay, isDateLikeField };

export const ZOHO_VENDORS_MODULE = "Vendors" as const;

export const VENDORS_COLUMNS_STORAGE_KEY = "vendors-visible-columns-v1";

/** Default columns shown on first visit. */
export const DEFAULT_VISIBLE_API_NAMES = [
  "Vendor_Name",
  "Status",
  "Email",
  "Phone",
  "City",
  "State",
  "Owner",
] as const;

/** Used when Zoho Fields API is unavailable. */
export const FALLBACK_FIELD_CATALOG: CrmFieldMeta[] = [
  { apiName: "Vendor_Name", label: "Vendor Name", dataType: "text" },
  { apiName: "Status", label: "Status", dataType: "picklist" },
  { apiName: "Email", label: "Email", dataType: "email" },
  { apiName: "Phone", label: "Phone", dataType: "phone" },
  { apiName: "Website", label: "Website", dataType: "website" },
  { apiName: "City", label: "City", dataType: "text" },
  { apiName: "State", label: "State", dataType: "text" },
  { apiName: "Street", label: "Street", dataType: "text" },
  { apiName: "Zip_Code", label: "Zip Code", dataType: "text" },
  { apiName: "Country", label: "Country", dataType: "text" },
  { apiName: "Owner", label: "Owner", dataType: "ownerlookup" },
  { apiName: "Created_Time", label: "Created Time", dataType: "datetime" },
  { apiName: "Modified_Time", label: "Modified Time", dataType: "datetime" },
  { apiName: "Created_By", label: "Created By", dataType: "ownerlookup" },
  { apiName: "Modified_By", label: "Modified By", dataType: "ownerlookup" },
];

const EXCLUDED_VENDOR_FIELD_API_NAMES = new Set([
  "Hide_Unsubscribe_Time",
  "Unsubscribe_Mode",
  "Unsubscribed_Mode",
  "Unsubscribed_Time",
  "Record_Status",
  "Record_Status__s",
  "Record_Image",
]);

const EXCLUDED_VENDOR_FIELD_LABELS = new Set([
  "hide unsubscribe time",
  "unsubscribe mode",
  "unsubscribed mode",
  "unsubscribed time",
  "record status",
  "record image",
]);

export function isExcludedVendorFieldApiName(
  apiName: string,
  dataType?: string,
  label?: string,
): boolean {
  const type = (dataType ?? "").toLowerCase();
  const normalizedLabel = (label ?? "").trim().toLowerCase();

  if (EXCLUDED_VENDOR_FIELD_API_NAMES.has(apiName)) return true;
  if (EXCLUDED_VENDOR_FIELD_LABELS.has(normalizedLabel)) return true;
  if (/^hide_.*unsubscribe.*time$/i.test(apiName)) return true;
  if (/^unsubscrib(e|ed)_(mode|time)$/i.test(apiName)) return true;
  if (type === "image" || type === "profileimage") return true;
  if (/^record_image$/i.test(apiName)) return true;

  return false;
}

export function isExcludedVendorCatalogField(field: CrmFieldMeta): boolean {
  return isExcludedVendorFieldApiName(field.apiName, field.dataType, field.label);
}

export function normalizeVisibleApiNames(apiNames: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of apiNames) {
    if (!name || typeof name !== "string") continue;
    const canonical = name.trim();
    if (!canonical || seen.has(canonical)) continue;
    if (isExcludedVendorFieldApiName(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
  }
  return result;
}

export function filterCatalogForRecordView(catalog: CrmFieldMeta[]): CrmFieldMeta[] {
  const byApi = new Map<string, CrmFieldMeta>();
  for (const field of catalog) {
    if (isExcludedVendorCatalogField(field)) continue;
    if (!byApi.has(field.apiName)) {
      byApi.set(field.apiName, {
        apiName: field.apiName,
        label: field.label || field.apiName.replace(/_/g, " "),
        dataType: field.dataType,
      });
    }
  }
  return [...byApi.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function parseStoredColumnList(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const normalized = normalizeVisibleApiNames(
      parsed.filter((item): item is string => typeof item === "string"),
    );
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

export function loadVisibleApiNames(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_VISIBLE_API_NAMES];
  const loaded = parseStoredColumnList(localStorage.getItem(VENDORS_COLUMNS_STORAGE_KEY));
  return loaded ?? [...DEFAULT_VISIBLE_API_NAMES];
}

export function saveVisibleApiNames(apiNames: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    VENDORS_COLUMNS_STORAGE_KEY,
    JSON.stringify(normalizeVisibleApiNames(apiNames)),
  );
}

export function buildFieldsQueryParam(visibleApiNames: string[]) {
  const set = new Set(["id", ...visibleApiNames]);
  return [...set].join(",");
}

export function parseVendorListFields(searchParams: URLSearchParams | { get: (key: string) => string | null }) {
  const raw = searchParams.get("fields");
  if (!raw?.trim()) return [...DEFAULT_VISIBLE_API_NAMES];
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((name) => name !== "id");
  const normalized = normalizeVisibleApiNames(names);
  return normalized.length > 0 ? normalized : [...DEFAULT_VISIBLE_API_NAMES];
}

export type VendorRecord = {
  id: string;
  fields: Record<string, string>;
  lookups?: Record<string, string>;
};

export function getVendorFieldDisplayValue(
  fields: Record<string, string>,
  apiName: string,
): string {
  return fields[apiName] ?? "";
}

export function isStatusField(apiName: string) {
  return apiName === "Status" || apiName === "Vendor_Status";
}

export function isUrlLikeField(apiName: string, dataType?: string) {
  if (dataType && /url|website|link/i.test(dataType)) return true;
  return /_url$/i.test(apiName) || /url|website/i.test(apiName);
}

export function looksLikeHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}
