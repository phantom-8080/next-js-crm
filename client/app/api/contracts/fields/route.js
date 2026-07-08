import { fetchZohoJson, getZohoModuleFieldsUrl } from "@/lib/zoho";
import { FALLBACK_FIELD_CATALOG } from "@/lib/contractColumns";

const HIDDEN_API_NAMES = new Set([
  "$approval_state",
  "$approved",
  "$editable",
  "$field_states",
  "$process_flow",
  "$review_process",
  "$review",
  "$state",
  "$status",
  "$zia_owner_assignment",
  "$orchestration",
  "$in_merge",
  "$pathfinder",
  "$followed",
  "$followers",
]);

function mapZohoField(field) {
  return {
    apiName: field.api_name,
    label: field.field_label ?? field.api_name,
    dataType: field.data_type ?? "text",
    visible: field.visible !== false,
  };
}

function fallbackPayload(warning) {
  return {
    fields: FALLBACK_FIELD_CATALOG.map((f) => ({ ...f, visible: true })),
    source: "fallback",
    warning,
    count: FALLBACK_FIELD_CATALOG.length,
  };
}

export async function GET() {
  const zohoUrl = getZohoModuleFieldsUrl("Contracts");

  try {
    const { res, body } = await fetchZohoJson(zohoUrl);

    if (res.ok && Array.isArray(body.fields)) {
      const fields = body.fields
        .filter((f) => f.api_name && !HIDDEN_API_NAMES.has(f.api_name))
        .filter((f) => f.api_name !== "id")
        .map(mapZohoField)
        .sort((a, b) => a.label.localeCompare(b.label));

      return Response.json({
        fields,
        source: "zoho",
        zohoUrl,
        count: fields.length,
      });
    }

    const zohoMessage =
      body.message ?? body.code ?? `Zoho returned HTTP ${res.status}`;

    return Response.json({
      ...fallbackPayload(
        `Could not load fields from Zoho (${zohoMessage}). Add OAuth scope ZohoCRM.settings.fields.READ (or ZohoCRM.settings.ALL), generate a new token, and update credentials in lib/zoho-oauth.js. Showing a short fallback list.`,
      ),
      zohoUrl,
    });
  } catch (err) {
    console.error("Zoho fields request failed:", err);
    const message = err instanceof Error ? err.message : "Failed to reach Zoho CRM";
    return Response.json(
      fallbackPayload(
        `Could not reach Zoho (${message}). Showing a short fallback list.`,
      ),
    );
  }
}
