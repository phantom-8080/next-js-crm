import { buildOfflineContractsListResponse } from "@/lib/contracts/static";
import {
  expandApiNamesForZohoFetch,
  getContractFieldDisplayValue,
  mergeLegacyFieldValues,
} from "@/lib/contracts/columns";
import {
  buildZohoModuleListUrls,
  fetchZohoJson,
  mapZohoRecord,
  parseListSearchParam,
  parseVisibleFields,
  ZOHO_CRM_BASE,
} from "@/lib/zoho";

function mapListContract(row, visibleApiNames) {
  const fetchNames = expandApiNamesForZohoFetch(visibleApiNames);
  const mapped = mapZohoRecord(row, fetchNames);
  const merged = mergeLegacyFieldValues(mapped.fields);
  const fields = {};
  for (const apiName of visibleApiNames) {
    fields[apiName] = getContractFieldDisplayValue(merged, apiName);
  }
  return {
    id: row.id != null ? String(row.id) : "",
    fields,
    lookups: mapped.lookups,
  };
}

const MAX_PER_PAGE = 200;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const rawPerPage = Number.parseInt(searchParams.get("perPage") ?? "100", 10) || 100;
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, rawPerPage));

  const visibleApiNames = parseVisibleFields(searchParams);
  const fetchFieldNames = expandApiNamesForZohoFetch(visibleApiNames);
  const zohoFields = ["id", ...fetchFieldNames].join(",");
  const rawCriteria = searchParams.get("criteria")?.trim() || null;
  const { criteria, filters } = parseListSearchParam(rawCriteria);
  const cvid = searchParams.get("cvid")?.trim() || null;

  const { listUrl, countUrl } = buildZohoModuleListUrls({
    module: "Contracts",
    base: ZOHO_CRM_BASE,
    fields: zohoFields,
    page,
    perPage,
    criteria,
    filters,
    cvid,
  });

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
    const offline = buildOfflineContractsListResponse({
      page,
      perPage,
      visibleApiNames,
    });
    return Response.json({
      ...offline,
      error: message,
      zohoUnreachable: true,
    });
  }

  const { res: zohoRes, body } = listResult;
  const filtered = Boolean(criteria || filters || cvid);

  if (zohoRes.status === 204) {
    let totalCount = 0;
    if (countResult.res.ok && typeof countResult.body.count === "number") {
      totalCount = countResult.body.count;
    }
    return Response.json({
      contracts: [],
      totalCount,
      loadedCount: 0,
      page,
      perPage,
      hasMore: false,
      visibleFields: visibleApiNames,
      criteria: rawCriteria,
      cvid,
      filtered,
    });
  }

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
    criteria: rawCriteria,
    cvid,
    filtered,
  });
}
