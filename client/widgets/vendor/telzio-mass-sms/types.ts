/** Zoho CRM custom function used by the legacy Mass SMS widget. */
export const TELZIO_MASS_SMS_FUNCTION_NAME = "Vendor_Mass_SMS" as const;

export type TelzioSmsRecipient = {
  id: string;
  name: string;
  phone: string;
};

export type TelzioMassSmsPayload = {
  selectedRecordIds: string[];
  message: string;
  module?: string;
};

export type TelzioMassSmsSendError = {
  id: string;
  name?: string;
  phone?: string;
  message: string;
};

export type TelzioMassSmsResult = {
  ok: boolean;
  message?: string;
  recipients?: TelzioSmsRecipient[];
  successCount?: number;
  failureCount?: number;
  errors?: TelzioMassSmsSendError[];
};

export type TelzioMassSmsRecipientsResult = {
  ok: boolean;
  message?: string;
  recipients: TelzioSmsRecipient[];
  skipped?: Array<{ id: string; reason: string }>;
};
