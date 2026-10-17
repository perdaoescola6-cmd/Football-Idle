# Pivot Brasfoot — implementação de 17/10/2026

## Base e preservação

Reaproveitados Next.js 16.4.2/React 19, Fastify 5, TypeScript, Zod, PostgreSQL externo opcional/PGlite persistente, autenticação anônima, worker, ledger imutável e mutex transacional. A base passou em typecheck e 28 testes antes das alterações. Não havia metadados Git neste diretório; não foi criado commit ou PR. Nenhuma dependência adicionada.

`runtime.brasfoot` é um agregado aditivo. Atletas P1–P5, saldo, XP do clube e histórico antigos permanecem. A ativação interrompe o farm e aguarda a liquidação integral da partida legada em andamento. Treinos antigos ficam pausados; anúncios antigos do clube são cancelados e holds liberados. Comandos antigos e transferências envolvendo contraparte migrada são bloqueados. O rating das cartas novas é fixo: não herda crescimento infinito da V1.

Antes da reinicialização local, o banco existente foi copiado para `.data/backup-before-brasfoot-20261017-162424`. Não sobrescrever o banco atual com a cópia sem uma operação explícita de restauração.

## Arquivos

| Arquivo | Responsabilidade da alteração |
|---|---|
| `packages/contracts/brasfoot.ts` | Tipos, packs, pesos/pisos e cálculo de odds |
| `packages/game/card-catalog.ts` | 23 edições fixas e referência de identidades |
| `packages/game/brasfoot.ts` | Onboarding, packs, escalação, venda, calendário, simulação e temporadas |
| `packages/game/engine.ts` | Estado opcional e suspensão do avanço legado após migração |
| `packages/contracts/index.ts` | Visão compartilhada do modo novo |
| `apps/server/src/brasfoot-routes.ts` | Comandos autenticados, validação e auditoria transacional |
| `apps/server/src/repository.ts` | Reuso de locks/ledger/idempotência, relógio real e worker/liquidação |
| `apps/server/src/db.ts` | Aplicação aditiva da migração 005 |
| `apps/server/migrations/005-brasfoot.sql` | Auditoria SQL append-only |
| `apps/server/src/app.ts` | Registro das rotas |
| `apps/server/src/club-routes.ts` | Bloqueio de P2P antigo envolvendo clube migrado |
| `apps/web/app/components/FootballApp.tsx` | Interface do ciclo novo usando o cliente de API existente |
| `apps/web/app/football.css` | Layout responsivo, cartas e campo 2D |
| `apps/web/app/page.tsx`, `layout.tsx` | Entrada e título atualizados |
| `tests/brasfoot.test.ts` | Regras, migração, transações e persistência |
| `README.md`, este registro | Execução, parâmetros e limitações |

Componentes antigos permanecem disponíveis no código para reaproveitamento. `sources/` não foi modificado.

## Packs e economia experimental

Versão **packs-experimental-v1**. Pesos inteiros em 10.000 unidades, soma exata de 100%. Cada slot sorteia uma raridade; o piso promove resultados inferiores e preserva superiores. A seleção final aponta para uma edição preexistente do catálogo, com identidade/raridade/rating fixos. Duplicatas são instâncias distintas da mesma edição.

| Pack | Coins | Pisos mínimos | Bronze / Prata / Ouro / Lendário / Fenômeno por slot livre |
|---|---:|---|---|
| Básico | 5.000 | 1 Prata | 70 / 23 / 6 / 0,9 / 0,1% |
| Profissional | 15.000 | 1 Ouro | 53 / 31 / 13,8 / 2 / 0,2% |
| Premium | 40.000 | 2 Ouros | 35 / 37 / 23 / 4,6 / 0,4% |
| Estrelas | 110.000 | 1 Lendário + 1 Ouro | 24 / 31 / 37 / 7,3 / 0,7% |
| Superestrelas | 300.000 | 2 Lendários + 1 Ouro | 12 / 25 / 47 / 14,5 / 1,5% |

Cada pack abre exatamente cinco cartas. Como nenhum piso alcança Fenômeno, a probabilidade `p` de Fenômeno permanece em todos os cinco slots. A chance de ao menos um no pack é `1-(1-p)^5`. A UI exibe odds por slot livre, odds efetivas de cada slot garantido e a chance por pack. Exemplo: Básico garantido = 0/93/6/0,9/0,1%, com aproximadamente 0,499% de ao menos um Fenômeno no pack. Parâmetros são experimentais e versionados.

Onboarding: onze titulares Bronze aptos em 4-4-2, 10.000 Coins uma vez e um Básico gratuito uma vez. Clube único por conta; novas chaves de comando não repetem as concessões. Contas anônimas novas ainda são contas distintas, limitação da autenticação local.

Compra/abertura usa a mesma transação: mutex global, lock da conta/clube, hash/chave idempotente, débito ledger, cinco novas instâncias, recibo com versão/pesos/pisos/rolls/IDs e auditoria append-only. Falha em qualquer parte reverte tudo. O cliente não envia preços, saldo, RNG ou raridades. O recibo SQL permanece após venda das cartas.

Venda NPC paga 200/500/1.500/6.000/20.000 Coins por Bronze/Prata/Ouro/Lendário/Fenômeno. A UI exige revisão manual. O servidor revalida todo o lote: titulares, banco, protegidos, IDs repetidos, ausentes ou alheios são recusados sem venda parcial. Cartas novas ainda não podem ser listadas no P2P. O organizador tem regras configuráveis de duplicatas ao depósito e proteção por piso; não gera cartas nem vende automaticamente.

## Futebol e divisões

