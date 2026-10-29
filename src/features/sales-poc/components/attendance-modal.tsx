"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INPUT_CLASS,
  useModalDismiss,
} from "@/features/sales-poc/components/ui-helpers";
import { createOpportunity } from "@/features/sales-poc/domain/state-machine";
import { useSalesPocStore } from "@/features/sales-poc/store/sales-poc-store";
import {
  formatCurrencyBRL,
  PAYMENT_MODALITY_LABELS,
  PROPERTY_COMMERCIAL_STATUS_LABELS,
} from "@/features/sales-poc/utils/formatters";

export interface AttendanceModalProps {
  open: boolean;
  onClose: () => void;
  onOpportunitySelected: (opportunityId: string) => void;
}

export function AttendanceModal({
  open,
  onClose,
  onOpportunitySelected,
}: AttendanceModalProps) {
  const { fixture, dispatchDomainAction } = useSalesPocStore();

  const [buyerId, setBuyerId] = React.useState(
    fixture.buyers[0]?.id ?? "buyer-01",
  );
  const [propertyId, setPropertyId] = React.useState(
    fixture.properties[5]?.id ?? fixture.properties[0]?.id ?? "prop-06",
  );
  const [brokerId, setBrokerId] = React.useState(
    fixture.brokers[0]?.id ?? "broker-01",
  );
  const [attendanceSummary, setAttendanceSummary] = React.useState("");
  const [showManualForm, setShowManualForm] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const dialogRef = useModalDismiss(open, onClose);

  if (!open) return null;

  function handleQuickCreate(targetBuyerId: string, targetPropertyId: string) {
    setErrorMessage(null);
    const prop = fixture.properties.find((p) => p.id === targetPropertyId);
    const assignedBrokerId = prop?.brokerId ?? brokerId;

    const result = dispatchDomainAction((state) =>
      createOpportunity(state, {
        buyerId: targetBuyerId,
        propertyId: targetPropertyId,
        brokerId: assignedBrokerId,
      }),
    );

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    if (result.createdOpportunityId) {
      onOpportunitySelected(result.createdOpportunityId);
      onClose();
    }
  }

  function handleSubmitForm(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    const result = dispatchDomainAction((state) =>
      createOpportunity(state, {
        buyerId,
        propertyId,
        brokerId,
        attendanceSummary,
      }),
    );

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    if (result.createdOpportunityId) {
      onOpportunitySelected(result.createdOpportunityId);
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-modal-title"
      data-testid="attendance-modal"
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
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl focus:outline-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="space-y-0.5">
            <h2
              id="attendance-modal-title"
              className="text-lg font-bold tracking-tight"
            >
              Nova oportunidade
            </h2>
            <p className="text-xs text-muted-foreground">
              {showManualForm
                ? "Vincule manualmente comprador, imóvel à venda e corretor responsável."
                : "Selecione um interesse registrado na carteira para iniciar a negociação."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setErrorMessage(null);
                setShowManualForm((prev) => !prev);
              }}
              data-testid="toggle-manual-opp-form-btn"
              className="text-muted-foreground hover:text-foreground"
            >
              {showManualForm ? (
                <>
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Interesses registrados
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Cadastro manual
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Fechar janela de atendimentos"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {errorMessage && (
            <div
              role="alert"
              data-testid="attendance-error-alert"
              className="mb-4 rounded-lg border border-[var(--color-error-200)] bg-[var(--error-subtle)] p-3 text-sm font-medium text-[var(--error-fg)]"
            >
              {errorMessage}
            </div>
          )}

          {showManualForm ? (
            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium">
                  <span>Comprador</span>
                  <select
                    value={buyerId}
                    onChange={(e) => setBuyerId(e.target.value)}
                    data-testid="new-opp-buyer-select"
                    className={INPUT_CLASS}
                  >
                    {fixture.buyers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-medium">
                  <span>Corretor responsável</span>
                  <select
                    value={brokerId}
                    onChange={(e) => setBrokerId(e.target.value)}
                    data-testid="new-opp-broker-select"
                    className={INPUT_CLASS}
                  >
                    {fixture.brokers.map((br) => (
                      <option key={br.id} value={br.id}>
                        {br.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1 text-xs font-medium">
                <span>Imóvel à venda</span>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  data-testid="new-opp-property-select"
                  className={INPUT_CLASS}
                >
                  {fixture.properties.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.commercialStatus === "VENDIDO"}
                    >
                      {p.title} · {formatCurrencyBRL(p.askingPrice)} (
                      {PROPERTY_COMMERCIAL_STATUS_LABELS[p.commercialStatus]})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-xs font-medium">
                <span>Observação do atendimento (opcional)</span>
                <input
                  type="text"
                  value={attendanceSummary}
                  onChange={(e) => setAttendanceSummary(e.target.value)}
                  placeholder="Ex.: Visita presencial concluída; cliente deseja formalizar proposta."
                  className={INPUT_CLASS}
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" data-testid="submit-new-opp-button">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Abrir oportunidade
                </Button>
              </div>
            </form>
          ) : (
            <div className="divide-y divide-border/80">
              {fixture.buyers.map((buyer) => {
                const interestedProperties = buyer.interestedPropertyIds
                  .map((pid) => fixture.properties.find((p) => p.id === pid))
                  .filter((p): p is NonNullable<typeof p> => Boolean(p));

                return (
                  <div
                    key={buyer.id}
                    data-testid={`attendance-card-${buyer.id}`}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-foreground">
                          {buyer.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {PAYMENT_MODALITY_LABELS[buyer.preferredPaymentModality]}{" "}
                          · CPF {buyer.maskedDocument}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {interestedProperties.length}{" "}
                        {interestedProperties.length === 1
                          ? "imóvel de interesse"
                          : "imóveis de interesse"}
                      </span>
                    </div>

                    <ul className="mt-1.5 divide-y divide-border/50">
                      {interestedProperties.map((prop) => {
                        const existingOpp = fixture.opportunities.find((o) => {
                          if (
                            o.buyerId !== buyer.id ||
                            o.propertyId !== prop.id ||
                            o.status === "PERDIDA"
                          ) {
                            return false;
                          }
                          if (o.status === "ACEITA" && o.saleCaseId) {
                            const linked = fixture.cases.find(
                              (c) => c.id === o.saleCaseId,
                            );
                            return linked
                              ? linked.status !== "CANCELADO"
                              : true;
                          }
                          return true;
                        });

                        return (
                          <li
                            key={prop.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-medium text-foreground">
                                {prop.title}
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                {" "}
                                · {formatCurrencyBRL(prop.askingPrice)} ·{" "}
                                {
                                  PROPERTY_COMMERCIAL_STATUS_LABELS[
                                    prop.commercialStatus
                                  ]
                                }
                              </span>
                            </div>

                            {existingOpp ? (
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                data-testid={`open-existing-opp-${buyer.id}-${prop.id}`}
                                onClick={() => {
                                  onOpportunitySelected(existingOpp.id);
                                  onClose();
                                }}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                Abrir negociação
                                <ArrowRight
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                data-testid={`create-opp-${buyer.id}-${prop.id}`}
                                disabled={prop.commercialStatus === "VENDIDO"}
                                onClick={() =>
                                  handleQuickCreate(buyer.id, prop.id)
                                }
                              >
                                <Plus
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                Criar oportunidade
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
