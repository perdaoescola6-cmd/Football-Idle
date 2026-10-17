# 09 — Identidade visual e God mode local

Data: 17/10/2026. Fonte U3: usuário pediu uma interface mais bonita, com cara de jogo, e um botão God mode para acelerar progresso durante testes. Essa autorização acrescenta controles de teste à restrição anterior de não ter rotas públicas de aceleração. Não muda o balanceamento do modo normal nem autoriza publicação.

## Interface

- Identidade escura em azul-marinho, verde-lima e detalhes dourados/roxos.
- Escudo com iniciais reais do clube, painel de recursos com ícones e navegação de manager.
- Campo listrado, áreas/gols, camisas numeradas, OVR e nomes dos dez atores.
- Replay destaca o ator e move a bola conforme eventos já confirmados; não inventa resultado ao vivo.
- Atletas em cards por raridade, com camisa, nível, XP, OVR, potencial e tetos consultáveis.
- Controles de foco e redução de movimento, layouts para telas estreitas e ícones SVG locais; nenhum asset ou fonte remota necessária.

## Como usar

1. Abrir **God mode** no cabeçalho.
2. Selecionar **10×** ou **60×**.
3. Iniciar o farm. Com 10×, cada partida leva aproximadamente 9s reais; com 60×, 1,5s reais. O relógio lógico de cada partida continua sendo de 90s.
4. Selecionar **Normal** para voltar a 1×. Os ganhos de teste são mantidos. Parar o farm continua terminando a partida corrente.

O botão abre o painel; abrir/fechar o painel não altera a velocidade. A velocidade escolhida persiste após recarga/reinício e também acelera a contagem offline. Se o usuário deixar 60× ligado, 24h lógicas de orçamento offline correspondem a 24min reais. A renovação de 10min também usa tempo lógico de teste.

## Implementação e limites

`POST /v1/dev/god-mode` aceita somente `{clientInstanceId, speed: 1|10|60}`. Exige sessão, origem/cabeçalho CSRF, geração de controle e chave de idempotência. Não aceita saldo, XP, resultado, raridade ou ID de outro clube como parâmetros.

A rota e a capacidade anunciada em `/bootstrap` existem somente com banco **embedded**, opção `godMode` habilitada na API e `NODE_ENV` diferente de `production`. O processo local habilita por padrão, salvo `ENABLE_GOD_MODE=0`. Em produção ou com PostgreSQL externo, o endpoint não é registrado. Antes de ocultar os controles via configuração, retornar a Normal; ocultar a rota não reverte uma velocidade já persistida nem limpa progresso de teste. Dados desse clube não devem ser tratados como progresso normal em uma futura publicação.

Cada clube mantém âncoras de tempo real/lógico e um multiplicador em `runtime.testClock`. Trocar velocidade não volta o relógio para trás, não concede XP diretamente e não muda seeds. Worker e comandos continuam usando a mesma liquidação transacional e o razão de Coins. Outros clubes mantêm seus próprios relógios. Sessão/autenticação e rate limit usam tempo real.

Presença em modo acelerado conserva 30s **reais** de tolerância: sua duração lógica é multiplicada pela velocidade. Heartbeats duplicados continuam sem renovar duas vezes. Sem essa adaptação, uma aba em 60× expiraria artificialmente antes do próximo heartbeat normal.

`testMode.used` permanece marcado depois de voltar a 1×. Partidas afetadas e partidas futuras desse clube recebem `testRun=true`; concessões também guardam essa marca no payload. A UI identifica o clube e o histórico como teste. Uma partida já em andamento ao ativar recebe a marca sem mudar snapshot/seed. Histórico anterior permanece preservado.

### Contratos adicionais

| Campo | Significado |
|---|---|
| `bootstrap.devTools.godMode` | Disponibilidade dos controles nesta execução |
| `game.testMode.speed` | Multiplicador 1, 10 ou 60 |
| `game.testMode.used` | Clube já teve aceleração de teste |
| `match.testRun` | Partida pertence ao fluxo de teste; ausente em histórico legado equivale a false |
| `game.serverTime` | Tempo lógico do clube; o envelope HTTP continua com tempo real do servidor |

## Verificação

Suíte ampliada para 13 testes: além dos anteriores, verifica 40 partidas/Regional em 60s reais a 60×, cobertura online, outro clube sem aceleração, retry sem redefinir âncoras, retorno a 1× sem perder saldo ou regredir relógio, recarga, validação de velocidades, sessão/controlador e ausência da rota em produção/desabilitada. Build e checagem de tipos concluídos.

No navegador, 60× foi ativado com o farm, recompensas/XP e novos atletas apareceram em segundos; depois foi restaurado Normal e o farm foi parado. Console sem erros/warnings no ponto verificado. O clube de teste existente foi mantido; o teste visual acrescentou progresso real a esse banco local, marcado como teste.

Ao concluir a conferência, “União da Vila” tinha 78 Coins, 168 XP de clube e dez atletas, contra 12 Coins, 28 XP e seis atletas antes. O histórico preservou a partida original sem marca e identificou as partidas 2–6 como TESTE. O replay final de 4×1 e o razão conciliado foram conferidos visualmente. [Captura da interface e dos controles](provas/visual-god-mode.jpg). Na largura disponível de aproximadamente 640px, os controles e cards se reorganizaram em colunas; a checagem de geometria não encontrou elementos excedendo a largura do documento.

Não foi executado ensaio de carga. O God mode não altera odds por drop nem adiciona CT, mercado ou ligas.
