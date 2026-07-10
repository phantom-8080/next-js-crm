"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Menu } from "lucide-react";
import {
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { ContractsCardsLoader, ContractsTableLoader } from "@/components/ContractsTableLoader";
import { ListTable } from "@/components/ListTable";
import { ResizableTableHeadCell } from "@/components/ResizableTableHeadCell";
import { InlineLoadingShimmer, PaginationLoadingShimmer } from "@/components/LoadingShimmer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useResizableColumnWidths } from "@/hooks/useResizableColumnWidths";
import { cn } from "@/lib/utils";
import { formatCellForDisplay, isDateLikeField } from "@/lib/contractColumns";
import { labelForBidsField, BIDS_LIST_FIELDS } from "@/lib/bidsConfig";

const PAGE_SIZE = 100;

type BidRecord = {
  id: string;
  fields: Record<string, string>;
};

function openRecord(recordId: string) {
  window.open(`/bids/${recordId}`, "_blank", "noopener,noreferrer");
}

function StatusPill({ status }: { status: string }) {
  const value = status.trim() || "—";
  const lower = value.toLowerCase();
  const tone =
    lower === "awarded" ? "crm-status-active"
    : lower === "declined" || lower.includes("reject") ?
      "bg-zinc-100 text-zinc-800 ring-zinc-500/20 dark:bg-zinc-700/50 dark:text-zinc-200"
    : "bg-amber-100 text-amber-900 ring-amber-600/30 dark:bg-amber-500/20 dark:text-amber-200";

  return <span className={cn("crm-status-badge ring-1", tone)}>{value}</span>;
}

function isLongTextColumn(apiName: string) {
  return (
    apiName === "Name" ||
    apiName === "Vendor" ||
    apiName === "SOW" ||
    apiName === "Location_Name"
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

function getColumnCellClass(
  col: { apiName: string },
  index: number,
  variant: "head" | "body",
) {
  const isFirst = index === 0;

  if (variant === "head") {
    return cn(
      "column-heading overflow-visible",
      isFirst ? "pl-6 pr-3" : "px-3",
    );
  }

  return cn("overflow-hidden px-3 py-4 text-crm-text", isFirst && "pl-6 pr-3");
}

type BidsTableProps = {
  filtersOpen?: boolean;
  onOpenFilters?: () => void;
  searchCriteria?: string | null;
  customViewId?: string | null;
  onClearSearchCriteria?: () => void;
  onFilteredTotalChange?: (total: number | null) => void;
  onRecordsLoadingChange?: (loading: boolean) => void;
  filterPanelId?: string;
};

function RecordCard({
  row,
  columns,
}: {
  row: BidRecord;
  columns: { apiName: string; label: string; dataType: string }[];
}) {
  const title =
    row.fields.Name?.trim() ||
    row.fields.Bid_Number?.trim() ||
    `Bid ${row.id}`;

  return (
    <article
      role="link"
      tabIndex={0}
      title={title}
      onClick={() => openRecord(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openRecord(row.id);
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

export default function BidsTable({
  filtersOpen = false,
  onOpenFilters,
  searchCriteria = null,
  customViewId = null,
  onClearSearchCriteria,
  onFilteredTotalChange,
  onRecordsLoadingChange,
  filterPanelId = "bids-filters",
}: BidsTableProps) {
  const [records, setRecords] = useState<BidRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columnMeta = useMemo(
    () =>
      BIDS_LIST_FIELDS.map((apiName) => ({
        apiName,
        label: labelForBidsField(apiName),
        dataType: isDateLikeField(apiName) ? "date" : "text",
      })),
    [],
  );

  const fieldsParam = useMemo(
    () => encodeURIComponent(BIDS_LIST_FIELDS.join(",")),
    [],
  );

  useEffect(() => {
    setPage(1);
  }, [searchCriteria, customViewId]);

  useEffect(() => {
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
          `/api/bids?page=${page}&fields=${fieldsParam}${criteriaPart}${cvidPart}`,
        );
        const data = (await res.json()) as {
          records?: BidRecord[];
          totalCount?: number;
          hasMore?: boolean;
          filtered?: boolean;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load bids");
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
          setError(err instanceof Error ? err.message : "Failed to load bids");
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

  const showFilteredBadge = Boolean(searchCriteria || customViewId);

  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;
  const totalLabel =
    totalCount != null ? totalCount.toLocaleString("en-US")
    : loading ? "—"
    : "0";
  const totalSuffix =
    searchCriteria || customViewId ? " matching records" : " total in CRM";

  const colCount = Math.max(1, columnMeta.length);

  const { columnSizeStyle, tableMinWidthPx, beginColumnResize } = useResizableColumnWidths(
    "crm-column-widths-bids-v1",
    columnMeta,
    getColumnWidthPx,
  );

  const tableWidthStyle = useMemo(
    (): CSSProperties => ({
      width: tableMinWidthPx,
      minWidth: tableMinWidthPx,
    }),
    [tableMinWidthPx],
  );

  function renderTableHeadRow() {
    return (
      <TableRow className="border-crm-border hover:bg-transparent">
        {columnMeta.map((col, i) => (
          <ResizableTableHeadCell
            key={col.apiName}
            className={getColumnCellClass(col, i, "head")}
            style={columnSizeStyle(col)}
            label={col.label}
            showDivider={i < columnMeta.length - 1}
            onResizeStart={(clientX) => beginColumnResize(col.apiName, clientX, col)}
          />
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
            <h1 className="page-heading truncate text-base sm:text-lg">Bids</h1>
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
              <ListTable
                tableWidthStyle={tableWidthStyle}
                columns={columnMeta}
                columnSizeStyle={columnSizeStyle}
                headerRow={renderTableHeadRow()}
              >
                <ContractsTableLoader
                  columns={columnMeta}
                  getCellClassName={(col, i) => getColumnCellClass(col, i, "body")}
                  getCellStyle={(col) => columnSizeStyle(col)}
                />
              </ListTable>
            </div>
          </>
        : <>
            <div className="space-y-3 overflow-auto p-3 md:hidden">
              {records.length === 0 ?
                <p className="py-12 text-center text-sm text-crm-text-muted">
                  No bids found.
                </p>
              : records.map((row) => (
                  <RecordCard key={row.id} row={row} columns={columnMeta} />
                ))
              }
            </div>
            <div className="hidden min-h-0 flex-1 flex-col md:flex">
              <ListTable
                tableWidthStyle={tableWidthStyle}
                columns={columnMeta}
                columnSizeStyle={columnSizeStyle}
                headerRow={renderTableHeadRow()}
              >
                <TableBody>
                    {records.length === 0 ?
                      <TableRow className="border-crm-border hover:bg-transparent">
                        <TableCell
                          colSpan={colCount}
                          className="px-6 py-12 text-center text-sm text-crm-text-muted"
                        >
                          No bids found.
                        </TableCell>
                      </TableRow>
                    : records.map((row) => (
                        <TableRow
                          key={row.id}
                          role="link"
                          tabIndex={0}
                          className="crm-row-hover cursor-pointer border-crm-border text-crm-text"
                          onClick={() => openRecord(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openRecord(row.id);
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
              </ListTable>
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
