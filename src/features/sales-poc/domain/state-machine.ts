import type {
  ChecklistItem,
  ChecklistItemStatus,
  PaymentModality,
  PropertyCommercialStatus,
  PropertyListingStatus,
  SaleCase,
  SaleMilestone,
  SaleMilestoneCode,
  SaleOffer,
  SaleOfferAuthorRole,
  SaleOfferVersion,
  SaleOpportunity,
  SalesPocFixture,
  TransversalBlock,
  TransversalBlockType,
} from "./types.ts";

export const NON_TRANSFER_LEGAL_NOTICE =
  "Compromisso assinado — a propriedade ainda não foi transferida";

export const REGISTERED_LEGAL_NOTICE = "Propriedade transferida (registro)";

export const ORDERED_MILESTONE_CODES: readonly SaleMilestoneCode[] = [
  "COMPROMISSO_ASSINADO",
  "ESCRITURA_LAVRADA",
  "TITULO_PROTOCOLADO",
  "TITULO_REGISTRADO",
  "CHAVES_ENTREGUES",
] as const;

export type DomainResult =
  | {
      ok: true;
      next: SalesPocFixture;
      createdOpportunityId?: string;
      createdCaseId?: string;
      createdOfferVersionId?: string;
    }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "VALIDATION_ERROR"
        | "INVALID_TRANSITION"
        | "PROPERTY_ALREADY_RESERVED"
        | "OFFER_IMMUTABLE"
        | "ACTIVE_BLOCK"
        | "CHECKLIST_UNRESOLVED";
      message: string;
    };

function nowIso(customTimestamp?: string): string {
  return customTimestamp ?? new Date().toISOString();
}

function nextSequentialCode(existingCodes: string[], prefix: string): string {
  let maxNumber = 0;
  for (const code of existingCodes) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(code);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (parsed > maxNumber) {
        maxNumber = parsed;
      }
    }
  }
  const nextNumber = String(maxNumber + 1).padStart(2, "0");
  return `${prefix}${nextNumber}`;
}

export function getActiveCaseForProperty(
  fixture: SalesPocFixture,
  propertyId: string,
): SaleCase | undefined {
  return fixture.cases.find(
    (saleCase) =>
      saleCase.propertyId === propertyId && saleCase.status !== "CANCELADO",
  );
}

/**
 * Projeção determinística da tabela §4.4 de docs/task.md:
 * - sem aceite ativo (ou dossiê cancelado) → DISPONIVEL / PUBLICADO
 * - proposta aceita (antes do compromisso) → RESERVADO / PUBLICADO_EM_NEGOCIACAO (D9)
 * - compromisso assinado (antes do registro) → SOB_CONTRATO / DESPUBLICADO
 * - título registrado → VENDIDO / DESPUBLICADO (D4)
 */
export function derivePropertyStatus(
  fixture: SalesPocFixture,
  propertyId: string,
): {
  commercialStatus: PropertyCommercialStatus;
  listingStatus: PropertyListingStatus;
} {
  const activeCase = getActiveCaseForProperty(fixture, propertyId);

  if (!activeCase) {
    const hasAcceptedWithoutCase = fixture.opportunities.some((opp) => {
      if (opp.propertyId !== propertyId || opp.status !== "ACEITA") {
        return false;
      }
      if (!opp.saleCaseId) {
        return true;
      }
      const linkedCase = fixture.cases.find((c) => c.id === opp.saleCaseId);
      return linkedCase ? linkedCase.status !== "CANCELADO" : true;
    });

    if (hasAcceptedWithoutCase) {
      return {
        commercialStatus: "RESERVADO",
        listingStatus: "PUBLICADO_EM_NEGOCIACAO",
      };
    }

    return {
      commercialStatus: "DISPONIVEL",
      listingStatus: "PUBLICADO",
    };
  }

  const isRegistered = activeCase.milestones.some(
    (m) => m.code === "TITULO_REGISTRADO" && m.status === "CONCLUIDO",
  );
  if (isRegistered) {
    return {
      commercialStatus: "VENDIDO",
      listingStatus: "DESPUBLICADO",
    };
  }

  const isCommitmentSigned = activeCase.milestones.some(
    (m) => m.code === "COMPROMISSO_ASSINADO" && m.status === "CONCLUIDO",
  );
  if (isCommitmentSigned) {
    return {
      commercialStatus: "SOB_CONTRATO",
      listingStatus: "DESPUBLICADO",
    };
  }

  return {
    commercialStatus: "RESERVADO",
    listingStatus: "PUBLICADO_EM_NEGOCIACAO",
  };
}

function syncPropertyStatusInDraft(
  draft: SalesPocFixture,
  propertyId: string,
): void {
  const property = draft.properties.find((p) => p.id === propertyId);
  if (!property) return;

  const derived = derivePropertyStatus(draft, propertyId);
  property.commercialStatus = derived.commercialStatus;
  property.listingStatus = derived.listingStatus;
}

export function isChecklistResolved(saleCase: SaleCase): boolean {
  return saleCase.checklist
    .filter((item) => item.required)
    .every(
      (item) =>
        item.status === "ACEITO" ||
        (item.status === "DISPENSADO" &&
          Boolean(item.waiverJustification && item.waiverJustification.trim())),
    );
}

