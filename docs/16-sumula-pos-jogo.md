# 16 — Súmula e pós-jogo: referência Treineiros

17/10/2026. Autorização: “Exatamente! Vamos seguir por essa referência”, após análise dos prints fornecidos pelo usuário. Aproveitam-se hierarquia, clareza e interações; cores, monogramas e implementação são próprios, sem reutilizar artes ou interface do produto de referência.

## Implementado no projeto existente

- Placar compacto com monogramas, tempo, status ao vivo/pausado/encerrado, progresso e última narração.
- Três visualizações: **Súmula** (inicial), **Escalações** e **Campo tático** opcional. A rodada continua usando os quatro confrontos simultâneos existentes.
- Campo tático estático com círculos numerados clicáveis; número representa slot da formação. Não há movimentação de atletas nem bola fictícia. O texto identifica o desenho como esquema, sem pretender representar posições físicas ao vivo.
- Barras comparativas de finalizações, no alvo, defesas, passes e posse estimada pelos passes. Somente eventos confirmados entram nas contagens; xG, faltas e cartões não foram adicionados sem motor correspondente.
- Lance a lance com destaque por tipo/lado, ordem recente primeiro, rolagem própria, nomes e assistentes clicáveis, alternância entre destaques e todos os passes/conduções.
- Pós-jogo com melhor em campo entre os dois times, notas individuais, gols/assistências/defesas, minutos e condição. Cada equipe pode ser selecionada para consultar suas notas. O valor de Coins é o que a partida realmente concedeu, sem nova renda inventada.
- Escalações incluem os atletas que saíram, entradas/saídas e os minutos efetivamente disputados. A condição de quem saiu fica congelada no minuto da saída. Snapshot opcional do capitão inicial aparece como C; partidas antigas sem essa informação não recebem capitão inventado.
- Atalhos para preparar a próxima rodada e consultar classificação; não iniciam outra partida sem clique no controle existente.
- Relógio de apresentação reduzido para 1s e suspenso durante a pausa; não há animação que exija atualização constante.

## Consistência dos dados

`packages/contracts/match-report.ts` reúne contagens, notas e relatório de participantes. O motor reexporta as funções antigas por compatibilidade. A fórmula de notas já existente no histórico foi movida sem mudar coeficientes: base6, gols0,8, assistências0,5, defesas0,15, passes0,025 e ajuste de goleiro; arredondamento a uma casa e faixa1–10. Permanece experimental. A UI e a carreira usam a mesma fórmula, sem dois cálculos divergentes ou nova recompensa pelo destaque.

O relatório filtra lances pelo minuto visível. Notas finais só são mostradas após encerramento. Versões históricas sem dados compatíveis exibem “—”. Participantes substituídos continuam no relatório, inclusive seus eventos e tempos. `FootballMatch.captainId` é um campo JSONB opcional, preenchido nas novas partidas quando houver capitão escolhido; não exige migração DDL.

Economia, preços/odds de packs, catálogo, progressão, calendário e regras de substituição do documento15 não foram alterados. Não há aumento de recompensas nem venda de dados/artes externos.

## Verificações

- Suíte completa: **47 testes aprovados**, zero falhas.
- Dois cenários novos: consistência das notas com a carreira, minutos/condição de substituídos e total de minutos da equipe; relatórios parciais/históricos sem participação ou notas futuras inventadas.
- Após o snapshot de capitão: os seis testes de relatório e gerenciamento passaram novamente, incluindo o capitão inicial substituído.
- Typecheck aprovado; build de produção `npm.cmd run build:check` aprovado após os ajustes finais.
- API e frontend locais reiniciados com o banco existente; `sources/` permanece intocado.

**Limite visual:** a ferramenta ainda lista as duas abas antigas como páginas internas `data:` de erro. Não houve captura nova ou tentativa de contornar o bloqueio. Desktop/mobile, cliques dos três modos, contraste e encaixe visual exigem conferência no navegador. O servidor de desenvolvimento registrou aviso transitório de Fast Refresh por mudança de dependências em uma aba antiga; recarregar monta os hooks da versão nova. Não foi declarado console sem erros.

## Onde conferir

Abra http://127.0.0.1:3000/ e recarregue. Em Campeonato, dispute uma rodada, clique em um confronto, alterne entre Súmula/Escalações/Campo tático e pause para substituir. Após o apito final, confira notas, minutos, capitão inicial, melhor em campo e os atalhos de navegação. As novas capturas ainda não estão disponíveis.
