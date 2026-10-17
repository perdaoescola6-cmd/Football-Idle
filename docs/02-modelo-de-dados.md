# 02 — Modelo de dados inicial

Modelo lógico para PostgreSQL; não é migração SQL. UUID identifica entidades; instantes usam `timestamptz` UTC do servidor. Durações e offsets em milissegundos, exceto parâmetros explicitamente em segundos. Quantidades inteiras grandes e XP trafegam como strings decimais no JSON para não perder precisão em JavaScript.

## Convenções e invariantes

- Coins e quantidades: inteiros, sem ponto flutuante. Moeda fracionária não existe em M1. Arredondamento sempre determinado por ruleset.
- XP e nível: `numeric` inteiro de precisão arbitrária no domínio, com validação de formato e limite de tamanho da requisição. Não há teto de nível de jogo. Limites físicos de armazenamento não viram teto de design; operações sobre números muito grandes precisam de orçamento computacional.
- Versões otimistas: inteiro crescente por agregado. `created_at` e `updated_at` conforme aplicável; objetos imutáveis não têm atualização de conteúdo.
- Dados de uma conta nunca são consultados apenas pelo ID fornecido pelo cliente: escopo por proprietário é obrigatório.
- Sem remoção física de partidas, razão ou concessões durante M1. Retenção/anonimização operacional é Q09.

## Entidades

