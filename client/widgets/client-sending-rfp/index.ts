import type { CrmWidgetDefinition } from "@/widgets/types";
import {
  CLIENT_SENDING_RFP_BUTTON_LABEL,
  CLIENT_SENDING_RFP_WIDGET_NAME,
} from "@/widgets/client-sending-rfp/types";

export {
  CLIENT_SENDING_RFP_BUTTON_LABEL,
  CLIENT_SENDING_RFP_WIDGET_NAME,
  TRANSITION_LABEL_SOURCING,
  STATUS_SOURCING_VENDOR,
  STATUS_PENDING_SALES_REVIEW,
} from "./types";

export type {
  ClientSendingRfpLoadResult,
  ClientSendingRfpSavePayload,
  ClientSendingRfpSaveResult,
  ClientSendingRfpSearchResult,
  ClientSendingRfpSiteDetailsResult,
  ClientSendingRfpSiteSuggestion,
} from "./types";

export const CLIENT_SENDING_RFP_WIDGET = {
  id: "client-sending-rfp",
  name: CLIENT_SENDING_RFP_WIDGET_NAME,
  buttonLabel: CLIENT_SENDING_RFP_BUTTON_LABEL,
} as const satisfies CrmWidgetDefinition;

export { ClientSendingRfpWidget } from "./ui/ClientSendingRfpWidget";
