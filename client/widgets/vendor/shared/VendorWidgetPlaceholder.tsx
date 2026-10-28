"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WidgetOpenContext } from "@/widgets/types";

type VendorWidgetPlaceholderProps = WidgetOpenContext & {
  open: boolean;
  onClose: () => void;
  title: string;
  className?: string;
};

/**
 * Temporary stub modal for vendor list-action widgets (buttons only for now).
 */
export function VendorWidgetPlaceholder({
  open,
  onClose,
  title,
  selectedRecordIds,
  className,
}: VendorWidgetPlaceholderProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "w-full max-w-md rounded-xl border border-crm-border bg-crm-panel p-5 shadow-xl",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-crm-text">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-lg p-1.5 text-crm-text-muted transition hover:bg-zinc-100 hover:text-crm-text dark:hover:bg-zinc-800"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-sm text-crm-text-muted">
          Widget UI coming soon.
          {selectedRecordIds.length > 0 ?
            <>
              {" "}
              <span className="font-medium tabular-nums text-crm-text">
                {selectedRecordIds.length}
              </span>{" "}
              vendor{selectedRecordIds.length === 1 ? "" : "s"} selected.
            </>
          : null}
        </p>
        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="crm-toolbar-btn cursor-pointer"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