export function getActiveBlocks(saleCase: SaleCase): TransversalBlock[] {
  return saleCase.blocks.filter((block) => block.active);
}

export function getNextPendingMilestone(
  saleCase: SaleCase,
): SaleMilestone | undefined {
  for (const code of ORDERED_MILESTONE_CODES) {
    const milestone = saleCase.milestones.find((m) => m.code === code);
    if (milestone && milestone.status === "PENDENTE") {
      return milestone;
    }
  }
  return undefined;
}

function buildInitialChecklist(
  caseId: string,
  variant: PaymentModality,
  sellerCount: number,
): ChecklistItem[] {
  const sellerLabel =
    sellerCount > 1
      ? `Certidões cíveis, fiscais e trabalhistas dos ${sellerCount} coproprietários`
      : "Certidões cíveis, fiscais e trabalhistas do vendedor";

  const baseItems: ChecklistItem[] = [
    {
      id: `chk-${caseId}-1`,
      code: "MATRICULA_ATUALIZADA",
      label: "Certidão de matrícula e ônus reais atualizada (30 dias)",
      category: "IMOVEL",
      required: true,
      status: "PENDENTE",
    },
    {
      id: `chk-${caseId}-2`,
      code: "CERTIDOES_VENDEDORES",
      label: sellerLabel,
      category: "VENDEDOR",
      required: true,
      status: "PENDENTE",
    },
    {
      id: `chk-${caseId}-3`,
      code: "DOCUMENTOS_COMPRADOR",
      label: "Documentos pessoais e comprovação de estado civil do comprador",
      category: "COMPRADOR",
      required: true,
      status: "PENDENTE",
    },
  ];

  if (variant === "FINANCIADO") {
    baseItems.push({
      id: `chk-${caseId}-4`,
      code: "CREDITO_ENGENHARIA_FINANCIAMENTO",
      label:
        "Carta de crédito imobiliário aprovada e laudo de engenharia bancária",
      category: "FINANCIAMENTO",
      required: true,
      status: "PENDENTE",
    });
  }

  return baseItems;
}

function buildInitialMilestones(caseId: string): SaleMilestone[] {
  return [
    {
      id: `ms-${caseId}-1`,
      code: "COMPROMISSO_ASSINADO",
      label: "Compromisso particular assinado",
      stage: "CONTRATACAO",
      status: "PENDENTE",
    },
    {
      id: `ms-${caseId}-2`,
      code: "ESCRITURA_LAVRADA",
      label: "Escritura pública ou instrumento com força de escritura lavrado",
      stage: "CARTORIO",
      status: "PENDENTE",
    },
    {
      id: `ms-${caseId}-3`,
      code: "TITULO_PROTOCOLADO",
      label: "Título protocolado no Registro de Imóveis",
      stage: "CARTORIO",
      status: "PENDENTE",
    },
    {
      id: `ms-${caseId}-4`,
      code: "TITULO_REGISTRADO",
      label: REGISTERED_LEGAL_NOTICE,
      stage: "CARTORIO",
      status: "PENDENTE",
    },
    {
      id: `ms-${caseId}-5`,
      code: "CHAVES_ENTREGUES",
      label: "Entrega de chaves e imissão na posse",
      stage: "ENTREGA",
      status: "PENDENTE",
    },
  ];
}

export interface CreateOpportunityInput {
  buyerId: string;
  propertyId: string;
  brokerId: string;
  attendanceSummary?: string;
  timestamp?: string;
}

