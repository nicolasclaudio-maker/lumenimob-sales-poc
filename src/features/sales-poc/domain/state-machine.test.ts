import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acceptOfferVersion,
  advanceCaseToContratacao,
  cancelSaleCase,
  completeSaleMilestone,
  createOpportunity,
  derivePropertyStatus,
  markOpportunityLost,
  NON_TRANSFER_LEGAL_NOTICE,
  REGISTERED_LEGAL_NOTICE,
  registerTransversalBlock,
  rejectOfferVersion,
  resolveTransversalBlock,
  submitOfferVersion,
  updateChecklistItem,
} from "./state-machine.ts";
import type { SalesPocFixture } from "./types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../");
const fixturePath = path.join(repoRoot, "src/data/fixtures.json");

function loadFreshFixture(): SalesPocFixture {
  return JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as SalesPocFixture;
}

test("Fixture inicial respeita §6 e sincronismo de status §4.4 (AC5)", () => {
  const fixture = loadFreshFixture();

  assert.equal(fixture.brokers.length, 3);
  assert.equal(fixture.properties.length, 6);
  assert.equal(fixture.buyers.length, 5);
  assert.equal(fixture.sellers.length, 6);
  assert.equal(fixture.opportunities.length, 8);

  assert.match(fixture.brokerage.maskedCnpj, /^\d{2}\.\*\*\*\.\*\*\*\/\d{4}-\d{2}$/);
  for (const buyer of fixture.buyers) {
    assert.match(buyer.maskedDocument, /^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
  }
  for (const seller of fixture.sellers) {
    assert.match(seller.maskedDocument, /^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
  }

  for (const property of fixture.properties) {
    const derived = derivePropertyStatus(fixture, property.id);
    assert.equal(
      property.commercialStatus,
      derived.commercialStatus,
      `Status comercial divergente em ${property.code}`,
    );
    assert.equal(
      property.listingStatus,
      derived.listingStatus,
      `Status de anúncio divergente em ${property.code}`,
    );
  }
});

test("AC1 + AC3 + AC5: percorre C1 completo do passo 1 ao 13 com invariantes de propriedade", () => {
  let state = loadFreshFixture();

  // Passo 1: Comprador Fictício 01 demonstra interesse em 2 imóveis
  const buyer01 = state.buyers.find((b) => b.id === "buyer-01");
  assert.ok(buyer01);
  assert.equal(buyer01.interestedPropertyIds.length, 2);

  // Passo 2: Corretor cria oportunidade para Imóvel A (prop-06 — 1 comprador × 1 imóvel)
  const createdOppRes = createOpportunity(state, {
    buyerId: "buyer-01",
    propertyId: "prop-06",
    brokerId: "broker-01",
  });
  assert.equal(createdOppRes.ok, true);
  if (!createdOppRes.ok) return;
  state = createdOppRes.next;
  const oppId = createdOppRes.createdOpportunityId!;

  // Passo 3: Autorização de venda vigente
  const propA = state.properties.find((p) => p.id === "prop-06")!;
  assert.equal(propA.saleAuthorization.status, "VIGENTE");
  assert.equal(propA.commercialStatus, "DISPONIVEL");

  // Passo 4: Comprador envia proposta v1 (financiada)
  const v1Res = submitOfferVersion(state, {
    opportunityId: oppId,
    authorRole: "COMPRADOR",
    amount: 1100000,
    downPaymentAmount: 300000,
    financingAmount: 800000,
    paymentModality: "FINANCIADO",
    validUntil: "2026-11-15",
    conditions: "Entrada com recursos próprios e saldo financiado.",
    expectedCommissionAmount: 66000,
  });
  assert.equal(v1Res.ok, true);
  if (!v1Res.ok) return;
  state = v1Res.next;

  // Passo 5: Vendedor registra contraproposta v2; v1 permanece visível e imutável (AC3)
  const v2Res = submitOfferVersion(state, {
    opportunityId: oppId,
    authorRole: "VENDEDOR",
    amount: 1130000,
    downPaymentAmount: 330000,
    financingAmount: 800000,
    paymentModality: "FINANCIADO",
    validUntil: "2026-11-18",
    conditions: "Contraproposta ajustando parcela de recursos próprios.",
    expectedCommissionAmount: 67800,
  });
  assert.equal(v2Res.ok, true);
  if (!v2Res.ok) return;
  state = v2Res.next;

  const oppAfterV2 = state.opportunities.find((o) => o.id === oppId)!;
  const offer = state.offers.find((o) => o.id === oppAfterV2.offerId)!;
  assert.equal(offer.versions.length, 2);
  assert.equal(offer.versions[0].amount, 1100000);
  assert.equal(offer.versions[0].immutableAfterSend, true);
  assert.equal(offer.versions[1].amount, 1130000);
  const v2Id = offer.versions[1].id;

  // Passo 6: Comprador aceita v2 → imóvel Reservado → dossiê criado em DILIGENCIA
  const acceptRes = acceptOfferVersion(state, {
    opportunityId: oppId,
    versionId: v2Id,
  });
  assert.equal(acceptRes.ok, true);
  if (!acceptRes.ok) return;
  state = acceptRes.next;
  const caseId = acceptRes.createdCaseId!;

  const propAfterAccept = state.properties.find((p) => p.id === "prop-06")!;
  assert.equal(propAfterAccept.commercialStatus, "RESERVADO");
  assert.equal(propAfterAccept.listingStatus, "PUBLICADO_EM_NEGOCIACAO");

  let saleCase = state.cases.find((c) => c.id === caseId)!;
  assert.equal(saleCase.status, "DILIGENCIA");
  assert.equal(saleCase.checklistVariant, "FINANCIADO");
  assert.equal(saleCase.checklist.length, 4);

  // Passo 7: Checklist resolvido; dispensa sem justificativa falha e com justificativa passa
  const [chk1, chk2, chk3, chk4] = saleCase.checklist;
  for (const item of [chk1, chk2, chk3]) {
    const res = updateChecklistItem(state, {
      caseId,
      itemId: item.id,
      status: "ACEITO",
    });
    assert.equal(res.ok, true);
    if (res.ok) state = res.next;
  }

  const invalidWaiver = updateChecklistItem(state, {
    caseId,
    itemId: chk4.id,
    status: "DISPENSADO",
    waiverJustification: "   ",
  });
  assert.equal(invalidWaiver.ok, false);

  const validWaiver = updateChecklistItem(state, {
    caseId,
    itemId: chk4.id,
    status: "DISPENSADO",
    waiverJustification:
      "Laudo complementar dispensado nesta fase mediante pré-aprovação sintética.",
  });
  assert.equal(validWaiver.ok, true);
  if (!validWaiver.ok) return;
  state = validWaiver.next;

  // Passo 8: Bloqueio "Aguardando financiamento" aparece, impede avanço e depois é resolvido
  const finBlockRes = registerTransversalBlock(state, {
    caseId,
    type: "AGUARDANDO_FINANCIAMENTO",
    title: "Aguardando financiamento bancário",
    description: "Conferência final de crédito habitacional sintético.",
  });
  assert.equal(finBlockRes.ok, true);
  if (!finBlockRes.ok) return;
  state = finBlockRes.next;

  const blockedAdvance = advanceCaseToContratacao(state, { caseId });
  assert.equal(blockedAdvance.ok, false);
  if (!blockedAdvance.ok) {
    assert.equal(blockedAdvance.code, "ACTIVE_BLOCK");
  }

  saleCase = state.cases.find((c) => c.id === caseId)!;
  const finBlockId = saleCase.blocks[0].id;
  const resolveFinRes = resolveTransversalBlock(state, {
    caseId,
    blockId: finBlockId,
    resolutionNote: "Conformidade bancária sintética emitida.",
  });
  assert.equal(resolveFinRes.ok, true);
  if (!resolveFinRes.ok) return;
  state = resolveFinRes.next;

  const advanceRes = advanceCaseToContratacao(state, { caseId });
  assert.equal(advanceRes.ok, true);
  if (!advanceRes.ok) return;
  state = advanceRes.next;
  assert.equal(state.cases.find((c) => c.id === caseId)!.status, "CONTRATACAO");

  // Passo 9: Compromisso assinado → imóvel Sob contrato → aviso explícito de não transferência
  const msCompromisso = completeSaleMilestone(state, {
    caseId,
    milestoneCode: "COMPROMISSO_ASSINADO",
  });
  assert.equal(msCompromisso.ok, true);
  if (!msCompromisso.ok) return;
  state = msCompromisso.next;

  saleCase = state.cases.find((c) => c.id === caseId)!;
  assert.equal(saleCase.status, "CARTORIO");
  assert.equal(saleCase.legalNotice, NON_TRANSFER_LEGAL_NOTICE);
  const propAfterCommitment = state.properties.find((p) => p.id === "prop-06")!;
  assert.equal(propAfterCommitment.commercialStatus, "SOB_CONTRATO");
  assert.equal(propAfterCommitment.listingStatus, "DESPUBLICADO");

  // Tentar pular para TITULO_REGISTRADO antes da escritura/protocolo deve falhar
  const skipAttempt = completeSaleMilestone(state, {
    caseId,
    milestoneCode: "TITULO_REGISTRADO",
  });
  assert.equal(skipAttempt.ok, false);

  // Passo 10: Escritura lavrada → Título protocolado (ainda SOB_CONTRATO)
  const msEscritura = completeSaleMilestone(state, {
    caseId,
    milestoneCode: "ESCRITURA_LAVRADA",
  });
  assert.equal(msEscritura.ok, true);
  if (msEscritura.ok) state = msEscritura.next;

  const msProtocolo = completeSaleMilestone(state, {
    caseId,
    milestoneCode: "TITULO_PROTOCOLADO",
  });
  assert.equal(msProtocolo.ok, true);
  if (msProtocolo.ok) state = msProtocolo.next;
  assert.equal(
    state.properties.find((p) => p.id === "prop-06")!.commercialStatus,
    "SOB_CONTRATO",
  );

  // Passo 11: Exigência cartorial registrada, impede registro, é cumprida e reapresentada
  const cartBlockRes = registerTransversalBlock(state, {
    caseId,
    type: "EXIGENCIA_CARTORIAL",
    title: "Nota devolutiva sintética",
    description: "Atualização de certidão municipal fictícia.",
  });
  assert.equal(cartBlockRes.ok, true);
  if (cartBlockRes.ok) state = cartBlockRes.next;

  const blockedRegistro = completeSaleMilestone(state, {
    caseId,
    milestoneCode: "TITULO_REGISTRADO",
  });
  assert.equal(blockedRegistro.ok, false);

  const cartBlockId = state.cases.find((c) => c.id === caseId)!.blocks[1].id;
  const resolveCartRes = resolveTransversalBlock(state, {
    caseId,
    blockId: cartBlockId,
    resolutionNote: "Exigência cumprida e título reapresentado ao cartório.",
  });
  assert.equal(resolveCartRes.ok, true);
  if (resolveCartRes.ok) state = resolveCartRes.next;

  // Passo 12: Título registrado → imóvel finalmente Vendido
  const msRegistro = completeSaleMilestone(state, {
    caseId,
    milestoneCode: "TITULO_REGISTRADO",
  });
  assert.equal(msRegistro.ok, true);
  if (msRegistro.ok) state = msRegistro.next;

  saleCase = state.cases.find((c) => c.id === caseId)!;
  assert.equal(saleCase.status, "ENTREGA");
  assert.equal(saleCase.legalNotice, REGISTERED_LEGAL_NOTICE);
  assert.equal(
    state.properties.find((p) => p.id === "prop-06")!.commercialStatus,
    "VENDIDO",
  );

  // Passo 13: Chaves entregues → dossiê Concluído
  const msChaves = completeSaleMilestone(state, {
    caseId,
    milestoneCode: "CHAVES_ENTREGUES",
  });
  assert.equal(msChaves.ok, true);
  if (msChaves.ok) state = msChaves.next;

  assert.equal(state.cases.find((c) => c.id === caseId)!.status, "CONCLUIDO");
});

test("AC2 + AC4 + AC5: executa cenários alternativos C2, C3, C4, C5 e C6 a partir da fixture", () => {
  let state = loadFreshFixture();

  // C2 (opp-02): rejeitar v2 e enviar v3 preservando cadeia v1..v3
  const rejectC2 = rejectOfferVersion(state, {
    opportunityId: "opp-02",
    versionId: "offer-01-v2",
    reason: "Prazo de pagamento solicitado ajustado pelos coproprietários.",
  });
  assert.equal(rejectC2.ok, true);
  if (rejectC2.ok) state = rejectC2.next;

  const v3C2 = submitOfferVersion(state, {
    opportunityId: "opp-02",
    authorRole: "COMPRADOR",
    amount: 1235000,
    downPaymentAmount: 1235000,
    financingAmount: 0,
    paymentModality: "A_VISTA",
    validUntil: "2026-11-20",
    conditions: "Pagamento integral à vista na escritura.",
    expectedCommissionAmount: 74100,
  });
  assert.equal(v3C2.ok, true);
  if (v3C2.ok) state = v3C2.next;
  const offer01 = state.offers.find((o) => o.id === "offer-01")!;
  assert.equal(offer01.versions.length, 3);
  assert.equal(offer01.versions[0].amount, 1150000);
  assert.equal(offer01.versions[1].amount, 1210000);
  assert.equal(offer01.versions[2].amount, 1235000);

  // C3 + AC4 (opp-04 concorrente em prop-03 já reservado por opp-03/case-01): segundo aceite bloqueado
  const secondAccept = acceptOfferVersion(state, {
    opportunityId: "opp-04",
    versionId: "offer-03-v1",
  });
  assert.equal(secondAccept.ok, false);
  if (!secondAccept.ok) {
    assert.equal(secondAccept.code, "PROPERTY_ALREADY_RESERVED");
    assert.match(secondAccept.message, /Segundo aceite bloqueado/i);
  }

  // C4: encerrar oportunidade pré-aceite como PERDIDA exige motivo obrigatório
  const emptyLoss = markOpportunityLost(state, {
    opportunityId: "opp-01",
    lossReason: " ",
  });
  assert.equal(emptyLoss.ok, false);

  const validLoss = markOpportunityLost(state, {
    opportunityId: "opp-01",
    lossReason: "Comprador pausou aquisição neste semestre fictício.",
  });
  assert.equal(validLoss.ok, true);
  if (validLoss.ok) state = validLoss.next;
  assert.equal(
    state.opportunities.find((o) => o.id === "opp-01")!.status,
    "PERDIDA",
  );

  // C5 (case-02 em prop-04): reprovar item da diligência, cancelar dossiê e retornar imóvel a DISPONIVEL
  const reproveItem = updateChecklistItem(state, {
    caseId: "case-02",
    itemId: "chk-02-1",
    status: "REPROVADO",
  });
  assert.equal(reproveItem.ok, true);
  if (reproveItem.ok) state = reproveItem.next;

  const cancelC5 = cancelSaleCase(state, {
    caseId: "case-02",
    cancellationReason:
      "Diligência documental reprovada por apontamento impeditivo sintético.",
  });
  assert.equal(cancelC5.ok, true);
  if (cancelC5.ok) state = cancelC5.next;

  assert.equal(
    state.cases.find((c) => c.id === "case-02")!.status,
    "CANCELADO",
  );
  const prop04 = state.properties.find((p) => p.id === "prop-04")!;
  assert.equal(prop04.commercialStatus, "DISPONIVEL");
  assert.equal(prop04.listingStatus, "PUBLICADO");

  // C6 (opp-07 com offer-05-v1 EXPIRADA): não aceita versão expirada, mas aceita nova versão v2
  const acceptExpired = acceptOfferVersion(state, {
    opportunityId: "opp-07",
    versionId: "offer-05-v1",
  });
  assert.equal(acceptExpired.ok, false);

  const renewC6 = submitOfferVersion(state, {
    opportunityId: "opp-07",
    authorRole: "COMPRADOR",
    amount: 1200000,
    downPaymentAmount: 1200000,
    financingAmount: 0,
    paymentModality: "A_VISTA",
    validUntil: "2026-11-25",
    conditions: "Nova proposta revalidando prazo comercial.",
    expectedCommissionAmount: 72000,
  });
  assert.equal(renewC6.ok, true);
});

function listFilesRecursively(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

test("AC6 + AC7: governança estrita de linguagem, isolamento de dependências e zero chamadas de rede", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const allDeps = Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }).join(" ");
  assert.doesNotMatch(
    allDeps,
    /supabase|redis|ioredis|bullmq|asaas|zapsign|d4sign|axios/i,
  );

  const rentalTermsPattern = new RegExp(
    [
      "inquilin",
      "locatári",
      "locador",
      "aluguel",
      "cauç",
      "vistoria de entrada",
      "repasse",
      "parcela mensal",
    ].join("|"),
    "i",
  );

  const prematureTransferPattern = new RegExp(
    ["novo proprietário", "\\btransferido\\b"].join("|"),
    "i",
  );

  const metaPollutionPattern = new RegExp(
    [
      "prot[óo]tipo",
      "fict[íi]ci",
      "sint[ée]tic",
      "\\bdemo\\b",
      "Cen[áa]rio C[1-6]",
      "Roteiro C[1-6]",
      "Decis[ãa]o D[0-9]",
      "Regra AC[0-9]",
    ].join("|"),
    "i",
  );

  const srcFiles = listFilesRecursively(path.join(repoRoot, "src")).filter(
    (file) => !file.endsWith(".test.ts"),
  );

  for (const file of srcFiles) {
    const rel = path.relative(repoRoot, file);
    const content = fs.readFileSync(file, "utf-8");

    assert.doesNotMatch(
      content,
      rentalTermsPattern,
      `Termo locatício proibido detectado em ${rel}`,
    );
    assert.doesNotMatch(
      content,
      prematureTransferPattern,
      `Termo de transferência prematura proibido detectado em ${rel}`,
    );
    assert.doesNotMatch(
      content,
      /\bfetch\s*\(|XMLHttpRequest|imobsaas|supabase/i,
      `Referência externa ou de rede proibida detectada em ${rel}`,
    );

    if (
      rel === "src/data/fixtures.json" ||
      rel.startsWith("src/app/") ||
      rel.startsWith("src/features/sales-poc/components/")
    ) {
      // Remove comentários de linha/bloco antes de verificar imersão visual da UI e fixture
      const stripped = content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/data-testid="[^"]*"/g, "")
        .replace(/ResetDemoDialog/g, "")
        .replace(/resetDemo/g, "")
        .replace(/reset-demo-dialog/g, "");
      assert.doesNotMatch(
        stripped,
        metaPollutionPattern,
        `Jargão meta de POC/protótipo/sintético detectado em ${rel}`,
      );
    }
  }
});

