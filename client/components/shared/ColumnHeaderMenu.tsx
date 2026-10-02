"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  Filter,
  Menu,
  Pin,
  PinOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ColumnHeaderMenuAction =
  | "asc"
  | "desc"
  | "pin"
  | "filter"
  | "hide";

type ColumnHeaderMenuProps = {
  columnLabel: string;
  pinned?: boolean;
  sortDirection?: "asc" | "desc" | null;
  canSort?: boolean;
  canHide?: boolean;
  canFilter?: boolean;
  onAction: (action: ColumnHeaderMenuAction) => void;
};

export function ColumnHeaderMenu({
  columnLabel,
  pinned = false,
  sortDirection = null,
  canSort = true,
  canHide = true,
  canFilter = true,
  onAction,
}: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | PointerEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (event.target instanceof Node && !el.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function run(action: ColumnHeaderMenuAction) {
    setOpen(false);
    onAction(action);
  }

  const items: {
    id: ColumnHeaderMenuAction;
    label: string;
    icon: ReactNode;
    disabled?: boolean;
    active?: boolean;
  }[] = [
    {
      id: "asc",
      label: "Asc",
      icon: <ArrowUp className="size-3.5 shrink-0" aria-hidden />,
      disabled: !canSort,
      active: sortDirection === "asc",
    },
    {
      id: "desc",
      label: "Desc",
      icon: <ArrowDown className="size-3.5 shrink-0" aria-hidden />,
      disabled: !canSort,
      active: sortDirection === "desc",
    },
    {
      id: "pin",
      label: pinned ? "Unpin Column" : "Pin Column",
      icon: pinned ?
        <PinOff className="size-3.5 shrink-0" aria-hidden />
      : <Pin className="size-3.5 shrink-0" aria-hidden />,
      active: pinned,
    },
    {
      id: "filter",
      label: "Filter by",
      icon: <Filter className="size-3.5 shrink-0" aria-hidden />,
      disabled: !canFilter,
    },
    {
      id: "hide",
      label: "Hide Column",
      icon: <EyeOff className="size-3.5 shrink-0" aria-hidden />,
      disabled: !canHide,
    },
  ];

  return (
    <div ref={rootRef} className="relative flex h-full min-w-0 flex-1 items-center gap-1 pr-1">
      <span className="min-w-0 flex-1 truncate" title={columnLabel}>
        {columnLabel}
      </span>
      {sortDirection === "asc" ?
        <ArrowUp className="size-3 shrink-0 text-blue-500" aria-hidden />
      : sortDirection === "desc" ?
        <ArrowDown className="size-3 shrink-0 text-blue-500" aria-hidden />
      : null}
      {pinned ?
        <Pin className="size-3 shrink-0 text-blue-500" aria-hidden />
      : null}
      <button
        type="button"
        className={cn(
          "crm-col-header-burger inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-crm-border/80 bg-zinc-100 text-crm-text-muted transition",
          "hover:border-zinc-300 hover:bg-zinc-200 hover:text-crm-text",
          "dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:hover:border-zinc-600",
          open && "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${columnLabel} column options`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Menu className="size-3" aria-hidden strokeWidth={2.25} />
      </button>

      {open ?
        <div
          role="menu"
          aria-label={`${columnLabel} column menu`}
          className="crm-col-header-menu absolute right-0 top-[calc(100%+0.35rem)] z-[60] min-w-[11.5rem] overflow-hidden rounded-lg border border-crm-border bg-crm-panel py-1 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm text-crm-text transition",
                "hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-40",
                item.active && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
              )}
              onClick={() => run(item.id)}
            >
              <span className="text-crm-text-muted">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      : null}
    </div>
  );
}
