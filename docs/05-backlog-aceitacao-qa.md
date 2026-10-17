# 05 — Backlog em fases, aceite e QA

Este backlog organiza **trabalho futuro**. Não há autorização de implementação nesta entrega. Cada história M1 depende de G0; números de economia dependem do perfil aprovado em G1. Ordem por dependência, sem estimativa de prazo ou pontos inventada.

## F0 — Fechamento antes de programar

| Item | Entrega / aceite |
|---|---|
| DEC01 | Ratificar D01–D14 ou substituí-las; resolver Q01–Q07 e Q10–Q12 para um perfil experimental explícito; rastrear alterações em 06 |
| DEC02 | Escolher autenticação, política de presença/AFK, retenção e limites operacionais; marcar quais são necessários só antes de acesso externo |
| DEC03 | Congelar regras `prototype-<version>` com seis atributos, curvas, OVR, simulador, NPCs, recompensas, materiais, kit inicial e progresso regional; nenhum campo obrigatório nulo |
| DEC04 | Obter autorização explícita de programação; registrar escopo autorizado; só então iniciar F1 |

F0 não exige que o balanceamento seja definitivo; exige que o build futuro tenha valores de teste identificados como experimentais e que não confunda esse perfil com aprovação permanente.

## F1 — Primeiro milestone vertical slice

### US00 — Base autoritativa e observável

**Como responsável pelo jogo**, quero estado persistente e regras versionadas para reproduzir resultados e investigar falhas.

Aceite: módulos da arquitetura 01 delimitados; ruleset ativo completo e imutável; worker usa tarefa durável; API e worker não compartilham estado econômico apenas em memória; correlation IDs e erros padronizados; recuperação de tarefa vencida demonstrada. Só infraestrutura necessária ao slice.

Depende de DEC01–04. QA: QA04, QA07–09, QA24–26.

### US01 — Criar clube e receber cinco atletas

**Como jogador**, quero criar um clube e começar com cinco atletas para disputar a primeira partida.

Aceite: nome validado; uma conta tem um clube; cinco IDs de atleta únicos, seis atributos/tetos cada, carteira e escalação válidas na mesma transação; kit inicial não usa implicitamente a distribuição dos drops; recarga/retry não concede outro kit; clube pode ser recuperado após nova sessão.

Depende de US00 e Q03/Q08/Q12. QA: QA01–02, QA25.

### US02 — Escalar manualmente

**Como jogador**, quero escolher os cinco titulares para controlar meu time.

Aceite: cinco atletas distintos e próprios; versão evita sobrescrita; trocar durante uma partida só altera a seguinte; snapshot atual e destinatários de XP não mudam; tela explica quando vale a mudança; erro de versão recuperável.

Depende de US01; formação Q11. QA: QA03, QA11, QA25.

### US03 — Farm automático 5v5

**Como jogador**, quero iniciar o farm e ver partidas sucessivas sem clicar a cada jogo.

Aceite: 90s de tempo lógico por partida, cinco atletas por lado, NPC da região disponível, sem duas partidas simultâneas por clube; start repetido não cria fluxo paralelo; stop conclui somente a corrente; worker atrasado não acelera o relógio econômico; perda de conexão segue as regras de presença.

Depende de US02 e simulador Q10. QA: QA04–05, QA16–18.

### US04 — Receber e auditar recompensas

**Como jogador**, quero que o término da partida conceda corretamente XP, Coins e itens mesmo após falhas.

Aceite: um settlement por partida; carteira e razão conciliam; grants, inventário, XP e progresso confirmam juntos; falha parcial não deixa pagamento solto; repetir tarefa/chamada não altera saldo; resumo mostra origem por partida.

Depende de US03, Q02/Q05/Q06. QA: QA06–09, QA13.

### US05 — Acompanhar e rever a partida

**Como jogador**, quero entender o que ocorreu por uma linha do tempo simples e consistente.

Aceite: cronômetro baseado em horário servidor; resultado somente confirmado após settlement; replay final ordenado, sem gol duplicado, atores válidos, cinco por lado, placar coerente; recarregar e retomar consulta não duplica evento; não depende de PixiJS. Durante RUNNING pode mostrar apenas cronômetro e estado; animação detalhada ao vivo não é requisito M1.

Depende de US03–04. QA: QA04, QA09, QA24.

### US06 — Evoluir atletas sem teto de nível

**Como jogador**, quero que XP aumente nível e atributos respeitando os limites individuais.

Aceite: função versionada monotônica; nível pode crescer após todos os tetos serem atingidos; cada atributo respeita teto e OVR≤99; seis atributos completos; reservas não recebem XP de partida na proposta D07; números grandes não perdem precisão no transporte.

Depende de US04, Q01–02. QA: QA10–12.

### US07 — Ganhar atletas online

**Como jogador online**, quero receber possíveis novos atletas de raridades variadas.

