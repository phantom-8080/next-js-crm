/**
 * Known lookup fields → related Zoho module (hints, not an allowlist).
 * @type {Record<string, { kind: "lookup" | "user" | "layout"; module?: string; searchFields?: string[] }>}
 */
export const KNOWN_LOOKUP_FILTER_FIELDS = {
  Vendor: { kind: "lookup", module: "Vendors", searchFields: ["Name", "Vendor_Name"] },
  // Zoho Contracts.Site is an Accounts lookup (site/location account), not a Sites module.
  Site: { kind: "lookup", module: "Accounts", searchFields: ["Account_Name", "Name"] },
  Company_Name: { kind: "lookup", module: "Accounts", searchFields: ["Account_Name", "Name"] },
  SOW_Name: { kind: "lookup", module: "Deals", searchFields: ["SOWID", "Deal_Name", "Name"] },
  SOW: { kind: "lookup", module: "Deals", searchFields: ["SOWID", "Deal_Name", "Name"] },
  Owner: { kind: "user" },
  Contract_Owner: { kind: "user" },
  Ops_Owner: { kind: "user" },
  Sales_Owner: { kind: "user" },
  Sales_Manager: { kind: "user" },
  Sales_Associate: { kind: "user" },
  Operations_Manager: { kind: "user" },
  Layout: { kind: "layout" },
};

/** @param {string} value */
export function looksLikeZohoId(value) {
  return /^\d{6,}$/.test(String(value ?? "").trim());
}

/**
 * @param {string} apiName
 * @returns {{ kind: "lookup" | "user" | "layout"; module?: string; searchFields?: string[] } | null}
 */
export function getKnownLookupFieldConfig(apiName) {
  const key = String(apiName ?? "").trim();
  return KNOWN_LOOKUP_FILTER_FIELDS[key] ?? null;
}

/**
 * @param {string} dataType
 */
export function isLookupLikeDataType(dataType) {
  const type = String(dataType ?? "").toLowerCase();
  return (
    type === "lookup" ||
    type === "ownerlookup" ||
    type === "userlookup" ||
    type === "multiselectlookup" ||
    type === "multiuserlookup"
  );
}

/**
 * @param {string} dataType
 */
export function isUserLikeDataType(dataType) {
  const type = String(dataType ?? "").toLowerCase();
  return type === "ownerlookup" || type === "userlookup" || type === "multiuserlookup";
}

/**
 * Zoho Search API does not support multi-user lookup fields (e.g. Contracts.Ops_Owner).
 * Map those filters onto the searchable single-user field that holds the same role data.
 * @param {string} apiName
 * @param {string} [dataType]
 * @param {string} [module]
 */
export function criteriaApiNameForFilterField(apiName, dataType = "", module = "") {
  const name = String(apiName ?? "").trim();
  const type = String(dataType ?? "").toLowerCase();
  const mod = String(module ?? "").trim();

  if (
    (mod === "Contracts" || !mod) &&
    name === "Ops_Owner" &&
    (type === "multiuserlookup" || type === "")
  ) {
    return "Operations_Manager";
  }

  return name;
}
