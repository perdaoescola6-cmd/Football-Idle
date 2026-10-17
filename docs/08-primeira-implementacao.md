# 08 — Primeira implementação local

Data: 17/10/2026. Versão do jogo: 0.1.0. Ruleset: **M1-E0.1**.

## Autorização e status das decisões

**U2:** pedido do usuário para “seguir para o código e começar a criar o jogo”, após revisar o perfil experimental. Autoriza iniciar a implementação local. G0 foi satisfeito para esta etapa. A base escolhida é M1-E0 como perfil de teste, mantendo seus valores novos como experimentais; isso não os torna regras definitivas de produto.

O histórico documental 01–07 descreve a especificação e as pendências daquele momento. Este registro identifica o que foi efetivamente implementado e as simplificações da primeira versão. M1 não deve ser considerado aceito em sua totalidade apenas porque o protótipo local funciona.

## Implementado

| Fluxo | Comportamento |
|---|---|
| Entrada | Conta anônima no servidor e sessão persistente no navegador; cookie HttpOnly, SameSite Strict, Secure em modo production |
| Criação | Um clube por conta, cinco P1 iniciais, atributos/tetos de M1-E0; transação e chave de idempotência |
| Escalação | Cinco IDs próprios e distintos, versão otimista, snapshot da partida preservado |
| Farm | Um jogo ativo por clube, 5v5, 90s lógicos, start/stop e continuidade pelo worker |
| Regras | Fórmulas do perfil, valores inteiros/BigInt, níveis sem teto lógico, tetos e OVR máximo 99 |
| RNG | `hmac-sha256-counter-v1`, streams por rótulo, rejeição de viés de módulo; seed secreta persistida; IDs/seed por sequência de farm |
| Recompensas | Coins, XP clube/titulares, material comum e drops de atleta; commit atômico de estado, grants, razão e inventário |
| Presença | Lease 30s, heartbeat 10s, fencing entre abas, nenhuma soma de períodos sobrepostos |
| Offline | Orçamento por geração histórica, renovação em 600s contínuos, até 24h, parcelas exatas em partidas mistas, restos por beneficiário |
| Progresso | XP de clube independente de titulares; Regional após 1.100 XP, desbloqueio persistido |
| UI | Painel, cinco slots editáveis, Coleção, Depósito, histórico e replay com controle de posição/reprodução 6× |
| Segurança | Origem e cabeçalho obrigatório em mutações, validação estrita, limite de payload e rate limit local, autorização por conta e seed ausente das respostas |
| Integridade | Carteira comparada com razão e runtime ao carregar clube; divergência bloqueia operações; trigger recusa UPDATE/DELETE no razão |

## Diferenças intencionais frente ao modelo-alvo

1. **Banco de desenvolvimento:** PostgreSQL embarcado via PGlite, persistente em `.data/postgres`, sem Docker. Conexão via `pg` aceita `DATABASE_URL` para PostgreSQL externo. Não existe sincronização automática entre os dois bancos.
2. **Worker local:** integrado ao processo da API para respeitar o único dono do banco embarcado. Com PostgreSQL externo, pode rodar separado. Não se afirmou validação de rede sem serviço real disponível.
3. **Fila durável mínima:** partidas RUNNING com `end_at` persistido são a fila. O worker consulta vencimentos e serializa por lock do clube. Não há ainda tabela genérica de `work_item`, leases de tarefa ou backoff persistido. A atomicidade/locks/unicidade garantem reprocessamento seguro; a sofisticação operacional permanece posterior.
4. **Esquema incremental:** economia, partidas, atletas, slots, inventário, sessões, grants e unlocks possuem tabelas com índices/constraints. Metadados de progresso, presença, gerações offline, restos e controle da farm estão em `clubs.runtime` JSONB, atualizado sob lock na mesma transação. São estado canônico transacional, não estado em memória. A normalização completa do documento 02 continua no backlog; não há trigger cobrindo toda regra interna do JSONB.
5. **Regras:** versão constante no domínio e em cada snapshot; sem interface de ativação de rulesets no banco. Esta versão só suporta M1-E0.1. Antes de mudar fórmulas em uma instalação com partidas pendentes, é preciso implementar seleção/manutenção de versões antigas; não atualizar silenciosamente o algoritmo de partidas existentes.
6. **Contrato da UI:** `GET /v1/club` devolve um agregado `GameView` com painel, atletas, último histórico e razão, em vez de todas as rotas de consulta paginadas do documento 03. `POST /v1/clubs` devolve o ID, seguido da leitura do agregado. Campos de data no contrato TypeScript desta versão são milissegundos de servidor; o envelope HTTP mantém horário ISO. O contrato efetivo está em `packages/contracts` e nas rotas de `apps/server/src`.
7. **Presença:** corpos incluem `clientInstanceId` para vincular comandos/heartbeats à aba, além da sessão. Start/stop/lineup exigem geração de controle. Para trocar região, parar o farm, escolher a região e reiniciar. A atual termina com sua região original.
8. **Reconciliação:** `POST /v1/offline/reconcile` retorna agregado e status PROCESSING/RECONCILED; não existem ainda relatórios históricos separados. Não concede um segundo pagamento. Cada lote processa até 32 términos; o worker continua os demais. A UI mostra processamento de ausência longa.
9. **Histórico:** a UI mostra 10 partidas e 20 entradas de razão, com dados antigos preservados no banco. Paginação completa e filtros da Coleção ainda não foram implementados.
10. **Identidade:** sessão anônima local de 30 dias, sem senha/recuperação/dispositivo adicional. Sem publicação externa nesta etapa. Q08 foi resolvida apenas para experimentar o jogo no mesmo navegador.

