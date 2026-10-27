/** Zoho CRM standalone function API name (REST). */
export const CONTRACT_LIST_BULK_UPDATE_FUNCTION_NAME =
  "contract_list_bulk_update" as const;

export type ContractListBulkUpdatePayload = {
  /** Contract record IDs to update. */
  recordIds: string[];
  /** Contracts field API name, e.g. Site_Street or Vendor. */
  fieldApiName: string;
  /**
   * Value sent to Deluge as text.
   * Lookups/userlookups: prefer related record ID.
   * Booleans: "true" / "false".
   */
  fieldValue: string;
  /** Zoho field data_type (Deluge also re-reads metadata). */
  fieldType: string;
};

export type ContractListBulkUpdateResult = {
  ok: boolean;
  message?: string;
  output?: unknown;
};
