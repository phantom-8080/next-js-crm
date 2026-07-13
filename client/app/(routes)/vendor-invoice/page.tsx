"use client";

import { useCallback, useState } from "react";
import SideBar from "@/components/SideBar";
import VendorInvoiceTable from "@/components/VendorInvoiceTable";
import type { ContractFilterApplyPayload } from "@/lib/contractFilterTypes";

export default function VendorInvoicePage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState<string | null>(null);
  const [customViewId, setCustomViewId] = useState<string | null>(null);
  const [filteredTotal, setFilteredTotal] = useState<number | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const handleFilteredTotalChange = useCallback((total: number | null) => {
    setFilteredTotal(total);
  }, []);

  const handleRecordsLoadingChange = useCallback((loading: boolean) => {
    setRecordsLoading(loading);
  }, []);

  const handleApplyFilters = useCallback((payload: ContractFilterApplyPayload) => {
    setSearchCriteria(payload.criteria);
    setCustomViewId(payload.customViewId);
    if (!payload.criteria && !payload.customViewId) {
      setFilteredTotal(null);
    }
  }, []);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-crm-canvas p-2 sm:p-3">
      <div className="relative flex h-full min-h-0 gap-2 sm:gap-3 md:flex-row">
        <SideBar
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          searchCriteria={searchCriteria}
          customViewId={customViewId}
          filteredTotal={filteredTotal}
          applyLoading={recordsLoading}
          onApplyFilters={handleApplyFilters}
          filtersApiUrl="/api/vendor-invoice/filters"
          zohoModule="Vendor_Invoices"
          filterPanelId="vendor-invoice-filters"
          filterAriaLabel="Vendor invoice filters"
        />
        <VendorInvoiceTable
          filtersOpen={filtersOpen}
          onOpenFilters={() => setFiltersOpen(true)}
          searchCriteria={searchCriteria}
          customViewId={customViewId}
          onClearSearchCriteria={() => {
            setSearchCriteria(null);
            setCustomViewId(null);
            setFilteredTotal(null);
          }}
          onFilteredTotalChange={handleFilteredTotalChange}
          onRecordsLoadingChange={handleRecordsLoadingChange}
        />
      </div>
    </div>
  );
}
