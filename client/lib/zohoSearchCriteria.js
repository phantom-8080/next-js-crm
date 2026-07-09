/**
 * Escape a criterion value for Zoho Search API (parentheses, comma, backslash).
 * @param {string} value
 */
export function escapeZohoCriteriaValue(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * @param {string} apiName
 * @param {string} operator
 * @param {string[]} values
 */
export function buildFieldCriterion(apiName, operator, values) {
  const cleaned = values.map((v) => String(v).trim()).filter(Boolean);
  if (!apiName || cleaned.length === 0) return null;

  const op = operator || "equals";

  if (op === "between") {
    if (cleaned.length < 2) return null;
    const a = escapeZohoCriteriaValue(cleaned[0]);
    const b = escapeZohoCriteriaValue(cleaned[1]);
    return `(${apiName}:between:${a},${b})`;
  }

  if (op === "in") {
    const joined = cleaned.map(escapeZohoCriteriaValue).join(",");
    return `(${apiName}:in:${joined})`;
  }

  const single = escapeZohoCriteriaValue(cleaned[0]);
  return `(${apiName}:${op}:${single})`;
}

/**
 * @param {{ apiName: string; operator: string; values: string[] }[]} clauses
 * @returns {string | null}
 */
export function buildAndCriteria(clauses) {
  const parts = clauses
    .map((c) => buildFieldCriterion(c.apiName, c.operator, c.values))
    .filter(Boolean);

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return parts.map((p) => `(${p})`).join("and");
}