Regulamento **BR-2024-compact-v1**, referência de clubes 2024, D=0/C=1/B=2/A=3. Cada clube humano tem uma temporada independente com sete adversários AI identificados. Os elencos AI são sintéticos, não colecionáveis e não representam escalações oficiais atuais. Pareamento humano não está integrado nesta etapa.

Calendário round-robin com oito participantes, quatro jogos por rodada, sete de ida e sete de volta, mandos invertidos. Cada par tem um jogo em cada mando. Os outros três jogos AI são liquidados junto do usuário. Pontos 3/1/0; desempate por pontos, vitórias, saldo, gols e ID estável. Os dois primeiros sobem e os dois últimos descem, limitados pela Série D e Série A. É formato próprio adaptado, explicitamente mostrado na UI, não o regulamento integral da CBF.

Onze identidades únicas por elenco escalado; posições compatíveis com 4-4-2, 4-3-3 ou 3-5-2; banco de até sete e táticas equilibrada/ofensiva/defensiva. Formação e tática influenciam chances. Snapshot fixo durante a partida. Substituições no meio do jogo ainda não existem.

Eventos e resultado são gerados no servidor, com RNG privado. Partidas duram 90.000 ms reais. O navegador recebe apenas eventos já transcorridos e não recebe o resultado futuro. A animação 2D é apresentação sem autoridade sobre recompensas. O worker termina uma partida com a aba fechada, mas não inicia amistosos/farm ou partidas extras automaticamente. O relógio do pivot independe do God mode antigo.

Premiação experimental: vitória 3.500, empate 2.200, derrota 1.500 Coins; 28 XP permanentes para o clube. Sem drops individuais nem treino ilimitado de cartas. Histórico visual dos últimos 30 jogos; calendário retém a temporada atual; auditoria SQL conserva as liquidações. Limite de 5.000 cartas ativas.

## Fontes e direitos

Identidades: [convocação da CBF em 23/08/2024](https://www.cbf.com.br/selecao-brasileira/noticias/detalhes/jogos-selecao-masculina/selecao-brasileira-e-convocada-para-jogos-contra-equador-e-paraguai-pelas-eliminatorias) e [registro da CBF sobre convocados](https://www.cbf.com.br/selecao-brasileira/noticias/detalhes/selecao-masculina/dorival-junior-acredito-em-processos). DEF/MEI/ATA são categorias amplas da simulação. Ratings/raridades são fictícios de balanceamento, não dados oficiais. Sem idade, nascimento ou vínculo atual inventados.

Clubes: [Série D 2024](https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-d/2024), [Série C 2024](https://www.cbf.com.br/futebol-brasileiro/noticias/detalhes/jogosdehoje-campeonato-brasileiro-serie-c/confira-como-ficaram-os-grupos-da-segunda-fase-da-serie-c), [Série B 2024](https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-b/2024?documento=Documentos+Gerais) e [registro de participantes da Série A](https://www.cbf.com.br/futebol-brasileiro/noticias/detalhes/competicoes-campeonato-brasileiro-serie-a/cbf-anuncia-os-vencedores-dos-premios-do-brasileirao-betano). Consultadas fontes/indexação oficiais; algumas páginas diretas retornaram 502 durante a consulta.

Arte por monogramas, cores e formas originais; nenhuma foto ou escudo real copiado. Nomes usados em desenvolvimento conforme autorização. Sem publicação, pagamentos reais ou moeda premium. Licenças comerciais permanecem pendentes.

## Verificação e limitações

Verificação final: **35 testes passaram**, `npm.cmd run typecheck` e `npm.cmd run build:check` concluídos. Fluxo no navegador conferido em 1280×900 e 390×844: ativação do clube existente, pack grátis, cinco cartas reveladas, compra Básico com débito de 5.000 Coins, odds, duplicatas, filtro por nome, revisão/venda NPC de uma duplicata por 200 Coins, proteção do titular, seleção de banco e tática, partida 11v11 com resultado 0×0, crédito de 2.200 Coins, ponto na classificação e avanço para rodada 2. Console sem erros/warnings na leitura final. Na largura de 390 px, documento com 375 px úteis (barra de rolagem de 15 px), sem transbordamento horizontal. A navegação de seções tem rolagem própria no celular.

O clube de demonstração União da Vila manteve nível 23 e os dados anteriores. A API e o frontend foram reiniciados após as alterações finais, reutilizando o banco. Evidências visuais ficam em `docs/provas/brasfoot-desktop.jpg` e `docs/provas/brasfoot-mobile.jpg`.

Além dos testes históricos: enumeração exata de 250.000 combinações slot/roll, pisos, cinco cartas, catálogo, saldo insuficiente, onboarding, concorrência, idempotência, rollback, venda/proteção, propriedade, posições, 90 segundos, eventos/placar, calendário, transições em quatro divisões e persistência em disco. A integração fecha/reabre um banco temporário e retoma uma partida. Também força falha na auditoria para provar rollback. O filesystem WASM do PGlite abortava na reabertura sob isolamento Windows; a suíte passa com acesso local normal.

Limitações explícitas: catálogo pequeno, ligas individuais contra AI, regulamentos compactos, sem P2P de cartas, sem substituições e sem treino individual novo. Sessão anônima por cookie continua sem recuperação ou acesso entre dispositivos. JSONB e mutex global ainda limitam escala; antes de MMO público, normalizar entidades, paginar respostas, reduzir contenção e validar carga. Não houve teste contra PostgreSQL externo nem deploy.

## Continuação — treinador

A atualização [15 — Rodada pausável](15-rodada-treinador.md) substitui as observações anteriores de “sem substituições” e o campo animado. Mantém packs/catálogo existentes; os quatro confrontos da divisão atual rodam juntos, com pausa persistente e trocas manuais. A revisão visual desta atualização permanece pendente.