export function createOpportunity(
  fixture: SalesPocFixture,
  input: CreateOpportunityInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const buyer = draft.buyers.find((b) => b.id === input.buyerId);
  const property = draft.properties.find((p) => p.id === input.propertyId);
  const broker = draft.brokers.find((b) => b.id === input.brokerId);

  if (!buyer || !property || !broker) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message:
        "Comprador, imóvel ou corretor selecionado não foi encontrado no cadastro.",
    };
  }

  if (property.commercialStatus === "VENDIDO") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Não é possível abrir oportunidade para ${property.code}: o título já foi registrado na matrícula.`,
    };
  }

  const duplicateActive = draft.opportunities.find((opp) => {
    if (opp.buyerId !== buyer.id || opp.propertyId !== property.id) {
      return false;
    }
    if (opp.status === "PERDIDA") {
      return false;
    }
    if (opp.status === "ACEITA" && opp.saleCaseId) {
      const linkedCase = draft.cases.find((c) => c.id === opp.saleCaseId);
      return linkedCase ? linkedCase.status !== "CANCELADO" : true;
    }
    return true;
  });

  if (duplicateActive) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: `Já existe oportunidade ativa (${duplicateActive.code}) para ${buyer.name} no imóvel ${property.code}.`,
    };
  }

  const timestamp = nowIso(input.timestamp);
  const nextIndex = draft.opportunities.length + 1;
  const id = `opp-${String(nextIndex).padStart(2, "0")}`;
  const code = nextSequentialCode(
    draft.opportunities.map((o) => o.code),
    "OP-2026-",
  );

  if (!buyer.interestedPropertyIds.includes(property.id)) {
    buyer.interestedPropertyIds.push(property.id);
  }

  const interestedCodes = buyer.interestedPropertyIds
    .map((pid) => draft.properties.find((p) => p.id === pid)?.code ?? pid)
    .join(", ");

  const summary =
    input.attendanceSummary?.trim() ||
    `Atendimento comercial de ${buyer.name} com visitas aos imóveis ${interestedCodes}; negociação aberta para ${property.title}.`;

  const newOpportunity: SaleOpportunity = {
    id,
    code,
    propertyId: property.id,
    buyerId: buyer.id,
    brokerId: broker.id,
    status: "ATENDIMENTO",
    attendanceSummary: summary,
    createdAt: timestamp,
    updatedAt: timestamp,
    timeline: [
      {
        id: `evt-${id}-1`,
        timestamp,
        actor: broker.name,
        type: "OPORTUNIDADE_CRIADA",
        description: `Oportunidade ${code} aberta para ${property.code} a partir de atendimento com interesse em: ${interestedCodes}.`,
      },
    ],
  };

  draft.opportunities.unshift(newOpportunity);

  return {
    ok: true,
    next: draft,
    createdOpportunityId: newOpportunity.id,
  };
}

export interface SubmitOfferVersionInput {
  opportunityId: string;
  authorRole: SaleOfferAuthorRole;
  amount: number;
  downPaymentAmount: number;
  financingAmount: number;
  paymentModality: PaymentModality;
  validUntil: string;
  conditions: string;
  expectedCommissionAmount: number;
  actorName?: string;
  timestamp?: string;
}

export function submitOfferVersion(
  fixture: SalesPocFixture,
  input: SubmitOfferVersionInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const opportunity = draft.opportunities.find(
    (o) => o.id === input.opportunityId,
  );
  if (!opportunity) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Oportunidade não encontrada.",
    };
  }

  if (opportunity.status === "ACEITA" || opportunity.status === "PERDIDA") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Não é permitido enviar nova versão quando a oportunidade está em ${opportunity.status}.`,
    };
  }

  const property = draft.properties.find(
    (p) => p.id === opportunity.propertyId,
  );
  const buyer = draft.buyers.find((b) => b.id === opportunity.buyerId);
  const primarySeller = property
    ? draft.sellers.find((s) => s.id === property.sellerIds[0])
    : undefined;

  if (!property || !buyer) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Imóvel ou comprador vinculado à oportunidade não encontrado.",
    };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Informe um valor total de proposta maior que zero.",
    };
  }

  if (!input.validUntil.trim()) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Informe a data de validade da proposta.",
    };
  }

  if (!input.conditions.trim()) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Descreva as condições comerciais da versão.",
    };
  }

  let downPaymentAmount = input.downPaymentAmount;
  let financingAmount = input.financingAmount;

  if (input.paymentModality === "A_VISTA") {
    downPaymentAmount = input.amount;
    financingAmount = 0;
  } else {
    if (!property.acceptsFinancing) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: `O imóvel ${property.code} está configurado apenas para pagamento à vista na autorização de venda.`,
      };
    }
    if (!Number.isFinite(financingAmount) || financingAmount <= 0) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message:
          "Na modalidade financiada, o valor de financiamento deve ser maior que zero.",
      };
    }
    if (
      !Number.isFinite(downPaymentAmount) ||
      downPaymentAmount < 0 ||
      Math.round(downPaymentAmount + financingAmount) !==
        Math.round(input.amount)
    ) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message:
          "A soma de recursos próprios e valor financiado deve corresponder exatamente ao valor total da proposta.",
      };
    }
  }

  if (
    !Number.isFinite(input.expectedCommissionAmount) ||
    input.expectedCommissionAmount < 0
  ) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "O valor informativo de comissão prevista é inválido.",
    };
  }

  const timestamp = nowIso(input.timestamp);
  let offer: SaleOffer | undefined = opportunity.offerId
    ? draft.offers.find((o) => o.id === opportunity.offerId)
    : undefined;

  if (input.authorRole === "VENDEDOR" && (!offer || offer.versions.length === 0)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message:
        "Contraproposta do vendedor exige ao menos uma proposta prévia enviada pelo comprador.",
    };
  }

  if (!offer) {
    const offerIndex = draft.offers.length + 1;
    const newOfferId = `offer-${String(offerIndex).padStart(2, "0")}`;
    offer = {
      id: newOfferId,
      opportunityId: opportunity.id,
      propertyId: property.id,
      buyerId: buyer.id,
      versions: [],
    };
    draft.offers.push(offer);
    opportunity.offerId = newOfferId;
  }

  // Se houver versão ENVIADA aberta, encerra apenas o status decisório dela mantendo todos os dados imutáveis (AC3).
  for (const prevVersion of offer.versions) {
    if (prevVersion.status === "ENVIADA") {
      prevVersion.status = "REJEITADA";
      prevVersion.respondedAt = timestamp;
      prevVersion.decisionNote =
        input.authorRole === "VENDEDOR"
          ? `Substituída por contraproposta v${offer.versions.length + 1} sem alteração dos termos originais.`
          : `Substituída por nova proposta v${offer.versions.length + 1} sem alteração dos termos originais.`;
    }
  }

  const versionNumber = offer.versions.length + 1;
  const versionId = `${offer.id}-v${versionNumber}`;

  const newVersion: SaleOfferVersion = {
    id: versionId,
    offerId: offer.id,
    versionNumber,
    authorRole: input.authorRole,
    status: "ENVIADA",
    amount: input.amount,
    downPaymentAmount,
    financingAmount,
    paymentModality: input.paymentModality,
    validUntil: input.validUntil.trim(),
    conditions: input.conditions.trim(),
    expectedCommissionAmount: input.expectedCommissionAmount,
    immutableAfterSend: true,
    createdAt: timestamp,
  };

  offer.versions.push(newVersion);
  opportunity.status = "EM_PROPOSTA";
  opportunity.updatedAt = timestamp;

  const defaultActor =
    input.authorRole === "COMPRADOR"
      ? buyer.name
      : (primarySeller?.name ?? "Vendedor");
  const actor = input.actorName?.trim() || defaultActor;

  opportunity.timeline.push({
    id: `evt-${opportunity.id}-${opportunity.timeline.length + 1}`,
    timestamp,
    actor,
    type:
      input.authorRole === "VENDEDOR"
        ? "CONTRAPROPOSTA_ENVIADA"
        : "PROPOSTA_ENVIADA",
    description:
      input.authorRole === "VENDEDOR"
        ? `Contraproposta v${versionNumber} registrada (${input.paymentModality === "FINANCIADO" ? "financiado" : "à vista"}). Versões anteriores preservadas.`
        : `Proposta v${versionNumber} enviada (${input.paymentModality === "FINANCIADO" ? "financiado" : "à vista"}).`,
  });

  return {
    ok: true,
    next: draft,
    createdOfferVersionId: newVersion.id,
  };
}

