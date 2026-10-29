"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock,
  FileWarning,
  Flag,
  Lock,
  Plus,
  RotateCcw,
  ShieldAlert,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ActionDialog } from "@/features/sales-poc/components/action-dialog";
import {
  getPropertyBadgeVariant,
  INPUT_CLASS,
} from "@/features/sales-poc/components/ui-helpers";
import {
  advanceCaseToContratacao,
  cancelSaleCase,
  completeSaleMilestone,
  getActiveBlocks,
  getNextPendingMilestone,
  isChecklistResolved,
  NON_TRANSFER_LEGAL_NOTICE,
  REGISTERED_LEGAL_NOTICE,
  registerTransversalBlock,
  resolveTransversalBlock,
  updateChecklistItem,
} from "@/features/sales-poc/domain/state-machine";
import type {
  ChecklistItem,
  SaleMilestoneCode,
  TransversalBlockType,
} from "@/features/sales-poc/domain/types";
import { useSalesPocStore } from "@/features/sales-poc/store/sales-poc-store";
import {
  CHECKLIST_STATUS_LABELS,
  formatCurrencyBRL,
  formatDateTime,
  PAYMENT_MODALITY_LABELS,
  PROPERTY_COMMERCIAL_STATUS_LABELS,
  PROPERTY_LISTING_STATUS_LABELS,
  SALE_CASE_STATUS_LABELS,
  TIMELINE_EVENT_TYPE_LABELS,
  TRANSVERSAL_BLOCK_LABELS,
} from "@/features/sales-poc/utils/formatters";

export interface SaleCaseDetailPanelProps {
  caseId: string;
  onBackToBoard: () => void;
  onOpenOpportunity: (opportunityId: string) => void;
}

const CHECKLIST_CATEGORY_LABELS: Record<ChecklistItem["category"], string> = {
  IMOVEL: "Imóvel",
  VENDEDOR: "Vendedor",
  COMPRADOR: "Comprador",
  FINANCIAMENTO: "Financiamento",
};

