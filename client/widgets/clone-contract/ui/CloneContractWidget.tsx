"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLONE_CONTRACT_WIDGET_NAME } from "@/widgets/clone-contract";
import type {
  CloneContractContext,
  CloneContractResult,
  VendorSearchResult,
  VendorSuggestion,
} from "@/widgets/clone-contract/types";
import type { WidgetOpenContext } from "@/widgets/types";
import { getContractZohoRecordUrl } from "@/lib/zoho/crmRecordUrls";

type CloneContractWidgetProps = WidgetOpenContext & {
  open: boolean;
  onClose: () => void;
  className?: string;
};

/**
 * UI for “Clone Contract” — search a new vendor, clone the contract, create PO.
 * Mirrors widget.html / index.js.
 */
export function CloneContractWidget({
  open,
  onClose,
  selectedRecordIds,
  className,
}: CloneContractWidgetProps) {
  const titleId = useId();
  const contractId = selectedRecordIds[0]?.trim() ?? "";
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorPersistent, setErrorPersistent] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentVendorId, setCurrentVendorId] = useState("");
  const [currentVendorName, setCurrentVendorName] = useState("");
  const [contractName, setContractName] = useState("");

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<VendorSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState("");

  const [openSnapshot, setOpenSnapshot] = useState(false);
  if (open !== openSnapshot) {
    setOpenSnapshot(open);
    if (open) {
      setLoading(false);
      setCreating(false);
      setError(null);
      setErrorPersistent(false);
      setSuccess(null);
      setCurrentVendorId("");
      setCurrentVendorName("");
      setContractName("");
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      setSearching(false);
      setSelectedVendorId(null);
      setSelectedVendorName("");
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !creating && !loading) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, creating, loading]);

  useEffect(() => {
    if (!open || !contractId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setErrorPersistent(false);

    fetch(
      `/api/widgets/clone-contract?contractId=${encodeURIComponent(contractId)}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const data = (await response.json().catch(
          () => ({}),
        )) as CloneContractContext;
        if (!response.ok || !data.ok) {
          throw new Error(data.message || "Failed to load contract.");
        }
        setCurrentVendorId(data.currentVendorId || "");
        setCurrentVendorName(data.currentVendorName || "");
        setContractName(data.contractName || "");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load contract.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, contractId]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, []);

  if (!open) return null;

  function clearStatus() {
    setError(null);
    setErrorPersistent(false);
    setSuccess(null);
  }

  function onSearchInput(value: string) {
    setQuery(value);
    setSelectedVendorId(null);
    setSelectedVendorName("");
    clearStatus();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/widgets/clone-contract?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" },
        );
        const data = (await response.json().catch(
          () => ({}),
        )) as VendorSearchResult;
        if (!response.ok || !data.ok) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }
        setSuggestions(data.vendors ?? []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectVendor(vendor: VendorSuggestion) {
    if (vendor.id === currentVendorId) {
      setError("This vendor is already assigned to this contract");
      setErrorPersistent(false);
      setShowSuggestions(false);
      return;
    }
    setQuery(vendor.name);
    setSelectedVendorId(vendor.id);
    setSelectedVendorName(vendor.name);
    setShowSuggestions(false);
    clearStatus();
  }

  async function handleCreate() {
    clearStatus();

    if (!selectedVendorId) {
      setError("Please select a vendor first");
      return;
    }
    if (selectedVendorId === currentVendorId) {
      setError("This vendor is already assigned to this contract");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/widgets/clone-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          vendorId: selectedVendorId,
          vendorName: selectedVendorName,
        }),
      });
      const data = (await response.json().catch(
        () => ({}),
      )) as CloneContractResult;

      if (!response.ok || !data.ok) {
        const base = data.message || "Failed to update contract";
        const alreadyHasField = data.failedField
          ? base.includes(data.failedField)
          : true;
        const fieldHint =
          data.failedField && !alreadyHasField ?
            ` [field: ${data.failedField}]`
          : "";
        setError(`${base}${fieldHint}`);
        setErrorPersistent(data.persistent === true);
        return;
      }

      setSuccess(data.message || "New contract created");
      const newId = data.newContractId?.trim();
      if (newId) {
        // Brief success message, then open the new contract (same as Zoho Record.open).
        if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
        navigateTimerRef.current = setTimeout(() => {
          onClose();
          window.location.assign(getContractZohoRecordUrl(newId));
        }, 800);
      } else {
        setError("Contract created but ID not returned");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update contract",
      );
    } finally {
      setCreating(false);
    }
  }

  const busy = loading || creating;
  const inputClassName =
    "h-10 w-full rounded-lg border border-crm-border bg-crm-panel px-3 text-sm text-crm-text outline-none placeholder:text-crm-text-muted focus:border-blue-500 disabled:opacity-60";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px] dark:bg-black/60"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
        className={cn(
          "relative w-full max-w-[28rem] overflow-hidden rounded-2xl border border-crm-border bg-crm-panel shadow-xl",
          className,
        )}
      >
        {busy ?
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-crm-panel/85 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
          >
            <Loader2
              className="size-10 animate-spin text-blue-600"
              aria-hidden
            />
            <p className="text-sm font-medium text-crm-text">
              {creating ? "Creating…" : "Loading contract…"}
            </p>
          </div>
        : null}

        <header className="flex items-start justify-between gap-3 border-b border-crm-border bg-crm-panel-muted/80 px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="page-heading truncate text-base sm:text-lg"
            >
              {CLONE_CONTRACT_WIDGET_NAME}
            </h2>
            <p className="mt-1 text-sm text-crm-text-muted">
              {contractName ?
                `Clone “${contractName}” with a new vendor`
              : "Select a vendor and create a new contract"}
            </p>
            {currentVendorName ?
              <p className="mt-0.5 text-xs text-crm-text-muted">
                Current vendor: {currentVendorName}
              </p>
            : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="crm-toolbar-btn shrink-0"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </header>

        <div className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="relative space-y-1.5">
            <label
              htmlFor="clone-vendor-search"
              className="text-sm font-medium text-crm-text"
            >
              Search Vendor
            </label>
            <input
              ref={searchRef}
              id="clone-vendor-search"
              type="text"
              autoComplete="off"
              value={query}
              onChange={(e) => onSearchInput(e.target.value)}
              onFocus={() => {
                if (query.trim().length >= 2 && suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              disabled={busy}
              placeholder="Enter vendor name…"
              className={inputClassName}
            />
            {searching ?
              <p className="text-xs text-crm-text-muted">Searching…</p>
            : null}

            {showSuggestions ?
              <ul
                className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-crm-border bg-crm-panel text-sm shadow-lg"
                role="listbox"
                aria-label="Vendor suggestions"
              >
                {suggestions.length === 0 ?
                  <li className="cursor-default px-3 py-2 italic text-crm-text-muted">
                    No vendors found
                  </li>
                : suggestions.map((vendor) => (
                    <li key={vendor.id} role="option">
                      <button
                        type="button"
                        className="w-full cursor-pointer px-3 py-2 text-left text-crm-text transition hover:bg-blue-500/10"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectVendor(vendor)}
                      >
                        {vendor.name}
                      </button>
                    </li>
                  ))
                }
              </ul>
            : null}
          </div>

          {error ?
            <div
              className="flex items-start justify-between gap-2 whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
              role="alert"
            >
              <span className="min-w-0 flex-1">{error}</span>
              {errorPersistent ?
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-red-700 hover:bg-red-500/10 dark:text-red-300"
                  aria-label="Dismiss message"
                  onClick={clearStatus}
                >
                  <X className="size-4" aria-hidden />
                </button>
              : null}
            </div>
          : null}

          {success ?
            <p
              className="whitespace-pre-wrap rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
              role="status"
            >
              {success}
            </p>
          : null}

          <Button
            type="button"
            className="h-10 w-full bg-blue-600 text-white hover:bg-blue-500"
            onClick={handleCreate}
            disabled={busy || !selectedVendorId}
          >
            Create Contract
          </Button>
        </div>
      </div>
    </div>
  );
}
