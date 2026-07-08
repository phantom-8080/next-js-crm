import { cn } from "@/lib/utils";
import { ShimmerBar } from "@/components/LoadingShimmer";

function FieldSkeleton({ index }: { index: number }) {
  const delay = index * 45;
  return (
    <div
      className="flex min-h-0 min-w-0 flex-col justify-center border-b border-crm-border py-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <ShimmerBar className="h-3 w-[72%] max-w-[140px]" delayMs={delay} />
      <ShimmerBar className="mt-2.5 h-5 w-full max-w-full" delayMs={delay + 60} />
    </div>
  );
}

export function ContractRecordHeaderSkeleton() {
  return (
    <div className="min-w-0 flex-1 space-y-2" aria-hidden>
      <ShimmerBar className="h-6 w-full max-w-[280px]" />
      <ShimmerBar className="h-3 w-24" />
    </div>
  );
}

export function ContractRecordLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-6", className)}
      aria-busy="true"
      aria-label="Loading contract details"
    >
      {[0, 1, 2].map((section) => (
        <div key={section} className="contracts-record-loader min-w-0">
          <ShimmerBar className="mb-4 h-5 w-40" delayMs={section * 80} />
          <div
            className={cn(
              "grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3",
              "auto-rows-[minmax(3.75rem,1fr)]",
            )}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <FieldSkeleton key={i} index={section * 9 + i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
