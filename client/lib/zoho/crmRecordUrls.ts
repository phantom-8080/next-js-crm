/**
 * Zoho CRM record deep-link bases (`crm.zoho.com/.../tab/{module_name}/{id}`).
 * `module_name` comes from Zoho settings/modules (not the API name).
 */

const ZOHO_CRM_ORG = "oliogroup" as const;

function zohoTabUrl(moduleName: string) {
  return `https://crm.zoho.com/crm/${ZOHO_CRM_ORG}/tab/${moduleName}` as const;
}

/** Contracts → CustomModule1 in oliogroup. */
export const CONTRACT_ZOHO_RECORD_URL = zohoTabUrl("CustomModule1");

/** Vendors (standard module). */
export const VENDOR_ZOHO_RECORD_URL = zohoTabUrl("Vendors");

/** SOW → Deals module in oliogroup. */
export const SOW_ZOHO_RECORD_URL = zohoTabUrl("Deals");

/** Service Completions → CustomModule14. */
export const SERVICE_COMPLETION_ZOHO_RECORD_URL = zohoTabUrl("CustomModule14");

function recordUrl(base: string, recordId: string) {
  return `${base}/${encodeURIComponent(recordId.trim())}`;
}

export function getContractZohoRecordUrl(recordId: string) {
  return recordUrl(CONTRACT_ZOHO_RECORD_URL, recordId);
}

export function getVendorZohoRecordUrl(recordId: string) {
  return recordUrl(VENDOR_ZOHO_RECORD_URL, recordId);
}

export function getSowZohoRecordUrl(recordId: string) {
  return recordUrl(SOW_ZOHO_RECORD_URL, recordId);
}
