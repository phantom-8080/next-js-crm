"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACTIVATE_VENDORS_BUTTON_LABEL,
  ActivateVendorsWidget,
} from "@/widgets/activate-vendors";
import {
  ADD_MASS_SUBFORM_BUTTON_LABEL,
  AddMassSubformWidget,
} from "@/widgets/add-mass-subform";
import {
  CREATE_NO_INVOICE_NEEDED_BUTTON_LABEL,
  CreateVendorInvoiceRecordsWidget,
} from "@/widgets/create-vendor-invoice-records";
import {
  MASS_RENEWAL_CONTRACTS_BUTTON_LABEL,
  MassRenewalContractsWidget,
} from "@/widgets/mass-renewal-contracts";
import {
  MISSING_INVOICE_EMAIL_BUTTON_LABEL,
  MissingInvoiceEmailWidget,
} from "@/widgets/missing-invoice-email";
import {
  OLIO_MASS_UPDATE_BUTTON_LABEL,
  OlioMassUpdateWidget,
} from "@/widgets/olio-mass-update";

/** Menu items — "Renew Contracts" is last. */
const RENEW_CONTRACTS_LIST_LABEL = "Renew Contracts" as const;

const RENEW_MENU_ITEMS = [
  ACTIVATE_VENDORS_BUTTON_LABEL,
  CREATE_NO_INVOICE_NEEDED_BUTTON_LABEL,
  MASS_RENEWAL_CONTRACTS_BUTTON_LABEL,
  MISSING_INVOICE_EMAIL_BUTTON_LABEL,
  OLIO_MASS_UPDATE_BUTTON_LABEL,
  ADD_MASS_SUBFORM_BUTTON_LABEL,
  RENEW_CONTRACTS_LIST_LABEL,
] as const;

type ContractListSelectionActionsProps = {
  className?: string;
  /** Selected contract record IDs passed into list-action widgets. */
  selectedRecordIds?: string[];
  onAction?: (action: string) => void;
};

