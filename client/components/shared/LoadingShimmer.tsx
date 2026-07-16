import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ShimmerBar({
  className,
  delayMs = 0,
}: {
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-zinc-200/90 dark:bg-zinc-800/90",
        className,
      )}
      aria-hidden
    >
      <div
        className="table-shimmer-sweep absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-zinc-500/30 to-transparent"
        style={{ animationDelay: `${delayMs}ms` }}
      />
    </div>
  );
}

export function LoadingSpinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} role="status">
      <Loader2 className="size-4 shrink-0 animate-spin text-zinc-400" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function InlineLoadingShimmer({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} role="status" aria-live="polite">
      <LoadingSpinner />
      <ShimmerBar className="h-4 w-28 sm:w-36" />
    </span>
  );
}

export function PaginationLoadingShimmer({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex w-full justify-center sm:w-auto sm:justify-start", className)}
      role="status"
      aria-live="polite"
    >
      <ShimmerBar className="h-4 w-32" />
    </span>
  );
}

export function ColumnSettingsFieldsSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <ul className="space-y-0.5 px-1" aria-busy="true" aria-label="Loading fields">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-lg px-3 py-2.5"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <ShimmerBar className="mt-0.5 size-4 shrink-0 rounded" delayMs={i * 40} />
          <div className="min-w-0 flex-1 space-y-2">
            <ShimmerBar className="h-4 w-[70%] max-w-[200px]" delayMs={i * 40 + 20} />
            <ShimmerBar className="h-3 w-[55%] max-w-[160px]" delayMs={i * 40 + 40} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FilterSidebarFieldsSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <ul className="space-y-0.5 px-1 py-1" aria-busy="true" aria-label="Loading filters">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-2.5">
          <ShimmerBar className="h-4 min-w-0 flex-1" delayMs={i * 35} />
          <ShimmerBar className="size-4 shrink-0 rounded" delayMs={i * 35 + 15} />
        </li>
      ))}
    </ul>
  );
}
