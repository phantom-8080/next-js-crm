import { fetchZohoJson, ZOHO_CRM_BASE } from "@/lib/zoho";
import { DEFAULT_VISIBLE_API_NAMES } from "@/lib/contractColumns";

function formatFieldValue(value) {
  if (value == null || value === "") return "";

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "object" && !Array.isArray(value)) {
    if (value.name != null && String(value.name) !== "") return String(value.name);
    if (value.id != null) return String(value.id);
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((v) => formatFieldValue(v))
      .filter(Boolean)
      .join(", ");
  }

  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const date = new Date(str);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  return str;
}

function mapZohoRecord(row, visibleApiNames) {
  const fields = {};
  for (const apiName of visibleApiNames) {
    fields[apiName] = formatFieldValue(row[apiName]);
  }

  return {
    id: row.id != null ? String(row.id) : "",
    fields,
  };
}

function parseVisibleFields(searchParams) {
  const raw = searchParams.get("fields");
  if (!raw || !raw.trim()) {
    return [...DEFAULT_VISIBLE_API_NAMES];
  }

  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((name) => name !== "id");

  return names.length > 0 ? names : [...DEFAULT_VISIBLE_API_NAMES];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = 100;

  const visibleApiNames = parseVisibleFields(searchParams);
  const zohoFields = ["id", ...visibleApiNames].join(",");
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

  const contracts = (body.data ?? []).map((row) => mapZohoRecord(row, visibleApiNames));

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
