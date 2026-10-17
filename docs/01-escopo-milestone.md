# 01 — Escopo fechado do milestone M1

## Resultado esperado

Um jogador abre o browser, cria um clube, recebe exatamente cinco atletas, confirma uma escalação de cinco, ativa o farm e vê partidas automáticas de 90 segundos contra times NPC de cinco atletas. Ao finalizar cada partida elegível, recebe XP/Coins e possíveis drops, consulta a Coleção e o Depósito e troca titulares manualmente. O progresso permanente do clube libera Regional, com alvo de balanceamento de aproximadamente uma hora de jogo de referência.

“MMO” é a direção do produto. M1 não entrega mundo compartilhado, confronto entre jogadores, mercado nem ligas. O backend já isola contas e executa a economia de forma autoritativa.

## Incluído no aceite de M1

| Área | Entrega mínima |
|---|---|
| Entrada | Identidade persistente, criação única de clube, cinco atletas iniciais concedidos uma única vez |
| Plantel | Lista de atletas, seis atributos, tetos individuais, XP, nível e OVR; detalhes de atleta |
| Escalação | Cinco atletas distintos do clube; edição manual com versão; sem autosseleção obrigatória |
| Farm | Iniciar/parar; apenas um fluxo por clube; uma partida ativa por vez; sucessão automática |
| Partida | 5v5, 90s reais, resultado e eventos gerados no servidor; replay simples em linha do tempo |
| Recompensa | Resultado, XP, Coins e inventário persistidos atomicamente, com histórico |
| Drops | Chance de ocorrer drop separada da distribuição P1–P5; atletas exclusivamente online |
| Coleção | Visualização de atletas possuídos, filtro básico por raridade/OVR e consulta de atributos |
| Depósito | Quantidades de materiais, itens recebidos e histórico básico de concessão |
| Progresso | Contador permanente de clube e desbloqueio persistente de Regional |
| Online/offline | Presença validada pelo servidor, teto e renovação de offline, resumo após retorno |
| Operação | Recuperação após falha de worker, auditoria econômica e isolamento por conta |

As taxas de concessão, a progressão e o simulador devem existir no primeiro build futuro, com perfil experimental explícito. O registro 06 lista as escolhas ainda necessárias. A falta dessas escolhas não amplia o escopo.

## Excluído de M1

CT, compra de slots, treino de reserva, manutenção de CT, mercado P2P, elegibilidade comercial, ofertas, ligas, temporadas, matchmaking PvP, chat, guildas, monetização, loja, consumíveis, crafting, descarte, fusão, venda de atleta ao sistema, negociação e classificação global. PixiJS e refinamento visual também ficam fora.

Não haverá telas de CT/P2P/ligas vazias nem esquemas completos desses módulos antecipados. Materiais podem ser acumulados sem utilidade em M1; a interface deve explicar que seu uso chegará depois. Coins são acumuladas e auditadas; não é necessário inventar um sumidouro econômico para fechar o slice.

## Fluxo principal

1. Autenticar e consultar estado de entrada. Criar clube se ainda não existir.
2. Uma transação cria clube, carteira e cinco atletas e define a escalação inicial válida. A geração inicial usa perfil separado dos drops; sua raridade ainda é Q03.
3. Exibir atletas e permitir edição manual dos cinco titulares. Sem formação/posições definidas, o início do farm permanece bloqueado por G1; D01 propõe cinco slots genéricos, sem goleiro obrigatório.
4. Jogador escolhe Várzea e ativa farm. O servidor captura escalação, atributos, região e versão das regras para a próxima partida.
5. A partida dura 90s. O browser reproduz eventos recebidos; tempo visual e placar local não concedem nada.
6. Ao vencimento, o worker calcula presença, resultado e recompensas, liquida e agenda a próxima partida se o farm continuar ativo e elegível.
7. A nova escalação aplica-se somente à próxima partida. A partida corrente mantém o snapshot original, inclusive para distribuição de XP.
8. Progresso permanente cruza o limiar de Regional: gravar desbloqueio único. O jogador pode selecionar Regional para partidas seguintes.
9. Ao sair, o farm já ativado pode continuar sob as regras offline. Retorno mostra o resumo das concessões já liquidadas, sem um botão que conceda tudo novamente.

## Regras de progresso e ritmo

- Regiões aprovadas: Várzea **1**, Regional **12**, Estadual **60**, Nacional **150**, Continental **320**, Europa **600**, Elite **1100**.
- O pedido não define a unidade desses números. **D03 provisória:** tratá-los como limiares de nível permanente do clube; clube começa em 1. Não são níveis médios do time nem OVR exigidos. Q04 exige ratificação.
- Até essa ratificação, o dado canônico é XP de clube acumulado, monotônico. A versão de regras mapeia XP para nível de clube; o desbloqueio concedido não é removido por rebalanceamento ou troca de atletas.
- M1 implementa somente conteúdo Várzea e Regional; demais limiares são referências preservadas, sem conteúdo desbloqueável no slice.
- Alvo ~1h não é garantia por relógio nem desbloqueio por “tempo desde cadastro”. Uma hora corresponde a cerca de 40 partidas de 90s sem intervalo. A curva de XP de clube deve ser calibrada para atingir Regional nesse cenário de referência, com resultado e perdas de tempo explicitados (Q05).
- Não se pode concluir que cada partida vale um nível, que vitória é necessária ou que o avanço offline equivale ao online. D09 propõe XP de clube offline a 50%, sujeito a validação.

## Arquitetura proposta — D04

| Componente | Responsabilidade |
|---|---|
| Next.js + TypeScript | Telas, autenticação via sessão, consulta HTTP, replay simples; sem cálculo econômico confiável no browser |
| Fastify modular + TypeScript | Validação, autorização, contratos HTTP, comandos transacionais, leitura do estado |
| PostgreSQL | Estado canônico, transações, restrições, razão, partidas, snapshots, concessões, presença e fila durável |
| Worker TypeScript | Executar tarefas vencidas, reconciliar offline, simular e liquidar partidas, recuperar falhas |
| PixiJS — futuro | Consumir o mesmo contrato de eventos para representação visual sem alterar o resultado |

Módulos Fastify: `identity`, `clubs`, `roster`, `lineups`, `farm`, `matches`, `progression`, `inventory`, `economy`, `presence`, `rules`. Um monólito modular e um processo worker compartilham contratos de domínio. Não pressupõe repositório, provedor de hospedagem ou versões instaladas.

**D05:** usar inicialmente fila durável no próprio PostgreSQL, com tarefas vencidas e bloqueio por lease. Evita exigir outro serviço no slice; a implementação concreta e capacidade serão validadas depois. Não usar timers em memória como fonte de verdade.

A API solicita trabalho e responde rapidamente. Worker e API seguem a mesma ordem de locks (clube → farm → partida → carteira → inventário). Não manter transação aberta por 90s. A simulação usa snapshots imutáveis e seed armazenada; liquidação curta valida novamente o estado.

## UX funcional e definição de pronto

Uma página principal pode reunir clube, progresso, saldo, cinco titulares, partida atual e botões de iniciar/parar. Abas simples mostram Coleção, Depósito e histórico. Exibir reconexão, processamento e erros de versão sem esconder o resultado persistido. “Parar” informa que a partida corrente ainda termina.

Pronto para aceite quando criar → escalar → farmar → receber → consultar → trocar → desbloquear Regional funcionar após recarga, desconexão e falha do worker; nenhum valor econômico for aceito do cliente; e as histórias M1 do documento 05 passarem. UX básica não dispensa estados vazios, feedback de ação, rótulos e operação por teclado.
