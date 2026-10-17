# 07 — Perfil experimental do primeiro protótipo

**Atualização após U2:** este candidato foi escolhido como base experimental da primeira implementação local M1-E0.1, após o usuário pedir para começar o código. Consulte [08 — Implementação](08-primeira-implementacao.md). O restante preserva o perfil e o status no momento em que foi proposto; suas observações de ausência de código/autorização são históricas.

Identificador proposto: **M1-E0** • 17/10/2026 • estado: **candidato para revisão, não aprovado para implementação**.

Este documento torna concretas as propostas do pacote 01–06. Todos os valores novos e fórmulas aqui são **experimentais**. Regras A01–A12 do registro 06 permanecem aprovadas pelo pedido original; este perfil não reclassifica propostas como aprovações. “Pode seguir” autoriza continuar a documentação, sem satisfazer a exigência anterior de autorização explícita para programar.

Não há código, configuração executável, migração ou simulador nesta entrega. Cálculos abaixo são verificações analíticas, não resultados de partidas simuladas. O perfil não está pronto para ativação enquanto Q08–Q09 e a escolha do algoritmo determinístico de RNG não forem fechados.

## 1. Cenário de referência

Jogador cria clube, usa cinco titulares, ativa Várzea e mantém presença online válida por 60 minutos de farm, sem pausas entre janelas. Não usar tempo de cadastro nem tempo nas telas para conceder progresso.

Há 40 janelas completas de 90s nesse cenário. O progresso do clube não depende de vitória, raridade ou OVR do time. Isso permite calibrar o acesso a Regional separadamente da força do plantel e da sorte nos drops.

O tempo real entre abrir a página e liberar Regional pode superar uma hora se houver onboarding, pausas ou ausência. Isso deve ser explicado no teste de balanceamento, sem apresentar 60 minutos como garantia absoluta.

## 2. Formação e atributos — candidato para Q01/Q11

Cinco slots genéricos, sem posição obrigatória ou goleiro separado no slice. Os dois lados representam times de cinco, e a resistência defensiva é coletiva. Este modelo é uma simplificação provisória de futebol para validar o ciclo idle, não a especificação final de táticas.

| Chave | Rótulo | Uso no modelo mínimo |
|---|---|---|
| `finishing` | Finalização | Ataque coletivo |
| `passing` | Passe | Ataque coletivo |
| `control` | Controle | Ataque coletivo |
| `pace` | Velocidade | Força geral para disputa de posse |
| `marking` | Marcação | Defesa coletiva |
| `defending` | Defesa | Defesa coletiva |

Valores e tetos são inteiros de 0 a 99. Cada atleta possui seis tetos permanentes próprios; não existe teto único de nível. Não há stamina, lesão, fadiga, moral, idade ou perda de atributo em M1.

**OVR proposto:** parte inteira da média aritmética dos seis atributos. Exemplo: soma 151 produz OVR 25. Os pesos são iguais neste perfil; isso substitui a lacuna Q01 somente se o perfil for escolhido. Nenhuma raridade garante OVR imediato: ela governa o intervalo dos tetos da geração.

## 3. Elenco inicial e atletas de drop — candidato para Q03

### Kit inicial

- Exatamente cinco atletas P1, nível 1, XP total 0.
- Todos começam com os seis atributos em 20.
- Cada teto é sorteado independentemente entre 45 e 60, inclusive.
- Os cinco são colocados nos slots 1–5; nomes funcionais “Atleta 01” a “Atleta 05”. UUID é identidade, não o nome.
- Coins iniciais: 0. Nenhum material inicial.
- Seeds, tetos e IDs são persistidos na transação de criação; retry não sorteia outro kit.

Os titulares começam equivalentes em força, mas seus tetos podem diferir. Essa simplicidade é intencional para o primeiro teste; diversidade inicial fica sujeita à revisão de UX/balanceamento.

### Geração de drop

| Raridade | Intervalo uniforme de cada teto, inclusivo |
|---|---|
| P1 | 45–60 |
| P2 | 61–72 |
| P3 | 73–84 |
| P4 | 85–93 |
| P5 | 94–99 |

Os seis tetos são sorteados separadamente no intervalo da raridade. Atleta de drop começa no nível 1, XP 0 e com cada atributo igual à parte inteira de **35% do respectivo teto**. Nenhum bônus aleatório adicional. Nome funcional usa ordinal persistido de aquisição, sem precisar de catálogo de nomes reais.

