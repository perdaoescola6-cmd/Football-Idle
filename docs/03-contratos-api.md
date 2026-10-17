# 03 — Contratos HTTP e replay

Contrato proposto D12, prefixo `/v1`, JSON UTF-8. Não é código implementado. Nomes de campo em inglês para reaproveitar em TypeScript; rótulos e mensagens ao jogador em português. Autenticação proposta por sessão de cookie `HttpOnly`, `Secure`, política de origem e proteção CSRF em mutações; provedor ainda Q08.

## Envelope e convenções

Sucesso: `{"data": objeto, "meta":{"requestId":"uuid","serverTime":"ISO-8601 UTC"}}`.

Erro: `{"error":{"code":"LINEUP_VERSION_CONFLICT","message":"A escalação foi alterada. Atualize e tente novamente.","details":{"currentVersion":8}},"meta":{"requestId":"uuid","serverTime":"ISO-8601 UTC"}}`.

Exemplos abaixo mostram somente `data`, salvo quando indicado. UUIDs e timestamps escritos como `<uuid>`/`<UTC>` são metassintaxe documental, não valores literais válidos. Números de recompensas nos exemplos são formatos ilustrativos e não taxas aprovadas. Strings como `<coins>` representam inteiro decimal não negativo. Valores grandes usam strings; contadores pequenos, versões e offsets usam JSON number inteiro.

Mutação exige `Idempotency-Key` gerada pelo cliente para aquela intenção e reaproveitada em retries. Rotas de versão exigem `If-Match: "<version>"`. Mesma chave + conteúdo equivalente retorna resposta persistida; mesmo par chave/operação com conteúdo diferente retorna 409. Diferenças de espaços/ordem de chaves JSON não alteram o hash canônico. Ler proprietário e validar autorização antes de devolver resposta em cache. Não reutilizar chave ao modificar a intenção.

Erros comuns: 400 `INVALID_REQUEST`, 401 `UNAUTHENTICATED`, 403 `ACCOUNT_LOCKED`/`CSRF_REJECTED`, 404 `RESOURCE_NOT_FOUND`, 409 `IDEMPOTENCY_KEY_REUSED`/`OPERATION_IN_PROGRESS`/`STATE_CONFLICT`, 412 `VERSION_CONFLICT`, 422 `DOMAIN_RULE_VIOLATION`, 429 `RATE_LIMITED`, 503 `TEMPORARILY_UNAVAILABLE`. O exemplo de conflito de escalação acima usa 412. Recursos de outro clube respondem 404. Limites de corpo e rate limit serão parâmetros operacionais, não números inventados neste contrato.

Listas usam `limit` (padrão/máximo Q09) e `cursor` opaco, ordenação estável por `(created_at,id)` ou chave descrita. Resposta `{"items":[],"nextCursor":null}`. Nunca paginação por offset para histórico econômico. Sem aceitar `clubId` em corpo para escolher o proprietário; clube é derivado da sessão.

## Catálogo de endpoints M1

