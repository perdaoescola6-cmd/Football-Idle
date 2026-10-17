# Football Card Manager — auditoria e implementação V2

Registro de 17/10/2026. Implementação incremental sobre o FutIdle existente, sem substituir o projeto, sem remover o banco e sem alterar `sources/`. A solicitação recebida termina no início da fase 8, após “COLEÇÃO, DEPÓSITO E MERCADO”; não havia instruções adicionais dessa fase no arquivo. Foram implementados os fluxos conhecidos de coleção, depósito e negociação.

## Ambiente e auditoria anterior às alterações

Projeto local em Next.js 16.4.2, React 19, Fastify 5, TypeScript/Zod e PostgreSQL, com PGlite persistente como padrão. Reutilizados sessão anônima em cookie, banco, migrações, worker, ledger imutável, serialização da economia e idempotência. O espelho não contém metadados Git: não houve commit ou PR.

Antes da edição foram visitadas as cinco telas existentes: Campeonato, Elenco, Packs, Coleção e Histórico. Foram exercitados início e término de rodada, eventos, formação/tática, abertura Básico, revelação individual e completa, odds, filtros por nome/raridade/posição/local/duplicatas, organização automática, proteção, revisão/cancelamento de venda e recibos/ledger/recarga. Os quatro packs mais caros estavam desabilitados pelo saldo disponível; sua compra e suas garantias foram verificadas nos testes, sem editar a carteira para habilitá-los artificialmente. Não houve erro de console no fluxo inicial.

| Sistema anterior | Constatação real | Tratamento V2 |
|---|---|---|
| Persistência/economia | Saldo, coleção, packs e rodadas persistiam; mutações transacionais reais | Preservados e ampliados |
| Catálogo | 23 edições brasileiras, pequeno para colecionar | 854 edições e 844 identidades canônicas |
| Motor | Resultado autoritativo, mas eventos de defesa podiam apontar jogadores de linha | Motor versionado com goleiro correto e estatísticas derivadas |
| Campo | Círculos numerados e bola pouco vinculada às ações | Uniformes, movimento de 22 atletas e bola segundo eventos do servidor |
| Perfis/rankings | Ausentes | Fichas, comparação, rankings e perfis públicos locais |
| Temporadas | D→C→B→A compacto já funcional | Calendário consultável, arquivo completo novo, prêmios e totais |
| P2P | Mercado legado bloqueado para cartas do pivot | Novo fluxo próprio, com transferência e comissão auditadas |

Capturas originais: [campeonato](provas/v2-before/campeonato.jpg), [elenco](provas/v2-before/elenco.jpg), [packs](provas/v2-before/packs.jpg), [revelação](provas/v2-before/revelacao.jpg), [coleção](provas/v2-before/colecao.jpg), [histórico](provas/v2-before/historico.jpg).

## Catálogo e procedência

Base principal: [lista oficial FIFA de seleções do Mundial de 2022](https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf). São 831 atletas, 32 seleções e 297 denominações de clubes nessa fonte. O importador lê as colunas do PDF, valida identidades, datas e caracteres, e gera snapshot e manifesto com SHA-256, contagem e origem. A página do Brasil foi renderizada e conferida visualmente contra a extração.

As 23 edições BR24 mantêm seus IDs, raridades e OVR anteriores. Dez jogadores também aparecem na base FIFA e compartilham uma identidade canônica: **831 + 23 = 854 edições, com 844 pessoas distintas**. Identidades canônicas impedem escalar duas edições do mesmo jogador. O sorteio escolhe uma edição pertencente ao pool da raridade: não sorteia uma raridade nova para uma identidade arbitrária.

Todos os registros têm nome completo, nome de exibição, seleção de referência, nascimento, clube com ano e link da fonte. Treze fichas antigas receberam complementos verificáveis de CBF, clubes, ligas e, em um caso, Transfermarkt. As URLs e datas de consulta estão em `brazil-profile-supplements.json` e nas fichas. Altura e pé preferido desconhecidos aparecem como não informados; posições secundárias não documentadas ficam vazias. Não foram inventados dados biográficos. A idade é calculada da data de nascimento em UTC. A seleção é a representação esportiva da fonte, sem inferir cidadanias adicionais.

Os clubes são históricos, incluindo referências de anos diferentes nos complementos; não se apresenta o snapshot como elenco atual. A base é internacional e inclui clubes brasileiros, mas ainda não é uma base completa de todos os elencos brasileiros. Nomes da fonte podem conservar grafia sem acentos ou ordem documental.

