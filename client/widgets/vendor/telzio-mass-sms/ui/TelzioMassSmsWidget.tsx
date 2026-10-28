"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TELZIO_MASS_SMS_WIDGET_NAME } from "@/widgets/vendor/telzio-mass-sms";
import type {
  TelzioMassSmsRecipientsResult,
  TelzioMassSmsResult,
  TelzioSmsRecipient,
} from "@/widgets/vendor/telzio-mass-sms/types";
import type { WidgetOpenContext } from "@/widgets/types";

type TelzioMassSmsWidgetProps = WidgetOpenContext & {
  open: boolean;
  onClose: () => void;
  className?: string;
};

/**
 * Telzio Mass SMS — type a message and send it to selected vendors' phone
 * numbers via Zoho CRM function `Vendor_Mass_SMS`.
 */
export function TelzioMassSmsWidget({
  open,
  onClose,
  selectedRecordIds,
  module = "Vendors",
  className,
}: TelzioMassSmsWidgetProps) {
  const titleId = useId();
  const messageId = useId();

  const [recipients, setRecipients] = useState<TelzioSmsRecipient[]>([]);
  const [skippedNotes, setSkippedNotes] = useState<string[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TelzioMassSmsResult | null>(null);

  const idsKey = selectedRecordIds.join(",");

  const [openSnapshot, setOpenSnapshot] = useState({ open: false, idsKey: "" });
  if (open !== openSnapshot.open || idsKey !== openSnapshot.idsKey) {
    setOpenSnapshot({ open, idsKey });
    if (open) {
      setMessage("");
      setSubmitting(false);
      setError(null);
      setResult(null);
      setRecipients([]);
      setSkippedNotes([]);
      setRecipientsLoading(true);
    }
  }

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      module,
      ids: selectedRecordIds.join(","),
    });

    fetch(`/api/widgets/telzio-mass-sms?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json().catch(
          () => ({}),
        )) as TelzioMassSmsRecipientsResult;
        if (!response.ok && !data.recipients?.length) {
          throw new Error(data.message || "Failed to load recipients.");
        }
        setRecipients(Array.isArray(data.recipients) ? data.recipients : []);
        setSkippedNotes(
          Array.isArray(data.skipped)
            ? data.skipped.map((item) => item.reason)
            : [],
        );
        if (!data.ok && data.message) {
          setError(data.message);
        }
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name === "AbortError") return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load recipients.",
        );
        setRecipients([]);
      })
      .finally(() => setRecipientsLoading(false));

    return () => controller.abort();
  }, [open, module, idsKey, selectedRecordIds]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, submitting]);

  if (!open) return null;

  async function handleSend() {
    setError(null);
    setResult(null);

    const trimmed = message.trim();
    if (!trimmed) {
      setError("Message cannot be empty.");
      return;
    }
    if (recipients.length === 0) {
      setError("No recipients selected.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/widgets/telzio-mass-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedRecordIds,
          message: trimmed,
          module,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as TelzioMassSmsResult;
      if (!response.ok && !data.ok) {
        throw new Error(data.message || "Failed to send messages.");
      }
      setResult(data);
      if (data.ok) setMessage("");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send messages.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const showDone = Boolean(result);

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
        aria-busy={submitting || recipientsLoading}
        className={cn(
          "relative w-full max-w-[28rem] overflow-hidden rounded-2xl border border-crm-border bg-crm-panel shadow-xl",
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
              className="size-10 animate-spin text-blue-600"
              aria-hidden
            />
            <p className="text-sm font-medium text-crm-text">Sending SMS…</p>
          </div>
        ) : null}

        <header className="flex items-start justify-between gap-3 border-b border-crm-border bg-crm-panel-muted/80 px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="page-heading truncate text-base sm:text-lg"
            >
              {TELZIO_MASS_SMS_WIDGET_NAME}
            </h2>
            <p className="mt-1 text-sm text-crm-text-muted">
              SMS selected vendors via Telzio
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

        <div className="px-5 py-5 sm:px-7 sm:py-6">
          {showDone && result ? (
            <div className="space-y-4">
              <p
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  result.ok && !result.failureCount
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
                )}
                role="status"
              >
                {result.message}
              </p>
              {result.errors?.length ? (
                <ul className="max-h-36 list-disc space-y-1 overflow-auto rounded-lg border border-crm-border bg-crm-panel-muted p-3 pl-8 text-xs text-crm-text-muted">
                  {result.errors.map((item) => (
                    <li key={`${item.id}-${item.message}`}>
                      {item.name || item.id}: {item.message}
                    </li>
                  ))}
                </ul>
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
              <div>
                <p className="mb-1.5 text-sm font-medium text-crm-text">
                  Selected Recipients
                </p>
                <div className="max-h-36 overflow-auto rounded-lg border border-crm-border bg-crm-panel-muted px-3 py-2.5 text-sm text-crm-text">
                  {recipientsLoading ? (
                    <span className="inline-flex items-center gap-2 text-crm-text-muted">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Loading recipients…
                    </span>
                  ) : recipients.length === 0 ? (
                    <span className="text-crm-text-muted">
                      No recipients selected
                    </span>
                  ) : (
                    <ul className="space-y-1">
                      {recipients.map((recipient) => (
                        <li key={recipient.id}>
                          {recipient.name} — {recipient.phone}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {skippedNotes.length > 0 ? (
                  <p className="mt-2 text-xs text-crm-text-muted">
                    Skipped: {skippedNotes.join(" · ")}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor={messageId}
                  className="mb-1.5 block text-sm font-medium text-crm-text"
                >
                  Message
                </label>
                <textarea
                  id={messageId}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                  disabled={submitting || recipientsLoading}
                  className="w-full resize-none rounded-lg border border-crm-border bg-crm-panel px-3 py-2.5 text-sm text-crm-text outline-none placeholder:text-crm-text-muted focus:border-blue-500 disabled:opacity-60"
                />
              </div>

              {error ? (
                <p
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <Button
                type="button"
                className="h-10 w-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
                onClick={handleSend}
                disabled={
                  submitting ||
                  recipientsLoading ||
                  recipients.length === 0 ||
                  selectedRecordIds.length === 0
                }
              >
                Send SMS
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