Exemplo de geração: teto 60 → atributo inicial 21; teto 99 → atributo inicial 34. Isso deixa potencial de crescimento nos drops de maior raridade, sem começar diretamente no OVR máximo. A distribuição desses intervalos é experimental e pode ser rebalanceada antes de escolher o perfil.

## 4. XP de atleta — candidato para Q02

XP cumulativo nunca é gasto ou reduzido. O custo para passar do nível `n` para `n+1` é **100 + 25 × (n−1)** XP, para todo inteiro n≥1.

O limiar cumulativo para chegar ao nível L é:

**T(L) = 100 × (L−1) + 25 × (L−1) × (L−2) / 2**.

Nível é o maior L≥1 cujo T(L) não supera o XP total. Calcular futuramente por inteiros exatos; uma aproximação por raiz não pode produzir nível incorreto na fronteira.

| Nível | XP total mínimo |
|---|---:|
| 1 | 0 |
| 2 | 100 |
| 3 | 225 |
| 4 | 375 |
| 5 | 550 |
| 6 | 750 |
| 7 | 975 |

Cada nível ganho aumenta **cada um dos seis atributos em 1**, limitado ao respectivo teto. Se uma concessão atravessar vários níveis, aplicar o número total de níveis ganhos, sem perder etapas. Para evitar atualização iterativa sem limite, o cálculo pode ser agregado, preservando o mesmo resultado.

Uma vez atingido o teto, aumentos daquele atributo deixam de ocorrer. Não há pontos acumulados para redistribuir, escolha manual de atributos ou reroll. O nível continua aumentando mesmo depois de todos os tetos.

Recompensa integral online proposta: **20 XP para cada um dos cinco atletas do snapshot**, tanto em Várzea quanto em Regional, independente do resultado. Não é um total de 20 dividido entre titulares. Reservas não recebem XP de farm. Offline e janelas mistas aplicam os fatores e restos exatos de 04 a cada beneficiário.

Para o titular inicial mantido durante 40 partidas online: 800 XP → nível 6 → atributos 25 → OVR 25. Este cálculo assume que todos os tetos estão acima de 25, como no kit proposto.

## 5. Clube e regiões — candidato para Q04/Q05

Interpretar os números de região como **níveis permanentes do clube**, conforme D03. Clube inicia no nível 1 com XP 0. Curva experimental: limiar do nível L = **100 × (L−1)** XP. Portanto, nível = 1 + parte inteira de XP/100.

Cada partida integral online concede **28 XP de clube**, independente de resultado e de qual das duas regiões M1 está selecionada. Offline concede 50%; janela mista segue 04. Trocar ou retirar atleta não reduz XP, nível ou desbloqueio do clube.

| Região | Nível de clube preservado de U1 | XP no perfil proposto | Conteúdo M1 |
|---|---:|---:|---|
| Várzea | 1 | 0 | Sim |
| Regional | 12 | 1.100 | Sim |
| Estadual | 60 | 5.900 | Não |
| Nacional | 150 | 14.900 | Não |
| Continental | 320 | 31.900 | Não |
| Europa | 600 | 59.900 | Não |
| Elite | 1.100 | 109.900 | Não |

As colunas de XP são derivadas experimentais, não novos limiares aprovados. M1 não cria desbloqueio utilizável das regiões sem conteúdo; níveis do clube continuam podendo crescer. Projeções de tempo para regiões futuras não são metas e não devem orientar seu balanceamento ainda.

**Verificação de Regional:** 39 partidas ×28 =1.092 XP, ainda nível 11. Na partida 40: 1.120 XP, nível 12, Regional liberada. 40×90s =3.600s =60min de farm online contínuo. Nenhum sorteio precisa ser favorável para cumprir esse cenário.

## 6. Coins e materiais — candidato para Q06

### Coins integrais online por partida

| Região | Derrota | Empate | Vitória |
|---|---:|---:|---:|
| Várzea | 10 | 12 | 15 |
| Regional | 12 | 15 | 18 |

Coins não são gastas no slice. Elas validam concessão, histórico e integridade econômica. Esses valores não são uma economia final nem antecipam preços de CT ou P2P.

Em 40 partidas de Várzea integralmente online, Coins ficam entre **400 e 600**, conforme resultados. Não apresentar o meio do intervalo como média prevista sem medir as probabilidades do simulador.

### Material mínimo

Catálogo experimental contém apenas `common_supply`, rótulo **Suprimento comum**, tier COMMON. Um pacote tem **1 unidade**. Sem uso, gasto ou capacidade máxima em M1. Nenhum item RARE/EXCEPTIONAL faz parte da tabela de drops desse perfil, inclusive online; raridades maiores de atletas continuam existindo normalmente.

