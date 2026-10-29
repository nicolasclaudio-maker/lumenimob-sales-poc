import { expect, test } from "@playwright/test";

test.describe("U2 & U3 — Roteiros C1–C6 e Critérios AC1–AC7", () => {
  test("AC1 + AC3 + AC5 + AC6: percorre C1 completo do passo 1 ao 13 sem recarregar dados manualmente", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const externalRequests: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (
        url.protocol.startsWith("http") &&
        url.hostname !== "localhost" &&
        url.hostname !== "127.0.0.1"
      ) {
        externalRequests.push(req.url());
      }
    });

    await page.goto("/sales");

    // Passos 1 e 2: Atendimento demonstra interesse em 2 imóveis → Corretor cria oportunidade para Imóvel A (prop-06)
    await page.getByTestId("open-attendance-modal-btn").click();
    const buyer01Card = page.getByTestId("attendance-card-buyer-01");
    await expect(buyer01Card).toContainText("2 imóveis de interesse");
    await page.getByTestId("create-opp-buyer-01-prop-06").click();

    // Passo 3: Detalhe exibe autorização de venda vigente e imóvel Disponível
    await expect(page.getByTestId("opportunity-detail-panel")).toBeVisible();
    await expect(
      page.getByTestId("sale-authorization-status-badge"),
    ).toHaveText("VIGENTE");
    await expect(
      page.getByTestId("opportunity-property-status-badge"),
    ).toContainText("Disponível");

    // Passo 4: Comprador envia proposta v1 (financiada)
    await page.getByTestId("open-offer-composer-btn").click();
    await page.getByTestId("offer-modality-select").selectOption("FINANCIADO");
    await page.getByTestId("offer-amount-input").fill("1100000");
    await page.getByTestId("offer-downpayment-input").fill("300000");
    await expect(page.getByTestId("offer-financing-readonly")).toContainText(
      "800.000",
    );
    await page.getByTestId("submit-offer-version-btn").click();

    await expect(page.getByTestId("offer-version-card-v1")).toBeVisible();
    await expect(page.getByTestId("immutable-badge-v1")).toContainText(
      "Imutável após envio",
    );

    // Passo 5: Vendedor registra contraproposta v2; v1 permanece visível + comparação lado a lado
    await page.getByTestId("open-counteroffer-composer-btn").click();
    await page.getByTestId("offer-amount-input").fill("1130000");
    await page.getByTestId("offer-downpayment-input").fill("330000");
    await page.getByTestId("submit-offer-version-btn").click();

    await expect(page.getByTestId("offer-version-card-v1")).toBeVisible();
    await expect(page.getByTestId("offer-version-card-v2")).toBeVisible();

    await page.getByTestId("open-offer-compare-btn").click();
    await expect(page.getByTestId("offer-comparison-view")).toContainText(
      "1.100.000",
    );
    await expect(page.getByTestId("offer-comparison-view")).toContainText(
      "1.130.000",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("offer-composer-modal")).toHaveCount(0);

    // Passo 6: Comprador aceita v2 → imóvel Reservado → dossiê criado
    await page.getByTestId("accept-version-btn-v2").click();
    await expect(
      page.getByTestId("opportunity-property-status-badge"),
    ).toContainText("Reservado");
    await expect(
      page.getByTestId("opportunity-property-listing-text"),
    ).toContainText("Publicado · em negociação");

    await page.getByTestId("open-linked-case-btn").click();
    await expect(page.getByTestId("sale-case-detail-panel")).toBeVisible();
    await expect(page.getByTestId("case-stage-badge")).toContainText(
      "Diligência",
    );

    // Verifica botão Editar checklist inerte (D8)
    await page.getByTestId("inert-edit-checklist-btn").click();
    await expect(page.getByTestId("inert-edit-checklist-notice")).toBeVisible();

    // Passo 7: Checklist (variante financiada) resolvido; 1 item dispensado com justificativa
    await page.getByTestId("accept-checklist-btn-MATRICULA_ATUALIZADA").click();
    await page.getByTestId("accept-checklist-btn-CERTIDOES_VENDEDORES").click();
    await page.getByTestId("accept-checklist-btn-DOCUMENTOS_COMPRADOR").click();

    await page
      .getByTestId("waive-checklist-toggle-CREDITO_ENGENHARIA_FINANCIAMENTO")
      .click();
    await page
      .getByTestId(
        "waive-justification-input-CREDITO_ENGENHARIA_FINANCIAMENTO",
      )
      .fill("Carta de crédito pré-aprovada anexada para contratação.");
    await page
      .getByTestId(
        "confirm-waive-checklist-btn-CREDITO_ENGENHARIA_FINANCIAMENTO",
      )
      .click();

    // Passo 8: Bloqueio "Aguardando financiamento" aparece, impede avanço e é resolvido
    await page.getByTestId("toggle-new-block-form-btn").click();
    await page
      .getByTestId("new-block-type-select")
      .selectOption("AGUARDANDO_FINANCIAMENTO");
    await page
      .getByTestId("new-block-title-input")
      .fill("Aguardando financiamento");
    await page
      .getByTestId("new-block-desc-input")
      .fill("Validação final da minuta contratual pelo banco financiador.");
    await page.getByTestId("submit-new-block-btn").click();

    // Tenta avançar com bloqueio ativo → impedido
    await page.getByTestId("advance-to-contratacao-btn").click();
    await expect(page.getByTestId("case-domain-alert")).toContainText(
      "Avanço impedido por bloqueio transversal ativo",
    );

    // Resolve o bloqueio de financiamento (formulário sob demanda) e avança para Contratação
    await page.locator('[data-testid^="open-resolve-block-"]').first().click();
    const finResolveInput = page.locator('[data-testid^="resolve-block-input-"]').first();
    await finResolveInput.fill("Conformidade jurídica e engenharia liberadas pelo banco.");
    await page.locator('[data-testid^="resolve-block-btn-"]').first().click();

    await page.getByTestId("advance-to-contratacao-btn").click();
    await expect(page.getByTestId("case-stage-badge")).toContainText(
      "Contratação",
    );

    // Passo 9: Compromisso assinado → imóvel Sob contrato → aviso explícito de não transferência
    await page.getByTestId("case-tab-milestones").click();
    await page
      .getByTestId("complete-milestone-btn-COMPROMISSO_ASSINADO")
      .click();
    await expect(page.getByTestId("case-property-status-badge")).toContainText(
      "Sob contrato",
    );
    await expect(page.getByTestId("case-property-listing-badge")).toContainText(
      "Anúncio despublicado",
    );
    await expect(page.getByTestId("case-legal-banner")).toContainText(
      "Compromisso assinado — a propriedade ainda não foi transferida",
    );

    // Passo 10: Escritura lavrada → Título protocolado
    await page.getByTestId("complete-milestone-btn-ESCRITURA_LAVRADA").click();
    await page.getByTestId("complete-milestone-btn-TITULO_PROTOCOLADO").click();
    await expect(page.getByTestId("case-property-status-badge")).toContainText(
      "Sob contrato",
    );

    // Passo 11: Exigência cartorial registrada, impede registro, é cumprida e reapresentada
    await page.getByTestId("toggle-new-block-form-btn").click();
    await page
      .getByTestId("new-block-type-select")
      .selectOption("EXIGENCIA_CARTORIAL");
    await page
      .getByTestId("new-block-title-input")
      .fill("Nota devolutiva do 10º CRI/SP");
    await page
      .getByTestId("new-block-desc-input")
      .fill("Solicitada certidão de dados cadastrais atualizada do imóvel.");
    await page.getByTestId("submit-new-block-btn").click();

    await page.getByTestId("complete-milestone-btn-TITULO_REGISTRADO").click();
    await expect(page.getByTestId("case-domain-alert")).toContainText(
      "Conclusão do marco impedida por bloqueio transversal ativo",
    );

    await page.locator('[data-testid^="open-resolve-block-"]').first().click();
    const cartResolveInput = page
      .locator('[data-testid^="resolve-block-input-"]')
      .first();
    await cartResolveInput.fill(
      "Exigência cumprida e título reapresentado ao cartório.",
    );
    await page.locator('[data-testid^="resolve-block-btn-"]').first().click();

    // Passo 12: Título registrado → imóvel Vendido
    await page.getByTestId("complete-milestone-btn-TITULO_REGISTRADO").click();
    await expect(page.getByTestId("case-property-status-badge")).toContainText(
      "Vendido",
    );
    await expect(page.getByTestId("case-legal-banner")).toContainText(
      "Propriedade transferida (registro)",
    );

    // Passo 13: Chaves entregues → dossiê Concluído
    await page.getByTestId("complete-milestone-btn-CHAVES_ENTREGUES").click();
    await expect(page.getByTestId("case-stage-badge")).toContainText(
      "Concluído",
    );

    expect(consoleErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test("AC2 + AC4 + AC5: executa C2, C3, C4, C5 e C6 na interface a partir da fixture", async ({
    page,
  }) => {
    await page.goto("/sales");

    // C3 + AC4: Visão por imóvel mostra concorrência em prop-03 e bloqueia segundo aceite em opp-04
    await page.getByTestId("board-tab-properties").click();
    const prop03Card = page.getByTestId("property-card-prop-03");
    await expect(prop03Card).toContainText("Oportunidades no imóvel (2)");
    await page.getByTestId("property-open-opp-opp-04").click();

    await page.getByTestId("accept-version-btn-v1").click();
    await expect(page.getByTestId("opportunity-domain-alert")).toContainText(
      "Segundo aceite bloqueado",
    );
    await page.getByTestId("back-to-board-btn").click();

    // C2: Proposta rejeitada → nova proposta sem sobrescrita (opp-02)
    await page.getByTestId("board-tab-opportunities").click();
    await page.getByTestId("open-opp-btn-opp-02").click();
    await page.getByTestId("reject-version-toggle-v2").click();
    await page
      .getByTestId("reject-reason-input")
      .fill("Solicitado ajuste de prazo de pagamento.");
    await page.getByTestId("confirm-reject-version-btn").click();

    await page.getByTestId("open-offer-composer-btn").click();
    await page.getByTestId("offer-amount-input").fill("1230000");
    await page.getByTestId("submit-offer-version-btn").click();

    await expect(page.getByTestId("offer-version-card-v1")).toBeVisible();
    await expect(page.getByTestId("offer-version-card-v2")).toBeVisible();
    await expect(page.getByTestId("offer-version-card-v3")).toBeVisible();
    await page.getByTestId("back-to-board-btn").click();

    // C4: Negociação perdida exige motivo obrigatório (opp-01)
    await page.getByTestId("open-opp-btn-opp-01").click();
    await page.getByTestId("toggle-loss-form-btn").click();
    await page.getByTestId("confirm-mark-lost-btn").click();
    await expect(page.getByTestId("opportunity-domain-alert")).toContainText(
      "motivo de perda é obrigatório",
    );
    await page
      .getByTestId("loss-reason-input")
      .fill("Cliente adiou aquisição para o próximo semestre.");
    await page.getByTestId("confirm-mark-lost-btn").click();
    await expect(page.getByTestId("opportunity-status-badge")).toContainText(
      "Perdida",
    );
    await page.getByTestId("back-to-board-btn").click();

    // C6: Badge Expirada visível no card de opp-07 e renovável com nova versão
    await expect(page.getByTestId("expired-badge-opp-07")).toContainText(
      "Expirada",
    );
    await page.getByTestId("open-opp-btn-opp-07").click();
    await page.getByTestId("open-offer-composer-btn").click();
    await page.getByTestId("offer-amount-input").fill("1205000");
    await page.getByTestId("submit-offer-version-btn").click();
    await expect(page.getByTestId("offer-version-card-v2")).toBeVisible();
    await page.getByTestId("back-to-board-btn").click();

    // C5: Diligência reprovada → dossiê cancelado → imóvel prop-04 volta a Disponível
    await page.getByTestId("board-tab-cases").click();
    await page.getByTestId("open-case-btn-case-02").click();
    await page.getByTestId("reprove-checklist-btn-MATRICULA_ATUALIZADA").click();
    await expect(
      page.getByTestId("checklist-status-MATRICULA_ATUALIZADA"),
    ).toContainText("Reprovado");

    await page.getByTestId("toggle-cancel-case-btn").click();
    await page
      .getByTestId("cancel-case-reason-input")
      .fill("Diligência reprovada por gravame impeditivo não baixado.");
    await page.getByTestId("confirm-cancel-case-btn").click();

    await expect(page.getByTestId("case-stage-badge")).toContainText(
      "Cancelado",
    );
    await expect(page.getByTestId("case-property-status-badge")).toContainText(
      "Disponível",
    );
    await expect(page.getByTestId("case-property-listing-badge")).toContainText(
      "Anúncio publicado",
    );
  });
});

