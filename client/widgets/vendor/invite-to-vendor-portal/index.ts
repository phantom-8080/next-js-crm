import type { CrmWidgetDefinition } from "@/widgets/types";

export const INVITE_TO_VENDOR_PORTAL_BUTTON_LABEL = "Invite to Vendor Portal" as const;
export const INVITE_TO_VENDOR_PORTAL_WIDGET_NAME = "Invite to Vendor Portal" as const;

export const INVITE_TO_VENDOR_PORTAL_WIDGET = {
  id: "vendor-invite-to-vendor-portal",
  name: INVITE_TO_VENDOR_PORTAL_WIDGET_NAME,
  buttonLabel: INVITE_TO_VENDOR_PORTAL_BUTTON_LABEL,
} as const satisfies CrmWidgetDefinition;

export type {
  InviteToVendorPortalPayload,
  InviteToVendorPortalResult,
} from "./types";

export { InviteToVendorPortalWidget } from "./ui/InviteToVendorPortalWidget";
