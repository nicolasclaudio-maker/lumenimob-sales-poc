"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderOpen,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

function ImmutableLockHint({ versionNumber }: { versionNumber: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid={`immutable-badge-v${versionNumber}`}
          className="inline-flex cursor-default items-center text-muted-foreground/80"
        >
          <Lock className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">Imutável após envio</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Imutável após envio — ajustes geram nova versão
      </TooltipContent>
    </Tooltip>
  );
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

  const [showFullTimeline, setShowFullTimeline] = React.useState(false);

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

  const reversedTimeline = [...opportunity.timeline].reverse();
  const visibleTimeline = showFullTimeline
    ? reversedTimeline
    : reversedTimeline.slice(0, 3);

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
      message:
        "Prazo de validade encerrado. Registre nova versão para retomar.",
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
      {/* Breadcrumb + cabeçalho contextual único (sem cabeçalho global duplicado) */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <nav
            aria-label="Navegação"
            className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onBackToBoard}
              data-testid="back-to-board-btn"
              className="-ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Gestão de vendas
            </Button>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            <span>{opportunity.code}</span>
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
          </nav>

          <h1 className="text-xl font-bold tracking-tight">
            {buyer.name} · {property.title}
          </h1>
          {opportunity.attendanceSummary && (
            <p className="text-xs text-muted-foreground">
              {opportunity.attendanceSummary}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {linkedCase && (
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenCase(linkedCase.id)}
              data-testid="open-linked-case-btn"
            >
              <FolderOpen className="h-4 w-4" />
              Abrir dossiê ({SALE_CASE_STATUS_LABELS[linkedCase.status]})
            </Button>
          )}

          {canNegotiate && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleOpenLossDialog}
              data-testid="toggle-loss-form-btn"
              className="text-muted-foreground hover:text-[var(--error-fg)]"
            >
              <XCircle className="h-3.5 w-3.5" />
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

      {/* Layout 2 colunas: negociação à esquerda + resumo unificado à direita */}
      <div className="grid gap-6 lg:grid-cols-[1fr_330px] lg:items-start">
        <div className="space-y-6">
          {/* Card único de Propostas e contrapropostas */}
          <Card data-testid="offer-versions-section">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Propostas{" "}
                  <span className="font-normal text-muted-foreground">
                    ({versions.length})
                  </span>
                </CardTitle>

                {versions.length >= 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => handleOpenComposer("compare")}
                    data-testid="open-offer-compare-btn"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Comparar versões
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {versions.length === 0 ? (
                <div className="flex flex-col items-center justify-between gap-3 rounded-lg bg-secondary/35 px-4 py-6 text-center sm:flex-row sm:text-left">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Nenhuma proposta enviada
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Valor pedido pelo imóvel:{" "}
                      {formatCurrencyBRL(property.askingPrice)}
                    </p>
                  </div>
                  {canNegotiate && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleOpenComposer("compose", "COMPRADOR")}
                      data-testid="open-offer-composer-btn"
                    >
                      <Plus className="h-4 w-4" />
                      Enviar proposta v1
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Faixa enxuta quando há histórico mas nenhuma versão aberta */}
                  {canNegotiate && !activePendingVersion && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/45 px-3.5 py-2.5">
                      <span className="text-xs text-muted-foreground">
                        Nenhuma proposta aguardando resposta.
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            handleOpenComposer("compose", "COMPRADOR")
                          }
                          data-testid="open-offer-composer-btn"
                        >
                          <Plus className="h-4 w-4" />
                          Nova proposta v{versions.length + 1}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleOpenComposer("compose", "VENDEDOR")
                          }
                          data-testid="open-counteroffer-composer-btn"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Contraproposta v{versions.length + 1}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Versão ativa aguardando decisão em destaque */}
                  {activePendingVersion && (
                    <div
                      data-testid={`offer-version-card-v${activePendingVersion.versionNumber}`}
                      className="rounded-xl border border-primary/35 bg-[var(--accent-subtle)]/25 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            v{activePendingVersion.versionNumber} ·{" "}
                            {
                              OFFER_AUTHOR_LABELS[
                                activePendingVersion.authorRole
                              ]
                            }
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

                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>
                            {formatDateTime(activePendingVersion.createdAt)}
                          </span>
                          <ImmutableLockHint
                            versionNumber={activePendingVersion.versionNumber}
                          />
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
                        <div>
                          <span className="text-muted-foreground">
                            Valor proposto
                          </span>
                          <p className="mt-0.5 text-base font-bold tabular-nums text-foreground">
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
                            <p className="tabular-nums text-muted-foreground">
                              Entrada{" "}
                              {formatCurrencyBRL(
                                activePendingVersion.downPaymentAmount,
                              )}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Validade
                          </span>
                          <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                            {formatShortDate(activePendingVersion.validUntil)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Comissão prevista
                          </span>
                          <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                            {formatCurrencyBRL(
                              activePendingVersion.expectedCommissionAmount,
                            )}
                          </p>
                        </div>
                      </div>

                      {activePendingVersion.conditions && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          {activePendingVersion.conditions}
                        </p>
                      )}

                      {/* Hierarquia clara: 1 primária + 1 secundária + ações terciárias discretas */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
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
                            Contrapropor
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleOpenRejectDialog(activePendingVersion)
                            }
                            data-testid={`reject-version-toggle-v${activePendingVersion.versionNumber}`}
                            className="text-muted-foreground hover:text-[var(--error-fg)]"
                          >
                            Rejeitar
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          <IconButton
                            tooltip="Nova versão do comprador"
                            onClick={() =>
                              handleOpenComposer("compose", "COMPRADOR")
                            }
                            data-testid="open-offer-composer-btn"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton
                            tooltip="Marcar proposta como expirada"
                            onClick={() =>
                              handleExpireVersion(activePendingVersion.id)
                            }
                            data-testid={`expire-version-btn-v${activePendingVersion.versionNumber}`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Versões anteriores em lista enxuta */}
                  {historicalVersions.length > 0 && (
                    <div className="space-y-1.5">
                      {activePendingVersion && (
                        <p className="text-xs font-medium text-muted-foreground">
                          Versões anteriores
                        </p>
                      )}
                      <div className="divide-y divide-border/70 rounded-lg border border-border/80 bg-secondary/20">
                        {historicalVersions.map((version) => (
                          <div
                            key={version.id}
                            data-testid={`offer-version-card-v${version.versionNumber}`}
                            className="px-3.5 py-2.5 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold tabular-nums text-foreground">
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

                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>{formatDateTime(version.createdAt)}</span>
                                <ImmutableLockHint
                                  versionNumber={version.versionNumber}
                                />
                              </span>
                            </div>

                            {version.decisionNote && (
                              <p className="mt-1 text-muted-foreground">
                                Motivo: {version.decisionNote}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Histórico discreto sem caixa pesada */}
          <section aria-label="Histórico da negociação" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Histórico ({opportunity.timeline.length})
              </h2>
              {reversedTimeline.length > 3 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowFullTimeline((prev) => !prev)}
                  className="text-muted-foreground"
                >
                  {showFullTimeline
                    ? "Mostrar menos"
                    : `Ver todos (${reversedTimeline.length})`}
                </Button>
              )}
            </div>
            <ol className="space-y-2 border-l border-border pl-3.5 text-xs">
              {visibleTimeline.map((event) => (
                <li key={event.id} className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">
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
          </section>
        </div>

        {/* Coluna lateral unificada em um único card de resumo */}
        <aside>
          <Card>
            <CardContent className="divide-y divide-border/80 p-4 text-xs">
              {/* Imóvel */}
              <div className="space-y-1.5 pb-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-muted-foreground">
                    Imóvel
                  </span>
                  <Badge
                    variant={getPropertyBadgeVariant(property.commercialStatus)}
                    dot
                    data-testid="opportunity-property-status-badge"
                  >
                    {PROPERTY_COMMERCIAL_STATUS_LABELS[property.commercialStatus]}
                  </Badge>
                </div>

                <p className="text-sm font-semibold text-foreground">
                  {property.title}
                </p>
                <p className="text-muted-foreground">
                  {PROPERTY_TYPE_LABELS[property.type]} · {property.address},{" "}
                  {property.neighborhood}
                </p>
                <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1">
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {formatCurrencyBRL(property.askingPrice)}
                  </span>
                  <span
                    className="text-muted-foreground"
                    data-testid="opportunity-property-listing-text"
                  >
                    {PROPERTY_LISTING_STATUS_LABELS[property.listingStatus]}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {property.registrationCode}
                </p>
              </div>

              {/* Autorização de venda enxuta */}
              <div
                data-testid="sale-authorization-card"
                className="space-y-1 py-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-muted-foreground">
                    Autorização de venda
                  </span>
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
                <p className="text-muted-foreground">
                  Até {formatShortDate(property.saleAuthorization.validUntil)} ·{" "}
                  {property.saleAuthorization.exclusivity
                    ? "Com exclusividade"
                    : "Sem exclusividade"}{" "}
                  · Comissão{" "}
                  {property.saleAuthorization.expectedCommissionPercent}% ·{" "}
                  {property.acceptsFinancing
                    ? "Aceita financiamento"
                    : "Somente à vista"}
                </p>
              </div>

              {/* Partes sem caixas aninhadas */}
              <div className="space-y-2.5 pt-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-muted-foreground">
                    Partes
                  </span>
                  <span className="text-muted-foreground">
                    Corretor {broker.name}
                  </span>
                </div>

                <div>
                  <p className="font-medium text-foreground">
                    Comprador · {buyer.name}
                  </p>
                  <p className="text-muted-foreground">
                    CPF {buyer.maskedDocument}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-muted-foreground">
                    {sellers.length === 1
                      ? "Vendedor"
                      : `Vendedores (${sellers.length})`}
                  </p>
                  {sellers.map((seller) => (
                    <div key={seller.id}>
                      <p className="font-medium text-foreground">
                        {seller.name}{" "}
                        <span className="font-normal text-muted-foreground">
                          · CPF {seller.maskedDocument}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        {seller.civilStatusNote}
                      </p>
                    </div>
                  ))}
                </div>
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
