# 15 — Rodada de treinador, pausa e substituições

Atualização: 17/10/2026. Pedido normativo: retirar temporariamente a animação dos jogadores, adotar acompanhamento por placares/súmula inspirado nas referências fornecidas, packs no lugar das negociações e características por função. O usuário confirmou expressamente **campanha individual pausável contra clubes controlados pelo jogo**.

## Base encontrada e preservada

A entrada atual já era `FootballApp`, em modo 11v11, com packs, catálogo por função, campanha de oito clubes, calendário, classificação, carreira e mercado V2. Não foi substituída pelo componente antigo `GameApp`/farm5v5. Não houve nova redefinição dos preços, odds, catálogo, acesso/rebaixamento ou recompensas dos packs. Os registros E2/14 são históricos; este documento prevalece quanto à apresentação e à pausa.

## Implementado

- **Central da rodada:** quatro confrontos do campeonato atual começam juntos no clique “Disputar rodada”. Placar, último gol e súmula são projeções dos eventos autoritativos. Clique em qualquer confronto para abrir estatísticas e escalações.
- **Sem atletas animados:** campo/sprites/bola animada foram retirados da experiência ativa. Escalações viraram tabelas com nome clicável, função, OVR e condição. Código visual legado fica preservado fora da entrada atual.
- **Pausa global da campanha:** pausa os quatro jogos e o desgaste. A pausa é persistente; fechar/atualizar a página não retoma automaticamente. Não interfere em contas de outros jogadores.
- **Retomada:** conserva o tempo de bola rolando. Cada pausa aumenta o prazo final da rodada pelo tempo real pausado. Permanecem 90 segundos ativos; a duração total pode ser maior.
- **Substituições:** com rodada pausada, selecione quem sai e um reserva do mesmo setor (GOL/DEF/MEI/ATA). Até cinco trocas, sem retorno de quem saiu. Banco de até sete escolhido antes do jogo, posições e propriedade revalidadas no servidor. Formação e tática permanecem as escolhidas no início nesta versão.
- **Consequências reais:** a condição afeta os atributos usados na simulação; reservas entram frescos. Uma troca preserva todos os eventos já revelados e recalcula somente o restante com os atletas em campo. Pausar/retomar sem troca não gera novo sorteio.
- **Carreira correta:** quem sai e quem entra recebem seus minutos efetivos e gols/passes/defesas pelos eventos, sem atribuir 90 minutos a ambos. Goleiro substituído não recebe clean sheet de partida inteira.
- **Reforços por packs:** a navegação promove Packs; Mercado aparece apenas se houver anúncio anterior a encerrar, em modo de cancelamento. Ao disputar a primeira rodada nova, a campanha adota `managementVersion=1`: novos LIST/BUY são recusados e anúncios próprios restantes cancelados atomicamente, liberando as cartas sem venda ou exclusão. APIs antigas ficam para compatibilidade de campanhas legadas, não como novo fluxo comercial.
- **Características legíveis:** ficha mostra “Perfil no jogo” com os dois destaques derivados dos atributos relevantes da função. Não são novos bônus, características aleatórias ou afirmações sobre o desempenho real do atleta.

## Parâmetros experimentais, sem compromisso de balanceamento definitivo

| Parâmetro | Implementação inicial |
|---|---|
| Simultaneidade | 4 jogos / 8 clubes do campeonato atual; não inclui outras divisões ou copas paralelas |
| Duração ativa | 90s, herdada da campanha existente |
| Pausa | Sem limite; sem cobrança, dívida ou sorteio novo |
| Trocas | Máximo 5, mesmo setor amplo, sem reentrada |
| Condição inicial | 100% em cada partida; sem cansaço entre partidas, consumíveis ou recuperação por espera |
| Desgaste de goleiro | 0,18 ponto percentual/minuto simulado |
| Desgaste de linha | `0,5 + (100 − físico) × 0,004` por minuto simulado em campo |
| Piso de condição | 35%; não expulsa, lesiona ou impede o atleta de continuar |
| Efeito nos atributos de simulação | Multiplicador `0,75 + 0,25 × condição/100`; não altera a carta nem seu valor |
| Aviso visual | Condição abaixo de 55% destacada; nenhuma parada obrigatória |
| Minuto de troca | Inteiro visível do servidor; lances já publicados ficam imutáveis e próxima sequência começa no minuto seguinte |
| Atualização de placar | Poll de 1s durante jogo; 3s fora dele; relógio local só apresenta o tempo |

