# 04 — Estados, idempotência, online/offline e segurança

Tudo nesta seção que resolve lacunas está identificado como decisão técnica **provisória** Dxx. Regras de economia aprovadas permanecem as de U1. A implementação futura precisa primeiro fixar um perfil de regras completo, passando pelos gates do índice.

## Partida e farm

| Origem | Destino | Condição / efeito |
|---|---|---|
| inexistente | SCHEDULED | farm RUNNING, região desbloqueada, escalação válida, presença ou crédito offline; criar snapshot, seed e tarefa com IDs únicos |
| SCHEDULED | RUNNING | start_at alcançado; end_at=start_at+90s; nenhuma transação fica aberta esperando |
| RUNNING | RESOLVING | agora≥end_at e presença até end_at fechada; lease do worker obtido |
| RESOLVING | SETTLED | transação atômica de resultado, eventos, grants, XP, Coins, inventário, progresso, desbloqueios e tarefa de continuação |
| SCHEDULED | VOIDED | falha de pré-condição antes de começar, registrada e sem recompensa |
| RUNNING/RESOLVING | VOIDED | somente invalidação operacional auditada por snapshot irrecuperável; sem nova seed/re-roll; não é ação do jogador |
| SETTLED/VOIDED | — | terminais; repetição retorna o estado existente |

Falha temporária não transforma partida em VOIDED: estado fica recuperável e a tarefa vai a RETRY. Worker com lease expirado pode repetir cálculo, mas precisa de versão/fencing e lock antes de gravar. RESOLVING não é uma trava eterna.

Farm possui **intenção** RUNNING/STOPPED e motivo de execução READY/WAITING_PRESENCE/OFFLINE_EXHAUSTED/SUSPENDED. `POST stop` impede o próximo início, sem cancelar recompensa da corrente. Start/stop e criação da próxima partida serializam no lock do clube/farm. Se o próximo início confirmou antes do stop, essa partida já é a corrente e termina; a resposta informa seu ID.

Reiniciar enquanto a corrente termina reutiliza a mesma farm e sua sequência, restabelecendo a intenção RUNNING; não cria outra sessão concorrente. Start em farm já RUNNING na mesma região é no-op; se outra região for pedida, retorna 409 `FARM_ALREADY_RUNNING`, orientando a rota específica de região. Suspensão operacional não pode ser removida pelo start do jogador. Uma farm encerrada sem partida pendente pode ser retomada sem zerar histórico, orçamento ou contador de sequência.

**D14:** não há intervalo obrigatório entre partidas. Início lógico seguinte é o término da anterior se a elegibilidade cobrir o período. Worker atrasado faz catch-up por janelas de 90s, sem usar a hora de processamento como tempo jogado. Sem cobertura, não iniciar janela nem avançar marcador como se tivesse recompensado; retomar a partir do próximo início elegível. Tempo sem farm ativo não gera recompensa retroativa.

Cada janela está ligada a uma única sequência de farm. O par sessão/sequência é único. Seleção de região e escalação vale no momento em que o snapshot é comprometido; nunca backdating de edição para janelas que já começaram. Edição e reconciliação fecham snapshots históricos pendentes antes de aplicar novas configurações. Depois de ausência prolongada, usar a última configuração vigente no início de cada janela, não a recebida no retorno.

## Liquidação e garantia de uma única concessão

Transporte e execução de tarefas são **pelo menos uma vez**. Efeitos econômicos são **uma vez por identidade de concessão**, garantidos pelo banco, e não pela esperança de que um worker só rode uma vez.

1. Obter tarefa vencida com lease curto e token de geração. Ler snapshot/ruleset imutáveis e calcular resultado determinístico fora da transação longa.
2. Abrir transação; bloquear clube/farm/partida, carteira e inventário na ordem definida em 01. Conferir versão, lease e estado. Se SETTLED, concluir tarefa sem conceder nada.
3. Fechar interseções de presença e crédito offline até end_at. Tempo já processado não volta ao orçamento. Gerar rewards com os subfluxos determinísticos daquela partida.
4. Inserir resultado, eventos e grants com chaves únicas. Aplicar XP e tetos aos atletas do snapshot, progresso do clube, razão e inventário. Avançar cursor temporal/entitlement, inserir unlocks idempotentes.
5. Marcar SETTLED e inserir trabalho de continuação/outbox na mesma transação. Confirmar. Só então disponibilizar resultado público.
6. Se qualquer escrita falhar, rollback de todas. Uma desconexão após commit não desfaz o commit; retry encontra o estado já confirmado.

