# Continuidade das partidas 11v11 — issue #3

## Problemas corrigidos

Ao gerar a sequência posterior a uma substituição, o motor não recebia o capitão. Assim, o bônus experimental de liderança (1,5% na criação de chances) desaparecia mesmo quando outro atleta saía e o capitão permanecia em campo. A continuação agora preserva o capitão do snapshot enquanto ele estiver no time. Se ele sair, o efeito termina; o registro histórico do capitão inicial permanece na súmula.

Os minutos de entrada eram agrupados somente pelo ID da edição. Como um adversário AI pode usar a mesma edição do clube humano, esse agrupamento podia sobrescrever o instante de entrada com o do outro time, aplicando cansaço de um jogador ao outro. O cálculo agora separa os minutos por HOME/AWAY antes de aplicar a condição. A mesma edição nos dois times continua permitida; não se alteram identidades, posse ou cartas.

## Continuidade e recuperação

Permanecem o relógio do servidor, a pausa conjunta dos quatro jogos, o minuto inteiro visível para trocas, o limite de cinco substituições e a proibição de reentrada. Lances já publicados são preservados; apenas a sequência futura é simulada novamente quando uma troca é autorizada. O cliente continua sem receber resultado final ou eventos futuros.

Não é necessária migração: os instantes de participação já estão nos snapshots persistidos. A correção constrói os mapas por time durante a continuação; não adiciona estado salvo. Partidas e históricos existentes não são recalculados automaticamente, e não há nova recompensa ou ajuste retrospectivo de saldo.

## Verificação

As duas novas regressões falharam antes da correção e passaram depois:

- Renomear IDs apenas no adversário não pode mudar os acontecimentos esportivos. Trinta e duas sementes fixas comparam times com IDs coincidentes e distintos, verificando também que reservas recém-entrados têm efeito real no cálculo.
- Uma substituição sem saída do capitão preserva sua influência, em jogos como mandante e visitante. Sementes fixas incluem casos em que essa influência muda lances; o teste confere o prefixo publicado, estatísticas, ausência de eventos futuros durante pausa longa e pagamento único. Um snapshot serializado após a troca é recuperado e produz o mesmo histórico, desempenho e saldo após retomada.

O teste de API da rodada também foi ampliado: depois de pausa, reconstrução da aplicação, retomada e encerramento, executa novos ciclos do worker e outra reconstrução. Confere histórico, estatísticas, tabela e desempenho estáveis, além de uma única entrada de recompensa no ledger. A suíte existente mantém a cobertura de goleiros, assistências, limites de substituição, idempotência e recuperação do PostgreSQL persistente.

Não houve alteração visual nem novo QA de navegador. As mudanças são no motor, na passagem de dados para ele e nos testes de regressão.

Validação local: instalação limpa, lint, tipos, auditoria de catálogo e 63/63 testes aprovados. O build passou com acesso local normal; uma execução anterior no sandbox Windows falhou por EPERM ao criar uma pasta temporária do Next.js, sem erro de compilação.
