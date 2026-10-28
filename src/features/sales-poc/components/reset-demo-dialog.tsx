"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface ResetDemoDialogProps {
  onConfirmReset: () => void;
}

export function ResetDemoDialog({ onConfirmReset }: ResetDemoDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          data-testid="reset-demo-button"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Restaurar ambiente
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="reset-demo-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Restaurar dados iniciais do ambiente?
          </AlertDialogTitle>
          <AlertDialogDescription>
            As movimentações realizadas nesta sessão serão descartadas para
            restaurar a carteira inicial de imóveis, oportunidades e dossiês de
            venda.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            data-testid="confirm-reset-demo-button"
            onClick={onConfirmReset}
          >
            Restaurar ambiente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
