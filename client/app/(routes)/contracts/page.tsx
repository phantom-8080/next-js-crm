"use client";

import { useCallback, useState } from "react";
import SideBar from "@/components/SideBar";
import ContractsTable from "@/components/ContractTable";
import type {
  ContractFieldFilterSelection,
  ContractFilterApplyPayload,
} from "@/lib/contractFilterTypes";
import { CONTRACTS_STATIC_ALL_VIEW_ID } from "@/lib/contractStaticData";

export default function ContractsPage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState<string | null>(null);
  const [customViewId, setCustomViewId] = useState<string | null>(null);
  const [fieldSelections, setFieldSelections] = useState<ContractFieldFilterSelection[]>([]);
  const [filteredTotal, setFilteredTotal] = useState<number | null>(null);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [offlineDemo, setOfflineDemo] = useState(false);
  const [customViewsRefreshKey, setCustomViewsRefreshKey] = useState(0);

  const handleFilteredTotalChange = useCallback((total: number | null) => {
    setFilteredTotal(total);
  }, []);

  const handleContractsLoadingChange = useCallback((loading: boolean) => {
    setContractsLoading(loading);
  }, []);

  const handleOfflineDemoChange = useCallback((active: boolean) => {
    setOfflineDemo(active);
  }, []);

  const handleApplyFilters = useCallback((payload: ContractFilterApplyPayload) => {
    setSearchCriteria(payload.criteria);
    setCustomViewId(payload.customViewId);
    setFieldSelections(payload.fieldSelections ?? []);
    if (!payload.criteria && !payload.customViewId && !(payload.fieldSelections?.length ?? 0)) {
      setFilteredTotal(null);
    }
  }, []);

  const listFiltersActive =
    fieldSelections.length > 0 ||
    (customViewId != null && customViewId !== CONTRACTS_STATIC_ALL_VIEW_ID);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-crm-canvas p-2 sm:p-3">
      <div className="relative flex h-full min-h-0 gap-2 sm:gap-3 md:flex-row">
        <SideBar
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          searchCriteria={offlineDemo ? null : searchCriteria}
          customViewId={customViewId}
          filteredTotal={filteredTotal}
          applyLoading={contractsLoading}
          onApplyFilters={handleApplyFilters}
          zohoModule="Contracts"
          listFiltersActive={offlineDemo && listFiltersActive}
          onZohoCustomViewCreated={() => {
            setCustomViewsRefreshKey((k) => k + 1);
          }}
        />
        <ContractsTable
          filtersOpen={filtersOpen}
          onOpenFilters={() => setFiltersOpen(true)}
          searchCriteria={offlineDemo ? null : searchCriteria}
          customViewId={customViewId}
          fieldSelections={fieldSelections}
          customViewsRefreshKey={customViewsRefreshKey}
          onClearSearchCriteria={() => {
            setSearchCriteria(null);
            setCustomViewId(null);
            setFieldSelections([]);
            setFilteredTotal(null);
          }}
          onFilteredTotalChange={handleFilteredTotalChange}
          onContractsLoadingChange={handleContractsLoadingChange}
          onOfflineDemoChange={handleOfflineDemoChange}
          onApplyCustomView={handleApplyFilters}
        />
      </div>
    </div>
  );
}