Conflito de grant em partida não liquidada é sinal de integridade: abortar/investigar, não ignorar linha duplicada e aplicar saldo assim mesmo. Projeções e relatório não são fontes de concessão. Não há “claim” repetível pelo cliente.

Chaves estáveis: criação inicial `(club,starter,slot)`, partida `(farm,sequence)`, grant `(match,kind,target,ordinal)`, Coins `(club,match:ID:coins)`, movimento de material `(grant)`, unlock `(club,region)`, tarefa `(kind,aggregate,logical-sequence)`. Regras de idempotência de HTTP protegem retries de intenção; unicidade de domínio protege após expiração dessas chaves.

Para comandos síncronos, reservar a chave, aplicar a mutação e gravar a resposta COMPLETED na mesma transação. IN_PROGRESS não deve ser confirmado sozinho antes do efeito, evitando chave órfã após crash. Concorrente aguarda lock por prazo operacional limitado e recebe 409 `OPERATION_IN_PROGRESS` se necessário; retry mantém a chave. Se a transação cair, chave e efeito caem juntos. Para comando assíncrono, tarefa durável, identificador do relatório e resposta 202 são confirmados juntos; repetir retorna o mesmo relatório, cujo estado é consultado separadamente. Falha de infraestrutura sem commit não é resposta de sucesso em cache. Após expiração do registro HTTP, unicidades de domínio continuam obrigatórias.

## RNG e distribuição

Servidor gera seed imprevisível, guarda-a protegida e não a envia ao browser. Simulador e recompensas usam algoritmo versionado e subfluxos separados identificados por rótulo (resultado, ocorrência de drop, raridade, atributos, materiais), para que adicionar um evento visual não altere recompensas. Retry usa a mesma seed, snapshot e regras. Rollback não sorteia de novo.

Primeiro decidir **se** há drop de atleta conforme Q06. Somente para um drop de atleta já confirmado sortear a raridade com distribuição aprovada:

| Raridade | Percentual por drop | Peso em 100.000 | Intervalo inteiro `[0,100000)` |
|---|---:|---:|---|
| P1 | 74,485% | 74.485 | 0..74484 |
| P2 | 20% | 20.000 | 74485..94484 |
| P3 | 5% | 5.000 | 94485..99484 |
| P4 | 0,5% | 500 | 99485..99984 |
| P5 | 0,015% | 15 | 99985..99999 |

Soma 100%. Sorteio uniforme inteiro sem viés de módulo; fronteiras e pesos podem ser testados exatamente, sem exigir que uma amostra pequena produza P5. Não usar esses percentuais como chance por partida, não prometer um drop a cada jogo, não aplicar a distribuição ao kit inicial sem decisão expressa. Número de tentativas de drop por partida é Q06.

## Presença online — D08

“Online” significa sessão autenticada com lease de presença reconhecido pelo servidor. Abrir aba, declarar timestamp ou consultar saldo não basta. O protocolo é defesa contra falsificação de duração e duplicação; não prova atenção humana. Política de aba em segundo plano, automação e AFK é Q07.

- Uma única sessão de controle por clube. Nova aquisição aumenta `generation`; a antiga pode consultar dados, mas não estende presença, altera farm ou escalação. A autorização de mutações valida a geração de controle. Rotas de farm/escalação devem enviar `X-Presence-Generation` após adquirir o lease.
- Heartbeats têm sequência monotônica e chegam ao servidor, nunca retrodatam intervalos. Aquisição cria o início em horário do servidor. Lease expira em `lastAcceptedAt + grace`, onde frequência e grace são experimentais ainda sem valor.
- Intervalos são união normalizada sem sobreposição. Não somar abas, sessões ou heartbeats duplicados para completar os 10 minutos.
- `release` fecha no instante recebido; expiração fecha em valid_until. Reconectar depois cria novo intervalo. Uma falha de rede pode levar o lease à expiração; esse tempo deve aparecer coerentemente ao usuário.
- Só liquidar a classificação final quando a cobertura até end_at estiver decidida. Worker pode aguardar fechamento de lease quando necessário; não reclassificar grant já pago com uma mensagem tardia.
- A regra de atleta é conservadora: **100% dos 90s com cobertura online válida**. Qualquer fração offline impede atleta naquela partida, inclusive reconnect perto do fim. Essa definição é D10 e precisa de aceite; U1 só fixa “atletas só online”.

