"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INVITE_TO_VENDOR_PORTAL_WIDGET_NAME } from "@/widgets/vendor/invite-to-vendor-portal";
import type { InviteToVendorPortalResult } from "@/widgets/vendor/invite-to-vendor-portal/types";
import type { WidgetOpenContext } from "@/widgets/types";

type InviteToVendorPortalWidgetProps = WidgetOpenContext & {
  open: boolean;
  onClose: () => void;
  className?: string;
};

/**
 * Invite to Vendor Portal — runs Zoho `createVendor` for selected vendor IDs
 * and shows invited / duplicate results (legacy Success Popup widget).
 */
export function InviteToVendorPortalWidget({
  open,
  onClose,
  selectedRecordIds,
  module = "Vendors",
  className,
}: InviteToVendorPortalWidgetProps) {
  const titleId = useId();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteToVendorPortalResult | null>(null);

  const [openSnapshot, setOpenSnapshot] = useState(false);
  if (open !== openSnapshot) {
    setOpenSnapshot(open);
    if (open) {
      setSubmitting(false);
      setError(null);
      setResult(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, submitting]);

  if (!open) return null;

  async function handleInvite() {
    setError(null);
    setResult(null);

    if (selectedRecordIds.length === 0) {
      setError("Select at least one vendor.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/widgets/invite-to-vendor-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedRecordIds, module }),
      });
      const data = (await response.json().catch(
        () => ({}),
      )) as InviteToVendorPortalResult;
      if (!response.ok || !data.ok) {
        throw new Error(
          data.message || "There was an error processing your request.",
        );
      }
      setResult(data);
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "There was an error processing your request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const invitedCount = result?.invitedCount;
  const duplicateCount = result?.duplicateCount ?? 0;
  const failedRecords = result?.failedRecords ?? [];
  const showSuccess = invitedCount != null && Number.isFinite(invitedCount);
  const showFailure = duplicateCount > 0 || failedRecords.length > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px] dark:bg-black/60"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={submitting}
        className={cn(
          "relative w-full max-w-[32rem] overflow-hidden rounded-2xl border border-crm-border bg-crm-panel shadow-xl",
          className,
        )}
      >
        {submitting ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-crm-panel/85 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
          >
            <Loader2
              className="size-12 animate-spin text-blue-600"
              aria-hidden
            />
            <p className="text-sm font-semibold text-blue-600">Processing…</p>
          </div>
        ) : null}

        <header className="flex items-start justify-between gap-3 border-b border-crm-border bg-crm-panel-muted/80 px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="page-heading truncate text-base sm:text-lg"
            >
              {INVITE_TO_VENDOR_PORTAL_WIDGET_NAME}
            </h2>
            <p className="mt-1 text-sm text-crm-text-muted">
              {selectedRecordIds.length.toLocaleString("en-US")} vendor
              {selectedRecordIds.length === 1 ? "" : "s"} selected
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="crm-toolbar-btn shrink-0"
            aria-label="Close"
            onClick={onClose}
            disabled={submitting}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </header>

        <div className="px-5 py-6 sm:px-7">
          {result || error ? (
            <div className="space-y-4">
              {error ? (
                <p
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-300"
                  role="alert"
                >
                  <strong>Error:</strong> {error}
                </p>
              ) : null}

              {result && showSuccess ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                  <strong>Success:</strong> {invitedCount} record
                  {invitedCount === 1 ? "" : "s"} invited.
                </div>
              ) : null}

              {result && showFailure ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-300">
                  <p className="font-semibold">
                    Failure:{" "}
                    {duplicateCount > 0
                      ? `${duplicateCount} record${duplicateCount === 1 ? "" : "s"} failed due to duplication.`
                      : "Some records failed."}
                  </p>
                  {failedRecords.length > 0 ? (
                    <div className="mt-3 max-h-48 overflow-auto rounded-md border border-red-500/20 bg-crm-panel">
                      <table className="w-full min-w-[16rem] border-collapse text-left text-xs text-crm-text">
                        <thead className="bg-crm-panel-muted text-crm-text-muted">
                          <tr>
                            <th className="border-b border-crm-border px-3 py-2 font-medium">
                              ID
                            </th>
                            <th className="border-b border-crm-border px-3 py-2 font-medium">
                              Reason
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {failedRecords.map((row) => (
                            <tr key={`${row.id}-${row.reason}`}>
                              <td className="border-b border-crm-border px-3 py-2 font-mono">
                                {row.id}
                              </td>
                              <td className="border-b border-crm-border px-3 py-2">
                                {row.reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {result && !error && !showSuccess && !showFailure ? (
                <p
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-800 dark:text-emerald-200"
                  role="status"
                >
                  {result.message || "Invite completed."}
                </p>
              ) : null}

              <Button
                type="button"
                className="h-10 w-full bg-blue-600 text-white hover:bg-blue-500"
                onClick={onClose}
              >
                OK
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-crm-text">
                Invite the selected vendor
                {selectedRecordIds.length === 1 ? "" : "s"} to the vendor
                portal?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="crm-toolbar-btn h-10 flex-1"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-10 flex-1 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
                  onClick={handleInvite}
                  disabled={submitting || selectedRecordIds.length === 0}
                >
                  Invite
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
