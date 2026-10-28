import type {
  PropertyCommercialStatus,
  SaleOfferVersionStatus,
} from "@/features/sales-poc/domain/types";

export function getPropertyBadgeVariant(
  status: PropertyCommercialStatus,
): "success" | "warning" | "info" | "primary" {
  switch (status) {
    case "DISPONIVEL":
      return "success";
    case "RESERVADO":
      return "warning";
    case "SOB_CONTRATO":
      return "info";
    case "VENDIDO":
      return "primary";
  }
}

export function getOfferStatusBadgeVariant(
  status: SaleOfferVersionStatus,
): "info" | "success" | "error" | "warning" {
  switch (status) {
    case "ENVIADA":
      return "info";
    case "ACEITA":
      return "success";
    case "REJEITADA":
      return "error";
    case "EXPIRADA":
      return "warning";
  }
}

export const INPUT_CLASS =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

