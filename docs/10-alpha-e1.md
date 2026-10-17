# Alpha E1 — transmissão, elenco e serviços do clube

Registro de implementação • 17/10/2026 • parâmetros de balanceamento experimentais.

## Autorização e relação com o milestone original

U4 é o pedido para expandir o jogo com animações, cartas, NPC, olheiro, mapa, menus e funcionalidades anteriores. Ele amplia o escopo original de M1. Os documentos 01–07 continuam sendo a referência de design; este documento registra o que passou a existir no código e as decisões provisórias da expansão. Não representa aprovação definitiva das novas fórmulas.

O progresso anterior é mantido. Nomes e retratos dos atletas legados são derivados de seus IDs; não são recriados XP, potencial, raridade ou identidade de propriedade. Migrações SQL numeradas 002 e 003 ampliam o esquema existente.

## Experiência disponível

| Área                 | Comportamento implementado                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clube / partida      | Transmissão 5v5 de 90s, placar durante a partida, passes, ataques, finalizações, defesas e gols; bola e atletas animados; dois goleiros diante dos respectivos gols                    |
| Eventos              | Apenas eventos cujo instante já ocorreu são enviados. O replay usa a mesma simulação determinística e o mesmo placar final                                                             |
| Cartas               | Nomes fictícios, retratos vetoriais próprios, posição preferida, seis atributos, potencial por atributo, raridade, nível e XP; abertura por clique e fechamento por Escape             |
| Coleção              | Busca por nome, filtro titulares/reservas/P1–P5 e ordenação por OVR, potencial ou nome                                                                                                 |
| Mapa                 | Sete regiões selecionáveis, níveis necessários, dados dos rivais, recompensas e viagem para iniciar farm; zoom e rolagem internos                                                      |
| Empresário Augusto   | Compra reservas livres e suprimentos comuns. Venda de atleta exige uma revisão na própria tela                                                                                         |
| Olheiro Matias       | Busca paga persistente, espera no relógio do clube, recebimento único de atleta com presença online; resultado oculto antes da revelação                                               |
| CT                   | Dois slots iniciais, expansão até cinco, treino apenas de reservas; cobrança por ciclos ativos, pausa sem dívida quando falta saldo                                                    |
| Liga                 | Temporada de 14 dias lógicos do clube, até vinte jogos assíncronos de 90s, pontos e histórico da campanha; escalações de clubes da mesma divisão, com NPCs quando não houver candidato |
| P2P                  | Anúncios com preço livre, 1/7/30 dias, compra direta, ofertas de 24h, aceitação pelo vendedor, cancelamento e comissão de 15%; transferência real entre contas do mesmo banco          |
| Depósito / histórico | Inventário persistente, partidas recentes, replay e livro-razão de Coins com créditos e débitos                                                                                        |
| Testes               | God mode 1×/10×/60× mantido; clube que usou God mode fica excluído do P2P                                                                                                              |

A animação é uma interpretação visual dos lances do servidor, não uma física de futebol competitiva. A posse mostrada é a proporção dos lances de posse observados, não uma medição de segundos de controle de bola. Som de gol sintetizado é opcional e inicia somente após clique do jogador. O primeiro slot sempre atua como goleiro; a posição preferida da carta ainda não impõe bônus ou penalidade.

## Regras aprovadas preservadas

- 5v5, 90 segundos; cinco atletas iniciais; escalação manual com snapshot por partida.
- Nível sem teto, seis atributos com tetos individuais, OVR limitado a 99.
- Por atleta recebido: P1 74,485%; P2 20%; P3 5%; P4 0,5%; P5 0,015%.
- Farm offline sem atletas; crédito máximo de 24h, 50% XP/Coins, chance de 50% de material comum, renovação após dez minutos online contínuos.
- Regiões por progresso permanente: Várzea 1, Regional 12, Estadual 60, Nacional 150, Continental 320, Europa 600, Elite 1100. Sem exigência de nível médio dos titulares.
- CT: dois slots iniciais e cinco máximos; somente reservas; manutenção associada ao treino ativo.
- P2P: preço escolhido pelo vendedor, comissão de 15%, anúncios 1/7/30 dias, ofertas 24h.
- Liga: temporada 14 dias, máximo vinte jogos. Oposição por snapshot de outro clube da divisão, com NPC de alternativa quando não houver candidato.

## Registro de decisões provisórias

A versão das novas partidas é `ALPHA-E1`. Partidas antigas `M1-E0.1` preservam o algoritmo anterior. Mudanças visuais não alteram sorteios de gols, recompensas ou raridades.

