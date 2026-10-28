/**
 * Telzio Mass SMS — port of Desktop/app Mass SMS widget.
 *
 * Legacy flow:
 *   1. PageLoad → getRecord → Vendor_Name + Phone
 *   2. Send → ZOHO.CRM.FUNCTIONS.execute("Vendor_Mass_SMS", { phoneNumber, message })
 */

import { executeZohoCrmFunction, fetchZohoJson, ZOHO_CRM_BASE } from "@/lib/zoho";
import {
  TELZIO_MASS_SMS_FUNCTION_NAME,
  type TelzioMassSmsPayload,
  type TelzioMassSmsRecipientsResult,
  type TelzioMassSmsResult,
  type TelzioMassSmsSendError,
  type TelzioSmsRecipient,
} from "@/widgets/vendor/telzio-mass-sms/types";

const MODULE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function assertModuleName(module: string) {
  if (!MODULE_NAME_PATTERN.test(module)) {
    throw new Error("Invalid CRM module.");
  }
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

function parseFunctionOutput(raw: unknown): unknown {
  if (raw == null) return raw;
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function asText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function functionErrorMessage(body: Record<string, unknown>, output: unknown) {
  const outputText = asText(output).trim();
  if (outputText) return outputText;
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message.trim();
  }
  const details = body.details as Record<string, unknown> | undefined;
  if (typeof details?.message === "string" && details.message.trim()) {
    return details.message.trim();
  }
  return "Failed to send SMS.";
}

async function fetchVendorsByIds(ids: string[]) {
  const fields = "id,Vendor_Name,Phone";
  const rows: Array<Record<string, unknown>> = [];

  // Zoho `ids=` accepts comma-separated lists; chunk to stay under URL limits.
  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const url =
      `${ZOHO_CRM_BASE}/Vendors` +
      `?ids=${encodeURIComponent(chunk.join(","))}` +
      `&fields=${encodeURIComponent(fields)}`;
    const { res, body } = await fetchZohoJson(url);
    if (!res.ok) {
      const detail = body?.message || body?.code || `HTTP ${res.status}`;
      throw new Error(`Unable to load vendors: ${String(detail)}`);
    }
    if (Array.isArray(body?.data)) {
      for (const row of body.data) {
        if (row && typeof row === "object") {
          rows.push(row as Record<string, unknown>);
        }
      }
    }
  }

  return rows;
}

export async function loadTelzioSmsRecipients(
  selectedRecordIds: string[],
  module = "Vendors",
): Promise<TelzioMassSmsRecipientsResult> {
  assertModuleName(module);
  if (module !== "Vendors") {
    return {
      ok: false,
      message: "Telzio Mass SMS is only available on Vendors.",
      recipients: [],
    };
  }

  const ids = uniqueIds(selectedRecordIds);
  if (ids.length === 0) {
    return {
      ok: false,
      message: "Select at least one vendor.",
      recipients: [],
    };
  }

  const rows = await fetchVendorsByIds(ids);
  const byId = new Map(
    rows.map((row) => [String(row.id ?? "").trim(), row] as const),
  );

  const recipients: TelzioSmsRecipient[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      skipped.push({ id, reason: "Vendor not found." });
      continue;
    }
    const name = String(row.Vendor_Name ?? "").trim() || "Unknown vendor";
    const phone = String(row.Phone ?? "").trim();
    if (!phone) {
      skipped.push({ id, reason: `${name} has no phone number.` });
      continue;
    }
    recipients.push({ id, name, phone });
  }

  if (recipients.length === 0) {
    return {
      ok: false,
      message:
        skipped[0]?.reason ||
        "No recipients with a phone number were found.",
      recipients: [],
      skipped,
    };
  }

  return { ok: true, recipients, skipped };
}

async function sendOneSms(phoneNumber: string, message: string) {
  const args = { phoneNumber, message };

  let { res, body } = await executeZohoCrmFunction(
    TELZIO_MASS_SMS_FUNCTION_NAME,
    args,
    { authType: "apikey" },
  );

  let code = String(body?.code ?? "").toUpperCase();
  if (
    !res.ok ||
    code === "NOT_ACTIVE" ||
    code === "AUTHENTICATION_FAILURE"
  ) {
    const fallback = await executeZohoCrmFunction(
      TELZIO_MASS_SMS_FUNCTION_NAME,
      args,
      { authType: "oauth" },
    );
    res = fallback.res;
    body = fallback.body;
    code = String(body?.code ?? "").toUpperCase();
  }

  const output = parseFunctionOutput(body?.details?.output);
  const codeLower = String(body?.code ?? "").toLowerCase();
  const status = String(body?.status ?? "").toLowerCase();

  // Legacy widget: funcRes.code === "success"
  if (codeLower === "failure" || status === "failure" || code === "FAILURE") {
    throw new Error(
      functionErrorMessage(body as Record<string, unknown>, output),
    );
  }

  const ok =
    res.ok &&
    (code === "SUCCESS" ||
      code === "" ||
      codeLower === "success" ||
      status === "success" ||
      body?.details?.output != null);

  if (!ok) {
    throw new Error(
      code === "NOT_ACTIVE"
        ? `Zoho function "${TELZIO_MASS_SMS_FUNCTION_NAME}" REST API is inactive.`
        : functionErrorMessage(body as Record<string, unknown>, output) ||
          `HTTP ${res.status}`,
    );
  }
}

/**
 * Load vendor phones for selected IDs, then call Vendor_Mass_SMS per recipient.
 */
export async function sendTelzioMassSms(
  payload: TelzioMassSmsPayload,
): Promise<TelzioMassSmsResult> {
  const message = String(payload.message ?? "").trim();
  if (!message) {
    return { ok: false, message: "Message cannot be empty." };
  }

  const loaded = await loadTelzioSmsRecipients(
    payload.selectedRecordIds ?? [],
    payload.module || "Vendors",
  );
  if (!loaded.ok || loaded.recipients.length === 0) {
    return {
      ok: false,
      message: loaded.message || "No recipients selected.",
      recipients: loaded.recipients,
      successCount: 0,
      failureCount: 0,
      errors: (loaded.skipped ?? []).map((item) => ({
        id: item.id,
        message: item.reason,
      })),
    };
  }

  const errors: TelzioMassSmsSendError[] = [];
  let successCount = 0;

  for (const recipient of loaded.recipients) {
    try {
      await sendOneSms(recipient.phone, message);
      successCount += 1;
    } catch (error) {
      errors.push({
        id: recipient.id,
        name: recipient.name,
        phone: recipient.phone,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failureCount = errors.length;
  const total = loaded.recipients.length;

  if (successCount === 0) {
    return {
      ok: false,
      message: errors[0]?.message || "Failed to send messages.",
      recipients: loaded.recipients,
      successCount,
      failureCount,
      errors,
    };
  }

  return {
    ok: true,
    message:
      failureCount === 0
        ? `Messages sent successfully to ${successCount} recipient${successCount === 1 ? "" : "s"}.`
        : `Sent to ${successCount} of ${total} recipients (${failureCount} failed).`,
    recipients: loaded.recipients,
    successCount,
    failureCount,
    errors,
  };
}
