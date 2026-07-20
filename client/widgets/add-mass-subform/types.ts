/** Min characters before SOW Item product search (legacy widget). */
export const ADD_MASS_SUBFORM_SEARCH_MIN_CHARS = 3;

/** Bulk CRM update batch size (legacy widget). */
export const ADD_MASS_SUBFORM_BULK_BATCH_SIZE = 100;

/**
 * Subform API name by CRM module — mirrors `getSubformFieldForEntity` in
 * widget_logic/index.js.
 */
export function getSubformFieldForModule(moduleName: string) {
  if (moduleName === "Deals") {
    return "Scope_of_Work";
  }
  if (moduleName === "Contracts") {
    return "Our_Services_SubForm";
  }
  return null;
}

/** @deprecated Prefer getSubformFieldForModule — kept for re-exports. */
export const ADD_MASS_SUBFORM_FIELD_API_NAME = "Our_Services_SubForm" as const;

export type AddMassSubformRow = {
  OurServices: string;
  serviceName?: string;
  Start_Date?: string;
  End_Date?: string;
  Invoice_Price?: string;
  Vendor_Price?: string;
};

export type AddMassSubformLookupOption = {
  value: string;
  label: string;
};

export type AddMassSubformPayload = {
  selectedRecordIds: string[];
  module?: string;
  rows: AddMassSubformRow[];
};

export type AddMassSubformRecordError = {
  id: string;
  message: string;
};

export type AddMassSubformResult = {
  ok: boolean;
  message?: string;
  totalRecords?: number;
  successCount?: number;
  failureCount?: number;
  errors?: AddMassSubformRecordError[];
};