export interface RejectOfferVersionInput {
  opportunityId: string;
  versionId: string;
  reason: string;
  actorName?: string;
  timestamp?: string;
}

export function rejectOfferVersion(
  fixture: SalesPocFixture,
  input: RejectOfferVersionInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const opportunity = draft.opportunities.find(
    (o) => o.id === input.opportunityId,
  );
  if (!opportunity || !opportunity.offerId) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Oportunidade ou cadeia de propostas não encontrada.",
    };
  }

  if (opportunity.status !== "EM_PROPOSTA") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Apenas oportunidades na coluna EM_PROPOSTA podem rejeitar versão.",
    };
  }

  if (!input.reason.trim()) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Informe o motivo da rejeição da versão.",
    };
  }

  const offer = draft.offers.find((o) => o.id === opportunity.offerId);
  const version = offer?.versions.find((v) => v.id === input.versionId);

  if (!version) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Versão da proposta não encontrada.",
    };
  }

  if (version.status !== "ENVIADA") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `A versão v${version.versionNumber} já está em estado ${version.status} e permanece imutável.`,
    };
  }

  const timestamp = nowIso(input.timestamp);
  version.status = "REJEITADA";
  version.respondedAt = timestamp;
  version.decisionNote = input.reason.trim();

  opportunity.updatedAt = timestamp;
  opportunity.timeline.push({
    id: `evt-${opportunity.id}-${opportunity.timeline.length + 1}`,
    timestamp,
    actor: input.actorName?.trim() || "Parte contrária",
    type: "PROPOSTA_REJEITADA",
    description: `Versão v${version.versionNumber} rejeitada: ${input.reason.trim()}`,
  });

  return { ok: true, next: draft };
}

export interface ExpireOfferVersionInput {
  opportunityId: string;
  versionId: string;
  timestamp?: string;
}

export function expireOfferVersion(
  fixture: SalesPocFixture,
  input: ExpireOfferVersionInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const opportunity = draft.opportunities.find(
    (o) => o.id === input.opportunityId,
  );
  const offer = opportunity?.offerId
    ? draft.offers.find((o) => o.id === opportunity.offerId)
    : undefined;
  const version = offer?.versions.find((v) => v.id === input.versionId);

  if (!opportunity || !version) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Oportunidade ou versão de proposta não encontrada.",
    };
  }

  if (opportunity.status !== "EM_PROPOSTA" || version.status !== "ENVIADA") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Somente uma versão enviada em negociação pode expirar.",
    };
  }

  const timestamp = nowIso(input.timestamp);
  version.status = "EXPIRADA";
  version.respondedAt = timestamp;
  version.decisionNote = "Prazo de validade expirado sem aceite.";

  opportunity.updatedAt = timestamp;
  opportunity.timeline.push({
    id: `evt-${opportunity.id}-${opportunity.timeline.length + 1}`,
    timestamp,
    actor: "Sistema",
    type: "PROPOSTA_EXPIRADA",
    description: `Prazo de validade da versão v${version.versionNumber} expirado; oportunidade permanece aberta para envio de nova proposta.`,
  });

  return { ok: true, next: draft };
}

export interface AcceptOfferVersionInput {
  opportunityId: string;
  versionId: string;
  decisionNote?: string;
  actorName?: string;
  timestamp?: string;
}

