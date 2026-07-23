"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CLIENT_SENDING_RFP_WIDGET_NAME,
  TRANSITION_LABEL_SOURCING,
} from "@/widgets/client-sending-rfp/types";
import type {
  ClientSendingRfpLoadResult,
  ClientSendingRfpSaveResult,
  ClientSendingRfpSearchResult,
  ClientSendingRfpSiteDetailsResult,
  ClientSendingRfpSiteSuggestion,
} from "@/widgets/client-sending-rfp/types";
import type { WidgetOpenContext } from "@/widgets/types";

type ClientSendingRfpWidgetProps = WidgetOpenContext & {
  open: boolean;
  onClose: () => void;
  className?: string;
};

const inputClassName =
  "h-10 w-full rounded-lg border border-crm-border bg-crm-panel px-3 text-sm text-crm-text outline-none placeholder:text-crm-text-muted focus:border-blue-500 disabled:opacity-60";

/**
 * UI for “Status Client Sending RFP” — mirrors widget.html / index.js.
 */
export function ClientSendingRfpWidget({
  open,
  onClose,
  selectedRecordIds,
  className,
}: ClientSendingRfpWidgetProps) {
  const titleId = useId();
  const contractId = selectedRecordIds[0]?.trim() ?? "";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeReloadRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState("Loading...");
  const [showFields, setShowFields] = useState(false);

  const [siteName, setSiteName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [siteStreet, setSiteStreet] = useState("");
  const [siteCity, setSiteCity] = useState("");
  const [siteState, setSiteState] = useState("");
  const [siteZip, setSiteZip] = useState("");
  const [siteError, setSiteError] = useState("");
  const [suggestions, setSuggestions] = useState<
    ClientSendingRfpSiteSuggestion[]
  >([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  const [openSnapshot, setOpenSnapshot] = useState(false);
  if (open !== openSnapshot) {
    setOpenSnapshot(open);
    if (open) {
      setLoading(false);
      setSaving(false);
      setError(null);
      setSuccess(null);
      setCurrentStatus("Loading...");
      setShowFields(false);
      setSiteName("");
      setSiteId("");
      setSiteStreet("");
      setSiteCity("");
      setSiteState("");
      setSiteZip("");
      setSiteError("");
      setSuggestions([]);
      setSuggestionsOpen(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving && !loading) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, saving, loading]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (closeReloadRef.current) clearTimeout(closeReloadRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open || !contractId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(
      `/api/widgets/client-sending-rfp?contractId=${encodeURIComponent(contractId)}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const data = (await response.json().catch(
          () => ({}),
        )) as ClientSendingRfpLoadResult;
        if (!response.ok || !data.ok) {
          throw new Error(data.message || "Failed to load record data.");
        }
        setCurrentStatus(data.currentStatus || "Unknown");
        setSiteName(data.siteName || "");
        setSiteId(data.siteId || "");
        setSiteStreet(data.siteStreet || "");
        setSiteCity(data.siteCity || "");
        setSiteState(data.siteState || "");
        setSiteZip(data.siteZip || "");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load record data.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, contractId]);

  if (!open) return null;

  function startSourcing() {
    setShowFields(true);
    setSuccess(null);
    setError(null);
  }

  function cancelFields() {
    setShowFields(false);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setSiteError("");
  }

  function scheduleSiteSearch(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSiteSearch(query.trim());
    }, 400);
  }

  async function runSiteSearch(query: string) {
    setSearching(true);
    try {
      const response = await fetch(
        `/api/widgets/client-sending-rfp?q=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(
        () => ({}),
      )) as ClientSendingRfpSearchResult;
      if (!response.ok || !data.ok) {
        setSuggestions([]);
        setSuggestionsOpen(false);
        return;
      }
      setSuggestions(data.sites ?? []);
      setSuggestionsOpen(true);
    } catch {
      setSuggestions([]);
      setSuggestionsOpen(false);
    } finally {
      setSearching(false);
    }
  }

  async function selectSite(site: ClientSendingRfpSiteSuggestion) {
    setSiteId(site.id);
    setSiteName(site.name);
    setSuggestionsOpen(false);
    setSuggestions([]);
    setSiteError("");

    try {
      const response = await fetch(
        `/api/widgets/client-sending-rfp?siteId=${encodeURIComponent(site.id)}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(
        () => ({}),
      )) as ClientSendingRfpSiteDetailsResult;
      if (!response.ok || !data.ok) {
        setError(data.message || "Error fetching site details");
        return;
      }
      setSiteStreet(data.siteStreet || "");
      setSiteCity(data.siteCity || "");
      setSiteState(data.siteState || "");
      setSiteZip(data.siteZip || "");
    } catch {
      setError("Error fetching site details");
    }
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

    if (!siteName.trim() || !siteId.trim()) {
      setSiteError("Please select a valid site from suggestions.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/widgets/client-sending-rfp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          siteId,
          siteStreet,
          siteCity,
          siteState,
          siteZip,
        }),
      });
      const data = (await response.json().catch(
        () => ({}),
      )) as ClientSendingRfpSaveResult;

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Failed to save fields.");
      }

      setSuccess(data.message || "Fields saved successfully!");
      cancelFields();
      if (data.finalStatus) {
        setCurrentStatus(data.finalStatus);
      }

      // Match Zoho `Popup.closeReload` after success.
      if (closeReloadRef.current) clearTimeout(closeReloadRef.current);
      closeReloadRef.current = setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save fields.");
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving;

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
          "relative w-full overflow-hidden rounded-2xl border border-crm-border bg-crm-panel shadow-xl",
          showFields ? "max-w-lg" : "max-w-md",
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
              {saving ? "Saving…" : "Loading…"}
            </p>
          </div>
        : null}

        <header className="flex items-start justify-between gap-3 border-b border-crm-border bg-crm-panel-muted/80 px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="page-heading truncate text-base sm:text-lg"
            >
              {CLIENT_SENDING_RFP_WIDGET_NAME}
            </h2>
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

        <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-crm-text-muted">
              Current State
            </span>
            <span className="rounded-full bg-orange-400/90 px-2.5 py-1 text-xs font-medium text-black">
              {currentStatus}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-crm-text-muted">
              Transitions
            </span>
            {!showFields ?
              <Button
                type="button"
                className="h-8 bg-blue-600 px-3 text-sm text-white hover:bg-blue-500"
                onClick={startSourcing}
                disabled={busy || Boolean(error && !currentStatus)}
              >
                {TRANSITION_LABEL_SOURCING}
              </Button>
            : null}
          </div>

          {showFields ?
            <div className="space-y-4 border-t border-crm-border pt-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-start sm:gap-3">
                <label className="flex items-center gap-1 text-sm font-medium text-crm-text sm:col-span-1">
                  Site:
                  <span
                    className="group relative inline-flex cursor-help text-crm-text-muted"
                    title="Make sure Sites / Clients are Current Status = Current! Required for Client Contract"
                  >
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-crm-border text-[10px] font-semibold text-crm-text">
                      i
                    </span>
                  </span>
                </label>
                <div className="relative sm:col-span-3">
                  <input
                    type="text"
                    value={siteName}
                    autoComplete="off"
                    disabled={busy}
                    className={cn(
                      inputClassName,
                      siteError && "border-red-500 focus:border-red-500",
                    )}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSiteName(value);
                      setSiteId("");
                      if (!value.trim()) {
                        setSiteError("Site cannot be empty");
                      } else {
                        setSiteError("");
                      }
                      scheduleSiteSearch(value);
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) setSuggestionsOpen(true);
                    }}
                  />
                  {siteError ?
                    <span className="mt-1 block text-xs text-red-500">
                      {siteError}
                    </span>
                  : null}
                  {suggestionsOpen ?
                    <ul className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-crm-border bg-crm-panel shadow-lg">
                      {searching ?
                        <li className="px-3 py-2 text-sm text-crm-text-muted">
                          Searching…
                        </li>
                      : suggestions.length === 0 ?
                        <li className="px-3 py-2 text-sm text-crm-text-muted">
                          No item found
                        </li>
                      : suggestions.map((site) => (
                          <li key={site.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm text-crm-text hover:bg-crm-panel-muted"
                              onClick={() => void selectSite(site)}
                            >
                              {site.name}
                            </button>
                          </li>
                        ))
                      }
                    </ul>
                  : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-3">
                <label className="text-sm font-medium text-crm-text sm:col-span-1">
                  Site Street:
                </label>
                <input
                  type="text"
                  value={siteStreet}
                  disabled={busy}
                  className={cn(inputClassName, "sm:col-span-3")}
                  onChange={(e) => setSiteStreet(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-3">
                <label className="text-sm font-medium text-crm-text sm:col-span-1">
                  Site City:
                </label>
                <input
                  type="text"
                  value={siteCity}
                  disabled={busy}
                  className={cn(inputClassName, "sm:col-span-3")}
                  onChange={(e) => setSiteCity(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-3">
                <label className="text-sm font-medium text-crm-text sm:col-span-1">
                  Site State:
                </label>
                <input
                  type="text"
                  value={siteState}
                  disabled={busy}
                  className={cn(inputClassName, "sm:col-span-3")}
                  onChange={(e) => setSiteState(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-3">
                <label className="text-sm font-medium text-crm-text sm:col-span-1">
                  Site Zip:
                </label>
                <input
                  type="text"
                  value={siteZip}
                  disabled={busy}
                  className={cn(inputClassName, "sm:col-span-3")}
                  onChange={(e) => setSiteZip(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  className="h-9 bg-blue-600 px-4 text-white hover:bg-blue-500"
                  onClick={() => void handleSave()}
                  disabled={busy}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-4"
                  onClick={cancelFields}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          : null}

          {error ?
            <p className="whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          : null}

          {success ?
            <p className="whitespace-pre-wrap rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
              {success}
            </p>
          : null}
        </div>
      </div>
    </div>
  );
}