Funções LAT/ZAG/VOL/MEI/PON/ATA, atributos, potencial e OVR são **modelagem experimental do jogo**, separada da posição ampla verificada GOL/DEF/MEI/ATA. Ratings das novas edições usam faixas estáveis e critérios históricos de experiência, com estrelas configuradas. Não são avaliação profissional atual. Retratos SVG originais variam pele, cabelo, uniforme e cores; são avatares decorativos, sem alegação de retratar a aparência real e sem imagens ou escudos licenciados.

## Atributos, elenco e evolução

OVR = arredondamento da soma ponderada dos atributos, com calibração validada para todas as edições:

| Função | Pesos |
|---|---|
| GOL | mergulho 20%, segurança 20%, reflexos 25%, reposição 10%, posicionamento 25% |
| LAT | velocidade 25%, passe 20%, drible 10%, defesa 30%, físico 15% |
| ZAG | defesa 50%, físico 25%, passe 10%, velocidade 15% |
| VOL | defesa 30%, passe 30%, físico 20%, drible 10%, velocidade 10% |
| MEI | passe 40%, drible 30%, finalização 10%, velocidade 10%, físico 10% |
| PON | velocidade 30%, drible 30%, finalização 25%, passe 15% |
| ATA | finalização 50%, velocidade 15%, drible 15%, físico 15%, passe 5% |

Onze titulares, até sete reservas, identidades únicas e posições validadas no servidor. Formações 4-4-2, 4-3-3 e 4-2-3-1; 3-5-2 mantida por compatibilidade. A 4-2-3-1 exige cinco MEI, quatro DEF, um ATA e um GOL no modelo amplo atual. Controles mostram incompatibilidade e contagens exigidas. Sugestão aplica os melhores OVR efetivos por posição, exclui anunciados e esvazia o banco para revisão do técnico. Capitão deve ser titular e dá 1,5% na criação de chances. Táticas e formação alteram as probabilidades do motor.

Cada carta pode treinar no máximo três vezes: 2.500, 5.000 e 7.500 Coins. Cada etapa aumenta atributos em 1, com teto 99 e OVR recalculado. Não há evolução ilimitada herdada da V1. Cartas anunciadas ou envolvidas na partida ativa não podem treinar. Comparação de atributos funciona entre edições da mesma posição ampla.

## Packs e segurança econômica

Cada compra liquida débito e entrega de exatamente cinco cartas em uma transação. Todas são persistidas antes da revelação; fechar ou recarregar não perde cartas. Boas-vindas e clube inicial continuam protegidos contra repetição. Preços, versão `packs-experimental-v1`, odds e pisos anteriores foram mantidos:

| Pack | Coins | Pisos em slots distintos | Bronze | Prata | Ouro | Lendário | Fenômeno |
|---|---:|---|---:|---:|---:|---:|---:|
| Básico | 5.000 | 1 Prata | 70% | 23% | 6% | 0,9% | 0,1% |
| Profissional | 15.000 | 1 Ouro | 53% | 31% | 13,8% | 2% | 0,2% |
| Premium | 40.000 | 2 Ouros | 35% | 37% | 23% | 4,6% | 0,4% |
| Estrelas | 110.000 | 1 Lendário + 1 Ouro | 24% | 31% | 37% | 7,3% | 0,7% |
| Superestrelas | 300.000 | 2 Lendários + 1 Ouro | 12% | 25% | 47% | 14,5% | 1,5% |

As linhas somam exatamente 100% em pontos-base inteiros. A rolagem base ocorre por slot; se ficar abaixo do piso configurado, é elevada ao piso. Nunca há rebaixamento. Os slots sem piso aceitam todas as raridades. A interface distingue a distribuição por slot livre da distribuição efetiva dos slots garantidos e da probabilidade de ao menos um Fenômeno: `1 - (1-p)^5`, pois a promoção de pisos não muda o evento Fenômeno. Isso não é a mesma coisa que `p`, nem `5p`. As odds e a versão são guardadas no recibo de abertura.

Há revelação individual ou conjunta, feedback visual por raridade, destaque superior, duplicatas e acesso imediato à ficha. Nenhum pagamento real ou compra de moeda premium foi adicionado.

P2P: preço inteiro livre em Coins; comissão `ceil(preço × 15 / 100)`, com débito, crédito líquido, transferência de posse, histórico e auditoria na mesma transação. Preço mínimo 1 e máximo de 12 dígitos. Anunciados, titulares, banco, protegidos e participantes da partida não podem ser vendidos indevidamente. Não se pode comprar o próprio anúncio. Concorrência usa a serialização existente da economia e bloqueio transacional do anúncio; repetição usa chave de idempotência. A venda NPC continua manual com revisão; o olheiro somente organiza cartas existentes.

## Motor, estatísticas e competição

