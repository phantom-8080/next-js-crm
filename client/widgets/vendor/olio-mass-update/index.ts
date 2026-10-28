import type { CrmWidgetDefinition } from "@/widgets/types";

export const VENDOR_OLIO_MASS_UPDATE_BUTTON_LABEL = "Olio Mass Update" as const;
export const VENDOR_OLIO_MASS_UPDATE_WIDGET_NAME = "Olio Mass Update" as const;

export const VENDOR_OLIO_MASS_UPDATE_WIDGET = {
  id: "vendor-olio-mass-update",
  name: VENDOR_OLIO_MASS_UPDATE_WIDGET_NAME,
  buttonLabel: VENDOR_OLIO_MASS_UPDATE_BUTTON_LABEL,
} as const satisfies CrmWidgetDefinition;

export { VendorOlioMassUpdateWidget } from "./ui/VendorOlioMassUpdateWidget";
