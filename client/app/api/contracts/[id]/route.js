import { loadContractsFieldCatalog } from "@/lib/contractModuleFields";
import { loadContractsRecordSections } from "@/lib/loadContractRecordLayout";
import { collectRecordDetailApiNames } from "@/lib/contractRecordLayout";
import {
  expandApiNamesForZohoFetch,
  mergeLegacyFieldValues,
} from "@/lib/contractColumns";
import { fetchZohoContractRecordById } from "@/lib/fetchZohoContractRecord";
import { mapZohoRecord, parseVisibleFields } from "@/lib/zohoContractMap";

export async function GET(request, context) {
  const { id } = await context.params;
  if (!id || !String(id).trim()) {
    return Response.json({ error: "Missing contract id" }, { status: 400 });
  }

  const recordId = String(id).trim();
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");

  let visibleApiNames;

  if (scope === "detail") {
    try {
      const { fields } = await loadContractsFieldCatalog();
      const { sections } = await loadContractsRecordSections(fields);
      visibleApiNames = collectRecordDetailApiNames(fields, sections);
    } catch (err) {
      console.error("Failed to load field catalog for record:", err);
      visibleApiNames = parseVisibleFields(searchParams);
    }
  } else {
    visibleApiNames = parseVisibleFields(searchParams);
  }

  const fieldSet = new Set(expandApiNamesForZohoFetch(["Name", ...visibleApiNames]));

  let row;
  try {
    row = await fetchZohoContractRecordById(recordId, [...fieldSet]);
  } catch (err) {
    const status = err.status ?? 502;
    if (status === 404) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }
    console.error("Zoho CRM record request failed:", err);
    let message = err instanceof Error ? err.message : "Failed to reach Zoho CRM";
    if (message.includes("Zoho token refresh failed")) {
      message =
        "Could not authenticate with Zoho CRM. The list may still work briefly with a cached token; regenerate your refresh token and confirm client ID/secret and accounts region (zoho.com vs zoho.eu).";
    }
    return Response.json(
      {
        error: message,
        status: err.status,
        details: err.details,
      },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }

  const contract = mapZohoRecord(row, [...fieldSet]);
  contract.fields = mergeLegacyFieldValues(contract.fields);

  return Response.json({
    contract,
    visibleFields: [...fieldSet],
  });
}
