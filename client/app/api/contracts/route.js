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
  fetchContractIdsByRelatedModule,
  intersectIdLists,
  splitRelatedModulesFromFiltersJson,
} from "@/lib/contracts/relatedModuleFilter";
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

/** Zoho Get Records `sort_by` allow-list for Contracts (others → page-level sort). */
const ZOHO_API_SORTABLE_FIELDS = new Set(["id", "Created_Time", "Modified_Time"]);

/** Page-level sort when Zoho cannot sort the requested field. */
function sortMappedContracts(contracts, sortBy, sortOrder) {
  if (!sortBy || !Array.isArray(contracts)) return contracts;
  const factor = sortOrder === "desc" ? -1 : 1;
  return [...contracts].sort((a, b) => {
    const left = String(a?.fields?.[sortBy] ?? "");
    const right = String(b?.fields?.[sortBy] ?? "");
    return (
      factor *
      left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
    );
  });
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
  const sortBy = searchParams.get("sortBy")?.trim() || null;
  const sortOrderRaw = searchParams.get("sortOrder")?.trim()?.toLowerCase() || null;
  const sortOrder =
    sortOrderRaw === "desc" || sortOrderRaw === "asc" ? sortOrderRaw : null;
  const zohoSortBy =
    sortBy && ZOHO_API_SORTABLE_FIELDS.has(sortBy) ? sortBy : null;
  const pageSortBy = zohoSortBy ? null : sortBy;

  const { serviceFilter, remainingFiltersJson: afterServices } =
    splitOurServicesFromFiltersJson(filters);
  const { relatedFilters, remainingFiltersJson } =
    splitRelatedModulesFromFiltersJson(afterServices);
  const effectiveFilters = remainingFiltersJson;
  const filtered = Boolean(
    criteria || filters || cvid || serviceFilter || relatedFilters.length > 0,
  );

  // Child-module filters (OurServices / related modules) → Contract IDs → page by ids.
  if ((serviceFilter || relatedFilters.length > 0) && !cvid) {
    try {
      /** @type {string[][]} */
      const idLists = [];

      if (serviceFilter) {
        idLists.push(await fetchContractIdsByOurServices(serviceFilter));
      }

      for (const relatedFilter of relatedFilters) {
        try {
          idLists.push(await fetchContractIdsByRelatedModule(relatedFilter));
        } catch (relatedErr) {
          const details = relatedErr?.details;
          const code = String(details?.code ?? "");
          const message = relatedErr instanceof Error ? relatedErr.message : "Related filter failed";
          if (code === "NO_PERMISSION" || /permission/i.test(message)) {
            const err = new Error(
              `No Zoho permission to read related module “${relatedFilter.lookupModule}”. Grant the module READ scope and try again.`,
            );
            err.status = 403;
            err.details = details;
            throw err;
          }
          if (code === "NOT_SUPPORTED" || /not support/i.test(message)) {
            const err = new Error(
              `Zoho does not support searching related module “${relatedFilter.lookupModule}” via API. Try a different related module or field filter.`,
            );
            err.status = 400;
            err.details = details;
            throw err;
          }
          throw relatedErr;
        }
      }

      const allContractIds =
        idLists.length === 1 ? idLists[0] : intersectIdLists(idLists);

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

      const contracts = sortMappedContracts(
        await mapContractsWithScopeOfWork(rows, visibleApiNames),
        pageSortBy ?? sortBy,
        sortOrder,
      );
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
      console.error("Child-module contract filter failed:", err);
      const status = err.status ?? 502;
      const message = err instanceof Error ? err.message : "Failed to filter by related module";
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
    sortBy: zohoSortBy,
    sortOrder: zohoSortBy ? sortOrder : null,
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

  const contracts = sortMappedContracts(
    await mapContractsWithScopeOfWork(body.data ?? [], visibleApiNames),
    pageSortBy,
    sortOrder,
  );

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
