"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SEND_MESSAGE_BUTTON_LABEL,
  SendMessageWidget,
} from "@/widgets/send-message";
import {
  CREATE_CONTRACT_PDF_BUTTON_LABEL,
  CreateContractPdfWidget,
} from "@/widgets/create-contract-pdf";
import {
  COMPLIANCE_FIELDS_BUTTON_LABEL,
  ComplianceFieldsWidget,
} from "@/widgets/compliance-fields";
import {
  PO_ADDENDUM_BUTTON_LABEL,
  PoAddendumWidget,
} from "@/widgets/po-addendum";
import {
  CLONE_CONTRACT_BUTTON_LABEL,
  CloneContractWidget,
} from "@/widgets/clone-contract";
import {
  MassRenewalContractsWidget,
} from "@/widgets/mass-renewal-contracts";
import {
  CREATE_SERVICE_COMPLETION_BUTTON_LABEL,
  CREATE_SERVICE_COMPLETION_PAGE_PATH,
} from "@/widgets/create-service-completion";
import {
  CLIENT_SENDING_RFP_BUTTON_LABEL,
  ClientSendingRfpWidget,
} from "@/widgets/client-sending-rfp";
import {
  STATUS_VENDOR_COMPLIANCE_BUTTON_LABEL,
  StatusVendorComplianceWidget,
} from "@/widgets/status-vendor-compliance";

/** Record-view custom buttons (Zoho-style labels). */
export const CONTRACT_RECORD_BUTTONS = [
  CREATE_SERVICE_COMPLETION_BUTTON_LABEL,
  "TestRecordWidget",
  SEND_MESSAGE_BUTTON_LABEL,
  CREATE_CONTRACT_PDF_BUTTON_LABEL,
  "Sync With Books",
  "Renew Contract",
  "Status Pending Sales Review",
  CLIENT_SENDING_RFP_BUTTON_LABEL,
  "Status Sourcing Vendor",
  COMPLIANCE_FIELDS_BUTTON_LABEL,
  PO_ADDENDUM_BUTTON_LABEL,
  "Status Client Negotiations",
  STATUS_VENDOR_COMPLIANCE_BUTTON_LABEL,
  CLONE_CONTRACT_BUTTON_LABEL,
] as const;

export type ContractRecordButtonLabel = (typeof CONTRACT_RECORD_BUTTONS)[number];

const RENEW_CONTRACT_BUTTON_LABEL = "Renew Contract" as const;

const CONFIGURED_RECORD_BUTTONS = new Set<string>([
  CREATE_SERVICE_COMPLETION_BUTTON_LABEL,
  SEND_MESSAGE_BUTTON_LABEL,
  CREATE_CONTRACT_PDF_BUTTON_LABEL,
  COMPLIANCE_FIELDS_BUTTON_LABEL,
  PO_ADDENDUM_BUTTON_LABEL,
  CLONE_CONTRACT_BUTTON_LABEL,
  RENEW_CONTRACT_BUTTON_LABEL,
  CLIENT_SENDING_RFP_BUTTON_LABEL,
  STATUS_VENDOR_COMPLIANCE_BUTTON_LABEL,
]);

type ContractRecordActionsProps = {
  className?: string;
  recordId: string;
  onAction?: (action: ContractRecordButtonLabel, recordId: string) => void;
};

