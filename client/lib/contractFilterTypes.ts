export type ContractFilterOption = {
  value: string;
  label: string;
};

export type ContractFilterOperator = {
  id: string;
  label: string;
};

export type ContractFilterSectionId =
  | "system_defined"
  | "fields"
  | "subforms"
  | "related_modules";

export type ContractFilterFieldMeta = {
  apiName: string;
  label: string;
  dataType: string;
  operators: ContractFilterOperator[];
  options: ContractFilterOption[];
  hasOptions: boolean;
  section: ContractFilterSectionId;
  /** Subform block title / custom-view category (e.g. Created By Me). */
  groupLabel?: string;
  /** Zoho custom view id for list filters (cvid). */
  customViewId?: string;
  /** Related Zoho module API name for lookup fields (suggestions). */
  lookupModule?: string;
  /** Zoho custom view marked as favorite. */
  favorite?: boolean;
  /** Zoho default custom view for the module. */
  defaultView?: boolean;
  /** Zoho system-defined custom view (not user-deletable). */
  systemDefined?: boolean;
};

export type ContractFilterSection = {
  id: ContractFilterSectionId;
  title: string;
  fields: ContractFilterFieldMeta[];
};

/** One active filter row in the sidebar (picklist / layout multi-select). */
export type ContractFieldFilterSelection = {
  apiName: string;
  operator: string;
  values: string[];
};

export type ContractFilterApplyPayload = {
  criteria: string | null;
  customViewId: string | null;
  /** Client-side list filtering (service completions static demo). */
  fieldSelections?: ContractFieldFilterSelection[];
};
