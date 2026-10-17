# Football Idle MMO — especificação técnica do primeiro protótipo

Versão documental: 0.9 • 17/10/2026 • idioma: português. Estado atual da campanha e ferramentas do treinador nos documentos 15–17; a especificação inicial abaixo permanece como histórico rastreável.

**Estado: especificação-base e primeira implementação local.** A documentação inicial não autorizava programação. O usuário posteriormente autorizou começar o código (U2); a versão local está registrada em 08. As regras novas permanecem experimentais.

## Leitura e uso

Entrega mais recente: [17 — Perfis, packs por setor e assistente](17-perfis-packs-assistente.md). Inclui regras, exceção de catálogo, contratos, testes e provas do navegador. Ver também [16 — Súmula e pós-jogo](16-sumula-pos-jogo.md) e [15 — Rodada do treinador](15-rodada-treinador.md).

1. [Escopo e arquitetura](01-escopo-milestone.md): fronteira do milestone M1 e fluxo jogável.
2. [Dados](02-modelo-de-dados.md): modelo lógico PostgreSQL, integridade e Coins.
3. [Contratos](03-contratos-api.md): HTTP, payloads e replay visual.
4. [Estados e segurança](04-estados-idempotencia-seguranca.md): execução, recuperação e offline.
5. [Backlog e QA](05-backlog-aceitacao-qa.md): ordem de implementação futura e critérios verificáveis.
6. [Parâmetros e decisões](06-parametros-decisoes.md): valores aprovados, propostas e pendências.
7. [Perfil experimental M1-E0](07-perfil-experimental-prototipo.md): candidato concreto de fórmulas, recompensas, geração, simulador e ritmo; ainda não aprovado.
8. [Primeira implementação local](08-primeira-implementacao.md): código produzido após U2, diferenças frente ao modelo-alvo, verificações e pendências.
9. [Visual e God mode](09-visual-e-god-mode.md): atualização visual e aceleração local de testes autorizadas por U3.
10. [Alpha E1](10-alpha-e1.md): expansão autorizada por U4; transmissão, cartas, mapa, NPC, olheiro, CT, liga local, P2P, contratos e parâmetros provisórios.
11. [Como jogar](11-como-jogar.md): guia atualizado do jogador.
12. [Auditoria E2](12-e2-auditoria.md): auditoria anterior às alterações e direção artística.
13. [Retro E2](13-retro-e2.md): entrega por fase, mudanças funcionais, contratos, parâmetros e QA pendente.

Documentos em Markdown para reutilização em issues, revisão técnica e futura conversão para OpenAPI/migrações. Os contratos aqui são especificações textuais; ainda não são arquivos executáveis nem implementação. “Executável” significa que o comportamento, os limites e as condições de teste estão definidos; parâmetros pendentes têm bloqueios explícitos antes da implementação dependente.

## Hierarquia de evidências

- **U1:** pedido detalhado inicial do usuário nesta conversa; fonte normativa principal dos números e das restrições.
- **U2:** pedido posterior para seguir para o código e começar a criar o jogo; autoriza a primeira implementação local usando o perfil como base experimental.
- **H1:** conversa referenciada `6ad27087-deb0-83e8-8e3a-823aade93f94`, título “Análise de jogo idle futebol”. A recuperação mostrou autorizações genéricas para continuar, uma observação sobre sorte moderada e referências a respostas cujo conteúdo não estava disponível. Não permite reconstruir fórmulas ou tabelas ausentes.
- **R1:** `AGENTS.md` do projeto: `sources/` é somente leitura. A pasta estava vazia na inspeção.
- **Dxx:** decisão técnica provisória deste pacote; não representa aprovação de design pelo usuário.
- **Qxx:** questão sem definição suficiente. Nenhum valor ausente deve receber um padrão silencioso.

U1 prevalece sobre H1 e sobre qualquer proposta deste pacote. Autorizações genéricas em H1 não autorizam programar: U1 exige autorização adicional explícita.

## Matriz de rastreabilidade

