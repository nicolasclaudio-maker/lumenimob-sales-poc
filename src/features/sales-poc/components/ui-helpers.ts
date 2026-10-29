import * as React from "react";
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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Gerencia fechamento por `Escape`, bloqueio de rolagem de fundo,
 * ciclo de foco (`Tab`) e restauração de foco em modais customizados.
 */
export function useModalDismiss(open: boolean, onClose: () => void) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const container = dialogRef.current;
    if (container && !container.contains(document.activeElement)) {
      const firstFocusable =
        container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? container).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return dialogRef;
}
