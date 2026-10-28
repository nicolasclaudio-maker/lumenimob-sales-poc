# Guia de Desenvolvimento (`lumenimob-sales-poc`)

Antes de qualquer alteração funcional, leia `docs/task.md` e `AGENTS.md`.

---

## 1. Como Adicionar ou Ajustar Dados na Fixture

A massa inicial fica centralizada em `src/data/fixtures.json` e é validada estaticamente contra `SalesPocFixture` (`src/features/sales-poc/domain/types.ts`).

Ao editar `src/data/fixtures.json`:

1. Use **dados verossímeis de mercado sem PII real**:
   - Nomes e imóveis brasileiros naturais, porém inventados (ex.: `Mariana Duarte`, `Edifício Solar dos Ipês — Apto 101`), sem jargões robóticos como `"Fictício"`, `"Sintético"` ou `"Demo"`;
   - Documentos parcialmente mascarados no padrão LGPD: `***.XXX.XXX-**` (CPF) e `XX.***.***/0001-**` (CNPJ);
   - Matrículas e certidões com nomenclatura realista de mercado, sem mencionar códigos `C1–C6` na UI.
2. Mantenha consistência entre `Property.commercialStatus`, `Property.listingStatus`, `SaleOpportunity.status` e `SaleCase.status` conforme a tabela §4.4 de `docs/task.md`.
3. Se alterar a estrutura ou a massa inicial do JSON de maneira que deva substituir estados já gravados no navegador, incremente `SALES_POC_SCHEMA_VERSION` em `src/features/sales-poc/repositories/local-sales-repository.ts` e rode `npm run typecheck`.

---

## 2. Como Criar Componentes

- **Componentes visuais base (`src/components/ui/`):** componentes genéricos e desacoplados de domínio (baseados em Radix UI + tokens CSS de `src/app/globals.css`). Crie novos primitivos apenas quando estritamente necessários para as telas da `U2`.
- **Componentes funcionais da POC (`src/features/sales-poc/components/`):** componentes específicos da jornada de compra e venda (ex.: cards do kanban, modal comparador de versões de proposta, checklist do dossiê, barra de marcos).
- Utilize `cn(...)` de `@/lib/utils` para compor classes Tailwind e priorize os tokens semânticos (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`).
- Componentes que usam hooks React, eventos ou estado local devem declarar `"use client";` no topo.

---

## 3. Como Usar o Store Local e a Máquina de Estados

O estado da POC é provido por `SalesPocProvider` e consumido via `useSalesPocStore()` (`src/features/sales-poc/store/sales-poc-store.tsx`), delegando todas as transições de negócio ao motor puro `src/features/sales-poc/domain/state-machine.ts`:

```tsx
"use client";

import { acceptOfferVersion } from "@/features/sales-poc/domain";
import { useSalesPocStore } from "@/features/sales-poc/store/sales-poc-store";

export function ExemploAceite({ opportunityId, versionId }: { opportunityId: string; versionId: string }) {
  const { dispatchDomainAction, resetDemo } = useSalesPocStore();

  function confirmarAceite() {
    const result = dispatchDomainAction((currentFixture) =>
      acceptOfferVersion(currentFixture, { opportunityId, versionId }),
    );
    if (!result.ok) {
      // Exibe result.message (ex.: bloqueio AC4 de segundo aceite no mesmo imóvel)
    }
  }

  // ...
}
```

Regras importantes:

- **Nunca** leia `window.localStorage` diretamente durante o corpo de renderização de um componente (isso causa erro no build estático ou divergência de hidratação). Toda persistência passa por `local-sales-repository.ts` e `useSalesPocStore()`.
- Concentre todas as regras de transição, validações e projeção de status do imóvel (`derivePropertyStatus`) nas funções puras de `src/features/sales-poc/domain/state-machine.ts` e acione `dispatchDomainAction(...)` na UI para persistir transições válidas (`result.ok === true`).

---

## 4. Como Restaurar o Ambiente

- **Pela interface:** clique em **Restaurar ambiente** no canto superior direito do cabeçalho e confirme no `AlertDialog`.
- **Programaticamente (em componentes filhos de `SalesPocProvider`):** acione `resetDemo()` retornado por `useSalesPocStore()`, sempre protegido por confirmação explícita do usuário quando acionado na UI.
- **Em testes Playwright:** limpe ou pré-popule `window.localStorage` com `page.addInitScript(...)` ou exercite o próprio botão `data-testid="reset-demo-button"`.

---

## 5. Como Executar Verificações e Testes

Execute sempre a sequência completa antes de finalizar qualquer entrega:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Para depurar os cenários visualmente no Playwright:

```bash
npm run test:e2e:ui
```

---

## 6. Regras Obrigatórias de Linguagem (Domínio de Compra e Venda)

### 6.1 Proibição absoluta de termos locatícios

Esta POC trata exclusivamente de compra e venda. **Nunca** utilize no código, nos rótulos de UI, nas fixtures ou nas mensagens de validação termos de locação, tais como:

- `inquilino` / `locatário` / `locador`
- `aluguel`
- `caução` / `garantia locatícia`
- `vistoria de entrada` / `vistoria de saída`
- `repasse`
- `parcela mensal` (de locação)

### 6.2 Regra estrita sobre `TITULO_REGISTRADO` e transferência de propriedade

No direito imobiliário brasileiro, nem o aceite da proposta, nem o compromisso particular, nem a lavratura da escritura transferem a propriedade — apenas o **registro do título translativo na matrícula do imóvel** (`TITULO_REGISTRADO`). Por isso (`docs/task.md` §4.5 e `AC6`):

1. **Antes de `TITULO_REGISTRADO`:** é proibido exibir "Vendido", "transferido" ou "novo proprietário" em qualquer card, badge, alerta ou evento de timeline.
2. **Status intermediários obrigatórios:**
   - Após aceite da proposta → imóvel `RESERVADO` (anúncio publicado com indicador "em negociação");
   - Após `COMPROMISSO_ASSINADO` → imóvel `SOB_CONTRATO` (anúncio despublicado) e aviso explícito: `"Compromisso assinado — a propriedade ainda não foi transferida"`;
   - Somente após `TITULO_REGISTRADO` → imóvel passa a `VENDIDO`.
3. **Barra de marcos do dossiê:** o marco correspondente a `TITULO_REGISTRADO` deve evidenciar `"Propriedade transferida (registro)"`.