| Tipo de janela | Tentativa de material |
|---|---|
| Integralmente online | Uma tentativa, 80% de chance de 1 Suprimento comum |
| Offline elegível ou mista com F>0 e U=0 | Uma tentativa, 50% absoluto de 1 Suprimento comum, conforme D11 |
| Com tempo sem elegibilidade U>0 | Sem tentativa |

Tentativa de material é independente do drop de atleta e do resultado esportivo. Nenhum material concedido significa simplesmente que a tentativa falhou; não existe compensação ou garantia acumulada.

## 7. Drop de atleta — candidato para Q06

Uma única tentativa por partida **integralmente online**, com **20% de chance de conceder exatamente um atleta**. Se falhar, nenhum atleta. Se tiver sucesso, sortear a raridade com os percentuais aprovados A04, sem modificá-los por vitória, região ou nível do clube.

Não há garantia, pity, bônus de primeiro drop, multiplicador por vitória ou ajuste oculto por tempo online. Offline/mista tem zero tentativa de atleta, mesmo que o jogador tenha presença no instante final.

Em uma hora integralmente online, 40 partidas produzem **8 atletas em expectativa**, não oito garantidos. Expectativas por raridade:

| Raridade | Quantidade esperada por 40 partidas online |
|---|---:|
| P1 | 5,9588 |
| P2 | 1,6 |
| P3 | 0,4 |
| P4 | 0,04 |
| P5 | 0,0012 |

A probabilidade proposta de P5 por **partida elegível** é 20%×0,015%=**0,003%**. Essa derivação não substitui nem altera a regra aprovada de **0,015% por drop de atleta**. Um teste de uma hora não pode exigir que P4 ou P5 apareçam.

O tamanho esperado da Coleção após uma hora é 5 iniciais +8 adquiridos =13, antes de qualquer sistema futuro. Isso é uma hipótese mensurável de volume, sem descarte ou venda em M1.

## 8. Simulador esportivo mínimo — candidato para Q10

Todas as médias usam os atributos do snapshot. Cálculos intermediários são racionais exatos; arredondar OVR exibido não pode alterar probabilidades.

Para cada lado:

- **Força geral S:** média dos 30 valores (seis atributos de cinco atletas).
- **Ataque A:** média entre os cinco atletas de `0,5×Finalização + 0,3×Passe + 0,2×Controle`.
- **Defesa D:** média entre os cinco atletas de `0,6×Marcação + 0,4×Defesa`.

Há **nove oportunidades** por partida, nos offsets **5, 15, 25, 35, 45, 55, 65, 75 e 85 segundos**. Para cada oportunidade:

1. Selecionar lado com probabilidade HOME = **limitar(0,5+(S_HOME−S_AWAY)/200; mínimo 0,2; máximo 0,8)**. AWAY recebe a probabilidade complementar.
2. Selecionar uniformemente um dos cinco atores daquele lado para representar a jogada; emitir `POSSESSION_CHANGED` e `CHANCE_CREATED` no offset da oportunidade.
3. Probabilidade de gol = **limitar(0,25+(A_atacante−D_defensor)/200; mínimo 0,1; máximo 0,75)**.
4. Se for gol, emitir `SHOT_RESOLVED` com GOAL e placar atualizado. Caso contrário, dividir SAVED/MISSED em partes iguais, por sorteio independente, sem alterar placar.
5. Emitir o desfecho do chute **2 segundos após a oportunidade**, ainda antes do término. Um lance não ocupa nem pausa o relógio econômico.

Não há prorrogação, pênaltis ou desempate. Placar igual é DRAW. Aos 90s emitir `MATCH_ENDED` com a perspectiva do clube HOME. A ordem em offsets iguais é posse, chance e depois chute; sequência crescente global. Este perfil gera exatamente **29 eventos**: início +9×3 +fim.

O ator selecionado serve como apresentação do ataque coletivo; neste modelo não há bônus individual adicional do finalizador. Os seis atributos afetam as probabilidades pelas médias, incluindo velocidade em S. Não divulgar táticas ou papéis que o simulador não calcula.

### NPCs do slice

Cada NPC tem cinco atores e seis atributos por ator sorteados independentemente de maneira uniforme:

| Região | Valor de cada atributo NPC |
|---|---|
| Várzea | 18–22, inclusivo |
| Regional | 24–28, inclusivo |

Oponente é criado e congelado por partida. Para apresentação, nível NPC =1, teto individual =valor do atributo e OVR pela mesma fórmula de média. NPC não progride, não possui carteira e não recebe drops. Não há escolha de oponente pelo cliente nem reroll ao atualizar página.

