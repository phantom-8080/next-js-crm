import type { CrmFieldMeta } from "@/lib/contracts/columns";
import {
  filterCatalogForRecordView,
  formatCellForDisplay,
  isExcludedContractFieldApiName,
  normalizeContractFieldApiName,
} from "@/lib/contracts/columns";
import { fetchZohoJson, formatFieldValue, getZohoModuleLayoutsUrl } from "@/lib/zoho";

export type CrmRecordSection = {
  id: string;
  title: string;
  fieldApiNames: string[];
  /** Zoho subform sections render as tables when record data is available */
  kind: "fields" | "subform";
};

export type RecordFieldRow = CrmFieldMeta & { value: string };

export const CONTRACT_SIGNINGS_SECTION_ID = "contract-signings";
export const CONTRACT_SIGNINGS_SECTION_TITLE = "Contract Signings";

/** Fixed order for the Contract Signings block on record detail. */
export const CONTRACT_SIGNINGS_FIELD_API_NAMES = [
  "Client_Signed_Status",
  "Client_Sign_Req_Id",
  "Vendor_Signed_Status",
  "Vendor_Sign_Req_Id",
] as const;

const CONTRACT_SIGNINGS_FIELD_SET = new Set<string>(CONTRACT_SIGNINGS_FIELD_API_NAMES);

export function isContractSigningsFieldApiName(apiName: string): boolean {
  const canonical = normalizeContractFieldApiName(apiName);
  return CONTRACT_SIGNINGS_FIELD_SET.has(canonical);
}

/**
 * Pull the four signing fields into a dedicated section (removes them from other sections).
 * When `catalog` is provided, includes signing fields that exist in metadata but not on the Zoho layout.
 */
export function applyContractSigningsSection(
  sections: CrmRecordSection[],
  catalog?: CrmFieldMeta[],
): CrmRecordSection[] {
  const presentSlots = new Set<string>();

  if (catalog?.length) {
    for (const field of filterCatalogForRecordView(catalog)) {
      if (isContractSigningsFieldApiName(field.apiName)) {
        presentSlots.add(normalizeContractFieldApiName(field.apiName));
      }
    }
  }

  const stripped: CrmRecordSection[] = [];

  for (const section of sections) {
    const fieldApiNames: string[] = [];
    for (const api of section.fieldApiNames) {
      const canonical = normalizeContractFieldApiName(api);
      if (isContractSigningsFieldApiName(canonical)) {
        presentSlots.add(canonical);
        continue;
      }
      fieldApiNames.push(api);
    }

    if (fieldApiNames.length === 0 && section.kind !== "subform") continue;

    const isLegacySigningsSection =
      section.id === "contract-signing" ||
      section.id === CONTRACT_SIGNINGS_SECTION_ID ||
      /^contract\s+signing(s)?$/i.test(section.title.trim());

    stripped.push({
      ...section,
      fieldApiNames,
      ...(isLegacySigningsSection ?
        { id: section.id, title: section.title }
      : {}),
    });
  }

  const signingFields = CONTRACT_SIGNINGS_FIELD_API_NAMES.filter((api) => presentSlots.has(api));
  if (signingFields.length === 0) return stripped;

  const signingsSection: CrmRecordSection = {
    id: CONTRACT_SIGNINGS_SECTION_ID,
    title: CONTRACT_SIGNINGS_SECTION_TITLE,
    fieldApiNames: [...signingFields],
    kind: "fields",
  };

  const insertBeforeIds = new Set([
    "scheduled",
    "contract-signing",
    CONTRACT_SIGNINGS_SECTION_ID,
    "system",
  ]);
  let insertAt = stripped.length;
  for (let i = 0; i < stripped.length; i++) {
    const s = stripped[i];
    if (insertBeforeIds.has(s.id) || /scheduled/i.test(s.title)) {
      insertAt = i;
      break;
    }
  }

  const withoutDuplicateSignings = stripped.filter(
    (s) =>
      s.id !== CONTRACT_SIGNINGS_SECTION_ID &&
      s.id !== "contract-signing" &&
      !/^contract\s+signing(s)?$/i.test(s.title.trim()),
  );

  const result = [...withoutDuplicateSignings];
  result.splice(insertAt, 0, signingsSection);
  return result;
}

