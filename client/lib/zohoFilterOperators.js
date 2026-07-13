/** @typedef {{ id: string; label: string }} FilterOperator */

/** @type {Record<string, FilterOperator[]>} */
const OPERATORS_BY_DATA_TYPE = {
  picklist: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  multiselectpicklist: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  layout: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  text: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "starts_with", label: "starts with" },
    { id: "in", label: "is any of" },
  ],
  email: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "starts_with", label: "starts with" },
  ],
  phone: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "starts_with", label: "starts with" },
  ],
  website: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "starts_with", label: "starts with" },
  ],
  boolean: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
  ],
  integer: [
    { id: "equals", label: "=" },
    { id: "not_equal", label: "≠" },
    { id: "greater_than", label: ">" },
    { id: "greater_equal", label: "≥" },
    { id: "less_than", label: "<" },
    { id: "less_equal", label: "≤" },
    { id: "between", label: "between" },
  ],
  bigint: [
    { id: "equals", label: "=" },
    { id: "not_equal", label: "≠" },
    { id: "greater_than", label: ">" },
    { id: "greater_equal", label: "≥" },
    { id: "less_than", label: "<" },
    { id: "less_equal", label: "≤" },
    { id: "between", label: "between" },
  ],
  double: [
    { id: "equals", label: "=" },
    { id: "not_equal", label: "≠" },
    { id: "greater_than", label: ">" },
    { id: "greater_equal", label: "≥" },
    { id: "less_than", label: "<" },
    { id: "less_equal", label: "≤" },
    { id: "between", label: "between" },
  ],
  currency: [
    { id: "equals", label: "=" },
    { id: "not_equal", label: "≠" },
    { id: "greater_than", label: ">" },
    { id: "greater_equal", label: "≥" },
    { id: "less_than", label: "<" },
    { id: "less_equal", label: "≤" },
    { id: "between", label: "between" },
  ],
  percent: [
    { id: "equals", label: "=" },
    { id: "not_equal", label: "≠" },
    { id: "greater_than", label: ">" },
    { id: "greater_equal", label: "≥" },
    { id: "less_than", label: "<" },
    { id: "less_equal", label: "≤" },
    { id: "between", label: "between" },
  ],
  date: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "greater_equal", label: "on or after" },
    { id: "less_equal", label: "on or before" },
    { id: "between", label: "between" },
  ],
  datetime: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "greater_equal", label: "on or after" },
    { id: "less_equal", label: "on or before" },
    { id: "between", label: "between" },
  ],
  ownerlookup: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  userlookup: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  multiuserlookup: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
  lookup: [
    { id: "equals", label: "is" },
    { id: "not_equal", label: "is not" },
    { id: "in", label: "is any of" },
  ],
};

const DEFAULT_OPERATORS = [
  { id: "equals", label: "is" },
  { id: "not_equal", label: "is not" },
];

/** @param {string} dataType */
export function getOperatorsForDataType(dataType) {
  const key = String(dataType ?? "text").toLowerCase();
  return OPERATORS_BY_DATA_TYPE[key] ?? DEFAULT_OPERATORS;
}
