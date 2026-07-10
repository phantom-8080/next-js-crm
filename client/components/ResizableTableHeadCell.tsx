"use client";

import type { CSSProperties, ReactNode } from "react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ResizableTableHeadCellProps = {
  className?: string;
  style?: CSSProperties;
  label: ReactNode;
  showDivider?: boolean;
  onResizeStart: (clientX: number) => void;
};

export function ResizableTableHeadCell({
  className,
  style,
  label,
  showDivider = true,
  onResizeStart,
}: ResizableTableHeadCellProps) {
  return (
    <TableHead
      className={cn("relative h-11 max-h-11 align-middle select-none", className)}
      style={style}
    >
      <span className="flex h-full min-w-0 items-center truncate pr-2">{label}</span>
      {showDivider ?
        <>
          <span aria-hidden className="crm-col-header-divider" />
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize column"
            title="Drag to resize column"
            className="crm-col-resize-handle absolute -right-1 top-0 z-10 h-full w-3 cursor-col-resize touch-none select-none outline-none"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            const target = e.currentTarget as HTMLElement;
            target.setPointerCapture(e.pointerId);
            onResizeStart(e.clientX);
          }}
          onPointerUp={(e) => {
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
              // already released
            }
          }}
          />
        </>
      : null}
    </TableHead>
  );
}
