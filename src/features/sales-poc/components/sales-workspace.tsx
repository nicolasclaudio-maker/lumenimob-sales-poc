"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock,
  FolderKanban,
  Kanban,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AttendanceModal } from "@/features/sales-poc/components/attendance-modal";
import { OpportunityDetailPanel } from "@/features/sales-poc/components/opportunity-detail-panel";
import { ResetDemoDialog } from "@/features/sales-poc/components/reset-demo-dialog";
import { SaleCaseDetailPanel } from "@/features/sales-poc/components/sale-case-detail-panel";
import {
  getOfferStatusBadgeVariant,
  getPropertyBadgeVariant,
} from "@/features/sales-poc/components/ui-helpers";
import type {
  PaymentModality,
  SaleCaseStatus,
  SaleOpportunityStatus,
} from "@/features/sales-poc/domain/types";
import { useSalesPocStore } from "@/features/sales-poc/store/sales-poc-store";
import {
  formatCurrencyBRL,
  OFFER_VERSION_STATUS_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  PAYMENT_MODALITY_LABELS,
  PROPERTY_COMMERCIAL_STATUS_LABELS,
  PROPERTY_LISTING_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  SALE_CASE_STATUS_LABELS,
  TRANSVERSAL_BLOCK_LABELS,
} from "@/features/sales-poc/utils/formatters";

/** Colunas do kanban de oportunidades (§4.1). `PERDIDA` é terminal e fica oculta por padrão. */
const OPPORTUNITY_COLUMNS: SaleOpportunityStatus[] = [
  "ATENDIMENTO",
  "EM_PROPOSTA",
  "ACEITA",
];

const CASE_COLUMNS: Exclude<SaleCaseStatus, "CANCELADO">[] = [
  "DILIGENCIA",
  "CONTRATACAO",
  "CARTORIO",
  "ENTREGA",
  "CONCLUIDO",
];

