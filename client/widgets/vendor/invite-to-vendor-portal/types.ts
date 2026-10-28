/** Zoho CRM custom function used by the legacy invite-to-portal widget. */
export const INVITE_TO_VENDOR_PORTAL_FUNCTION_NAME = "createVendor" as const;

export type InviteToVendorPortalPayload = {
  selectedRecordIds: string[];
  module?: string;
};

export type InviteFailedRecord = {
  id: string;
  reason: string;
};

export type InviteToVendorPortalResult = {
  ok: boolean;
  message?: string;
  /** Parsed from `Records invited = N`. */
  invitedCount?: number;
  /** Parsed from `Found Duplicate = N`. */
  duplicateCount?: number;
  failedRecords?: InviteFailedRecord[];
  /** Raw Zoho function output when available. */
  output?: unknown;
};