export const SCHEDULED_SECTION_ID = "scheduled";
export const SCHEDULED_SECTION_TITLE = "Scheduled";
export const SCHEDULED_SERVICE_TOGGLE_API_NAME = "Scheduled_Service";

/** Fixed order for the Scheduled block on record detail (canonical API names). */
export const SCHEDULED_FIELD_API_NAMES = [
  "Scheduled_Service",
  "Scheduling_Status",
  "1st_Service_Scheduling_Deadline",
  "1st_Service_Confirmed_Scheduled_Date",
  "1st_Service_Completed_Date",
  "2nd_Service_Scheduling_Deadline",
  "2nd_Service_Confirmed_Scheduled_Date",
  "2nd_Service_Completed_Date",
  "3rd_Service_Scheduling_Deadline",
  "3rd_Service_Confirmed_Scheduled_Date",
  "3rd_Service_Completed_Date",
  "Scheduled_Service_Notes",
] as const;

const SCHEDULED_FIELD_CANONICAL_SET = new Set<string>(SCHEDULED_FIELD_API_NAMES);

export function isScheduledSectionFieldApiName(apiName: string): boolean {
  const canonical = normalizeContractFieldApiName(apiName);
  return SCHEDULED_FIELD_CANONICAL_SET.has(canonical);
}

/**
 * Pull scheduled-service fields into a dedicated section (removes them from other sections).
 * When `catalog` is provided, includes fields that exist in metadata but not on the Zoho layout.
 */
export function applyScheduledSection(
  sections: CrmRecordSection[],
  catalog?: CrmFieldMeta[],
): CrmRecordSection[] {
  const presentSlots = new Set<string>();

  if (catalog?.length) {
    for (const field of filterCatalogForRecordView(catalog)) {
      if (isScheduledSectionFieldApiName(field.apiName)) {
        presentSlots.add(normalizeContractFieldApiName(field.apiName));
      }
    }
  }

  const stripped: CrmRecordSection[] = [];

  for (const section of sections) {
    const fieldApiNames: string[] = [];
    for (const api of section.fieldApiNames) {
      const canonical = normalizeContractFieldApiName(api);
      if (isScheduledSectionFieldApiName(canonical)) {
        presentSlots.add(canonical);
        continue;
      }
      fieldApiNames.push(api);
    }

    if (fieldApiNames.length === 0 && section.kind !== "subform") continue;

    stripped.push({ ...section, fieldApiNames });
  }

  const scheduledFields = SCHEDULED_FIELD_API_NAMES.filter((api) => presentSlots.has(api));
  if (scheduledFields.length === 0) return stripped;

  const scheduledSection: CrmRecordSection = {
    id: SCHEDULED_SECTION_ID,
    title: SCHEDULED_SECTION_TITLE,
    fieldApiNames: [...scheduledFields],
    kind: "fields",
  };

  const insertBeforeIds = new Set(["system"]);
  let insertAt = stripped.length;
  for (let i = 0; i < stripped.length; i++) {
    const s = stripped[i];
    if (insertBeforeIds.has(s.id) || /^system$/i.test(s.title.trim())) {
      insertAt = i;
      break;
    }
  }

  const withoutDuplicateScheduled = stripped.filter(
    (s) =>
      s.id !== SCHEDULED_SECTION_ID && !/^scheduled$/i.test(s.title.trim()),
  );

  const result = [...withoutDuplicateScheduled];
  result.splice(insertAt, 0, scheduledSection);
  return result;
}

export function finalizeRecordSections(
  sections: CrmRecordSection[],
  catalog?: CrmFieldMeta[],
): CrmRecordSection[] {
  return applyScheduledSection(applyContractSigningsSection(sections, catalog), catalog);
}

