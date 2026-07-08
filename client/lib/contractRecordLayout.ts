import type { CrmFieldMeta } from "@/lib/contractColumns";
import {
  filterCatalogForRecordView,
  normalizeContractFieldApiName,
} from "@/lib/contractColumns";

export type CrmRecordSection = {
  id: string;
  title: string;
  fieldApiNames: string[];
  /** Zoho subform sections render as tables when record data is available */
  kind: "fields" | "subform";
};

export type RecordFieldRow = CrmFieldMeta & { value: string };

const FALLBACK_SECTION_ORDER: { id: string; title: string; test: (apiName: string) => boolean }[] =
  [
    {
      id: "address",
      title: "Address",
      test: (api) =>
        /^Site_(Street|City|State|Zip|Country)/i.test(api) ||
        /^(Mailing|Billing)_(Street|City|State|Zip)/i.test(api),
    },
    {
      id: "sales",
      title: "Sales Information",
      test: (api) =>
        /^(Region|District|Zone|Sales_|Deal_|Opportunity)/i.test(api) ||
        /Sales_Associate/i.test(api),
    },
    {
      id: "accounting",
      title: "Accounting",
      test: (api) => /(Invoice|Accounting|GL_|Payment|Late_)/i.test(api),
    },
    {
      id: "pos",
      title: "POs",
      test: (api) => /^PO_|Purchase_Order/i.test(api),
    },
    {
      id: "users",
      title: "Users",
      test: (api) =>
        /(Operations_Manager|Project_Manager|Account_Manager|Associate|Coordinator|Owner)/i.test(
          api,
        ) && !/Owner_Assignment/i.test(api),
    },
    {
      id: "contract-signing",
      title: "Contract Signing",
      test: (api) => /(Signed|Signing|Signature|Docusign)/i.test(api),
    },
    {
      id: "scheduled",
      title: "Scheduled",
      test: (api) =>
        /(Service_|Scheduling|Scheduled|Deadline|Confirmed)/i.test(api) &&
        !/^Contract_/i.test(api),
    },
    {
      id: "system",
      title: "System",
      test: (api) =>
        /^(Created|Modified)_(By|Time)|RecordID|Record_Status|Tag|Last_Activity/i.test(api) ||
        api === "Owner",
    },
  ];

function slugSectionId(title: string, index: number) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `section-${index}`;
}

/** Parse Zoho layout API payload into ordered sections */
export function parseZohoLayoutSections(layoutBody: unknown): CrmRecordSection[] | null {
  if (!layoutBody || typeof layoutBody !== "object") return null;
  const layouts = (layoutBody as { layouts?: unknown[] }).layouts;
  if (!Array.isArray(layouts) || layouts.length === 0) return null;

  const layout =
    layouts.find(
      (l) =>
        l &&
        typeof l === "object" &&
        ((l as { generated_type?: string }).generated_type === "system" ||
          (l as { status?: string }).status === "active"),
    ) ?? layouts[0];

  if (!layout || typeof layout !== "object") return null;
  const rawSections = (layout as { sections?: unknown[] }).sections;
  if (!Array.isArray(rawSections)) return null;

  const sections: CrmRecordSection[] = [];

  const sortedRaw = [...rawSections].sort(
    (a, b) =>
      Number((a as { sequence_number?: number }).sequence_number ?? 0) -
      Number((b as { sequence_number?: number }).sequence_number ?? 0),
  );

  for (const [index, raw] of sortedRaw.entries()) {
    if (!raw || typeof raw !== "object") continue;
    const section = raw as {
      display_label?: string;
      name?: string;
      api_name?: string;
      sequence_number?: number;
      type?: string;
      fields?: { api_name?: string }[];
    };

    const title =
      section.display_label?.trim() ||
      section.name?.trim() ||
      section.api_name?.trim() ||
      "Section";

    const fieldApiNames: string[] = [];
    for (const field of section.fields ?? []) {
      const api = field?.api_name?.trim();
      if (!api || api === "id") continue;
      const canonical = normalizeContractFieldApiName(api);
      if (!fieldApiNames.includes(canonical)) {
        fieldApiNames.push(canonical);
      }
    }

    const isSubform =
      section.type === "subform" ||
      fieldApiNames.length === 1 &&
        /subform|scope_of_work|line_items/i.test(fieldApiNames[0] ?? "");

    sections.push({
      id: slugSectionId(title, index),
      title,
      fieldApiNames,
      kind: isSubform ? "subform" : "fields",
    });
  }

  return sections.length > 0 ? sections : null;
}

