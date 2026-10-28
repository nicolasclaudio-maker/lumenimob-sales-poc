# Task — sales-management-poc: POC navegável do módulo de compra e venda

**State:** `NEEDS_DECISION` (U1–U3 concluídas; aguardando `HUMAN_GATE` da U4 — sessões com corretores/gestores)  
**Risk:** `MEDIUM` (protótipo fora do repositório, dados sintéticos); `HIGH` ao virar spike com schema  
**Surface:** `KNOWN_SURFACE` para o protótipo; `UNCERTAIN_SURFACE` para o domínio definitivo  
**Reversibility:** `EASY` — nenhum artefato toca o repositório `imobsaas`, banco ou integrações

**Dependências:**
- [`sales-management-discovery`](../sales-management-discovery/task.md) — spec funcional, benchmark Kenlo e gates G1–G8.
- [`sales-0a-block-sale-in-rent-formalization`](../sales-0a-block-sale-in-rent-formalization/task.md) — contenção do fluxo latente de venda na formalização locatícia. Corre em paralelo; é pré-requisito para o spike (U6), não para o protótipo.

---

## 1. Intenção e resultado esperado

- **Problema:** o LumenImob cadastra e divulga imóveis à venda, mas não tem jornada de negociação e fechamento. A formalização existente é locatícia e não deve ser reaproveitada para venda.
- **Resultado esperado:** um protótipo clicável, **fora do repositório**, com dados 100% sintéticos, que permita a corretores e gestores percorrer:

```text
Atendimento → Oportunidade → Proposta ⇄ Contraproposta → Aceite
  → Dossiê (diligência) → Compromisso assinado → Escritura lavrada
  → Título protocolado → Título registrado → Entrega de chaves → Concluído
```

- **O que a POC valida:** compreensão da jornada, fronteira entre negociação e dossiê, distinção entre assinatura e transferência da propriedade, e o recorte do MVP.
- **O que a POC não valida:** schema, RLS, concorrência real, validade jurídica, PLD, assinatura, pagamentos ou cartório. A decisão D2 (agregados) continua sendo do ADR.

---

## 2. Formato e localização

| Item | Definição |
|---|---|
| Local | diretório irmão, fora do Git do produto: `~/Documents/ImobSass/sales-poc/` (repositório próprio, se necessário) |
| Tecnologia | mesma stack do LumenImob: Next.js 16.2.x (App Router, apenas client components, sem server actions/route handlers), React 19.2, TypeScript 5, Tailwind CSS 4 (`@tailwindcss/postcss`), Radix UI (alert-dialog, tabs, tooltip, slot), `class-variance-authority`, `tailwind-merge`, `lucide-react`, `date-fns` 4, ESLint 9 e Playwright para os roteiros AC1–AC6. Sem backend; estado em memória/`localStorage` com botão discreto "Restaurar ambiente" |
| Visual | aparência do LumenImob: tokens de `globals.css` e componentes de `src/components/ui/` **copiados** (não importados) para o protótipo; sem dependência de código, env ou serviços do `imobsaas` |
| Dados | fixture JSON com dados verossímeis de mercado (inventados, sem PII real) versionada no próprio repositório (ver §6) |
| Distribuição | build estático executado localmente ou publicado em URL privada para as sessões de validação |
| Imersão UX | interface limpa simulando módulo real implementado (rota `/` abre direto Gestão de Vendas; sem banners de protótipo, avisos de simulação ou códigos `C1–C6`/`D6–D9` na UI para não enviesar as sessões U4) |

> Proibido: importar módulos do `imobsaas`, apontar para Supabase/Redis, usar nomes, CPFs, matrículas ou endereços reais, ou reaproveitar o protótipo como base de produção.

---

## 3. Escopo

### Incluído

- kanban de oportunidades de venda com visão alternativa por imóvel;
- detalhe da oportunidade: imóvel, comprador, vendedor(es), corretor, **autorização de venda** e timeline;
- proposta e contraproposta versionadas, imutáveis após envio, com comparação entre versões;
- aceite de uma versão específica, com bloqueio de segundo aceite no mesmo imóvel;
- abertura do dossiê somente após o aceite;
- checklist documental fictício com duas variantes (à vista / financiado);
- marcos distintos de compromisso, escritura, protocolo, registro e entrega;
- bloqueios transversais (pendência de informação, financiamento aguardando, exigência cartorial);
- reflexo no status do imóvel e no anúncio (Disponível → Reservado → Sob contrato → Vendido);
- cenários alternativos da §5.

### Fora do escopo