| Método / rota | Request | Response / semântica |
|---|---|---|
| `GET /bootstrap` | Sem body | 200: conta, clube ou null, regras públicas, gates, presença e farm; funciona antes da criação do clube |
| `POST /clubs` | `{name}` | 201: clube, cinco atletas, escalação, carteira; 409 se já existe clube com outra intenção |
| `GET /club` | — | 200: clube, saldo, progresso e desbloqueios |
| `GET /athletes` | filtros `rarity`, `sort=createdAt/ovr`, cursor | 200: lista paginada de resumos da Coleção |
| `GET /athletes/{athleteId}` | — | 200: ficha completa e seis atributos/tetos |
| `GET /inventory` | cursor | 200: materiais e quantidades; catálogo pode incluir quantidades zero |
| `GET /lineup` | — | 200: versão e cinco slots; ETag correspondente |
| `PUT /lineup` | `{slots:[{slot,athleteId}]}` + If-Match | 200: escalação persistida e aplicação na próxima partida; 422 se duplicada/incompleta/não pertencente |
| `GET /farm` | — | 200: sessão, estado desejado/execução, partida atual, elegibilidade offline |
| `POST /farm/start` | `{regionId}` | 200: farm e partida atual ou estado em processamento; iniciar farm já ativo na mesma região é no-op |
| `POST /farm/stop` | `{}` | 200: desiredState STOPPED; partida atual termina normalmente; não cria outra |
| `PUT /farm/region` | `{regionId}` + If-Match da farm | 200: região desejada para próxima partida; 422 se bloqueada/não disponível M1 |
| `POST /presence/acquire` | `{clientInstanceId}` | 200: lease de controle e fencing token; nova aquisição substitui dono anterior |
| `POST /presence/heartbeat` | `{leaseGeneration,sequence}` | 200: validade de presença e progresso da renovação; sequência monotônica |
| `POST /presence/release` | `{leaseGeneration}` | 200: encerra presença atual no horário do servidor; sessão antiga não encerra lease novo |
| `GET /matches/current` | — | 200: partida atual ou null; consulta não inicia farm nem concede recompensa |
| `GET /matches` | cursor | 200: histórico por início/id decrescente, estado, placar se disponível |
| `GET /matches/{matchId}` | — | 200: snapshot público, estado, tempos, resultado/concessões se liquidada |
| `GET /matches/{matchId}/events` | `afterSequence` opcional | 200: eventos liberados, `lastSequence`, `complete`; offset futuro não é exposto |
| `GET /rewards` | cursor, `matchId` opcional | 200: concessões já persistidas |
| `GET /wallet/entries` | cursor | 200: razão de Coins e saldo atual, sem permitir escrita |
| `POST /offline/reconcile` | `{}` | 202: relatório em processamento, `reportId`, `statusUrl`; chamada repetida não paga novamente |
| `GET /offline/reports/{reportId}` | — | 200: progresso ou resumo final agregado de grants; nada a “resgatar” |

Rotas de login/logout e eventual callback do provedor dependem de Q08; fora deste catálogo porque identidade concreta ainda não foi selecionada. G2 exige fechá-las antes de acesso externo. Não há endpoint cliente `finish`, `award`, `setBalance`, `setXp` ou `forceUnlock`.

## Payloads de referência

### Bootstrap e criação

`GET /bootstrap`:

```json
{
  "account": {"id":"<uuid>","status":"ACTIVE"},
  "club": null,
  "publicRules": {
    "version":"<rules-version>",
    "matchDurationSeconds":90,
    "teamSize":5,
    "ovrMax":99,
    "offlineMaxSeconds":86400,
    "offlineRenewOnlineSeconds":600
  },
  "canCreateClub":true,
  "farm":null,
  "presence":null
}
```

`POST /clubs` request `{"name":"Clube Exemplo"}`. Resposta contém `club`, `starterAthletes` com exatamente cinco fichas, `lineup`, `wallet` e `progress`. Uma falha em qualquer concessão inicial reverte tudo. Mesma chave retorna os mesmos IDs. Outra chave após sucesso retorna `CLUB_ALREADY_EXISTS`; não cria mais atletas.

### Clube, atleta e escalação

`GET /club`:

```json
{
  "id":"<uuid>",
  "name":"Clube Exemplo",
  "version":1,
  "wallet":{"balance":"<coins>","version":1},
  "progress":{"xpTotal":"<xp>","level":"<level>","nextRegionId":"REGIONAL","xpToNextRegion":"<xp>","rulesVersion":"<version>"},
  "unlockedRegionIds":["VARZEA"]
}
```

Ficha de atleta:

```json
{
  "id":"<uuid>",
  "displayName":"Atleta Exemplo",
  "rarity":"P1",
  "origin":"STARTER",
  "xpTotal":"<xp>",
  "level":"<level>",
  "ovr":"<ovr-decimal>",
  "attributes":[{"key":"<approved-attribute-key>","value":"<decimal>","individualCap":"<decimal>"}],
  "inLineup":true,
  "version":1,
  "rulesVersion":"<version>"
}
```

`attributes` acima abrevia uma lista que deve conter exatamente **seis** elementos distintos; `<approved-attribute-key>` depende de Q01. Tipo decimal de OVR/atributos permite precisão definida posteriormente; a UI só arredonda para exibição conforme ruleset.

