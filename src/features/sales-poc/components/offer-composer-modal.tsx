"use client";

import * as React from "react";
import { ArrowLeftRight, Lock, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-modal-title"
      data-testid="offer-composer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{opportunity.code}</Badge>
              <Badge variant="outline">
                {property.code} · Pedido{" "}
                {formatCurrencyBRL(property.askingPrice)}
              </Badge>
              <Badge variant="secondary">
                <Lock className="h-3 w-3" />
                Histórico versionado
              </Badge>
            </div>
            <h2 id="offer-modal-title" className="mt-2 text-xl font-bold">
              Propostas, contrapropostas e comparação de versões
            </h2>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar modal de propostas"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-4 w-full"
        >
          <TabsList>
            <TabsTrigger value="compose" data-testid="offer-tab-compose">
              <Send className="h-4 w-4" />
              Registrar versão v{versions.length + 1}
            </TabsTrigger>
            <TabsTrigger
              value="compare"
              disabled={versions.length < 2}
              data-testid="offer-tab-compare"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Comparar versões lado a lado ({versions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose">
            {!canSubmitNewVersion ? (
              <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                Esta oportunidade está em estado{" "}
                <strong>{opportunity.status}</strong> e não recebe novas versões
                de proposta.
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium">
                    <span>Tipo / Autor da versão</span>
                    <select
                      value={authorRole}
                      onChange={(e) =>
                        setAuthorRole(e.target.value as SaleOfferAuthorRole)
                      }
                      data-testid="offer-author-select"
                      className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    >
                      <option value="COMPRADOR">
                        Proposta do comprador (v{versions.length + 1})
                      </option>
                      <option
                        value="VENDEDOR"
                        disabled={versions.length === 0}
                      >
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
                      className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    >
                      <option value="A_VISTA">À vista</option>
                      <option
                        value="FINANCIADO"
                        disabled={!property.acceptsFinancing}
                      >
                        Financiado{" "}
                        {!property.acceptsFinancing
                          ? "(indisponível neste imóvel)"
                          : ""}
                      </option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="space-y-1 text-xs font-medium">
                    <span>Valor total proposto (R$)</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      data-testid="offer-amount-input"
                      className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    />
                  </label>

                  <label className="space-y-1 text-xs font-medium">
                    <span>Recursos próprios / entrada (R$)</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      disabled={paymentModality === "A_VISTA"}
                      value={
                        paymentModality === "A_VISTA"
                          ? amount
                          : downPaymentAmount
                      }
                      onChange={(e) =>
                        setDownPaymentAmount(Number(e.target.value))
                      }
                      data-testid="offer-downpayment-input"
                      className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm disabled:opacity-60"
                    />
                  </label>

                  <div className="space-y-1 text-xs font-medium">
                    <span>Saldo de financiamento (R$)</span>
                    <div
                      data-testid="offer-financing-readonly"
                      className="flex h-9 items-center rounded-md border border-border bg-secondary/50 px-3 text-sm font-semibold"
                    >
                      {formatCurrencyBRL(computedFinancing)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium">
                    <span>Validade da versão</span>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      data-testid="offer-valid-until-input"
                      className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    />
                  </label>

                  <label className="space-y-1 text-xs font-medium">
                    <span>
                      Comissão prevista informativa (R$ · ref.{" "}
                      {property.saleAuthorization.expectedCommissionPercent}%)
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
                      className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    />
                  </label>
                </div>

                <label className="block space-y-1 text-xs font-medium">
                  <span>Condições e observações da negociação</span>
                  <textarea
                    rows={3}
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    data-testid="offer-conditions-input"
                    className="w-full rounded-md border border-input bg-card p-3 text-sm"
                  />
                </label>

                <div className="rounded-lg border border-[var(--color-amber-400)]/50 bg-[var(--amber-subtle)] px-3 py-2 text-xs text-[var(--amber-fg)]">
                  Após o envio, a versão <strong>v{versions.length + 1}</strong>{" "}
                  fica bloqueada para edição. Eventuais ajustes posteriores de
                  valor, prazo ou condições devem ser registrados em nova versão
                  ou contraproposta.
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button type="submit" data-testid="submit-offer-version-btn">
                    <Send className="h-4 w-4" />
                    Enviar {authorRole === "VENDEDOR" ? "contraproposta" : "proposta"}{" "}
                    v{versions.length + 1}
                  </Button>
                </div>
              </form>
            )}
          </TabsContent>

          <TabsContent value="compare" data-testid="offer-comparison-view">
            {versions.length >= 2 && leftVersion && rightVersion && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium">
                    <span>Coluna esquerda</span>
                    <select
                      value={leftVersion.id}
                      onChange={(e) => setLeftVersionId(e.target.value)}
                      data-testid="compare-left-select"
                      className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          v{v.versionNumber} —{" "}
                          {OFFER_AUTHOR_LABELS[v.authorRole]} (
                          {formatCurrencyBRL(v.amount)})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs font-medium">
                    <span>Coluna direita</span>
                    <select
                      value={rightVersion.id}
                      onChange={(e) => setRightVersionId(e.target.value)}
                      data-testid="compare-right-select"
                      className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          v{v.versionNumber} —{" "}
                          {OFFER_AUTHOR_LABELS[v.authorRole]} (
                          {formatCurrencyBRL(v.amount)})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-secondary/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Critério</th>
                        <th className="px-4 py-3">
                          Versão v{leftVersion.versionNumber}
                        </th>
                        <th className="px-4 py-3">
                          Versão v{rightVersion.versionNumber}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="px-4 py-2.5 font-medium">Origem</td>
                        <td className="px-4 py-2.5">
                          {OFFER_AUTHOR_LABELS[leftVersion.authorRole]}
                        </td>
                        <td className="px-4 py-2.5">
                          {OFFER_AUTHOR_LABELS[rightVersion.authorRole]}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-medium">Status</td>
                        <td className="px-4 py-2.5">
                          {OFFER_VERSION_STATUS_LABELS[leftVersion.status]}
                        </td>
                        <td className="px-4 py-2.5">
                          {OFFER_VERSION_STATUS_LABELS[rightVersion.status]}
                        </td>
                      </tr>
                      <tr
                        className={
                          leftVersion.amount !== rightVersion.amount
                            ? "bg-[var(--accent-subtle)]/50"
                            : ""
                        }
                      >
                        <td className="px-4 py-2.5 font-medium">Valor total</td>
                        <td className="px-4 py-2.5 font-semibold">
                          {formatCurrencyBRL(leftVersion.amount)}
                        </td>
                        <td className="px-4 py-2.5 font-semibold">
                          {formatCurrencyBRL(rightVersion.amount)}
                        </td>
                      </tr>
                      <tr
                        className={
                          leftVersion.paymentModality !==
                          rightVersion.paymentModality
                            ? "bg-[var(--accent-subtle)]/50"
                            : ""
                        }
                      >
                        <td className="px-4 py-2.5 font-medium">Modalidade</td>
                        <td className="px-4 py-2.5">
                          {
                            PAYMENT_MODALITY_LABELS[
                              leftVersion.paymentModality
                            ]
                          }
                        </td>
                        <td className="px-4 py-2.5">
                          {
                            PAYMENT_MODALITY_LABELS[
                              rightVersion.paymentModality
                            ]
                          }
                        </td>
                      </tr>
                      <tr
                        className={
                          leftVersion.downPaymentAmount !==
                          rightVersion.downPaymentAmount
                            ? "bg-[var(--accent-subtle)]/50"
                            : ""
                        }
                      >
                        <td className="px-4 py-2.5 font-medium">
                          Recursos próprios
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrencyBRL(leftVersion.downPaymentAmount)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrencyBRL(rightVersion.downPaymentAmount)}
                        </td>
                      </tr>
                      <tr
                        className={
                          leftVersion.financingAmount !==
                          rightVersion.financingAmount
                            ? "bg-[var(--accent-subtle)]/50"
                            : ""
                        }
                      >
                        <td className="px-4 py-2.5 font-medium">
                          Financiamento
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrencyBRL(leftVersion.financingAmount)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrencyBRL(rightVersion.financingAmount)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-medium">Validade</td>
                        <td className="px-4 py-2.5">
                          {formatShortDate(leftVersion.validUntil)}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatShortDate(rightVersion.validUntil)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-medium">
                          Comissão prevista (informativa)
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrencyBRL(
                            leftVersion.expectedCommissionAmount,
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {formatCurrencyBRL(
                            rightVersion.expectedCommissionAmount,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-medium">Condições</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {leftVersion.conditions}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {rightVersion.conditions}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
