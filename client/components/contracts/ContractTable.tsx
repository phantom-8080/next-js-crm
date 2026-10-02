"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Menu, Settings2 } from "lucide-react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { ContractsCardsLoader, ContractsTableLoader } from "@/components/contracts/ContractsTableLoader";
import { ContractListSelectionActions } from "@/components/contracts/ContractListSelectionActions";
import { ListTable } from "@/components/shared/ListTable";
import { InlineLoadingShimmer, PaginationLoadingShimmer } from "@/components/shared/LoadingShimmer";
import { ContractColumnsSettings } from "@/components/contracts/ContractColumnsSettings";
import { ColumnHeaderMenu, type ColumnHeaderMenuAction } from "@/components/shared/ColumnHeaderMenu";
import { ResizableTableHeadCell } from "@/components/shared/ResizableTableHeadCell";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useContractVisibleColumns } from "@/hooks/contracts/useContractVisibleColumns";
import { usePinnedColumns } from "@/hooks/contracts/usePinnedColumns";
import { useResizableColumnWidths } from "@/hooks/table/useResizableColumnWidths";
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
} from "@/lib/contracts/columns";
import {
  canSortColumn,
  isZohoApiSortableField,
  sortContractRecords,
  type ColumnSortState,
} from "@/lib/contracts/columnSort";
import type {
  ContractFieldFilterSelection,
  ContractFilterApplyPayload,
} from "@/lib/contracts/filterTypes";
import {
  CONTRACTS_STATIC_ALL_VIEW_ID,
  CONTRACTS_STATIC_RECORDS,
  filterStaticContractRecords,
} from "@/lib/contracts/static";
import {
  getContractFieldLookupId,
  getContractLookupHref,
  htmlToPlainText,
  isContractLookupField,
  isRichTextField,
  cleanLongTextForList,
  sanitizeCrmRichHtmlForList,
  shouldRenderAsRichHtml,
} from "@/lib/contracts/recordLayout";
import { CustomViewsDropdown } from "@/components/contracts/CustomViewsDropdown";
import { getContractZohoRecordUrl } from "@/lib/zoho/crmRecordUrls";

const SELECT_COL_WIDTH = 44;
const SELECT_COL = { apiName: "_select" } as const;

function openContractRecord(recordId: string) {
  window.open(getContractZohoRecordUrl(recordId), "_blank", "noopener,noreferrer");
}

type ContractStatusTone = "active" | "closed";

function statusTone(value: string): ContractStatusTone {
  return value.trim().toLowerCase() === "closed" ? "closed" : "active";
}

function StatusBadge({ status }: { status: string }) {
  const label = status.trim() || "Active";
  const tone = statusTone(label);
  return (
    <span
      className={cn(
        "crm-status-badge",
        tone === "active" ? "crm-status-active" : "crm-status-closed",
      )}
      title={label}
    >
      {label}
    </span>
  );
}

function isLongTextColumn(apiName: string, dataType?: string) {
  if (
    apiName === "Vendor" ||
    apiName === "Company_Name" ||
    apiName === "Name" ||
    apiName === "Site" ||
    apiName === "Our_Services_SubForm" ||
    apiName === "Scope_of_Work" ||
    apiName === "Contract_Summary" ||
    apiName === "Client_Summary"
  ) {
    return true;
  }
  if (dataType === "subform") return true;
  return isRichTextField(apiName, dataType);
}

/** Wrap/scroll long cell values instead of truncating with ellipsis. */
function ScrollableCell({
  title,
  children,
  dense = false,
}: {
  title?: string;
  children: ReactNode;
  /** Extra height for Contract Summary / Scope of Work / rich text. */
  dense?: boolean;
}) {
  return (
    <div
      className={cn("crm-cell-scroll", dense && "crm-cell-scroll--tall")}
      title={title}
      onWheel={(e) => e.stopPropagation()}
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
      <ScrollableCell title={value || undefined}>
        <span className="text-crm-text">{display}</span>
      </ScrollableCell>
    );
  }

  return (
    <ScrollableCell title={value}>
      <button
        type="button"
        className="max-w-full cursor-pointer break-words text-left text-crm-link hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          openLookupRecord(href);
        }}
      >
        {display}
      </button>
    </ScrollableCell>
  );
}

