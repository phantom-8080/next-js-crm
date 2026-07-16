import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ShimmerBar } from "@/components/LoadingShimmer";
import { isDateLikeField, isStatusField } from "@/lib/contractColumns";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

const ROW_COUNT = 8;

export type TableLoaderColumn = {
  apiName: string;
  label: string;
  dataType: string;
};

type ContractsTableLoaderProps = {
  columns: TableLoaderColumn[];
  getCellClassName: (col: TableLoaderColumn, index: number) => string;
  getCellStyle: (col: TableLoaderColumn) => CSSProperties;
};

function isLongTextColumn(apiName: string) {
  return (
    apiName === "Vendor" ||
    apiName === "Company_Name" ||
    apiName === "Name" ||
    apiName === "Site"
  );
}

function shimmerClassForColumn(col: TableLoaderColumn) {
  if (isStatusField(col.apiName)) {
    return "h-6 w-[72px] max-w-full rounded-full";
  }
  if (isLongTextColumn(col.apiName)) {
    return "h-4 w-[85%] max-w-full";
  }
  if (isDateLikeField(col.apiName, col.dataType)) {
    return "h-4 w-20 max-w-full";
  }
  return "h-4 w-24 max-w-full";
}

function SkeletonRow({
  index,
  columns,
  getCellClassName,
  getCellStyle,
}: {
  index: number;
  columns: TableLoaderColumn[];
  getCellClassName: ContractsTableLoaderProps["getCellClassName"];
  getCellStyle: ContractsTableLoaderProps["getCellStyle"];
}) {
  const rowDelay = index * 80;

  return (
    <TableRow
      className="border-crm-border hover:bg-transparent"
      style={{ animationDelay: `${rowDelay}ms` }}
    >
      {columns.map((col, colIndex) => (
        <TableCell
          key={col.apiName}
          className={getCellClassName(col, colIndex)}
          style={getCellStyle(col)}
        >
          <ShimmerBar
            className={cn(shimmerClassForColumn(col))}
            delayMs={rowDelay + colIndex * 40}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function ContractsTableLoader({
  columns,
  getCellClassName,
  getCellStyle,
}: ContractsTableLoaderProps) {
  const cols = columns.length > 0 ? columns : [{ apiName: "_", label: "", dataType: "text" }];

  return (
    <TableBody
      className="contracts-table-loader"
      aria-busy="true"
      aria-label="Loading contracts"
    >
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <SkeletonRow
          key={i}
          index={i}
          columns={cols}
          getCellClassName={getCellClassName}
          getCellStyle={getCellStyle}
        />
      ))}
    </TableBody>
  );
}

function CardSkeleton({ index }: { index: number }) {
  const rowDelay = index * 80;
  return (
    <div
      className="space-y-3 rounded-lg border border-crm-border bg-crm-panel p-3"
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