Aceite: ocorrência por partida definida separadamente; distribuição P1–P5 aplicada uma vez por drop confirmado; jogador offline/misto não recebe atleta; retry usa mesmo sorteio; odds não aparecem como chance de drop por partida; limites de atributos/raridade seguem ruleset.

Depende de US04, presença e Q03/Q06. QA: QA14–18.

### US08 — Consultar Coleção e Depósito

**Como jogador**, quero consultar atletas e materiais para decidir a próxima escalação.

Aceite: atletas pertencentes ao clube, filtros e paginação estáveis, ficha com seis tetos; materiais com quantidade/tier; refletir somente transações confirmadas; sem ações de venda/crafting/CT; materiais sem uso explicados; estados vazios legíveis.

Depende de US01/US04/US07. QA: QA21, QA25.

### US09 — Retornar de uma ausência

**Como jogador**, quero continuar recebendo as recompensas offline permitidas e entender os limites.

Aceite: até 24h de crédito, 50% XP/Coins, tentativa de materiais comuns conforme regra ratificada, zero atleta/raro/excepcional offline; 10min online válidos renovam sem acumular mais de 24h; retorno inferior não renova; relatório somente projeta o já concedido; estados parcial/PROCESSING e crédito esgotado claros; segunda aba/retry não multiplica ganhos.

Depende de US03–04, Q07 e parâmetros de presença. QA: QA16–20, QA26.

### US10 — Desbloquear Regional

**Como jogador**, quero avançar permanentemente meu clube para chegar a Regional.

Aceite: progresso não depende do nível médio/OVR da escalação; unlock único persistente; trocar titulares não revoga; Várzea disponível inicialmente; Regional pode ser selecionada só após unlock e vale na próxima partida; curva calibrada para alvo ~1h no cenário de referência aprovado; demais regiões não fazem parte do conteúdo M1.

Depende de US04/US06, Q04–05. QA: QA22–23.

### US11 — Jogar com interface básica recuperável

**Como jogador**, quero ver estados e ações disponíveis sem precisar entender o sistema interno.

Aceite: fluxo de criação, painel do clube, escalação, farm, Coleção, Depósito e histórico utilizável por teclado; saldo/progresso legíveis; erro de rede não faz o jogador repetir concessão; carga/reconexão/ausência sem crédito têm explicação; nomes de atributos e rótulos em português; sem refinamento visual nem telas de módulos futuros.

Depende das histórias anteriores. QA: QA27 e roteiro integrado.

## Matriz de QA de M1

| ID | Cenário / procedimento | Resultado obrigatório |
|---|---|---|
| QA01 | Duas criações simultâneas, mesma conta, chaves iguais e depois distintas | Um clube e exatamente cinco starters; resposta repetível ou conflito explícito |
| QA02 | Falhar após criar terceiro atleta e antes de confirmar criação | Nenhum clube parcial, saldo ou atleta órfão; retry completa um único kit |
| QA03 | Escalar 4/6, duplicado, atleta alheio, versão velha; editar durante jogo | Rejeitar entradas inválidas; versão velha não grava; snapshot atual intacto |
| QA04 | Relógio controlado em 0, antes de 90s, em 90s e depois | Sem resultado final público antes do prazo; somente uma partida ativa; cada janela dura 90s |
| QA05 | Repetir start, race stop/início da seguinte, trocar região bloqueada | Nenhum fluxo paralelo; ordem de commit define corrente informada; região bloqueada rejeitada |
| QA06 | Injetar falha em cada escrita de settlement | Tudo reverte ou tudo confirma; sem grants/saldo/XP parcial |
| QA07 | Dois workers para mesmo match e expiração do lease | Apenas uma liquidação econômica, worker antigo não sobrescreve |
| QA08 | Commit confirmado e resposta perdida; repetir tarefas/HTTP | Mesmos IDs e saldo; nenhuma recompensa duplicada |
| QA09 | Reiniciar servidor entre início, simulação e liquidação | Mesmo resultado/eventos/recompensas; continuidade retomada do cursor |
| QA10 | XP exatamente antes/no/depois de limiares e muito além de tetos | Nível monotônico sem teto de jogo; atributo≤teto; OVR≤99 |
| QA11 | Trocar titular antes do próximo snapshot, durante match e em retorno offline | XP nos cinco do snapshot correto; configuração nova não reescreve passado |
| QA12 | Valores grandes de XP/nível e arredondamentos repetidos | Serialização decimal exata; resto preservado; sem overflow silencioso |
| QA13 | Reconciliar razão com carteira e grants; tentar débito indevido | Soma exata, versões serializadas, nenhuma escrita direta/negativa |
| QA14 | Forçar entradas RNG nas fronteiras 0/74484/74485/94484/94485/99484/99485/99984/99985/99999 | Raridades dos intervalos 04; pesos exatos totalizam 100.000 |
| QA15 | Forçar falha/sucesso de ocorrência de atleta; repetir seed; amostra de distribuição | Sem ocorrência, nenhum sorteio concedido; por drop pesos corretos; amostra não exige P5 garantido |
| QA16 | 90s cobertos online; offline integral; janela com pequena lacuna | Atleta somente na integral online; modo misto sem atleta; sem reclassificação tardia |
| QA17 | Heartbeat duplicado/atrasado, timestamp falso, aba concorrente | Sem extensão dupla/retroativa; uma geração de controle; duração nunca soma sobreposições |
| QA18 | Duas ausências separadas por <600s e por ≥600s válidos | Primeira mantém saldo residual; segunda renova ao teto, não soma créditos |
| QA19 | Crédito 0, fronteira de 24h, >24h e fim no meio de partida | Remuneração proporcional apenas elegível; crédito nunca negativo; sem nova partida offline sem orçamento |
| QA20 | Coins/XP ímpares em modo 50%, material RNG sucesso/falha, offline repetido | Resto exato; apenas pacote comum na chance ratificada; nenhum raro/excepcional/atleta; reconcile não paga novamente |
| QA21 | Grandes listas, cursor, novos drops, quantidades e recarga | Nenhum atleta alheio; paginação estável; quantidade coincide com movimentos |
| QA22 | Limiar Regional menos unidade/igual/mais; trocar time após liberar | Unlock uma vez, no limiar; permanece; nenhuma dependência da média do time |
| QA23 | Simular sessões do perfil de referência, com curvas/NPCs congelados | Relatório com tempo até Regional e dispersão; meta ~1h avaliada sem exigir minuto exato de todo jogador |
| QA24 | Eventos com offsets iguais, consulta incremental, replay após reload | Ordem por sequência, sem lacunas no final; placar coincide com gols e resultado; seed ausente da API |
| QA25 | Duas contas, IDs cruzados, requisição CSRF e sessão revogada | Nenhum acesso/mutação cruzado; respostas padronizadas sem vazamento |
| QA26 | Catch-up 24h, lotes interrompidos e retorno durante processamento | Orçamento respeitado, snapshots históricos corretos, resumo deduplicado; sem travar HTTP aguardando todo lote |
| QA27 | Roteiro em browser: criar, iniciar, escalar, parar, sair, voltar, desbloquear | Todas as ações compreensíveis, teclado funcional, estados de falha recuperáveis |

