import type { CrmWidgetDefinition } from "@/widgets/types";

export const TELZIO_MASS_SMS_BUTTON_LABEL = "Telzio Mass SMS" as const;
export const TELZIO_MASS_SMS_WIDGET_NAME = "Mass SMS Widget" as const;

export const TELZIO_MASS_SMS_WIDGET = {
  id: "vendor-telzio-mass-sms",
  name: TELZIO_MASS_SMS_WIDGET_NAME,
  buttonLabel: TELZIO_MASS_SMS_BUTTON_LABEL,
} as const satisfies CrmWidgetDefinition;

export type {
  TelzioMassSmsPayload,
  TelzioMassSmsResult,
  TelzioSmsRecipient,
} from "./types";

export { TelzioMassSmsWidget } from "./ui/TelzioMassSmsWidget";
