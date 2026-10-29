"use client";

import * as React from "react";
import { ArrowLeftRight, Lock, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  INPUT_CLASS,
  useModalDismiss,
} from "@/features/sales-poc/components/ui-helpers";
import { submitOfferVersion } from "@/features/sales-poc/domain/state-machine";
import type {
  PaymentModality,
  Property,
  SaleOffer,
  SaleOfferAuthorRole,
  SaleOpportunity,
} from "@/features/sales-poc/domain/types";
import { useSalesPocStore } from "@/features/sales-poc/store/sales-poc-store";
import {
  formatCurrencyBRL,
  formatShortDate,
  OFFER_AUTHOR_LABELS,
  OFFER_VERSION_STATUS_LABELS,
  PAYMENT_MODALITY_LABELS,
} from "@/features/sales-poc/utils/formatters";

export interface OfferComposerModalProps {
  open: boolean;
  initialTab?: "compose" | "compare";
  defaultAuthorRole?: SaleOfferAuthorRole;
  opportunity: SaleOpportunity;
  property: Property;
  offer?: SaleOffer;
  onClose: () => void;
}

export function OfferComposerModal({
  open,
  initialTab = "compose",
  defaultAuthorRole = "COMPRADOR",
  opportunity,
  property,
  offer,
  onClose,
}: OfferComposerModalProps) {
  const { dispatchDomainAction } = useSalesPocStore();

  const versions = React.useMemo(() => offer?.versions ?? [], [offer]);
  const latestVersion = versions[versions.length - 1];

  const [activeTab, setActiveTab] = React.useState<string>(initialTab);
  const [authorRole, setAuthorRole] =
    React.useState<SaleOfferAuthorRole>(defaultAuthorRole);
  const [paymentModality, setPaymentModality] = React.useState<PaymentModality>(
    latestVersion?.paymentModality ??
      (property.acceptsFinancing
        ? property.preferredPaymentModality
        : "A_VISTA"),
  );
  const [amount, setAmount] = React.useState<number>(
    latestVersion ? latestVersion.amount : property.askingPrice,
  );
  const [downPaymentAmount, setDownPaymentAmount] = React.useState<number>(
    latestVersion
      ? latestVersion.downPaymentAmount
      : Math.round(property.askingPrice * 0.3),
  );
  const [validUntil, setValidUntil] = React.useState<string>("2026-11-30");
  const [conditions, setConditions] = React.useState<string>(
    "Pagamento condicionado à aprovação na diligência documental das partes e do imóvel.",
  );
  const [commissionOverride, setCommissionOverride] = React.useState<string>("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [leftVersionId, setLeftVersionId] = React.useState<string>(
    versions.length >= 2
      ? versions[versions.length - 2].id
      : (versions[0]?.id ?? ""),
  );
  const [rightVersionId, setRightVersionId] = React.useState<string>(
    versions[versions.length - 1]?.id ?? "",
  );
  const [onlyDifferences, setOnlyDifferences] = React.useState(false);

  const dialogRef = useModalDismiss(open, onClose);

  if (!open) return null;

  const computedFinancing =
    paymentModality === "A_VISTA"
      ? 0
      : Math.max(0, amount - downPaymentAmount);

  const defaultCommission = Math.round(
    (amount * property.saleAuthorization.expectedCommissionPercent) / 100,
  );
  const expectedCommissionAmount =
    commissionOverride.trim() !== ""
      ? Number(commissionOverride)
      : defaultCommission;

  const canSubmitNewVersion =
    opportunity.status === "ATENDIMENTO" ||
    opportunity.status === "EM_PROPOSTA";

  const leftVersion =
    versions.find((v) => v.id === leftVersionId) ?? versions[0];
  const rightVersion =
    versions.find((v) => v.id === rightVersionId) ??
    versions[versions.length - 1];

  const hasComparableVersions = versions.length >= 2;
  const effectiveTab = hasComparableVersions ? activeTab : "compose";

  const modalTitle =
    effectiveTab === "compare"
      ? "Comparar versões"
      : `${authorRole === "VENDEDOR" ? "Contraproposta" : "Proposta"} · v${versions.length + 1}`;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    const result = dispatchDomainAction((state) =>
      submitOfferVersion(state, {
        opportunityId: opportunity.id,
        authorRole,
        amount,
        downPaymentAmount:
          paymentModality === "A_VISTA" ? amount : downPaymentAmount,
        financingAmount: computedFinancing,
        paymentModality,
        validUntil,
        conditions,
        expectedCommissionAmount,
      }),
    );

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    onClose();
  }

  const comparisonRows =
    leftVersion && rightVersion
      ? [
          {
            key: "origin",
            label: "Origem",
            left: OFFER_AUTHOR_LABELS[leftVersion.authorRole],
            right: OFFER_AUTHOR_LABELS[rightVersion.authorRole],
            changed: leftVersion.authorRole !== rightVersion.authorRole,
          },
          {
            key: "status",
            label: "Status",
            left: OFFER_VERSION_STATUS_LABELS[leftVersion.status],
            right: OFFER_VERSION_STATUS_LABELS[rightVersion.status],
            changed: leftVersion.status !== rightVersion.status,
          },
          {
            key: "amount",
            label: "Valor total",
            left: formatCurrencyBRL(leftVersion.amount),
            right: formatCurrencyBRL(rightVersion.amount),
            changed: leftVersion.amount !== rightVersion.amount,
            emphasized: true,
          },
          {
            key: "modality",
            label: "Modalidade",
            left: PAYMENT_MODALITY_LABELS[leftVersion.paymentModality],
            right: PAYMENT_MODALITY_LABELS[rightVersion.paymentModality],
            changed:
              leftVersion.paymentModality !== rightVersion.paymentModality,
          },
          {
            key: "downPayment",
            label: "Recursos próprios",
            left: formatCurrencyBRL(leftVersion.downPaymentAmount),
            right: formatCurrencyBRL(rightVersion.downPaymentAmount),
            changed:
              leftVersion.downPaymentAmount !== rightVersion.downPaymentAmount,
          },
          {
            key: "financing",
            label: "Financiamento",
            left: formatCurrencyBRL(leftVersion.financingAmount),
            right: formatCurrencyBRL(rightVersion.financingAmount),
            changed:
              leftVersion.financingAmount !== rightVersion.financingAmount,
          },
          {
            key: "validUntil",
            label: "Validade",
            left: formatShortDate(leftVersion.validUntil),
            right: formatShortDate(rightVersion.validUntil),
            changed: leftVersion.validUntil !== rightVersion.validUntil,
          },
          {
            key: "commission",
            label: "Comissão prevista",
            left: formatCurrencyBRL(leftVersion.expectedCommissionAmount),
            right: formatCurrencyBRL(rightVersion.expectedCommissionAmount),
            changed:
              leftVersion.expectedCommissionAmount !==
              rightVersion.expectedCommissionAmount,
          },
          {
            key: "conditions",
            label: "Condições",
            left: leftVersion.conditions,
            right: rightVersion.conditions,
            changed: leftVersion.conditions !== rightVersion.conditions,
            multiline: true,
          },
        ]
      : [];

  const visibleComparisonRows = onlyDifferences
    ? comparisonRows.filter((row) => row.changed)
    : comparisonRows;

  const composeSection = !canSubmitNewVersion ? (
    <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
      Esta oportunidade não recebe novas versões de proposta.
    </div>
  ) : (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {errorMessage && (
        <div
          role="alert"
          data-testid="offer-form-error"
          className="rounded-lg border border-[var(--color-error-200)] bg-[var(--error-subtle)] p-3 text-sm font-medium text-[var(--error-fg)]"
        >
          {errorMessage}
        </div>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium">
          <span>Autor da versão</span>
          <select
            value={authorRole}
            onChange={(e) =>
              setAuthorRole(e.target.value as SaleOfferAuthorRole)
            }
            data-testid="offer-author-select"
            className={INPUT_CLASS}
          >
            <option value="COMPRADOR">
              Proposta do comprador (v{versions.length + 1})
            </option>
            <option value="VENDEDOR" disabled={versions.length === 0}>
              Contraproposta do vendedor (v{versions.length + 1})
            </option>
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium">
          <span>Forma de pagamento</span>
          <select
            value={paymentModality}
            onChange={(e) =>
              setPaymentModality(e.target.value as PaymentModality)
            }
            data-testid="offer-modality-select"
            className={INPUT_CLASS}
          >
            <option value="A_VISTA">À vista</option>
            <option value="FINANCIADO" disabled={!property.acceptsFinancing}>
              Financiado{" "}
              {!property.acceptsFinancing ? "(indisponível neste imóvel)" : ""}
            </option>
          </select>
        </label>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-medium">
          <span className="flex items-baseline justify-between gap-2">
            <span>Valor total proposto</span>
            <span className="font-normal tabular-nums text-muted-foreground">
              {formatCurrencyBRL(amount)}
            </span>
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            data-testid="offer-amount-input"
            className={cn(INPUT_CLASS, "tabular-nums")}
          />
        </label>

        <label className="space-y-1 text-xs font-medium">
          <span className="flex items-baseline justify-between gap-2">
            <span>Recursos próprios</span>
            <span className="font-normal tabular-nums text-muted-foreground">
              {formatCurrencyBRL(
                paymentModality === "A_VISTA" ? amount : downPaymentAmount,
              )}
            </span>
          </span>
          <input
            type="number"
            min={0}
            step={1}
            disabled={paymentModality === "A_VISTA"}
            value={paymentModality === "A_VISTA" ? amount : downPaymentAmount}
            onChange={(e) => setDownPaymentAmount(Number(e.target.value))}
            data-testid="offer-downpayment-input"
            className={cn(INPUT_CLASS, "tabular-nums disabled:opacity-60")}
          />
        </label>

        <div className="space-y-1 text-xs font-medium">
          <span>Saldo de financiamento</span>
          <div
            data-testid="offer-financing-readonly"
            className="flex h-9 items-center rounded-md border border-border bg-secondary/45 px-3 text-sm font-semibold tabular-nums"
          >
            {formatCurrencyBRL(computedFinancing)}
          </div>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium">
          <span className="flex items-baseline justify-between gap-2">
            <span>Validade</span>
            {validUntil && (
              <span className="font-normal tabular-nums text-muted-foreground">
                {formatShortDate(validUntil)}
              </span>
            )}
          </span>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            data-testid="offer-valid-until-input"
            className={INPUT_CLASS}
          />
        </label>

        <label className="space-y-1 text-xs font-medium">
          <span className="flex items-baseline justify-between gap-2">
            <span>
              Comissão prevista ({property.saleAuthorization.expectedCommissionPercent}%)
            </span>
            <span className="font-normal tabular-nums text-muted-foreground">
              {formatCurrencyBRL(expectedCommissionAmount)}
            </span>
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={
              commissionOverride !== ""
                ? commissionOverride
                : String(defaultCommission)
            }
            onChange={(e) => setCommissionOverride(e.target.value)}
            data-testid="offer-commission-input"
            className={cn(INPUT_CLASS, "tabular-nums")}
          />
        </label>
      </div>

      <label className="block space-y-1 text-xs font-medium">
        <span>Condições da negociação</span>
        <textarea
          rows={2}
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          data-testid="offer-conditions-input"
          className="w-full rounded-md border border-input bg-card p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <div className="flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          Versões enviadas são imutáveis; ajustes posteriores geram nova versão.
        </p>

        <div className="flex shrink-0 justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            className="whitespace-nowrap"
            data-testid="submit-offer-version-btn"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Enviar {authorRole === "VENDEDOR" ? "contraproposta" : "proposta"} v
            {versions.length + 1}
          </Button>
        </div>
      </div>
    </form>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-modal-title"
      data-testid="offer-composer-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl focus:outline-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="space-y-0.5">
            <h2
              id="offer-modal-title"
              className="text-lg font-bold tracking-tight"
            >
              {modalTitle}
            </h2>
            <p className="text-xs text-muted-foreground">
              {property.title} · Pedido{" "}
              {formatCurrencyBRL(property.askingPrice)}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar modal de propostas"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!hasComparableVersions ? (
            composeSection
          ) : (
            <Tabs
              value={effectiveTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList>
                <TabsTrigger value="compose" data-testid="offer-tab-compose">
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Nova versão v{versions.length + 1}
                </TabsTrigger>
                <TabsTrigger value="compare" data-testid="offer-tab-compare">
                  <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                  Comparar versões ({versions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compose" className="mt-4">
                {composeSection}
              </TabsContent>

              <TabsContent
                value="compare"
                data-testid="offer-comparison-view"
                className="mt-4"
              >
                {leftVersion && rightVersion && (
                  <div className="space-y-3.5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="grid flex-1 gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-xs font-medium">
                          <span>Versão A</span>
                          <select
                            value={leftVersion.id}
                            onChange={(e) => setLeftVersionId(e.target.value)}
                            data-testid="compare-left-select"
                            className={INPUT_CLASS}
                          >
                            {versions.map((v) => (
                              <option key={v.id} value={v.id}>
                                v{v.versionNumber} ·{" "}
                                {OFFER_AUTHOR_LABELS[v.authorRole]} (
                                {formatCurrencyBRL(v.amount)})
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-1 text-xs font-medium">
                          <span>Versão B</span>
                          <select
                            value={rightVersion.id}
                            onChange={(e) => setRightVersionId(e.target.value)}
                            data-testid="compare-right-select"
                            className={INPUT_CLASS}
                          >
                            {versions.map((v) => (
                              <option key={v.id} value={v.id}>
                                v{v.versionNumber} ·{" "}
                                {OFFER_AUTHOR_LABELS[v.authorRole]} (
                                {formatCurrencyBRL(v.amount)})
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="inline-flex cursor-pointer items-center gap-1.5 pb-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={onlyDifferences}
                          onChange={(e) => setOnlyDifferences(e.target.checked)}
                          data-testid="compare-only-diffs-toggle"
                          className="h-3.5 w-3.5 accent-[var(--color-primary-600)]"
                        />
                        Apenas diferenças
                      </label>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-border bg-secondary/45 text-xs font-semibold text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2.5">Campo</th>
                            <th className="px-4 py-2.5">
                              Versão v{leftVersion.versionNumber}
                            </th>
                            <th className="px-4 py-2.5">
                              Versão v{rightVersion.versionNumber}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/80">
                          {visibleComparisonRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-6 text-center text-xs text-muted-foreground"
                              >
                                Nenhuma diferença entre as versões selecionadas.
                              </td>
                            </tr>
                          ) : (
                            visibleComparisonRows.map((row) => (
                              <tr
                                key={row.key}
                                className={cn(
                                  row.changed
                                    ? "bg-[var(--accent-subtle)]/40"
                                    : "text-muted-foreground",
                                )}
                              >
                                <td className="px-4 py-2.5 text-xs font-medium text-foreground">
                                  {row.label}
                                </td>
                                <td
                                  className={cn(
                                    "px-4 py-2.5 tabular-nums",
                                    row.multiline && "text-xs",
                                    row.emphasized &&
                                      "font-semibold text-foreground",
                                  )}
                                >
                                  {row.left}
                                </td>
                                <td
                                  className={cn(
                                    "px-4 py-2.5 tabular-nums",
                                    row.multiline && "text-xs",
                                    row.changed &&
                                      !row.multiline &&
                                      !row.emphasized &&
                                      "font-medium text-foreground",
                                    row.emphasized &&
                                      "font-semibold text-foreground",
                                  )}
                                >
                                  {row.right}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