- código, migration ou feature flag no repositório `imobsaas`;
- dados pessoais ou documentos reais;
- assinatura digital, pagamentos, sinal, ITBI, custódia;
- KYC, PEP, PLD/COAF;
- integração com cartório, banco, portais ou ZapSign/D4Sign;
- cálculo de comissão (apenas campo informativo "comissão prevista" na proposta);
- templates contratuais;
- feedback/portal do proprietário (pós-MVP, já no backlog do discovery);
- checklist configurável (apenas botão "Editar checklist" inerte para medir interesse).

---

## 4. Modelo de estados da POC

### 4.1 Oportunidade (pré-aceite) — colunas do kanban

| Coluna | Significado |
|---|---|
| `ATENDIMENTO` | interesse registrado, sem proposta |
| `EM_PROPOSTA` | ao menos uma proposta enviada; cadeia de versões aberta |
| `ACEITA` | uma versão aceita → gera o dossiê |

Terminais: `PERDIDA` (motivo obrigatório), `EXPIRADA` (badge na proposta; oportunidade continua se houver nova versão).

### 4.2 Dossiê de venda (pós-aceite) — colunas do kanban

| Coluna | Marco que permite sair dela |
|---|---|
| `DILIGENCIA` | checklist mínimo resolvido (aceito ou dispensado com justificativa) |
| `CONTRATACAO` | `COMPROMISSO_ASSINADO` |
| `CARTORIO` | `ESCRITURA_LAVRADA` → `TITULO_PROTOCOLADO` → `TITULO_REGISTRADO` |
| `ENTREGA` | `CHAVES_ENTREGUES` |
| `CONCLUIDO` | — |

Terminal: `CANCELADO` (motivo obrigatório; ex.: diligência reprovada, desistência).

### 4.3 Bloqueios transversais (não são etapas)

`PENDENTE_INFORMACAO`, `AGUARDANDO_FINANCIAMENTO`, `EXIGENCIA_CARTORIAL` — aparecem como badge no card e evento na timeline; impedem avanço sem mudar de coluna.

### 4.4 Status do imóvel (efeito visual)

| Evento | Status do imóvel | Anúncio |
|---|---|---|
| sem aceite | Disponível | publicado |
| proposta aceita | Reservado | publicado com indicador "em negociação" (D9) |
| compromisso assinado | Sob contrato | despublicado |
| título registrado | Vendido | despublicado |
| dossiê cancelado | volta a Disponível | republicado |

### 4.5 Regras de linguagem (pergunta 7)

- Nenhum texto usa "vendido", "transferido" ou "novo proprietário" antes de `TITULO_REGISTRADO`.
- Após o compromisso: "Compromisso assinado — a propriedade **ainda não** foi transferida".
- Barra de progresso do dossiê tem o marco final "Propriedade transferida (registro)".
- Nenhum termo locatício: inquilino, aluguel, caução, vistoria de entrada, repasse, parcela mensal.

---

## 5. Roteiros de demonstração

### Cenário principal (C1)

1. Atendimento sintético demonstra interesse em dois imóveis.
2. Corretor cria oportunidade para o Imóvel A (1 comprador × 1 imóvel).
3. Detalhe exibe autorização de venda vigente.
4. Comprador envia proposta v1.
5. Vendedor registra contraproposta v2; v1 permanece visível.
6. Comprador aceita v2 → imóvel fica Reservado → dossiê é criado.
7. Checklist (variante financiada) é resolvido; um item é dispensado com justificativa.
8. Bloqueio "Aguardando financiamento" aparece e é resolvido.
9. Compromisso marcado como assinado → imóvel Sob contrato → aviso de não transferência.
10. Escritura lavrada → título protocolado.
11. Exigência cartorial registrada, cumprida e reapresentada.
12. Título registrado → imóvel Vendido.
13. Chaves entregues → dossiê Concluído.

### Cenários alternativos indispensáveis

| ID | Cenário | O que prova |
|---|---|---|
| C2 | proposta rejeitada → nova proposta | cadeia de versões sem sobrescrita |
| C3 | proposta concorrente de outro comprador no mesmo imóvel; tentativa de segundo aceite é bloqueada | visão por imóvel e exclusividade do aceite |
| C4 | negociação perdida com motivo | terminal pré-aceite |
| C5 | diligência reprovada → dossiê cancelado → imóvel volta a Disponível | aceite com condição suspensiva |
| C6 | proposta expirada (badge) | validade da proposta |

---

## 6. Dados de demonstração (verossímeis sem PII real)