export function ContractRecordActions({
  className,
  recordId,
  onAction,
}: ContractRecordActionsProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const [createContractPdfOpen, setCreateContractPdfOpen] = useState(false);
  const [complianceFieldsOpen, setComplianceFieldsOpen] = useState(false);
  const [poAddendumOpen, setPoAddendumOpen] = useState(false);
  const [cloneContractOpen, setCloneContractOpen] = useState(false);
  const [renewContractOpen, setRenewContractOpen] = useState(false);
  const [clientSendingRfpOpen, setClientSendingRfpOpen] = useState(false);
  const [statusVendorComplianceOpen, setStatusVendorComplianceOpen] =
    useState(false);
  const [inProgressMessage, setInProgressMessage] = useState<string | null>(
    null,
  );

  const [actionToast, setActionToast] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CONTRACT_RECORD_BUTTONS;
    return CONTRACT_RECORD_BUTTONS.filter((label) =>
      label.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
    };
  }, []);

  function showInProgress(action: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setInProgressMessage(`“${action}” is in progress — coming soon.`);
    toastTimerRef.current = setTimeout(() => {
      setInProgressMessage(null);
      toastTimerRef.current = null;
    }, 2800);
  }

  function showActionToast(
    tone: "info" | "success" | "error",
    message: string,
    durationMs = 3200,
  ) {
    if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
    setActionToast({ tone, message });
    actionToastTimerRef.current = setTimeout(() => {
      setActionToast(null);
      actionToastTimerRef.current = null;
    }, durationMs);
  }

  function openCreateServiceCompletionTab() {
    const url = `${CREATE_SERVICE_COMPLETION_PAGE_PATH}?contractId=${encodeURIComponent(recordId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    showActionToast("info", "Opened Create Service Completion in a new tab.");
  }

  function handleAction(action: ContractRecordButtonLabel) {
    setOpen(false);

    if (action === CREATE_SERVICE_COMPLETION_BUTTON_LABEL) {
      openCreateServiceCompletionTab();
      onAction?.(action, recordId);
      return;
    }

    if (action === SEND_MESSAGE_BUTTON_LABEL) {
      setSendMessageOpen(true);
      onAction?.(action, recordId);
      return;
    }

    if (action === CREATE_CONTRACT_PDF_BUTTON_LABEL) {
      setCreateContractPdfOpen(true);
      onAction?.(action, recordId);
      return;
    }

    if (action === COMPLIANCE_FIELDS_BUTTON_LABEL) {
      setComplianceFieldsOpen(true);
      onAction?.(action, recordId);
      return;
    }

    if (action === PO_ADDENDUM_BUTTON_LABEL) {
      setPoAddendumOpen(true);
      onAction?.(action, recordId);
      return;
    }

    if (action === CLONE_CONTRACT_BUTTON_LABEL) {
      setCloneContractOpen(true);
      onAction?.(action, recordId);
      return;
    }

    if (action === RENEW_CONTRACT_BUTTON_LABEL) {
      setRenewContractOpen(true);
      onAction?.(action, recordId);
      return;
    }

    if (action === CLIENT_SENDING_RFP_BUTTON_LABEL) {
      setClientSendingRfpOpen(true);
      onAction?.(action, recordId);
      return;
    }

    if (action === STATUS_VENDOR_COMPLIANCE_BUTTON_LABEL) {
      setStatusVendorComplianceOpen(true);
      onAction?.(action, recordId);
      return;
    }

    if (!CONFIGURED_RECORD_BUTTONS.has(action)) {
      showInProgress(action);
    }

    onAction?.(action, recordId);
  }

  return (
    <>
      <div ref={rootRef} className={cn("relative", className)}>
        <div className="inline-flex overflow-hidden rounded-lg border border-crm-border bg-crm-panel">
          <button
            type="button"
            className="crm-toolbar-btn h-8 rounded-none border-0 px-3 text-sm font-medium text-crm-text hover:bg-crm-panel-muted"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            Buttons
          </button>
          <button
            type="button"
            className="crm-toolbar-btn flex h-8 w-8 items-center justify-center rounded-none border-0 border-l border-crm-border text-crm-text hover:bg-crm-panel-muted"
            aria-label="Open buttons menu"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown
              className={cn(
                "size-4 text-crm-text-muted transition",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </div>

        {open ?
          <div
            className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-crm-border bg-crm-panel shadow-xl"
            role="menu"
            aria-label="Record buttons"
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
              : filtered.map((label) => (
                  <button
                    key={label}
                    type="button"
                    role="menuitem"
                    className="flex w-full cursor-pointer px-3 py-2.5 text-left text-sm text-crm-text transition hover:bg-blue-500/10"
                    onClick={() => handleAction(label)}
                  >
                    {label}
                  </button>
                ))
              }
            </div>
          </div>
        : null}
      </div>

      <SendMessageWidget
        open={sendMessageOpen}
        onClose={() => setSendMessageOpen(false)}
        selectedRecordIds={[recordId]}
        module="Contracts"
      />

      <CreateContractPdfWidget
        open={createContractPdfOpen}
        onClose={() => setCreateContractPdfOpen(false)}
        selectedRecordIds={[recordId]}
        module="Contracts"
      />

      <ComplianceFieldsWidget
        open={complianceFieldsOpen}
        onClose={() => setComplianceFieldsOpen(false)}
        selectedRecordIds={[recordId]}
        module="Contracts"
      />

      <PoAddendumWidget
        open={poAddendumOpen}
        onClose={() => setPoAddendumOpen(false)}
        selectedRecordIds={[recordId]}
        module="Contracts"
      />

      <CloneContractWidget
        open={cloneContractOpen}
        onClose={() => setCloneContractOpen(false)}
        selectedRecordIds={[recordId]}
        module="Contracts"
      />

      <MassRenewalContractsWidget
        open={renewContractOpen}
        onClose={() => setRenewContractOpen(false)}
        selectedRecordIds={[recordId]}
        module="Contracts"
      />

      <ClientSendingRfpWidget
        open={clientSendingRfpOpen}
        onClose={() => setClientSendingRfpOpen(false)}
        selectedRecordIds={[recordId]}
        module="Contracts"
      />

      <StatusVendorComplianceWidget
        open={statusVendorComplianceOpen}
        onClose={() => setStatusVendorComplianceOpen(false)}
        selectedRecordIds={[recordId]}
        module="Contracts"
      />

      {inProgressMessage ?
        <div
          className="fixed bottom-4 left-1/2 z-[110] max-w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-amber-500/30 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900 shadow-lg dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-100"
          role="status"
          aria-live="polite"
        >
          {inProgressMessage}
        </div>
      : null}

      {actionToast ?
        <div
          className={cn(
            "fixed bottom-4 left-1/2 z-[110] max-w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border px-4 py-2.5 text-center text-sm shadow-lg",
            actionToast.tone === "success" &&
              "border-emerald-500/30 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/90 dark:text-emerald-100",
            actionToast.tone === "error" &&
              "border-red-500/30 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-950/90 dark:text-red-100",
            actionToast.tone === "info" &&
              "border-blue-500/30 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-950/90 dark:text-blue-100",
          )}
          role="status"
          aria-live="polite"
        >
          {actionToast.message}
        </div>
      : null}
    </>
  );
}