| Requisito | Fonte / parâmetro | Especificação | Histórias / verificação |
|---|---|---|---|
| Clube inicial com 5 atletas e escalação manual | U1 / A01 | 01 § Fluxo; 02 clube/atleta/escalação | US01, US02; QA01–03 |
| Farm automático 5v5, 90s | U1 / A02 | 03 partidas; 04 ciclo | US03–05; QA04–09 |
| 6 atributos, XP, nível ilimitado, OVR ≤99 | U1 / A03; Q01–03 | 02 progressão; 06 | US06; QA10–12 |
| Coins e recompensas sem duplicação | U1; D04–06 | 02 razão; 04 liquidação | US04; QA06–09, QA13 |
| Raridade condicional por atleta | U1 / A04 | 06 distribuição; 04 RNG | US07; QA14–15 |
| Atletas apenas online | U1 / A05 | 04 presença e recompensa | US07, US09; QA16–20 |
| Coleção/Depósito básicos | U1; D02 | 01 escopo; 02 inventário; 03 | US08; QA21 |
| Offline 24h, 50%, materiais comuns, renovação 10min | U1 / A06; D08–11 | 04 offline; 06 Q07 | US09; QA16–20 |
| Regional por progresso permanente, alvo ~1h | U1 / A07; Q04–05 | 01 progresso; 02 desbloqueios | US10; QA22–23 |
| CT, P2P e ligas preservados para depois | U1 / A08–10 | 01 exclusões; 05 fases futuras | Fases F2–F4 |
| Browser Next.js/TS, Fastify, PostgreSQL, worker; PixiJS futuro | U1 / A11 | 01 arquitetura | US00, US05 |
| Sem implementação nesta entrega | U1 | Este índice e todos os documentos | Gate G0 |

## Gates para o próximo trabalho

- **G0 — autorização:** satisfeito por U2 para começar a primeira implementação local; não autoriza deploy ou serviços pagos.
- **G1 — regras jogáveis:** perfil M1-E0 escolhido como base experimental de M1-E0.1. Revisão de balanceamento continua aberta; valores novos não são definitivos.
- **G2 — operação:** definir identidade/autenticação, presença e retenção (Q08–Q09) antes de acesso externo.
- **G3 — aceite do slice:** histórias M1 e QA obrigatórios concluídos; simulação de balanceamento documentada; nenhum módulo futuro necessário para terminar o ciclo.

Alterações de balanceamento geram uma nova versão imutável de regras. Alterações de design devem atualizar este registro e as histórias relacionadas, evitando fontes divergentes.

## Continuação documental — versão 0.2

Após a autorização para continuar, foi acrescentado o perfil candidato M1-E0. Os documentos 01–05 continuam como especificação-base; 07 preenche lacunas com propostas experimentais identificadas, sem fechar automaticamente as questões de 06. A aritmética da meta Regional foi conferida; ensaios de simulação e implementação ainda não foram executados. G0 e G1 permanecem abertos.

## Primeira implementação — versão 0.3

U2 autorizou começar o código. O perfil foi usado para criar a primeira versão local. O estado dos gates acima e o documento 08 substituem as observações históricas de ausência de código/autorização em 06–07; preservam-se as regras aprovadas e os valores experimentais. O aceite integral de M1 e a operação pública continuam pendentes.

## Alpha E1 — versão 0.5

U4 autorizou ampliar o jogo além do M1 original. O documento 10 registra a implementação E1 e suas limitações; as exclusões de CT/P2P/liga nos registros 08–09 são históricas. Os parâmetros novos continuam experimentais. Ranking público da liga, autenticação recuperável e operação pública não foram concluídos.

## Retro E2 — versão 0.6

U5: PROJECT MASTER PROMPT de 17/10/2026. Autoriza a transformação incremental existente, sem redefinir silenciosamente a economia. O documento 13 substitui o olheiro pago por avaliação automática gratuita e fixa o preço NPC no nascimento; registra reserva de Coins, proteção e venda em lote. Referências E1 ao olheiro pago e preço por OVR treinado são históricas. As novas regras são experimentais quando não prescritas por U5. QA visual permanece aberto por bloqueio do navegador; não há aceite integral de F.

## Continuação — referência Treineiros

14. [Pivot 11v11](14-brasfoot-pivot.md): implementação e base da campanha.
15. [Rodada pausável](15-rodada-treinador.md): simultaneidade, pausa, condição e substituições.
16. [Súmula e pós-jogo](16-sumula-pos-jogo.md): apresentação seguindo as referências, notas compartilhadas com a carreira e limites da verificação visual.
