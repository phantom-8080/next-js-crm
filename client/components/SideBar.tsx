"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const systemFilters = [
  "Touched Records",
  "Untouched Records",
  "Record Action",
  "Related Records Action",
  "Activities",
  "Cadences",
  "Locked",
  "Latest Email Status",
];

const fieldFilters = [
  "1st Service Completed Date",
  "1st Service Confirmed Scheduled Date",
];

function FilterGroup({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: string[];
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="px-3 py-2">
      <button
        type="button"
        className="group flex w-full items-center justify-between rounded-lg px-2 py-2 transition hover:bg-zinc-800"
      >
        <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </span>
        <ChevronDown className="h-4 w-4 text-zinc-500 transition group-hover:text-zinc-300" />
      </button>

      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <label
            key={item}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-zinc-800/70"
          >
            <input
              type="checkbox"
              checked={!!selected[item]}
              onChange={() => onToggle(item)}
              className="h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 accent-blue-500"
            />
            <span className="min-w-0 text-sm text-zinc-300">{item}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

type SideBarProps = {
  open: boolean;
  onClose: () => void;
};

export default function SideBar({ open, onClose }: SideBarProps) {
  const allFilterIds = useMemo(
    () => [...systemFilters, ...fieldFilters],
    [],
  );

  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const hasFilters = allFilterIds.some((id) => selected[id]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function toggleFilter(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function clearFilters() {
    setSelected({});
  }

  function applyFilters() {
    const active = allFilterIds.filter((id) => selected[id]);
    console.log("Apply filters:", active);
  }

  return (
    <>
      <div
        role="presentation"
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-[90] bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        id="contracts-filters"
        aria-label="Contract filters"
        className={cn(
          "flex min-h-0 w-[min(100vw-1rem,300px)] shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#1e1e24]",
          "max-md:fixed max-md:top-2 max-md:bottom-2 max-md:left-2 max-md:z-[100] max-md:shadow-2xl max-md:transition-transform max-md:duration-300 max-md:ease-out",
          open ?
            "max-md:translate-x-0"
          : "max-md:pointer-events-none max-md:-translate-x-[calc(100%+1rem)]",
          "md:relative md:h-full md:w-[280px] md:translate-x-0 md:pointer-events-auto lg:w-[300px]",
        )}
      >
        <div className="shrink-0 border-b border-zinc-800 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-lg bg-blue-500/15 p-2">
                <Filter className="h-5 w-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white">Filters</h2>
                <p className="text-xs text-zinc-500">Filter Contracts</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
              aria-label="Close filters"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-zinc-800 p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search filters..."
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 pl-10 pr-3 text-sm text-zinc-200 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div
          className={[
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain",
            "[scrollbar-width:thin] [scrollbar-color:rgb(82_82_91)_transparent]",
            "[&::-webkit-scrollbar]:w-2",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-zinc-600",
            "[&::-webkit-scrollbar-thumb:hover]:bg-zinc-500",
          ].join(" ")}
        >
          <div className="px-1 pb-4">
            <FilterGroup
              title="System Defined Filters"
              items={systemFilters}
              selected={selected}
              onToggle={toggleFilter}
            />
            <div className="mx-4 border-t border-zinc-800" />
            <FilterGroup
              title="Filter By Fields"
              items={fieldFilters}
              selected={selected}
              onToggle={toggleFilter}
            />
          </div>
        </div>

        {hasFilters && (
          <div className="shrink-0 space-y-2 border-t border-zinc-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={applyFilters}
              className="h-9 w-full rounded-lg bg-gradient-to-b from-blue-500 to-blue-700 text-sm font-medium text-white transition hover:brightness-110"
            >
              Apply Filter
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="h-8 w-full rounded-lg border border-zinc-600 bg-zinc-700/80 text-sm text-zinc-100 transition hover:bg-zinc-600"
            >
              Clear
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
