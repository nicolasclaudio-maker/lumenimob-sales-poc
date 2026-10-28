"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck2,
  FolderOpen,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActionDialog } from "@/features/sales-poc/components/action-dialog";
import { OfferComposerModal } from "@/features/sales-poc/components/offer-composer-modal";
import {
  getOfferStatusBadgeVariant,
  getPropertyBadgeVariant,
  INPUT_CLASS,
} from "@/features/sales-poc/components/ui-helpers";
import {
  acceptOfferVersion,
  expireOfferVersion,
  markOpportunityLost,
  rejectOfferVersion,
} from "@/features/sales-poc/domain/state-machine";
import type {
  SaleOfferAuthorRole,
  SaleOfferVersion,
} from "@/features/sales-poc/domain/types";
import { useSalesPocStore } from "@/features/sales-poc/store/sales-poc-store";
import {
  formatCurrencyBRL,
  formatDateTime,
  formatShortDate,
  OFFER_AUTHOR_LABELS,
  OFFER_VERSION_STATUS_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  PAYMENT_MODALITY_LABELS,
  PROPERTY_COMMERCIAL_STATUS_LABELS,
  PROPERTY_LISTING_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  SALE_CASE_STATUS_LABELS,
  TIMELINE_EVENT_TYPE_LABELS,
} from "@/features/sales-poc/utils/formatters";

export interface OpportunityDetailPanelProps {
  opportunityId: string;
  onBackToBoard: () => void;
  onOpenCase: (caseId: string) => void;
}

