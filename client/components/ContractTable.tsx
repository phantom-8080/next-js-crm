"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Menu, Settings2 } from "lucide-react";
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
import { ContractColumnsSettings } from "@/components/ContractColumnsSettings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useContractVisibleColumns } from "@/hooks/useContractVisibleColumns";
import { cn } from "@/lib/utils";
import {
  buildFieldsQueryParam,
  type ContractRecord,
  type CrmFieldMeta,
  FALLBACK_FIELD_CATALOG,
  formatCellForDisplay,
  getContractFieldDisplayValue,
  isDateLikeField,
  isStatusField,
  normalizeContractFieldApiName,
  normalizeVisibleApiNames,
} from "@/lib/contractColumns";

function openContractRecord(recordId: string) {
  window.open(`/contracts/${recordId}`, "_blank", "noopener,noreferrer");
}

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

function isLongTextColumn(apiName: string) {
  return (
    apiName === "Vendor" ||
    apiName === "Company_Name" ||
    apiName === "Name" ||
    apiName === "Site"
  );
}

function TruncateWrap({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
      title={title}
    >
      {children}
    </div>
  );
}

function CellContent({
  apiName,
  value,
}: {
  apiName: string;
  value: string;
}) {
  if (isStatusField(apiName)) {
    return <StatusBadge status={value || "Active"} />;
  }
  if (apiName === "Vendor" || apiName === "Company_Name" || apiName === "Name" || isLongTextColumn(apiName)) {
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
  if (isStatusField(col.apiName)) return 128;
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

const PAGE_SIZE = 100;

type ContractsTableProps = {
  filtersOpen?: boolean;
  onOpenFilters?: () => void;
};

function ContractCard({
  row,
  columns,
}: {
  row: ContractRecord;
  columns: { apiName: string; label: string; dataType: string }[];
}) {
  const title =
    row.fields.Name?.trim() ||
    row.fields.Company_Name?.trim() ||
    row.fields.Vendor?.trim() ||
    `Contract ${row.id}`;

  return (
    <article
      role="link"
      tabIndex={0}
      title={title}
      onClick={() => openContractRecord(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openContractRecord(row.id);
        }
      }}
      className="crm-row-hover cursor-pointer rounded-lg border border-crm-border bg-crm-panel p-3 transition hover:border-zinc-400 dark:hover:border-zinc-600"
    >
      <p className="mb-3 truncate text-sm font-medium text-crm-text">{title}</p>
      <dl className="space-y-2.5 text-sm">
        {columns.map((col) => {
          const value = formatCellForDisplay(
            getContractFieldDisplayValue(row.fields, col.apiName),
            col.dataType,
          );
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

export default function ContractsTable({
  filtersOpen = false,
  onOpenFilters,
}: ContractsTableProps) {
  const { visibleApiNames, setVisibleApiNames } = useContractVisibleColumns();
  const [fieldCatalog, setFieldCatalog] = useState<CrmFieldMeta[]>(FALLBACK_FIELD_CATALOG);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleFieldsLoaded = useCallback((fields: CrmFieldMeta[]) => {
    setFieldCatalog(fields);
  }, []);

  const columnsToShow = useMemo(
    () => normalizeVisibleApiNames(visibleApiNames),
    [visibleApiNames],
  );

  const columnMeta = useMemo(() => {
    const byApi = new Map<string, CrmFieldMeta>();
    for (const field of fieldCatalog) {
      byApi.set(field.apiName, field);
      byApi.set(normalizeContractFieldApiName(field.apiName), field);
    }
    return columnsToShow.map((apiName: string) => {
      const meta = byApi.get(apiName);
      return {
        apiName,
        label: meta?.label ?? apiName.replace(/_/g, " "),
        dataType: meta?.dataType ?? "text",
      };
    });
  }, [fieldCatalog, columnsToShow]);

  const fieldsParam = useMemo(
    () => encodeURIComponent(buildFieldsQueryParam(columnsToShow)),
    [columnsToShow],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadContracts() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/contracts?page=${page}&fields=${fieldsParam}`);
        const data = (await res.json()) as {
          contracts?: ContractRecord[];
          totalCount?: number;
          hasMore?: boolean;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load contracts");
        }

        if (!cancelled) {
          setContracts(data.contracts ?? []);
          setTotalCount(
            typeof data.totalCount === "number" ? data.totalCount : (data.contracts ?? []).length,
          );
          setHasMore(Boolean(data.hasMore));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load contracts");
          setContracts([]);
          setTotalCount(null);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadContracts();

    return () => {
      cancelled = true;
    };
  }, [page, fieldsParam]);

  const applyColumns = useCallback(
    (apiNames: string[]) => {
      setVisibleApiNames(apiNames);
      setPage(1);
    },
    [setVisibleApiNames],
  );

  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;
  const totalLabel =
    totalCount != null ? totalCount.toLocaleString("en-US")
    : loading ? "—"
    : "0";

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
        {columnMeta.map(
          (col: { apiName: string; label: string; dataType: string }, i: number) => (
            <TableHead
              key={col.apiName}
              className={getColumnCellClass(col, i, "head")}
              style={columnSizeStyle(col)}
            >
              <span className="block truncate">{col.label}</span>
            </TableHead>
          ),
        )}
      </TableRow>
    );
  }

  return (
    <>
      <ContractColumnsSettings
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        visibleApiNames={visibleApiNames}
        onApply={applyColumns}
        onFieldsLoaded={handleFieldsLoaded}
      />

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
                aria-controls="contracts-filters"
                aria-expanded={filtersOpen}
                aria-label="Open filters menu"
              >
                <Menu className="size-5" />
              </Button>
            : null}
            <div className="min-w-0 flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 sm:gap-x-3">
              <h1 className="page-heading truncate text-base sm:text-lg">Contracts</h1>
              <span className="text-sm text-crm-text-muted">
                {loading ?
                  <InlineLoadingShimmer />
                : <>
                    <span className="font-medium tabular-nums text-crm-text">{totalLabel}</span>
                    {" total in CRM"}
                  </>
                }
              </span>
            </div>
            <ThemeToggle className="crm-toolbar-btn size-10" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="crm-toolbar-btn size-10"
              onClick={() => setColumnsOpen(true)}
              aria-label="Manage table columns"
            >
              <Settings2 className="size-5" />
            </Button>
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
                {contracts.length === 0 ?
                  <p className="py-12 text-center text-sm text-crm-text-muted">No contracts found.</p>
                : contracts.map((row) => (
                    <ContractCard key={row.id} row={row} columns={columnMeta} />
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
                      {contracts.length === 0 ?
                        <TableRow className="border-crm-border hover:bg-transparent">
                          <TableCell
                            colSpan={colCount}
                            className="px-6 py-12 text-center text-sm text-crm-text-muted"
                          >
                            No contracts found.
                          </TableCell>
                        </TableRow>
                      : contracts.map((row) => (
                          <TableRow
                            key={row.id}
                            role="link"
                            tabIndex={0}
                            className="crm-row-hover cursor-pointer border-crm-border text-crm-text"
                            onClick={() => openContractRecord(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openContractRecord(row.id);
                              }
                            }}
                          >
                            {columnMeta.map(
                              (
                                col: { apiName: string; label: string; dataType: string },
                                i: number,
                              ) => {
                                const raw = getContractFieldDisplayValue(row.fields, col.apiName);
                                const value = formatCellForDisplay(raw, col.dataType);
                                const cellClass = getColumnCellClass(col, i, "body");
                                return (
                                  <TableCell
                                    key={col.apiName}
                                    className={cellClass}
                                    style={columnSizeStyle(col)}
                                  >
                                    <CellContent apiName={col.apiName} value={value} />
                                  </TableCell>
                                );
                              },
                            )}
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
    </>
  );
}