`PUT /lineup`: `slots` contém exatamente `{slot:1..5,athleteId:UUID}` uma vez para cada slot, cinco UUIDs distintos. Resposta `{"version":8,"slots":[...],"effectiveFrom":"NEXT_MATCH","currentMatchId":"<uuid-or-null>"}`. O `...` é abreviação documental, não JSON transmitido. Sem partida ativa, vale para a primeira a iniciar. Mudanças concorrentes retornam 412 com versão atual, sem sobrescrever.

### Farm e presença

`POST /farm/start`, request `{"regionId":"VARZEA"}`:

```json
{
  "id":"<uuid>",
  "version":1,
  "desiredState":"RUNNING",
  "executionState":"READY",
  "selectedRegionId":"VARZEA",
  "currentMatchId":"<uuid-or-null>",
  "offline":{"remainingMs":0,"qualifyingOnlineMs":0,"renewedAt":null}
}
```

Para iniciar, exigir lease válido e escalação válida; estar logado sem presença não basta. O estado `READY` indica capacidade de continuar; a partida pode ser criada pelo worker logo depois. Campo `currentMatchId` aceita UUID ou null reais, sem string `"null"`.

`POST /presence/acquire`, request `{"clientInstanceId":"<uuid>"}`:

```json
{
  "leaseGeneration":3,
  "validUntil":"<UTC>",
  "heartbeatRecommendedAfterMs":"<configured-integer>",
  "serverTime":"<UTC>",
  "offlineRenewal":{"qualifyingOnlineMs":0,"requiredOnlineMs":600000,"remainingOfflineMs":0}
}
```

`heartbeatRecommendedAfterMs` será JSON number inteiro; a string aqui indica parâmetro ainda pendente, não um tipo final string. Heartbeat: `{"leaseGeneration":3,"sequence":1}`; responde com a mesma estrutura e novo `validUntil`. `sequence` repetida retorna resposta anterior sem prolongar lease de novo. Menor sequência retorna `STALE_HEARTBEAT`; geração antiga retorna `PRESENCE_LEASE_REPLACED` (409). Não aceita timestamp, duração online ou status de vitória do cliente. Reaquisição não zera nem duplica períodos já contabilizados.

### Partida

`GET /matches/{matchId}`:

```json
{
  "id":"<uuid>",
  "state":"SETTLED",
  "sequence":1,
  "regionId":"VARZEA",
  "startAt":"<UTC>",
  "endAt":"<UTC-plus-90s>",
  "lineupVersion":7,
  "rulesVersion":"<version>",
  "replayVersion":1,
  "teams":{"HOME":{"athletes":[]},"AWAY":{"athletes":[]}},
  "result":{"homeGoals":0,"awayGoals":0,"outcome":"DRAW"},
  "rewardMode":"ONLINE",
  "rewardGrantIds":["<uuid>"],
  "settledAt":"<UTC>"
}
```

`teams` é abreviado: cada lado contém exatamente cinco `{actorId,athleteId?,slot,displayName,ovr,attributes}` do snapshot; `actorId` é estável dentro da partida e usado nos eventos. `athleteId` só para atletas do próprio jogador. Não expor seed nem tabelas internas. Antes da liquidação `result`, `rewardMode`, `settledAt` são null e `rewardGrantIds` vazio.

**D13 — replay mínimo:** eventos persistidos, ordenados e independentes da renderização. Sem coordenadas/táticas obrigatórias em M1. Cliente anima marcador, posse e texto; PixiJS poderá consumir os mesmos eventos ou uma futura versão compatível.

| Evento | Campos específicos em `payload` | Regras |
|---|---|---|
| `MATCH_STARTED` | `homeActorIds`, `awayActorIds` | sequence=1, offset=0; cinco por lado |
| `POSSESSION_CHANGED` | `team HOME/AWAY`, `actorId` | ator deve pertencer ao lado informado |
| `CHANCE_CREATED` | `team`, `actorId` | frequência e seleção dependem do simulador Q10 |
| `SHOT_RESOLVED` | `team`, `actorId`, `outcome GOAL/SAVED/MISSED`, `scoreAfter` | gol atualiza placar uma vez; não criar segundo evento que o conte de novo |
| `MATCH_ENDED` | `homeGoals`, `awayGoals`, `outcome WIN/DRAW/LOSS` | offset=90000; resultado sempre da perspectiva HOME/clube |

