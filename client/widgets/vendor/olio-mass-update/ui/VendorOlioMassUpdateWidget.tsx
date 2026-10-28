"use client";

import { OlioMassUpdateWidget } from "@/widgets/olio-mass-update";
import type { WidgetOpenContext } from "@/widgets/types";

type VendorOlioMassUpdateWidgetProps = WidgetOpenContext & {
  open: boolean;
  onClose: () => void;
  className?: string;
};

/** Vendors list “Olio Mass Update” — shared mass-update UI with module=Vendors. */
export function VendorOlioMassUpdateWidget({
  open,
  onClose,
  selectedRecordIds,
  module = "Vendors",
  className,
}: VendorOlioMassUpdateWidgetProps) {
  return (
    <OlioMassUpdateWidget
      open={open}
      onClose={onClose}
      selectedRecordIds={selectedRecordIds}
      module={module}
      className={className}
    />
  );
}
