import { fetchZohoJson, ZOHO_CRM_BASE } from "@/lib/zoho";
import {
  expandApiNamesForZohoFetch,
  getContractFieldDisplayValue,
  mergeLegacyFieldValues,
} from "@/lib/contractColumns";
import { mapZohoRecord, parseVisibleFields } from "@/lib/zohoContractMap";

function mapListContract(row, visibleApiNames) {
  const fetchNames = expandApiNamesForZohoFetch(visibleApiNames);
  const merged = mergeLegacyFieldValues(mapZohoRecord(row, fetchNames).fields);
  const fields = {};
  for (const apiName of visibleApiNames) {
    fields[apiName] = getContractFieldDisplayValue(merged, apiName);
  }
  return {
    id: row.id != null ? String(row.id) : "",
    fields,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = 100;

  const visibleApiNames = parseVisibleFields(searchParams);
  const fetchFieldNames = expandApiNamesForZohoFetch(visibleApiNames);
  const zohoFields = ["id", ...fetchFieldNames].join(",");
  const fieldsQuery = encodeURIComponent(zohoFields);

  const listUrl = `${ZOHO_CRM_BASE}/Contracts?fields=${fieldsQuery}&per_page=${perPage}&page=${page}`;
  const countUrl = `${ZOHO_CRM_BASE}/Contracts/actions/count`;

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

  if (!zohoRes.ok) {
    return Response.json(
      {
        error: "Zoho CRM error",
        status: zohoRes.status,
        details: body,
      },
      { status: zohoRes.status >= 400 && zohoRes.status < 600 ? zohoRes.status : 502 },
    );
  }

  const contracts = (body.data ?? []).map((row) => mapListContract(row, visibleApiNames));

  let totalCount = contracts.length;
  if (countResult.res.ok && typeof countResult.body.count === "number") {
    totalCount = countResult.body.count;
  } else if (typeof body.info?.count === "number" && !body.info?.more_records) {
    totalCount = body.info.count;
  }

  return Response.json({
    contracts,
    totalCount,
    loadedCount: contracts.length,
    page,
    perPage,
    hasMore: Boolean(body.info?.more_records),
    visibleFields: visibleApiNames,
  });
}
