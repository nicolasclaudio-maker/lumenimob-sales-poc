# LumenImob — POC de Gestão de Vendas (`lumenimob-sales-poc`)

> **PROTÓTIPO — dados fictícios, sem valor jurídico.**  
> Aplicação estritamente demonstrativa. **Proibido reutilizar este código, seus modelos ou seus dados em produção.**

## 1. Objetivo

Este repositório contém a **Prova de Conceito (POC) navegável e isolada** do módulo de **compra e venda imobiliária**, concebida para validar junto a corretores e gestores:

- a jornada de negociação comercial pré-aceite (oportunidade, propostas e contrapropostas versionadas e imutáveis, aceite exclusivo por imóvel);
- a fronteira com o dossiê documental pós-aceite (diligência à vista e financiada, bloqueios transversais e marcos registrais);
- a distinção clara entre **assinatura de compromisso/escritura** e **transferência efetiva da propriedade no registro da matrícula (`TITULO_REGISTRADO`)**;
- o recorte funcional entre MVP e pós-MVP antes de qualquer decisão de schema ou arquitetura definitiva.

### Escopo estrito

- **Incluído:** jornada exclusiva de **compra e venda**.
- **Fora do escopo:** qualquer fluxo, regra, tela ou nomenclatura de **locação**; backend, banco de dados, autenticação, cálculos reais de comissão, assinaturas eletrônicas, pagamentos ou integrações externas.

---

## 2. Stack Técnica

Alinhada visual e tecnicamente à stack base de referência, executando **100% no navegador** e gerando build estático (`output: "export"`):

- **Next.js** `16.2.9` (App Router, exportação estática, apenas Client Components interativos)
- **React** `19.2.4`
- **TypeScript** `5` (`strict: true`)
- **Tailwind CSS** `4` (`@tailwindcss/postcss`)
- **Radix UI** (`alert-dialog`, `tabs`, `tooltip`, `slot`)
- **Utilitários de UI:** `class-variance-authority`, `tailwind-merge`, `lucide-react`, `date-fns` `4`
- **Qualidade e Testes:** ESLint `9` (`eslint-config-next`) e Playwright (`@playwright/test`)

---

## 3. Instalação e Execução

Pré-requisitos: Node.js 20+ (recomendado Node 22) e `npm`. Nenhuma variável de ambiente é necessária (veja `.env.example`).

```bash
# Instalar dependências
npm install

# Executar servidor de desenvolvimento (http://localhost:3000)
npm run dev
```

Rotas e visões disponíveis (U1–U3 concluídas com imersão realista para U4):

- `http://localhost:3000/` e `http://localhost:3000/sales` — abrem diretamente o módulo interativo **Gestão de vendas** simulando um módulo real implementado (sem banners de protótipo ou jargões de especificação), contendo as 4 telas funcionais (Kanban de oportunidades/dossiês e visão por imóvel com filtros, Detalhe da oportunidade com autorização de venda, Propostas/Contrapropostas versionadas com comparador lado a lado, e Dossiê completo com checklist, bloqueios transversais, marcos registrais e timeline), além da carteira de **Atendimentos** e da ação secundária discreta **Restaurar ambiente**.

---

## 4. Verificação, Build Estático e Testes

```bash
# Análise estática (ESLint 9)
npm run lint

# Checagem de tipos TypeScript
npm run typecheck

# Testes determinísticos de máquina de estados e governança (AC1–AC7)
npm run test:unit

# Build estático (gera diretório out/ sem dependência de servidor Node)
npm run build

# Testes E2E em Chromium (Playwright — fundação + cenários C1–C6)
npm run test:e2e

# Interface interativa do Playwright
npm run test:e2e:ui
```

---

## 5. Estrutura de Diretórios