Não há um segundo multiplicador aleatório de força; a sorte já existe na geração de NPC, posse e gols. Ainda é necessário medir se nove oportunidades deixam o resultado excessivamente variável. A observação anterior de “sorte um pouco” não é declarada satisfeita sem esse ensaio.

## 9. Presença e bordas offline — candidato para Q07

Adotar D08–D11 como propostas deste perfil:

- Heartbeat recomendado a cada **10s**; lease válido por **30s** após heartbeat aceito. Polling de UI a cada **3s** durante acompanhamento ativo da partida.
- Intervalo online reconhecido não exige foco da aba ou ação manual contínua no protótipo; exige heartbeat válido. Aba suspensa que não mantenha lease passa a offline. Isso mede conectividade, não atenção humana.
- Inicial offline 0. Após **600s contínuos** de presença válida, renovar para no máximo **86.400s** de farm offline. Farm não precisa estar ligado para qualificar a renovação.
- Menos de 600s no retorno conserva crédito residual, sem recarregar. Permanecer online após qualificar não acumula mais de 24h.
- XP de atleta, XP de clube e Coins offline ×0,5. Janela mista usa `(O+0,5F)/90000`, preservando resto racional por beneficiário.
- Material usa a tabela da seção 6. Atleta exige todos os 90s online. Nenhuma exceção por “ficou online quase todo o jogo”.

Esses tempos operacionais não foram aprovados originalmente; 10min/24h/50% vêm de U1, enquanto heartbeat/grace/polling são experimentais. O cliente deve exibir que a ausência começa após expirar a cobertura reconhecida, não necessariamente no instante em que a rede caiu.

Para teste isolado de offline, medir **a partir do fim da cobertura online**, com orçamento cheio e farm ativo. Em 24h integralmente offline: 960 janelas; cada titular do snapshot recebe 9.600 XP; clube recebe 13.440 XP; Coins equivalem à metade da soma das recompensas-base daqueles resultados; materiais têm expectativa de 480 unidades; atletas concedidos =0. Esses totais não incluem tempo online anterior e não definem uma estratégia de progressão futura além de Regional.

## 10. Nomes e identidade — candidato parcial para Q12

Nome de clube proposto: 3–32 caracteres Unicode após normalização NFC e remoção de espaços externos; proibir quebras de linha e caracteres de controle; manter espaços internos. Nomes de clubes não precisam ser únicos no slice. Exibir como texto, nunca HTML.

Atletas e NPCs usam nomes funcionais gerados no servidor, sem edição em M1. Identidade/autenticação (Q08) permanece aberta. Nenhum login fictício ou regra de recuperação de conta é introduzido por este perfil.

## 11. Medições e revisão antes de escolher o perfil

| Verificação | Critério documental / futuro ensaio |
|---|---|
| Regional | 39 jogos ainda bloqueado; 40º jogo integral online libera; confirmar com clock controlado e sessão real |
| Titular inicial | 800 XP resulta em nível 6 e OVR 25 sem ultrapassar teto |
| Segurança econômica | Mesmo resultado após restart e retry; razão/cache/grants conciliam |
| Volume de atletas | Esperança 8/h; medir distribuição, ocupação da Coleção e utilidade de trocar titulares |
| Sorte | Medir taxa de vitória, dispersão de placar e frequência de time mais fraco vencer; não declarar peso “pequeno” por fórmula apenas |
| Regional | Comparar dificuldade antes/depois da troca de região, mantendo progressão possível mesmo em derrotas |
| Offline | Validar 960 janelas integrais, fatores, materiais comuns e nenhum atleta; testar bordas mistas separadamente |
| UX | Jogador entende XP de clube vs atleta, tetos vs nível, chance por partida vs chance por drop e materiais sem uso |

O critério estatístico de amostragem será escolhido no plano de teste antes de qualquer ensaio; nenhum resultado de simulação foi produzido aqui. Ajustes devem manter A01–A12 ou obter nova instrução para alterá-los.

## 12. O que este perfil resolve e o que não resolve

Fornece candidatos completos para a maior parte das regras Q01–Q07 e Q10–Q12. **Q continuam pendentes de escolha**, com rastreabilidade em 06; não estão encerradas só porque agora existe uma proposta.

Ainda faltam autenticação concreta, operação/retenção/limites, algoritmo de RNG e sua versão, validação estatística do simulador e autorização explícita de programação. Nenhuma dessas ausências impede revisar o perfil no papel. Elas impedem chamá-lo de implementação pronta ou de configuração já ativável.
