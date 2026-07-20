import type { CrmWidgetDefinition } from "@/widgets/types";

/** Button label in the contracts list selection toolbar. */
export const ADD_MASS_SUBFORM_BUTTON_LABEL = "Add SubForm" as const;

/** Widget modal title (matches the reference “Add SubForm Contracts” screen). */
export const ADD_MASS_SUBFORM_WIDGET_NAME = "Add SubForm Contracts" as const;

export const ADD_MASS_SUBFORM_WIDGET = {
  id: "add-mass-subform",
  name: ADD_MASS_SUBFORM_WIDGET_NAME,
  buttonLabel: ADD_MASS_SUBFORM_BUTTON_LABEL,
} as const satisfies CrmWidgetDefinition;

export type {
  AddMassSubformPayload,
  AddMassSubformResult,
  AddMassSubformRow,
} from "./types";

export {
  ADD_MASS_SUBFORM_FIELD_API_NAME,
  ADD_MASS_SUBFORM_SEARCH_MIN_CHARS,
  getSubformFieldForModule,
} from "./types";

export { AddMassSubformWidget } from "./ui/AddMassSubformWidget";