| Entidade | Campos principais e tipos | Restrições e índices essenciais |
|---|---|---|
| `account` | `id uuid`, `subject text`, `status ACTIVE/LOCKED`, timestamps | unique(subject); identidade externa ainda Q08 |
| `auth_session` | `id uuid`, `account_id`, `token_hash`, `expires_at`, `revoked_at` | unique(token_hash); índice(account_id, expires_at); nunca armazenar token em claro |
| `ruleset` | `id uuid`, `version text`, `status DRAFT/ACTIVE/RETIRED`, `schema_version int`, `config jsonb`, `checksum text`, `activated_at` | unique(version); conteúdo congelado após ativação; nenhum campo obrigatório pendente ao ativar |
| `club` | `id`, `account_id`, `name text`, `status ACTIVE/SUSPENDED`, `version`, timestamps | unique(account_id), FK account; validação de nome é Q12 |
| `club_progress` | `club_id PK`, `xp_total numeric`, `level numeric`, `ruleset_id`, `version` | XP ≥0, nível ≥1; nível é projeção recalculável; XP nunca decresce no fluxo normal |
| `region_definition` | `id VARZEA/REGIONAL/ESTADUAL/NACIONAL/CONTINENTAL/EUROPA/ELITE`, `label`, `threshold numeric`, `enabled_m1 bool`, `ruleset_id` | PK(ruleset_id,id); threshold >0; apenas Várzea/Regional habilitadas em M1 |
| `club_region_unlock` | `club_id`, `region_id`, `unlocked_at`, `source_match_id?`, `ruleset_id`, `progress_value numeric` | PK(club_id,region_id); desbloqueio append-only; inserir Várzea no cadastro |
| `attribute_definition` | `ruleset_id`, `key text`, `label`, `ordinal int` | PK(ruleset_id,key), unique(ruleset_id,ordinal); exatamente 6 na ativação do ruleset; nomes Q01 |
| `athlete` | `id`, `club_id`, `rarity P1/P2/P3/P4/P5`, `display_name`, `origin STARTER/ONLINE_DROP`, `source_grant_id?`, `xp_total numeric`, `level numeric`, `ovr numeric`, `ruleset_id`, `version` | XP ≥0, nível ≥1, 0≤OVR≤99; unique(id,club_id) para FK de posse; índice(club_id,id), (club_id,rarity,ovr); nome não é identidade |
| `athlete_attribute` | `athlete_id`, `attribute_key`, `definition_ruleset_id`, `value numeric`, `individual_cap numeric` | PK(athlete_id,attribute_key); 0≤value≤individual_cap; seis linhas por atleta, validadas na mesma transação |
| `lineup` | `club_id PK`, `version`, `updated_at` | uma escalação por clube |
| `lineup_slot` | `club_id`, `slot int`, `athlete_id` | PK(club_id,slot), unique(club_id,athlete_id), slot 1..5; FK composta(athlete_id,club_id) garante posse; cinco slots validados no commit |
| `farm_session` | `id`, `club_id`, `desired_state RUNNING/STOPPED`, `execution_state READY/WAITING_PRESENCE/OFFLINE_EXHAUSTED/SUSPENDED`, `selected_region`, `ruleset_id`, `next_sequence bigint`, `last_completed_end_at`, `version` | unique parcial(club_id) quando desired_state=RUNNING; índice para reconciliar pendentes; sem sessões ativas paralelas |
| `match` | `id`, `club_id`, `farm_session_id`, `sequence bigint`, `state SCHEDULED/RUNNING/RESOLVING/SETTLED/VOIDED`, `start_at`, `end_at`, `ruleset_id`, `lineup_version`, `snapshot jsonb`, `snapshot_hash`, `seed_encrypted`, `algorithm_version`, `result jsonb?`, `mode ONLINE/OFFLINE/MIXED/INELIGIBLE?`, `version` | unique(farm_session_id,sequence); índice(club_id,start_at desc); índice(state,end_at); unique parcial(club_id) em SCHEDULED/RUNNING/RESOLVING; end_at=start_at+90s |
| `match_event` | `match_id`, `sequence int`, `offset_ms int`, `type`, `payload jsonb`, `schema_version int` | PK(match_id,sequence), 0≤offset≤90000; sequência ordenada; índice não adicional necessário |
| `reward_grant` | `id`, `club_id`, `match_id`, `ruleset_id`, `kind COINS/ATHLETE_XP/CLUB_XP/ATHLETE_DROP/MATERIAL`, `target_key text`, `ordinal int`, `amount numeric?`, `payload jsonb`, `created_at` | unique(match_id,kind,target_key,ordinal); amount≥0; target_key obrigatório mesmo em concessão de clube; índice(club_id,created_at,id) |
| `wallet` | `club_id PK`, `balance numeric`, `version` | balance≥0 e inteiro; um saldo por clube, cache transacional do razão |
| `coin_ledger_entry` | `id`, `club_id`, `wallet_version bigint`, `delta numeric`, `balance_after numeric`, `reason MATCH_REWARD/ADMIN_CORRECTION`, `source_type MATCH/ADMIN`, `source_id uuid`, `source_key text`, `reverses_entry_id?`, `created_at` | delta inteiro ≠0, balance_after≥0; unique(club_id,source_key); unique(club_id,wallet_version); índice(club_id,created_at,id); FK reversão e unicidade de reversão quando existente |
| `material_definition` | `ruleset_id`, `id text`, `label`, `tier COMMON/RARE/EXCEPTIONAL` | PK(ruleset_id,id); catálogo Q06 |
| `inventory_balance` | `club_id`, `material_id`, `catalog_ruleset_id`, `quantity numeric`, `version` | PK(club_id,material_id); quantity≥0 inteira; identidade material estável entre rulesets |
| `inventory_movement` | `id`, `club_id`, `material_id`, `delta numeric`, `source_grant_id`, `created_at` | unique(source_grant_id); índice(club_id,created_at,id); delta positivo em M1 |
| `presence_interval` | `id`, `club_id`, `owner_session_id`, `start_at`, `end_at`, `last_heartbeat_at` | intervalo fechado/fechado-aberto normalizado; ausência de sobreposição por clube; índice(club_id,start_at,end_at) |
| `presence_lease` | `club_id PK`, `owner_session_id`, `generation bigint`, `valid_until`, `last_sequence bigint`, `version` | fencing token impede sessão antiga de estender lease; um dono por clube |
| `offline_entitlement` | `club_id PK`, `generation bigint`, `renewed_at?`, `remaining_ms bigint`, `qualifying_online_ms bigint`, `last_accounted_at`, `fractional_carry jsonb`, `version` | 0≤remaining_ms≤86400000; 0≤qualifying_online_ms≤600000; lock por clube |
| `offline_budget_generation` | `club_id`, `generation bigint`, `opened_at`, `closed_at?`, `budget_ms bigint`, `consumed_ms bigint` | PK(club_id,generation); budget_ms=86400000 por renovação aprovada; 0≤consumed_ms≤budget_ms; intervalos de vigência não sobrepostos; histórico preservado |
| `offline_budget_debit` | `match_id`, `club_id`, `generation`, `eligible_ms bigint` | PK(match_id,generation); eligible_ms>0; FK(club_id,generation); soma dos débitos coincide com consumed_ms; atualizar sob lock |
| `offline_report` | `id`, `club_id`, `from_at`, `to_at`, `status PROCESSING/COMPLETE`, `totals jsonb`, `last_match_sequence`, timestamps | unique(club_id,from_at,to_at); projeção das concessões, nunca fonte de pagamento |
| `idempotency_record` | `account_id`, `operation`, `key text`, `request_hash`, `status IN_PROGRESS/COMPLETED`, `http_status?`, `response jsonb?`, `created_at`, `expires_at` | PK(account_id,operation,key); retenção Q09; hash inclui parâmetros de rota/body relevantes |
| `work_item` | `id`, `kind RESOLVE_MATCH/CONTINUE_FARM/RECONCILE_PRESENCE`, `aggregate_id`, `dedupe_key`, `due_at`, `status PENDING/LEASED/DONE/RETRY`, `lease_owner?`, `lease_generation bigint`, `lease_until?`, `attempts`, `last_error_code?` | unique(dedupe_key); índice(status,due_at), índice(lease_until) para recuperação; incrementar geração a cada aquisição |
| `audit_event` | `id`, `actor_type`, `actor_id?`, `club_id?`, `action`, `correlation_id`, `metadata jsonb`, `created_at` | índice(club_id,created_at); não registrar tokens, seeds ou dados sensíveis desnecessários |