function CellContent({
  apiName,
  label,
  value,
  dataType,
  lookupId,
}: {
  apiName: string;
  label?: string;
  value: string;
  dataType?: string;
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

  const tallScroll =
    apiName === "Contract_Summary" ||
    apiName === "Client_Summary" ||
    apiName === "Our_Services_SubForm" ||
    apiName === "Scope_of_Work" ||
    isRichTextField(apiName, dataType) ||
    dataType === "subform";

  if (shouldRenderAsRichHtml(apiName, value, dataType)) {
    const plain = cleanLongTextForList(htmlToPlainText(value));
    return (
      <ScrollableCell title={plain || undefined} dense={tallScroll}>
        <div
          className="crm-rich-text crm-rich-text--list"
          dangerouslySetInnerHTML={{ __html: sanitizeCrmRichHtmlForList(value) }}
          onClick={(e) => e.stopPropagation()}
        />
      </ScrollableCell>
    );
  }

  if (isRichTextField(apiName, dataType) || value.includes("\n")) {
    const cleaned = cleanLongTextForList(value);
    return (
      <ScrollableCell title={cleaned || undefined} dense={tallScroll}>
        <div className="crm-plain-notes crm-plain-notes--list whitespace-pre-wrap break-words text-crm-text">
          {cleaned || "—"}
        </div>
      </ScrollableCell>
    );
  }

  if (isLongTextColumn(apiName, dataType)) {
    let display = cleanLongTextForList(value) || "—";
    // Scope of Work often arrives as a long comma-separated list — stack for scrollable reading.
    if (
      (apiName === "Our_Services_SubForm" || apiName === "Scope_of_Work") &&
      display.includes(",")
    ) {
      display = display
        .split(/\s*,\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
        .join("\n");
    }
    return (
      <ScrollableCell title={value ? display : undefined} dense={tallScroll}>
        <span className="whitespace-pre-wrap break-words text-crm-text">{display}</span>
      </ScrollableCell>
    );
  }

  return (
    <ScrollableCell title={value || undefined}>
      <span className={cn("text-crm-text", value && "tabular-nums")}>{value || "—"}</span>
    </ScrollableCell>
  );
}

function getColumnWidthPx(col: { apiName: string; dataType?: string }) {
  if (isStatusField(col.apiName)) return 128;
  if (isRichTextField(col.apiName, col.dataType)) return 280;
  if (
    col.apiName === "Our_Services_SubForm" ||
    col.apiName === "Scope_of_Work" ||
    col.dataType === "subform"
  ) {
    return 260;
  }
  if (isLongTextColumn(col.apiName, col.dataType)) return 220;
  if (isDateLikeField(col.apiName, col.dataType)) return 132;
  return 168;
}

function getColumnCellClass(
  col: { apiName: string },
  index: number,
  variant: "head" | "body",
  pinned = false,
) {
  void col;
  void index;

  if (variant === "head") {
    return cn("column-heading overflow-visible px-3", pinned && "crm-col-pinned");
  }

  return cn(
    "min-w-0 overflow-hidden px-3 py-3 align-top text-crm-text",
    pinned && "crm-col-pinned",
  );
}

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 100;

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
  /** Apply a Zoho custom view from the toolbar dropdown (one at a time). */
  onApplyCustomView?: (payload: ContractFilterApplyPayload) => void;
  /** Bump to reload custom views after creating one from the sidebar. */
  customViewsRefreshKey?: number;
  /** Open sidebar filters focused on this column. */
  onFilterByColumn?: (apiName: string, label: string) => void;
};

function ContractCard({
  row,
  columns,
  selected,
  onSelectedChange,
}: {
  row: ContractRecord;
  columns: { apiName: string; label: string; dataType: string }[];
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
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
      data-state={selected ? "selected" : undefined}
      onClick={() => openContractRecord(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openContractRecord(row.id);
        }
      }}
      className={cn(
        "crm-row-hover rounded-lg border border-crm-border bg-crm-panel p-3 transition hover:border-zinc-400 dark:hover:border-zinc-600",
        selected && "border-blue-500/40 bg-blue-500/5",
      )}
    >
      <div className="mb-3 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          aria-label={`Select ${title}`}
          className="mt-0.5 size-4 shrink-0 rounded border-crm-border accent-blue-500"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelectedChange(e.target.checked)}
        />
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-crm-text">{title}</p>
      </div>
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
                  dataType={col.dataType}
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
  onApplyCustomView,
  customViewsRefreshKey = 0,
  onFilterByColumn,
}: ContractsTableProps) {
  const { visibleApiNames, setVisibleApiNames } = useContractVisibleColumns();
  const { pinnedApiNames, togglePinned, isPinned } = usePinnedColumns();
  const [fieldCatalog, setFieldCatalog] = useState<CrmFieldMeta[]>(FALLBACK_FIELD_CATALOG);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineDemo, setOfflineDemo] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [columnSort, setColumnSort] = useState<ColumnSortState | null>(null);

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
    const base = columnsToShow.map((apiName: string) => {
      const meta = byApi.get(apiName);
      const fallbackLabel =
        apiName === "Our_Services_SubForm" || apiName === "Scope_of_Work"
          ? "Scope of Work"
          : apiName.replace(/_/g, " ");
      return {
        apiName,
        label: meta?.label ?? fallbackLabel,
        dataType: meta?.dataType ?? (apiName === "Our_Services_SubForm" ? "subform" : "text"),
      };
    });

    const pinnedSet = new Set(
      pinnedApiNames.filter((name) => base.some((col) => col.apiName === name)),
    );
    const pinnedCols = pinnedApiNames
      .map((name) => base.find((col) => col.apiName === name))
      .filter((col): col is (typeof base)[number] => Boolean(col));
    const rest = base.filter((col) => !pinnedSet.has(col.apiName));
    return [...pinnedCols, ...rest];
  }, [fieldCatalog, columnsToShow, pinnedApiNames]);

  const fieldsParam = useMemo(
    () => encodeURIComponent(buildFieldsQueryParam(columnsToShow)),
    [columnsToShow],
  );

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [searchCriteria, customViewId, fieldSelections, columnSort]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

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
        // Always pass sort; API only forwards Zoho-supported fields (id /
        // Created_Time / Modified_Time). Other columns are page-sorted locally.
        const sortPart =
          columnSort ?
            `&sortBy=${encodeURIComponent(columnSort.apiName)}&sortOrder=${columnSort.direction}`
          : "";
        const res = await fetch(
          `/api/contracts?page=${page}&perPage=${pageSize}&fields=${fieldsParam}${criteriaPart}${cvidPart}${sortPart}`,
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
            const dataTypeByApi = new Map(
              fieldCatalog.map((field) => [field.apiName, field.dataType] as const),
            );
            const sorted = sortContractRecords(rows, columnSort, dataTypeByApi);
            const start = (page - 1) * pageSize;
            const slice = sorted.slice(start, start + pageSize);
            setContracts(slice);
            const total = sorted.length;
            setTotalCount(total);
            const filteredActive =
              fieldSelections.length > 0 ||
              (customViewId != null && customViewId !== CONTRACTS_STATIC_ALL_VIEW_ID);
            if (filteredActive && onFilteredTotalChange) {
              onFilteredTotalChange(total);
            } else if (!filteredActive && onFilteredTotalChange) {
              onFilteredTotalChange(null);
            }
            setHasMore(start + pageSize < sorted.length);
            if (data.zohoUnreachable && data.error) {
              setError(null);
            }
          } else {
            const liveRows = data.contracts ?? [];
            const dataTypeByApi = new Map(
              fieldCatalog.map((field) => [field.apiName, field.dataType] as const),
            );
            setContracts(
              columnSort && !isZohoApiSortableField(columnSort.apiName) ?
                sortContractRecords(liveRows, columnSort, dataTypeByApi)
              : liveRows,
            );
            const total =
              typeof data.totalCount === "number" ?
                data.totalCount
              : liveRows.length;
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
    pageSize,
    fieldsParam,
    searchCriteria,
    customViewId,
    fieldSelections,
    columnsToShow,
    fieldCatalog,
    columnSort,
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

  const hideColumn = useCallback(
    (apiName: string) => {
      if (columnsToShow.length <= 1) return;
      applyColumns(columnsToShow.filter((name) => name !== apiName));
      if (columnSort?.apiName === apiName) setColumnSort(null);
    },
    [applyColumns, columnsToShow, columnSort],
  );

  const handleColumnMenuAction = useCallback(
    (col: { apiName: string; label: string; dataType: string }, action: ColumnHeaderMenuAction) => {
      if (action === "asc") {
        setColumnSort({ apiName: col.apiName, direction: "asc" });
        setPage(1);
        return;
      }
      if (action === "desc") {
        setColumnSort({ apiName: col.apiName, direction: "desc" });
        setPage(1);
        return;
      }
      if (action === "pin") {
        togglePinned(col.apiName);
        return;
      }
      if (action === "hide") {
        hideColumn(col.apiName);
        return;
      }
      if (action === "filter") {
        onOpenFilters?.();
        onFilterByColumn?.(col.apiName, col.label);
      }
    },
    [hideColumn, onFilterByColumn, onOpenFilters, togglePinned],
  );

  const totalPages =
    totalCount != null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
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

  const colCount = Math.max(1, columnMeta.length) + 1;
  const pageIds = useMemo(() => contracts.map((row) => row.id), [contracts]);
  const selectedCount = selectedIds.size;
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  const toggleRowSelected = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageIds.length > 0 && pageIds.every((id) => next.has(id))) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }, [pageIds]);

  const { getWidthPx, columnSizeStyle, tableMinWidthPx, beginColumnResize } =
    useResizableColumnWidths("crm-column-widths-contracts-v1", columnMeta, getColumnWidthPx);

  const listColumns = useMemo(() => [SELECT_COL, ...columnMeta], [columnMeta]);
  const loaderColumns = useMemo(
    () => [
      { apiName: SELECT_COL.apiName, label: "", dataType: "text" },
      ...columnMeta,
    ],
    [columnMeta],
  );

  const pinnedLeftByApiName = useMemo(() => {
    const map = new Map<string, number>();
    let left = SELECT_COL_WIDTH;
    for (const col of columnMeta) {
      if (!isPinned(col.apiName)) break;
      map.set(col.apiName, left);
      left += getWidthPx(col);
    }
    return map;
  }, [columnMeta, getWidthPx, isPinned]);

  const listColumnSizeStyle = useCallback(
    (col: { apiName: string }): CSSProperties => {
      if (col.apiName === SELECT_COL.apiName) {
        return {
          width: SELECT_COL_WIDTH,
          minWidth: SELECT_COL_WIDTH,
          maxWidth: SELECT_COL_WIDTH,
          left: 0,
        };
      }
      const pinnedLeft = pinnedLeftByApiName.get(col.apiName);
      return {
        ...columnSizeStyle(col),
        ...(pinnedLeft != null ? { left: pinnedLeft } : null),
      };
    },
    [columnSizeStyle, pinnedLeftByApiName],
  );

  const tableWidthStyle = useMemo(
    (): CSSProperties => ({
      width: tableMinWidthPx + SELECT_COL_WIDTH,
      minWidth: tableMinWidthPx + SELECT_COL_WIDTH,
    }),
    [tableMinWidthPx],
  );

  function renderTableHeadRow() {
    return (
      <TableRow className="border-crm-border hover:bg-transparent">
        <TableHead
          className="crm-col-select-sticky h-10 px-3 py-0"
          style={{ left: 0, width: SELECT_COL_WIDTH, minWidth: SELECT_COL_WIDTH, maxWidth: SELECT_COL_WIDTH }}
        >
          <input
            type="checkbox"
            checked={allPageSelected}
            ref={(el) => {
              if (el) el.indeterminate = somePageSelected;
            }}
            aria-label="Select all contracts on this page"
            className="size-4 rounded border-crm-border accent-blue-500"
            disabled={loading || pageIds.length === 0}
            onChange={toggleSelectAllOnPage}
          />
        </TableHead>
        {columnMeta.map(
          (col: { apiName: string; label: string; dataType: string }, i: number) => {
            const pinned = isPinned(col.apiName);
            const pinnedLeft = pinnedLeftByApiName.get(col.apiName);
            return (
              <ResizableTableHeadCell
                key={col.apiName}
                className={getColumnCellClass(col, i, "head", pinned)}
                style={{
                  ...columnSizeStyle(col),
                  ...(pinnedLeft != null ? { left: pinnedLeft } : null),
                }}
                label={
                  <ColumnHeaderMenu
                    columnLabel={col.label}
                    pinned={pinned}
                    sortDirection={
                      columnSort?.apiName === col.apiName ? columnSort.direction : null
                    }
                    canSort={canSortColumn(col.apiName, col.dataType)}
                    canHide={columnsToShow.length > 1}
                    canFilter={Boolean(onFilterByColumn || onOpenFilters)}
                    onAction={(action) => handleColumnMenuAction(col, action)}
                  />
                }
                showDivider={i < columnMeta.length - 1}
                onResizeStart={(clientX) => beginColumnResize(col.apiName, clientX, col)}
              />
            );
          },
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
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
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
            <div className="min-w-0 flex flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3">
              <h1 className="page-heading truncate text-base sm:text-lg">Contracts</h1>
              {selectedCount > 0 ?
                <ContractListSelectionActions
                  selectedRecordIds={Array.from(selectedIds)}
                />
              : null}
              {onApplyCustomView ?
                <CustomViewsDropdown
                  zohoModule="Contracts"
                  selectedCustomViewId={customViewId}
                  refreshKey={customViewsRefreshKey}
                  onSelect={(nextId) => {
                    setPage(1);
                    onApplyCustomView({
                      criteria: null,
                      customViewId: nextId,
                      fieldSelections: [],
                    });
                  }}
                  className="max-w-[min(16rem,55vw)] sm:max-w-[18rem]"
                />
              : null}
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
                    {selectedCount > 0 ?
                      <>
                        {" · "}
                        <span className="font-medium tabular-nums text-crm-text">
                          {selectedCount.toLocaleString("en-US")}
                        </span>
                        {" selected"}
                      </>
                    : null}
                  </>
                }
              </span>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-crm-text-muted">
              <span className="hidden sm:inline">Rows</span>
              <select
                value={pageSize}
                disabled={loading}
                aria-label="Rows per page"
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="crm-toolbar-btn h-10 min-w-[4.5rem] cursor-pointer rounded-md border border-crm-border bg-crm-panel px-2 text-sm text-crm-text outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
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
                  columns={listColumns}
                  columnSizeStyle={listColumnSizeStyle}
                  headerRow={renderTableHeadRow()}
                >
                  <ContractsTableLoader
                    columns={loaderColumns}
                    getCellClassName={(col, i) =>
                      col.apiName === SELECT_COL.apiName ?
                        "crm-col-select-sticky px-3 py-4"
                      : getColumnCellClass(col, i - 1, "body", isPinned(col.apiName))
                    }
                    getCellStyle={(col) => listColumnSizeStyle(col)}
                  />
                </ListTable>
              </div>
            </>
          : <>
              <div className="space-y-3 overflow-auto p-3 md:hidden">
                {contracts.length === 0 ?
                  <p className="py-12 text-center text-sm text-crm-text-muted">No contracts found.</p>
                : contracts.map((row) => (
                    <ContractCard
                      key={row.id}
                      row={row}
                      columns={columnMeta}
                      selected={selectedIds.has(row.id)}
                      onSelectedChange={(selected) => toggleRowSelected(row.id, selected)}
                    />
                  ))
                }
              </div>
              <div className="hidden min-h-0 flex-1 flex-col md:flex">
                <ListTable
                  tableWidthStyle={tableWidthStyle}
                  columns={listColumns}
                  columnSizeStyle={listColumnSizeStyle}
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
                      : contracts.map((row) => {
                          const isSelected = selectedIds.has(row.id);
                          const rowTitle =
                            row.fields.Name?.trim() ||
                            row.fields.Company_Name?.trim() ||
                            row.fields.Vendor?.trim() ||
                            `Contract ${row.id}`;
                          return (
                          <TableRow
                            key={row.id}
                            role="link"
                            tabIndex={0}
                            data-state={isSelected ? "selected" : undefined}
                            className="crm-row-hover border-crm-border text-crm-text"
                            onClick={() => openContractRecord(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openContractRecord(row.id);
                              }
                            }}
                          >
                            <TableCell
                              className="crm-col-select-sticky px-3 py-4"
                              style={listColumnSizeStyle(SELECT_COL)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                aria-label={`Select ${rowTitle}`}
                                className="size-4 rounded border-crm-border accent-blue-500"
                                onChange={(e) => toggleRowSelected(row.id, e.target.checked)}
                              />
                            </TableCell>
                            {columnMeta.map(
                              (
                                col: { apiName: string; label: string; dataType: string },
                                i: number,
                              ) => {
                                const raw = getContractFieldDisplayValue(row.fields, col.apiName);
                                const value = formatCellForDisplay(raw, col.dataType);
                                const pinned = isPinned(col.apiName);
                                const cellClass = getColumnCellClass(col, i, "body", pinned);
                                const lookupId = getContractFieldLookupId(row.lookups, col.apiName);
                                const pinnedLeft = pinnedLeftByApiName.get(col.apiName);
                                return (
                                  <TableCell
                                    key={col.apiName}
                                    className={cellClass}
                                    style={{
                                      ...columnSizeStyle(col),
                                      ...(pinnedLeft != null ? { left: pinnedLeft } : null),
                                    }}
                                  >
                                    <CellContent
                                      apiName={col.apiName}
                                      label={col.label}
                                      value={value}
                                      dataType={col.dataType}
                                      lookupId={lookupId}
                                    />
                                  </TableCell>
                                );
                              },
                            )}
                          </TableRow>
                          );
                        })
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
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
