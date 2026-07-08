import { DEFAULT_VISIBLE_API_NAMES } from "@/lib/contractColumns";

export function formatFieldValue(value) {
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

export function mapZohoRecord(row, visibleApiNames) {
  const fields = {};
  for (const apiName of visibleApiNames) {
    fields[apiName] = formatFieldValue(row[apiName]);
  }

  return {
    id: row.id != null ? String(row.id) : "",
    fields,
  };
}

export function parseVisibleFields(searchParams) {
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
