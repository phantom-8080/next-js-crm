"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { ContractRecordSections } from "@/components/ContractRecordSections";
import {
  ContractRecordHeaderSkeleton,
  ContractRecordLoader,
} from "@/components/ContractRecordLoader";
import { cn } from "@/lib/utils";
import {
  buildFallbackRecordSections,
  mergeSectionsWithCatalog,
  type CrmRecordSection,
} from "@/lib/contractRecordLayout";
import {
  type ContractRecord,
  type CrmFieldMeta,
  FALLBACK_FIELD_CATALOG,
  formatCellForDisplay,
  getContractFieldDisplayValue,
  isStatusField,
  isUrlLikeField,
  looksLikeHttpUrl,
} from "@/lib/contractColumns";

type ContractStatus = "Active" | "Closed";

function normalizeStatus(value: string): ContractStatus {
  return value.trim().toLowerCase() === "closed" ? "Closed" : "Active";
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  return (
    <span
      className={cn(
        "crm-status-badge",
        normalized === "Active" ? "crm-status-active" : "crm-status-closed",
      )}
    >
      {normalized}
    </span>
  );
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
  const display = formatCellForDisplay(value, dataType);
  if (!display) return <span className="text-crm-text-muted">—</span>;
  if (isStatusField(apiName)) return <StatusBadge status={display} />;

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

type ContractRecordViewProps = {
  id: string;
};

export default function ContractRecordView({ id }: ContractRecordViewProps) {
  const [fieldCatalog, setFieldCatalog] = useState<CrmFieldMeta[]>(FALLBACK_FIELD_CATALOG);
  const [recordSections, setRecordSections] = useState<CrmRecordSection[]>(() =>
    buildFallbackRecordSections(FALLBACK_FIELD_CATALOG),
  );
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFieldsThenRecord() {
      setLoading(true);
      setError(null);

      try {
        const fieldsRes = await fetch("/api/contracts/fields", { cache: "no-store" });
        const fieldsData = (await fieldsRes.json()) as {
          fields?: CrmFieldMeta[];
          sections?: CrmRecordSection[] | null;
        };
        if (!cancelled && fieldsRes.ok && fieldsData.fields?.length) {
          setFieldCatalog(fieldsData.fields);
          if (fieldsData.sections?.length) {
            setRecordSections(fieldsData.sections);
          } else {
            setRecordSections(buildFallbackRecordSections(fieldsData.fields));
          }
        }
      } catch {
        /* keep fallback catalog */
      }

      if (cancelled) return;

      try {
        const res = await fetch(`/api/contracts/${encodeURIComponent(id)}?scope=detail`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          contract?: ContractRecord;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load contract");
        }

        if (!cancelled) {
          setContract(data.contract ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load contract");
          setContract(null);
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
    if (!contract) return "Contract";
    const name = contract.fields.Name?.trim();
    if (name) return name;
    return `Contract ${contract.id}`;
  }, [contract]);

  const statusValue = contract?.fields.Contract_Status ?? "";

  const sectionGroups = useMemo(() => {
    if (!contract) return [];
    return mergeSectionsWithCatalog(recordSections, fieldCatalog, (apiName) =>
      getContractFieldDisplayValue(contract.fields, apiName),
    );
  }, [contract, fieldCatalog, recordSections]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-md border border-crm-border bg-crm-panel">
      <div className="shrink-0 border-b border-crm-border px-3 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="hidden rounded-lg bg-blue-500/15 p-2 sm:block">
              <FileText className="size-5 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              {loading ?
                <ContractRecordHeaderSkeleton />
              : <>
                  <h1 className="page-heading truncate text-base sm:text-lg">{title}</h1>
                  {contract ?
                    <p className="mt-0.5 font-mono text-xs text-crm-text-muted">ID {contract.id}</p>
                  : null}
                </>
              }
            </div>
            {!loading && statusValue ?
              <div className="ml-auto shrink-0">
                <StatusBadge status={statusValue} />
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
        : contract ?
          <ContractRecordSections
            groups={sectionGroups}
            renderFieldValue={(props) => <FieldValue {...props} />}
          />
        : !error ?
          <p className="py-12 text-center text-sm text-crm-text-muted">Contract not found.</p>
        : null}
      </div>
    </div>
  );
}
