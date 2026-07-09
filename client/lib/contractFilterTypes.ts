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
  /** Subform block title in CRM (e.g. Scope of Work Form). */
  groupLabel?: string;
  /** Zoho custom view id for system-defined list filters. */
  customViewId?: string;
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
};
