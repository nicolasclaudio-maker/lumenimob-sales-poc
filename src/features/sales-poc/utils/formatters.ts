import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  ChecklistItemStatus,
  PaymentModality,
  PropertyCommercialStatus,
  PropertyListingStatus,
  PropertyType,
  SaleCaseStatus,
  SaleOfferAuthorRole,
  SaleOfferVersionStatus,
  SaleOpportunityStatus,
  TimelineEvent,
  TransversalBlockType,
} from "@/features/sales-poc/domain/types";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function formatCurrencyBRL(amount: number): string {
  return brlFormatter.format(amount);
}

export function formatShortDate(isoString: string): string {
  try {
    return format(parseISO(isoString), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string): string {
  try {
    return format(parseISO(isoString), "dd/MM/yyyy 'às' HH:mm", {
      locale: ptBR,
    });
  } catch {
    return isoString;
  }
}

export const OPPORTUNITY_STATUS_LABELS: Record<SaleOpportunityStatus, string> = {
  ATENDIMENTO: "Atendimento",
  EM_PROPOSTA: "Em proposta",
  ACEITA: "Aceita",
  PERDIDA: "Perdida",
};

export const SALE_CASE_STATUS_LABELS: Record<SaleCaseStatus, string> = {
  DILIGENCIA: "Diligência",
  CONTRATACAO: "Contratação",
  CARTORIO: "Cartório",
  ENTREGA: "Entrega",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const PROPERTY_COMMERCIAL_STATUS_LABELS: Record<
  PropertyCommercialStatus,
  string
> = {
  DISPONIVEL: "Disponível",
  RESERVADO: "Reservado",
  SOB_CONTRATO: "Sob contrato",
  VENDIDO: "Vendido",
};

export const PROPERTY_LISTING_STATUS_LABELS: Record<
  PropertyListingStatus,
  string
> = {
  PUBLICADO: "Anúncio publicado",
  PUBLICADO_EM_NEGOCIACAO: "Publicado · em negociação",
  DESPUBLICADO: "Anúncio despublicado",
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTAMENTO: "Apartamento",
  CASA: "Casa",
};

export const PAYMENT_MODALITY_LABELS: Record<PaymentModality, string> = {
  A_VISTA: "À vista",
  FINANCIADO: "Financiado",
};

export const TRANSVERSAL_BLOCK_LABELS: Record<TransversalBlockType, string> = {
  PENDENTE_INFORMACAO: "Pendente de informação",
  AGUARDANDO_FINANCIAMENTO: "Aguardando financiamento",
  EXIGENCIA_CARTORIAL: "Exigência cartorial",
};

export const OFFER_VERSION_STATUS_LABELS: Record<
  SaleOfferVersionStatus,
  string
> = {
  ENVIADA: "Aguardando decisão",
  ACEITA: "Aceita",
  REJEITADA: "Rejeitada",
  EXPIRADA: "Expirada",
};

export const OFFER_AUTHOR_LABELS: Record<SaleOfferAuthorRole, string> = {
  COMPRADOR: "Proposta do comprador",
  VENDEDOR: "Contraproposta do vendedor",
};

export const CHECKLIST_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  PENDENTE: "Pendente",
  ACEITO: "Aceito",
  DISPENSADO: "Dispensado",
  REPROVADO: "Reprovado",
};

export const TIMELINE_EVENT_TYPE_LABELS: Record<TimelineEvent["type"], string> =
  {
    OPORTUNIDADE_CRIADA: "Oportunidade aberta",
    PROPOSTA_ENVIADA: "Proposta enviada",
    CONTRAPROPOSTA_ENVIADA: "Contraproposta",
    PROPOSTA_REJEITADA: "Proposta rejeitada",
    PROPOSTA_EXPIRADA: "Proposta expirada",
    PROPOSTA_ACEITA: "Proposta aceita",
    OPORTUNIDADE_PERDIDA: "Negociação perdida",
    DOSSIE_ABERTO: "Dossiê aberto",
    CHECKLIST_ATUALIZADO: "Checklist atualizado",
    BLOQUEIO_REGISTRADO: "Pendência registrada",
    BLOQUEIO_RESOLVIDO: "Pendência resolvida",
    MARCO_CONCLUIDO: "Marco concluído",
    DOSSIE_CANCELADO: "Dossiê cancelado",
  };


