# Auditoria reproduzível do catálogo — issue #1

Base auditada em 17/10/2026: **844 identidades, 854 edições e 32 seleções**. A conferência estrutural não encontrou erros. Não se trata de nova verificação factual ao vivo de todos os atletas, nem de uma lista de clubes atuais.

## Executar

`npm run audit:catalog` imprime o relatório e retorna falha quando encontra inconsistências. `npm run audit:catalog -- --write-report` também atualiza [o relatório versionado](20-catalog-audit.json). A CI Linux/Windows executa a auditoria antes dos testes, com `--check-report` para também rejeitar relatório desatualizado.

O verificador compara fichas com os 831 registros FIFA e os 13 suplementos biográficos brasileiros já presentes no repositório; confere IDs, identidades compartilhadas, colisões de nome completo/nascimento, datas reais, idade plausível no ano de referência, fontes HTTPS, páginas, posições, funções e atributos. O OVR deve reproduzir a média ponderada da função; potencial e atributos precisam respeitar os limites. Dez identidades possuem uma edição brasileira e outra do Mundial; isso não constitui dez jogadores adicionais.

Testes de regressão injetam duplicação de edição, identidade desdobrada, biografias conflitantes, data impossível, clube alterado sem fonte, posição incompatível, atributo NaN, fonte inválida e ausência de edição FIFA. A auditoria não modifica o catálogo nem os saves.

## Procedência e exceções

O SHA-256 do PDF de referência disponível no ambiente Work foi conferido contra o manifesto e coincide: `2a75fb43fb871564ef040c1e81f9260c85b6a9ea7fc3b7c68cd5723d6de7e874`. O PDF não foi adicionado ao repositório e não é necessário para executar a CI. A verificação de hash identifica o documento registrado; não prova, isoladamente, que cada célula foi extraída corretamente. O importador e as fontes complementares permanecem documentados nos arquivos de origem.

| Perfil histórico | Edições |
| --- | ---: |
| Referência 2022 | 841 |
| Referência 2024 | 3 |
| Referência 2025 | 2 |
| Referência 2026 | 8 |

O ano da edição e o ano do perfil podem diferir: dez cartas BR24 reutilizam uma biografia FIFA de 2022, e os suplementos têm anos próprios. A auditoria preserva essas referências explicitamente, sem trocar clubes por suposições atuais.

- Altura desconhecida em quatro edições: BR24-001 (Bento), BR24-008 (Gerson), BR24-012 (Guilherme Arana) e BR24-013 (Gabriel Magalhães). Permanecem `null`.
- Pé preferido desconhecido em 851 edições; apenas três suplementos registram essa informação. Permanecem `null`, com indicação de ausência na ficha.
- Funções táticas, atributos, raridades, OVR e potencial são balanceamento do jogo, não avaliações factuais externas.
- Colisões de nome e nascimento exigem revisão; o verificador não une identidades automaticamente. Homônimos com nascimento diferente continuam distintos.

## Apresentação existente

A ficha já exibe o ano do clube de referência, nascimento e idade calculada pelo relógio do servidor, campos ausentes como não informados, fonte histórica e aviso de que o vínculo não é atual. Também distingue posição da fonte, funções do jogo e balanceamento experimental. Essa apresentação foi conferida no código existente; não houve mudança visual nem novo QA de navegador nesta issue.

Nenhum ID, nome, clube, atributo, peso, preço, odd, arquivo factual ou dado salvo foi alterado. O resultado é uma proteção de integridade contínua e um registro explícito das limitações da base atual.
