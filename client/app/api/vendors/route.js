import { fetchZohoJson, getZohoModuleSearchUrl, ZOHO_CRM_BASE } from "@/lib/zoho";
import { parseVendorListFields, ZOHO_VENDORS_MODULE } from "@/lib/vendorConfig";
import { mapZohoRecord } from "@/lib/zohoContractMap";

function mapListRow(row, visibleApiNames) {
  const mapped = mapZohoRecord(row, visibleApiNames);
  return {
    id: mapped.id,
    fields: mapped.fields,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = 100;
  const module = ZOHO_VENDORS_MODULE;

  const visibleApiNames = parseVendorListFields(searchParams);
  const zohoFields = ["id", ...visibleApiNames].join(",");
  const criteria = searchParams.get("criteria")?.trim() || null;
  const cvid = searchParams.get("cvid")?.trim() || null;

  const listUrl =
    cvid ?
      `${ZOHO_CRM_BASE}/${encodeURIComponent(module)}?cvid=${encodeURIComponent(cvid)}&fields=${encodeURIComponent(zohoFields)}&per_page=${perPage}&page=${page}`
    : criteria ?
      getZohoModuleSearchUrl(module, {
        criteria,
        fields: zohoFields,
        page,
        perPage,
      })
    : `${ZOHO_CRM_BASE}/${encodeURIComponent(module)}?fields=${encodeURIComponent(zohoFields)}&per_page=${perPage}&page=${page}`;

  const countUrl =
    cvid ?
      `${ZOHO_CRM_BASE}/${encodeURIComponent(module)}/actions/count?cvid=${encodeURIComponent(cvid)}`
    : criteria ?
      `${ZOHO_CRM_BASE}/${encodeURIComponent(module)}/actions/count?criteria=${encodeURIComponent(criteria)}`
    : `${ZOHO_CRM_BASE}/${encodeURIComponent(module)}/actions/count`;

  let listResult;
  let countResult;

  try {
    [listResult, countResult] = await Promise.all([
      fetchZohoJson(listUrl),
      fetchZohoJson(countUrl),
    ]);
  } catch (err) {
    console.error("Zoho CRM request failed:", err);
    const message = err instanceof Error ? err.message : "Failed to reach Zoho CRM";
    return Response.json({ error: message }, { status: 502 });
  }

  const { res: zohoRes, body } = listResult;

  if (zohoRes.status === 204) {
    let totalCount = 0;
    if (countResult.res.ok && typeof countResult.body.count === "number") {
      totalCount = countResult.body.count;
    }
    return Response.json({
      records: [],
      totalCount,
      loadedCount: 0,
      page,
      perPage,
      hasMore: false,
      visibleFields: visibleApiNames,
      criteria,
      cvid,
      filtered: Boolean(criteria || cvid),
    });
  }

  if (!zohoRes.ok) {
    const zohoMessage =
      body?.message ??
      body?.code ??
      (typeof body?.details === "object" && body.details?.message) ??
      "Zoho CRM error";
    return Response.json(
      {
        error: String(zohoMessage),
        status: zohoRes.status,
        details: body,
      },
      { status: zohoRes.status >= 400 && zohoRes.status < 600 ? zohoRes.status : 502 },
    );
  }

  const records = (body.data ?? []).map((row) => mapListRow(row, visibleApiNames));

  let totalCount = records.length;
  if (countResult.res.ok && typeof countResult.body.count === "number") {
    totalCount = countResult.body.count;
  } else if (typeof body.info?.count === "number" && !body.info?.more_records) {
    totalCount = body.info.count;
  }

  return Response.json({
    records,
    totalCount,
    loadedCount: records.length,
    page,
    perPage,
    hasMore: Boolean(body.info?.more_records),
    visibleFields: visibleApiNames,
    criteria,
    cvid,
    filtered: Boolean(criteria || cvid),
  });
}
