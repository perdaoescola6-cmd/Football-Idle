# Classificação acessível no celular

Etapa visual da issue #13: a tabela do campeonato agora tem uma área própria de rolagem, com nome acessível, foco visível e navegação pelas setas após Tab. O título e a orientação ficam fora dessa área e permanecem visíveis enquanto as colunas se movem. Os cabeçalhos têm nomes completos e escopo de coluna. A orientação aparece até 700px; no desktop, a tabela mantém a apresentação sem o texto adicional.

Não há mudanças no servidor, economia, catálogo, odds, regras, saves ou navegação entre seções.

## Verificação real

Executada em 17/10/2026 (São Paulo), com Microsoft Edge headless via Playwright, nas larguras de 360px e 1440px, altura de 900px. Clube de teste com nome longo: Associação Futebol da Vila Azul.

O ambiente usou uma API separada na porta 3313 com PGlite exclusivamente em memória e interface Next local na porta 3315. As chamadas `/api/` do navegador foram encaminhadas pelo harness à API de teste real, sem respostas simuladas. Os serviços existentes nas portas 3000/3101 e seus bancos não foram usados nem encerrados. Esta prova cobre as telas e a API isolada; não certifica um deploy ou a configuração de proxy de produção.

| Tela | 360px: largura do documento | 1440px: largura do documento | Resultado |
| --- | --- | --- | --- |
| Campeonato | 360px | 1440px | Sem transbordamento da página; tabela com rolagem local no celular |
| Elenco | 360px | 1440px | Navegação, formação e tática legíveis, sem transbordamento da página |
| Packs | 360px | 1440px | Navegação e filtro por setor legíveis, sem transbordamento da página |

Antes do ajuste, as três telas já cabiam na largura da página. O problema verificado foi a tabela esconder colunas à direita sem instrução de rolagem nem um ponto de foco explícito para a região.

Após o ajuste, Tab a partir do controle anterior alcançou a região da classificação e exibiu um contorno de 3px. No celular, as setas moveram a rolagem de 0 até 86px, revelando as colunas da direita. A posição horizontal do título permaneceu em 30px durante a rolagem. No desktop, a tabela coube inteira, sem rolagem horizontal. As 12 respostas da API observadas foram bem-sucedidas e não houve erro JavaScript de página.

### Provas visuais

| Tela | Celular | Desktop |
| --- | --- | --- |
| Campeonato | [Classificação](qa/13-mobile/360-Campeonato.png) · [rolagem pelo teclado](qa/13-mobile/360-table-keyboard.png) | [Classificação](qa/13-mobile/1440-Campeonato.png) |
| Elenco | [Elenco](qa/13-mobile/360-Elenco.png) | [Elenco](qa/13-mobile/1440-Elenco.png) |
| Packs | [Packs](qa/13-mobile/360-Packs.png) | [Packs](qa/13-mobile/1440-Packs.png) |

As imagens são capturas reais da versão de desenvolvimento e incluem seu indicador local do Next. Não foram executadas partidas, compras ou vendas durante a conferência. O teste usa navegador com teclado e medidas do DOM; não substitui uma avaliação com leitor de tela ou dispositivo físico.

Validação local: instalação pelo lockfile, lint, validação da política, TypeScript, auditoria do catálogo, 70/70 testes e build:check aprovados. A branch parte da main e não incorpora os PRs de temporadas e rankings que aguardam revisão separada.
