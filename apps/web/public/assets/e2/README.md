# Arte E2 — catálogo autoral

Versão: RETRO-E2. Origem: desenho procedural original deste projeto, sem assets baixados, fotografias de atletas ou marcas de terceiros.

- `catalog.json`: nome, caminho, dimensões lógicas e de exportação, versão e origem dos 15 arquivos.
- `environment-*`: estádio, vestiário, CT, scouting, mercado, depósito e liga.
- `region-*`: sete ambientes diferentes, acompanhando os circuitos existentes.
- `item-common-supply.svg`: o único material econômico atualmente implementado.
- Retratos e sprites: `apps/web/app/components/PixelArt.tsx`. Aparência derivada do identificador persistido `portrait`; não há geração remota por atleta.
- Poses: corrida, repouso, chute, defesa e comemoração. Movimento de bola usa os eventos do servidor.

## Reutilização e exportação

Execute `node scripts/generate-pixel-assets.mjs` a partir da raiz para regenerar os SVGs e o catálogo. Os desenhos usam grade lógica e `shape-rendering="crispEdges"`. Renderizar em múltiplos inteiros mantém a nitidez. Componentes e CSS usam escalas adequadas ao espaço disponível; não há atlas raster nesta versão, pois cada sprite vetorial é pequeno e compartilhado pelo React.

A paleta e os estados estão em `apps/web/app/retro.css`: azul do clube, verde de gramado, placas claras, proteção e molduras crescentes P1–P5. Estados: normal, hover/foco, selecionado, indisponível, protegido, confirmação, vazio e erro.

Nenhuma arte de material raro/refinamento é apresentada como recurso possuído. Quando essas regras forem aprovadas, cada novo item precisará de entidade econômica e asset próprios. A integração visual precisa de QA em navegador; a validação automática do catálogo verifica integridade, dimensões, variedade e ausência de referências externas.
