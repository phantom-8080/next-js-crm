import { buildOfflineContractsListResponse } from "@/lib/contracts/static";
import {
  expandApiNamesForZohoFetch,
  getContractFieldDisplayValue,
  mergeLegacyFieldValues,
  SCOPE_OF_WORK_SUBFORM_API_NAME,
} from "@/lib/contracts/columns";
import {
  fetchContractIdsByOurServices,
  fetchContractsByIds,
  fetchScopeOfWorkSummariesByContractIds,
  listNeedsScopeOfWorkSummary,
  splitOurServicesFromFiltersJson,
} from "@/lib/contracts/ourServicesFilter";
import {
  buildZohoModuleListUrls,
  fetchZohoJson,
  mapZohoRecord,
  parseListSearchParam,
  parseVisibleFields,
  ZOHO_CRM_BASE,
} from "@/lib/zoho";

function mapListContract(row, visibleApiNames, sowSummaries) {
  const fetchNames = expandApiNamesForZohoFetch(visibleApiNames);
  const mapped = mapZohoRecord(row, fetchNames);
  const merged = mergeLegacyFieldValues(mapped.fields);
  const fields = {};
  for (const apiName of visibleApiNames) {
    fields[apiName] = getContractFieldDisplayValue(merged, apiName);
  }

  const contractId = row.id != null ? String(row.id) : "";
  if (listNeedsScopeOfWorkSummary(visibleApiNames) && contractId && sowSummaries) {
    const summary = sowSummaries.get(contractId) ?? "";
    if (visibleApiNames.includes(SCOPE_OF_WORK_SUBFORM_API_NAME)) {
      fields[SCOPE_OF_WORK_SUBFORM_API_NAME] = summary;
    }
    if (visibleApiNames.includes("Scope_of_Work")) {
      fields.Scope_of_Work = summary;
    }
  }

  return {
    id: contractId,
    fields,
    lookups: mapped.lookups,
  };
}

/**
 * @param {any[]} rows
 * @param {string[]} visibleApiNames
 */
async function mapContractsWithScopeOfWork(rows, visibleApiNames) {
  /** @type {Map<string, string>} */
  let sowSummaries = new Map();
  if (listNeedsScopeOfWorkSummary(visibleApiNames) && rows.length > 0) {
    try {
      sowSummaries = await fetchScopeOfWorkSummariesByContractIds(
        rows.map((row) => (row?.id != null ? String(row.id) : "")),
      );
    } catch (err) {
      console.error("Scope of Work list enrichment failed:", err);
      sowSummaries = new Map();
    }
  }
  return rows.map((row) => mapListContract(row, visibleApiNames, sowSummaries));
}

function emptyListResponse({
  page,
  perPage,
  visibleApiNames,
  rawCriteria,
  cvid,
  filtered,
}) {
  return Response.json({
    contracts: [],
    totalCount: 0,
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

  const { serviceFilter, remainingFiltersJson } = splitOurServicesFromFiltersJson(filters);
  const effectiveFilters = remainingFiltersJson;
  const filtered = Boolean(criteria || filters || cvid || serviceFilter);

  // OurServices lives on Our_Services_SubForm — resolve Parent_Id, then load Contracts.
  if (serviceFilter && !cvid) {
    try {
      const allContractIds = await fetchContractIdsByOurServices(serviceFilter);
      if (allContractIds.length === 0) {
        return emptyListResponse({
          page,
          perPage,
          visibleApiNames,
          rawCriteria,
          cvid,
          filtered: true,
        });
      }

      // Optional extra Contracts filters: load candidates by id, then keep those that
      // also match remaining filters (applied via a second Zoho list call + intersect).
      let matchingIds = allContractIds;

      if (effectiveFilters || criteria) {
        /** @type {Set<string>} */
        const allowed = new Set();
        let listPage = 1;
        let more = true;
        while (more && listPage <= 10) {
          const { listUrl } = buildZohoModuleListUrls({
            module: "Contracts",
            base: ZOHO_CRM_BASE,
            fields: "id",
            page: listPage,
            perPage: 200,
            criteria,
            filters: effectiveFilters,
            cvid: null,
          });
          const { res, body } = await fetchZohoJson(listUrl);
          if (res.status === 204 || body?.code === "NO_DATA") break;
          if (!res.ok) {
            return Response.json(
              {
                error: "Zoho CRM error",
                status: res.status,
                details: body,
              },
              { status: res.status >= 400 && res.status < 600 ? res.status : 502 },
            );
          }
          for (const row of body?.data ?? []) {
            if (row?.id != null) allowed.add(String(row.id));
          }
          more = Boolean(body?.info?.more_records);
          listPage += 1;
        }

        matchingIds = allContractIds.filter((id) => allowed.has(id));
        if (matchingIds.length === 0) {
          return emptyListResponse({
            page,
            perPage,
            visibleApiNames,
            rawCriteria,
            cvid,
            filtered: true,
          });
        }
      }

      const totalCount = matchingIds.length;
      const start = (page - 1) * perPage;
      const pageIds = matchingIds.slice(start, start + perPage);
      const { res, body, rows } = await fetchContractsByIds(pageIds, zohoFields);

      if (!res.ok && res.status !== 204) {
        return Response.json(
          {
            error: "Zoho CRM error",
            status: res.status,
            details: body,
          },
          { status: res.status >= 400 && res.status < 600 ? res.status : 502 },
        );
      }

      const contracts = await mapContractsWithScopeOfWork(rows, visibleApiNames);
      return Response.json({
        contracts,
        totalCount,
        loadedCount: contracts.length,
        page,
        perPage,
        hasMore: start + perPage < totalCount,
        visibleFields: visibleApiNames,
        criteria: rawCriteria,
        cvid,
        filtered: true,
      });
    } catch (err) {
      console.error("OurServices contract filter failed:", err);
      const status = err.status ?? 502;
      const message = err instanceof Error ? err.message : "Failed to filter by OurServices";
      if (status >= 400 && status < 600) {
        return Response.json(
          { error: message, status, details: err.details },
          { status },
        );
      }
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
  }

  const { listUrl, countUrl } = buildZohoModuleListUrls({
    module: "Contracts",
    base: ZOHO_CRM_BASE,
    fields: zohoFields,
    page,
    perPage,
    criteria,
    filters: effectiveFilters ?? filters,
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

  const contracts = await mapContractsWithScopeOfWork(body.data ?? [], visibleApiNames);

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