export function SaleCaseDetailPanel({
  caseId,
  onBackToBoard,
  onOpenOpportunity,
}: SaleCaseDetailPanelProps) {
  const { fixture, dispatchDomainAction } = useSalesPocStore();

  const initialCase = fixture.cases.find((c) => c.id === caseId);
  const [activeTab, setActiveTab] = React.useState<string>(() =>
    initialCase && initialCase.status !== "DILIGENCIA"
      ? "milestones"
      : "checklist",
  );

  const [inertEditNoticeVisible, setInertEditNoticeVisible] =
    React.useState(false);

  const [waivingItem, setWaivingItem] = React.useState<ChecklistItem | null>(
    null,
  );
  const [waiverJustification, setWaiverJustification] = React.useState("");
  const [waiverError, setWaiverError] = React.useState<string | null>(null);

  const [newBlockDialogOpen, setNewBlockDialogOpen] = React.useState(false);
  const [newBlockType, setNewBlockType] = React.useState<TransversalBlockType>(
    "AGUARDANDO_FINANCIAMENTO",
  );
  const [newBlockTitle, setNewBlockTitle] = React.useState("");
  const [newBlockDesc, setNewBlockDesc] = React.useState("");
  const [newBlockError, setNewBlockError] = React.useState<string | null>(null);

  const [resolvingBlockId, setResolvingBlockId] = React.useState<string | null>(
    null,
  );
  const [resolutionNotes, setResolutionNotes] = React.useState<
    Record<string, string>
  >({});

  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const [feedback, setFeedback] = React.useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);

  const saleCase = fixture.cases.find((c) => c.id === caseId);
  if (!saleCase) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Dossiê não encontrado no cadastro atual.
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
    (p) => p.id === saleCase.propertyId,
  )!;
  const buyer = fixture.buyers.find((b) => b.id === saleCase.buyerId)!;
  const opportunity = fixture.opportunities.find(
    (o) => o.id === saleCase.opportunityId,
  )!;
  const offer = opportunity.offerId
    ? fixture.offers.find((o) => o.id === opportunity.offerId)
    : undefined;
  const acceptedVersion = offer?.versions.find(
    (v) => v.id === saleCase.acceptedOfferVersionId,
  );

  const activeBlocks = getActiveBlocks(saleCase);
  const resolvedBlocks = saleCase.blocks.filter((b) => !b.active);
  const checklistReady = isChecklistResolved(saleCase);
  const nextMilestone = getNextPendingMilestone(saleCase);

  const resolvedChecklistCount = saleCase.checklist.filter(
    (i) => i.status === "ACEITO" || i.status === "DISPENSADO",
  ).length;
  const completedMilestonesCount = saleCase.milestones.filter(
    (m) => m.status === "CONCLUIDO",
  ).length;

  const isCommitmentDone = saleCase.milestones.some(
    (m) => m.code === "COMPROMISSO_ASSINADO" && m.status === "CONCLUIDO",
  );
  const isTitleRegistered = saleCase.milestones.some(
    (m) => m.code === "TITULO_REGISTRADO" && m.status === "CONCLUIDO",
  );
  const isTerminal =
    saleCase.status === "CONCLUIDO" || saleCase.status === "CANCELADO";

  const hasAnyDialogOpen =
    Boolean(waivingItem) || newBlockDialogOpen || cancelDialogOpen;

  function handleChecklistAction(
    itemId: string,
    status: "PENDENTE" | "ACEITO" | "REPROVADO" | "DISPENSADO",
    justification?: string,
  ) {
    setFeedback(null);
    const result = dispatchDomainAction((state) =>
      updateChecklistItem(state, {
        caseId: saleCase!.id,
        itemId,
        status,
        waiverJustification: justification,
      }),
    );

    if (!result.ok) {
      if (status === "DISPENSADO") {
        setWaiverError(result.message);
      } else {
        setFeedback({ kind: "error", message: result.message });
      }
      return;
    }

    if (status === "DISPENSADO") {
      setWaivingItem(null);
      setWaiverJustification("");
      setWaiverError(null);
    }
  }

  function handleAdvanceToContratacao() {
    setFeedback(null);
    const result = dispatchDomainAction((state) =>
      advanceCaseToContratacao(state, { caseId: saleCase!.id }),
    );
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }
    setActiveTab("milestones");
    setFeedback({
      kind: "success",
      message: "Diligência concluída. Dossiê liberado para Contratação.",
    });
  }

  function handleConfirmNewBlock() {
    setNewBlockError(null);

    const result = dispatchDomainAction((state) =>
      registerTransversalBlock(state, {
        caseId: saleCase!.id,
        type: newBlockType,
        title: newBlockTitle,
        description: newBlockDesc,
      }),
    );

    if (!result.ok) {
      setNewBlockError(result.message);
      return;
    }

    setNewBlockDialogOpen(false);
    setNewBlockTitle("");
    setNewBlockDesc("");
    setFeedback({
      kind: "success",
      message:
        "Pendência registrada. O avanço fica suspenso até a regularização.",
    });
  }

  function handleResolveBlock(blockId: string) {
    setFeedback(null);
    const note = resolutionNotes[blockId] ?? "";
    const result = dispatchDomainAction((state) =>
      resolveTransversalBlock(state, {
        caseId: saleCase!.id,
        blockId,
        resolutionNote: note,
      }),
    );

    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }

    setResolutionNotes((prev) => ({ ...prev, [blockId]: "" }));
    setResolvingBlockId(null);
    setFeedback({
      kind: "success",
      message: "Pendência resolvida.",
    });
  }

  function handleCompleteMilestone(milestoneCode: SaleMilestoneCode) {
    setFeedback(null);
    const result = dispatchDomainAction((state) =>
      completeSaleMilestone(state, {
        caseId: saleCase!.id,
        milestoneCode,
      }),
    );

    if (!result.ok) {
      setFeedback({ kind: "error", message: result.message });
      return;
    }

    setFeedback({
      kind: "success",
      message:
        milestoneCode === "TITULO_REGISTRADO"
          ? `${REGISTERED_LEGAL_NOTICE}: imóvel atualizado para Vendido.`
          : milestoneCode === "COMPROMISSO_ASSINADO"
            ? `${NON_TRANSFER_LEGAL_NOTICE}. Imóvel atualizado para Sob contrato.`
            : "Etapa registrada.",
    });
  }

  function handleConfirmCancelCase() {
    setCancelError(null);

    const result = dispatchDomainAction((state) =>
      cancelSaleCase(state, {
        caseId: saleCase!.id,
        cancellationReason: cancelReason,
      }),
    );

    if (!result.ok) {
      setCancelError(result.message);
      return;
    }

    setCancelDialogOpen(false);
    setCancelReason("");
    setFeedback({
      kind: "success",
      message:
        "Dossiê cancelado. O imóvel voltou para Disponível com anúncio publicado.",
    });
  }

  const steps = [
    {
      key: "DILIGENCIA",
      shortLabel: "Diligência",
      done: saleCase.status !== "DILIGENCIA" && saleCase.status !== "CANCELADO",
      current: saleCase.status === "DILIGENCIA",
    },
    ...saleCase.milestones.map((ms) => ({
      key: ms.code,
      shortLabel:
        ms.code === "COMPROMISSO_ASSINADO"
          ? "Compromisso"
          : ms.code === "ESCRITURA_LAVRADA"
            ? "Escritura"
            : ms.code === "TITULO_PROTOCOLADO"
              ? "Protocolo"
              : ms.code === "TITULO_REGISTRADO"
                ? REGISTERED_LEGAL_NOTICE
                : "Entrega de chaves",
      done: ms.status === "CONCLUIDO",
      current:
        !isTerminal &&
        saleCase.status !== "DILIGENCIA" &&
        nextMilestone?.code === ms.code,
    })),
  ];

  return (
    <div data-testid="sale-case-detail-panel" className="space-y-5">
      {/* Breadcrumb + cabeçalho contextual único */}
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
              data-testid="back-to-board-from-case-btn"
              className="-ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Gestão de vendas
            </Button>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            <span>{saleCase.code}</span>
            <Badge
              variant={
                saleCase.status === "CONCLUIDO"
                  ? "success"
                  : saleCase.status === "CANCELADO"
                    ? "error"
                    : "info"
              }
              dot
              data-testid="case-stage-badge"
            >
              {SALE_CASE_STATUS_LABELS[saleCase.status]}
            </Badge>
          </nav>

          <h1 className="text-xl font-bold tracking-tight">{property.title}</h1>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{buyer.name}</span>
            <span aria-hidden="true">·</span>
            <span>{PAYMENT_MODALITY_LABELS[saleCase.checklistVariant]}</span>
            {acceptedVersion && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCurrencyBRL(acceptedVersion.amount)}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <Badge
              variant={getPropertyBadgeVariant(property.commercialStatus)}
              dot
              data-testid="case-property-status-badge"
            >
              {PROPERTY_COMMERCIAL_STATUS_LABELS[property.commercialStatus]}
            </Badge>
            <span data-testid="case-property-listing-badge">
              {PROPERTY_LISTING_STATUS_LABELS[property.listingStatus]}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onOpenOpportunity(opportunity.id)}
            data-testid="open-origin-opportunity-btn"
            className="text-muted-foreground hover:text-foreground"
          >
            Ver proposta ({opportunity.code})
          </Button>

          {!isTerminal && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => {
                setFeedback(null);
                setNewBlockError(null);
                setNewBlockDialogOpen(true);
              }}
              data-testid="toggle-new-block-form-btn"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Registrar pendência
            </Button>
          )}

          {!isTerminal && !isTitleRegistered && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setFeedback(null);
                setCancelReason("");
                setCancelError(null);
                setCancelDialogOpen(true);
              }}
              data-testid="toggle-cancel-case-btn"
              className="text-muted-foreground hover:text-[var(--error-fg)]"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Cancelar dossiê
            </Button>
          )}
        </div>
      </div>

      {/* Feedback de ações de domínio */}
      {feedback && !hasAnyDialogOpen && (
        <div
          role="alert"
          data-testid="case-domain-alert"
          className={
            feedback.kind === "error"
              ? "flex items-start gap-2.5 rounded-xl border border-[var(--color-error-200)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-fg)]"
              : "flex items-start gap-2.5 rounded-xl border border-[var(--color-success-200)] bg-[var(--success-subtle)] px-4 py-3 text-sm font-medium text-[var(--success-fg)]"
          }
        >
          {feedback.kind === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <div>{feedback.message}</div>
        </div>
      )}

      {/* Trilha linear limpa (sem 6 caixas) + aviso jurídico contextual */}
      <Card data-testid="case-progress-bar">
        <CardContent className="space-y-3 p-4">
          <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
            {steps.map((step, idx) => (
              <li
                key={step.key}
                className="flex items-center gap-2 text-xs lg:flex-col lg:items-start lg:gap-1.5"
              >
                <div className="flex items-center gap-2 lg:w-full">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                      step.done && "bg-[var(--success-fg)] text-white",
                      step.current && "bg-primary text-primary-foreground",
                      !step.done &&
                        !step.current &&
                        "border border-border bg-secondary/60 text-muted-foreground",
                    )}
                  >
                    {step.done ? (
                      <Check className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  {idx < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "hidden h-px flex-1 lg:block",
                        step.done ? "bg-[var(--success-fg)]/50" : "bg-border",
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "leading-snug",
                    step.done && "font-medium text-[var(--success-fg)]",
                    step.current && "font-semibold text-foreground",
                    !step.done && !step.current && "text-muted-foreground",
                  )}
                >
                  {step.shortLabel}
                </span>
              </li>
            ))}
          </ol>

          {/* Legenda jurídica integrada (§4.5 / AC9) */}
          <div
            data-testid="case-legal-banner"
            className={cn(
              "flex items-center gap-2 text-xs",
              saleCase.status === "CANCELADO"
                ? "rounded-lg bg-[var(--error-subtle)] px-3 py-2 text-[var(--error-fg)]"
                : isTitleRegistered
                  ? "rounded-lg bg-[var(--success-subtle)] px-3 py-2 text-[var(--success-fg)]"
                  : isCommitmentDone
                    ? "rounded-lg bg-[var(--amber-subtle)] px-3 py-2 text-[var(--amber-fg)]"
                    : "border-t border-border/70 pt-2.5 text-muted-foreground",
            )}
          >
            {isTitleRegistered ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <p>
              {saleCase.status === "CANCELADO" ? (
                <>
                  <strong className="font-semibold">Dossiê cancelado</strong> —
                  imóvel voltou para Disponível. Motivo:{" "}
                  {saleCase.cancellationReason}
                </>
              ) : isTitleRegistered ? (
                <>
                  <strong className="font-semibold">
                    {REGISTERED_LEGAL_NOTICE}
                  </strong>{" "}
                  — matrícula {property.registrationCode} atualizada; imóvel
                  Vendido.
                </>
              ) : isCommitmentDone ? (
                <>
                  <strong className="font-semibold">
                    {NON_TRANSFER_LEGAL_NOTICE}
                  </strong>{" "}
                  — a titularidade só muda após o registro na matrícula{" "}
                  {property.registrationCode}.
                </>
              ) : (
                <>
                  Imóvel reservado — a propriedade ainda não foi transferida.
                </>
              )}
            </p>
          </div>

          {/* Pendências ativas: faixa compacta com formulário sob demanda */}
          {activeBlocks.length > 0 && (
            <div
              data-testid="transversal-blocks-panel"
              className="space-y-2 border-t border-border/70 pt-3"
            >
              {activeBlocks.map((block) => {
                const isResolving = resolvingBlockId === block.id;

                return (
                  <div
                    key={block.id}
                    data-testid={`block-card-${block.type}-active`}
                    className="rounded-lg border border-[var(--color-amber-400)]/70 bg-[var(--amber-subtle)]/55 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 sm:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <AlertTriangle
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--amber-fg)]"
                          aria-hidden="true"
                        />
                        <p className="min-w-0">
                          <span className="font-semibold text-foreground">
                            {block.title}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {TRANSVERSAL_BLOCK_LABELS[block.type]} —{" "}
                            {block.description}
                          </span>
                        </p>
                      </div>

                      {!isTerminal && !isResolving && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setFeedback(null);
                            setResolvingBlockId(block.id);
                          }}
                          data-testid={`open-resolve-block-${block.id}`}
                        >
                          Resolver
                        </Button>
                      )}
                    </div>

                    {!isTerminal && isResolving && (
                      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={resolutionNotes[block.id] ?? ""}
                          onChange={(e) =>
                            setResolutionNotes((prev) => ({
                              ...prev,
                              [block.id]: e.target.value,
                            }))
                          }
                          placeholder="Descreva a regularização para liberar o avanço..."
                          data-testid={`resolve-block-input-${block.id}`}
                          className="h-8 flex-1 rounded-md border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="xs"
                            onClick={() => handleResolveBlock(block.id)}
                            data-testid={`resolve-block-btn-${block.id}`}
                          >
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Confirmar
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => setResolvingBlockId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Abas do Dossiê: Checklist, Marcos, Histórico (§7 tela 4) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="checklist" data-testid="case-tab-checklist">
            <ClipboardCheck
              className="hidden h-4 w-4 sm:block"
              aria-hidden="true"
            />
            <span className="tabular-nums">
              Checklist ({resolvedChecklistCount}/{saleCase.checklist.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="milestones" data-testid="case-tab-milestones">
            <Flag className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            <span className="tabular-nums">
              Marcos ({completedMilestonesCount}/{saleCase.milestones.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="case-tab-timeline">
            <Clock className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            <span className="tabular-nums">
              Histórico ({saleCase.timeline.length})
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Documentos da venda ·{" "}
                  <span className="font-normal text-muted-foreground">
                    {PAYMENT_MODALITY_LABELS[saleCase.checklistVariant]}
                  </span>
                </CardTitle>

                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setInertEditNoticeVisible((prev) => !prev)}
                  data-testid="inert-edit-checklist-btn"
                  className="text-muted-foreground"
                >
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Editar checklist
                </Button>
              </div>

              {inertEditNoticeVisible && (
                <div
                  data-testid="inert-edit-checklist-notice"
                  className="mt-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground"
                >
                  O checklist segue o padrão da imobiliária para vendas à vista
                  e financiadas e não é editável individualmente nesta tela.
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="divide-y divide-border/80 rounded-xl border border-border">
                {saleCase.checklist.map((item) => {
                  const canEditItem =
                    !isTerminal && saleCase.status === "DILIGENCIA";
                  const isPending = item.status === "PENDENTE";
                  const isAcceptedOrWaived =
                    item.status === "ACEITO" || item.status === "DISPENSADO";

                  return (
                    <div
                      key={item.id}
                      data-testid={`checklist-item-${item.code}`}
                      className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        {isAcceptedOrWaived ? (
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success-fg)]"
                            aria-hidden="true"
                          />
                        ) : item.status === "REPROVADO" ? (
                          <XCircle
                            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--error-fg)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <Circle
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60"
                            aria-hidden="true"
                          />
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground">
                              {item.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              · {CHECKLIST_CATEGORY_LABELS[item.category]}
                            </span>
                          </div>
                          {item.waiverJustification && (
                            <p className="text-xs text-muted-foreground">
                              Dispensa: {item.waiverJustification}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-6 sm:pl-0">
                        {isPending ? (
                          <span
                            data-testid={`checklist-status-${item.code}`}
                            className="sr-only"
                          >
                            {CHECKLIST_STATUS_LABELS[item.status]}
                          </span>
                        ) : (
                          <Badge
                            variant={
                              item.status === "ACEITO"
                                ? "success"
                                : item.status === "DISPENSADO"
                                  ? "secondary"
                                  : "error"
                            }
                            data-testid={`checklist-status-${item.code}`}
                          >
                            {CHECKLIST_STATUS_LABELS[item.status]}
                          </Badge>
                        )}

                        {canEditItem && isPending && (
                          <>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() =>
                                handleChecklistAction(item.id, "ACEITO")
                              }
                              data-testid={`accept-checklist-btn-${item.code}`}
                            >
                              Aceitar
                            </Button>

                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                setFeedback(null);
                                setWaiverJustification("");
                                setWaiverError(null);
                                setWaivingItem(item);
                              }}
                              data-testid={`waive-checklist-toggle-${item.code}`}
                              className="text-muted-foreground"
                            >
                              Dispensar
                            </Button>

                            <IconButton
                              tooltip="Reprovar documento"
                              onClick={() =>
                                handleChecklistAction(item.id, "REPROVADO")
                              }
                              data-testid={`reprove-checklist-btn-${item.code}`}
                              className="hover:text-[var(--error-fg)]"
                            >
                              <FileWarning className="h-3.5 w-3.5" />
                            </IconButton>
                          </>
                        )}

                        {canEditItem && !isPending && (
                          <IconButton
                            tooltip="Desfazer conferência"
                            onClick={() =>
                              handleChecklistAction(item.id, "PENDENTE")
                            }
                            data-testid={`reset-checklist-btn-${item.code}`}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </IconButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {saleCase.status === "DILIGENCIA" && !isTerminal && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {checklistReady && activeBlocks.length === 0
                      ? "Documentação conferida e sem pendências."
                      : "Aceite ou dispense os itens pendentes para liberar a contratação."}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAdvanceToContratacao}
                    data-testid="advance-to-contratacao-btn"
                  >
                    Concluir diligência e ir para Contratação
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Marcos de contratação, cartório e entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {saleCase.status === "DILIGENCIA" && !isTerminal && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3.5 py-2.5 text-xs">
                  <span className="text-muted-foreground">
                    Conclua primeiro a etapa de{" "}
                    <strong className="text-foreground">Diligência</strong> para
                    liberar a assinatura do compromisso.
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => setActiveTab("checklist")}
                  >
                    Ir para o Checklist
                  </Button>
                </div>
              )}

              <div className="divide-y divide-border/80 rounded-xl border border-border">
                {saleCase.milestones.map((ms, index) => {
                  const isDone = ms.status === "CONCLUIDO";
                  const isNext =
                    !isTerminal &&
                    saleCase.status !== "DILIGENCIA" &&
                    nextMilestone?.code === ms.code;
                  const displayLabel =
                    ms.code === "TITULO_REGISTRADO"
                      ? `${REGISTERED_LEGAL_NOTICE} — matrícula atualizada`
                      : ms.label;

                  return (
                    <div
                      key={ms.id}
                      data-testid={`milestone-card-${ms.code}`}
                      className={cn(
                        "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between",
                        isNext && "bg-[var(--accent-subtle)]/20",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                            isDone && "bg-[var(--success-fg)] text-white",
                            isNext && "bg-primary text-primary-foreground",
                            !isDone &&
                              !isNext &&
                              "border border-border bg-secondary/50 text-muted-foreground",
                          )}
                        >
                          {isDone ? <Check className="h-3 w-3" /> : index + 1}
                        </span>
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "text-sm font-medium",
                                !isDone && !isNext
                                  ? "text-muted-foreground"
                                  : "text-foreground",
                              )}
                            >
                              {displayLabel}
                            </span>
                            {isDone && (
                              <Badge variant="success">Concluído</Badge>
                            )}
                          </div>
                          {ms.completedAt && (
                            <p className="text-xs text-muted-foreground">
                              Registrado em {formatDateTime(ms.completedAt)}
                            </p>
                          )}
                          {ms.notes && (
                            <p className="text-xs text-muted-foreground">
                              {ms.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {isNext && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleCompleteMilestone(ms.code)}
                          data-testid={`complete-milestone-btn-${ms.code}`}
                        >
                          Registrar conclusão
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Histórico do dossiê ({saleCase.timeline.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {resolvedBlocks.length > 0 && (
                <div className="space-y-1.5 rounded-lg bg-secondary/30 p-3 text-xs">
                  <p className="font-semibold text-foreground">
                    Pendências regularizadas ({resolvedBlocks.length})
                  </p>
                  {resolvedBlocks.map((block) => (
                    <p
                      key={block.id}
                      data-testid={`block-card-${block.type}-resolved`}
                      className="text-muted-foreground"
                    >
                      <strong className="text-foreground">{block.title}:</strong>{" "}
                      {block.resolutionNote}
                    </p>
                  ))}
                </div>
              )}

              <ol className="space-y-2 border-l border-border pl-3.5 text-xs">
                {[...saleCase.timeline].reverse().map((event) => (
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo: Dispensar documento com justificativa */}
      <ActionDialog
        open={Boolean(waivingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setWaivingItem(null);
            setWaiverError(null);
          }
        }}
        title="Dispensar documento do checklist"
        description={
          waivingItem
            ? `Informe a justificativa para dispensar "${waivingItem.label}".`
            : undefined
        }
        confirmLabel="Confirmar dispensa"
        confirmTestId={
          waivingItem
            ? `confirm-waive-checklist-btn-${waivingItem.code}`
            : "confirm-waive-checklist-btn"
        }
        error={waiverError}
        errorTestId="case-domain-alert"
        onConfirm={() => {
          if (waivingItem) {
            handleChecklistAction(
              waivingItem.id,
              "DISPENSADO",
              waiverJustification,
            );
          }
        }}
      >
        <label className="space-y-1 text-xs font-medium">
          <span>Justificativa obrigatória</span>
          <input
            type="text"
            value={waiverJustification}
            onChange={(e) => setWaiverJustification(e.target.value)}
            placeholder="Ex.: Carta de crédito pré-aprovada anexada para contratação."
            data-testid={
              waivingItem
                ? `waive-justification-input-${waivingItem.code}`
                : "waive-justification-input"
            }
            className={INPUT_CLASS}
            autoFocus
          />
        </label>
      </ActionDialog>

      {/* Diálogo: Registrar pendência */}
      <ActionDialog
        open={newBlockDialogOpen}
        onOpenChange={(open) => {
          setNewBlockDialogOpen(open);
          if (!open) setNewBlockError(null);
        }}
        title="Registrar pendência no dossiê"
        description="A pendência sinaliza o card no Kanban e suspende o avanço até ser resolvida."
        confirmLabel="Registrar pendência"
        confirmTestId="submit-new-block-btn"
        error={newBlockError}
        errorTestId="case-domain-alert"
        onConfirm={handleConfirmNewBlock}
      >
        <label className="space-y-1 text-xs font-medium">
          <span>Categoria</span>
          <select
            value={newBlockType}
            onChange={(e) =>
              setNewBlockType(e.target.value as TransversalBlockType)
            }
            data-testid="new-block-type-select"
            className={INPUT_CLASS}
          >
            <option value="AGUARDANDO_FINANCIAMENTO">
              Aguardando financiamento
            </option>
            <option value="EXIGENCIA_CARTORIAL">Exigência cartorial</option>
            <option value="PENDENTE_INFORMACAO">Pendente de informação</option>
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium">
          <span>Título resumido</span>
          <input
            type="text"
            value={newBlockTitle}
            onChange={(e) => setNewBlockTitle(e.target.value)}
            placeholder="Ex.: Nota devolutiva do 4º Oficial de Registro de Imóveis"
            data-testid="new-block-title-input"
            className={INPUT_CLASS}
          />
        </label>

        <label className="space-y-1 text-xs font-medium">
          <span>O que precisa ser regularizado</span>
          <input
            type="text"
            value={newBlockDesc}
            onChange={(e) => setNewBlockDesc(e.target.value)}
            placeholder="Descreva a exigência ou documento aguardado..."
            data-testid="new-block-desc-input"
            className={INPUT_CLASS}
          />
        </label>
      </ActionDialog>

      {/* Diálogo: Cancelar dossiê */}
      <ActionDialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          setCancelDialogOpen(open);
          if (!open) setCancelError(null);
        }}
        title="Cancelar dossiê de venda"
        description="O imóvel voltará automaticamente para Disponível com anúncio republicado."
        confirmLabel="Confirmar cancelamento"
        confirmTestId="confirm-cancel-case-btn"
        destructive
        error={cancelError}
        errorTestId="case-domain-alert"
        onConfirm={handleConfirmCancelCase}
      >
        <label className="space-y-1 text-xs font-medium">
          <span>Motivo obrigatório</span>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ex.: Certidão positiva impeditiva identificada na diligência."
            data-testid="cancel-case-reason-input"
            className={INPUT_CLASS}
            autoFocus
          />
        </label>
      </ActionDialog>
    </div>
  );
}
