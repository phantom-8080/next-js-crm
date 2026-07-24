"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { ContractRecordSections } from "@/components/contracts/ContractRecordSections";
import {
  ContractRecordHeaderSkeleton,
  ContractRecordLoader,
} from "@/components/contracts/ContractRecordLoader";
import { cn } from "@/lib/utils";
import {
  formatCellForDisplay,
  getContractFieldDisplayValue,
  isStatusField,
  isUrlLikeField,
  looksLikeHttpUrl,
  type CrmFieldMeta,
  FALLBACK_FIELD_CATALOG,
} from "@/lib/contracts/columns";
import {
  buildFallbackRecordSections,
  mergeSectionsWithCatalog,
  type CrmRecordSection,
} from "@/lib/contracts/recordLayout";
import { VENDOR_DETAIL_SECTIONS, labelForVendorField } from "@/lib/vendor";

type VendorRecord = {
  id: string;
  fields: Record<string, string>;
  lookups?: Record<string, string>;
};

function vendorFallbackCatalog(): CrmFieldMeta[] {
  const names = new Set<string>();
  for (const section of VENDOR_DETAIL_SECTIONS) {
    for (const f of section.fields) names.add(f);
  }
  return [...names].map((apiName) => ({
    apiName,
    label: labelForVendorField(apiName),
    dataType:
      apiName === "Created_Time" || apiName === "Modified_Time" ? "datetime"
      : apiName === "Website" ? "url"
      : "text",
  }));
}

function vendorFallbackSections(): CrmRecordSection[] {
  return VENDOR_DETAIL_SECTIONS.map((section) => ({
    id: section.title.replace(/\s+/g, "-").toLowerCase(),
    title: section.title,
    fieldApiNames: [...section.fields],
    kind: "fields" as const,
  }));
}

function StatusPill({ status }: { status: string }) {
  const value = status.trim() || "—";
  const lower = value.toLowerCase();
  const tone =
    lower === "active" ? "crm-status-active"
    : lower === "inactive" ?
      "bg-zinc-100 text-zinc-800 ring-zinc-500/20 dark:bg-zinc-700/50 dark:text-zinc-200"
    : "bg-amber-100 text-amber-900 ring-amber-600/30 dark:bg-amber-500/20 dark:text-amber-200";

  return <span className={cn("crm-status-badge ring-1", tone)}>{value}</span>;
}

function FieldValue({
  apiName,
  value,
  dataType,
}: {
  apiName: string;
  value: string;
  dataType: string;
}) {
  if (apiName === "Vendor_Status" || apiName === "Status" || isStatusField(apiName)) {
    return <StatusPill status={value} />;
  }
  const display = formatCellForDisplay(value, dataType);
  if (!display) return <span className="text-crm-text-muted">—</span>;

  const showAsUrl = looksLikeHttpUrl(display) || isUrlLikeField(apiName, dataType);
  if (showAsUrl) {
    const href = display.trim();
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={href}
        className="block min-w-0 truncate text-crm-link hover:underline"
      >
        {href}
      </a>
    );
  }

  return <span className="break-words text-crm-text">{display}</span>;
}

type VendorRecordViewProps = {
  id: string;
};

export default function VendorRecordView({ id }: VendorRecordViewProps) {
  const [record, setRecord] = useState<VendorRecord | null>(null);
  const [layoutLabel, setLayoutLabel] = useState("");
  const [fieldCatalog, setFieldCatalog] = useState<CrmFieldMeta[]>(() => vendorFallbackCatalog());
  const [recordSections, setRecordSections] = useState<CrmRecordSection[]>(() =>
    vendorFallbackSections(),
  );
  const [layoutDroppedFieldApiNames, setLayoutDroppedFieldApiNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFieldsThenRecord() {
      setLoading(true);
      setError(null);

      try {
        const fieldsRes = await fetch("/api/vendors/fields", { cache: "no-store" });
        const fieldsData = (await fieldsRes.json()) as {
          fields?: CrmFieldMeta[];
          sections?: CrmRecordSection[] | null;
          droppedSectionFieldApiNames?: string[];
        };
        if (!cancelled && fieldsRes.ok && fieldsData.fields?.length) {
          setFieldCatalog(fieldsData.fields);
          setLayoutDroppedFieldApiNames(fieldsData.droppedSectionFieldApiNames ?? []);
          if (fieldsData.sections?.length) {
            setRecordSections(fieldsData.sections);
          } else {
            setRecordSections(buildFallbackRecordSections(fieldsData.fields));
          }
        }
      } catch {
        /* keep fallback catalog / sections */
      }

      if (cancelled) return;

      try {
        const res = await fetch(`/api/vendors/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = (await res.json()) as {
          record?: VendorRecord;
          layoutLabel?: string;
          zohoRecordId?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load record");
        if (!cancelled) {
          setRecord(data.record ?? null);
          setLayoutLabel(data.layoutLabel ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setRecord(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadFieldsThenRecord();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const title = useMemo(() => {
    if (!record) return "Vendor";
    return (
      record.fields.Vendor_Name?.trim() ||
      record.fields.Name?.trim() ||
      "Vendor"
    );
  }, [record]);

  const statusValue =
    record?.fields.Vendor_Status?.trim() ||
    record?.fields.Status?.trim() ||
    "";

  const sectionGroups = useMemo(() => {
    if (!record) return [];
    const catalog = fieldCatalog.length > 0 ? fieldCatalog : FALLBACK_FIELD_CATALOG;
    return mergeSectionsWithCatalog(
      recordSections,
      catalog,
      (apiName) => getContractFieldDisplayValue(record.fields, apiName),
      { droppedSectionFieldApiNames: layoutDroppedFieldApiNames },
    );
  }, [record, fieldCatalog, layoutDroppedFieldApiNames, recordSections]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-md border border-crm-border bg-crm-panel">
      <div className="shrink-0 border-b border-crm-border px-3 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="hidden rounded-lg bg-violet-500/15 p-2 sm:block">
              <Building2 className="size-5 text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              {loading ?
                <ContractRecordHeaderSkeleton />
              : <>
                  <h1 className="page-heading truncate text-base sm:text-lg" title={title}>
                    {title}
                  </h1>
                  {layoutLabel ?
                    <p className="mt-1 text-xs text-crm-text-muted">{layoutLabel}</p>
                  : null}
                </>
              }
            </div>
            {!loading && statusValue ?
              <div className="ml-auto shrink-0">
                <StatusPill status={statusValue} />
              </div>
            : null}
          </div>
        </div>
      </div>

      {error ?
        <div className="border-b border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 sm:px-6 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      : null}

      <div
        className={cn(
          "min-h-0 flex-1 bg-crm-canvas px-3 py-4 sm:px-6 sm:py-6",
          loading ? "flex flex-col overflow-hidden" : "overflow-auto overscroll-contain",
        )}
      >
        {loading ?
          <ContractRecordLoader className="min-h-0 flex-1" />
        : record ?
          <ContractRecordSections
            groups={sectionGroups}
            renderFieldValue={(props) => <FieldValue {...props} />}
          />
        : !error ?
          <p className="py-12 text-center text-sm text-crm-text-muted">Record not found.</p>
        : null}
      </div>
    </div>
  );
}
