import type { CrmWidgetDefinition } from "@/widgets/types";
import { INVITE_TO_VENDOR_PORTAL_WIDGET } from "@/widgets/vendor/invite-to-vendor-portal";
import { VENDOR_OLIO_MASS_UPDATE_WIDGET } from "@/widgets/vendor/olio-mass-update";
import { TELZIO_MASS_SMS_WIDGET } from "@/widgets/vendor/telzio-mass-sms";

/** Vendor list-action widgets (stub buttons for now — no Zoho “test” buttons). */
export const VENDOR_WIDGETS = [
  INVITE_TO_VENDOR_PORTAL_WIDGET,
  VENDOR_OLIO_MASS_UPDATE_WIDGET,
  TELZIO_MASS_SMS_WIDGET,
] as const satisfies readonly CrmWidgetDefinition[];

export {
  INVITE_TO_VENDOR_PORTAL_BUTTON_LABEL,
  INVITE_TO_VENDOR_PORTAL_WIDGET,
  INVITE_TO_VENDOR_PORTAL_WIDGET_NAME,
  InviteToVendorPortalWidget,
} from "@/widgets/vendor/invite-to-vendor-portal";
export {
  VENDOR_OLIO_MASS_UPDATE_BUTTON_LABEL,
  VENDOR_OLIO_MASS_UPDATE_WIDGET,
  VENDOR_OLIO_MASS_UPDATE_WIDGET_NAME,
  VendorOlioMassUpdateWidget,
} from "@/widgets/vendor/olio-mass-update";
export {
  TELZIO_MASS_SMS_BUTTON_LABEL,
  TELZIO_MASS_SMS_WIDGET,
  TELZIO_MASS_SMS_WIDGET_NAME,
  TelzioMassSmsWidget,
} from "@/widgets/vendor/telzio-mass-sms";
