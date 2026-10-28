import {
  getVendorFieldDisplayValue,
  isDateLikeField,
  type VendorRecord,
} from "@/lib/vendors/columns";

export type ColumnSortDirection = "asc" | "desc";

export type ColumnSortState = {
  apiName: string;
  direction: ColumnSortDirection;
};

export const ZOHO_API_SORTABLE_FIELDS = new Set([
  "id",
  "Created_Time",
  "Modified_Time",
]);

export function isZohoApiSortableField(apiName: string) {
  return ZOHO_API_SORTABLE_FIELDS.has(apiName);
}

function isNumericDataType(dataType?: string) {
  const type = String(dataType ?? "").toLowerCase();
  return (
    type === "integer" ||
    type === "bigint" ||
    type === "double" ||
    type === "currency" ||
    type === "percent" ||
    type === "autonumber"
  );
}

function isBooleanDataType(dataType?: string) {
  const type = String(dataType ?? "").toLowerCase();
  return type === "boolean" || type === "checkbox";
}

export function canSortColumn(apiName: string, dataType?: string) {
  void apiName;
  const type = String(dataType ?? "").toLowerCase();
  if (type === "subform" || type === "fileupload" || type === "imageupload") {
    return false;
  }
  return true;
}

function compareSortValues(
  left: string,
  right: string,
  dataType?: string,
  apiName = "",
): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  if (isBooleanDataType(dataType)) {
    const lb = /^(true|yes|1)$/i.test(left) ? 1 : 0;
    const rb = /^(true|yes|1)$/i.test(right) ? 1 : 0;
    return lb - rb;
  }

  if (isNumericDataType(dataType)) {
    const ln = Number(String(left).replace(/[^0-9.-]/g, ""));
    const rn = Number(String(right).replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(ln) && !Number.isNaN(rn)) return ln - rn;
  }

  if (isDateLikeField(apiName, dataType)) {
    const ld = Date.parse(left);
    const rd = Date.parse(right);
    if (!Number.isNaN(ld) && !Number.isNaN(rd)) return ld - rd;
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function sortVendorRecords(
  records: VendorRecord[],
  sort: ColumnSortState | null,
  dataTypeByApiName: Map<string, string> | Record<string, string>,
): VendorRecord[] {
  if (!sort) return records;

  const dataType =
    dataTypeByApiName instanceof Map ?
      dataTypeByApiName.get(sort.apiName)
    : dataTypeByApiName[sort.apiName];

  const factor = sort.direction === "desc" ? -1 : 1;
  return [...records].sort((a, b) => {
    const left = getVendorFieldDisplayValue(a.fields, sort.apiName);
    const right = getVendorFieldDisplayValue(b.fields, sort.apiName);
    return factor * compareSortValues(left, right, dataType, sort.apiName);
  });
}
