"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Menu } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContractsCardsLoader, ContractsTableLoader } from "@/components/ContractsTableLoader";
import { InlineLoadingShimmer, PaginationLoadingShimmer } from "@/components/LoadingShimmer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCellForDisplay, isDateLikeField } from "@/lib/contractColumns";
import {
  labelForVendorInvoiceField,
  VENDOR_INVOICE_LIST_FIELDS,
} from "@/lib/vendorInvoiceConfig";
import type { ContractFieldFilterSelection } from "@/lib/contractFilterTypes";
import {
  filterStaticVendorInvoiceRecords,
  VENDOR_INVOICE_STATIC_ALL_VIEW_ID,
  VENDOR_INVOICE_STATIC_RECORDS,
} from "@/lib/vendorInvoiceStaticData";

const PAGE_SIZE = 100;

type VendorInvoiceRecord = {
  id: string;
  fields: Record<string, string>;
};

const USE_STATIC_LIST_DATA = true;

function openVendorInvoiceRecord(recordId: string) {
  window.open(`/vendor-invoice/${recordId}`, "_blank", "noopener,noreferrer");
}

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

function isLongTextColumn(apiName: string) {
  return (
    apiName === "Name" ||
    apiName === "Vendor" ||
    apiName === "Site" ||
    apiName === "Vendor_Contract"
  );
}

function TruncateWrap({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={title}>
      {children}
    </div>
  );
}

function CellContent({ apiName, value }: { apiName: string; value: string }) {
  if (apiName === "Status") {
    return <StatusPill status={value} />;
  }
  if (isLongTextColumn(apiName)) {
    const display = value || "—";
    return (
      <TruncateWrap title={value || undefined}>
        <span className="text-crm-text">{display}</span>
      </TruncateWrap>
    );
  }
  return (
    <span className={cn("text-crm-text", value && "tabular-nums")}>{value || "—"}</span>
  );
}

function getColumnWidthPx(col: { apiName: string; dataType?: string }) {
  if (col.apiName === "Status") return 128;
  if (isLongTextColumn(col.apiName)) return 220;
  if (isDateLikeField(col.apiName, col.dataType)) return 132;
  return 168;
}

function columnSizeStyle(col: { apiName: string }): CSSProperties {
  const width = getColumnWidthPx(col);
  return { width, minWidth: width, maxWidth: width };
}

function getColumnCellClass(
  col: { apiName: string },
  index: number,
  variant: "head" | "body",
) {
  const isFirst = index === 0;

  if (variant === "head") {
    return cn(
      "column-heading overflow-hidden border-b border-crm-border bg-crm-table-head py-3",
      isFirst ? "pl-6 pr-3" : "px-3",
    );
  }

  return cn("overflow-hidden px-3 py-4 text-crm-text", isFirst && "pl-6 pr-3");
}

type VendorInvoiceTableProps = {
  filtersOpen?: boolean;
  onOpenFilters?: () => void;
  searchCriteria?: string | null;
  customViewId?: string | null;
  fieldSelections?: ContractFieldFilterSelection[];
  onClearSearchCriteria?: () => void;
  onFilteredTotalChange?: (total: number | null) => void;
  onRecordsLoadingChange?: (loading: boolean) => void;
  filterPanelId?: string;
};

