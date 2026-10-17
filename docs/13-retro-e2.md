# Retro E2 — implementação, contratos e parâmetros

Atualização de 17/10/2026, autorizada pelo PROJECT MASTER PROMPT (U5). Complementa 01–12. Este documento prevalece sobre o olheiro pago e a valorização NPC por OVR treinado descritos no alpha E1. As demais regras continuam em vigor.

## Entrega por fase e rastreabilidade

| Fase | Implementação concreta | Verificação / pendência |
|---|---|---|
| A | Auditoria anterior às alterações em 12; arquitetura preservada; sistema de cores/estados, catálogo de 15 SVGs originais; retratos e poses compartilhados | Teste de integridade/variedade do catálogo passou. Não houve importação de arte de terceiros. Avaliação visual humana pendente |
| B | Sprites 5v5, corrida/chute/defesa/comemoração, palco de movimentos do servidor, goleiros na posição inicial do gol, passes, disputas e reinícios; preferências de som/movimento; frames suspensos em aba oculta | Simulação E2 mantém resultado E1 para mesma semente; eventos ordenados em 0–90s e stream sem futuro testados. Fluidez/legibilidade no navegador ainda precisam de aceite |
| C | Cartas por raridade, lista 50/cartas 12, filtros combinados, comparação, proteção, depósito; prévia/commit da venda em lote; olheiro gratuito ALL/ANY, prioridades, presets e relatório | Teste integrado de 2.000 atletas: bloqueios, disputa entre prévia e confirmação, rollback, aviso raro, idempotência e persistência. Interface em desktop/mobile ainda não validada |
| D | Artes de CT/depósito, treino pausável, fim de manutenção no teto, comparação/estimativa, quantidade de materiais e venda manual com revisão | Testes de pausa/teto, falta de Coins e crédito offline compartilhado passaram. Refinamento não implementado |
| E | Mercado com minhas listagens/ofertas/histórico, líquido de 15%, reserva de Coins; liga preservada, ambiente próprio; diário com marcos cosméticos, métricas e destaques raros | Transferências, ofertas/expiração/retirada e gasto duplo testados entre contas. Classificação pública e P2P de materiais ausentes |
| F | Checagem de tipos, testes automatizados e build de produção; revisão de hooks/diálogos, cache do elenco e paginação | **QA visual bloqueado** pela política do navegador. O usuário confirmou que vê o clube, mas a ferramenta ainda recebe abas internas de erro. Não há capturas E2 reais nem aceite de responsividade/fluidez nesta entrega |

Evidências anteriores em `docs/provas/alpha-e1-*` são históricas do E1, não demonstram E2. Não foram reapresentadas como se fossem capturas desta versão. A parte visual da fase F continua aberta.

## Modelo persistente e migração 004

- `athletes.body`: `protected:boolean`, `storage:COLLECTION|DEPOT`, `birthOvr:number`, `npcValue:string`, `birthRegion?:Region`, `scoutReason?:string`. São campos por atleta, transferidos junto com o ativo. Níveis e Coins continuam strings inteiras ilimitadas no domínio.
- `athletes.updated_at:timestamptz`: revisão do elenco. Índices por clube/revisão e clube/local para atletas ativos. Atualização em lote só altera `updated_at` quando o corpo efetivamente muda. Venda arquiva (`active=false`), sem excluir o registro histórico.
- `clubs.runtime.gameplay.scouting`: configuração ordenada, persistente, sem alterar a semente das recompensas. `discoveries` guarda até 200 decisões recentes. Histórico descritivo continua em cada atleta.
- `runtime.gameplay.training[]`: `paused?`, `status?=ACTIVE|PAUSED|NO_COINS|CAPPED`, relógio e ciclos. Pausa/retomada não acumulam manutenção retroativa.
- `runtime.career`: totais exatos de partidas, vitórias/empates/derrotas, gols, Coins de partidas e drops. Clubes legados recuperam esses totais das partidas liquidadas antes de persistir o agregado. Vendas não apagam a história.
- `sale_quotes`: UUID, clube FK, corpo JSON, validade real em ms, consumida. Índice clube/validade. Prévia não reserva o atleta: commit o revalida integralmente.
- `coin_holds`: oferta UUID PK, anúncio FK, clube FK, quantia NUMERIC positiva inteira, expiração real, ativa. Índice clube/ativo/expiração. Coin hold não debita a carteira; reduz `available=balance-reserved`.
- Livro-razão: `NPC_BULK_SALE` é um crédito por lote; NPC individual e suprimentos preservam os motivos próprios. P2P continua debitando compra e creditando líquido com comissão auditável. Reservas são compromissos, não novos Coins. A soma de débitos/créditos continua igual ao saldo.