`football-events-v2` é determinístico a partir da semente registrada e dura 90 segundos reais para 90 minutos. Gera passes para outro atleta, conduções, finalizações e suas resoluções: gol ou defesa do goleiro adversário. Assistências derivam do passe efetivo para o autor do gol. Frames com as posições de 22 atletas saem do servidor; o cliente interpola posições/bola, anima pernas e exibe comemoração quando há gol. Narração mostra atleta e ação. Não é uma simulação física contínua: a evolução ocorre por eventos discretos com transições visuais.

O servidor oculta resultado e eventos futuros até o tempo correto e calcula estatísticas ao vivo somente dos eventos já liberados. Há pré-jogo com ambas as escalações/força/formação/dificuldade, pós-jogo com recompensa, gols, assistências, chutes, alvo, defesas, passes e posse por participação nos passes. Nota individual é uma fórmula experimental por eventos; não se apresenta como avaliação externa.

Os outros três jogos de cada rodada também usam esse motor, com placar derivado dos seus eventos. Somente atletas do clube humano entram nos rankings de desempenho dos usuários; não são criadas contas AI para preencher rankings ou mercado. Médias e totais começam nos eventos V2 válidos. As antigas defesas inconsistentes não foram usadas para inventar estatísticas retrospectivas.

Mantido `BR-2024-compact-v1`: oito participantes por carreira (seu clube + sete clubes brasileiros reais identificados AI), 14 rodadas em turno/returno. Dois primeiros sobem, dois últimos descem; D é piso e A é teto. Desempate: pontos, vitórias, saldo, gols e ID estável. Rodadas avançam ao terminar o jogo do usuário. O formato próprio não reproduz o regulamento integral de nenhuma edição da CBF.

Premiação nova ao encerrar a temporada: 15.000 Coins ao campeão, 8.000 ao segundo, 3.000 aos demais, além das recompensas de cada jogo. Encerramento guarda tabela, calendário e versão do regulamento, atualiza títulos/acessos e paga uma vez. O calendário permite consultar rodadas futuras, resultados dos outros jogos e temporadas arquivadas disponíveis. A tela mostra posição, rodadas restantes, máximo de pontos adicionais e situação da faixa de acesso; não promete acesso matemático sem considerar todos os cenários.

Rankings de clubes: acumulado disponível, divisão e temporada atual de cada clube. Contas podem estar em temporadas diferentes; a seleção explicita isso. São os clubes reais de usuários desta instalação. Rankings de jogadores separam desempenho (gols, assistências, jogos, clean sheets e nota) de qualidade (OVR/raridade por função). Perfis públicos locais mostram elenco, resultados, divisão e conquistas, sem carteira, cookies ou previsões de resultados.

## Persistência e compatibilidade

Migração aditiva `006-football-v2.sql`: anúncios e transferências auditadas. Novos campos JSON são opcionais para leitura compatível. Partidas antigas preservam seus snapshots e terminam pelo motor original. IDs, cartas, proteção, saldo, XP e temporadas anteriores permanecem. Quando o registro antigo não tinha tabela detalhada, biografia ou estatísticas, a UI informa a ausência em vez de fabricar histórico.

Backup anterior à V2: `.data/backup-before-v2-20261017-170802`; backup do primeiro pivot também mantido. O banco em uso continua `.data/postgres`. A migração é aplicada automaticamente no início da API. Histórico visual de partidas mantém as últimas 30; auditorias SQL das liquidações permanecem. Totais do clube disponíveis desde o pivot são aproveitados, mas sequência recente detalhada começa no registro V2. Não houve reset dos dados do usuário.

## Arquivos principais alterados/criados

| Área | Arquivos |
|---|---|
| Contratos | `packages/contracts/brasfoot.ts`, `card-model.ts`, `community.ts` |
| Dados | `packages/game/data/fifa-2022.json`, `fifa-2022-manifest.json`, `brazil-profile-supplements.json`; `scripts/import-fifa-roster.py` |
| Regras | `packages/game/card-catalog.ts`, `brasfoot.ts`, `football-simulation.ts`, `football-career.ts` |
| API/banco | `apps/server/src/football-market.ts`, `football-community.ts`, `brasfoot-routes.ts`, `repository.ts`, `app.ts`, `db.ts`; migração `006-football-v2.sql` |
| Interface | `apps/web/app/components/FootballApp.tsx`, `FootballCatalogue.tsx`, `FootballCommunity.tsx`, `PlayerDetails.tsx`, `MatchExperience.tsx`; `apps/web/app/football-v2.css`, `layout.tsx` |
| Verificação/documentação | `tests/football-v2.test.ts`, este relatório, `README.md`, capturas `docs/provas/v2-before` e `v2-after` |

## Verificação executada