Exemplo de resposta de eventos:

```json
{
  "matchId":"<uuid>",
  "schemaVersion":1,
  "events":[
    {"sequence":1,"offsetMs":0,"type":"MATCH_STARTED","payload":{"homeActorIds":["h1","h2","h3","h4","h5"],"awayActorIds":["a1","a2","a3","a4","a5"]}},
    {"sequence":2,"offsetMs":90000,"type":"MATCH_ENDED","payload":{"homeGoals":0,"awayGoals":0,"outcome":"DRAW"}}
  ],
  "lastSequence":2,
  "complete":true
}
```

O exemplo é uma partida sem chances, usado para mostrar o contrato; não define frequência de gols. `sequence` estritamente crescente sem lacunas no replay final; `offsetMs` não decresce, empates de offset desempata por sequence. Placar final é igual ao agregado dos `SHOT_RESOLVED` com GOAL. Cada ator citado deve existir no snapshot.

Em M1, durante RUNNING/RESOLVING, a consulta de eventos pode retornar lista vazia, `lastSequence=0` e `complete=false`: a UI mostra cronômetro e estado. A lista completa é persistida na liquidação e liberada após SETTLED para replay. Se futuramente houver liberação incremental durante RUNNING, somente eventos com offset≤tempo do servidor transcorrido podem ser expostos; isso não faz parte do aceite M1. `MATCH_ENDED` e resultado só são públicos após SETTLED. `complete=true` apenas quando todos os eventos e o resultado final estão persistidos. Reconectar com `afterSequence` não repete eventos anteriores. O cliente deduplica por `(matchId,sequence)` e consulta servidor ao detectar lacuna; não altera resultado pelo relógio local.

### Recompensas, inventário, razão e offline

Grant público: `{"id":"<uuid>","matchId":"<uuid>","kind":"COINS","targetKey":"club","amount":"<coins>","createdAt":"<UTC>"}`. XP indica atleta/clube; material indica `materialId`; atleta drop indica `athleteId` e raridade. Todas as quantidades são determinadas no servidor. A lista inclui somente grants confirmados.

Depósito: `{"items":[{"materialId":"<catalog-id>","label":"<label>","tier":"COMMON","quantity":"<quantity>"}],"nextCursor":null}`. Sem capacidade/inventário cheio em M1 (D02). Não existe ação destrutiva nem gasto.

Razão: `{"balance":"<coins>","items":[{"id":"<uuid>","delta":"<signed-integer>","balanceAfter":"<coins>","reason":"MATCH_REWARD","matchId":"<uuid>","createdAt":"<UTC>"}],"nextCursor":null}`.

`POST /offline/reconcile` retorna `{"reportId":"<uuid>","status":"PROCESSING","statusUrl":"/v1/offline/reports/<uuid>"}`. O worker pode já ter liquidado parte ou tudo; a chamada reconcilia e constrói uma projeção do período pendente. Relatórios de intervalos fechados são estáveis e não contam o mesmo grant duas vezes dentro do relatório.

Relatório final:

```json
{
  "id":"<uuid>",
  "status":"COMPLETE",
  "fromAt":"<UTC>",
  "toAt":"<UTC>",
  "eligibleOfflineMs":0,
  "cappedOfflineMs":0,
  "matchCount":0,
  "coins":"0",
  "clubXp":"0",
  "athleteXp":[],
  "materials":[],
  "athleteDropCount":0,
  "offlineRemainingMs":0,
  "requiresOnlineRenewal":true
}
```

Aqui zeros são exemplo de ausência sem crédito, não taxa de recompensa. `matchCount` conta partidas com contribuição offline; grants de uma partida MIXED são apresentados com a parcela offline separada no payload. Não somar totais de relatórios potencialmente sobrepostos para estimar saldo; a carteira e o histórico de grants são as fontes canônicas.

## Compatibilidade e entrega

Mudanças aditivas mantêm `/v1`; mudanças incompatíveis precisam de nova versão. Eventos usam versão própria; replays antigos continuam interpretáveis. UI consulta HTTP com intervalo operacional configurável; WebSocket/SSE não é dependência de M1. Não confundir polling de interface com heartbeat de presença. API fornece horários do servidor, estados e ETags para o cliente resolver atraso e concorrência.