export function acceptOfferVersion(
  fixture: SalesPocFixture,
  input: AcceptOfferVersionInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const opportunity = draft.opportunities.find(
    (o) => o.id === input.opportunityId,
  );
  if (!opportunity || !opportunity.offerId) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Oportunidade ou proposta não encontrada.",
    };
  }

  if (opportunity.status !== "EM_PROPOSTA") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message:
        "Apenas oportunidades com proposta ativa podem registrar aceite.",
    };
  }

  const property = draft.properties.find(
    (p) => p.id === opportunity.propertyId,
  );
  const offer = draft.offers.find((o) => o.id === opportunity.offerId);
  const version = offer?.versions.find((v) => v.id === input.versionId);

  if (!property || !offer || !version) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Imóvel ou versão de proposta não encontrados.",
    };
  }

  if (version.status !== "ENVIADA") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Não é possível aceitar a versão v${version.versionNumber} porque seu estado atual é ${version.status}.`,
    };
  }

  // AC4 / C3: bloqueio estrito de segundo aceite no mesmo imóvel!
  const existingActiveCase = getActiveCaseForProperty(draft, property.id);
  if (existingActiveCase) {
    const holderOpp = draft.opportunities.find(
      (o) => o.id === existingActiveCase.opportunityId,
    );
    return {
      ok: false,
      code: "PROPERTY_ALREADY_RESERVED",
      message: `Segundo aceite bloqueado: o imóvel ${property.code} (${property.title}) já possui proposta aceita vigente na oportunidade ${holderOpp?.code ?? existingActiveCase.opportunityId} com dossiê ativo ${existingActiveCase.code}. Enquanto esse dossiê não for cancelado, nenhuma outra proposta para o mesmo imóvel pode ser aceita.`,
    };
  }

  const competingAcceptedOpp = draft.opportunities.find(
    (o) =>
      o.id !== opportunity.id &&
      o.propertyId === property.id &&
      o.status === "ACEITA",
  );
  if (competingAcceptedOpp) {
    const linkedCase = competingAcceptedOpp.saleCaseId
      ? draft.cases.find((c) => c.id === competingAcceptedOpp.saleCaseId)
      : undefined;
    if (!linkedCase || linkedCase.status !== "CANCELADO") {
      return {
        ok: false,
        code: "PROPERTY_ALREADY_RESERVED",
        message: `Segundo aceite bloqueado: o imóvel ${property.code} já possui aceite registrado na oportunidade ${competingAcceptedOpp.code}.`,
      };
    }
  }

  const timestamp = nowIso(input.timestamp);
  version.status = "ACEITA";
  version.respondedAt = timestamp;
  version.decisionNote =
    input.decisionNote?.trim() ||
    "Versão aceita; imóvel reservado e dossiê documental aberto.";

  const caseIndex = draft.cases.length + 1;
  const caseId = `case-${String(caseIndex).padStart(2, "0")}`;
  const caseCode = nextSequentialCode(
    draft.cases.map((c) => c.code),
    "DOS-2026-",
  );

  const actor = input.actorName?.trim() || "Partes em acordo";

  const newCase: SaleCase = {
    id: caseId,
    code: caseCode,
    opportunityId: opportunity.id,
    propertyId: property.id,
    buyerId: opportunity.buyerId,
    brokerId: opportunity.brokerId,
    acceptedOfferVersionId: version.id,
    status: "DILIGENCIA",
    checklistVariant: version.paymentModality,
    checklist: buildInitialChecklist(
      caseId,
      version.paymentModality,
      property.sellerIds.length,
    ),
    milestones: buildInitialMilestones(caseId),
    blocks: [],
    openedAt: timestamp,
    updatedAt: timestamp,
    timeline: [
      {
        id: `evt-${caseId}-1`,
        timestamp,
        actor: "Sistema",
        type: "DOSSIE_ABERTO",
        description: `Dossiê ${caseCode} criado automaticamente após aceite da versão v${version.versionNumber} (${version.paymentModality === "FINANCIADO" ? "modalidade financiada" : "modalidade à vista"}).`,
      },
    ],
  };

  draft.cases.unshift(newCase);

  opportunity.status = "ACEITA";
  opportunity.acceptedOfferVersionId = version.id;
  opportunity.saleCaseId = newCase.id;
  opportunity.updatedAt = timestamp;
  opportunity.timeline.push({
    id: `evt-${opportunity.id}-${opportunity.timeline.length + 1}`,
    timestamp,
    actor,
    type: "PROPOSTA_ACEITA",
    description: `Versão v${version.versionNumber} aceita; imóvel passou a Reservado e dossiê ${caseCode} foi aberto em Diligência.`,
  });

  syncPropertyStatusInDraft(draft, property.id);

  return {
    ok: true,
    next: draft,
    createdCaseId: newCase.id,
  };
}

export interface MarkOpportunityLostInput {
  opportunityId: string;
  lossReason: string;
  actorName?: string;
  timestamp?: string;
}

export function markOpportunityLost(
  fixture: SalesPocFixture,
  input: MarkOpportunityLostInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const opportunity = draft.opportunities.find(
    (o) => o.id === input.opportunityId,
  );
  if (!opportunity) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Oportunidade não encontrada.",
    };
  }

  if (opportunity.status === "ACEITA" || opportunity.status === "PERDIDA") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message:
        "Somente oportunidades pré-aceite (Atendimento ou Em proposta) podem ser encerradas como Perdida.",
    };
  }

  const trimmedReason = input.lossReason.trim();
  if (!trimmedReason) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "O motivo de perda é obrigatório para encerrar a oportunidade.",
    };
  }

  const timestamp = nowIso(input.timestamp);

  if (opportunity.offerId) {
    const offer = draft.offers.find((o) => o.id === opportunity.offerId);
    if (offer) {
      for (const version of offer.versions) {
        if (version.status === "ENVIADA") {
          version.status = "REJEITADA";
          version.respondedAt = timestamp;
          version.decisionNote = `Negociação encerrada como perdida: ${trimmedReason}`;
        }
      }
    }
  }

  const broker = draft.brokers.find((b) => b.id === opportunity.brokerId);
  opportunity.status = "PERDIDA";
  opportunity.lossReason = trimmedReason;
  opportunity.updatedAt = timestamp;
  opportunity.timeline.push({
    id: `evt-${opportunity.id}-${opportunity.timeline.length + 1}`,
    timestamp,
    actor: input.actorName?.trim() || broker?.name || "Corretor responsável",
    type: "OPORTUNIDADE_PERDIDA",
    description: `Negociação encerrada como perdida: ${trimmedReason}`,
  });

  syncPropertyStatusInDraft(draft, opportunity.propertyId);

  return { ok: true, next: draft };
}

export interface UpdateChecklistItemInput {
  caseId: string;
  itemId: string;
  status: ChecklistItemStatus;
  waiverJustification?: string;
  actorName?: string;
  timestamp?: string;
}

export function updateChecklistItem(
  fixture: SalesPocFixture,
  input: UpdateChecklistItemInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const saleCase = draft.cases.find((c) => c.id === input.caseId);
  if (!saleCase) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Dossiê de venda não encontrado.",
    };
  }

  if (saleCase.status === "CONCLUIDO" || saleCase.status === "CANCELADO") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Não é possível alterar o checklist de um dossiê ${saleCase.status}.`,
    };
  }

  const item = saleCase.checklist.find((i) => i.id === input.itemId);
  if (!item) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Item do checklist não encontrado.",
    };
  }

  if (input.status === "DISPENSADO") {
    const justification = input.waiverJustification?.trim() ?? "";
    if (!justification) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message:
          "Para dispensar um item obrigatório do checklist, informe uma justificativa explícita.",
      };
    }
    item.waiverJustification = justification;
  } else {
    item.waiverJustification = undefined;
  }

  const timestamp = nowIso(input.timestamp);
  item.status = input.status;
  item.updatedAt = timestamp;
  saleCase.updatedAt = timestamp;

  const broker = draft.brokers.find((b) => b.id === saleCase.brokerId);
  const statusSummary =
    input.status === "DISPENSADO"
      ? `dispensado com justificativa ("${item.waiverJustification}")`
      : `marcado como ${input.status}`;

  saleCase.timeline.push({
    id: `evt-${saleCase.id}-${saleCase.timeline.length + 1}`,
    timestamp,
    actor: input.actorName?.trim() || broker?.name || "Equipe de diligência",
    type: "CHECKLIST_ATUALIZADO",
    description: `Item "${item.label}" ${statusSummary}.`,
  });

  return { ok: true, next: draft };
}