`?` indica nullable. Algumas regras entre linhas (exatamente cinco slots/seis atributos, invariantes de snapshots e intervalos) precisam de transação/constraint trigger ou escrita exclusiva pelo serviço validada no commit; um simples `CHECK` de linha não basta. A implementação futura deve escolher e testar o mecanismo, sem alegar que FKs isoladas garantem cardinalidade.

## Relações e snapshots

Conta 1:1 clube; clube 1:N atletas/partidas/concessões; partida 1:N eventos/concessões; atleta 1:6 atributos. Carteira e progresso são 1:1 clube.

Snapshot da partida contém os dez atletas dos dois lados, atributos efetivos, tetos relevantes, nível/OVR, slots, IDs de origem (NPCs usam identificadores do snapshot), regras de XP e recompensa e oponente gerado. Não referencia estado mutável para simular novamente. Seeds e fórmulas internas ficam apenas no servidor. Uma mudança de atributo durante a partida afeta a seguinte.

`offline_entitlement` é a projeção da geração atual. O histórico de gerações e débitos permite liquidar janelas antigas depois de uma renovação, sem gastar crédito da geração nova. `fractional_carry` possui chaves por tipo/beneficiário, numerador inteiro e denominador exato; cada grant de modo MIXED guarda parcelas online/offline e tempos O/F/U para auditoria e relatório. Alterações de configuração da farm são serializadas após fechar o passado pendente; antes de alterá-la não pode haver janela histórica sem snapshot à qual a nova configuração se aplicaria por acidente.

Coleção é uma consulta de atletas possuídos, sem uma segunda tabela de propriedade ou bônus de álbum (D02). Depósito é a projeção do inventário. Não há transferências em M1, portanto `athlete.club_id` não muda pelo jogo normal.

## XP, nível, atributos e OVR

`xp_total` é cumulativo. A função versionada `levelForXp(xp_total)` é monotônica e não possui último nível. Ganho de atributos respeita cada `individual_cap`. Ao atingir todos os tetos, o nível pode continuar aumentando sem elevar atributos ou OVR.

`ovrForAttributes(seis valores, regras)` deve retornar no máximo 99. Pesos, escala, arredondamento e limites são Q01–02; **não assumir média aritmética**. OVR e nível são projeções de dados canônicos, com versão de cálculo. Não comparar OVR de regras distintas sem política de migração. Tetos não são sorteados novamente ao subir nível ou recarregar.

**D07:** apenas os cinco atletas do snapshot recebem XP de partida, em política ainda Q02; reservas não ganham XP de farm. Treino de reserva fica no CT futuro. XP do clube é independente do nível dos titulares.

## Livro-razão de Coins — D06

1. Toda mudança de saldo cria uma entrada imutável, inclusive correção administrativa. Sem atualização direta de saldo e sem exclusão de linha.
2. Ao liquidar: bloquear carteira; verificar chave `match:{matchId}:coins`; calcular delta de regras congeladas; se delta>0, inserir razão e atualizar saldo/cache e versão na mesma transação da partida. Se delta=0, registrar concessão zero, sem entrada de razão zero.
3. O saldo inicial proposto é zero (E01), até aprovação. Eventual saldo inicial positivo exige razão própria, não edição de cache.
4. Invariante: `wallet.balance = soma(delta)` desde a origem da carteira, começando em zero; cada `balance_after` corresponde à ordem serial de atualização daquela carteira. Timestamp sozinho não define ordem; `wallet_version` da entrada registra essa ordem.
5. Correção: nova entrada compensatória, motivo e ator auditados, referência original. Não permite saldo negativo nem alteração retroativa do histórico; exceções exigem processo de suporte fora do fluxo M1.
6. Auditoria reconcilia soma, cache, concessões e partidas. Divergência suspende novas liquidações do clube para investigação; nunca “ajusta” silenciosamente o saldo.

M1 usa um razão de movimentos por carteira. Uma contabilidade de partidas dobradas e contas de emissão/queima poderá ser avaliada ao introduzir transferências; não confundir o modelo atual com essa contabilidade futura.

## Evolução segura

Rulesets ativos são imutáveis. Atletas, partidas e grants guardam origem. A troca de regras acontece entre partidas e exige estratégia explícita para recalcular projeções sem reduzir desbloqueios já obtidos. Não antecipar tabelas completas de CT/P2P/ligas; manter IDs estáveis e razão extensível com migração futura revisada.

O validador de ativação de `ruleset.config` exige grupos completos: `attributes` (seis definições e tetos), `athleteProgression` (XP/nível/crescimento/OVR), `clubProgression` (curva e regiões), `starterRoster` (geração dos cinco), `simulation` (força, chances, gols, NPCs), `rewards` (XP/Coins/ocorrência de atleta/pesos P1–P5/materiais), `offline` (políticas ratificadas) e `presence` (lease/heartbeat). Cada grupo carrega versão do algoritmo e parâmetros explícitos. Valores de teste têm status experimental no manifesto do perfil; nenhum `null`, nome fictício de atributo ou fallback de recompensa pode ativar um perfil. Os nomes desses grupos são uma proposta de organização, não um arquivo de configuração já implementado.
