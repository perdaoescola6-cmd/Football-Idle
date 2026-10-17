# Packs: probabilidades e abertura completa — issue #2

Os cinco packs e os cinco focos existentes foram preservados. Preços, odds, pisos, versões, catálogo e formato dos recibos não mudam.

## Correções

- Validação compartilhada de configuração: preço inteiro positivo seguro, cinco pesos inteiros não negativos somando 10.000 e cinco pisos válidos. A simulação do servidor e as funções de odds publicadas usam a mesma validação. Slots fracionários e rolagens inválidas são rejeitados.
- O cálculo de chance de ao menos um Fenômeno agora também considera um eventual piso Fenômeno: nesse caso, a chance é 100%. Os packs atuais não têm esse piso, portanto conservam as probabilidades anteriores.
- A abertura prepara as cinco cartas antes de descontar Coins ou alterar a coleção. Se uma raridade não tiver cartas disponíveis, retorna indisponibilidade sem débito, cartas parciais ou recibo. O pack de boas-vindas também não é marcado como recebido nesse caso.
- O organizador continua considerando duplicatas encontradas dentro da mesma abertura, enviando as seguintes ao depósito quando configurado.

A API continua usando sua transação de persistência e idempotência para concorrência e falhas de auditoria no banco. A preparação antecipada acrescenta segurança às chamadas diretas do motor; não substitui essa transação.

## Verificação

Novas regressões cobrem configuração inválida, slots fracionários, probabilidades efetivas para todas as 10.000 rolagens de cada slot, eventual piso Fenômeno, saldo insuficiente, pool ausente no segundo slot e duplicatas no mesmo pack. A falha no segundo slot é injetada para verificar que uma primeira carta já preparada não é entregue parcialmente. Esses cenários não exigem alterar os dados reais.

Os testes existentes também percorrem todos os packs e focos, conferem fallback e raridade, e exercitam reenvio idempotente, compras concorrentes, saldo, persistência e rollback transacional. A loja continua mostrando odds por slot e aviso de fallback por ausência do setor, com os mesmos contratos compartilhados. Não houve alteração visual nem novo QA de navegador nesta issue.