/** Rows visible in Scheduled; `showDetails` follows the interactive Scheduled Service toggle. */
export function filterScheduledSectionRows(
  rows: RecordFieldRow[],
  showDetails: boolean,
): RecordFieldRow[] {
  const toggleCanonical = SCHEDULED_SERVICE_TOGGLE_API_NAME;

  if (showDetails) return rows;

  return rows.filter(
    (row) => normalizeContractFieldApiName(row.apiName) === toggleCanonical,
  );
}

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
      id: CONTRACT_SIGNINGS_SECTION_ID,
      title: CONTRACT_SIGNINGS_SECTION_TITLE,
      test: (api) => isContractSigningsFieldApiName(api),
    },
    {
      id: SCHEDULED_SECTION_ID,
      title: SCHEDULED_SECTION_TITLE,
      test: (api) => isScheduledSectionFieldApiName(api),
    },
    {
      id: "system",
      title: "System",
      test: (api) =>
        /^(Created|Modified)_(By|Time)|RecordID|Tag|Last_Activity/i.test(api) ||
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

/** Zoho layout section for retired / deleted fields — hidden from this app. */
export function isDeletedFieldsLayoutSection(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return normalized === "deleted fields" || /^deleted\s+field(s)?$/i.test(normalized);
}

function collectSectionFieldApiNames(section: {
  fields?: { api_name?: string; sequence_number?: number }[];
  columns?: { fields?: { api_name?: string; sequence_number?: number }[] }[];
}): string[] {
  const ordered: { api: string; seq: number }[] = [];

  const pushField = (raw: { api_name?: string; sequence_number?: number } | undefined) => {
    const api = raw?.api_name?.trim();
    if (!api || api === "id") return;
    const canonical = normalizeContractFieldApiName(api);
    if (isExcludedContractFieldApiName(canonical)) return;
    ordered.push({
      api: canonical,
      seq: Number(raw?.sequence_number ?? ordered.length),
    });
  };

  for (const field of section.fields ?? []) {
    pushField(field);
  }

  for (const column of section.columns ?? []) {
    for (const field of column.fields ?? []) {
      pushField(field);
    }
  }

  ordered.sort((a, b) => a.seq - b.seq);

  const fieldApiNames: string[] = [];
  for (const { api } of ordered) {
    if (!fieldApiNames.includes(api)) fieldApiNames.push(api);
  }
  return fieldApiNames;
}

export type ParsedZohoContractLayout = {
  sections: CrmRecordSection[];
  droppedSectionFieldApiNames: string[];
};

/** Parse Zoho layout API payload; omits Deleted Fields section and tracks its field API names. */
export function parseZohoLayout(layoutBody: unknown): ParsedZohoContractLayout | null {
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
  const droppedSectionFieldApiNames: string[] = [];
  const droppedSeen = new Set<string>();

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

    const fieldApiNames = collectSectionFieldApiNames(section);

    if (isDeletedFieldsLayoutSection(title)) {
      for (const api of fieldApiNames) {
        if (!droppedSeen.has(api)) {
          droppedSeen.add(api);
          droppedSectionFieldApiNames.push(api);
        }
      }
      continue;
    }

    const isSubform =
      section.type === "subform" ||
      (fieldApiNames.length === 1 &&
        /subform|scope_of_work|line_items/i.test(fieldApiNames[0] ?? ""));

    sections.push({
      id: slugSectionId(title, index),
      title,
      fieldApiNames,
      kind: isSubform ? "subform" : "fields",
    });
  }

  if (sections.length === 0 && droppedSectionFieldApiNames.length === 0) return null;

  return {
    sections: applyContractSigningsSection(sections),
    droppedSectionFieldApiNames,
  };
}

