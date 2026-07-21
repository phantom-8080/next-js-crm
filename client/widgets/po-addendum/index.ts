import type { CrmWidgetDefinition } from "@/widgets/types";

export const PO_ADDENDUM_BUTTON_LABEL = "PO Addendum" as const;

export const PO_ADDENDUM_WIDGET_NAME = "PO Addendum" as const;

export const PO_ADDENDUM_WIDGET = {
  id: "po-addendum",
  name: PO_ADDENDUM_WIDGET_NAME,
  buttonLabel: PO_ADDENDUM_BUTTON_LABEL,
} as const satisfies CrmWidgetDefinition;

export { PoAddendumWidget } from "./ui/PoAddendumWidget";
