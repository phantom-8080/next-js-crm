"use client";

import { useCallback, useMemo, useState } from "react";
import SideBar from "@/components/SideBar";
import VendorInvoiceTable from "@/components/VendorInvoiceTable";
import type {
  ContractFieldFilterSelection,
  ContractFilterApplyPayload,
} from "@/lib/contractFilterTypes";
import {
  VENDOR_INVOICE_STATIC_ALL_VIEW_ID,
  VENDOR_INVOICE_STATIC_FILTER_FIELDS,
  VENDOR_INVOICE_STATIC_FILTER_SECTIONS,
} from "@/lib/vendorInvoiceStaticData";

export default function VendorInvoicePage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customViewId, setCustomViewId] = useState<string | null>(null);
  const [fieldSelections, setFieldSelections] = useState<ContractFieldFilterSelection[]>([]);
  const [filteredTotal, setFilteredTotal] = useState<number | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const staticFilterMeta = useMemo(
    () => ({
      sections: VENDOR_INVOICE_STATIC_FILTER_SECTIONS,
      fields: VENDOR_INVOICE_STATIC_FILTER_FIELDS,
    }),
    [],
  );

  const handleFilteredTotalChange = useCallback((total: number | null) => {
    setFilteredTotal(total);
  }, []);

  const handleRecordsLoadingChange = useCallback((loading: boolean) => {
    setRecordsLoading(loading);
  }, []);

  const handleApplyFilters = useCallback((payload: ContractFilterApplyPayload) => {
    setCustomViewId(payload.customViewId);
    setFieldSelections(payload.fieldSelections ?? []);
    if (!payload.customViewId || payload.customViewId === VENDOR_INVOICE_STATIC_ALL_VIEW_ID) {
      if (!(payload.fieldSelections?.length ?? 0)) {
        setFilteredTotal(null);
      }
    }
  }, []);

  const listFiltersActive = fieldSelections.length > 0;

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-crm-canvas p-2 sm:p-3">
      <div className="relative flex h-full min-h-0 gap-2 sm:gap-3 md:flex-row">
        <SideBar
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          searchCriteria={null}
          customViewId={customViewId}
          filteredTotal={filteredTotal}
          applyLoading={recordsLoading}
          onApplyFilters={handleApplyFilters}
          filterPanelId="vendor-invoice-filters"
          filterAriaLabel="Vendor invoice filters"
          filterMetaOverride={staticFilterMeta}
          listFiltersActive={listFiltersActive}
        />
        <VendorInvoiceTable
          filtersOpen={filtersOpen}
          onOpenFilters={() => setFiltersOpen(true)}
          customViewId={customViewId}
          fieldSelections={fieldSelections}
          onClearSearchCriteria={() => {
            setCustomViewId(null);
            setFieldSelections([]);
            setFilteredTotal(null);
          }}
          onFilteredTotalChange={handleFilteredTotalChange}
          onRecordsLoadingChange={handleRecordsLoadingChange}
        />
      </div>
    </div>
  );
}