- 1 imobiliária, 3 corretores, 1 gestora com nomes naturais inventados.
- 6 imóveis de venda (apartamento/casa, à vista/financiado, com 1 e 2 proprietários) com endereços, matrículas e autorizações em formato realista de mercado.
- 5 compradores e 6 vendedores com nomes brasileiros naturais (inventados) e documentos parcialmente mascarados no padrão LGPD (`***.XXX.XXX-**`).
- 8 oportunidades distribuídas em todas as colunas, cobrindo C1–C6 sem exibir códigos internos na UI.
- Fixture versionada em `src/data/fixtures.json`; ação discreta "Restaurar ambiente" restaura o estado inicial.

---

## 7. Telas

1. **Kanban de vendas** — abas Oportunidades / Dossiês; filtros por corretor; alternância para visão por imóvel.
2. **Detalhe da oportunidade** — partes, imóvel, autorização de venda, propostas, timeline.
3. **Proposta / contraproposta** (modal ou página) — valor, validade, forma de pagamento, financiamento, condições, comissão prevista; comparação lado a lado entre versões; ações aceitar/rejeitar/contrapropor.
4. **Dossiê** — abas Checklist, Marcos (compromisso → escritura → protocolo → registro → entrega), Timeline.

---

## 8. Critérios de aceite

### Do protótipo (verificáveis pelo time)

- [x] AC1: C1 percorrido do início ao fim sem recarregar dados manualmente.
- [x] AC2: C2–C6 executáveis a partir da fixture.
- [x] AC3: nenhuma versão de proposta pode ser editada após envio.
- [x] AC4: segundo aceite no mesmo imóvel é bloqueado com mensagem explicativa.
- [x] AC5: status do imóvel segue a tabela §4.4 em todos os cenários.
- [x] AC6: varredura textual sem termos locatícios nem "vendido/transferido" antes do registro.
- [x] AC7: protótipo não importa código nem acessa serviços do `imobsaas` (verificado por inspeção de dependências e rede).

### Da validação (critério para spike técnico — pergunta 10)

- [ ] AC8: 3–5 corretores/gestores concluem C1 sem ajuda.
- [ ] AC9: nenhum participante interpreta compromisso ou escritura como transferência da propriedade.
- [ ] AC10: participantes confirmam se o dossiê nasce no aceite (ou registram a exceção).
- [ ] AC11: recorte MVP × pós-MVP registrado.
- [ ] AC12: D2 decidido em ADR; G1, G2 e G8 respondidos; tarefa 0A concluída.

---

## 9. Plano de execução

| Unidade | Objetivo | Artefato | Oráculo | Risco | Gate |
|---|---|---|---|:---:|:---:|
| U1 | Montar esqueleto do protótipo e fixture | `sales-poc/` (fora do repo) | build local OK; módulo abre direto em `/` | LOW | Auto |
| U2 | Implementar telas 1–4 e máquina de estados §4 | `sales-poc/src/` | AC1–AC5 por roteiro manual | LOW | Auto |
| U3 | Revisão interna de linguagem e isolamento | checklist AC6–AC7 | grep de termos + inspeção de rede | LOW | Auto |
| U4 | Sessões com 3–5 corretores/gestores | roteiro + notas por sessão | AC8–AC11 | MEDIUM | HUMAN_GATE |
| U5 | Consolidar decisões e backlog | este task.md + `jira-cards.md` | decisões D2, D6, D7 registradas | MEDIUM | HUMAN_GATE |
| U6 | Planejar spike técnico | ADR + plano de persistência | AC12 | HIGH | HUMAN_GATE |

### Roteiro de sessão (U4)

1. Contexto de 2 minutos, sem explicar a interface.
2. Pedir que o participante execute C1 em voz alta.
3. Pedir C3 e C5.
4. Perguntas: "Em que momento o imóvel é do comprador?"; "Onde você esperaria pedir os documentos?"; "O que falta para usar isso amanhã?".
5. Registrar tempo, pontos de travamento e citações.

---

## 10. Decisões e trade-offs