O cansaço desta etapa substitui a restrição anterior de ausência completa de fadiga **somente dentro da partida**, conforme o novo pedido. Fora dela, a filosofia sem espera/punição é preservada. Não foram acrescentadas lesões, salários ou contratos.

## Modelo e contratos

Estado JSONB aditivo; não exige migração DDL nem restauração do banco.

- FootballState: `managementVersion?`, `roundMatches?` (outros três jogos ativos), `lastRound?={season,round,matches}`.
- FootballMatch: `pausedAt?`, `totalPausedMs?`, `substitutions?`, `participants?` com snapshot de carta, instância, lado e minuto de entrada/saída.
- Engine: `football-manager-v3`. Partidas E1/V2 encerradas conservam seus eventos/versionamento.
- Evento novo `SUBSTITUTION`, com minuto, atleta, lado e narração. Eventos futuros, placar final e estatísticas futuras continuam ocultos na projeção pública dos quatro jogos.
- Novas ações POST `/v1/brasfoot/command`: `{action:'PAUSE',matchId}`, `{action:'RESUME',matchId}`, `{action:'SUBSTITUTE',matchId,outId,inId}`. Identificadores UUID. Não aceita relógio/minuto fornecido pelo cliente.
- Sessão, origem/CSRF, idempotência, mutex, ledger e auditoria existentes são reutilizados. O `matchId` impede um clique atrasado de controlar a rodada seguinte. Commit da rodada credita uma única recompensa e usa exatamente os resultados simulados dos outros três confrontos, sem um segundo sorteio ao liquidar.
- Inicialização de condição não modifica atributos permanentes nem RNG dos packs. Novas partidas deixam de persistir os frames de coordenadas de sprites, já que eles não são utilizados pela interface de súmula.

## QA realizado

**45 testes aprovados**, zero falhas na execução final; tipagem e build de produção (`build:check`) passaram. Inclui regressões do catálogo, packs, CT, mercado legado, ledger, offline e versões anteriores.

Quatro cenários novos cobrem: simultaneidade/ausência de eventos futuros; pausa por horas e retomada sem alterar os lances; substituição com prefixo preservado, condição e minutos reais; rejeição por dono/setor/jogo desatualizado/limite/reentrada; API com idempotência e rejeição de relógio adulterado; reconstrução da aplicação com pausa persistida; mercado desativado no modo novo; liquidação e recompensa única. Persistência de arquivos PGlite foi validada com a suíte completa fora do isolamento Windows, pois a reabertura WASM abortava no sandbox.

Servidor local reiniciado reutilizando `.data/postgres`. A automação de navegador ainda lista as duas abas antigas em páginas internas de erro; não foi usado outro mecanismo para contornar o bloqueio anterior. Portanto **não há nova captura nem aceite visual desta etapa**. Um aviso de Fast Refresh sobre alteração de dependências apareceu no reinício da aba antiga; recarregar a página monta a nova versão com a estrutura final dos hooks. Não foi declarado “console sem erros” sem inspeção visual.

## Sugestões de próxima iteração — ainda não implementadas

1. **Plano do treinador:** instruções simples (preservar resultado, pressionar, explorar lados), com prévia dos efeitos. Antes de ativar, definir impactos e custos de troca; não criar bônus escondidos.
2. **Assistente opcional:** sugerir uma troca por setor/condição, sem obrigar atenção constante. Não deve escalar/sacrificar uma carta protegida silenciosamente.
3. **Arquétipos de nascimento:** zagueiro de cobertura, meia armador, atacante finalizador, goleiro de reflexo. Primeiro apresentar como leitura dos atributos; novos modificadores só após balanceamento explícito.
4. **Packs por setor:** facilitar montar banco e preencher posições, sempre mostrando odds/garantias. Custos, pools e eventuais garantias são propostas, não números aprovados ou já adicionados.
5. **Demais divisões/copas em paralelo:** ampliar a central além dos quatro jogos atuais, com calendários persistentes próprios e classificação ao vivo identificada como provisória. Não mostrar partidas fictícias não calculadas para aparentar um mundo maior.

A campanha continua individual, local e sem publicação. Campeonatos compartilhados, tabela global sincronizada e pausa de outros usuários não fazem parte deste modo.
