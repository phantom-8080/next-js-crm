"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ContractColumnsSettings } from "@/components/ContractColumnsSettings";
import { Button } from "@/components/ui/button";
import { useContractVisibleColumns } from "@/hooks/useContractVisibleColumns";
import { cn } from "@/lib/utils";
import {
  buildFieldsQueryParam,
  type ContractRecord,
  type CrmFieldMeta,
  FALLBACK_FIELD_CATALOG,
  formatCellForDisplay,
  isStatusField,
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
        "inline-flex min-w-[72px] justify-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        normalized === "Active" ?
          "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
        : "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40",
      )}
    >
      {normalized}
    </span>
  );
}

function LinkCell({ children }: { children: string }) {
  if (!children) return <span className="text-zinc-500">—</span>;
  return (
    <button
      type="button"
      className="max-w-[240px] truncate text-left text-sm text-blue-400 hover:text-blue-300 hover:underline"
    >
      {children}
    </button>
  );
}

function CellContent({ apiName, value }: { apiName: string; value: string }) {
  if (isStatusField(apiName)) {
    return <StatusBadge status={value || "Active"} />;
  }
  if (apiName === "Vendor" || apiName === "Company_Name" || apiName === "Name") {
    return <LinkCell>{value}</LinkCell>;
  }
  return <span className="text-zinc-300">{value || "—"}</span>;
}

const th =
  "sticky top-0 z-10 bg-[#26262d] px-3 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-300 shadow-[inset_0_-1px_0_0_rgb(63_63_70)]";
const thFirst =
  "sticky top-0 z-10 bg-[#26262d] pl-6 pr-3 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-300 shadow-[inset_0_-1px_0_0_rgb(63_63_70)]";
const td = "px-3 py-4 max-w-[280px]";
const tdFirst = "pl-6 pr-3 py-4 max-w-[280px]";
const tdMuted = "px-3 py-4 text-zinc-300 max-w-[280px]";

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
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/25 p-3">
      <dl className="space-y-2.5 text-sm">
        {columns.map((col) => {
          const value = row.fields[col.apiName] ?? "";
          return (
            <div key={col.apiName}>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {col.label}
              </dt>
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

  const columnMeta = useMemo(() => {
    const byApi = new Map(fieldCatalog.map((f) => [f.apiName, f]));
    return visibleApiNames.map((apiName: string) => {
      const meta = byApi.get(apiName);
      return {
        apiName,
        label: meta?.label ?? apiName.replace(/_/g, " "),
        dataType: meta?.dataType ?? "text",
      };
    });
  }, [fieldCatalog, visibleApiNames]);

  const fieldsParam = useMemo(
    () => encodeURIComponent(buildFieldsQueryParam(visibleApiNames)),
    [visibleApiNames],
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

  return (
    <>
      <ContractColumnsSettings
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        visibleApiNames={visibleApiNames}
        onApply={applyColumns}
        onFieldsLoaded={handleFieldsLoaded}
      />

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-zinc-700 bg-[#1b1b20]">
        <div className="flex shrink-0 border-b border-zinc-700/80 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {onOpenFilters ?
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="inline-flex size-10 shrink-0 cursor-pointer border-zinc-600 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800 max-md:inline-flex md:hidden"
                onClick={onOpenFilters}
                aria-controls="contracts-filters"
                aria-expanded={filtersOpen}
                aria-label="Open filters menu"
              >
                <Menu className="size-5" />
              </Button>
            : null}
            <div className="min-w-0 flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 sm:gap-x-3">
              <h1 className="text-base font-semibold tracking-tight text-zinc-100">Contracts</h1>
              <span className="text-sm text-zinc-400">
                {loading ?
                  "Loading…"
                : <>
                    <span className="font-medium tabular-nums text-zinc-200">{totalLabel}</span>
                    {" total in CRM"}
                  </>
                }
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 shrink-0 cursor-pointer border-zinc-600 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800"
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
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {loading ?
            <>
              <ContractsCardsLoader />
              <div className="hidden min-w-0 md:block">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow className="border-zinc-700 hover:bg-transparent">
                      {columnMeta.map(
                        (col: { apiName: string; label: string; dataType: string }, i: number) => (
                          <TableHead key={col.apiName} className={i === 0 ? thFirst : th}>
                            {col.label}
                          </TableHead>
                        ),
                      )}
                    </TableRow>
                  </TableHeader>
                  <ContractsTableLoader columnCount={colCount} />
                </Table>
              </div>
            </>
          : <>
              <div className="space-y-3 p-3 md:hidden">
                {contracts.length === 0 ?
                  <p className="py-12 text-center text-sm text-zinc-400">No contracts found.</p>
                : contracts.map((row) => (
                    <ContractCard key={row.id} row={row} columns={columnMeta} />
                  ))
                }
              </div>
              <div className="hidden min-w-0 md:block">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow className="border-zinc-700 hover:bg-transparent">
                      {columnMeta.map(
                        (col: { apiName: string; label: string; dataType: string }, i: number) => (
                          <TableHead key={col.apiName} className={i === 0 ? thFirst : th}>
                            {col.label}
                          </TableHead>
                        ),
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.length === 0 ?
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableCell
                          colSpan={colCount}
                          className="px-6 py-12 text-center text-sm text-zinc-400"
                        >
                          No contracts found.
                        </TableCell>
                      </TableRow>
                    : contracts.map((row) => (
                        <TableRow
                          key={row.id}
                          className="border-zinc-800 text-zinc-200 hover:bg-zinc-800/40"
                        >
                          {columnMeta.map(
                            (
                              col: { apiName: string; label: string; dataType: string },
                              i: number,
                            ) => {
                              const value = formatCellForDisplay(
                                row.fields[col.apiName],
                                col.dataType,
                              );
                              const cellClass =
                                i === 0 ? tdFirst
                                : isStatusField(col.apiName) ? td
                                : tdMuted;
                              return (
                                <TableCell key={col.apiName} className={cellClass}>
                                  <CellContent
                                    apiName={col.apiName}
                                    value={value}
                                  />
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
            </>
          }
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-700/80 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full cursor-pointer border-zinc-600 bg-zinc-900/50 text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed sm:w-auto"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-center text-xs text-zinc-500 sm:text-left">
            {loading ?
              "Loading page…"
            : totalPages != null ?
              <>
                Page <span className="tabular-nums text-zinc-300">{page}</span> /{" "}
                <span className="tabular-nums text-zinc-300">
                  {totalPages.toLocaleString("en-US")}
                </span>
              </>
            : null}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full cursor-pointer border-zinc-600 bg-zinc-900/50 text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed sm:w-auto"
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