| ID    | Parâmetro                       | Valor do alpha                                                                                                                           | Estado                                                                  |
| ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| E1-01 | Olheiro: custo / duração        | 60 Coins / 30s lógicos                                                                                                                   | Experimental                                                            |
| E1-02 | Atletas por busca               | Um; mesma distribuição condicional P1–P5; claim online                                                                                   | Experimental, compatível com proibição de drop offline                  |
| E1-03 | Treino por minuto lógico pago   | 12 XP / 2 Coins por atleta                                                                                                               | Experimental                                                            |
| E1-04 | Expansão do CT                  | 150 Coins por slot, até cinco                                                                                                            | Experimental                                                            |
| E1-05 | Treino sem saldo                | Descarta ciclos não pagos; retoma nos ciclos futuros, sem dívida retroativa                                                              | Provisório                                                              |
| E1-06 | Reconciliação longa do CT       | Até 1.440 ciclos por reconciliação; excedente descartado; XP offline de 50%, condicionado à renovação e ao crédito compartilhado         | Provisório; compartilha o crédito offline do clube com o farm           |
| E1-07 | Venda NPC de atleta             | 12 + OVR + 8 × número da classe P                                                                                                        | Experimental                                                            |
| E1-08 | Venda NPC de suprimento         | 3 Coins por unidade                                                                                                                      | Experimental                                                            |
| E1-09 | Selo P2P                        | Sorteio determinístico independente de 1% por identidade; não altera P1–P5                                                               | Interpretação provisória do requisito “~1%”; significado final pendente |
| E1-10 | Comissão inteira                | Arredondamento para cima de preço × 15%; vendedor recebe o restante                                                                      | Provisório; em vendas de 1 Coin o líquido pode ser zero                 |
| E1-11 | Ofertas sem escrow              | Saldo validado na oferta e novamente na aceitação; pode faltar saldo na conclusão                                                        | Provisório                                                              |
| E1-12 | Limites operacionais de mercado | Preço inteiro positivo até 12 dígitos; até 100 ofertas por anúncio; 100 anúncios retornados                                              | Limites técnicos do alpha; não tabelamento de preço                     |
| E1-13 | Relógio de anúncios/ofertas     | Tempo real; God mode não acelera expiração                                                                                               | Decisão técnica                                                         |
| E1-14 | Liga local                      | Divisão = min(7, 1 + floor(XP clube / 6.000)); clubes ativos da divisão sorteados no servidor; NPC de alternativa com força por circuito | Experimental; campanha individual, ranking público pendente             |
| E1-15 | Relógio da liga                 | 14 dias lógicos do clube; God mode acelera a temporada de teste                                                                          | Provisório                                                              |
| E1-16 | XP e moedas do farm             | Mantidos os valores M1-E0 para Várzea e Regional; XP clube 28 e XP por titular 20 em jogo online completo                                | Experimental herdado                                                    |
| E1-17 | Rivais / Coins de regiões novas | Tabela em `packages/contracts/world.ts`, abaixo                                                                                          | Experimental                                                            |

| Região      | OVR dos NPCs | Coins derrota / empate / vitória |
| ----------- | -----------: | -------------------------------: |
| Várzea      |        18–22 |                     10 / 12 / 15 |
| Regional    |        24–28 |                     12 / 15 / 18 |
| Estadual    |        34–38 |                     20 / 24 / 28 |
| Nacional    |        46–50 |                     30 / 34 / 38 |
| Continental |        60–64 |                     45 / 49 / 53 |
| Europa      |        74–78 |                     65 / 69 / 73 |
| Elite       |        88–92 |                     90 / 94 / 98 |

A quantidade de XP por vitória continua igual à de derrota. Assim, os limiares mais altos ainda não têm uma curva de progressão validada. A meta de Regional continua aproximadamente uma hora de farm online sem aceleração. Ajustar XP por região exige nova decisão de balanceamento; não foi presumido como aprovado.

## Contratos executados

Todas as mutações abaixo usam sessão HttpOnly, validação de origem e `X-Requested-With: football-idle`, `Idempotency-Key` e controle de aba por `X-Presence-Generation`. Valores monetários são strings de inteiros; cliente não envia saldo, raridade, XP nem resultado desejado.

`POST /api/v1/club/command` recebe `clientInstanceId` UUID e uma das ações:

| action                       | Campos adicionais                  |
| ---------------------------- | ---------------------------------- |
| `NPC_SELL`                   | `athleteId` UUID                   |
| `SUPPLY_SELL`                | `quantity`: inteiro de 1 a 100.000 |
| `SCOUT_START`, `SCOUT_CLAIM` | Nenhum                             |
| `TRAIN_START`, `TRAIN_STOP`  | `athleteId` UUID                   |
| `TRAIN_EXPAND`               | Nenhum                             |
| `LEAGUE_JOIN`, `LEAGUE_PLAY` | Nenhum                             |

Resposta: envelope `{ data: { message, athlete? }, meta }`; `athlete` só aparece na revelação autorizada do olheiro. O candidato privado não aparece no agregado do clube antes da revelação.

`POST /api/v1/market/command` recebe `clientInstanceId` UUID e:

| action          | Campos adicionais                                       |
| --------------- | ------------------------------------------------------- |
| `LIST`          | `athleteId`, `price` string inteira, `days`: 1, 7 ou 30 |
| `BUY`, `CANCEL` | `listingId` UUID                                        |
| `OFFER`         | `listingId`, `amount` string inteira                    |
| `ACCEPT`        | `listingId`, `offerId` UUID                             |