export interface AdvanceCaseToContratacaoInput {
  caseId: string;
  actorName?: string;
  timestamp?: string;
}

export function advanceCaseToContratacao(
  fixture: SalesPocFixture,
  input: AdvanceCaseToContratacaoInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const saleCase = draft.cases.find((c) => c.id === input.caseId);
  if (!saleCase) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Dossiê não encontrado.",
    };
  }

  if (saleCase.status !== "DILIGENCIA") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `O dossiê já está na coluna ${saleCase.status}.`,
    };
  }

  const activeBlocks = getActiveBlocks(saleCase);
  if (activeBlocks.length > 0) {
    return {
      ok: false,
      code: "ACTIVE_BLOCK",
      message: `Avanço impedido por bloqueio transversal ativo: "${activeBlocks[0].title}". Resolva o bloqueio antes de avançar de coluna.`,
    };
  }

  if (!isChecklistResolved(saleCase)) {
    return {
      ok: false,
      code: "CHECKLIST_UNRESOLVED",
      message:
        "Para sair de Diligência, todos os itens obrigatórios do checklist devem estar Aceitos ou Dispensados com justificativa (sem itens pendentes ou reprovados).",
    };
  }

  const timestamp = nowIso(input.timestamp);
  const broker = draft.brokers.find((b) => b.id === saleCase.brokerId);

  saleCase.status = "CONTRATACAO";
  saleCase.updatedAt = timestamp;
  saleCase.timeline.push({
    id: `evt-${saleCase.id}-${saleCase.timeline.length + 1}`,
    timestamp,
    actor: input.actorName?.trim() || broker?.name || "Gestão comercial",
    type: "CHECKLIST_ATUALIZADO",
    description:
      "Checklist mínimo resolvido sem bloqueios ativos; dossiê avançou para Contratação.",
  });

  return { ok: true, next: draft };
}

