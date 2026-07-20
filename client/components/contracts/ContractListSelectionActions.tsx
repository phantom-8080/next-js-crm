"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ADD_MASS_SUBFORM_BUTTON_LABEL,
  AddMassSubformWidget,
} from "@/widgets/add-mass-subform";
import {
  CREATE_NO_INVOICE_NEEDED_BUTTON_LABEL,
  CreateVendorInvoiceRecordsWidget,
} from "@/widgets/create-vendor-invoice-records";
import {
  OLIO_MASS_UPDATE_BUTTON_LABEL,
  OlioMassUpdateWidget,
} from "@/widgets/olio-mass-update";

const RENEW_MENU_ITEMS = [
  "Renew Contracts",
  "Testing renewal",
  "Activate Vendors",
  CREATE_NO_INVOICE_NEEDED_BUTTON_LABEL,
  "Mass Renewal Contracts",
  "Test mass widget",
  "Missing Invoice Email",
  OLIO_MASS_UPDATE_BUTTON_LABEL,
  ADD_MASS_SUBFORM_BUTTON_LABEL,
  "Test Olio Mass Update",
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
  const [vendorInvoiceWidgetOpen, setVendorInvoiceWidgetOpen] = useState(false);
  const [olioMassUpdateOpen, setOlioMassUpdateOpen] = useState(false);
  const [addMassSubformOpen, setAddMassSubformOpen] = useState(false);
  const renewRef = useRef<HTMLDivElement>(null);

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

  function handleAction(action: string) {
    setRenewOpen(false);

    if (action === CREATE_NO_INVOICE_NEEDED_BUTTON_LABEL) {
      setVendorInvoiceWidgetOpen(true);
      onAction?.(action);
      return;
    }

    if (
      action === OLIO_MASS_UPDATE_BUTTON_LABEL ||
      action === "Test Olio Mass Update"
    ) {
      setOlioMassUpdateOpen(true);
      onAction?.(action);
      return;
    }

    if (action === ADD_MASS_SUBFORM_BUTTON_LABEL) {
      setAddMassSubformOpen(true);
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
          onClick={() => handleAction("Change Owner")}
        >
          Change Owner
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="crm-toolbar-btn h-8 px-3 text-sm"
          onClick={() => handleAction("Mail Merge")}
        >
          Mail Merge
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
              Renew Contracts
            </button>
            <button
              type="button"
              className="crm-toolbar-btn flex h-8 w-8 items-center justify-center rounded-none border-0 border-l border-crm-border text-crm-text hover:bg-crm-panel-muted"
              aria-label="Open renew contracts menu"
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
              className="absolute left-0 top-[calc(100%+0.35rem)] z-50 min-w-[14rem] overflow-hidden rounded-lg border border-crm-border bg-crm-panel py-1 shadow-xl"
              role="menu"
              aria-label="Renew contracts actions"
            >
              {RENEW_MENU_ITEMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="menuitem"
                  className="flex w-full cursor-pointer px-3 py-2 text-left text-sm text-crm-text transition hover:bg-crm-panel-muted"
                  onClick={() => handleAction(item)}
                >
                  {item}
                </button>
              ))}
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
    </>
  );
}
