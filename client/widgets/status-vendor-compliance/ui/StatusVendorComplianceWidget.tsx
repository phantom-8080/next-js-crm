"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  STATUS_VENDOR_COMPLIANCE_WIDGET_NAME,
  TRANSITION_LABEL_ACTIVATE_VENDOR,
} from "@/widgets/status-vendor-compliance/types";
import type {
  StatusVendorComplianceLoadResult,
  StatusVendorComplianceSaveResult,
  VendorComplianceForm,
} from "@/widgets/status-vendor-compliance/types";
import type { WidgetOpenContext } from "@/widgets/types";

const EMPTY_FIELDS: VendorComplianceForm = {
  w9Url: "",
  coiExpiration: "",
  workersComp: "",
  legalName: "",
  bankAch: "",
};

type StatusVendorComplianceWidgetProps = WidgetOpenContext & {
  open: boolean;
  onClose: () => void;
  className?: string;
};

const inputClassName =
  "h-10 w-full rounded-lg border border-crm-border bg-crm-panel px-3 text-sm text-crm-text outline-none placeholder:text-crm-text-muted focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * UI for “Status Vendor Compliance” — mirrors widget.html / index.js.
 */
export function StatusVendorComplianceWidget({
  open,
  onClose,
  selectedRecordIds,
  className,
}: StatusVendorComplianceWidgetProps) {
  const titleId = useId();
  const contractId = selectedRecordIds[0]?.trim() ?? "";
  const closeReloadRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState("Loading...");
  const [showForm, setShowForm] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorExists, setVendorExists] = useState(false);
  const [fields, setFields] = useState<VendorComplianceForm>(EMPTY_FIELDS);

  const [openSnapshot, setOpenSnapshot] = useState(false);
  if (open !== openSnapshot) {
    setOpenSnapshot(open);
    if (open) {
      setLoading(false);
      setSaving(false);
      setError(null);
      setSuccess(null);
      setCurrentStatus("Loading...");
      setShowForm(false);
      setVendorId("");
      setVendorName("");
      setVendorExists(false);
      setFields(EMPTY_FIELDS);
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
      if (closeReloadRef.current) clearTimeout(closeReloadRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open || !contractId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(
      `/api/widgets/status-vendor-compliance?contractId=${encodeURIComponent(contractId)}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const data = (await response.json().catch(
          () => ({}),
        )) as StatusVendorComplianceLoadResult;
        if (!response.ok || !data.ok) {
          throw new Error(data.message || "Failed to load record data.");
        }
        setCurrentStatus(data.currentStatus || "Unknown");
        setVendorId(data.vendorId || "");
        setVendorName(data.vendorName || "");
        setVendorExists(Boolean(data.vendorExists));
        setFields(data.fields ?? EMPTY_FIELDS);
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

  function updateField<K extends keyof VendorComplianceForm>(
    key: K,
    value: VendorComplianceForm[K],
  ) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setSuccess(null);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

    if (!vendorExists || !vendorId) {
      setError("Vendor field is empty. Cannot save compliance.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/widgets/status-vendor-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          vendorId,
          fields,
        }),
      });
      const data = (await response.json().catch(
        () => ({}),
      )) as StatusVendorComplianceSaveResult;

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Failed to save compliance.");
      }

      setSuccess(data.message || "Saved successfully.");
      if (data.finalStatus) setCurrentStatus(data.finalStatus);
      setShowForm(false);

      if (closeReloadRef.current) clearTimeout(closeReloadRef.current);
      closeReloadRef.current = setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save compliance.",
      );
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving;
  const fieldsEnabled = vendorExists && !busy;

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
          showForm ? "max-w-lg" : "max-w-md",
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
              {STATUS_VENDOR_COMPLIANCE_WIDGET_NAME}
            </h2>
            {vendorName ?
              <p className="mt-1 truncate text-sm text-crm-text-muted">
                Vendor: {vendorName}
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

        <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-crm-text-muted">
              Current State
            </span>
            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-medium text-white">
              {currentStatus}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-crm-text-muted">
              Transitions
            </span>
            {!showForm ?
              <Button
                type="button"
                className="h-8 bg-blue-600 px-3 text-sm text-white hover:bg-blue-500"
                onClick={() => {
                  setShowForm(true);
                  setError(null);
                  setSuccess(null);
                }}
                disabled={busy}
              >
                {TRANSITION_LABEL_ACTIVATE_VENDOR}
              </Button>
            : null}
          </div>

          {showForm ?
            <div className="space-y-4 border-t border-crm-border pt-4">
              {!vendorExists ?
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                  Vendor field is empty. Fields stay disabled until a Vendor is
                  linked on the contract.
                </p>
              : null}

              <Field
                id="svc-w9"
                label="Vendor-W9 URL"
                required
                disabled={!fieldsEnabled}
              >
                <input
                  id="svc-w9"
                  type="url"
                  value={fields.w9Url}
                  disabled={!fieldsEnabled}
                  className={inputClassName}
                  onChange={(e) => updateField("w9Url", e.target.value)}
                  title={
                    vendorExists
                      ? undefined
                      : "This field will be enabled only when Vendor field is filled with a value."
                  }
                />
              </Field>

              <Field
                id="svc-coi"
                label="Vendor-COI Expiration"
                required
                disabled={!fieldsEnabled}
              >
                <input
                  id="svc-coi"
                  type="date"
                  value={fields.coiExpiration}
                  disabled={!fieldsEnabled}
                  className={inputClassName}
                  onChange={(e) => updateField("coiExpiration", e.target.value)}
                />
              </Field>

              <Field
                id="svc-wc"
                label="Vendor-Workers Compensation"
                required
                disabled={!fieldsEnabled}
              >
                <input
                  id="svc-wc"
                  type="url"
                  value={fields.workersComp}
                  disabled={!fieldsEnabled}
                  className={inputClassName}
                  onChange={(e) => updateField("workersComp", e.target.value)}
                />
              </Field>

              <Field
                id="svc-legal"
                label="Vendor-Legal Name (Must Be Same As W9)"
                required
                disabled={!fieldsEnabled}
              >
                <input
                  id="svc-legal"
                  type="text"
                  value={fields.legalName}
                  disabled={!fieldsEnabled}
                  className={inputClassName}
                  onChange={(e) => updateField("legalName", e.target.value)}
                />
              </Field>

              <Field
                id="svc-ach"
                label="Vendor-Bank ACH"
                disabled={!fieldsEnabled}
              >
                <input
                  id="svc-ach"
                  type="url"
                  value={fields.bankAch}
                  disabled={!fieldsEnabled}
                  className={inputClassName}
                  onChange={(e) => updateField("bankAch", e.target.value)}
                />
              </Field>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-4"
                  onClick={() => setShowForm(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-9 bg-blue-600 px-4 text-white hover:bg-blue-500"
                  onClick={() => void handleSave()}
                  disabled={busy || !vendorExists}
                >
                  Save
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

function Field({
  id,
  label,
  required,
  disabled,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={cn(
          "text-sm font-medium text-crm-text",
          disabled && "opacity-70",
        )}
      >
        {label}
        {required ?
          <span className="ml-0.5 text-red-500" aria-hidden>
            *
          </span>
        : null}
      </label>
      {children}
    </div>
  );
}