function RecordCard({
  row,
  columns,
}: {
  row: VendorInvoiceRecord;
  columns: { apiName: string; label: string; dataType: string }[];
}) {
  const title = row.fields.Name?.trim() || `Vendor invoice ${row.id}`;

  return (
    <article
      role="link"
      tabIndex={0}
      title={title}
      onClick={() => openVendorInvoiceRecord(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openVendorInvoiceRecord(row.id);
        }
      }}
      className="crm-row-hover cursor-pointer rounded-lg border border-crm-border bg-crm-panel p-3 transition hover:border-zinc-400 dark:hover:border-zinc-600"
    >
      <p className="mb-3 truncate text-sm font-medium text-crm-text">{title}</p>
      <dl className="space-y-2.5 text-sm">
        {columns.map((col) => {
          const raw = row.fields[col.apiName] ?? "";
          const value = formatCellForDisplay(raw, col.dataType);
          return (
            <div key={col.apiName}>
              <dt className="column-heading">{col.label}</dt>
              <dd className="mt-0.5">
                <CellContent apiName={col.apiName} value={value} />
              </dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
}

export default function VendorInvoiceTable({
  filtersOpen = false,
  onOpenFilters,
  searchCriteria = null,
  customViewId = null,
  fieldSelections = [],
  onClearSearchCriteria,
  onFilteredTotalChange,
  onRecordsLoadingChange,
  filterPanelId = "vendor-invoice-filters",
}: VendorInvoiceTableProps) {
  const [records, setRecords] = useState<VendorInvoiceRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columnMeta = useMemo(
    () =>
      VENDOR_INVOICE_LIST_FIELDS.map((apiName) => ({
        apiName,
        label: labelForVendorInvoiceField(apiName),
        dataType: isDateLikeField(apiName) ? "date" : "text",
      })),
    [],
  );

  const fieldsParam = useMemo(
    () => encodeURIComponent(VENDOR_INVOICE_LIST_FIELDS.join(",")),
    [],
  );

  useEffect(() => {
    setPage(1);
  }, [searchCriteria, customViewId, fieldSelections]);

  const staticFilteredRecords = useMemo(() => {
    if (!USE_STATIC_LIST_DATA) return [] as VendorInvoiceRecord[];
    return filterStaticVendorInvoiceRecords(VENDOR_INVOICE_STATIC_RECORDS, {
      fieldSelections,
      customViewId,
    });
  }, [fieldSelections, customViewId]);

  const pagedStaticRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return staticFilteredRecords.slice(start, start + PAGE_SIZE);
  }, [staticFilteredRecords, page]);

  const staticHasMore = page * PAGE_SIZE < staticFilteredRecords.length;

  useEffect(() => {
    if (!USE_STATIC_LIST_DATA) return;

    setLoading(true);
    onRecordsLoadingChange?.(true);
    setError(null);

    const timer = window.setTimeout(() => {
      setRecords(pagedStaticRecords);
      const total = staticFilteredRecords.length;
      setTotalCount(total);
      const filtered =
        fieldSelections.length > 0 ||
        (customViewId != null && customViewId !== VENDOR_INVOICE_STATIC_ALL_VIEW_ID);
      if (filtered && onFilteredTotalChange) {
        onFilteredTotalChange(total);
      } else if (!filtered && onFilteredTotalChange) {
        onFilteredTotalChange(null);
      }
      setHasMore(staticHasMore);
      setLoading(false);
      onRecordsLoadingChange?.(false);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [
    pagedStaticRecords,
    staticFilteredRecords.length,
    staticHasMore,
    fieldSelections,
    customViewId,
    onFilteredTotalChange,
    onRecordsLoadingChange,
  ]);

  useEffect(() => {
    if (USE_STATIC_LIST_DATA) return;

    let cancelled = false;

    async function loadRecords() {
      setLoading(true);
      onRecordsLoadingChange?.(true);
      setError(null);

      try {
        const cvidPart =
          customViewId && !searchCriteria ? `&cvid=${encodeURIComponent(customViewId)}` : "";
        const criteriaPart =
          searchCriteria && !customViewId ? `&criteria=${encodeURIComponent(searchCriteria)}` : "";
        const res = await fetch(
          `/api/vendor-invoice?page=${page}&fields=${fieldsParam}${criteriaPart}${cvidPart}`,
        );
        const data = (await res.json()) as {
          records?: VendorInvoiceRecord[];
          totalCount?: number;
          hasMore?: boolean;
          filtered?: boolean;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load vendor invoices");
        }

        if (!cancelled) {
          setRecords(data.records ?? []);
          const total =
            typeof data.totalCount === "number" ?
              data.totalCount
            : (data.records ?? []).length;
          setTotalCount(total);
          if (data.filtered && onFilteredTotalChange) {
            onFilteredTotalChange(total);
          } else if (!searchCriteria && !customViewId && onFilteredTotalChange) {
            onFilteredTotalChange(null);
          }
          setHasMore(Boolean(data.hasMore));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load vendor invoices");
          setRecords([]);
          setTotalCount(null);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          onRecordsLoadingChange?.(false);
        }
      }
    }

    void loadRecords();

    return () => {
      cancelled = true;
    };
  }, [
    page,
    fieldsParam,
    searchCriteria,
    customViewId,
    onFilteredTotalChange,
    onRecordsLoadingChange,
  ]);

  const listFiltersActive = fieldSelections.length > 0;
  const showFilteredBadge =
    listFiltersActive ||
    (customViewId != null && customViewId !== VENDOR_INVOICE_STATIC_ALL_VIEW_ID);

  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;
  const totalLabel =
    totalCount != null ? totalCount.toLocaleString("en-US")
    : loading ? "—"
    : "0";
  const totalSuffix =
    showFilteredBadge ? " matching records" : " sample records";

  const colCount = Math.max(1, columnMeta.length);

  const tableMinWidthPx = useMemo(
    () =>
      Math.max(
        640,
        columnMeta.reduce((sum, col) => sum + getColumnWidthPx(col), 0),
      ),
    [columnMeta],
  );

  const tableWidthStyle = useMemo(
    (): CSSProperties => ({
      width: tableMinWidthPx,
      minWidth: tableMinWidthPx,
    }),
    [tableMinWidthPx],
  );

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncLock = useRef(false);

  const syncHorizontalScroll = useCallback((source: "header" | "body") => {
    if (scrollSyncLock.current) return;
    const header = headerScrollRef.current;
    const body = bodyScrollRef.current;
    if (!header || !body) return;

    scrollSyncLock.current = true;
    if (source === "body") {
      header.scrollLeft = body.scrollLeft;
    } else {
      body.scrollLeft = header.scrollLeft;
    }
    requestAnimationFrame(() => {
      scrollSyncLock.current = false;
    });
  }, []);

  function renderTableHeadRow() {
    return (
      <TableRow className="border-crm-border hover:bg-transparent">
        {columnMeta.map((col, i) => (
          <TableHead
            key={col.apiName}
            className={getColumnCellClass(col, i, "head")}
            style={columnSizeStyle(col)}
          >
            <span className="block truncate">{col.label}</span>
          </TableHead>
        ))}
      </TableRow>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-crm-border bg-crm-panel">
      <div className="relative z-20 shrink-0 border-b border-crm-border bg-crm-panel px-3 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {onOpenFilters ?
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="crm-toolbar-btn inline-flex size-10 max-md:inline-flex md:hidden"
              onClick={onOpenFilters}
              aria-controls={filterPanelId}
              aria-expanded={filtersOpen}
              aria-label="Open filters menu"
            >
              <Menu className="size-5" />
            </Button>
          : null}
          <div className="flex min-w-0 flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 sm:gap-x-3">
            <h1 className="page-heading truncate text-base sm:text-lg">Vendor invoice</h1>
            {(showFilteredBadge) && onClearSearchCriteria ?
              <button
                type="button"
                onClick={() => {
                  onClearSearchCriteria();
                  setPage(1);
                }}
                className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 transition hover:bg-blue-500/20"
              >
                Filtered · Clear
              </button>
            : null}
            <span className="text-sm text-crm-text-muted">
              {loading ?
                <InlineLoadingShimmer />
              : <>
                  <span className="font-medium tabular-nums text-crm-text">{totalLabel}</span>
                  {totalSuffix}
                </>
              }
            </span>
          </div>
          <ThemeToggle className="crm-toolbar-btn size-10" />
        </div>
      </div>
      {error ?
        <div className="border-b border-red-900/50 bg-red-950/40 px-3 py-3 text-sm text-red-300 sm:px-6">
          {error}
        </div>
      : null}
      <div className="relative z-0 flex min-h-0 flex-1 flex-col">
        {loading ?
          <>
            <ContractsCardsLoader />
            <div className="hidden min-h-0 flex-1 flex-col md:flex">
              <div
                ref={headerScrollRef}
                className="contracts-table-header-scroll shrink-0 border-b border-crm-border bg-crm-table-head"
                onScroll={() => syncHorizontalScroll("header")}
              >
                <Table className="table-fixed" style={tableWidthStyle}>
                  <TableHeader>{renderTableHeadRow()}</TableHeader>
                </Table>
              </div>
              <div
                ref={bodyScrollRef}
                className="contracts-table-scroll min-h-0 flex-1 overscroll-contain"
                onScroll={() => syncHorizontalScroll("body")}
              >
                <Table className="table-fixed" style={tableWidthStyle}>
                  <ContractsTableLoader
                    columns={columnMeta}
                    getCellClassName={(col, i) => getColumnCellClass(col, i, "body")}
                    getCellStyle={(col) => columnSizeStyle(col)}
                  />
                </Table>
              </div>
            </div>
          </>
        : <>
            <div className="space-y-3 overflow-auto p-3 md:hidden">
              {records.length === 0 ?
                <p className="py-12 text-center text-sm text-crm-text-muted">
                  No vendor invoices found.
                </p>
              : records.map((row) => (
                  <RecordCard key={row.id} row={row} columns={columnMeta} />
                ))
              }
            </div>
            <div className="hidden min-h-0 flex-1 flex-col md:flex">
              <div
                ref={headerScrollRef}
                className="contracts-table-header-scroll shrink-0 border-b border-crm-border bg-crm-table-head"
                onScroll={() => syncHorizontalScroll("header")}
              >
                <Table className="table-fixed" style={tableWidthStyle}>
                  <TableHeader>{renderTableHeadRow()}</TableHeader>
                </Table>
              </div>
              <div
                ref={bodyScrollRef}
                className="contracts-table-scroll min-h-0 flex-1 overscroll-contain"
                onScroll={() => syncHorizontalScroll("body")}
              >
                <Table className="table-fixed" style={tableWidthStyle}>
                  <TableBody>
                    {records.length === 0 ?
                      <TableRow className="border-crm-border hover:bg-transparent">
                        <TableCell
                          colSpan={colCount}
                          className="px-6 py-12 text-center text-sm text-crm-text-muted"
                        >
                          No vendor invoices found.
                        </TableCell>
                      </TableRow>
                    : records.map((row) => (
                        <TableRow
                          key={row.id}
                          role="link"
                          tabIndex={0}
                          className="crm-row-hover cursor-pointer border-crm-border text-crm-text"
                          onClick={() => openVendorInvoiceRecord(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openVendorInvoiceRecord(row.id);
                            }
                          }}
                        >
                          {columnMeta.map((col, i) => {
                            const raw = row.fields[col.apiName] ?? "";
                            const value = formatCellForDisplay(raw, col.dataType);
                            return (
                              <TableCell
                                key={col.apiName}
                                className={getColumnCellClass(col, i, "body")}
                                style={columnSizeStyle(col)}
                              >
                                <CellContent apiName={col.apiName} value={value} />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        }
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-crm-border bg-crm-panel px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="crm-toolbar-btn w-full disabled:cursor-not-allowed sm:w-auto"
          disabled={loading || page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <span className="text-center text-xs text-crm-text-muted sm:text-left">
          {loading ?
            <PaginationLoadingShimmer />
          : totalPages != null ?
            <>
              Page <span className="tabular-nums text-crm-text">{page}</span> /{" "}
              <span className="tabular-nums text-crm-text">
                {totalPages.toLocaleString("en-US")}
              </span>
            </>
          : null}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="crm-toolbar-btn w-full disabled:cursor-not-allowed sm:w-auto"
          disabled={loading || !hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Next 100
        </Button>
      </div>
    </div>
  );
}