/** Parse Zoho layout API payload into ordered sections (Deleted Fields section omitted). */
export function parseZohoLayoutSections(layoutBody: unknown): CrmRecordSection[] | null {
  const parsed = parseZohoLayout(layoutBody);
  return parsed && parsed.sections.length > 0 ? parsed.sections : null;
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

  return finalizeRecordSections(ordered, catalog);
}

export function mergeSectionsWithCatalog(
  sections: CrmRecordSection[],
  catalog: CrmFieldMeta[],
  getValue: (apiName: string) => string,
  options?: { droppedSectionFieldApiNames?: string[] },
): { section: CrmRecordSection; rows: RecordFieldRow[] }[] {
  sections = finalizeRecordSections(sections, catalog);
  const dropped = new Set(
    (options?.droppedSectionFieldApiNames ?? []).map((name) =>
      normalizeContractFieldApiName(name),
    ),
  );

  const catalogMap = new Map<string, CrmFieldMeta>();
  for (const field of filterCatalogForRecordView(catalog)) {
    if (dropped.has(field.apiName)) continue;
    catalogMap.set(field.apiName, field);
  }

  const usedInSections = new Set<string>();
  const result: { section: CrmRecordSection; rows: RecordFieldRow[] }[] = [];

  for (const section of sections) {
    if (isDeletedFieldsLayoutSection(section.title)) continue;

    const rows: RecordFieldRow[] = [];
    for (const apiName of section.fieldApiNames) {
      const canonical = normalizeContractFieldApiName(apiName);
      if (isExcludedContractFieldApiName(canonical) || dropped.has(canonical)) continue;
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
    if (usedInSections.has(field.apiName) || dropped.has(field.apiName)) continue;
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
  options?: { droppedSectionFieldApiNames?: string[] },
): string[] {
  const dropped = new Set(
    (options?.droppedSectionFieldApiNames ?? []).map((name) =>
      normalizeContractFieldApiName(name),
    ),
  );

  const names = new Set<string>(["Name", "Contract_Status"]);

  const addField = (apiName: string) => {
    const canonical = normalizeContractFieldApiName(apiName);
    if (isExcludedContractFieldApiName(canonical) || dropped.has(canonical)) return;
    names.add(canonical);
  };

  if (sections?.length) {
    for (const section of sections) {
      if (isDeletedFieldsLayoutSection(section.title)) continue;
      for (const apiName of section.fieldApiNames) {
        addField(apiName);
      }
    }
    for (const field of filterCatalogForRecordView(catalog)) {
      addField(field.apiName);
    }
  } else {
    for (const field of filterCatalogForRecordView(catalog)) {
      addField(field.apiName);
    }
  }

  return [...names];
}

/** Subform field API names from Zoho layout (e.g. Scope_of_Work). */
export function collectSubformFieldApiNames(
  sections: CrmRecordSection[] | null | undefined,
): string[] {
  if (!sections?.length) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    if (section.kind !== "subform") continue;
    for (const apiName of section.fieldApiNames) {
      const canonical = normalizeContractFieldApiName(apiName);
      if (!canonical || seen.has(canonical)) continue;
      seen.add(canonical);
      result.push(canonical);
    }
  }
  return result;
}

/* ─── Load layout from Zoho ─── */

/** Parse Zoho layout for a module (Vendors, etc.) without contract-only section rules. */
export function parseZohoModuleLayout(layoutBody: unknown): ParsedZohoContractLayout | null {
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
  const droppedSectionFieldApiNames: string[] = [];
  const droppedSeen = new Set<string>();

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
      type?: string;
      fields?: { api_name?: string }[];
    };

    const title =
      section.display_label?.trim() ||
      section.name?.trim() ||
      section.api_name?.trim() ||
      "Section";

    const fieldApiNames = collectSectionFieldApiNames(section);

    if (isDeletedFieldsLayoutSection(title)) {
      for (const api of fieldApiNames) {
        if (!droppedSeen.has(api)) {
          droppedSeen.add(api);
          droppedSectionFieldApiNames.push(api);
        }
      }
      continue;
    }

    const isSubform =
      section.type === "subform" ||
      (fieldApiNames.length === 1 &&
        /subform|line_items/i.test(fieldApiNames[0] ?? ""));

    sections.push({
      id: slugSectionId(title, index),
      title,
      fieldApiNames,
      kind: isSubform ? "subform" : "fields",
    });
  }

  if (sections.length === 0 && droppedSectionFieldApiNames.length === 0) return null;

  return { sections, droppedSectionFieldApiNames };
}

