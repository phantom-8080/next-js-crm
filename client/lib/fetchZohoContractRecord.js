import { fetchZohoJson, ZOHO_CRM_BASE } from "@/lib/zoho";

const FIELDS_PER_REQUEST = 45;

function chunkApiNames(apiNames, size) {
  const chunks = [];
  for (let i = 0; i < apiNames.length; i += size) {
    chunks.push(apiNames.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetches a Zoho Contracts record, batching the `fields` query to avoid URL length limits (413).
 * @param {string} recordId
 * @param {string[]} apiNames CRM field API names (without id)
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchZohoContractRecordById(recordId, apiNames) {
  let unique = [...new Set(apiNames.filter(Boolean))];
  if (unique.length === 0) {
    unique = ["Name"];
  }

  const groups = chunkApiNames(unique, FIELDS_PER_REQUEST);
  let merged = null;

  for (const group of groups) {
    const fieldSet = new Set(["id", ...group]);
    const zohoFields = [...fieldSet].join(",");
    const recordUrl = `${ZOHO_CRM_BASE}/Contracts/${encodeURIComponent(recordId)}?fields=${encodeURIComponent(zohoFields)}`;

    const { res, body } = await fetchZohoJson(recordUrl);

    if (!res.ok) {
      const err = new Error("Zoho CRM error");
      err.status = res.status;
      err.details = body;
      throw err;
    }

    const row = Array.isArray(body.data) ? body.data[0] : null;
    if (!row) {
      const err = new Error("Contract not found");
      err.status = 404;
      throw err;
    }

    merged = merged ? { ...merged, ...row } : { ...row };
  }

  if (!merged) {
    const err = new Error("Contract not found");
    err.status = 404;
    throw err;
  }

  return merged;
}
