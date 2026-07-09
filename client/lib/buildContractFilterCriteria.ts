import { buildAndCriteria } from "@/lib/zohoSearchCriteria";
import type { ContractFieldFilterSelection } from "@/lib/contractFilterTypes";

export function buildCriteriaFromFieldFilters(
  selections: ContractFieldFilterSelection[],
): string | null {
  const clauses = selections
    .filter((s) => s.values.length > 0)
    .map((s) => {
      const operator =
        s.operator ||
        (s.values.length > 1 ? "in" : "equals");
      return { apiName: s.apiName, operator, values: s.values };
    });

  return buildAndCriteria(clauses);
}

/** @param {Map<string, Set<string>>} selectedByField */
export function selectionsFromCheckboxState(
  selectedByField: Map<string, Set<string>>,
): ContractFieldFilterSelection[] {
  const result: ContractFieldFilterSelection[] = [];
  for (const [apiName, valueSet] of selectedByField) {
    const values = [...valueSet];
    if (values.length === 0) continue;
    result.push({
      apiName,
      operator: values.length > 1 ? "in" : "equals",
      values,
    });
  }
  return result;
}
