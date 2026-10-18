# Prioridade: experiência de jogar e decisões do treinador

Direção do proprietário em 17/10/2026: desenvolver melhor o jogo, corrigir o que está ruim ou faltando e melhorar a UX. Adaptações para celular e polimento cosmético isolado deixam de ser prioridade. O PR #16 foi adiado, sem merge e com a branch preservada, e a issue #13 saiu de agent:ready. A rotina nativa foi atualizada com esta orientação, mantendo a agenda e as proteções.

## Primeiro problema corrigido: escalação ignorada ao jogar

Inspeção do fluxo anterior: editar formação, tática, titulares ou banco marcava um rascunho local, mas o botão Disputar rodada continuava habilitado e enviava PLAY com a escalação antiga do servidor. Não havia aviso persistente ou descarte explícito, e a sugestão automática podia substituir alterações ainda não salvas.

A correção da issue #17 mostra um aviso de alterações pendentes entre as seções, oferece revisar, salvar e descartar e bloqueia disputar rodada ou iniciar temporada enquanto houver rascunho. A sugestão automática e a troca imediata de capitão ficam indisponíveis até resolver o rascunho. Os campos ficam bloqueados durante salvamento ou partida. Um erro de validação mantém as alterações e apresenta o motivo; o rascunho só é liberado após confirmação do comando pelo servidor. Revisar leva ao Elenco e foca seu título.

Recarregar ou fechar a página com alterações pendentes solicita a confirmação nativa do navegador. O rascunho continua apenas na página atual: esta mudança não promete recuperação após fechar/reabrir o navegador ou confirmar a saída.

### Prova do fluxo real

Verificado no Edge headless com Playwright, interface local em 3315 e API de teste real em 3313 com PGlite somente em memória. O harness encaminhou `/api/` à API isolada; não houve mock da validação de escalação. Os serviços e saves existentes nas portas padrão foram preservados. Não é uma certificação de deploy, de proxy de produção ou de leitor de tela.

- Alterar tática para Ofensiva e navegar por Packs e Campeonato manteve o aviso; Disputar rodada e sugestão automática permaneceram bloqueados.
- Revisar levou ao Elenco com foco no título. Salvar enviou LINEUP e o servidor passou a usar ATTACK, sem iniciar partida.
- Alterar para Defensiva e descartar restaurou ATTACK, inclusive na resposta real do servidor.
- Repetir um defensor em dois lugares provocou a rejeição real: “Escale onze cartas distintas e até sete reservas.” O erro ficou visível; o rascunho sobreviveu à atualização periódica, sem PLAY.
- Após descartar o rascunho inválido, um clique explícito em Disputar rodada enviou o único PLAY do teste e iniciou uma partida no banco temporário.
- Recarregar com rascunho exibiu beforeunload; cancelar preservou as mudanças. Descartar removeu o aviso e permitiu recarregar normalmente.
- Nenhum erro JavaScript de página no teste principal. Comandos observados: INIT, LINEUP válido, LINEUP rejeitado e PLAY explícito.

[Aviso de alterações pendentes](qa/17-lineup/unsaved-lineup.png) · [erro real de salvamento](qa/17-lineup/save-error.png).

## Próximo foco do backlog

A issue #18 trata da utilidade dos reforços dos packs: comparar as cartas recebidas com o elenco, explicar possíveis melhorias e duplicatas e facilitar a ida ao Elenco, sem aplicar decisões ou vendas automaticamente. A implementação deve inspecionar o fluxo existente e preservar o rascunho da escalação.

Os PRs de integridade das temporadas (#12) e rankings históricos (#15) continuam separados para revisão. Não há merge ou produção automáticos. O objetivo das próximas tarefas deve ser uma melhoria observável no ciclo preparar time → jogar → entender resultado → reforçar elenco.
