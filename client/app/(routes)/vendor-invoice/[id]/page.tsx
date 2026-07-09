import VendorInvoiceRecordView from "@/components/VendorInvoiceRecordView";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VendorInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-crm-canvas p-2 sm:p-3">
      <VendorInvoiceRecordView id={id} />
    </div>
  );
}