const COLUMN_HINTS: Partial<Record<SaleOpportunityStatus | SaleCaseStatus, string>> = {
  ATENDIMENTO: "Interesse registrado, sem proposta",
  EM_PROPOSTA: "Negociação em andamento",
  ACEITA: "Proposta aceita · segue no dossiê",
  PERDIDA: "Negociações encerradas",
  DILIGENCIA: "Análise documental",
  CONTRATACAO: "Assinatura do compromisso",
  CARTORIO: "Escritura, protocolo e registro",
  ENTREGA: "Entrega de chaves",
  CONCLUIDO: "Venda finalizada",
};

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function BoardColumn({
  title,
  hint,
  count,
  testId,
  emptyText,
  muted,
  children,
}: {
  title: string;
  hint?: string;
  count: number;
  testId: string;
  emptyText: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex min-w-0 flex-col rounded-xl bg-secondary/40 p-2.5",
        muted && "opacity-80",
      )}
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          {hint && (
            <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

const CARD_BUTTON_CLASS =
  "block w-full cursor-pointer rounded-lg border border-border bg-card p-3 text-left shadow-2xs transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SalesWorkspace() {
  const { fixture, resetDemo } = useSalesPocStore();

  const [activeBoardTab, setActiveBoardTab] =
    React.useState<string>("opportunities");
  const [selectedOpportunityId, setSelectedOpportunityId] = React.useState<
    string | null
  >(null);
  const [selectedCaseId, setSelectedCaseId] = React.useState<string | null>(
    null,
  );
  const [attendanceModalOpen, setAttendanceModalOpen] = React.useState(false);

  const [brokerFilter, setBrokerFilter] = React.useState<string>("ALL");
  const [modalityFilter, setModalityFilter] = React.useState<string>("ALL");
  const [showClosed, setShowClosed] = React.useState(false);
  const [resetCount, setResetCount] = React.useState(0);

  const handleConfirmReset = React.useCallback(() => {
    resetDemo();
    setSelectedOpportunityId(null);
    setSelectedCaseId(null);
    setBrokerFilter("ALL");
    setModalityFilter("ALL");
    setShowClosed(false);
    setResetCount((prev) => prev + 1);
  }, [resetDemo]);

  const handleOpenOpportunity = React.useCallback((opportunityId: string) => {
    setSelectedCaseId(null);
    setSelectedOpportunityId(opportunityId);
  }, []);

  const handleOpenCase = React.useCallback((caseId: string) => {
    setSelectedOpportunityId(null);
    setSelectedCaseId(caseId);
  }, []);

  const handleBackToBoard = React.useCallback(() => {
    setSelectedOpportunityId(null);
    setSelectedCaseId(null);
  }, []);

  const findLatestVersion = (offerId?: string) => {
    const offer = offerId
      ? fixture.offers.find((o) => o.id === offerId)
      : undefined;
    return offer?.versions[offer.versions.length - 1];
  };

  const activeCases = fixture.cases.filter((c) => c.status !== "CANCELADO");
  const pendingDecisionCount = fixture.opportunities.filter(
    (opp) =>
      opp.status === "EM_PROPOSTA" &&
      findLatestVersion(opp.offerId)?.status === "ENVIADA",
  ).length;
  const casesWithPendingCount = activeCases.filter((c) =>
    c.blocks.some((block) => block.active),
  ).length;

  const filteredOpportunities = fixture.opportunities.filter((opp) => {
    if (brokerFilter !== "ALL" && opp.brokerId !== brokerFilter) {
      return false;
    }
    if (modalityFilter !== "ALL") {
      const latestVersion = findLatestVersion(opp.offerId);
      const prop = fixture.properties.find((p) => p.id === opp.propertyId);
      const effectiveModality: PaymentModality | undefined =
        latestVersion?.paymentModality ?? prop?.preferredPaymentModality;
      if (effectiveModality !== modalityFilter) {
        return false;
      }
    }
    return true;
  });

  const filteredCases = fixture.cases.filter((saleCase) => {
    if (brokerFilter !== "ALL" && saleCase.brokerId !== brokerFilter) {
      return false;
    }
    if (
      modalityFilter !== "ALL" &&
      saleCase.checklistVariant !== modalityFilter
    ) {
      return false;
    }
    return true;
  });

  const filteredProperties = fixture.properties.filter((property) => {
    if (brokerFilter !== "ALL") {
      const hasOppForBroker = fixture.opportunities.some(
        (o) => o.propertyId === property.id && o.brokerId === brokerFilter,
      );
      if (property.brokerId !== brokerFilter && !hasOppForBroker) {
        return false;
      }
    }
    if (
      modalityFilter !== "ALL" &&
      property.preferredPaymentModality !== modalityFilter &&
      !(modalityFilter === "FINANCIADO" && property.acceptsFinancing)
    ) {
      return false;
    }
    return true;
  });

  const lostOpportunities = filteredOpportunities.filter(
    (opp) => opp.status === "PERDIDA",
  );
  const filteredActiveCases = filteredCases.filter(
    (c) => c.status !== "CANCELADO",
  );
  const cancelledCases = filteredCases.filter((c) => c.status === "CANCELADO");
  const openOpportunitiesCount =
    filteredOpportunities.length - lostOpportunities.length;

  const hasActiveFilters = brokerFilter !== "ALL" || modalityFilter !== "ALL";
  const closedCount =
    activeBoardTab === "cases"
      ? cancelledCases.length
      : lostOpportunities.length;

  const visibleOppColumns: SaleOpportunityStatus[] = showClosed
    ? [...OPPORTUNITY_COLUMNS, "PERDIDA"]
    : OPPORTUNITY_COLUMNS;

  return (
    <PageContainer size="wide" className="space-y-5">
      {/* Cabeçalho global do módulo */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {fixture.brokerage.name}
            </span>{" "}
            · {fixture.brokerage.creci}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Gestão de vendas
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {resetCount > 0 && (
            <Badge variant="teal" data-testid="reset-feedback-badge">
              Ambiente restaurado
            </Badge>
          )}
          <ResetDemoDialog onConfirmReset={handleConfirmReset} />
          <Button
            type="button"
            onClick={() => setAttendanceModalOpen(true)}
            data-testid="open-attendance-modal-btn"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova oportunidade
          </Button>
        </div>
      </header>

      {/* Sub-rotas client-side compatíveis com build estático: Detalhe da Oportunidade (Tela 2) ou Dossiê (Tela 4) */}
      {selectedOpportunityId ? (
        <OpportunityDetailPanel
          key={selectedOpportunityId}
          opportunityId={selectedOpportunityId}
          onBackToBoard={handleBackToBoard}
          onOpenCase={handleOpenCase}
        />
      ) : selectedCaseId ? (
        <SaleCaseDetailPanel
          key={selectedCaseId}
          caseId={selectedCaseId}
          onBackToBoard={handleBackToBoard}
          onOpenOpportunity={handleOpenOpportunity}
        />
      ) : (
        <>
          {/* Resumo da carteira + indicadores acionáveis */}
          <section
            aria-label="Resumo da carteira"
            data-testid="fixture-summary"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"
          >
            <span className="text-muted-foreground">
              <strong
                className="text-foreground"
                data-testid="summary-properties-count"
              >
                {fixture.properties.length}
              </strong>{" "}
              imóveis à venda
            </span>
            <span className="text-muted-foreground">
              <strong
                className="text-foreground"
                data-testid="summary-opportunities-count"
              >
                {fixture.opportunities.length}
              </strong>{" "}
              oportunidades
            </span>
            <span className="text-muted-foreground">
              <strong
                className="text-foreground"
                data-testid="summary-cases-count"
              >
                {activeCases.length}
              </strong>{" "}
              dossiês ativos
            </span>

            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />

            <button
              type="button"
              onClick={() => setActiveBoardTab("opportunities")}
              data-testid="summary-pending-decisions"
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium text-[var(--info-fg)] hover:bg-[var(--info-subtle)]"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {pendingDecisionCount} propostas aguardando decisão
            </button>
            <button
              type="button"
              onClick={() => setActiveBoardTab("cases")}
              data-testid="summary-cases-with-pending"
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium text-[var(--amber-fg)] hover:bg-[var(--amber-subtle)]"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {casesWithPendingCount} dossiês com pendência
            </button>
          </section>

          {/* Tela 1: Kanban de vendas (Oportunidades / Dossiês / Visão por imóvel) */}
          <Tabs
            value={activeBoardTab}
            onValueChange={setActiveBoardTab}
            className="w-full"
          >
            <div className="flex flex-col gap-3 border-b border-border lg:flex-row lg:items-end lg:justify-between">
              <TabsList
                aria-label="Visões do módulo de gestão de vendas"
                className="w-auto border-b-0"
              >
                <TabsTrigger
                  value="opportunities"
                  data-testid="board-tab-opportunities"
                >
                  <Kanban className="h-4 w-4" aria-hidden="true" />
                  Oportunidades ({openOpportunitiesCount})
                </TabsTrigger>
                <TabsTrigger value="cases" data-testid="board-tab-cases">
                  <FolderKanban className="h-4 w-4" aria-hidden="true" />
                  Dossiês ({filteredActiveCases.length})
                </TabsTrigger>
                <TabsTrigger
                  value="properties"
                  data-testid="board-tab-properties"
                >
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  Por imóvel ({filteredProperties.length})
                </TabsTrigger>
              </TabsList>

              {/* Filtros funcionais da operação */}
              <div
                role="group"
                aria-label="Filtros"
                data-testid="filters-section"
                className="flex flex-wrap items-center gap-2 pb-2"
              >
                <select
                  aria-label="Filtrar por corretor"
                  value={brokerFilter}
                  onChange={(e) => setBrokerFilter(e.target.value)}
                  data-testid="filter-broker-select"
                  className={SELECT_CLASS}
                >
                  <option value="ALL">Todos os corretores</option>
                  {fixture.brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por forma de pagamento"
                  value={modalityFilter}
                  onChange={(e) => setModalityFilter(e.target.value)}
                  data-testid="filter-modality-select"
                  className={SELECT_CLASS}
                >
                  <option value="ALL">À vista e financiado</option>
                  <option value="A_VISTA">À vista</option>
                  <option value="FINANCIADO">Financiado</option>
                </select>

                {activeBoardTab !== "properties" && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 px-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={showClosed}
                      onChange={(e) => setShowClosed(e.target.checked)}
                      data-testid="toggle-show-closed"
                      className="h-3.5 w-3.5 accent-[var(--color-primary-600)]"
                    />
                    Mostrar encerradas ({closedCount})
                  </label>
                )}

                {hasActiveFilters && (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setBrokerFilter("ALL");
                      setModalityFilter("ALL");
                    }}
                    data-testid="clear-filters-btn"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            {/* Aba 1: Kanban de Oportunidades */}
            <TabsContent
              value="opportunities"
              data-testid="opportunities-kanban-section"
              className="mt-4"
            >
              <div
                className={cn(
                  "grid gap-3 md:grid-cols-3",
                  showClosed && "xl:grid-cols-4",
                )}
              >
                {visibleOppColumns.map((columnStatus) => {
                  const items = filteredOpportunities.filter(
                    (opp) => opp.status === columnStatus,
                  );

                  return (
                    <BoardColumn
                      key={columnStatus}
                      testId={`opp-column-${columnStatus}`}
                      title={OPPORTUNITY_STATUS_LABELS[columnStatus]}
                      hint={COLUMN_HINTS[columnStatus]}
                      count={items.length}
                      emptyText="Nenhuma oportunidade"
                      muted={columnStatus === "PERDIDA"}
                    >
                      {items.map((opp) => {
                        const prop = fixture.properties.find(
                          (p) => p.id === opp.propertyId,
                        );
                        const buyer = fixture.buyers.find(
                          (b) => b.id === opp.buyerId,
                        );
                        const broker = fixture.brokers.find(
                          (b) => b.id === opp.brokerId,
                        );
                        const latestVersion = findLatestVersion(opp.offerId);
                        const linkedCase = opp.saleCaseId
                          ? fixture.cases.find((c) => c.id === opp.saleCaseId)
                          : undefined;

                        return (
                          <div
                            key={opp.id}
                            data-testid={`opp-card-${opp.id}`}
                            className="rounded-lg border border-border bg-card shadow-2xs transition-colors hover:border-primary/60"
                          >
                            <button
                              type="button"
                              data-testid={`open-opp-btn-${opp.id}`}
                              onClick={() => handleOpenOpportunity(opp.id)}
                              className="block w-full cursor-pointer p-3 pb-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <p className="line-clamp-2 text-sm font-semibold text-foreground">
                                {prop?.title ?? opp.propertyId}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {buyer?.name} · {broker?.name}
                              </p>

                              <div className="mt-2.5 flex items-center justify-between gap-2">
                                {opp.status === "PERDIDA" ? (
                                  <span className="line-clamp-2 text-xs text-[var(--error-fg)]">
                                    {opp.lossReason ?? "Negociação encerrada"}
                                  </span>
                                ) : latestVersion ? (
                                  <>
                                    <span className="text-sm font-bold text-foreground">
                                      {formatCurrencyBRL(latestVersion.amount)}
                                    </span>
                                    <Badge
                                      variant={getOfferStatusBadgeVariant(
                                        latestVersion.status,
                                      )}
                                      data-testid={
                                        latestVersion.status === "EXPIRADA"
                                          ? `expired-badge-${opp.id}`
                                          : undefined
                                      }
                                    >
                                      {latestVersion.status === "EXPIRADA" && (
                                        <Clock className="h-3 w-3" />
                                      )}
                                      {
                                        OFFER_VERSION_STATUS_LABELS[
                                          latestVersion.status
                                        ]
                                      }
                                    </Badge>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Sem proposta · pedido{" "}
                                    {prop
                                      ? formatCurrencyBRL(prop.askingPrice)
                                      : "—"}
                                  </span>
                                )}
                              </div>
                            </button>

                            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                              <span className="font-mono">{opp.code}</span>
                              {linkedCase ? (
                                <button
                                  type="button"
                                  data-testid={`card-open-linked-case-${opp.id}`}
                                  onClick={() => handleOpenCase(linkedCase.id)}
                                  className="inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 font-medium text-[var(--teal-fg)] hover:bg-[var(--teal-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  Dossiê em{" "}
                                  {SALE_CASE_STATUS_LABELS[linkedCase.status]}
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              ) : (
                                prop && (
                                  <span>
                                    {
                                      PROPERTY_COMMERCIAL_STATUS_LABELS[
                                        prop.commercialStatus
                                      ]
                                    }
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </BoardColumn>
                  );
                })}
              </div>
            </TabsContent>

            {/* Aba 2: Kanban de Dossiês pós-aceite */}
            <TabsContent
              value="cases"
              data-testid="cases-kanban-section"
              className="mt-4 space-y-4"
            >
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                {CASE_COLUMNS.map((caseStatus) => {
                  const items = filteredActiveCases.filter(
                    (saleCase) => saleCase.status === caseStatus,
                  );

                  return (
                    <BoardColumn
                      key={caseStatus}
                      testId={`case-column-${caseStatus}`}
                      title={SALE_CASE_STATUS_LABELS[caseStatus]}
                      hint={COLUMN_HINTS[caseStatus]}
                      count={items.length}
                      emptyText="Nenhum dossiê"
                    >
                      {items.map((saleCase) => {
                        const prop = fixture.properties.find(
                          (p) => p.id === saleCase.propertyId,
                        );
                        const buyer = fixture.buyers.find(
                          (b) => b.id === saleCase.buyerId,
                        );
                        const openBlocks = saleCase.blocks.filter(
                          (b) => b.active,
                        );

                        return (
                          <div
                            key={saleCase.id}
                            data-testid={`case-card-${saleCase.id}`}
                          >
                            <button
                              type="button"
                              data-testid={`open-case-btn-${saleCase.id}`}
                              onClick={() => handleOpenCase(saleCase.id)}
                              className={CARD_BUTTON_CLASS}
                            >
                              <p className="line-clamp-2 text-sm font-semibold text-foreground">
                                {prop?.title ?? saleCase.propertyId}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {buyer?.name} ·{" "}
                                {
                                  PAYMENT_MODALITY_LABELS[
                                    saleCase.checklistVariant
                                  ]
                                }
                              </p>

                              {/* Pendências (bloqueios transversais §4.3) */}
                              {openBlocks.map((blk) => (
                                <p
                                  key={blk.id}
                                  data-testid={`card-block-badge-${saleCase.id}-${blk.type}`}
                                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--amber-fg)]"
                                >
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  {TRANSVERSAL_BLOCK_LABELS[blk.type]}
                                </p>
                              ))}

                              {saleCase.legalNotice && (
                                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                                  {saleCase.legalNotice}
                                </p>
                              )}

                              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                                <span className="font-mono">
                                  {saleCase.code}
                                </span>
                                {prop && (
                                  <span>
                                    Imóvel{" "}
                                    {PROPERTY_COMMERCIAL_STATUS_LABELS[
                                      prop.commercialStatus
                                    ].toLowerCase()}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </BoardColumn>
                  );
                })}
              </div>

              {/* Dossiês cancelados (encerrados antes do registro) */}
              {showClosed && cancelledCases.length > 0 && (
                <section
                  data-testid="cancelled-cases-section"
                  className="space-y-2"
                >
                  <h2 className="text-sm font-semibold">
                    Dossiês cancelados ({cancelledCases.length})
                  </h2>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {cancelledCases.map((saleCase) => {
                      const prop = fixture.properties.find(
                        (p) => p.id === saleCase.propertyId,
                      );
                      return (
                        <button
                          type="button"
                          key={saleCase.id}
                          data-testid={`cancelled-case-card-${saleCase.id}`}
                          onClick={() => handleOpenCase(saleCase.id)}
                          className={cn(CARD_BUTTON_CLASS, "bg-secondary/20")}
                        >
                          <p className="text-sm font-semibold">
                            {prop?.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {saleCase.cancellationReason}
                          </p>
                          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                            {saleCase.code}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </TabsContent>

            {/* Aba 3: Visão Alternativa por Imóvel (concorrência + status §4.4) */}
            <TabsContent
              value="properties"
              data-testid="property-view-section"
              className="mt-4"
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredProperties.map((property) => {
                  const relatedOpps = fixture.opportunities.filter(
                    (opp) => opp.propertyId === property.id,
                  );
                  const activeCase = fixture.cases.find(
                    (c) =>
                      c.propertyId === property.id && c.status !== "CANCELADO",
                  );

                  return (
                    <div
                      key={property.id}
                      data-testid={`property-card-${property.id}`}
                      className="space-y-3 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold">{property.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {PROPERTY_TYPE_LABELS[property.type]} ·{" "}
                            {property.neighborhood} ·{" "}
                            <span className="font-semibold text-foreground">
                              {formatCurrencyBRL(property.askingPrice)}
                            </span>
                          </p>
                        </div>
                        <Badge
                          variant={getPropertyBadgeVariant(
                            property.commercialStatus,
                          )}
                          dot
                          data-testid={`property-status-badge-${property.id}`}
                        >
                          {
                            PROPERTY_COMMERCIAL_STATUS_LABELS[
                              property.commercialStatus
                            ]
                          }
                        </Badge>
                      </div>

                      <p
                        className="text-xs text-muted-foreground"
                        data-testid={`property-listing-status-${property.id}`}
                      >
                        {PROPERTY_LISTING_STATUS_LABELS[property.listingStatus]}
                      </p>

                      {/* Lista de oportunidades concorrentes no imóvel */}
                      <div className="space-y-1.5 border-t border-border pt-2.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>
                            Oportunidades no imóvel ({relatedOpps.length})
                          </span>
                          {activeCase && (
                            <Button
                              type="button"
                              size="xs"
                              variant="link"
                              className="h-auto px-0"
                              onClick={() => handleOpenCase(activeCase.id)}
                              data-testid={`property-open-case-${property.id}`}
                            >
                              Ver dossiê
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>

                        {relatedOpps.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Sem oportunidades registradas.
                          </p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {relatedOpps.map((opp) => {
                              const buyer = fixture.buyers.find(
                                (b) => b.id === opp.buyerId,
                              );
                              return (
                                <li key={opp.id}>
                                  <button
                                    type="button"
                                    data-testid={`property-open-opp-${opp.id}`}
                                    onClick={() =>
                                      handleOpenOpportunity(opp.id)
                                    }
                                    className="flex w-full items-center justify-between gap-2 rounded px-1 py-1.5 text-left text-xs hover:bg-secondary/50"
                                  >
                                    <span className="truncate">
                                      {buyer?.name}
                                    </span>
                                    <span className="shrink-0 text-muted-foreground">
                                      {OPPORTUNITY_STATUS_LABELS[opp.status]}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <AttendanceModal
        open={attendanceModalOpen}
        onClose={() => setAttendanceModalOpen(false)}
        onOpportunitySelected={handleOpenOpportunity}
      />
    </PageContainer>
  );
}
