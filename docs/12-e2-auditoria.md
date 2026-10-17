# E2 — Auditoria e sequência de implementação

Pedido normativo: PROJECT MASTER PROMPT fornecido pelo usuário em 17/10/2026. Complementa E1 e substitui suas decisões experimentais incompatíveis.

## Auditoria A

- Arquitetura preservada: Next.js/React/TypeScript; Fastify modular; PostgreSQL/PGlite; worker; RNG HMAC; carteira auditada; snapshots e eventos de partida. Não há reescrita de servidor ou migração de framework.
- Reais e preservados: farm 90s/5v5, sete regiões, XP/tetos, offline, CT, anúncios e transferências P2P, campanhas da liga, God mode local.
- Incompletos: não havia proteção, depósito de atletas, regras de organização, venda em lote, reserva de Coins, catálogo de arte, paginação do elenco ou sprites de atletas. Interfaces de cards e ambientes tinham pouca variedade.
- Divergências identificadas e explicadas antes das alterações: preço NPC usa OVR treinado; olheiro pago cria atletas; ofertas não retêm saldo. Solução: preço imutável de nascimento; avaliador sem custo/sem drops extras; reservas transacionais de ofertas.
- Não implementados nem definidos: Classe separada de P1–P5, Potência separada, Aptidões, especializações e refinamento. Não criar fórmulas, materiais raros ou recompensas monetárias para preencher essas lacunas. Usar dados existentes e marcar recursos ausentes.

## Direção A

Identidade: clube de bairro retrô, placas de estádio, azul-noite, gramado, dourado restrito a raridades superiores. Pixel art autoral vetorial; poses e retratos vetoriais determinísticos. Ambientes diferentes por instalação e região; catálogo com nome, dimensões, versão e origem. Não reutilizar assets externos.

Referência consultada: https://pokeidle.io/app — somente hierarquia de navegação, organização e legibilidade. Capturas anteriores do usuário como comparação; nenhum arquivo do produto é copiado.

## Sequência

A. Auditoria e catálogo. B. Sprites, estádio e preferências de transmissão. C. Proteção, armazenamento, filtros/paginação, comparação, venda em lote e olheiro automático. D. Ambientes CT/depósito, pausa e teto, inventário real. E. Reservas de ofertas, histórico e acabamento. F. Testes, uso real no navegador, evidências e limites restantes.

Resultados reais e limitações estão em [13 — Retro E2](13-retro-e2.md). A parte visual da fase F não foi concluída: a ferramenta de navegador ficou bloqueada em abas internas de erro, embora o usuário confirme que vê o campo. Não há capturas E2 nem aceite visual fabricado.

## Provas e aceite

As provas visuais E1 existentes não foram alteradas nem rotuladas como E2. O relatório 13 registra a impossibilidade de certificar novas capturas pelo navegador bloqueado e os checks executados. A, B, C, D e E têm implementação integrada; F tem automação aprovada e aceite visual pendente. Nenhuma dessas observações equivale a aprovação de balanceamento definitivo ou prontidão para um MMO público.