QA14 testa a partição exata; avaliação estatística complementar define tamanho amostral/confiança no plano de balanceamento, sem usar thresholds arbitrários como regra de produto. Testes de tempo usam relógio controlado no ambiente de teste, nunca autoridade temporal do cliente real.

## Roteiro integrado de demonstração

Criar conta/clube; conferir cinco atletas e saldo; validar escalação; ativar Várzea; completar partidas; conferir linha do tempo e razão; conseguir drop por seed controlada apenas no ambiente de teste; trocar titular; confirmar XP do snapshot; manter presença por 10min; desconectar; processar offline; retornar/repetir reconciliação; conferir ausência de atleta offline; avançar clube ao limiar Regional; substituir todos os titulares; confirmar unlock preservado e farm em Regional.

Para demonstração rápida, clock/seed controlados pertencem exclusivamente ao ambiente de QA, separados de contas reais. Não adicionar endpoints públicos de aceleração ou recompensa. Uma execução em tempo real com perfil congelado valida adicionalmente o alvo ~1h.

## Fases após aceite de M1 — fora do slice

| Fase / história | Regra preservada | Aceite mínimo futuro / pendências |
|---|---|---|
| F2 — US20: treinar reservas no CT | 2 slots iniciais, máximo 5; treino de reserva; manutenção somente com treino ativo | Slot inativo não cobra; parar treino encerra manutenção; atleta titular não treina como reserva; taxas, custos, duração e compra de slots ainda indefinidos |
| F3 — US30: listar atleta P2P | Preço livre, comissão 15%, elegibilidade ~1%, duração 1/7/30 dias | Transferência e Coins atômicas; comissão e arredondamento auditados; impedir dupla venda; conceito de elegibilidade ~1% precisa ser definido antes |
| F3 — US31: negociar oferta | Oferta válida por 24h | Expiração/aceitação concorrentes sem duplicar ativo ou saldo; política de reserva de Coins e oferta simultânea ainda indefinida |
| F4 — US40: disputar liga assíncrona | 14 dias, até 20 jogos; adversário sorteado por divisão | Snapshot/matchmaking auditáveis; limite por período, calendário/fuso, repetição de adversários e pontuação precisam ser fechados |
| F5 — US50: ampliar regiões e apresentação | Limiares U1; PixiJS futuro | Adicionar conteúdo além de Regional e replay visual preservando fonte autoritativa; critérios e economia próprios em novo milestone |

Essas histórias não abrem permissão de implementação. Cada fase requer fechamento de regras e autorização apropriada ao trabalho solicitado.
