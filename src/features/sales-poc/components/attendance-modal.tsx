"use client";

import * as React from "react";
import { Building2, Plus, UserCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <Badge variant="primary" dot>
              Carteira de Atendimentos
            </Badge>
            <h2
              id="attendance-modal-title"
              className="mt-1.5 text-xl font-bold"
            >
              Atendimentos ativos e abertura de oportunidade
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Um atendimento comercial pode registrar interesse em mais de um
              imóvel, gerando oportunidades individuais ({" "}
              <strong>1 comprador × 1 imóvel</strong>) para negociação.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar janela de atendimentos"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            data-testid="attendance-error-alert"
            className="mt-4 rounded-lg border border-[var(--color-error-200)] bg-[var(--error-subtle)] p-3 text-sm font-medium text-[var(--error-fg)]"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Clientes com visitas e interesse registrado
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {fixture.buyers.map((buyer) => {
                const interestedProperties = buyer.interestedPropertyIds
                  .map((pid) => fixture.properties.find((p) => p.id === pid))
                  .filter(
                    (p): p is NonNullable<typeof p> => Boolean(p),
                  );

                return (
                  <Card key={buyer.id} data-testid={`attendance-card-${buyer.id}`}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-1.5 font-semibold">
                            <UserCheck className="h-4 w-4 text-primary" />
                            {buyer.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            CPF {buyer.maskedDocument} · Preferência:{" "}
                            {
                              PAYMENT_MODALITY_LABELS[
                                buyer.preferredPaymentModality
                              ]
                            }
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {interestedProperties.length}{" "}
                          {interestedProperties.length === 1
                            ? "imóvel de interesse"
                            : "imóveis de interesse"}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {interestedProperties.map((prop) => {
                          const existingOpp = fixture.opportunities.find(
                            (o) => {
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
                            },
                          );

                          return (
                            <div
                              key={prop.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  <Building2 className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                                  {prop.code} · {prop.title}
                                </p>
                                <p className="text-muted-foreground">
                                  {formatCurrencyBRL(prop.askingPrice)} ·{" "}
                                  {
                                    PROPERTY_COMMERCIAL_STATUS_LABELS[
                                      prop.commercialStatus
                                    ]
                                  }
                                </p>
                              </div>

                              {existingOpp ? (
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  data-testid={`open-existing-opp-${buyer.id}-${prop.id}`}
                                  onClick={() => {
                                    onOpportunitySelected(existingOpp.id);
                                    onClose();
                                  }}
                                >
                                  Abrir {existingOpp.code}
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="xs"
                                  data-testid={`create-opp-${buyer.id}-${prop.id}`}
                                  disabled={prop.commercialStatus === "VENDIDO"}
                                  onClick={() =>
                                    handleQuickCreate(buyer.id, prop.id)
                                  }
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Criar oportunidade
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Formulário livre 1 comprador x 1 imóvel */}
          <form
            onSubmit={handleSubmitForm}
            className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Nova oportunidade manual (1 comprador × 1 imóvel)
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1 text-xs font-medium">
                <span>Comprador</span>
                <select
                  value={buyerId}
                  onChange={(e) => setBuyerId(e.target.value)}
                  data-testid="new-opp-buyer-select"
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {fixture.buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-medium">
                <span>Imóvel à venda</span>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  data-testid="new-opp-property-select"
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {fixture.properties.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.commercialStatus === "VENDIDO"}
                    >
                      {p.code} — {p.title} (
                      {PROPERTY_COMMERCIAL_STATUS_LABELS[p.commercialStatus]})
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
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
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
              <span>Resumo do atendimento (opcional)</span>
              <input
                type="text"
                value={attendanceSummary}
                onChange={(e) => setAttendanceSummary(e.target.value)}
                placeholder="Ex.: Visita presencial concluída; cliente deseja formalizar proposta."
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button type="submit" data-testid="submit-new-opp-button">
                <Plus className="h-4 w-4" />
                Abrir oportunidade
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
