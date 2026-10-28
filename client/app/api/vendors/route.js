import {
  FALLBACK_FIELD_CATALOG,
  getVendorFieldDisplayValue,
  parseVendorListFields,
  ZOHO_VENDORS_MODULE,
} from "@/lib/vendors/columns";
import { ZOHO_API_SORTABLE_FIELDS } from "@/lib/vendors/columnSort";
// Related-module filters (Notes, etc.) — vendors-local helper (not contracts).
import {
  fetchModuleRecordsByIds,
  fetchParentIdsByRelatedModule,
  intersectIdLists,
  splitRelatedModulesFromFiltersJson,
} from "@/lib/vendors/relatedModuleFilter";
import { buildOfflineVendorsListResponse } from "@/lib/vendors/static";
import {
  buildZohoModuleListUrls,
  fetchZohoJson,
  mapZohoRecord,
  parseListSearchParam,
  ZOHO_CRM_BASE,
} from "@/lib/zoho";

function mapListVendor(row, visibleApiNames) {
  const mapped = mapZohoRecord(row, visibleApiNames);
  const fields = {};
  for (const apiName of visibleApiNames) {
    fields[apiName] = getVendorFieldDisplayValue(mapped.fields, apiName);
  }
  return {
    id: row.id != null ? String(row.id) : "",
    fields,
    lookups: mapped.lookups,
  };
}

function sortMappedVendors(records, sortBy, sortOrder) {
  if (!sortBy || !Array.isArray(records)) return records;
  const factor = sortOrder === "desc" ? -1 : 1;
  return [...records].sort((a, b) => {
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
    records: [],
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

  const visibleApiNames = parseVendorListFields(searchParams);
  const zohoFields = ["id", ...visibleApiNames].join(",");
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

  const { relatedFilters, remainingFiltersJson } =
    splitRelatedModulesFromFiltersJson(filters);
  const effectiveFilters = remainingFiltersJson;
  const filtered = Boolean(criteria || filters || cvid || relatedFilters.length > 0);

  // Related-module filters (Notes, Attachments, …) → Vendor IDs → page by ids.
  if (relatedFilters.length > 0 && !cvid) {
    try {
      /** @type {string[][]} */
      const idLists = [];

      for (const relatedFilter of relatedFilters) {
        try {
          idLists.push(
            await fetchParentIdsByRelatedModule(relatedFilter),
          );
        } catch (relatedErr) {
          const details = relatedErr?.details;
          const code = String(details?.code ?? "");
          const message =
            relatedErr instanceof Error ? relatedErr.message : "Related filter failed";
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

      const allVendorIds = idLists.length === 1 ? idLists[0] : intersectIdLists(idLists);

      if (allVendorIds.length === 0) {
        return emptyListResponse({
          page,
          perPage,
          visibleApiNames,
          rawCriteria,
          cvid,
          filtered: true,
        });
      }

      let matchingIds = allVendorIds;

      if (effectiveFilters || criteria) {
        /** @type {Set<string>} */
        const allowed = new Set();
        let listPage = 1;
        let more = true;
        while (more && listPage <= 10) {
          const { listUrl } = buildZohoModuleListUrls({
            module: ZOHO_VENDORS_MODULE,
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

        matchingIds = allVendorIds.filter((id) => allowed.has(id));
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
      const { res, body, rows } = await fetchModuleRecordsByIds(
        ZOHO_VENDORS_MODULE,
        pageIds,
        zohoFields,
      );

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

      const records = sortMappedVendors(
        rows.map((row) => mapListVendor(row, visibleApiNames)),
        pageSortBy ?? sortBy,
        sortOrder,
      );
      return Response.json({
        records,
        totalCount,
        loadedCount: records.length,
        page,
        perPage,
        hasMore: start + perPage < totalCount,
        visibleFields: visibleApiNames,
        criteria: rawCriteria,
        cvid,
        filtered: true,
      });
    } catch (err) {
      console.error("Related-module vendor filter failed:", err);
      const status = err.status ?? 502;
      const message =
        err instanceof Error ? err.message : "Failed to filter by related module";
      if (status >= 400 && status < 600) {
        return Response.json({ error: message, status, details: err.details }, { status });
      }
      const offline = buildOfflineVendorsListResponse({
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
    module: ZOHO_VENDORS_MODULE,
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
    console.error("Zoho Vendors list failed:", err);
    const message = err instanceof Error ? err.message : "Failed to reach Zoho CRM";
    const offline = buildOfflineVendorsListResponse({
      page,
      perPage,
      visibleApiNames:
        visibleApiNames.length > 0 ? visibleApiNames : FALLBACK_FIELD_CATALOG.map((f) => f.apiName),
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
      records: [],
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

  const records = sortMappedVendors(
    (body.data ?? []).map((row) => mapListVendor(row, visibleApiNames)),
    pageSortBy,
    sortOrder,
  );

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
    criteria: rawCriteria,
    cvid,
    filtered,
  });
}
