"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Menu, Settings2 } from "lucide-react";
import {
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { ContractsCardsLoader, ContractsTableLoader } from "@/components/ContractsTableLoader";
import { ListTable } from "@/components/ListTable";
import { InlineLoadingShimmer, PaginationLoadingShimmer } from "@/components/LoadingShimmer";
import { ContractColumnsSettings } from "@/components/ContractColumnsSettings";
import { ResizableTableHeadCell } from "@/components/ResizableTableHeadCell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useContractVisibleColumns } from "@/hooks/useContractVisibleColumns";
import { useResizableColumnWidths } from "@/hooks/useResizableColumnWidths";
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
import type { ContractFieldFilterSelection } from "@/lib/contractFilterTypes";
import {
  CONTRACTS_STATIC_ALL_VIEW_ID,
  CONTRACTS_STATIC_RECORDS,
  filterStaticContractRecords,
} from "@/lib/contractStaticData";
import {
  getContractFieldLookupId,
  getContractLookupHref,
  isContractLookupField,
} from "@/lib/contractRecordLookups";

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

function openLookupRecord(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

function LookupFieldCell({
  apiName,
  value,
  lookupId,
}: {
  apiName: string;
  value: string;
  lookupId?: string;
}) {
  const display = value || "—";
  const href =
    lookupId && value ? getContractLookupHref(apiName, lookupId) : null;

  if (!href) {
    return (
      <TruncateWrap title={value || undefined}>
        <span className="text-crm-text">{display}</span>
      </TruncateWrap>
    );
  }

  return (
    <TruncateWrap title={value}>
      <button
        type="button"
        className="max-w-full cursor-pointer truncate text-left text-crm-link hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          openLookupRecord(href);
        }}
      >
        {display}
      </button>
    </TruncateWrap>
  );
}

