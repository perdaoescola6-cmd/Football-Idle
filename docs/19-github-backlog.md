# Backlog inicial

Priorizar correção e consistência do que já existe. Cada item deve virar uma issue com PR próprio após a integração da importação.

1. **P1 — Catálogo coerente (600+)**: auditar as 844 identidades/854 edições existentes; unicidade, procedência, idade e clube/ano históricos, posições e atributos por função. Teste de integridade e relatório das exceções; não inventar afiliações atuais.
2. **P1 — Packs e odds**: cinco cartas por abertura; probabilidades e garantias publicadas iguais às do servidor, inclusive foco por setor e exceções. Cobrir saldo insuficiente, repetição idempotente, pools e distribuição com sementes fixas.
3. **P1 — Eventos e estatísticas 11v11**: gols/assistências/defesas, substituições e pausa coerentes entre motor, narração, súmula e recompensa. Testar determinismo, nenhum evento futuro e recompensa única na recuperação de partida.
4. **P1 — Ligas D/C/B/A**: calendário e desempate estáveis, promoção/rebaixamento, encerramento e recompensas idempotentes; campanha compacta identificada. Cobrir fronteiras das quatro divisões e recuperação após reinício.
5. **P2 — Rankings**: separar qualidade das cartas e desempenho real; filtros/empates estáveis e nenhum AI apresentado como humano. Atualização após partida sem contagem duplicada, com estados vazios claros.
6. **P2 — Venda em lote**: prévia de quantidade e Coins; proteger titulares, reservas, cartas protegidas e anunciadas. Confirmação manual, atomicidade e idempotência; testar concorrência e rollback sem perda.
7. **P2 — Olheiro**: definir contrato visível de custo, duração, filtros e chances antes de implementar. Reutilizar ledger/idempotência; pagamento e entrega únicos após reinício; sem gasto real nem promessa de raridade não garantida.

Os testes atuais já cobrem partes desses temas. As issues pedem auditoria e melhoria incremental, evitando reimplementar sistemas funcionais.
