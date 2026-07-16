"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSignature } from "lucide-react";
import { ContractRecordSections } from "@/components/ContractRecordSections";
import {
  ContractRecordHeaderSkeleton,
  ContractRecordLoader,
} from "@/components/ContractRecordLoader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCellForDisplay, isDateLikeField } from "@/lib/contractColumns";
import type { CrmRecordSection, RecordFieldRow } from "@/lib/contractRecordLayout";
import { labelForSowField, SOW_DETAIL_SECTIONS } from "@/lib/sowConfig";
import type { SowScopeOfWorkRow } from "@/lib/sowStaticDetail";

type SowRecord = {
  id: string;
  fields: Record<string, string>;
};

function StagePill({ stage }: { stage: string }) {
  const value = stage.trim() || "—";
  const lower = value.toLowerCase();
  const tone =
    lower.includes("won") || lower.includes("active") ? "crm-status-active"
    : "bg-zinc-100 text-zinc-800 ring-zinc-500/20 dark:bg-zinc-700/50 dark:text-zinc-200";

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
  if (apiName === "Stage") return <StagePill stage={value} />;
  if (apiName === "SOW_Summary" && value) {
    return (
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm text-crm-text">
        {value}
      </pre>
    );
  }
  const display = formatCellForDisplay(value, dataType);
  if (!display) return <span className="text-crm-text-muted">—</span>;
  return <span className="break-words text-crm-text">{display}</span>;
}

function ScopeOfWorkSection({ rows }: { rows: SowScopeOfWorkRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-crm-text-muted">No scope of work lines on this record.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-crm-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-crm-table-head hover:bg-crm-table-head">
            <TableHead className="text-crm-text">Service</TableHead>
            <TableHead className="text-crm-text">Category</TableHead>
            <TableHead className="text-crm-text">Start</TableHead>
            <TableHead className="text-crm-text">End</TableHead>
            <TableHead className="text-right text-crm-text">Client price</TableHead>
            <TableHead className="text-right text-crm-text">Vendor price</TableHead>
            <TableHead className="text-right text-crm-text">Vendor target</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-crm-text">{row.serviceName}</TableCell>
              <TableCell className="text-crm-text">{row.category || "—"}</TableCell>
              <TableCell className="tabular-nums text-crm-text">{row.startDate || "—"}</TableCell>
              <TableCell className="tabular-nums text-crm-text">{row.endDate || "—"}</TableCell>
              <TableCell className="text-right tabular-nums text-crm-text">
                {row.invoicePrice || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-crm-text">
                {row.vendorPrice || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-crm-text">
                {row.vendorTargetPrice || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type SowRecordViewProps = {
  id: string;
};

export default function SowRecordView({ id }: SowRecordViewProps) {
  const [record, setRecord] = useState<SowRecord | null>(null);
  const [scopeOfWork, setScopeOfWork] = useState<SowScopeOfWorkRow[]>([]);
  const [layoutLabel, setLayoutLabel] = useState("");
  const [zohoRecordId, setZohoRecordId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sow/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = (await res.json()) as {
          record?: SowRecord;
          scopeOfWork?: SowScopeOfWorkRow[];
          layoutLabel?: string;
          zohoRecordId?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load record");
        if (!cancelled) {
          setRecord(data.record ?? null);
          setScopeOfWork(data.scopeOfWork ?? []);
          setLayoutLabel(data.layoutLabel ?? "");
          setZohoRecordId(data.zohoRecordId ?? "");
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

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const title = useMemo(() => {
    if (!record) return "SOW";
    return (
      record.fields.Deal_Name?.trim() ||
      record.fields.SOWID?.trim() ||
      `SOW ${record.id}`
    );
  }, [record]);

  const stageValue = record?.fields.Stage ?? "";

  const sectionGroups = useMemo(() => {
    if (!record) return [];
    return SOW_DETAIL_SECTIONS.map((section) => {
      const crmSection: CrmRecordSection = {
        id: section.title.replace(/\s+/g, "-").toLowerCase(),
        title: section.title,
        fieldApiNames: [...section.fields],
        kind: "fields",
      };
      const rows: RecordFieldRow[] = section.fields.map((apiName) => ({
        apiName,
        label: labelForSowField(apiName),
        value: record.fields[apiName] ?? "",
        dataType:
          isDateLikeField(apiName) ? "date"
          : apiName === "Created_Time" || apiName === "Modified_Time" ? "datetime"
          : apiName === "Site_Acreage" ? "double"
          : apiName === "Is_OTS_SOW" ? "boolean"
          : "text",
      }));
      return { section: crmSection, rows };
    });
  }, [record]);

  const displayRecordId = zohoRecordId || record?.id || "";

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-md border border-crm-border bg-crm-panel">
      <div className="shrink-0 border-b border-crm-border px-3 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="hidden rounded-lg bg-blue-500/15 p-2 sm:block">
              <FileSignature className="size-5 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              {loading ?
                <ContractRecordHeaderSkeleton />
              : <>
                  <h1 className="page-heading truncate text-base sm:text-lg">{title}</h1>
                  {displayRecordId ?
                    <p className="mt-0.5 font-mono text-xs text-crm-text-muted">
                      ID {displayRecordId}
                    </p>
                  : null}
                  {layoutLabel ?
                    <p className="mt-1 text-xs text-crm-text-muted">{layoutLabel}</p>
                  : null}
                </>
              }
            </div>
            {!loading && stageValue ?
              <div className="ml-auto shrink-0">
                <StagePill stage={stageValue} />
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
          "min-h-0 flex-1 px-3 py-4 sm:px-6 sm:py-6",
          loading ? "flex flex-col overflow-hidden" : "overflow-auto overscroll-contain",
        )}
      >
        {loading ?
          <ContractRecordLoader className="min-h-0 flex-1" />
        : record ?
          <div className="space-y-4">
            <ContractRecordSections
              groups={sectionGroups}
              renderFieldValue={(props) => <FieldValue {...props} />}
            />
            <section className="overflow-hidden rounded-lg border border-crm-border bg-crm-panel">
              <div className="border-b border-crm-border px-4 py-3">
                <h2 className="section-heading text-sm sm:text-base">Scope of work</h2>
                <p className="mt-0.5 text-xs text-crm-text-muted">Line items on this SOW</p>
              </div>
              <div className="px-4 py-4">
                <ScopeOfWorkSection rows={scopeOfWork} />
              </div>
            </section>
          </div>
        : !error ?
          <p className="py-12 text-center text-sm text-crm-text-muted">Record not found.</p>
        : null}
      </div>
    </div>
  );
}