```text
├── AGENTS.md                        # Regras obrigatórias de escopo, linguagem e qualidade
├── docs/
│   ├── task.md                      # Especificação funcional canônica (D1–D11, C1–C6, AC1–AC12)
│   ├── architecture.md              # Arquitetura client-only, localStorage e limites de domínio
│   └── development.md               # Guia prático para evoluir a POC
├── public/
│   └── prototype-mark.svg           # Ícone sintético local
├── src/
│   ├── app/
│   │   ├── globals.css              # Tokens visuais isolados (Paper / Ink / Brass)
│   │   ├── layout.tsx               # Layout raiz limpo
│   │   ├── page.tsx                 # Entrada principal abrindo direto Gestão de Vendas
│   │   └── sales/
│   │       └── page.tsx             # Rota espelhada do módulo de vendas
│   ├── components/
│   │   └── ui/                      # Componentes visuais mínimos (Button, Badge, Card, Tabs, AlertDialog, Tooltip, PageContainer)
│   ├── data/
│   │   └── fixtures.json            # Carteira verossímil de mercado sem PII real (CPFs LGPD mascarados)
│   ├── features/
│   │   └── sales-poc/
│   │       ├── components/          # Telas 1–4 (SalesWorkspace, OpportunityDetailPanel, OfferComposerModal, SaleCaseDetailPanel, AttendanceModal, ResetDemoDialog)
│   │       ├── domain/              # Tipos e máquina de estados pura (state-machine.ts + testes AC1–AC7)
│   │       ├── repositories/        # Persistência local isolada (localStorage v1 + fallback)
│   │       ├── store/               # Store client-side com useSyncExternalStore e dispatchDomainAction
│   │       └── utils/               # Formatadores BRL, datas e rótulos de status
│   └── lib/
│       └── utils.ts                 # Utilitário cn()
└── tests/
    └── e2e/
        ├── foundation.spec.ts       # Smoke tests de fundação, banner e reset
        └── scenarios.spec.ts        # Roteiros E2E completos C1 (13 passos) e C2–C6 (AC1–AC7)
```

---

## 6. Carteira de Demonstração Verossímil e Restauração de Ambiente

Toda a massa inicial reside em `src/data/fixtures.json` simulando dados reais de mercado (sem qualquer PII real):

- **1** imobiliária (`Horizonte Negócios Imobiliários`), **3** corretores e **1** coordenadora comercial;
- **6** imóveis à venda em São Paulo/SP (apartamentos e casas, modalidades à vista e financiado, 1 e 2 proprietários);
- **5** compradores e **6** vendedores inventados com CPF parcialmente mascarado no padrão LGPD (`***.XXX.XXX-**`);
- **8** oportunidades distribuídas nas colunas do funil cobrindo organicamente os cenários `C1` a `C6`, acompanhadas de **6** cadeias de propostas e **3** dossiês iniciais.

### Como funciona a ação Restaurar ambiente

- As interações persistem apenas no navegador do usuário, sob a chave `lumenimob-sales-poc:v1` (`schemaVersion: 2`) no `localStorage`.
- Ao acionar **Restaurar ambiente** no cabeçalho e confirmar no `AlertDialog`, o estado salvo localmente é substituído integralmente por uma cópia limpa de `src/data/fixtures.json`.
- Caso o conteúdo do `localStorage` esteja corrompido ou em `schemaVersion` anterior, a camada de repositório restaura a carteira atualizada automaticamente sem quebrar a renderização.

---

## 7. Limites e Proibição de Uso em Produção

1. **Não é produto nem MVP técnico:** esta POC não valida segurança, autenticação, autorização multi-tenant, concorrência transacional, validade jurídica, PLD ou integrações externas.
2. **Contratos descartáveis:** os tipos em `src/features/sales-poc/domain/` servem apenas à simulação de interface. A modelagem de agregados (`D2`) permanece pendente de ADR próprio após as sessões de validação com usuários (`U4`).
3. **Proibição expressa:** nenhum arquivo deste repositório deve ser copiado diretamente para produção como implementação definitiva do módulo de vendas.

