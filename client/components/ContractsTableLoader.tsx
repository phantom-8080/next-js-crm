import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ROW_COUNT = 8;

const td = "px-3 py-4";
const tdFirst = "pl-6 pr-3 py-4";

function ShimmerBar({
  className,
  delayMs = 0,
}: {
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      className={cn(
        "relative h-3.5 overflow-hidden rounded-md bg-zinc-800/90",
        className,
      )}
      aria-hidden
    >
      <div
        className="table-shimmer-sweep absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-zinc-500/25 to-transparent"
        style={{ animationDelay: `${delayMs}ms` }}
      />
    </div>
  );
}

function SkeletonRow({ index, columnCount }: { index: number; columnCount: number }) {
  const rowDelay = index * 80;
  const cols = Math.max(1, Math.min(columnCount, 8));

  return (
    <TableRow
      className="border-zinc-800 hover:bg-transparent"
      style={{ animationDelay: `${rowDelay}ms` }}
    >
      {Array.from({ length: cols }, (_, colIndex) => (
        <TableCell key={colIndex} className={colIndex === 0 ? tdFirst : td}>
          <ShimmerBar
            className={cn(
              colIndex === 0 && "h-6 w-[72px] rounded-full",
              colIndex === 1 && "w-[85%] max-w-[180px]",
              colIndex > 1 && "w-24",
            )}
            delayMs={rowDelay + colIndex * 40}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function ContractsTableLoader({ columnCount = 6 }: { columnCount?: number }) {
  return (
    <TableBody
      className="contracts-table-loader"
      aria-busy="true"
      aria-label="Loading contracts"
    >
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <SkeletonRow key={i} index={i} columnCount={columnCount} />
      ))}
    </TableBody>
  );
}

function CardSkeleton({ index }: { index: number }) {
  const rowDelay = index * 80;
  return (
    <div
      className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3"
      style={{ animationDelay: `${rowDelay}ms` }}
    >
      <ShimmerBar className="h-6 w-20 rounded-full" delayMs={rowDelay} />
      <ShimmerBar className="w-full" delayMs={rowDelay + 40} />
      <div className="grid grid-cols-2 gap-2">
        <ShimmerBar delayMs={rowDelay + 80} />
        <ShimmerBar delayMs={rowDelay + 120} />
      </div>
      <ShimmerBar className="w-2/3" delayMs={rowDelay + 160} />
    </div>
  );
}

export function ContractsCardsLoader() {
  return (
    <div
      className="contracts-table-loader space-y-3 p-3 md:hidden"
      aria-busy="true"
      aria-label="Loading contracts"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <CardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}