## Entitlement offline — D09–D11

U1: no máximo 24h; 50% XP/Coins; materiais comuns com 50% chance; sem raros/excepcionais; nenhum atleta; 10min online para renovar. O pedido não define precisamente contagem, arredondamento, material de referência e janelas mistas. Adota-se abaixo uma proposta explícita para teste, sem apresentá-la como design anterior aprovado.

### Renovação proposta

1. Clube novo começa com crédito offline **zero** até completar 600s online contínuos. Essa condição inicial é D09, não número adicional aprovado.
2. Medir união de intervalos online pelo servidor, independente de vitórias ou de farm ligado. Uma lacuna além da cobertura do lease interrompe continuidade. Transferência de controle sem lacuna não duplica nem interrompe o tempo.
3. Ao cruzar 600s contínuos, renovar para 86.400.000ms; nunca somar 24h ao saldo. Permanecer online mantém esse saldo no teto, sem criar gerações repetidas artificialmente.
4. Ao sair, consumir somente tempo offline de farm elegível, uma vez. Voltar por menos de 600s não recarrega o saldo; o saldo restante continua disponível para a próxima saída. Completar 600s contínuos recarrega, mesmo se ainda havia saldo.
5. Sem crédito, farm entra OFFLINE_EXHAUSTED. Retorno online permite farm e drop normalmente; os 10min são para renovar offline, não um bloqueio ao jogo online.
6. Parar farm não gasta crédito e não rende. Reiniciar offline por cliente não é permitido: o start exige presença. Trabalho pendente de farm já ativo pode continuar até o limite.

Cada renovação abre uma geração histórica de orçamento com vigência temporal; a anterior é fechada, sem transferir saldo. A liquidação debita a geração que cobria o instante F, mesmo que seja executada depois de nova renovação. Não subtrair período antigo da projeção de saldo atual. O débito `(match,generation)` e o cursor são confirmados na mesma transação dos grants. Se houver histórico pendente quando uma nova intenção exigir mudança de escalação/região, a API agenda reconciliação e retorna 409 `HISTORY_RECONCILIATION_REQUIRED` (ou o usuário aguarda o relatório) antes de aceitar a alteração; não mantém transação HTTP longa para fazer catch-up.

Interpretação alternativa “24h desde desconexão mesmo com farm parado” permanece Q07. Em D09, “24h” é orçamento de tempo de farm offline entre renovações, não recompensa por todo tempo de ausência.

### Partidas online, offline e mistas

Para cada janela de 90s, calcular por interseção temporal, sem sobreposição:

- `O`: milissegundos online válidos.
- `F`: milissegundos offline com farm ativo e crédito disponível.
- `U`: tempo sem elegibilidade. `O+F+U=90000`.

Resultado esportivo usa snapshot e seed e não muda com modo. Recompensa base `B` é a recompensa da partida integral online conforme região/resultado/regras. Para XP de atleta, XP de clube e Coins, **D10** propõe `B × (O + 0,5×F) / 90000`. Tempo U rende zero. ONLINE significa O=90000; OFFLINE significa F=90000; MIXED tem O/F/U combinados com alguma elegibilidade; INELIGIBLE significa U=90000.

Manter resto fracionário por clube e tipo/alvo (`Coins`, `ClubXP`, `AthleteXP:{id}`) para não perder valor acumulado nem premiar fracionamento de sessões. Conceder a parte inteira e carregar o resto racional de forma exata; não usar float. Resto pertence ao beneficiário e persiste entre partidas/reconexões. Não transportar resto de XP de um atleta para outro. Mudança de ruleset precisa preservar o valor acumulado.