export function OpportunityDetailPanel({
  opportunityId,
  onBackToBoard,
  onOpenCase,
}: OpportunityDetailPanelProps) {
  const { fixture, dispatchDomainAction } = useSalesPocStore();

  const [composerOpen, setComposerOpen] = React.useState(false);
  const [composerTab, setComposerTab] = React.useState<"compose" | "compare">(
    "compose",
  );
  const [composerAuthor, setComposerAuthor] =
    React.useState<SaleOfferAuthorRole>("COMPRADOR");

  const [rejectingVersion, setRejectingVersion] =
    React.useState<SaleOfferVersion | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);

  const [lossDialogOpen, setLossDialogOpen] = React.useState(false);
  const [lossReason, setLossReason] = React.useState("");
  const [lossError, setLossError] = React.useState<string | null>(null);

  const [domainFeedback, setDomainFeedback] = React.useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);

  const opportunity = fixture.opportunities.find((o) => o.id === opportunityId);
  if (!opportunity) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Oportunidade não encontrada no cadastro atual.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={onBackToBoard}
          >
            Voltar ao Kanban
          </Button>
        </CardContent>
      </Card>
    );
  }

  const property = fixture.properties.find(
    (p) => p.id === opportunity.propertyId,
  )!;
  const buyer = fixture.buyers.find((b) => b.id === opportunity.buyerId)!;
  const broker = fixture.brokers.find((b) => b.id === opportunity.brokerId)!;
  const sellers = property.sellerIds
    .map((sid) => fixture.sellers.find((s) => s.id === sid))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const offer = opportunity.offerId
    ? fixture.offers.find((o) => o.id === opportunity.offerId)
    : undefined;
  const linkedCase = opportunity.saleCaseId
    ? fixture.cases.find((c) => c.id === opportunity.saleCaseId)
    : undefined;

  const versions = offer?.versions ?? [];
  const canNegotiate =
    opportunity.status === "ATENDIMENTO" ||
    opportunity.status === "EM_PROPOSTA";

  const activePendingVersion = canNegotiate
    ? versions.find((v) => v.status === "ENVIADA")
    : undefined;
  const historicalVersions = [...versions]
    .filter((v) => v.id !== activePendingVersion?.id)
    .reverse();

  function handleOpenComposer(
    tab: "compose" | "compare",
    role: SaleOfferAuthorRole = "COMPRADOR",
  ) {
    setDomainFeedback(null);
    setComposerTab(tab);
    setComposerAuthor(role);
    setComposerOpen(true);
  }

  function handleAcceptVersion(versionId: string) {
    setDomainFeedback(null);
    const result = dispatchDomainAction((state) =>
      acceptOfferVersion(state, {
        opportunityId: opportunity!.id,
        versionId,
      }),
    );

    if (!result.ok) {
      setDomainFeedback({
        kind: "error",
        message: result.message,
      });
      return;
    }

    setDomainFeedback({
      kind: "success",
      message:
        "Proposta aceita. O imóvel passou a Reservado e o dossiê da venda foi aberto.",
    });
  }

  function handleOpenRejectDialog(version: SaleOfferVersion) {
    setDomainFeedback(null);
    setRejectReason("");
    setRejectError(null);
    setRejectingVersion(version);
  }

  function handleConfirmReject() {
    if (!rejectingVersion) return;
    setRejectError(null);
    const result = dispatchDomainAction((state) =>
      rejectOfferVersion(state, {
        opportunityId: opportunity!.id,
        versionId: rejectingVersion.id,
        reason: rejectReason,
      }),
    );

    if (!result.ok) {
      setRejectError(result.message);
      return;
    }

    setRejectingVersion(null);
    setRejectReason("");
    setDomainFeedback({
      kind: "success",
      message:
        "Proposta recusada. Você pode registrar uma nova proposta quando desejar.",
    });
  }

  function handleExpireVersion(versionId: string) {
    setDomainFeedback(null);
    const result = dispatchDomainAction((state) =>
      expireOfferVersion(state, {
        opportunityId: opportunity!.id,
        versionId,
      }),
    );

    if (!result.ok) {
      setDomainFeedback({
        kind: "error",
        message: result.message,
      });
      return;
    }

    setDomainFeedback({
      kind: "success",
      message: "Prazo de validade encerrado. Registre nova versão para retomar.",
    });
  }

  function handleOpenLossDialog() {
    setDomainFeedback(null);
    setLossReason("");
    setLossError(null);
    setLossDialogOpen(true);
  }

  function handleConfirmLoss() {
    setLossError(null);

    const result = dispatchDomainAction((state) =>
      markOpportunityLost(state, {
        opportunityId: opportunity!.id,
        lossReason,
      }),
    );

    if (!result.ok) {
      setLossError(result.message);
      return;
    }

    setLossDialogOpen(false);
    setLossReason("");
    setDomainFeedback({
      kind: "success",
      message: "Oportunidade encerrada como perdida.",
    });
  }

  return (
    <div data-testid="opportunity-detail-panel" className="space-y-5">
      {/* Cabeçalho enxuto */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onBackToBoard}
              data-testid="back-to-board-btn"
              className="-ml-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Kanban
            </Button>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{opportunity.code}</span>
            <Badge
              variant={
                opportunity.status === "ACEITA"
                  ? "success"
                  : opportunity.status === "PERDIDA"
                    ? "error"
                    : "info"
              }
              dot
              data-testid="opportunity-status-badge"
            >
              {OPPORTUNITY_STATUS_LABELS[opportunity.status]}
            </Badge>
          </div>
          <h2 className="text-xl font-bold">
            {buyer.name} · {property.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {opportunity.attendanceSummary}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {linkedCase && (
            <Button
              type="button"
              variant="teal"
              onClick={() => onOpenCase(linkedCase.id)}
              data-testid="open-linked-case-btn"
            >
              <FolderOpen className="h-4 w-4" />
              Abrir dossiê {linkedCase.code}
            </Button>
          )}

          {canNegotiate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenLossDialog}
              data-testid="toggle-loss-form-btn"
            >
              <XCircle className="h-4 w-4" />
              Marcar perdida
            </Button>
          )}
        </div>
      </div>

      {/* Feedback de regra de negócio (ex.: segundo aceite bloqueado) */}
      {domainFeedback && !lossDialogOpen && !rejectingVersion && (
        <div
          role="alert"
          data-testid="opportunity-domain-alert"
          className={
            domainFeedback.kind === "error"
              ? "flex items-start gap-2.5 rounded-xl border border-[var(--color-error-200)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-fg)]"
              : "flex items-start gap-2.5 rounded-xl border border-[var(--color-success-200)] bg-[var(--success-subtle)] px-4 py-3 text-sm font-medium text-[var(--success-fg)]"
          }
        >
          {domainFeedback.kind === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>{domainFeedback.message}</div>
        </div>
      )}

      {/* Motivo registrado se já estiver Perdida */}
      {opportunity.status === "PERDIDA" && opportunity.lossReason && (
        <div
          data-testid="opportunity-loss-reason-banner"
          className="rounded-xl border border-[var(--color-error-200)] bg-[var(--error-subtle)] px-4 py-3 text-sm text-[var(--error-fg)]"
        >
          <strong>Negociação encerrada:</strong> {opportunity.lossReason}
        </div>
      )}

      {/* Layout 2 colunas: ação principal à esquerda + contexto lateral à direita */}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-5">
          {/* Bloco de próxima ação quando não há proposta aguardando decisão */}
          {canNegotiate && !activePendingVersion && (
            <Card className="border-primary/40">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">
                    {versions.length === 0
                      ? "Próximo passo: registrar a primeira proposta"
                      : "Nenhuma proposta aguardando resposta"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {versions.length === 0
                      ? `Valor pedido pelo imóvel: ${formatCurrencyBRL(property.askingPrice)}.`
                      : "Envie uma nova versão mantendo todo o histórico anterior."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleOpenComposer("compose", "COMPRADOR")}
                    data-testid="open-offer-composer-btn"
                  >
                    <Plus className="h-4 w-4" />
                    {versions.length === 0
                      ? "Enviar proposta v1"
                      : `Nova proposta v${versions.length + 1}`}
                  </Button>
                  {versions.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenComposer("compose", "VENDEDOR")}
                      data-testid="open-counteroffer-composer-btn"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Contraproposta v{versions.length + 1}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumo pós-aceite */}
          {opportunity.status === "ACEITA" && linkedCase && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-success-200)] bg-[var(--success-subtle)] px-4 py-3 text-sm text-[var(--success-fg)]">
              <div>
                <p className="font-semibold">
                  Negociação concluída com proposta aceita
                </p>
                <p className="text-xs opacity-90">
                  Acompanhe documentos, marcos e cartório no dossiê{" "}
                  {linkedCase.code} (etapa:{" "}
                  {SALE_CASE_STATUS_LABELS[linkedCase.status]}).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="teal"
                onClick={() => onOpenCase(linkedCase.id)}
              >
                Ir para o dossiê
              </Button>
            </div>
          )}

          {/* Propostas e contrapropostas */}
          <Card data-testid="offer-versions-section">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    Propostas e contrapropostas ({versions.length})
                  </CardTitle>
                  <CardDescription>
                    Versões enviadas ficam bloqueadas para edição; ajustes geram
                    nova versão.
                  </CardDescription>
                </div>
                {versions.length >= 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenComposer("compare")}
                    data-testid="open-offer-compare-btn"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Comparar versões
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {versions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  Nenhuma proposta enviada ainda nesta oportunidade.
                </p>
              ) : (
                <>
                  {/* Versão ativa aguardando decisão em destaque no topo */}
                  {activePendingVersion && (
                    <div
                      data-testid={`offer-version-card-v${activePendingVersion.versionNumber}`}
                      className="rounded-xl border-2 border-primary/40 bg-[var(--accent-subtle)]/20 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">
                            Versão v{activePendingVersion.versionNumber} ·{" "}
                            {OFFER_AUTHOR_LABELS[activePendingVersion.authorRole]}
                          </span>
                          <Badge
                            variant={getOfferStatusBadgeVariant(
                              activePendingVersion.status,
                            )}
                            data-testid={`offer-version-status-v${activePendingVersion.versionNumber}`}
                          >
                            {
                              OFFER_VERSION_STATUS_LABELS[
                                activePendingVersion.status
                              ]
                            }
                          </Badge>
                        </div>

                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {formatDateTime(activePendingVersion.createdAt)}
                          </span>
                          <span
                            data-testid={`immutable-badge-v${activePendingVersion.versionNumber}`}
                            className="inline-flex items-center gap-1"
                          >
                            <Lock className="h-3 w-3" />
                            Imutável após envio
                          </span>
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">
                            Valor proposto
                          </span>
                          <p className="mt-0.5 text-base font-bold text-foreground">
                            {formatCurrencyBRL(activePendingVersion.amount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Pagamento
                          </span>
                          <p className="mt-0.5 font-semibold text-foreground">
                            {
                              PAYMENT_MODALITY_LABELS[
                                activePendingVersion.paymentModality
                              ]
                            }
                          </p>
                          {activePendingVersion.paymentModality ===
                            "FINANCIADO" && (
                            <p className="text-muted-foreground">
                              Entrada{" "}
                              {formatCurrencyBRL(
                                activePendingVersion.downPaymentAmount,
                              )}{" "}
                              + Financ.{" "}
                              {formatCurrencyBRL(
                                activePendingVersion.financingAmount,
                              )}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Validade</span>
                          <p className="mt-0.5 font-semibold text-foreground">
                            {formatShortDate(activePendingVersion.validUntil)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Comissão prevista
                          </span>
                          <p className="mt-0.5 font-semibold text-foreground">
                            {formatCurrencyBRL(
                              activePendingVersion.expectedCommissionAmount,
                            )}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-muted-foreground">
                        <strong className="text-foreground">Condições:</strong>{" "}
                        {activePendingVersion.conditions}
                      </p>

                      {/* Barra de decisão clara */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              handleAcceptVersion(activePendingVersion.id)
                            }
                            data-testid={`accept-version-btn-v${activePendingVersion.versionNumber}`}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Aceitar v{activePendingVersion.versionNumber}
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleOpenComposer(
                                "compose",
                                activePendingVersion.authorRole === "COMPRADOR"
                                  ? "VENDEDOR"
                                  : "COMPRADOR",
                              )
                            }
                            data-testid="open-counteroffer-composer-btn"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Contrapropor (v{versions.length + 1})
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleOpenRejectDialog(activePendingVersion)
                            }
                            data-testid={`reject-version-toggle-v${activePendingVersion.versionNumber}`}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Rejeitar
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              handleOpenComposer("compose", "COMPRADOR")
                            }
                            data-testid="open-offer-composer-btn"
                            className="text-muted-foreground"
                          >
                            Nova versão do comprador
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              handleExpireVersion(activePendingVersion.id)
                            }
                            data-testid={`expire-version-btn-v${activePendingVersion.versionNumber}`}
                            className="text-muted-foreground"
                          >
                            <Clock className="h-3 w-3" />
                            Marcar expirada
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Versões encerradas / histórico compacto */}
                  {historicalVersions.length > 0 && (
                    <div className="space-y-2">
                      {activePendingVersion && (
                        <p className="text-xs font-medium text-muted-foreground">
                          Versões anteriores
                        </p>
                      )}
                      {historicalVersions.map((version) => (
                        <div
                          key={version.id}
                          data-testid={`offer-version-card-v${version.versionNumber}`}
                          className="rounded-lg border border-border bg-secondary/20 px-3.5 py-2.5 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-foreground">
                                v{version.versionNumber} ·{" "}
                                {formatCurrencyBRL(version.amount)}
                              </span>
                              <span className="text-muted-foreground">
                                {OFFER_AUTHOR_LABELS[version.authorRole]} ·{" "}
                                {
                                  PAYMENT_MODALITY_LABELS[
                                    version.paymentModality
                                  ]
                                }
                              </span>
                              <Badge
                                variant={getOfferStatusBadgeVariant(
                                  version.status,
                                )}
                                data-testid={`offer-version-status-v${version.versionNumber}`}
                              >
                                {OFFER_VERSION_STATUS_LABELS[version.status]}
                              </Badge>
                            </div>

                            <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>{formatDateTime(version.createdAt)}</span>
                              <span
                                data-testid={`immutable-badge-v${version.versionNumber}`}
                                className="inline-flex items-center gap-1"
                              >
                                <Lock className="h-3 w-3" />
                                Imutável após envio
                              </span>
                            </span>
                          </div>

                          <p className="mt-1 text-muted-foreground">
                            {version.conditions}
                          </p>
                          {version.decisionNote && (
                            <p className="mt-1 font-medium text-foreground">
                              Motivo: {version.decisionNote}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Histórico da oportunidade */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Histórico da negociação ({opportunity.timeline.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2.5 border-l-2 border-border pl-4 text-xs">
                {[...opportunity.timeline].reverse().map((event) => (
                  <li key={event.id} className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {event.actor}
                      </span>
                      <span className="text-muted-foreground">
                        · {TIMELINE_EVENT_TYPE_LABELS[event.type]} ·{" "}
                        {formatDateTime(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{event.description}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral de consulta: Imóvel, Autorização e Partes */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  Imóvel
                </CardTitle>
                <Badge
                  variant={getPropertyBadgeVariant(property.commercialStatus)}
                  dot
                  data-testid="opportunity-property-status-badge"
                >
                  {PROPERTY_COMMERCIAL_STATUS_LABELS[property.commercialStatus]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="text-sm font-semibold text-foreground">
                {property.title}
              </p>
              <p className="text-muted-foreground">
                {property.code} · {PROPERTY_TYPE_LABELS[property.type]} ·{" "}
                {property.address}, {property.neighborhood}
              </p>
              <p className="text-muted-foreground">
                Matrícula:{" "}
                <span className="font-mono">{property.registrationCode}</span>
              </p>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Valor pedido</span>
                <span className="text-sm font-bold">
                  {formatCurrencyBRL(property.askingPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Anúncio</span>
                <span
                  className="font-medium"
                  data-testid="opportunity-property-listing-text"
                >
                  {PROPERTY_LISTING_STATUS_LABELS[property.listingStatus]}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="sale-authorization-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileCheck2 className="h-4 w-4 text-primary" />
                  Autorização de venda
                </CardTitle>
                <Badge
                  variant={
                    property.saleAuthorization.status === "VIGENTE"
                      ? "success"
                      : "error"
                  }
                  data-testid="sale-authorization-status-badge"
                >
                  {property.saleAuthorization.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Código</span>
                <span className="font-mono font-medium">
                  {property.saleAuthorization.code}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vigência</span>
                <span>
                  até {formatShortDate(property.saleAuthorization.validUntil)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Regime</span>
                <span>
                  {property.saleAuthorization.exclusivity
                    ? "Com exclusividade"
                    : "Sem exclusividade"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Comissão ref.</span>
                <span>
                  {property.saleAuthorization.expectedCommissionPercent}%
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1.5">
                <span className="text-muted-foreground">Financiamento</span>
                <span>
                  {property.acceptsFinancing ? "Aceita" : "Somente à vista"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                Partes · Corretor {broker.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="rounded-lg bg-secondary/40 p-2.5">
                <p className="flex items-center gap-1 font-semibold text-foreground">
                  <User className="h-3.5 w-3.5 text-primary" />
                  Comprador: {buyer.name}
                </p>
                <p className="text-muted-foreground">
                  CPF {buyer.maskedDocument} · {buyer.email}
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  {sellers.length === 1
                    ? "Vendedor"
                    : `Vendedores (${sellers.length})`}
                </p>
                {sellers.map((seller) => (
                  <div
                    key={seller.id}
                    className="rounded-lg border border-border px-2.5 py-1.5"
                  >
                    <p className="font-medium text-foreground">
                      {seller.name} · CPF {seller.maskedDocument}
                    </p>
                    <p className="text-muted-foreground">
                      {seller.civilStatusNote}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Diálogo: Rejeitar proposta */}
      <ActionDialog
        open={Boolean(rejectingVersion)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingVersion(null);
            setRejectError(null);
          }
        }}
        title={
          rejectingVersion
            ? `Rejeitar versão v${rejectingVersion.versionNumber}`
            : "Rejeitar proposta"
        }
        description="Informe o motivo da recusa. A versão permanecerá consultável no histórico."
        confirmLabel="Confirmar rejeição"
        confirmTestId="confirm-reject-version-btn"
        destructive
        error={rejectError}
        errorTestId="opportunity-domain-alert"
        onConfirm={handleConfirmReject}
      >
        <label className="space-y-1 text-xs font-medium">
          <span>Motivo da rejeição</span>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ex.: Valor abaixo do mínimo acordado com os proprietários."
            data-testid="reject-reason-input"
            className={INPUT_CLASS}
            autoFocus
          />
        </label>
      </ActionDialog>

      {/* Diálogo: Marcar oportunidade como perdida */}
      <ActionDialog
        open={lossDialogOpen}
        onOpenChange={(open) => {
          setLossDialogOpen(open);
          if (!open) setLossError(null);
        }}
        title="Encerrar oportunidade como perdida"
        description="Registre o motivo comercial para encerrar esta negociação."
        confirmLabel="Confirmar perda"
        confirmTestId="confirm-mark-lost-btn"
        destructive
        error={lossError}
        errorTestId="opportunity-domain-alert"
        onConfirm={handleConfirmLoss}
      >
        <label className="space-y-1 text-xs font-medium">
          <span>Motivo obrigatório</span>
          <input
            type="text"
            value={lossReason}
            onChange={(e) => setLossReason(e.target.value)}
            placeholder="Ex.: Cliente optou por outro imóvel na região."
            data-testid="loss-reason-input"
            className={INPUT_CLASS}
            autoFocus
          />
        </label>
      </ActionDialog>

      {composerOpen && (
        <OfferComposerModal
          key={`${opportunity.id}-${composerTab}-${composerAuthor}-${versions.length}`}
          open={composerOpen}
          initialTab={composerTab}
          defaultAuthorRole={composerAuthor}
          opportunity={opportunity}
          property={property}
          offer={offer}
          onClose={() => setComposerOpen(false)}
        />
      )}
    </div>
  );
}
