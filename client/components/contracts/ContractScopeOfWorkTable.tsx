import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ContractScopeOfWorkRow } from "@/lib/contractScopeOfWork";

export function ContractScopeOfWorkTable({ rows }: { rows: ContractScopeOfWorkRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-crm-text-muted">No scope of work lines on this contract.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-crm-border bg-crm-panel">
      <Table>
        <TableHeader>
          <TableRow className="bg-crm-table-head hover:bg-crm-table-head">
            <TableHead className="min-w-[12rem] text-crm-text">Our services</TableHead>
            <TableHead className="text-right text-crm-text">Vendor price ($)</TableHead>
            <TableHead className="text-right text-crm-text">Client price ($)</TableHead>
            <TableHead className="text-crm-text">Start date</TableHead>
            <TableHead className="text-crm-text">End date</TableHead>
            <TableHead className="text-right text-crm-text">Number of services</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-crm-link">{row.serviceName}</TableCell>
              <TableCell className="text-right tabular-nums text-crm-text">
                {row.vendorPrice || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-crm-text">
                {row.clientPrice || "—"}
              </TableCell>
              <TableCell className="tabular-nums text-crm-text">{row.startDate || "—"}</TableCell>
              <TableCell className="tabular-nums text-crm-text">{row.endDate || "—"}</TableCell>
              <TableCell className="text-right tabular-nums text-crm-text">
                {row.numberOfServices || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