| ID | Status | Decisão / hipótese | Trade-off |
|---|---|---|---|
| D1 | ACCEPTED (2026-10-28) | Protótipo fora do repositório, dados sintéticos, sem backend | isola risco; não prova RLS nem concorrência real |
| D2 | NEEDS_DECISION (ADR) | `sale_opportunity` + `sale_case` vs. caso único com fases | POC informa a percepção do usuário, não decide agregados |
| D3 | ACCEPTED | CRM, imóveis e visitas compartilhados; jornada própria a partir da oportunidade | reduz duplicação sem reaproveitar locação |
| D4 | ACCEPTED | "Vendido" somente após registro; status intermediários Reservado e Sob contrato | exige ajuste futuro em status do imóvel e feed |
| D5 | ACCEPTED | Assinatura, pagamentos, PLD e cartório simulados | limita validade operacional |
| D6 | ACCEPTED (2026-10-28) | Dossiê nasce no aceite; diligência pré-proposta tratada como condição suspensiva | menos dados pessoais cedo; exige fluxo de cancelamento |
| D7 | ACCEPTED (2026-10-28) | Oportunidade = 1 comprador × 1 imóvel; atendimento pode ter vários imóveis | simples de entender; exige visão por imóvel para concorrência |
| D8 | ACCEPTED (2026-10-28) | Checklist fixo com duas variantes (à vista / financiado) + botão "Editar" inerte | não valida configurabilidade, apenas interesse |
| D9 | ACCEPTED (2026-10-28) | Imóvel Reservado continua publicado com indicador "em negociação"; despublica ao assinar o compromisso | exige ajuste futuro no feed VRSync e portais |
| D10 | ACCEPTED (2026-10-28) | Protótipo na mesma stack do LumenImob (Next.js 16 / React 19 / Tailwind 4 / Radix) | facilita reaproveitar aprendizados de UI; risco de "virar produção" mitigado por repositório separado e sem backend |
| D11 | ACCEPTED (2026-10-28) | Ordem: tarefa 0A primeiro; POC em paralelo logo depois | contém risco em produção antes de expor a jornada de venda |

---

## 11. Progress & Checkpoint

- **Fase atual:** Verification concluída para o protótipo (`U1–U3 COMPLETE`); pausado no `HUMAN_GATE` da `U4`.
- **Unidade ativa:** U4 (`HUMAN_GATE` — sessões de validação com 3–5 corretores e gestores para aferir `AC8–AC11`).
- **Fatos observados (`OBSERVED`):**
  - Fundação U1, Telas 1–4 + máquina de estados U2 (`src/features/sales-poc/domain/state-machine.ts`, Kanban Oportunidades/Dossiês + visão por imóvel, Detalhe da Oportunidade, Modal/Comparador de Proposta e Contraproposta, Dossiê com abas Checklist/Marcos/Timeline) e revisão de governança/isolamento U3 implementadas e verificadas empiricamente.
  - `AC1–AC7` provados mecanicamente via suíte de domínio/governança (`src/features/sales-poc/domain/state-machine.test.ts`) e suíte Playwright E2E (`tests/e2e/scenarios.spec.ts` cobrindo os 13 passos de `C1` sem reload + `C2–C6`, zero chamadas externas e zero erros de console).
  - Refinamento de imersão aprovado em 2026-10-28: removidos 100% dos banners de protótipo e jargões internos (`C1–C6`, `D6–D9`, `AC3`, `sintético`, `fictício`, `demo`), rota `/` aberta diretamente no módulo Gestão de Vendas com ação discreta `Restaurar ambiente` (`schemaVersion: 2`) e carteira populada com personas, imóveis e certidões verossímeis de mercado com CPFs mascarados no padrão LGPD (`***.XXX.XXX-**`).
  - `properties.operation_type` aceita `rent | sale | both` no produto principal; status do imóvel e preço são orientados à locação.
  - Feed VRSync publica imóveis `sale` sem noção de reserva (`src/lib/feed/vrsync/build-listing.ts`).
  - Fluxo latente de venda na formalização locatícia continua sem bloqueio — tratado na tarefa 0A.
- **Abordagens descartadas:** POC dentro do repositório com feature flag; migration antes da validação; reaproveitar formalização locatícia; checklist configurável na POC; `NEEDS_INFO` como estado terminal; rotas dinâmicas incompatíveis com `output: "export"`.
- **Próxima ação concreta:** conduzir as sessões de validação humana da `U4` com 3–5 corretores/gestores seguindo o roteiro da §9 (`C1` em voz alta, `C3`, `C5` e perguntas de percepção sobre transferência de propriedade, momento do dossiê e recorte de MVP) e registrar as evidências para `AC8–AC11` antes de avançar para `U5`.

---

## 12. Verification & Evidence

- [x] Escopo separado do backlog definitivo de vendas.
- [x] Dados reais, schema, pagamentos e integrações excluídos.
- [x] Formato definido: protótipo fora do repositório.
- [x] AC1–AC7 verificados no protótipo.
- [ ] Sessões U4 realizadas e registradas.
- [x] D6–D11 decididos em 2026-10-28.
- [ ] D2 decidido em ADR.
- [ ] Spike técnico aprovado ou rejeitado.
- **Evidência operacional:** esta tarefa não altera o repositório `imobsaas`; `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, `npm run test:e2e` e `bash scripts/verify-baseline.sh` executados com saída `0`.