Resposta: `{ data: { message }, meta }`. Compra/aceitação valida saldo, propriedade, disponibilidade, status, prazos e uso de God mode novamente dentro da transação. Não há envio de mensagens para pessoas; ofertas são registros internos do jogo.

`GET /api/v1/club` agora inclui `revision`, `gameplay` e anúncios ativos de `market`. `currentMatch` contém `liveScore` e eventos já ocorridos. `GET /api/v1/matches/:id` e `/events?afterSequence=N` usam a mesma projeção; nunca retornam seed nem lances futuros. Ler não liquida partida nem concede recompensa.

## Dados e integridade

- `athletes.active`: venda ao NPC arquiva a linha; não apaga a identidade histórica. Coleção, escalação e operações consideram apenas atletas ativos do clube.
- `coin_ledger_entries`: `match_id` pode ser nulo para serviços; `delta` é inteiro com sinal e diferente de zero; motivo distingue compra, venda, CT, olheiro e partida. Atualização e exclusão continuam bloqueadas.
- `market_listings`: atleta, vendedor, preço, expiração, status e snapshot; índice único por atleta enquanto o anúncio está aberto.
- `market_transfers`: recibo imutável por anúncio com comprador, vendedor, atleta, total e comissão. A comissão sai da circulação; não existe conta administrativa que receba Coins.
- `inventory_adjustments`: saídas de suprimentos para o NPC, imutáveis; entradas anteriores continuam em `inventory_movements` vinculadas ao grant de partida.
- `runtime.gameplay`: slots/treinos, busca privada do olheiro e campanha da liga. Mantido em JSON transacional neste alpha, em vez de antecipar um esquema final para sistemas ainda experimentais.
- `economy_mutex`: serializa mutações e reconciliação local, evitando conflitos de transferência entre carteiras. Não é uma solução de escala para um MMO público.
- A carteira é conferida contra a soma do livro-razão antes de operar. Falha interrompe novas operações, sem tentar “corrigir” saldo silenciosamente.
- Transferência, comissão, troca de proprietário e alterações de carteira são atômicas. Falha em qualquer gravação desfaz tudo.
- A interface ignora respostas antigas usando revisão e horário, evitando retrocesso visual por respostas fora de ordem.

## Verificação automatizada e manual

Suíte com 20 testes, incluindo cenários com muitas asserções: regras de raridade; BigInt e tetos; Regional após quarenta partidas; snapshots; recuperação determinística; presença e abas; offline misto e 24h; God mode isolado e rota ausente em produção; CSRF; leituras sem pagamento; eventos ao vivo sem antecipação; sete regiões; olheiro; reserva em treino; liga; transações P2P entre duas contas.

O teste de comércio injeta uma falha na gravação do recibo e comprova rollback de carteira, propriedade e anúncio; depois repete a mesma compra simultaneamente com a mesma chave e confirma uma única transferência. Também confere comissão, oferta/aceitação, treino persistido, venda arquivada, soma da razão e bloqueio de alteração dos registros imutáveis.

Na interface foram exercitados início/parada de farm, movimento e posição dos goleiros, ficha do atleta, mapa, olheiro, treino, venda de reserva e suprimento, histórico e campanha de liga. Imagens de evidência ficam em `docs/provas/`.

## Limites remanescentes

Este é um alpha local ampliado. Não equivale à entrega final de um MMO profissional: autenticação recuperável entre dispositivos, operação pública, ranking entre jogadores, observabilidade, testes de carga, retenção, paginação e economia validada ainda exigem trabalho. A liga registra a campanha individual contra snapshots de clubes ou NPCs; não simula uma tabela pública com jogadores inexistentes.

Os retratos, nomes, escudos e cenário são originais e fictícios; as referências recebidas orientaram a hierarquia dos menus, a exploração e o formato colecionável. Não foram incorporados rostos, marcas ou arquivos do FIFA/Pokeidle. O renderer usa SVG/CSS; PixiJS continua uma possibilidade futura, sem migração prematura.

A taxa de manutenção do CT em períodos parcialmente elegíveis e o significado de elegibilidade P2P “~1%” continuam decisões de design abertas. Os limites de 24h/50% do farm não foram alterados para tentar preencher essas lacunas.

O CT concede 12 XP por minuto inteiramente online e 6 XP por minuto inteiramente offline elegível. A manutenção permanece 2 Coins por ciclo elegível pago, inclusive em ciclos parcialmente elegíveis; XP usa a proporção exata e carrega frações. Farm e CT compartilham os mesmos intervalos de crédito offline, contabilizando uma única vez períodos sobrepostos. Dois slots simultâneos não consomem duas horas de crédito em uma hora de ausência. Sem renovação qualificada ou após esgotar 24h, o treino não paga XP nem cobra manutenção.

A seleção assíncrona de liga foi verificada com duas contas no teste de API: a partida do primeiro clube recebeu exatamente os cinco IDs ordenados da escalação do segundo clube elegível na divisão. O snapshot e o nome do adversário ficam gravados na partida. A defesa assíncrona não altera a campanha nem concede XP ao clube adversário. Clubes de teste são sorteados apenas contra outros clubes de teste; sem candidato elegível, aplica-se o NPC de alternativa.