export function ContractListSelectionActions({
  className,
  selectedRecordIds = [],
  onAction,
}: ContractListSelectionActionsProps) {
  const [renewOpen, setRenewOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [vendorInvoiceWidgetOpen, setVendorInvoiceWidgetOpen] = useState(false);
  const [olioMassUpdateOpen, setOlioMassUpdateOpen] = useState(false);
  const [addMassSubformOpen, setAddMassSubformOpen] = useState(false);
  const [activateVendorsOpen, setActivateVendorsOpen] = useState(false);
  const [missingInvoiceEmailOpen, setMissingInvoiceEmailOpen] = useState(false);
  const [massRenewalOpen, setMassRenewalOpen] = useState(false);
  const renewRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return RENEW_MENU_ITEMS;
    return RENEW_MENU_ITEMS.filter((item) => item.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!renewOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!renewRef.current?.contains(event.target as Node)) {
        setRenewOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRenewOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [renewOpen]);

  useEffect(() => {
    if (!renewOpen) {
      setQuery("");
      return;
    }
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [renewOpen]);

  function handleAction(action: string) {
    setRenewOpen(false);

    if (action === CREATE_NO_INVOICE_NEEDED_BUTTON_LABEL) {
      setVendorInvoiceWidgetOpen(true);
      onAction?.(action);
      return;
    }

    if (action === OLIO_MASS_UPDATE_BUTTON_LABEL) {
      setOlioMassUpdateOpen(true);
      onAction?.(action);
      return;
    }

    if (action === ADD_MASS_SUBFORM_BUTTON_LABEL) {
      setAddMassSubformOpen(true);
      onAction?.(action);
      return;
    }

    if (action === ACTIVATE_VENDORS_BUTTON_LABEL) {
      setActivateVendorsOpen(true);
      onAction?.(action);
      return;
    }

    if (action === MISSING_INVOICE_EMAIL_BUTTON_LABEL) {
      setMissingInvoiceEmailOpen(true);
      onAction?.(action);
      return;
    }

    if (
      action === MASS_RENEWAL_CONTRACTS_BUTTON_LABEL ||
      action === RENEW_CONTRACTS_LIST_LABEL
    ) {
      setMassRenewalOpen(true);
      onAction?.(action);
      return;
    }

    onAction?.(action);
  }

  return (
    <>
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-2",
          className,
        )}
        role="toolbar"
        aria-label="Selected record actions"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="crm-toolbar-btn h-8 px-3 text-sm"
          onClick={() => handleAction(OLIO_MASS_UPDATE_BUTTON_LABEL)}
        >
          {OLIO_MASS_UPDATE_BUTTON_LABEL}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="crm-toolbar-btn h-8 px-3 text-sm"
          onClick={() => handleAction(CREATE_NO_INVOICE_NEEDED_BUTTON_LABEL)}
        >
          {CREATE_NO_INVOICE_NEEDED_BUTTON_LABEL}
        </Button>

        <div ref={renewRef} className="relative">
          <div className="inline-flex overflow-hidden rounded-lg border border-crm-border bg-crm-panel">
            <button
              type="button"
              className="crm-toolbar-btn h-8 rounded-none border-0 px-3 text-sm font-medium text-crm-text hover:bg-crm-panel-muted"
              aria-haspopup="menu"
              aria-expanded={renewOpen}
              onClick={() => setRenewOpen((open) => !open)}
            >
              Buttons
            </button>
            <button
              type="button"
              className="crm-toolbar-btn flex h-8 w-8 items-center justify-center rounded-none border-0 border-l border-crm-border text-crm-text hover:bg-crm-panel-muted"
              aria-label="Open buttons menu"
              aria-haspopup="menu"
              aria-expanded={renewOpen}
              onClick={() => setRenewOpen((open) => !open)}
            >
              <ChevronDown
                className={cn(
                  "size-4 text-crm-text-muted transition",
                  renewOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </div>

          {renewOpen ?
            <div
              className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-crm-border bg-crm-panel shadow-xl"
              role="menu"
              aria-label="Buttons actions"
            >
              <div className="border-b border-crm-border p-2.5">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-crm-text-muted"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search Button"
                    className="h-9 w-full rounded-lg border border-crm-border bg-crm-panel py-2 pl-8 pr-3 text-sm text-crm-text outline-none placeholder:text-crm-text-muted focus:border-blue-500"
                    aria-label="Search buttons"
                  />
                </div>
              </div>

              <div className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain py-1">
                {filtered.length === 0 ?
                  <p className="px-3 py-6 text-center text-sm text-crm-text-muted">
                    No buttons match your search.
                  </p>
                : filtered.map((item) => (
                    <button
                      key={item}
                      type="button"
                      role="menuitem"
                      className="flex w-full cursor-pointer px-3 py-2.5 text-left text-sm text-crm-text transition hover:bg-blue-500/10"
                      onClick={() => handleAction(item)}
                    >
                      {item}
                    </button>
                  ))
                }
              </div>
            </div>
          : null}
        </div>
      </div>

      <CreateVendorInvoiceRecordsWidget
        open={vendorInvoiceWidgetOpen}
        onClose={() => setVendorInvoiceWidgetOpen(false)}
        selectedRecordIds={selectedRecordIds}
        module="Contracts"
      />

      <OlioMassUpdateWidget
        open={olioMassUpdateOpen}
        onClose={() => setOlioMassUpdateOpen(false)}
        selectedRecordIds={selectedRecordIds}
        module="Contracts"
      />

      <AddMassSubformWidget
        open={addMassSubformOpen}
        onClose={() => setAddMassSubformOpen(false)}
        selectedRecordIds={selectedRecordIds}
        module="Contracts"
      />

      <ActivateVendorsWidget
        open={activateVendorsOpen}
        onClose={() => setActivateVendorsOpen(false)}
        selectedRecordIds={selectedRecordIds}
        module="Contracts"
      />

      <MissingInvoiceEmailWidget
        open={missingInvoiceEmailOpen}
        onClose={() => setMissingInvoiceEmailOpen(false)}
        selectedRecordIds={selectedRecordIds}
        module="Contracts"
      />

      <MassRenewalContractsWidget
        open={massRenewalOpen}
        onClose={() => setMassRenewalOpen(false)}
        selectedRecordIds={selectedRecordIds}
        module="Contracts"
      />
    </>
  );
}
