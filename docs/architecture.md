# Arquitetura da POC (`lumenimob-sales-poc`)

## 1. Visão Geral: Aplicação 100% Client-Side

Esta POC foi projetada como uma **aplicação estática puramente client-side** (`output: "export"` no Next.js 16):

- **Sem backend próprio:** não existem Server Actions, Route Handlers (`app/api/*`), middlewares de sessão ou processos em segundo plano.
- **Sem banco de dados:** toda leitura e escrita ocorre em memória no navegador com espelhamento em `window.localStorage`.
- **Sem integrações externas:** a aplicação não realiza chamadas HTTP para serviços do produto principal nem para provedores externos de assinatura, financiamento, pagamentos, portais ou registro imobiliário.

```text
[src/data/fixtures.json]
          │ (carga inicial / fallback / reset)
          ▼
[local-sales-repository.ts] ◄──► window.localStorage ("lumenimob-sales-poc:v1")
          │
          ▼
[sales-poc-store.tsx] ◄──► [state-machine.ts] (transições puras e imutáveis §4)
          │
          ▼
[Componentes Client em /sales (Telas 1–4)]
```

---

## 2. Fixture Sintética e Persistência em `localStorage`

1. **Fonte inicial (`src/data/fixtures.json`):** arquivo JSON estático versionado contendo 100% de registros fictícios (nomes explícitos de demonstração, documentos mascarados `000.000.000-00` e domínios reservados `.invalid`).
2. **Envelope versionado (`local-sales-repository.ts`):**
   - Chave: `lumenimob-sales-poc:v1`
   - Versão do schema local: `schemaVersion: 1`
   - Validação defensiva: se o JSON salvo estiver inválido, truncado ou com `schemaVersion` divergente, o repositório descarta o payload inválido e restaura silenciosamente `cloneInitialFixture()`.
3. **Prevenção de erro de hidratação (`sales-poc-store.tsx`):**
   - Utiliza `React.useSyncExternalStore` com `getServerSnapshot` retornando sempre a fixture estática inicial durante o pré-render estático e a hidratação inicial, sincronizando com o `localStorage` imediatamente no cliente sem disparar avisos de hidratação nem `setState` síncrono em `useEffect`.

---

## 3. Separação entre Oportunidade e Dossiê como Hipótese da POC

Na interface e nos dados desta POC, a jornada aparece dividida em duas visões operacionais:

1. **`SaleOpportunity` (pré-aceite):** representa o interesse comercial `1 comprador × 1 imóvel`, propostas e contrapropostas versionadas (`SaleOffer` / `SaleOfferVersion`) até o aceite ou perda.
2. **`SaleCase` (dossiê pós-aceite):** nasce exclusivamente a partir do aceite de uma versão de proposta (`D6`), concentrando checklist documental (à vista ou financiado), bloqueios transversais e marcos formais até `TITULO_REGISTRADO` e `CHAVES_ENTREGUES`.

### Decisão `D2` pendente de ADR

Conforme documentado em `docs/task.md` (§10, `D2` — `NEEDS_DECISION`):

- A separação `SaleOpportunity` + `SaleCase` nesta POC serve **apenas para testar a clareza cognitiva e operacional** junto a corretores e gestores nas sessões de validação (`U4`).
- Ela **não decide** se o domínio futuro em produção terá dois agregados distintos (`sale_opportunity` + `sale_case`) ou um agregado único com fases. Essa decisão pertence exclusivamente ao ADR do spike técnico (`U6`).

---

## 4. Os Dados da POC Não Definem o Schema Final

- As interfaces em `src/features/sales-poc/domain/types.ts` otimizam legibilidade e prototipação rápida no navegador.
- Elas **não contemplam** requisitos de produção como isolamento multi-tenant (RLS), auditoria criptográfica, idempotência, locks de concorrência para aceites simultâneos, versionamento relacional ou conformidade regulatória.
- Nenhum contrato deste repositório deve ser migrado literalmente para tabelas ou APIs do produto principal.

