"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INVITE_TO_VENDOR_PORTAL_BUTTON_LABEL,
  InviteToVendorPortalWidget,
  TELZIO_MASS_SMS_BUTTON_LABEL,
  TelzioMassSmsWidget,
  VENDOR_OLIO_MASS_UPDATE_BUTTON_LABEL,
  VendorOlioMassUpdateWidget,
} from "@/widgets/vendor";

const DELETE_BUTTON_LABEL = "Delete" as const;

/** Dropdown menu items — no Zoho “test” buttons. */
const VENDOR_MENU_ITEMS = [
  INVITE_TO_VENDOR_PORTAL_BUTTON_LABEL,
  VENDOR_OLIO_MASS_UPDATE_BUTTON_LABEL,
  TELZIO_MASS_SMS_BUTTON_LABEL,
] as const;

type VendorListSelectionActionsProps = {
  className?: string;
  selectedRecordIds?: string[];
  onAction?: (action: string) => void;
  /** Called after vendors are deleted successfully (or partially). */
  onDeleted?: (deletedIds: string[]) => void;
};

export function VendorListSelectionActions({
  className,
  selectedRecordIds = [],
  onAction,
  onDeleted,
}: VendorListSelectionActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [olioOpen, setOlioOpen] = useState(false);
  const [telzioOpen, setTelzioOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const confirmTitleId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return VENDOR_MENU_ITEMS;
    return VENDOR_MENU_ITEMS.filter((item) => item.toLowerCase().includes(q));
  }, [query]);

  const selectedCount = selectedRecordIds.length;

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      setQuery("");
      return;
    }
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [menuOpen]);

  useEffect(() => {
    if (!confirmDeleteOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) {
        setConfirmDeleteOpen(false);
        setDeleteError(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmDeleteOpen, deleting]);

  function openWidget(action: string) {
    setMenuOpen(false);

    if (action === INVITE_TO_VENDOR_PORTAL_BUTTON_LABEL) {
      setInviteOpen(true);
    } else if (action === VENDOR_OLIO_MASS_UPDATE_BUTTON_LABEL) {
      setOlioOpen(true);
    } else if (action === TELZIO_MASS_SMS_BUTTON_LABEL) {
      setTelzioOpen(true);
    }

    onAction?.(action);
  }

  function openDeleteConfirm() {
    setDeleteError(null);
    setConfirmDeleteOpen(true);
    onAction?.(DELETE_BUTTON_LABEL);
  }

  async function confirmDelete() {
    if (selectedRecordIds.length === 0 || deleting) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/vendors/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedRecordIds }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        deletedIds?: string[];
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "Failed to delete vendors.");
      }

      const deletedIds = Array.isArray(data.deletedIds) ? data.deletedIds : selectedRecordIds;
      setConfirmDeleteOpen(false);
      onDeleted?.(deletedIds);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete vendors.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
        role="toolbar"
        aria-label="Selected vendor actions"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="crm-toolbar-btn h-8 px-3 text-sm"
          onClick={openDeleteConfirm}
        >
          {DELETE_BUTTON_LABEL}
        </Button>

        <div ref={menuRef} className="relative">
          <div className="inline-flex overflow-hidden rounded-lg border border-crm-border bg-crm-panel">
            <button
              type="button"
              className="crm-toolbar-btn h-8 rounded-none border-0 px-3 text-sm font-medium text-crm-text hover:bg-crm-panel-muted"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => openWidget(INVITE_TO_VENDOR_PORTAL_BUTTON_LABEL)}
            >
              {INVITE_TO_VENDOR_PORTAL_BUTTON_LABEL}
            </button>
            <button
              type="button"
              className="crm-toolbar-btn flex h-8 w-8 items-center justify-center rounded-none border-0 border-l border-crm-border text-crm-text hover:bg-crm-panel-muted"
              aria-label="Open Invite to Vendor Portal menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <ChevronDown
                className={cn(
                  "size-4 text-crm-text-muted transition",
                  menuOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </div>

          {menuOpen ?
            <div
              className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-crm-border bg-crm-panel shadow-xl"
              role="menu"
              aria-label="Vendor button actions"
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
                      onClick={() => openWidget(item)}
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

      {confirmDeleteOpen ?
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => {
            if (deleting) return;
            setConfirmDeleteOpen(false);
            setDeleteError(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            className="w-full max-w-md rounded-lg border border-crm-border bg-crm-panel p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={confirmTitleId} className="text-base font-semibold text-crm-text">
              Delete vendor{selectedCount === 1 ? "" : "s"}?
            </h2>
            <p className="mt-2 text-sm text-crm-text">
              Are you sure you want to delete{" "}
              <span className="font-medium tabular-nums">{selectedCount}</span>{" "}
              selected vendor{selectedCount === 1 ? "" : "s"}? This cannot be undone.
            </p>
            {deleteError ?
              <p className="mt-3 text-sm text-red-500">{deleteError}</p>
            : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="crm-toolbar-btn cursor-pointer"
                disabled={deleting}
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer bg-red-600 text-white hover:bg-red-500 disabled:opacity-60"
                disabled={deleting || selectedCount === 0}
                onClick={() => {
                  void confirmDelete();
                }}
              >
                {deleting ?
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                    Deleting…
                  </>
                : "OK"}
              </Button>
            </div>
          </div>
        </div>
      : null}

      <InviteToVendorPortalWidget
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        selectedRecordIds={selectedRecordIds}
        module="Vendors"
      />
      <VendorOlioMassUpdateWidget
        open={olioOpen}
        onClose={() => setOlioOpen(false)}
        selectedRecordIds={selectedRecordIds}
        module="Vendors"
      />
      <TelzioMassSmsWidget
        open={telzioOpen}
        onClose={() => setTelzioOpen(false)}
        selectedRecordIds={selectedRecordIds}
        module="Vendors"
      />
    </>
  );
}
