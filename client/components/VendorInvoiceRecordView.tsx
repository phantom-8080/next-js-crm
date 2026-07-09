"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
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
import {
  formatCellForDisplay,
  isDateLikeField,
  isUrlLikeField,
  looksLikeHttpUrl,
} from "@/lib/contractColumns";
import type { CrmRecordSection, RecordFieldRow } from "@/lib/contractRecordLayout";
import {
  VENDOR_INVOICE_DETAIL_SECTIONS,
  labelForVendorInvoiceField,
} from "@/lib/vendorInvoiceConfig";
import type { VendorInvoiceLineItemRow } from "@/lib/vendorInvoiceStaticDetail";

type VendorInvoiceRecord = {
  id: string;
  fields: Record<string, string>;
};

function StatusPill({ status }: { status: string }) {
  const value = status.trim() || "—";
  const lower = value.toLowerCase();
  const tone =
    lower === "paid" || lower === "closed" ? "crm-status-active"
    : lower === "open" ?
      "bg-amber-100 text-amber-900 ring-amber-600/30 dark:bg-amber-500/20 dark:text-amber-200"
    : "bg-blue-100 text-blue-900 ring-blue-600/30 dark:bg-blue-500/20 dark:text-blue-200";

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
  if (apiName === "Status") return <StatusPill status={value} />;
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

function LineItemsSection({ rows }: { rows: VendorInvoiceLineItemRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-crm-text-muted">No line items on this invoice.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-crm-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-crm-table-head hover:bg-crm-table-head">
            <TableHead className="text-crm-text">Service</TableHead>
            <TableHead className="text-crm-text">Description</TableHead>
            <TableHead className="text-crm-text">Date serviced</TableHead>
            <TableHead className="text-crm-text">Unit</TableHead>
            <TableHead className="text-crm-text">Location</TableHead>
            <TableHead className="text-right text-crm-text">Qty</TableHead>
            <TableHead className="text-right text-crm-text">Rate</TableHead>
            <TableHead className="text-right text-crm-text">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-crm-text">{row.serviceName || "—"}</TableCell>
              <TableCell className="text-crm-text">{row.description || "—"}</TableCell>
              <TableCell className="text-crm-text">{row.dateOfServiced || "—"}</TableCell>
              <TableCell className="text-crm-text">{row.unitNumber || "—"}</TableCell>
              <TableCell className="text-crm-text">{row.locationName || "—"}</TableCell>
              <TableCell className="text-right tabular-nums text-crm-text">
                {row.quantity || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-crm-text">
                {row.rate || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-crm-text">
                {row.total || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type VendorInvoiceRecordViewProps = {
  id: string;
};

const BOOLEAN_FIELDS = new Set([
  "No_Invoice_needed",
  "Status_Validation",
  "Created_from_Widget",
]);

export default function VendorInvoiceRecordView({ id }: VendorInvoiceRecordViewProps) {
  const [record, setRecord] = useState<VendorInvoiceRecord | null>(null);
  const [lineItems, setLineItems] = useState<VendorInvoiceLineItemRow[]>([]);
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
        const res = await fetch(`/api/vendor-invoice/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          record?: VendorInvoiceRecord;
          lineItems?: VendorInvoiceLineItemRow[];
          layoutLabel?: string;
          zohoRecordId?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load record");
        if (!cancelled) {
          setRecord(data.record ?? null);
          setLineItems(data.lineItems ?? []);
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
    if (!record) return "Vendor invoice";
    return record.fields.Name?.trim() || `Vendor invoice ${record.id}`;
  }, [record]);

  const statusValue = record?.fields.Status ?? "";

  const sectionGroups = useMemo(() => {
    if (!record) return [];
    return VENDOR_INVOICE_DETAIL_SECTIONS.map((section) => {
      const crmSection: CrmRecordSection = {
        id: section.title.replace(/\s+/g, "-").toLowerCase(),
        title: section.title,
        fieldApiNames: [...section.fields],
        kind: "fields",
      };
      const rows: RecordFieldRow[] = section.fields.map((apiName) => ({
        apiName,
        label: labelForVendorInvoiceField(apiName),
        value: record.fields[apiName] ?? "",
        dataType:
          isDateLikeField(apiName) ? "date"
          : apiName === "Created_Time" || apiName === "Modified_Time" ? "datetime"
          : BOOLEAN_FIELDS.has(apiName) ? "boolean"
          : apiName === "Exchange_Rate" ? "currency"
          : isUrlLikeField(apiName) ? "url"
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
            <div className="hidden rounded-lg bg-emerald-500/15 p-2 sm:block">
              <Receipt className="size-5 text-emerald-400" />
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
                <h2 className="section-heading text-sm sm:text-base">Line items</h2>
                <p className="mt-0.5 text-xs text-crm-text-muted">
                  Services and amounts on this vendor invoice
                </p>
              </div>
              <div className="px-4 py-4">
                <LineItemsSection rows={lineItems} />
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