/** When layout API is unavailable, bucket fields into coarse sections */
export function buildFallbackRecordSections(catalog: CrmFieldMeta[]): CrmRecordSection[] {
  const fields = filterCatalogForRecordView(catalog);
  const buckets = new Map<string, CrmRecordSection>();

  for (const rule of FALLBACK_SECTION_ORDER) {
    buckets.set(rule.id, { id: rule.id, title: rule.title, fieldApiNames: [], kind: "fields" });
  }
  buckets.set("contact", {
    id: "contact",
    title: "Contact Information",
    fieldApiNames: [],
    kind: "fields",
  });

  const assigned = new Set<string>();

  for (const field of fields) {
    const api = field.apiName;
    let placed = false;
    for (const rule of FALLBACK_SECTION_ORDER) {
      if (rule.test(api)) {
        buckets.get(rule.id)!.fieldApiNames.push(api);
        assigned.add(api);
        placed = true;
        break;
      }
    }
    if (!placed) {
      buckets.get("contact")!.fieldApiNames.push(api);
      assigned.add(api);
    }
  }

  const ordered: CrmRecordSection[] = [];
  const pushIfFields = (id: string) => {
    const section = buckets.get(id);
    if (section && section.fieldApiNames.length > 0) ordered.push(section);
  };

  pushIfFields("address");
  pushIfFields("contact");
  for (const rule of FALLBACK_SECTION_ORDER) {
    if (rule.id === "address") continue;
    pushIfFields(rule.id);
  }

  return ordered;
}

export function mergeSectionsWithCatalog(
  sections: CrmRecordSection[],
  catalog: CrmFieldMeta[],
  getValue: (apiName: string) => string,
): { section: CrmRecordSection; rows: RecordFieldRow[] }[] {
  const catalogMap = new Map<string, CrmFieldMeta>();
  for (const field of filterCatalogForRecordView(catalog)) {
    catalogMap.set(field.apiName, field);
  }

  const usedInSections = new Set<string>();
  const result: { section: CrmRecordSection; rows: RecordFieldRow[] }[] = [];

  for (const section of sections) {
    const rows: RecordFieldRow[] = [];
    for (const apiName of section.fieldApiNames) {
      const canonical = normalizeContractFieldApiName(apiName);
      usedInSections.add(canonical);
      const meta = catalogMap.get(canonical) ?? {
        apiName: canonical,
        label: canonical.replace(/_/g, " "),
        dataType: "text",
      };
      rows.push({ ...meta, value: getValue(canonical) });
    }
    if (rows.length > 0 || section.kind === "subform") {
      result.push({ section, rows });
    }
  }

  const leftover: RecordFieldRow[] = [];
  for (const field of filterCatalogForRecordView(catalog)) {
    if (usedInSections.has(field.apiName)) continue;
    leftover.push({ ...field, value: getValue(field.apiName) });
  }

  if (leftover.length > 0) {
    result.push({
      section: {
        id: "additional",
        title: "Additional fields",
        fieldApiNames: leftover.map((r) => r.apiName),
        kind: "fields",
      },
      rows: leftover,
    });
  }

  return result;
}

/** API names to fetch for record detail (layout fields + essentials, not entire metadata catalog). */
export function collectRecordDetailApiNames(
  catalog: CrmFieldMeta[],
  sections: CrmRecordSection[] | null | undefined,
): string[] {
  const names = new Set<string>(["Name", "Contract_Status", "Record_Status"]);

  if (sections?.length) {
    for (const section of sections) {
      for (const apiName of section.fieldApiNames) {
        names.add(normalizeContractFieldApiName(apiName));
      }
    }
    for (const field of filterCatalogForRecordView(catalog)) {
      names.add(field.apiName);
    }
  } else {
    for (const field of filterCatalogForRecordView(catalog)) {
      names.add(field.apiName);
    }
  }

  return [...names];
}
