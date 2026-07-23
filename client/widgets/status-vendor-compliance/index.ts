import type { CrmWidgetDefinition } from "@/widgets/types";
import {
  STATUS_VENDOR_COMPLIANCE_BUTTON_LABEL,
  STATUS_VENDOR_COMPLIANCE_WIDGET_NAME,
} from "@/widgets/status-vendor-compliance/types";

export {
  STATUS_VENDOR_COMPLIANCE_BUTTON_LABEL,
  STATUS_VENDOR_COMPLIANCE_WIDGET_NAME,
  TRANSITION_LABEL_ACTIVATE_VENDOR,
  STATUS_ACTIVE,
} from "./types";

export type {
  StatusVendorComplianceLoadResult,
  StatusVendorComplianceSavePayload,
  StatusVendorComplianceSaveResult,
  VendorComplianceForm,
} from "./types";

export const STATUS_VENDOR_COMPLIANCE_WIDGET = {
  id: "status-vendor-compliance",
  name: STATUS_VENDOR_COMPLIANCE_WIDGET_NAME,
  buttonLabel: STATUS_VENDOR_COMPLIANCE_BUTTON_LABEL,
} as const satisfies CrmWidgetDefinition;

export { StatusVendorComplianceWidget } from "./ui/StatusVendorComplianceWidget";
