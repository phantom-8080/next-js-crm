"use client";

import { useState } from "react";
import SideBar from "@/components/SideBar";
import ContractsTable from "@/components/ContractTable";

export default function ContractsPage() {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-crm-canvas p-2 sm:p-3">
      <div className="relative flex h-full min-h-0 gap-2 sm:gap-3 md:flex-row">
        <SideBar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
        <ContractsTable
          filtersOpen={filtersOpen}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      </div>
    </div>
  );
}