Essas escolhas reduzem a montagem inicial sem mudar 90s/5v5, odds condicionais de raridade, cap offline, fatores aprovados ou progresso permanente. Não há autorização implícita de deploy ou de serviços pagos.

## Verificações realizadas

- TypeScript do domínio/API/frontend sem erros na verificação registrada.
- Build Next.js concluído; uma restrição de escrita do sandbox exigiu executar a compilação com a permissão disponível para o próprio workspace.
- Onze testes automatizados passaram: fronteiras exatas de P1–P5, XP/nível muito grande, OVR/tetos, Regional no 40º jogo, determinismo, snapshots, presença, limite de 24h, janelas mistas, janela sem elegibilidade, integração SQL/API, CSRF, isolamento e recuperação após falha de transação.
- O teste de integração usa PostgreSQL embarcado real em memória. Uma trigger de QA força falha na concessão para verificar rollback de partida/carteira/grants. Retry confirma uma única recompensa. A trigger de imutabilidade do razão também foi testada.
- Browser: criação de “União da Vila” com cinco titulares; troca de slots 1/2 salva durante a partida sem alterar o snapshot em campo; stop impediu novo início e a partida corrente terminou após 90s reais. O empate 0×0 concedeu 12 Coins, 28 XP de clube, 20 XP por titular, um atleta P1 e um Suprimento comum. O drop observado foi sorteio normal, sem garantia ou seed forçada.
- Replay de 29 eventos reproduzido e navegado até o término; razão com uma entrada de +12; console sem warnings/erros no ponto verificado. [Captura do protótipo](provas/prototipo-replay.jpg).
- API/frontend encerrados e reiniciados usando o mesmo banco em arquivo; uma nova aba do mesmo navegador recuperou clube, escalação alterada, seis atletas, saldo 12 e XP 28. A aba antiga permaneceu na tela de erro durante o reinício; reabrir o endereço em nova aba restabeleceu o fluxo sem perder dados.
- Leitura HTTP testada sem conceder recompensas por si só; divergência proposital da carteira foi recusada com 503, sem sobrescrever silenciosamente o razão.

| Fronteira verificada | Evidência |
|---|---|
| UI → API | Formulário criou clube; salvar escalação e iniciar/parar deram feedback confirmado |
| API → PostgreSQL | Teste de integração, constraints e rollback por trigger de falha; reinício com dados em arquivo preservados |
| Worker → concessões | Término real confirmou uma partida e um pagamento; retry no teste não duplicou |
| Resposta → UI | Saldo 12, XP 28, seis atletas, material, histórico e replay exibidos |
| Browser sem erro no fluxo ativo | Consulta de console retornou lista vazia de erros/warnings no ponto de verificação |

Relógio acelerado existe somente nos testes. Não houve aceleração do tempo do clube usado no browser. Não foi feita simulação estatística de balanceamento nem ensaio de carga.

## Pendências antes de considerar M1 integralmente aceito

- Completar paginação/consultas específicas e relatórios offline reutilizáveis do contrato-alvo.
- Separar e versionar rulesets persistidos com manutenção de algoritmos antigos.
- Normalizar/agregar índices do estado de presença e offline quando houver volume real; definir retenção.
- Ampliar testes de concorrência com PostgreSQL externo e múltiplos workers, observabilidade e recuperação operacional.
- Fechar autenticação recuperável, rate limit distribuído, backup/restauração, resposta a indisponibilidade e requisitos de acesso público.
- Testar uma sessão real de uma hora para Regional, além da validação com relógio controlado; validar peso da sorte, dificuldade e volume de drops.
- Refinar ergonomia sem adicionar CT/P2P/ligas ao slice.
