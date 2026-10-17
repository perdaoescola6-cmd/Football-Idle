# Temporadas D/C/B/A: calendário e encerramento — issue #4

## Regras preservadas

Continua valendo BR-2024-compact-v1: oito clubes, 14 rodadas, turno e returno, dois primeiros sobem e dois últimos descem; D é o piso e A é o teto. Preços, premiação e dados dos clubes não mudam. A interface existente identifica a base histórica de clubes e o formato compacto; não houve alteração visual nem novo QA de navegador.

## Encerramento protegido

Antes de arquivar a temporada e conceder o prêmio, o motor confere:

- Oito IDs distintos na tabela, com o clube do jogador presente, e temporada na etapa de encerramento.
- 56 resultados válidos, 14 rodadas com quatro jogos, sem clube atuando duas vezes na mesma rodada.
- Um confronto com cada mando por par de clubes, sem IDs de partida ou confrontos duplicados.
- Jogos, vitórias, empates, derrotas, gols e pontos da tabela iguais aos totais dos resultados.

Uma inconsistência retorna SEASON_INTEGRITY_ERROR antes do prêmio, arquivo ou troca de divisão. O save não é apagado nem corrigido automaticamente. O próximo calendário é preparado antes das alterações, evitando concessão de prêmio se sua configuração for inválida.

Divisões, posições e números de temporada precisam ser inteiros válidos. Posição zero, por exemplo, não pode provocar uma promoção. O desempate permanece pontos, vitórias, saldo e gols; no empate integral, o ID passa a usar ordem binária explícita, independente do idioma do sistema. Isso pode mudar a ordem de um empate integral ainda não arquivado; posições históricas já registradas não são recalculadas.

## Verificação

Três regressões falharam antes da correção e passaram depois: desempate final explícito, premiação de temporada inconsistente e limites inválidos. A conferência de calendário percorre as quatro divisões; a matriz de transição verifica todas as 32 combinações de divisão/posição.

O teste de API disputa 14 rodadas reais, injeta falha na auditoria do encerramento e verifica rollback integral. Em seguida envia duas tentativas com a mesma chave, uma tentativa com chave nova e outra após reconstruir a aplicação. Confere um único prêmio no ledger, uma temporada arquivada, calendário novo, elenco, escalação, banco, organizador, histórico, desempenho e XP preservados.

O teste anterior de promoção/rebaixamento passou a usar resultados completos e uma tabela coerente, em lugar de apenas alterar a rodada e forçar pontos sem partidas. Não se removeu a cobertura das quatro divisões ou da preservação de cartas.

Sem migração ou reprocessamento de prêmios antigos. A idempotência e a transação da API continuam responsáveis pela proteção entre requisições concorrentes e reinícios da aplicação.

Validação local: instalação limpa, lint, tipos, auditoria de catálogo, 68/68 testes e build de produção aprovados.