Os três comandos passaram na implementação entregue:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:check
```

**41/41 testes passaram**, incluindo os 35 anteriores e seis cenários V2 amplos. Cobertura relevante:

- Catálogo consistente, identidades/edições únicas, fontes, todos os atributos e OVR exato; todos os pools não vazios.
- 100.000 rolagens determinísticas por tipo de pack, limites estatísticos de seis desvios e alcance das edições amostradas; odds somam 100%, cinco cartas, pisos, falta de Coins, idempotência e concorrência preservados.
- Eventos determinísticos, 22 posições válidas, goleiro nas defesas, assistência por passe, placar e estatísticas, ocultação ao vivo, registro único, demais jogos AI pelo mesmo motor.
- 120 simulações comparando influência ofensiva/defensiva, sugestão legal em 4-2-3-1, treino pago com teto.
- Integração API + PostgreSQL embarcado com três contas: posse e proteções, cancelamento indevido, falha SQL forçada com rollback, dois compradores concorrentes com um único vencedor, comissão, saldos, repetição idempotente, histórico e rankings/perfis.
- Persistência em disco e reabertura, calendário/rodadas/progressão entre as quatro divisões, compra/venda e liquidação de jogos nos testes preservados.

O isolamento inicial do Windows fez o teste de reabertura PGlite abortar no filesystem WASM; a execução com acesso local normal passou. Build usa `.next-check` para coexistir com o servidor de desenvolvimento.

No navegador foram verificados os oito módulos, desktop 1280×900 e celular 390×844. Sem overflow horizontal da página nas telas medidas; tabelas usam rolagem interna quando necessário. Sem erros/warnings de console no novo fluxo. Validados catálogo por nome e seleção+clube, comparação de Messi com outra edição, ficha de goleiro, rankings acumulado/divisão/temporada, perfil público, anúncio de reserva por 3.000 e cancelamento, depósito/retorno, treino de Bento de OVR 61 para 62 com débito exato, sugestão 4-3-3, capitão, compra Básico com cinco novas edições e consulta de ficha na revelação, pré/pós-jogo e recarga persistente. A compra P2P positiva foi validada por integração com três contas de teste; o navegador principal não recebeu anúncios artificiais ou uma compra fictícia.

Exemplos observados: América-RN 0×3 União da Vila, recompensa de 3.500 Coins, tabela em 10 pontos após quatro jogos; estatísticas de gols/assistências/defesas surgem dos eventos. A rodada seguinte terminou União da Vila 1×0 Portuguesa-RJ, já com a nova escalação 4-3-3, Ederson e capitão salvo: 13 pontos, nível 25, rodada 6 disponível. A recarga preservou esse resultado, os novos reforços e o treino. Também foi concluída a revisão e venda NPC de uma carta reserva recém-adquirida, com crédito de 200 Coins e recibo no extrato. Ao fim do QA, 29 cartas e saldo de 10.129 Coins, sem anúncio aberto. Essas ações foram feitas no clube local existente e geraram transações reais de Coins do jogo.

Provas posteriores: [campo desktop](provas/v2-after/partida-desktop.jpg), [campo mobile](provas/v2-after/partida-mobile.jpg), [ficha desktop](provas/v2-after/ficha-desktop.jpg), [ficha mobile](provas/v2-after/ficha-mobile.jpg), [packs](provas/v2-after/packs-desktop.jpg), [mercado](provas/v2-after/mercado-desktop.jpg), [rankings](provas/v2-after/rankings-desktop.jpg), [elenco](provas/v2-after/elenco-desktop.jpg), [catálogo](provas/v2-after/catalogo-desktop.jpg). Outras capturas de celular estão no mesmo diretório.

## Rodar e limites atuais

Node.js 22+; `npm.cmd ci` para instalar e `npm.cmd run dev` para iniciar. Interface em http://127.0.0.1:3000 e API em 3101, worker junto da API. Mantenha a pasta `.data/postgres` e apenas uma API usando o PGlite. A alternativa PostgreSQL externo já existia, mas não foi validada contra serviço de rede nesta entrega.

Ainda não há autenticação com recuperação de conta, matchmaking humano, pirâmide AI persistente compartilhada, regulamentos integrais da CBF, substituições durante a partida ou base completa atualizada dos clubes brasileiros. Perfis/rankings são da instalação local com sessão anônima; não há ranking mundial externo. Os atributos e sprites são um modelo simples experimental. Algumas posições detalhadas são de jogo, pé preferido e posições secundárias podem permanecer desconhecidos. O carregamento do catálogo foi separado e cacheado no cliente, mas JSONB, histórico com frames e mutex global ainda precisam de medição/arquitetura para carga MMO pública.

Nenhum pagamento real, moeda premium, contratos, lesões, energia, tarefas diárias obrigatórias, deploy ou publicação comercial foi introduzido. Nomes reais estão habilitados para desenvolvimento conforme autorizado; direitos e condições de uso dos dados continuam pendentes de checagem antes de publicação.
