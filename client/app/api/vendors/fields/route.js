import {
  isExcludedContractCatalogField,
  normalizeContractFieldApiName,
} from "@/lib/contracts/columns";
import {
  buildFallbackRecordSections,
  loadModuleRecordSections,
} from "@/lib/contracts/recordLayout";
import {
  getZohoModuleFieldsUrl,
  loadVendorsFieldCatalog,
} from "@/lib/zoho";
import {
  allVendorDetailApiNames,
  labelForVendorField,
  ZOHO_VENDORS_MODULE,
} from "@/lib/vendor";

function filterClientFields(fields, droppedSectionFieldApiNames) {
  const dropped = new Set(
    (droppedSectionFieldApiNames ?? []).map((name) => normalizeContractFieldApiName(name)),
  );
  return fields.filter(
    (f) =>
      !dropped.has(normalizeContractFieldApiName(f.apiName)) &&
      !isExcludedContractCatalogField(f),
  );
}

function vendorFallbackFields() {
  return allVendorDetailApiNames().map((apiName) => ({
    apiName,
    label: labelForVendorField(apiName),
    dataType:
      apiName === "Created_Time" || apiName === "Modified_Time" ? "datetime"
      : apiName === "Website" ? "url"
      : "text",
    visible: true,
  }));
}

function fallbackPayload(warning) {
  const fields = vendorFallbackFields();
  return {
    fields,
    sections: buildFallbackRecordSections(fields),
    droppedSectionFieldApiNames: [],
    sectionSource: "fallback",
    source: "fallback",
    warning,
    count: fields.length,
  };
}

export async function GET() {
  const zohoUrl = getZohoModuleFieldsUrl(ZOHO_VENDORS_MODULE);

  try {
    const { fields, source } = await loadVendorsFieldCatalog();
    const catalog =
      source === "zoho" && fields.length > 0 ? fields : vendorFallbackFields();
    const { sections, droppedSectionFieldApiNames, source: sectionSource } =
      await loadModuleRecordSections(ZOHO_VENDORS_MODULE, catalog);
    const clientFields = filterClientFields(
      source === "zoho" ? fields : catalog,
      droppedSectionFieldApiNames,
    );

    if (source === "zoho") {
      return Response.json({
        fields: clientFields,
        sections,
        droppedSectionFieldApiNames,
        sectionSource,
        source: "zoho",
        zohoUrl,
        count: clientFields.length,
      });
    }

    return Response.json({
      ...fallbackPayload(
        "Could not load Vendors fields from Zoho. Showing a short fallback list.",
      ),
      sections: sections ?? null,
      sectionSource,
      zohoUrl,
    });
  } catch (err) {
    console.error("Zoho Vendors fields request failed:", err);
    const message = err instanceof Error ? err.message : "Failed to reach Zoho CRM";
    return Response.json(
      fallbackPayload(`Could not reach Zoho (${message}). Showing a short fallback list.`),
    );
  }
}
