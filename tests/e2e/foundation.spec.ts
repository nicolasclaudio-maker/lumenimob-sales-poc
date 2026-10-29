import { expect, test } from "@playwright/test";

const STORAGE_KEY = "lumenimob-sales-poc:v1";

test.describe("Fundação U1 — Módulo Gestão de Vendas", () => {
  test("abre a rota raiz (/) diretamente no módulo Gestão de Vendas, sem avisos de POC ou erros de console/rede", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const externalRequests: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.protocol.startsWith("http") &&
        url.hostname !== "localhost" &&
        url.hostname !== "127.0.0.1"
      ) {
        externalRequests.push(request.url());
      }
    });

    await page.goto("/");

    // Nenhum banner de protótipo ou poluição meta na interface
    await expect(page.locator('[data-testid="prototype-banner"]')).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("heading", { name: "Gestão de vendas" }),
    ).toBeVisible();
    await expect(
      page.getByText("Horizonte Negócios Imobiliários"),
    ).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/protótipo|fictíci|sintétic|Cenários C1/i);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test("exibe indicadores da carteira em /sales e executa Restaurar ambiente com confirmação", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/sales");

    await expect(
      page.getByRole("heading", { name: "Gestão de vendas" }),
    ).toBeVisible();

    const summary = page.getByTestId("fixture-summary");
    await expect(summary).toBeVisible();
    await expect(page.getByTestId("summary-pending-decisions")).toContainText(
      "2 propostas aguardando decisão",
    );
    await expect(page.getByTestId("summary-cases-with-pending")).toContainText(
      "3 dossiês com pendência",
    );

    // Contagens consolidadas diretamente nas abas (sem duplicação na barra superior)
    await expect(page.getByTestId("tab-opportunities-count")).toHaveText("7");
    await expect(page.getByTestId("closed-items-count")).toHaveText("1");
    await expect(page.getByTestId("tab-cases-count")).toHaveText("3");
    await expect(page.getByTestId("tab-properties-count")).toHaveText("6");

    await expect(page.getByTestId("filters-section")).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Oportunidades/i }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Dossiês/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Por imóvel/i })).toBeVisible();

    // Kanban de oportunidades segue §4.1: 3 colunas por padrão; Perdida via filtro de encerradas
    await expect(page.getByTestId("opp-column-ATENDIMENTO")).toBeVisible();
    await expect(page.getByTestId("opp-column-EM_PROPOSTA")).toBeVisible();
    await expect(page.getByTestId("opp-column-ACEITA")).toBeVisible();
    await expect(page.getByTestId("opp-column-PERDIDA")).toHaveCount(0);
    await page.getByTestId("toggle-show-closed").check();
    await expect(page.getByTestId("opp-column-PERDIDA")).toBeVisible();

    const resetButton = page.getByTestId("reset-demo-button");
    await expect(resetButton).toBeVisible();
    await expect(resetButton).toContainText("Restaurar ambiente");
    await resetButton.click();

    await expect(page.getByTestId("reset-demo-dialog")).toBeVisible();
    await page.getByTestId("confirm-reset-demo-button").click();

    await expect(page.getByTestId("reset-feedback-badge")).toHaveText(
      "Ambiente restaurado",
    );

    const persistedRaw = await page.evaluate((key) => {
      return window.localStorage.getItem(key);
    }, STORAGE_KEY);
    expect(persistedRaw).not.toBeNull();

    expect(consoleErrors).toEqual([]);
  });

  test("recupera automaticamente a carteira atualizada se o localStorage contiver JSON inválido ou schemaVersion anterior", async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, "{invalid-json");
    }, STORAGE_KEY);

    await page.goto("/");

    await expect(page.getByTestId("tab-properties-count")).toHaveText("6");
    await expect(page.getByTestId("tab-opportunities-count")).toHaveText("7");
    await expect(page.getByTestId("closed-items-count")).toHaveText("1");
    await expect(
      page.getByText("Edifício Solar dos Ipês — Apto 101").first(),
    ).toBeVisible();
  });
});