Se o crédito terminar no meio da partida já iniciada, consumir apenas F disponível, calcular parcela proporcional e impedir nova janela offline. Sem cancelar a partida para tentar obter outra seed. Se houver retorno online durante essa janela, o restante pode virar O; nunca conceder atleta, pois não houve 90s integralmente online.

**Materiais — D11:** em uma janela ONLINE aplicar a tabela online Q06. Em janela que tenha F>0 e U=0, fazer uma tentativa independente de 50% de conceder um pacote comum, sem tabela rara/excepcional. Pacote e quantidade são Q06. Em janela com U>0, não conceder material nem atleta, evitando exploração por pequenas frações de crédito. Isso é uma escolha conservadora de borda, pendente de ratificação. Janelas com O>0 e F=0 mas U>0 também não fazem tentativas de drop.

Não interpretar “50% chance materiais comuns” como reduzir a chance online à metade: a proposta é probabilidade absoluta de 50% por janela offline completa/elegível, com composição comum. Se o design anterior pretendia multiplicador da tabela online, escolher em Q07 e alterar os testes. Para janela MIXED elegível, a proposta aplica a mesma tentativa de 50%, sem tentativa online adicional.

Atleta drop somente O=90000, depois ocorrência Q06 e raridade A04. Tempo de servidor/worker indisponível não deve automaticamente virar ausência do jogador: perdas de presença por indisponibilidade do serviço exigem política operacional Q09. Até existir evidência online, não emitir atletas retroativamente por suposição.

### Catch-up e retorno

O worker reconstrói janelas a partir do último cursor comprometido, snapshots e histórico de presença/renovações. 24h integrais de offline equivalem a no máximo 960 janelas de 90s nesse período; janelas mistas nas bordas exigem cálculo de interseção, sem ampliar crédito. O agendamento pode processar em lotes de tamanho operacional pendente. Cada partida liquida isoladamente e preserva o cursor em falhas.

Reconciliação e continuação online serializam no mesmo agregado. Resposta de retorno pode mostrar PROCESSING até concluir histórico; não aplicar a escalação nova ao passado. Nunca calcular ausência pelo relógio do dispositivo, pelo último GET ou por duração enviada no body. Não existe pagamento offline adicional por abrir outra aba, repetir reconcile ou abrir relatório.

## Segurança e operação mínimas

| Risco | Controle de M1 / verificação |
|---|---|
| Acesso a outro clube | Autorização em cada recurso e query; teste com duas contas; IDs opacos não substituem autorização |
| Saldo/XP/tempo falsificados | Servidor autoritativo, campos extra rejeitados, relógio servidor, nenhuma rota de recompensa cliente |
| Sessão roubada/CSRF | Cookie seguro, hash de sessão, revogação, expiração, checagem de origem e token CSRF; TLS na operação externa |
| XSS/injeção | Validar e limitar nomes/textos, escapar na UI, consultas parametrizadas, sem HTML fornecido pelo usuário |
| Flood/replay | Rate limits por sessão/conta/origem, limite de corpo e paginação, chaves de idempotência, heartbeat monotônico |
| Duplicação por concorrência | Locks, versões, índices únicos, tarefa com lease/fencing, transação atômica |
| Re-roll por restart | Seed/snapshot/ruleset imutáveis; resultado determinístico e segredo no servidor |
| Escrita fora do serviço | Papéis mínimos de banco; razão sem UPDATE/DELETE no papel da aplicação; ferramenta administrativa fora da API pública |
| Workers repetidos/falha | Recuperar lease vencido; retries com backoff configurado; fila de erro/alerta sem descartar concessão |
| Divergência econômica | Reconciliação razão/cache/grants; métrica de saldo divergente, erro de liquidação e cursor parado |

Auditar criação, mudanças de escalação, start/stop, troca de região, renovação offline, settlement, invalidação e correções. Correlation ID liga HTTP, tarefa, partida e grant. Não expor token, seed, stack trace ou detalhes de conta alheia. Backups e teste de restauração antes de usar contas externas; valores de retenção, SLO, limites e alertas ainda Q09.
