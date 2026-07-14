import { fetchZohoJson, ZOHO_CRM_BASE } from "@/lib/zoho";

/** Display order for Zoho custom-view categories. */
const CUSTOM_VIEW_CATEGORY_ORDER = [
  "created_by_me",
  "shared_with_me",
  "public_views",
  "other_users_views",
];

/** @type {Record<string, string>} */
const CUSTOM_VIEW_CATEGORY_LABELS = {
  created_by_me: "Created By Me",
  shared_with_me: "Shared With Me",
  public_views: "Public Views",
  other_users_views: "Other Users' Views",
};

/**
 * Fetch all Zoho custom views for a module (paginated, always live — no app cache).
 * @param {string} [module]
 * @returns {Promise<import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]>}
 */
export async function fetchZohoCustomViews(module = "Contracts") {
  /** @type {Record<string, unknown>[]} */
  const allViews = [];
  /** @type {Record<string, string>} */
  let translations = {};
  let page = 1;
  let more = true;

  while (more && page <= 20) {
    const url = `${ZOHO_CRM_BASE}/settings/custom_views?module=${encodeURIComponent(module)}&page=${page}&per_page=200`;
    const { res, body } = await fetchZohoJson(url);
    if (!res.ok || !Array.isArray(body.custom_views)) {
      if (page === 1) return [];
      break;
    }

    if (body.info?.translation && typeof body.info.translation === "object") {
      translations = { ...translations, ...body.info.translation };
    }

    allViews.push(...body.custom_views);
    more = body.info?.more_records === true;
    page += 1;
  }

  /** @type {import("@/lib/contractFilterTypes").ContractFilterFieldMeta[]} */
  const views = allViews
    .filter((view) => view?.id != null && String(view.id).trim() !== "")
    .map((view) => {
      const categoryKey = String(view.category ?? "").trim() || "public_views";
      const groupLabel =
        translations[categoryKey] ||
        CUSTOM_VIEW_CATEGORY_LABELS[categoryKey] ||
        (view.system_defined ? "Public Views" : "Created By Me");

      return {
        apiName: `__custom_view__${view.id}`,
        label: String(view.display_value ?? view.name ?? "View").trim() || "View",
        dataType: "custom_view",
        operators: [],
        options: [],
        hasOptions: true,
        section: /** @type {const} */ ("system_defined"),
        groupLabel,
        customViewId: String(view.id),
        favorite: view.favorite != null && Number(view.favorite) > 0,
        defaultView: view.default === true,
        systemDefined: view.system_defined === true,
      };
    });

  const categoryRank = (key) => {
    const idx = CUSTOM_VIEW_CATEGORY_ORDER.indexOf(key);
    return idx === -1 ? CUSTOM_VIEW_CATEGORY_ORDER.length : idx;
  };

  const labelToKey = new Map(
    Object.entries({ ...CUSTOM_VIEW_CATEGORY_LABELS, ...translations }).map(
      ([key, label]) => [label, key],
    ),
  );

  views.sort((a, b) => {
    const aKey = labelToKey.get(a.groupLabel ?? "") ?? "";
    const bKey = labelToKey.get(b.groupLabel ?? "") ?? "";
    const byCat = categoryRank(aKey) - categoryRank(bKey);
    if (byCat !== 0) return byCat;
    if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return views;
}

/**
 * Delete a Zoho custom view.
 * Endpoint: DELETE /crm/v7/settings/custom_views?module={module}&ids={id}
 * Requires OAuth scope ZohoCRM.settings.custom_views.DELETE (or .ALL).
 *
 * @param {string} customViewId
 * @param {string} [module]
 */
export async function deleteZohoCustomView(customViewId, module = "Contracts") {
  const id = String(customViewId ?? "").trim();
  if (!id) {
    const err = new Error("Custom view id is required");
    err.status = 400;
    throw err;
  }

  const url = `${ZOHO_CRM_BASE}/settings/custom_views?module=${encodeURIComponent(module)}&ids=${encodeURIComponent(id)}`;
  const { res, body } = await fetchZohoJson(url, { method: "DELETE" });

  const row = Array.isArray(body?.custom_views) ? body.custom_views[0] : null;
  const rowStatus = String(row?.status ?? "").toLowerCase();
  const rowCode = String(row?.code ?? body?.code ?? "").toUpperCase();

  if (!res.ok || rowStatus === "error") {
    let message =
      row?.message ?? body?.message ?? body?.error ?? "Failed to delete custom view in Zoho CRM";
    if (rowCode === "OAUTH_SCOPE_MISMATCH" || body?.code === "OAUTH_SCOPE_MISMATCH") {
      message =
        "Zoho OAuth is missing custom-view delete permission. Add scope ZohoCRM.settings.custom_views.ALL, regenerate the refresh token, and update ZOHO_REFRESH_TOKEN.";
    }
    const err = new Error(message);
    err.status = res.status >= 400 ? res.status : 400;
    err.details = body;
    throw err;
  }

  return { id, raw: body };
}
