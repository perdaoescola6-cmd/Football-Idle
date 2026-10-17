# 17 — Perfis, packs por setor e assistente

17/10/2026. Autorização: “Beleza, pode seguir com as sugestões.” Continuação da campanha individual pausável e da referência Treineiros, preservando a implementação existente.

## Entrega

1. **Arquétipos por função:** a ficha e as cartas identificam o perfil derivado dos atributos atuais, como zagueiro de recuperação ou atacante finalizador. A ficha mostra dois destaques e o menor atributo relevante da função. São descrições determinísticas; não concedem bônus nem modificam potencial, atributos ou probabilidades. Treinos já aplicados entram nessa leitura.
2. **Packs por setor:** Geral, Goleiros, Defensores, Meio-campistas e Atacantes. O foco restringe as edições elegíveis depois do sorteio da raridade. Mantém preço, cinco cartas, chances e pisos de cada pack. Dentro do grupo elegível, a seleção é uniforme; duplicatas continuam possíveis. O pack gratuito de boas-vindas permanece geral.
3. **Assistente opcional na pausa:** estima ganho de OVR com o redutor de condição já usado pelo motor. Sugere até três pares sem conflitos, dentro do limite restante de cinco substituições. Respeita banco, setor, anúncios e proibição de reentrada. “Preparar troca” apenas preenche os seletores; “Confirmar substituição” continua obrigatório e o servidor revalida a ação. Não promete resultado nem troca automaticamente.

## Exceção explícita do catálogo

Não existe edição de goleiro **Fenômeno** no catálogo atual. Se o sorteio produzir uma raridade sem cartas no setor escolhido, aquele slot usa o catálogo geral **da mesma raridade**, sem promoção, novo sorteio ou mudança de preço. A loja avisa antes da compra e o recibo identifica os slots afetados. Portanto, um pack focado não garante cinco atletas do setor. Lacunas são calculadas do catálogo, não de uma exceção fixa para goleiros.

O foco muda a probabilidade condicional de cada edição; não altera as chances de raridade. Packs gerais conservam sua versão anterior. Focados usam `packs-focus-v1` para rastreabilidade. O preenchimento da lacuna de goleiros permanece pendente de uma decisão de catálogo, sem inventar uma carta para contorná-la.

## Contrato e persistência

O comando de abertura aceita `focus?: GENERAL | GOL | DEF | MEI | ATA`; ausência equivale a `GENERAL`. Valor inválido é recusado sem débito. `PackReceipt` acrescenta `focus` e `fallbackSlots` opcionais (índices começando em zero; apresentação começa em um), preservando recibos antigos. O ledger de packs focados registra `PACK:packs-focus-v1:<packId>:<focus>`.

A transação existente engloba débito, cartas, recibo e auditoria. A mesma chave e payload devolvem a mesma abertura; reutilizar a chave com foco diferente gera conflito. Falha de auditoria desfaz toda a compra. Campos ficam no estado JSONB existente; não houve migração destrutiva.

## Verificações

- Suíte completa: **51 testes aprovados, zero falhas**; TypeScript e build de produção aprovados.
- Cobertura nova: focos de todos os packs, preços/pisos/raridades, elegibilidade e fallback; arquétipos determinísticos sem mutação; condições, reservas, reentrada, anúncios e limite do assistente; idempotência, conflito de payload e rollback da compra.
- Navegador: abertura de um pack Básico de Defensores por 5.000 Coins, cinco cartas DEF recebidas e ficha de Felix Torres com arquétipo e destaques conferidos. A conta local União da Vila passou de 14.529 para 9.529 Coins nessa compra de QA; as cinco cartas foram preservadas.
- Rodada 8 iniciada, pausada com os quatro confrontos em zero e assistente consultado. O banco não tinha reserva elegível para melhora; a interface exibiu a explicação e manteve a confirmação indisponível. A rodada foi retomada. A lógica que produz sugestões positivas está coberta por teste automatizado; o clique de preparação de uma sugestão positiva não foi exercitado no navegador. Não foi provocada uma troca no clube do usuário para demonstrá-lo.
- Layout conferido em 390×844 e 1280×900, sem overflow horizontal da página; navegação móvel tem rolagem própria. A ficha também foi inspecionada no viewport padrão. Overrides temporários são removidos ao final.
- Rodada 8 encerrada: Maringá-PR 0×1 União da Vila; 3.500 Coins concedidas, saldo final 13.029 e rodada 9 disponível. Notas, melhor em campo e os três modos foram conferidos; nenhuma substituição, treino ou mudança de escalação foi aplicada. Console consultado sem avisos/erros capturados nessa aba. O viewport foi restaurado.

Provas novas: [pack por setor](provas/packs-setor.jpg), [ficha com arquétipo](provas/arquetipo-ficha.jpg), [assistente na pausa](provas/assistente-pausa.jpg), [packs em celular](provas/packs-celular.jpg) e [rodada encerrada](provas/rodada8-final.jpg). Uma aba HTTP aberta pelo usuário permitiu retomar a conferência; as capturas anteriores aos documentos 16/17 não foram reapresentadas como provas desta entrega.

## Limites preservados

Arquétipos, OVR/condição e sugestões são modelos experimentais. Não há habilidades extras implícitas, xG, faltas/cartões novos, mudança de economia, pagamento real ou publicação MMO. O motor e os dados do catálogo continuam com os limites já registrados nos documentos 15/16. A evolução de autenticação, recuperação de conta, carga e direitos de publicação permanece pendente.
