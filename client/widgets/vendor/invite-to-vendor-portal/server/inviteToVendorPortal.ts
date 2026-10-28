/**
 * Invite to Vendor Portal — port of Desktop/app invite widget.
 *
 * Legacy flow:
 *   ZOHO.CRM.FUNCTIONS.execute("createVendor", { ids: EntityId })
 *   then parse details.output for:
 *     - Records invited = N
 *     - Found Duplicate = N
 *     - "id":"reason" pairs
 */

import { executeZohoCrmFunction } from "@/lib/zoho";
import {
  INVITE_TO_VENDOR_PORTAL_FUNCTION_NAME,
  type InviteFailedRecord,
  type InviteToVendorPortalPayload,
  type InviteToVendorPortalResult,
} from "@/widgets/vendor/invite-to-vendor-portal/types";

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
  return "There was an error processing your request.";
}

/**
 * Parse legacy Deluge string output the same way widget.html does.
 */
export function parseInviteOutput(outputRaw: unknown): {
  invitedCount: number | null;
  duplicateCount: number | null;
  failedRecords: InviteFailedRecord[];
  outputText: string;
} {
  const outputText = asText(outputRaw);
  const invitedMatch = outputText.match(/Records invited = (\d+)/i);
  const duplicateMatch = outputText.match(/Found Duplicate = (\d+)/i);
  const failedMatches = outputText.match(/"(\d+)":"(.*?)"/g) ?? [];

  const failedRecords: InviteFailedRecord[] = failedMatches.map((record) => {
    const parts = record.split(":");
    const id = (parts[0] ?? "").replace(/"/g, "").trim();
    const reason = parts
      .slice(1)
      .join(":")
      .replace(/"/g, "")
      .trim();
    return { id, reason: reason || "Duplicate" };
  });

  return {
    invitedCount: invitedMatch ? Number(invitedMatch[1]) : null,
    duplicateCount: duplicateMatch ? Number(duplicateMatch[1]) : null,
    failedRecords,
    outputText,
  };
}

export async function inviteVendorsToPortal(
  payload: InviteToVendorPortalPayload,
): Promise<InviteToVendorPortalResult> {
  const moduleName = String(payload.module || "Vendors").trim() || "Vendors";
  if (moduleName !== "Vendors") {
    return {
      ok: false,
      message: "Invite to Vendor Portal is only available on Vendors.",
    };
  }

  const ids = uniqueIds(payload.selectedRecordIds ?? []);
  if (ids.length === 0) {
    return { ok: false, message: "Select at least one vendor." };
  }

  // Match Zoho embedded widget: EntityId is passed as `ids`.
  const args = { ids };

  let { res, body } = await executeZohoCrmFunction(
    INVITE_TO_VENDOR_PORTAL_FUNCTION_NAME,
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
      INVITE_TO_VENDOR_PORTAL_FUNCTION_NAME,
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

  // Legacy widget: data.code === "success"
  if (codeLower === "failure" || status === "failure" || code === "FAILURE") {
    return {
      ok: false,
      message: functionErrorMessage(body as Record<string, unknown>, output),
      output,
    };
  }

  const ok =
    res.ok &&
    (code === "SUCCESS" ||
      code === "" ||
      codeLower === "success" ||
      status === "success" ||
      body?.details?.output != null);

  if (!ok) {
    return {
      ok: false,
      message:
        code === "NOT_ACTIVE"
          ? `Zoho function "${INVITE_TO_VENDOR_PORTAL_FUNCTION_NAME}" REST API is inactive.`
          : functionErrorMessage(body as Record<string, unknown>, output) ||
            `HTTP ${res.status}`,
      output,
    };
  }

  const parsed = parseInviteOutput(output);
  const invitedCount = parsed.invitedCount ?? 0;
  const duplicateCount = parsed.duplicateCount ?? 0;

  const parts: string[] = [];
  if (parsed.invitedCount != null) {
    parts.push(
      `${invitedCount} record${invitedCount === 1 ? "" : "s"} invited.`,
    );
  }
  if (duplicateCount > 0) {
    parts.push(
      `${duplicateCount} record${duplicateCount === 1 ? "" : "s"} failed due to duplication.`,
    );
  }

  return {
    ok: true,
    message:
      parts.length > 0
        ? parts.join(" ")
        : parsed.outputText || "Invite completed.",
    invitedCount: parsed.invitedCount ?? undefined,
    duplicateCount: parsed.duplicateCount ?? undefined,
    failedRecords:
      parsed.failedRecords.length > 0 ? parsed.failedRecords : undefined,
    output,
  };
}
