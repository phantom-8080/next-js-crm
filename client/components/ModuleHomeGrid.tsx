"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Database,
  FileSignature,
  FileText,
  Gavel,
  Receipt,
  Search,
  type LucideIcon,
} from "lucide-react";
import { ShimmerBar } from "@/components/LoadingShimmer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

type ModuleCard = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Fetched from `/api/contracts` when true */
  useLiveRecordCount?: boolean;
  /** Placeholder total until module APIs exist */
  recordCount?: number;
};

const MODULES: ModuleCard[] = [
  {
    title: "Contracts",
    description: "Browse and manage contract records.",
    href: "/contracts",
    icon: FileText,
    useLiveRecordCount: true,
  },
  {
    title: "Service completions",
    description: "Track and manage service work.",
    href: "/service-completions",
    icon: ClipboardCheck,
    recordCount: 6,
  },
  {
    title: "SOW",
    description: "Statements of work and scopes.",
    href: "/sow",
    icon: FileSignature,
    recordCount: 1,
  },
  {
    title: "Bids",
    description: "Review and manage bids.",
    href: "/bids",
    icon: Gavel,
    recordCount: 3,
  },
  {
    title: "Vendor Invoice",
    description: "Vendor billing and invoices.",
    href: "/vendor-invoice",
    icon: Receipt,
    recordCount: 3,
  },
  {
    title: "All vendors",
    description: "Directory of all vendors.",
    href: "/all-vendors",
    icon: Building2,
    recordCount: 256,
  },
];

function ModuleCardSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      className="flex flex-col rounded-2xl border border-zinc-200/80 bg-crm-panel p-6 shadow-sm dark:border-zinc-700/80"
      aria-hidden
    >
      <ShimmerBar className="mb-6 size-10 rounded-xl" delayMs={delayMs} />
      <ShimmerBar className="mb-2 h-5 w-32" delayMs={delayMs + 40} />
      <ShimmerBar className="h-4 w-full max-w-[240px]" delayMs={delayMs + 60} />
    </div>
  );
}

function ModuleCard({
  module,
  recordCount,
  recordCountLoading,
}: {
  module: ModuleCard;
  recordCount: number | null;
  recordCountLoading: boolean;
}) {
  const Icon = module.icon;
  const showCount = module.useLiveRecordCount || module.recordCount != null;

  return (
    <Link
      href={module.href}
      className={cn(
        "group relative flex min-h-[200px] flex-col rounded-2xl border border-zinc-200/90 bg-crm-panel p-6 shadow-sm",
        "transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-blue-400/70 hover:shadow-lg hover:shadow-blue-500/10",
        "dark:border-zinc-700/90 dark:hover:border-blue-500/50 dark:hover:shadow-blue-500/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-crm-canvas",
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="table-shimmer-sweep absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent dark:via-blue-300/10" />
      </div>

      <div className="relative mb-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
      </div>

      <div className="relative min-w-0 flex-1">
        <h2 className="text-base font-semibold tracking-tight text-crm-text sm:text-[1.05rem]">
          {module.title}
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-crm-text-muted">{module.description}</p>
      </div>

      <div className="relative mt-6 flex h-6 items-center justify-between gap-3">
        {showCount ?
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-crm-text-muted">
            <Database className="size-3.5 shrink-0 opacity-70" aria-hidden />
            {recordCountLoading ?
              <ShimmerBar className="h-3.5 w-20" />
            : recordCount != null ?
              <span>
                <span className="font-semibold tabular-nums text-crm-text">
                  {recordCount.toLocaleString("en-US")}
                </span>{" "}
                Records
              </span>
            : <span className="text-crm-text-muted">—</span>}
          </span>
        : <span aria-hidden />}
        <ArrowRight
          className={cn(
            "size-5 text-blue-600 opacity-0 transition-all duration-300",
            "translate-x-[-4px] group-hover:translate-x-0 group-hover:opacity-100",
            "group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
            "dark:text-blue-400",
          )}
          aria-hidden
        />
      </div>
    </Link>
  );
}

export default function ModuleHomeGrid() {
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [contractCount, setContractCount] = useState<number | null>(null);
  const [contractCountLoading, setContractCountLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 420);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadContractCount() {
      setContractCountLoading(true);
      try {
        const res = await fetch("/api/contracts?page=1");
        const data = (await res.json()) as { totalCount?: number; error?: string };
        if (!cancelled && res.ok && typeof data.totalCount === "number") {
          setContractCount(data.totalCount);
        }
      } catch {
        if (!cancelled) setContractCount(null);
      } finally {
        if (!cancelled) setContractCountLoading(false);
      }
    }

    void loadContractCount();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MODULES;
    return MODULES.filter(
      (m) =>
        m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-8">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-crm-text sm:text-[1.65rem]">
            CRM Workspace
          </h1>
          <p className="mt-1 text-sm text-crm-text-muted sm:text-[0.95rem]">
            Choose a module to open and manage your business data.
          </p>
        </div>
        <ThemeToggle showLabel className="shrink-0 self-start sm:mt-0.5" />
      </header>

      <div className="relative mb-8 sm:mb-10">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-[1.15rem] -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search modules..."
          className={cn(
            "h-12 w-full rounded-2xl border border-zinc-200/90 bg-crm-panel pr-20 pl-11 text-sm text-crm-text shadow-sm",
            "placeholder:text-zinc-400 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/15 focus:outline-none",
            "dark:border-zinc-700/90 dark:focus:border-blue-500/40",
          )}
          aria-label="Search modules"
        />
        <kbd
          className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-500 sm:inline-flex dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400"
          aria-hidden
        >
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
        aria-busy={!ready}
        aria-live="polite"
      >
        {!ready ?
          MODULES.map((_, i) => <ModuleCardSkeleton key={i} delayMs={i * 45} />)
        : filteredModules.length > 0 ?
          filteredModules.map((module, i) => (
            <div
              key={module.href}
              className="relative animate-[contracts-loader-fade-in_0.45s_ease-out_both]"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <ModuleCard
                module={module}
                recordCount={
                  module.useLiveRecordCount ? contractCount : (module.recordCount ?? null)
                }
                recordCountLoading={Boolean(module.useLiveRecordCount && contractCountLoading)}
              />
            </div>
          ))
        : <p className="col-span-full py-8 text-center text-sm text-crm-text-muted">
            No modules match your search.
          </p>
        }
      </div>
    </div>
  );
}