export interface RegisterTransversalBlockInput {
  caseId: string;
  type: TransversalBlockType;
  title: string;
  description: string;
  actorName?: string;
  timestamp?: string;
}

export function registerTransversalBlock(
  fixture: SalesPocFixture,
  input: RegisterTransversalBlockInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const saleCase = draft.cases.find((c) => c.id === input.caseId);
  if (!saleCase) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Dossiê não encontrado.",
    };
  }

  if (saleCase.status === "CONCLUIDO" || saleCase.status === "CANCELADO") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Não é possível registrar bloqueios em um dossiê ${saleCase.status}.`,
    };
  }

  if (!input.title.trim() || !input.description.trim()) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Informe título e descrição para registrar o bloqueio transversal.",
    };
  }

  const timestamp = nowIso(input.timestamp);
  const broker = draft.brokers.find((b) => b.id === saleCase.brokerId);

  const newBlock: TransversalBlock = {
    id: `blk-${saleCase.id}-${saleCase.blocks.length + 1}`,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    active: true,
    openedAt: timestamp,
  };

  // §4.3: bloqueios transversais impedem avanço sem mudar de coluna!
  saleCase.blocks.push(newBlock);
  saleCase.updatedAt = timestamp;
  saleCase.timeline.push({
    id: `evt-${saleCase.id}-${saleCase.timeline.length + 1}`,
    timestamp,
    actor: input.actorName?.trim() || broker?.name || "Gestão comercial",
    type: "BLOQUEIO_REGISTRADO",
    description: `Bloqueio transversal ${input.type} registrado ("${newBlock.title}"); dossiê permanece na coluna ${saleCase.status}.`,
  });

  return { ok: true, next: draft };
}

export interface ResolveTransversalBlockInput {
  caseId: string;
  blockId: string;
  resolutionNote: string;
  actorName?: string;
  timestamp?: string;
}

export function resolveTransversalBlock(
  fixture: SalesPocFixture,
  input: ResolveTransversalBlockInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const saleCase = draft.cases.find((c) => c.id === input.caseId);
  const block = saleCase?.blocks.find((b) => b.id === input.blockId);

  if (!saleCase || !block) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Dossiê ou bloqueio transversal não encontrado.",
    };
  }

  if (!block.active) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Este bloqueio transversal já foi resolvido.",
    };
  }

  if (!input.resolutionNote.trim()) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message:
        "Descreva como o bloqueio foi cumprido/resolvido (ex.: reapresentação de título ou aprovação bancária).",
    };
  }

  const timestamp = nowIso(input.timestamp);
  const broker = draft.brokers.find((b) => b.id === saleCase.brokerId);

  block.active = false;
  block.resolvedAt = timestamp;
  block.resolutionNote = input.resolutionNote.trim();
  saleCase.updatedAt = timestamp;

  saleCase.timeline.push({
    id: `evt-${saleCase.id}-${saleCase.timeline.length + 1}`,
    timestamp,
    actor: input.actorName?.trim() || broker?.name || "Gestão comercial",
    type: "BLOQUEIO_RESOLVIDO",
    description: `Bloqueio ${block.type} resolvido: ${block.resolutionNote}`,
  });

  return { ok: true, next: draft };
}

export interface CompleteSaleMilestoneInput {
  caseId: string;
  milestoneCode: SaleMilestoneCode;
  notes?: string;
  actorName?: string;
  timestamp?: string;
}

export function completeSaleMilestone(
  fixture: SalesPocFixture,
  input: CompleteSaleMilestoneInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const saleCase = draft.cases.find((c) => c.id === input.caseId);
  if (!saleCase) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Dossiê não encontrado.",
    };
  }

  if (saleCase.status === "CANCELADO" || saleCase.status === "CONCLUIDO") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Não é possível concluir marcos em um dossiê ${saleCase.status}.`,
    };
  }

  const activeBlocks = getActiveBlocks(saleCase);
  if (activeBlocks.length > 0) {
    return {
      ok: false,
      code: "ACTIVE_BLOCK",
      message: `Conclusão do marco impedida por bloqueio transversal ativo: "${activeBlocks[0].title}". Resolva o bloqueio antes de avançar.`,
    };
  }

  if (saleCase.status === "DILIGENCIA") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message:
        "Conclua a etapa de Diligência (avançando para Contratação) antes de registrar marcos contratuais e registrais.",
    };
  }

  const nextMilestone = getNextPendingMilestone(saleCase);
  if (!nextMilestone) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Todos os marcos deste dossiê já foram concluídos.",
    };
  }

  if (nextMilestone.code !== input.milestoneCode) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Ordem estrita de marcos: conclua primeiro "${nextMilestone.label}" (${nextMilestone.code}) antes de registrar ${input.milestoneCode}.`,
    };
  }

  const timestamp = nowIso(input.timestamp);
  const broker = draft.brokers.find((b) => b.id === saleCase.brokerId);
  const actor = input.actorName?.trim() || broker?.name || "Equipe de fechamento";

  nextMilestone.status = "CONCLUIDO";
  nextMilestone.completedAt = timestamp;
  if (input.notes?.trim()) {
    nextMilestone.notes = input.notes.trim();
  }

  let eventDescription = `Marco concluído: ${nextMilestone.label}.`;

  switch (input.milestoneCode) {
    case "COMPROMISSO_ASSINADO": {
      saleCase.status = "CARTORIO";
      saleCase.legalNotice = NON_TRANSFER_LEGAL_NOTICE;
      nextMilestone.notes =
        nextMilestone.notes || `${NON_TRANSFER_LEGAL_NOTICE}.`;
      eventDescription = `${NON_TRANSFER_LEGAL_NOTICE}; imóvel passou a Sob contrato (anúncio despublicado) e dossiê seguiu para Cartório.`;
      break;
    }
    case "ESCRITURA_LAVRADA": {
      saleCase.status = "CARTORIO";
      saleCase.legalNotice = NON_TRANSFER_LEGAL_NOTICE;
      eventDescription =
        "Escritura lavrada em notas; propriedade permanece pendente do registro na matrícula.";
      break;
    }
    case "TITULO_PROTOCOLADO": {
      saleCase.status = "CARTORIO";
      saleCase.legalNotice = NON_TRANSFER_LEGAL_NOTICE;
      eventDescription =
        "Título protocolado no Registro de Imóveis; aguardando qualificação registral.";
      break;
    }
    case "TITULO_REGISTRADO": {
      saleCase.status = "ENTREGA";
      saleCase.legalNotice = REGISTERED_LEGAL_NOTICE;
      eventDescription = `${REGISTERED_LEGAL_NOTICE}: matrícula atualizada, imóvel marcado como Vendido e dossiê avançou para Entrega.`;
      break;
    }
    case "CHAVES_ENTREGUES": {
      saleCase.status = "CONCLUIDO";
      saleCase.legalNotice = REGISTERED_LEGAL_NOTICE;
      eventDescription =
        "Chaves entregues e imissão na posse concluída; dossiê encerrado como Concluído.";
      break;
    }
  }

  saleCase.updatedAt = timestamp;
  saleCase.timeline.push({
    id: `evt-${saleCase.id}-${saleCase.timeline.length + 1}`,
    timestamp,
    actor,
    type: "MARCO_CONCLUIDO",
    description: eventDescription,
  });

  syncPropertyStatusInDraft(draft, saleCase.propertyId);

  return { ok: true, next: draft };
}

export interface CancelSaleCaseInput {
  caseId: string;
  cancellationReason: string;
  actorName?: string;
  timestamp?: string;
}

export function cancelSaleCase(
  fixture: SalesPocFixture,
  input: CancelSaleCaseInput,
): DomainResult {
  const draft = structuredClone(fixture);
  const saleCase = draft.cases.find((c) => c.id === input.caseId);
  if (!saleCase) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Dossiê não encontrado.",
    };
  }

  if (saleCase.status === "CANCELADO" || saleCase.status === "CONCLUIDO") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `O dossiê já está em estado terminal (${saleCase.status}).`,
    };
  }

  const isAlreadyRegistered = saleCase.milestones.some(
    (m) => m.code === "TITULO_REGISTRADO" && m.status === "CONCLUIDO",
  );
  if (isAlreadyRegistered) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message:
        "Não é possível cancelar o dossiê de forma simples após o marco TITULO_REGISTRADO.",
    };
  }

  const reason = input.cancellationReason.trim();
  if (!reason) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Informe o motivo obrigatório para cancelar o dossiê.",
    };
  }

  const timestamp = nowIso(input.timestamp);
  const broker = draft.brokers.find((b) => b.id === saleCase.brokerId);
  const actor = input.actorName?.trim() || broker?.name || "Gestão comercial";

  for (const block of saleCase.blocks) {
    if (block.active) {
      block.active = false;
      block.resolvedAt = timestamp;
      block.resolutionNote = "Encerrado em razão do cancelamento do dossiê.";
    }
  }

  saleCase.status = "CANCELADO";
  saleCase.cancellationReason = reason;
  saleCase.legalNotice = undefined;
  saleCase.updatedAt = timestamp;
  saleCase.timeline.push({
    id: `evt-${saleCase.id}-${saleCase.timeline.length + 1}`,
    timestamp,
    actor,
    type: "DOSSIE_CANCELADO",
    description: `Dossiê cancelado (${reason}); imóvel retornou a Disponível e anúncio foi republicado.`,
  });

  const opportunity = draft.opportunities.find(
    (o) => o.id === saleCase.opportunityId,
  );
  if (opportunity) {
    opportunity.updatedAt = timestamp;
    opportunity.timeline.push({
      id: `evt-${opportunity.id}-${opportunity.timeline.length + 1}`,
      timestamp,
      actor,
      type: "DOSSIE_CANCELADO",
      description: `Dossiê ${saleCase.code} cancelado: ${reason}. Imóvel liberado novamente para Disponível.`,
    });
  }

  syncPropertyStatusInDraft(draft, saleCase.propertyId);

  return { ok: true, next: draft };
}

