"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import SideBar from "@/components/layout/SideBar";
import VendorsTable from "@/components/vendors/VendorTable";
import type { ContractFilterApplyPayload } from "@/lib/contracts/filterTypes";
import { VENDORS_STATIC_ALL_VIEW_ID } from "@/lib/vendors/static";
import {
  getVendorFiltersServerSnapshot,
  getVendorFiltersSnapshot,
  subscribeVendorFilters,
  writeVendorFilters,
} from "@/lib/vendors/filterPersistence";

export default function VendorsPage() {
  const filters = useSyncExternalStore(
    subscribeVendorFilters,
    getVendorFiltersSnapshot,
    getVendorFiltersServerSnapshot,
  );
  const { searchCriteria, customViewId, fieldSelections } = filters;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filteredTotal, setFilteredTotal] = useState<number | null>(null);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [offlineDemo, setOfflineDemo] = useState(false);
  const [customViewsRefreshKey, setCustomViewsRefreshKey] = useState(0);
  const [focusFilterField, setFocusFilterField] = useState<string | null>(null);

  const handleFilteredTotalChange = useCallback((total: number | null) => {
    setFilteredTotal(total);
  }, []);

  const handleVendorsLoadingChange = useCallback((loading: boolean) => {
    setVendorsLoading(loading);
  }, []);

  const handleOfflineDemoChange = useCallback((active: boolean) => {
    setOfflineDemo(active);
  }, []);

  const handleApplyFilters = useCallback((payload: ContractFilterApplyPayload) => {
    writeVendorFilters({
      searchCriteria: payload.criteria,
      customViewId: payload.customViewId,
      fieldSelections: payload.fieldSelections ?? [],
    });
    if (!payload.criteria && !payload.customViewId && !(payload.fieldSelections?.length ?? 0)) {
      setFilteredTotal(null);
    }
  }, []);

  const listFiltersActive =
    fieldSelections.length > 0 ||
    (customViewId != null && customViewId !== VENDORS_STATIC_ALL_VIEW_ID);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-crm-canvas p-2 sm:p-3">
      <div className="relative flex h-full min-h-0 gap-2 sm:gap-3 md:flex-row">
        <SideBar
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          searchCriteria={offlineDemo ? null : searchCriteria}
          customViewId={customViewId}
          filteredTotal={filteredTotal}
          applyLoading={vendorsLoading}
          onApplyFilters={handleApplyFilters}
          filtersApiUrl="/api/vendors/filters"
          zohoModule="Vendors"
          filterPanelId="vendors-filters"
          filterAriaLabel="Vendor filters"
          listFiltersActive={offlineDemo && listFiltersActive}
          onZohoCustomViewCreated={() => {
            setCustomViewsRefreshKey((k) => k + 1);
          }}
          focusFilterField={focusFilterField}
          onFocusFilterFieldHandled={() => setFocusFilterField(null)}
        />
        <VendorsTable
          filtersOpen={filtersOpen}
          onOpenFilters={() => setFiltersOpen(true)}
          searchCriteria={offlineDemo ? null : searchCriteria}
          customViewId={customViewId}
          fieldSelections={fieldSelections}
          customViewsRefreshKey={customViewsRefreshKey}
          onClearSearchCriteria={() => {
            writeVendorFilters({
              searchCriteria: null,
              customViewId: null,
              fieldSelections: [],
            });
            setFilteredTotal(null);
          }}
          onFilteredTotalChange={handleFilteredTotalChange}
          onVendorsLoadingChange={handleVendorsLoadingChange}
          onOfflineDemoChange={handleOfflineDemoChange}
          onApplyCustomView={handleApplyFilters}
          onFilterByColumn={(_apiName, label) => {
            setFiltersOpen(true);
            setFocusFilterField(label);
          }}
        />
      </div>
    </div>
  );
}
