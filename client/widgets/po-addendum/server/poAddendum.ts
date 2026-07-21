/**
 * PO Addendum — load/save JSON grid on Contracts.PO_Addendum.
 */

import { fetchZohoJson, fetchZohoRecordById, ZOHO_CRM_BASE } from "@/lib/zoho";

export const PO_ADDENDUM_FIELD = "PO_Addendum" as const;

export async function loadPoAddendumRecord(recordId: string, moduleName = "Contracts") {
  const id = String(recordId ?? "").trim();
  const mod = String(moduleName ?? "Contracts").trim() || "Contracts";
  if (!id) throw new Error("Record id is required.");

  const row = await fetchZohoRecordById(mod, id, ["Name", PO_ADDENDUM_FIELD]);
  return { data: [row] };
}

export async function savePoAddendum(payload: {
  recordId: string;
  moduleName?: string;
  poAddendum: string;
}) {
  const id = String(payload.recordId ?? "").trim();
  const mod = String(payload.moduleName ?? "Contracts").trim() || "Contracts";
  const value = String(payload.poAddendum ?? "");

  if (!id) throw new Error("Record id is required.");

  const { res, body } = await fetchZohoJson(
    `${ZOHO_CRM_BASE}/${encodeURIComponent(mod)}`,
    {
      method: "PUT",
      body: {
        data: [{ id, [PO_ADDENDUM_FIELD]: value }],
        trigger: ["workflow"],
      },
    },
  );

  const result = Array.isArray(body?.data) ? body.data[0] : null;
  const code = String(result?.code ?? body?.code ?? "").toUpperCase();
  const ok =
    Boolean(res.ok) &&
    (code === "SUCCESS" || Boolean(result?.details?.id) || code === "");

  if (!ok) {
    const detail =
      result?.message ||
      body?.message ||
      result?.code ||
      body?.code ||
      `HTTP ${res.status}`;
    throw new Error(String(detail));
  }

  // Shape similar to Zoho CRM.API.updateRecord for the HTML widget
  return {
    data: [result],
    details: result?.details ?? { id },
  };
}