Backfill é determinístico, sem reroll: proteção P5 padrão só é preenchida quando ausente (desbloqueio manual falso permanece); preço considera atributos de nascimento derivados do gerador original, não atributos treinados. Buscas pagas já persistidas são honradas; não há cobrança nova nem mudança retroativa em vendas concluídas. Replays E1/M1 conservam sua versão.

## Contratos HTTP adicionais

Prefixo `/v1`, sessão/CSRF e erros do projeto preservados. Toda mutação exige `clientInstanceId`, cabeçalho de geração do controlador e `Idempotency-Key`. O cliente usa o mesmo fluxo de presença exclusivo por clube; a aba secundária não ganha autoridade por repetir requisições.

| Endpoint | Request adicional | Response / regra |
|---|---|---|
| GET `/club?omitRoster=1` | — | GameView com `athletes:[]`, `rosterOmitted:true`, `rosterRevision`; cliente conserva o elenco e busca o corpo completo se a revisão mudar |
| POST `/roster/action` | `athleteId`, `action:PROTECT|UNPROTECT|COLLECTION|DEPOT|TRAIN_PAUSE|TRAIN_RESUME`, `confirmed?` | `{message}`; UNPROTECT exige `confirmed:true`; ações validadas por dono e ocupação |
| POST `/scouting/config` | `config:{enabled,fallback,rareWarningPotential,rules[]}` | `{message}`; grava a configuração para próximos drops, sem custo |
| POST `/roster/sell/preview` | exatamente um de `ids:UUID[]` ou `filter:AthleteFilter` | `{id,expiresAt,athletes:[{id,name,price,warning}],excluded:[{id,reason}],total,warnings}`; inclui preços individuais e resumo |
| POST `/roster/sell/commit` | `quoteId`, `confirmed:true`, `acknowledgeRare:boolean` | `{message,count,total}`; valida todos e conclui em uma transação. Mudança em qualquer candidato aborta o lote inteiro |
| POST `/market/command` | nova ação `WITHDRAW`, `listingId`, `offerId` | `{message}`; somente o comprador da oferta pode retirá-la. OFFER passa a criar hold atômico |

`AthleteFilter`: nome, posição, P1–P5, local, titular/reserva, OVR mínimo/máximo, teto natural mínimo/máximo, nível mínimo/máximo em string, origem, proteção e elegíveis para venda. Classe, Potência separada e Aptidões não são aliases silenciosos de outro atributo.

`ScoutRule`: identificador único, nome, enabled, ALL/ANY, lista de condições, destino e proteção. Condição: campo `rarity|position|potential|birthOvr|finishing|passing|control|pace|marking|defending`, operador EQ/GTE/LTE, valor string. Atributos numéricos individuais são comparados com seus tetos naturais; não com o valor treinado. Raridade e posição aceitam igualdade. A primeira regra habilitada correspondente decide; P5 passa antes por segurança obrigatória. Desabilitado: outros atletas vão à Coleção. Organização nunca altera RNG ou quantidade de drops.

GameView acrescenta carteira `reserved/available`, carreira, relatório do olheiro, histórico real de transferências e anúncios encerrados do jogador. Não há lista fictícia para popular mercado vazio.

## Eventos e execução

Eventos E2 novos: `TACKLE`, `GOALKEEPER_SAVE`, `RESTART`. Reaproveitam o resultado calculado, sem sorteios adicionais de gol/recompensa. Cada evento visual pode incluir `payload.stage={from:{x,y},to:{x,y},durationMs}`, coordenadas percentuais do campo. `offsetMs` continua relativo ao início e `sequence` continua ordenado.

- TACKLE acompanha a mudança de posse entre ataques.
- Defesa acontece somente após um chute salvo; o ator é o goleiro defensor.
- Gol gera reinício no centro; chute para fora gera tiro de meta. Não se exibe escanteio/lateral/habilidade especial que o motor não calculou.
- Placar deriva apenas de eventos já visíveis; o cliente não usa o placar futuro do resultado para antecipar gols.
- Transmissão normal tem pequeno buffer visual experimental; replay reutiliza os mesmos eventos. Velocidade de apresentação não concede recompensas: liquidação e carteira são autoritativas.
- Pausar/ocultar apresentação não pausa farm. Atualização offline continua pelas regras anteriores e não cria atletas.

## Segurança e limites operacionais

Mutações são serializadas sob o bloqueio econômico existente; sessão, origem, controlador, propriedade, estado de anúncio e saldo disponível são verificados no servidor. Falha depois da preparação de uma transferência reverte hold, carteira, ativo e anúncio. Cotação é vinculada ao clube e tem expiração. Retry idempotente não credita novamente; uma cotação consumida não pode ser reutilizada com uma chave nova.

