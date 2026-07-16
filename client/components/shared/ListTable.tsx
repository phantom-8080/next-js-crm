"use client";

import type { CSSProperties, ReactNode } from "react";
import { Table, TableHeader } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ListTableColumn = { apiName: string };

type ListTableProps = {
  tableWidthStyle: CSSProperties;
  columns: ListTableColumn[];
  columnSizeStyle: (col: ListTableColumn) => CSSProperties;
  headerRow: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ListTable({
  tableWidthStyle,
  columns,
  columnSizeStyle,
  headerRow,
  children,
  className,
}: ListTableProps) {
  return (
    <div className={cn("contracts-table-scroll min-h-0 flex-1", className)}>
      <Table className="table-fixed border-collapse" style={tableWidthStyle}>
        <colgroup>
          {columns.map((col) => (
            <col key={col.apiName} style={columnSizeStyle(col)} />
          ))}
        </colgroup>
        <TableHeader className="[&_tr]:border-0">{headerRow}</TableHeader>
        {children}
      </Table>
    </div>
  );
}
