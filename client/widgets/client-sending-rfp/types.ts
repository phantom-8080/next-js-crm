/** Button label on the contract record view (matches Zoho menu). */
export const CLIENT_SENDING_RFP_BUTTON_LABEL =
  "Status Client Sending RFP" as const;

/** Widget modal title (matches widget.html). */
export const CLIENT_SENDING_RFP_WIDGET_NAME = "Client Sending RFP" as const;

export const TRANSITION_LABEL_SOURCING = "Sourcing" as const;
export const STATUS_SOURCING_VENDOR = "Sourcing Vendor" as const;
export const STATUS_PENDING_SALES_REVIEW = "Pending Sales Review" as const;

export type ClientSendingRfpSiteSuggestion = {
  id: string;
  name: string;
};

export type ClientSendingRfpLoadResult = {
  ok: boolean;
  message?: string;
  contractId?: string;
  contractName?: string;
  currentStatus?: string;
  siteId?: string;
  siteName?: string;
  siteStreet?: string;
  siteCity?: string;
  siteState?: string;
  siteZip?: string;
};

export type ClientSendingRfpSiteDetailsResult = {
  ok: boolean;
  message?: string;
  siteStreet?: string;
  siteCity?: string;
  siteState?: string;
  siteZip?: string;
};

export type ClientSendingRfpSearchResult = {
  ok: boolean;
  message?: string;
  sites?: ClientSendingRfpSiteSuggestion[];
};

export type ClientSendingRfpSavePayload = {
  contractId: string;
  siteId: string;
  siteStreet: string;
  siteCity: string;
  siteState: string;
  siteZip: string;
};

export type ClientSendingRfpSaveResult = {
  ok: boolean;
  message?: string;
  finalStatus?: string;
  hadBids?: boolean;
};