export async function loadModuleRecordSections(
  module: string,
  catalog: CrmFieldMeta[],
): Promise<{
  sections: CrmRecordSection[];
  droppedSectionFieldApiNames: string[];
  source: "zoho" | "fallback";
}> {
  const url = getZohoModuleLayoutsUrl(module);

  try {
    const { res, body } = await fetchZohoJson(url);
    if (res.ok) {
      const parsed = parseZohoModuleLayout(body);
      if (parsed && (parsed.sections.length > 0 || parsed.droppedSectionFieldApiNames.length > 0)) {
        return {
          sections: parsed.sections,
          droppedSectionFieldApiNames: parsed.droppedSectionFieldApiNames,
          source: "zoho",
        };
      }
    }
  } catch (err) {
    console.error(`Zoho layouts request failed (${module}):`, err);
  }

  return {
    sections: buildFallbackRecordSections(catalog),
    droppedSectionFieldApiNames: [],
    source: "fallback",
  };
}

export async function loadContractsRecordSections(
  catalog: CrmFieldMeta[],
): Promise<{
  sections: CrmRecordSection[];
  droppedSectionFieldApiNames: string[];
  source: "zoho" | "fallback";
}> {
  const url = getZohoModuleLayoutsUrl("Contracts");

  try {
    const { res, body } = await fetchZohoJson(url);
    if (res.ok) {
      const parsed = parseZohoLayout(body);
      if (parsed && (parsed.sections.length > 0 || parsed.droppedSectionFieldApiNames.length > 0)) {
        return {
          sections: finalizeRecordSections(parsed.sections, catalog),
          droppedSectionFieldApiNames: parsed.droppedSectionFieldApiNames,
          source: "zoho",
        };
      }
    }
  } catch (err) {
    console.error("Zoho layouts request failed:", err);
  }

  return {
    sections: finalizeRecordSections(buildFallbackRecordSections(catalog), catalog),
    droppedSectionFieldApiNames: [],
    source: "fallback",
  };
}

/* ─── Contract lookup fields ─── */

const LOOKUP_BASE_PATH: Record<string, string> = {
  Vendor: "/vendors",
  SOW_Name: "/sow",
  SOW: "/sow",
};

/** Vendor and SOW Name in the contracts list / record. */
export function isContractLookupField(apiName: string, label?: string): boolean {
  const canonical = normalizeContractFieldApiName(apiName);
  if (canonical === "Vendor" || canonical === "SOW_Name" || canonical === "SOW") {
    return true;
  }
  return label?.trim().toLowerCase() === "sow name";
}

export function getContractLookupHref(apiName: string, lookupId: string): string | null {
  const id = lookupId.trim();
  if (!id) return null;

  const canonical = normalizeContractFieldApiName(apiName);
  const base = LOOKUP_BASE_PATH[canonical] ?? LOOKUP_BASE_PATH[apiName];
  if (!base) return null;

  return `${base}/${encodeURIComponent(id)}`;
}

export function getContractFieldLookupId(
  lookups: Record<string, string> | undefined,
  apiName: string,
): string | undefined {
  if (!lookups) return undefined;

  const direct = lookups[apiName]?.trim();
  if (direct) return direct;

  const canonical = normalizeContractFieldApiName(apiName);
  if (canonical !== apiName) {
    const fromCanonical = lookups[canonical]?.trim();
    if (fromCanonical) return fromCanonical;
  }

  return undefined;
}

/* ─── Scope of Work subform ─── */

