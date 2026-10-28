import { ZOHO_VENDORS_MODULE } from "@/lib/vendors/columns";
import { fetchZohoJson, ZOHO_CRM_BASE } from "@/lib/zoho";

/**
 * POST /api/vendors/delete
 * Body: { ids: string[] }
 * Deletes Vendor records in Zoho CRM.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = [
    ...new Set(
      (Array.isArray(body?.ids) ? body.ids : [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean),
    ),
  ];

  if (ids.length === 0) {
    return Response.json({ ok: false, error: "Select at least one vendor." }, { status: 400 });
  }

  /** @type {string[]} */
  const deletedIds = [];
  /** @type {{ id: string; message: string }[]} */
  const failures = [];

  // Zoho accepts comma-separated ids; batch to stay within URL limits.
  const BATCH = 100;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const url = `${ZOHO_CRM_BASE}/${encodeURIComponent(ZOHO_VENDORS_MODULE)}?ids=${encodeURIComponent(batch.join(","))}`;

    try {
      const { res, body: zohoBody } = await fetchZohoJson(url, { method: "DELETE" });
      const rows = Array.isArray(zohoBody?.data) ? zohoBody.data : [];

      if (!res.ok && rows.length === 0) {
        const message =
          zohoBody?.message ||
          zohoBody?.code ||
          `Zoho delete failed (HTTP ${res.status})`;
        for (const id of batch) {
          failures.push({ id, message: String(message) });
        }
        continue;
      }

      for (let index = 0; index < batch.length; index += 1) {
        const id = batch[index];
        const row = rows[index];
        const status = String(row?.status ?? "").toLowerCase();
        const code = String(row?.code ?? "").toUpperCase();
        if (status === "success" || code === "SUCCESS") {
          deletedIds.push(id);
        } else {
          failures.push({
            id,
            message: String(row?.message ?? zohoBody?.message ?? "Failed to delete vendor"),
          });
        }
      }

      // If Zoho returned ok with no per-row payload, treat the whole batch as deleted.
      if (res.ok && rows.length === 0) {
        deletedIds.push(...batch);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reach Zoho CRM";
      for (const id of batch) {
        failures.push({ id, message });
      }
    }
  }

  const ok = deletedIds.length > 0 && failures.length === 0;
  const partial = deletedIds.length > 0 && failures.length > 0;

  return Response.json(
    {
      ok: ok || partial,
      deletedIds,
      failures,
      deletedCount: deletedIds.length,
      message:
        ok ? `Deleted ${deletedIds.length} vendor${deletedIds.length === 1 ? "" : "s"}.`
        : partial ?
          `Deleted ${deletedIds.length}, failed ${failures.length}.`
        : failures[0]?.message || "Failed to delete vendors.",
    },
    { status: ok || partial ? 200 : 502 },
  );
}
