import { SalesWorkspace } from "@/features/sales-poc/components/sales-workspace";
import { SalesPocProvider } from "@/features/sales-poc/store/sales-poc-store";

export default function SalesPage() {
  return (
    <SalesPocProvider>
      <SalesWorkspace />
    </SalesPocProvider>
  );
}

