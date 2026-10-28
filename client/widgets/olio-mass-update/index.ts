import type { CrmWidgetDefinition } from "@/widgets/types";

/** Button label in the contracts list selection toolbar. */
export const OLIO_MASS_UPDATE_BUTTON_LABEL = "Olio Mass Update" as const;

/** Widget modal title (matches the reference “Update Mass Records” screen). */
export const OLIO_MASS_UPDATE_WIDGET_NAME = "Update Mass Records" as const;

export const OLIO_MASS_UPDATE_WIDGET = {
  id: "olio-mass-update",
  name: OLIO_MASS_UPDATE_WIDGET_NAME,
  buttonLabel: OLIO_MASS_UPDATE_BUTTON_LABEL,
} as const satisfies CrmWidgetDefinition;

export type {
  MassUpdateFieldOption,
  OlioMassUpdatePayload,
  OlioMassUpdateResult,
} from "./types";

export {
  isMappedFileField,
  moduleUpdateHeading,
  supportsSubformEditor,
} from "./constants";

export { OlioMassUpdateWidget } from "./ui/OlioMassUpdateWidget";