function CellContent({
  apiName,
  label,
  value,
  lookupId,
}: {
  apiName: string;
  label?: string;
  value: string;
  lookupId?: string;
}) {
  if (isStatusField(apiName)) {
    return <StatusBadge status={value || "Active"} />;
  }
  if (isContractLookupField(apiName, label)) {
    return (
      <LookupFieldCell apiName={apiName} value={value} lookupId={lookupId} />
    );
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

const PAGE_SIZE = 100;

type ContractsTableProps = {
  filtersOpen?: boolean;
  onOpenFilters?: () => void;
  searchCriteria?: string | null;
  customViewId?: string | null;
  fieldSelections?: ContractFieldFilterSelection[];
  onClearSearchCriteria?: () => void;
  onFilteredTotalChange?: (total: number | null) => void;
  onContractsLoadingChange?: (loading: boolean) => void;
  onOfflineDemoChange?: (active: boolean) => void;
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
      className="crm-row-hover rounded-lg border border-crm-border bg-crm-panel p-3 transition hover:border-zinc-400 dark:hover:border-zinc-600"
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
                <CellContent
                  apiName={col.apiName}
                  label={col.label}
                  value={value}
                  lookupId={getContractFieldLookupId(row.lookups, col.apiName)}
                />
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
  searchCriteria = null,
  customViewId = null,
  fieldSelections = [],
  onClearSearchCriteria,
  onFilteredTotalChange,
  onContractsLoadingChange,
  onOfflineDemoChange,
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
  const [offlineDemo, setOfflineDemo] = useState(false);

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
    setPage(1);
  }, [searchCriteria, customViewId, fieldSelections]);

  useEffect(() => {
    let cancelled = false;

    async function loadContracts() {
      setLoading(true);
      onContractsLoadingChange?.(true);
      setError(null);

      try {
        const cvidPart =
          customViewId && !searchCriteria ?
            `&cvid=${encodeURIComponent(customViewId)}`
          : "";
        const criteriaPart =
          searchCriteria && !customViewId ?
            `&criteria=${encodeURIComponent(searchCriteria)}`
          : "";
        const res = await fetch(
          `/api/contracts?page=${page}&fields=${fieldsParam}${criteriaPart}${cvidPart}`,
        );
        const data = (await res.json()) as {
          contracts?: ContractRecord[];
          totalCount?: number;
          hasMore?: boolean;
          filtered?: boolean;
          offlineDemo?: boolean;
          zohoUnreachable?: boolean;
          error?: string;
        };

        const isOffline = Boolean(data.offlineDemo);
        if (!cancelled) {
          setOfflineDemo(isOffline);
          onOfflineDemoChange?.(isOffline);
        }

        if (!isOffline && !res.ok) {
          throw new Error(data.error ?? "Failed to load contracts");
        }

        if (!cancelled) {
          if (isOffline) {
            const filtered = filterStaticContractRecords(CONTRACTS_STATIC_RECORDS, {
              fieldSelections,
              customViewId,
            });
            const rows: ContractRecord[] = filtered.map((r) => ({
              id: r.id,
              fields: Object.fromEntries(
                columnsToShow.map((name) => [name, r.fields[name] ?? ""]),
              ),
              lookups: r.lookups,
            }));
            const start = (page - 1) * PAGE_SIZE;
            const slice = rows.slice(start, start + PAGE_SIZE);
            setContracts(slice);
            const total = rows.length;
            setTotalCount(total);
            const filteredActive =
              fieldSelections.length > 0 ||
              (customViewId != null && customViewId !== CONTRACTS_STATIC_ALL_VIEW_ID);
            if (filteredActive && onFilteredTotalChange) {
              onFilteredTotalChange(total);
            } else if (!filteredActive && onFilteredTotalChange) {
              onFilteredTotalChange(null);
            }
            setHasMore(start + PAGE_SIZE < rows.length);
            if (data.zohoUnreachable && data.error) {
              setError(null);
            }
          } else {
            setContracts(data.contracts ?? []);
            const total =
              typeof data.totalCount === "number" ?
                data.totalCount
              : (data.contracts ?? []).length;
            setTotalCount(total);
            if (data.filtered && onFilteredTotalChange) {
              onFilteredTotalChange(total);
            } else if (!searchCriteria && !customViewId && onFilteredTotalChange) {
              onFilteredTotalChange(null);
            }
            setHasMore(Boolean(data.hasMore));
          }
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
          onContractsLoadingChange?.(false);
        }
      }
    }

    void loadContracts();

    return () => {
      cancelled = true;
    };
  }, [
    page,
    fieldsParam,
    searchCriteria,
    customViewId,
    fieldSelections,
    columnsToShow,
    onFilteredTotalChange,
    onContractsLoadingChange,
    onOfflineDemoChange,
  ]);

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
  const totalSuffix =
    offlineDemo ?
      fieldSelections.length > 0 ||
      (customViewId != null && customViewId !== CONTRACTS_STATIC_ALL_VIEW_ID) ?
        " matching sample records"
      : " sample records"
    : searchCriteria || customViewId ?
      " matching records"
    : " total in CRM";

  const showFilteredBadge =
    offlineDemo ?
      fieldSelections.length > 0 ||
      (customViewId != null && customViewId !== CONTRACTS_STATIC_ALL_VIEW_ID)
    : Boolean(searchCriteria || customViewId);

  const colCount = Math.max(1, columnMeta.length);

  const { columnSizeStyle, tableMinWidthPx, beginColumnResize } = useResizableColumnWidths(
    "crm-column-widths-contracts-v1",
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
        {columnMeta.map(
          (col: { apiName: string; label: string; dataType: string }, i: number) => (
            <ResizableTableHeadCell
              key={col.apiName}
              className={getColumnCellClass(col, i, "head")}
              style={columnSizeStyle(col)}
            label={col.label}
            showDivider={i < columnMeta.length - 1}
            onResizeStart={(clientX) => beginColumnResize(col.apiName, clientX, col)}
            />
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
        {offlineDemo ?
          <div className="border-b border-amber-200/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 sm:px-6 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            Zoho CRM is unreachable. Showing sample contracts and demo filters. Reconnect to
            load live data. Advanced text filters need Zoho; use status, vendor, and views
            below.
          </div>
        : null}
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
                {contracts.length === 0 ?
                  <p className="py-12 text-center text-sm text-crm-text-muted">No contracts found.</p>
                : contracts.map((row) => (
                    <ContractCard key={row.id} row={row} columns={columnMeta} />
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
                            className="crm-row-hover border-crm-border text-crm-text"
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
                                const lookupId = getContractFieldLookupId(row.lookups, col.apiName);
                                return (
                                  <TableCell
                                    key={col.apiName}
                                    className={cellClass}
                                    style={columnSizeStyle(col)}
                                  >
                                    <CellContent
                                      apiName={col.apiName}
                                      label={col.label}
                                      value={value}
                                      lookupId={lookupId}
                                    />
                                  </TableCell>
                                );
                              },
                            )}
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
    </>
  );
}
