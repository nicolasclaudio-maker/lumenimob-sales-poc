/**
 * Contratos de domínio da POC de Compra e Venda.
 *
 * IMPORTANTE: Estes tipos representam exclusivamente a estrutura em memória/localStorage
 * do protótipo navegável (hipótese validada nas sessões U4) e NÃO definem o schema
 * definitivo de produção (sujeito a ADR específico — decisão D2 em docs/task.md).
 */

export type SaleOpportunityStatus =
  | "ATENDIMENTO"
  | "EM_PROPOSTA"
  | "ACEITA"
  | "PERDIDA";

export type SaleCaseStatus =
  | "DILIGENCIA"
  | "CONTRATACAO"
  | "CARTORIO"
  | "ENTREGA"
  | "CONCLUIDO"
  | "CANCELADO";

export type TransversalBlockType =
  | "PENDENTE_INFORMACAO"
  | "AGUARDANDO_FINANCIAMENTO"
  | "EXIGENCIA_CARTORIAL";

export type PropertyCommercialStatus =
  | "DISPONIVEL"
  | "RESERVADO"
  | "SOB_CONTRATO"
  | "VENDIDO";

export type PropertyListingStatus =
  | "PUBLICADO"
  | "PUBLICADO_EM_NEGOCIACAO"
  | "DESPUBLICADO";

export type PropertyType = "APARTAMENTO" | "CASA";

export type PaymentModality = "A_VISTA" | "FINANCIADO";

export type SaleOfferAuthorRole = "COMPRADOR" | "VENDEDOR";

export type SaleOfferVersionStatus =
  | "ENVIADA"
  | "ACEITA"
  | "REJEITADA"
  | "EXPIRADA";

export type ChecklistItemStatus =
  | "PENDENTE"
  | "ACEITO"
  | "DISPENSADO"
  | "REPROVADO";

export type SaleMilestoneCode =
  | "COMPROMISSO_ASSINADO"
  | "ESCRITURA_LAVRADA"
  | "TITULO_PROTOCOLADO"
  | "TITULO_REGISTRADO"
  | "CHAVES_ENTREGUES";

export type SaleMilestoneStatus = "PENDENTE" | "CONCLUIDO";

export interface Brokerage {
  id: string;
  name: string;
  maskedCnpj: string;
  creci: string;
  city: string;
  state: string;
}

export interface Broker {
  id: string;
  brokerageId: string;
  name: string;
  creci: string;
  email: string;
}

export interface Manager {
  id: string;
  brokerageId: string;
  name: string;
  email: string;
}

export interface SaleAuthorization {
  code: string;
  status: "VIGENTE" | "EXPIRADA";
  validUntil: string;
  exclusivity: boolean;
  expectedCommissionPercent: number;
}

export interface Property {
  id: string;
  code: string;
  title: string;
  type: PropertyType;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  registrationCode: string;
  askingPrice: number;
  preferredPaymentModality: PaymentModality;
  acceptsFinancing: boolean;
  sellerIds: string[];
  brokerId: string;
  commercialStatus: PropertyCommercialStatus;
  listingStatus: PropertyListingStatus;
  saleAuthorization: SaleAuthorization;
}

export interface Buyer {
  id: string;
  name: string;
  maskedDocument: string;
  email: string;
  phone: string;
  preferredPaymentModality: PaymentModality;
  interestedPropertyIds: string[];
}

export interface Seller {
  id: string;
  name: string;
  maskedDocument: string;
  email: string;
  phone: string;
  civilStatusNote: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  type:
    | "OPORTUNIDADE_CRIADA"
    | "PROPOSTA_ENVIADA"
    | "CONTRAPROPOSTA_ENVIADA"
    | "PROPOSTA_REJEITADA"
    | "PROPOSTA_EXPIRADA"
    | "PROPOSTA_ACEITA"
    | "OPORTUNIDADE_PERDIDA"
    | "DOSSIE_ABERTO"
    | "CHECKLIST_ATUALIZADO"
    | "BLOQUEIO_REGISTRADO"
    | "BLOQUEIO_RESOLVIDO"
    | "MARCO_CONCLUIDO"
    | "DOSSIE_CANCELADO";
  description: string;
}

export interface TransversalBlock {
  id: string;
  type: TransversalBlockType;
  title: string;
  description: string;
  active: boolean;
  openedAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface ChecklistItem {
  id: string;
  code: string;
  label: string;
  category: "IMOVEL" | "VENDEDOR" | "COMPRADOR" | "FINANCIAMENTO";
  required: boolean;
  status: ChecklistItemStatus;
  waiverJustification?: string;
  updatedAt?: string;
}

export interface SaleMilestone {
  id: string;
  code: SaleMilestoneCode;
  label: string;
  stage: Exclude<SaleCaseStatus, "CONCLUIDO" | "CANCELADO">;
  status: SaleMilestoneStatus;
  completedAt?: string;
  notes?: string;
}

export interface SaleOfferVersion {
  id: string;
  offerId: string;
  versionNumber: number;
  authorRole: SaleOfferAuthorRole;
  status: SaleOfferVersionStatus;
  amount: number;
  downPaymentAmount: number;
  financingAmount: number;
  paymentModality: PaymentModality;
  validUntil: string;
  conditions: string;
  expectedCommissionAmount: number;
  immutableAfterSend: true;
  createdAt: string;
  respondedAt?: string;
  decisionNote?: string;
}

export interface SaleOffer {
  id: string;
  opportunityId: string;
  propertyId: string;
  buyerId: string;
  versions: SaleOfferVersion[];
}

export interface SaleOpportunity {
  id: string;
  code: string;
  propertyId: string;
  buyerId: string;
  brokerId: string;
  status: SaleOpportunityStatus;
  offerId?: string;
  acceptedOfferVersionId?: string;
  saleCaseId?: string;
  lossReason?: string;
  attendanceSummary: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export interface SaleCase {
  id: string;
  code: string;
  opportunityId: string;
  propertyId: string;
  buyerId: string;
  brokerId: string;
  acceptedOfferVersionId: string;
  status: SaleCaseStatus;
  checklistVariant: PaymentModality;
  checklist: ChecklistItem[];
  milestones: SaleMilestone[];
  blocks: TransversalBlock[];
  legalNotice?: string;
  cancellationReason?: string;
  openedAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export interface SalesPocFixture {
  fixtureVersion: string;
  generatedAt: string;
  brokerage: Brokerage;
  manager: Manager;
  brokers: Broker[];
  properties: Property[];
  buyers: Buyer[];
  sellers: Seller[];
  opportunities: SaleOpportunity[];
  offers: SaleOffer[];
  cases: SaleCase[];
}