Limites de payload não são limites econômicos: até 10.000 IDs por requisição individual ou seleção por filtro para conjuntos maiores; até 40 regras × 12 condições; corpo de configuração 100KB; prévia 1MB. Nível e armazenamento do elenco não recebem teto fixo de jogo. Esses limites protegem a instalação local e podem ser revistos com telemetria real.

Ofertas legadas anteriores à reserva não são retroativamente debitadas. Ainda precisam passar pela validação de saldo disponível na aceitação. Novas ofertas são reservadas. Reservas expiradas são ignoradas na leitura mesmo antes da limpeza física; a carteira nunca é liberada por relógio enviado pelo navegador.

## Registro de parâmetros

| Status | Parâmetro | Valor / origem |
|---|---|---|
| Aprovado preservado | Partidas / atributos / raridades / offline / regiões | 90s, 5v5, seis atributos/tetos, nível ilimitado, OVR 99; pesos condicionais e offline de U1 sem alteração |
| Aprovado por U5 | Olheiro organizador | Gratuito, sem atletas extras/boost; decisão por dados de nascimento, Coleção/Depósito, sem venda automática |
| Aprovado por U5 | Segurança | Proteção, confirmação de desbloqueio, prévia+confirmação de lote, reserva de Coins |
| Experimental E2 | Valor NPC | `12 + OVR_nascimento + 8 × número_P`; substitui somente o uso indevido do OVR treinado. Não é cotação P2P nem valor definitivo de balanceamento |
| Experimental E2 | Preset do olheiro | P4/P5 para Coleção protegidos; teto médio ≥70 para Coleção; outros Depósito. P5 sempre protegido na chegada |
| Experimental E2 | Aviso preventivo | P4/P5 ou teto ≥85, limiar de teto configurável 0–99 |
| Experimental E2 | Validade da prévia | Cinco minutos reais, sem alteração da economia |
| Experimental E2 | Apresentação | Buffer 1,2s, animação ~30fps, replay6×; página oculta suspende frames, não o servidor |
| Experimental preservado E1 | CT | 2 Coins e 12 XP por minuto elegível online; 6 XP offline; expansão150 Coins por vaga até5. Pausado/vazio/teto sem cobrança |
| Experimental E2 | Reconhecimento | Marcos de 1/100 partidas, 10 vitórias/drops, Regional e Elite; sem recompensa econômica |
| Indefinido | Classe/Potência/Aptidões/especializações | Sem definição canônica; não implementar fórmulas novas disfarçadas de dados anteriores |
| Indefinido | Refinamento e seus materiais | Custos, resultados, raridades e consumo pendentes; não foi criado um botão inoperante |
| Indefinido / ausente | P2P de materiais | Unidade, elegibilidade, lotes e reserva de estoque precisam de contrato próprio; P2P implementado continua sendo de atletas |

## QA e limites da entrega

Suíte automatizada: 28 testes, incluindo o cenário de 2.000 atletas e transações reais em PostgreSQL embarcado. Tipagem passou; compilação de produção passou. O banco de testes é isolado; não foi usado o elenco real do usuário para a venda massiva.

A suíte inclui regressões de farm, pesos exatos, XP grande, Regional, recuperação determinística, snapshots, stream sem eventos futuros, offline24h/renovação, geração de controlador, CSRF/isolamento, God mode, CT offline compartilhado, P2P e saldo auditável. Não é um benchmark de MMO nem teste de concorrência com milhares de usuários.

Pendências concretas: QA visual real em desktop/mobile, medições de frames/CPU e escolha artística com o usuário; refinamento, Classe/Aptidões; P2P de materiais; autenticação recuperável; tabela pública de liga/promoção; carga e operação pública. Continua uma versão local sem deploy. A arquitetura preserva o adaptador PostgreSQL externo, mas a validação desta entrega usou PGlite, não um serviço de rede.

## Execução final registrada

- `npm.cmd test`: 28 aprovados, zero falhas; última execução em aproximadamente 9,2s neste ambiente. O tempo é informativo, não uma meta de desempenho.
- `npm.cmd run typecheck`: aprovado.
- `npm.cmd run build:check`: aprovado após os últimos ajustes de interface. Gera `.next-check`, separado do diretório do servidor de desenvolvimento, para evitar invalidar a aba durante a validação.
- Navegador: o usuário confirmou o campo aberto; as tentativas de automação foram recusadas pela política de URL da aba interna de erro. Nenhuma tentativa de contornar esse bloqueio foi usada. Portanto, capturas E2, fluidez, som e responsividade não foram certificados.

O servidor local segue disponível em http://127.0.0.1:3000/. As mudanças foram feitas fora de `sources/`; nenhum arquivo de referência sincronizado foi alterado.
