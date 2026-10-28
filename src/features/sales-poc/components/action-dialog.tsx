"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  confirmTestId: string;
  destructive?: boolean;
  /** Mensagem de erro de validação exibida dentro do diálogo. */
  error?: string | null;
  errorTestId?: string;
  onConfirm: () => void;
  children?: React.ReactNode;
}

/**
 * Diálogo controlado para ações que exigem motivo/justificativa.
 * O botão de confirmação não fecha o diálogo automaticamente: o chamador
 * fecha apenas quando a ação de domínio for aceita, mantendo o erro visível.
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmTestId,
  destructive = false,
  error,
  errorTestId,
  onConfirm,
  children,
}: ActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm();
          }}
          noValidate
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {children && <div className="grid gap-3">{children}</div>}

          {error && (
            <div
              role="alert"
              data-testid={errorTestId}
              className="flex items-start gap-2 rounded-lg border border-[var(--color-error-200)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-fg)]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Voltar</AlertDialogCancel>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              data-testid={confirmTestId}
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