export type ContractScopeOfWorkRow = {
  id: string;
  serviceName: string;
  vendorPrice: string;
  clientPrice: string;
  startDate: string;
  endDate: string;
  numberOfServices: string;
};

function formatOurServicesLabel(value: unknown): string {
  if (value == null || value === "") return "";

  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as { name?: string; id?: string };
    if (obj.name != null && String(obj.name).trim() !== "") return String(obj.name);
    return "";
  }

  const str = String(value).trim();
  if (/^\d{10,}$/.test(str)) return "";
  return str;
}

function formatSubformMoney(value: unknown): string {
  const formatted = formatFieldValue(value);
  if (!formatted) return "";
  const num = Number(String(formatted).replace(/,/g, ""));
  if (!Number.isNaN(num)) {
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return formatted;
}

function formatSubformDate(value: unknown): string {
  const raw = formatFieldValue(value);
  if (!raw) return "";
  return formatCellForDisplay(raw, "date");
}

export function mapContractScopeOfWork(raw: unknown): ContractScopeOfWorkRow[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((row, index) => {
    const r = row as Record<string, unknown>;
    const serviceName = formatOurServicesLabel(r.OurServices ?? r.Our_Services);

    return {
      id: r.id != null ? String(r.id) : `contract-sow-line-${index}`,
      serviceName: serviceName || "—",
      vendorPrice: formatSubformMoney(r.Vendor_Price ?? r.Vendor_Price1),
      clientPrice: formatSubformMoney(
        r.Client_Price ?? r.Invoice_Price ?? r.Client_Price1,
      ),
      startDate: formatSubformDate(r.Start_Date),
      endDate: formatSubformDate(r.End_Date),
      numberOfServices: formatFieldValue(
        r.Number_of_Services ?? r.No_of_Services ?? r.Number_of_Service,
      ),
    };
  });
}

export function isScopeOfWorkSubformSection(fieldApiNames: string[]): boolean {
  return fieldApiNames.some((api) => /scope_of_work/i.test(api));
}

/* ─── Rich text display ─── */

/** Zoho rich-text / long multi-line fields shown as formatted content on record detail. */
const RICH_TEXT_API_NAMES = new Set([
  "Client_Addendum_Rich",
  "Vendor_Addendum_Rich",
  "Contract_Summary",
  "Client_Summary",
  "Internal_Notes_for_Olio_Team",
  "Scheduled_Service_Notes",
  "PO_Notes",
  "Progress_Notes_1",
]);

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function isRichTextField(apiName: string, dataType?: string): boolean {
  const type = (dataType ?? "").toLowerCase();
  if (type === "richtext" || type === "textarea") return true;
  return RICH_TEXT_API_NAMES.has(apiName);
}

/** Strip risky tags/handlers from Zoho rich HTML; keep formatting tags. */
export function sanitizeCrmRichHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/\son\w+\s*=\s*("[\s\S]*?"|'[\s\S]*?'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    /* Drop Zoho empty spacer paragraphs so the layout breathes less awkwardly */
    .replace(/<p[^>]*>\s*(?:<span[^>]*>\s*)?(?:<br\s*\/?>\s*)+(?:\s*<\/span>)?\s*<\/p>/gi, "")
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, "<br>")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sstyle='[^']*'/gi, "");
}

export function shouldRenderAsRichHtml(apiName: string, value: string, dataType?: string): boolean {
  if (!value?.trim()) return false;
  if (looksLikeHtml(value)) return true;
  const type = (dataType ?? "").toLowerCase();
  return type === "richtext";
}

export function shouldUseWideFieldLayout(apiName: string, value: string, dataType?: string): boolean {
  if (!value?.trim()) return false;
  if (isRichTextField(apiName, dataType)) return true;
  if (looksLikeHtml(value)) return true;
  return value.includes("\n") && value.length > 80;
}

/** Plain-text snippet for titles/tooltips when a cell holds Zoho HTML. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
