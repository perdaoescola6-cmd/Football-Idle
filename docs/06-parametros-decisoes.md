# 06 — Registro de parâmetros, decisões e contradições

**Atualização após U2:** a primeira implementação local foi autorizada e usa o perfil como base experimental. Consulte [08 — Implementação](08-primeira-implementacao.md) para as escolhas efetivadas e diferenças. As observações de “sem código/autorização” ao final deste documento registram o encerramento da etapa documental anterior, não o estado atual do projeto.

**Atualização U5/E2:** mudanças e precedência em [13 — Retro E2](13-retro-e2.md): olheiro organizador sem custo/novos drops, preço NPC de nascimento, proteção, reserva de ofertas e confirmação do lote. Novos presets e valores continuam experimentais.

Fonte principal U1: pedido detalhado inicial desta conversa. Aprovado significa explicitado nesse pedido, não inferido da recuperação incompleta da conversa anterior. Experimental significa proposta testável deste pacote, não aprovação permanente. Indefinido significa que não deve receber valor escondido na futura implementação.

## A — Parâmetros aprovados / preservados

| ID | Parâmetro | Valor / regra | Alcance |
|---|---|---|---|
| A01 | Elenco inicial | Exatamente 5 atletas; escalação manual | M1; raridades/atributos iniciais indefinidos |
| A02 | Partida | 5v5, 90 segundos; farm automático | M1 |
| A03 | Progressão de atleta | Nível ilimitado; OVR até 99; 6 atributos e tetos individuais | M1; nomes/fórmulas indefinidos |
| A04 | Raridade por drop de atleta | P1 74,485%; P2 20%; P3 5%; P4 0,5%; P5 0,015% | Soma 100%; **condicional à existência de cada drop** |
| A05 | Drop de atleta | Somente online | M1; definição técnica de online é proposta |
| A06 | Offline | Até 24h; 50% XP/Coins; 50% chance de materiais comuns; nenhum raro/excepcional; 10min online para renovar | M1; bordas e denominador da chance precisam de ratificação |
| A07 | Regiões | Várzea1, Regional12, Estadual60, Nacional150, Continental320, Europa600, Elite1100; progresso permanente do clube | M1 só Várzea/Regional; unidade ainda Q04 |
| A07b | Ritmo | Regional por volta de 1h; não pelo nível médio dos titulares | Meta de calibração, não SLA ou timer automático |
| A08 | CT | 2 slots iniciais, máximo 5; treino de reserva; manutenção só durante treino ativo | Depois de M1 |
| A09 | P2P | Preço livre; comissão 15%; elegibilidade ~1%; listagem 1/7/30 dias; ofertas 24h | Depois de M1; ~1% não é chance definida |
| A10 | Ligas | Assíncronas; 14 dias; até 20 jogos; adversário sorteado por divisão | Depois de M1 |
| A11 | Tecnologia | Browser Next.js/TypeScript, Fastify modular, PostgreSQL, worker, PixiJS futuramente | Sem escolher versões/provedores nesta entrega |
| A12 | Processo / UX | UX simples; primeira entrega no ciclo jogável; não programar sem autorização explícita adicional | Válido para todo o pacote |

## D — Decisões técnicas provisórias

Todas são propostas reversíveis no nível documental. Cada linha descreve o efeito e o ponto de revisão; nenhuma implica que a implementação já exista.

| ID | Proposta | Motivo / teste de revisão |
|---|---|---|
| D01 | Cinco slots genéricos no slice, sem posição obrigatória | Nomes/posições não recuperados; ratificar Q11 antes de formação/simulador |
| D02 | Coleção é plantel possuído; Depósito por quantidade, sem capacidade, descarte ou bônus de álbum | Mantém o ciclo mínimo; rever quando houver usos de materiais |
| D03 | Números de região como nível permanente do clube, inicial 1; XP cumulativo canônico | Permite limiares sem depender dos titulares; ratificação Q04 obrigatória |
| D04 | Monólito modular Fastify + frontend Next.js + worker separado | Isolar responsabilidades com baixo custo operacional; não pressupõe repositório existente |
| D05 | Fila durável inicial em PostgreSQL | Evitar serviço adicional no slice; validar concorrência/catch-up em QA |
| D06 | Razão imutável por carteira, saldo cache transacional, concessões atômicas | Rastreabilidade e idempotência; P2P poderá exigir modelo contábil ampliado |
| D07 | XP de atleta apenas para os cinco do snapshot; reservas sem XP de farm | Reserva terá CT em fase posterior; política de divisão Q02 |
| D08 | Online por lease/heartbeat servidor, um controlador por clube | Evita somar abas e falsificar duração; AFK e tempos ainda pendentes |
| D09 | Offline inicial zero; 600s online contínuos renovam teto de 24h de farm; XP de clube também ×0,5 | Resolve renovação sem crédito infinito; ratificar se 10min são contínuos ou acumulados e se farm precisa estar ligado |
| D10 | Atleta exige janela integral online; XP/Coins proporcional em janela mista com restos exatos | Fecha exploração por reconnect no fim e perda por arredondamento; bordas dependem de Q07 |
| D11 | 50% absoluto por janela offline elegível para pacote comum; mista elegível idem; com trecho inelegível não há material | Interpretação explícita, ainda não aprovada; definir pacote Q06 e alternativa multiplicativa Q07 |
| D12 | API HTTP v1, sessão segura, comandos idempotentes e versões otimistas | Contratos independentes da UI; provedor de identidade ainda Q08 |
| D13 | Replay por eventos sem coordenadas, disponível completo após settlement; UI simples | Permite PixiJS futuro; animação ao vivo detalhada não é requisito M1 |
| D14 | Janelas contínuas de 90s sem intervalo imposto; catch-up usa tempo lógico/snapshots históricos | Aproxima 40 partidas/h sem aumentar duração nem recompensar tempo não elegível |

## E — Valores experimentais propostos ou a calibrar

| ID | Parâmetro | Estado e forma de escolher |
|---|---|---|
| E01 | Coins iniciais | **Proposta: 0**. Não aprovado; se for positivo, definir grant/razão de origem |
| E02 | Curva XP clube → nível | Candidato M1-E0: limiar 100×(L−1); 28 XP/jogo integral online; Regional no 40º jogo. Ver 07 §5; não aprovado |
| E03 | Frequência heartbeat / grace / polling | Candidato M1-E0: 10s / 30s / 3s, respectivamente. Ver 07 §9; validar rede/aba suspensa |
| E04 | Chance e quantidade de drops por partida | Candidato M1-E0: uma tentativa de 20% por partida integral online, concedendo um atleta; A04 intacta. Ver 07 §7 |
| E05 | Ganho de XP e Coins / região / resultado | Candidato M1-E0: 20 XP por titular; Coins Várzea 10/12/15 e Regional 12/15/18 para derrota/empate/vitória; materiais em 07 §6 |
| E06 | Distribuição de NPCs e peso de sorte | Candidato M1-E0: atributos NPC 18–22/24–28 por região; nove oportunidades e probabilidades limitadas. Ver 07 §8; influência da sorte ainda não validada |
| E07 | Limites operacionais e lotes | Sem números. Definir limites de payload/paginação, taxa de chamadas, retries e tamanho de catch-up conforme ambiente de teste |

Um perfil experimental só fica utilizável quando todo valor obrigatório estiver preenchido e identificado como experimental. É aceitável testar e mudar depois; não é aceitável chamar um valor inventado de “aprovado no design anterior”.

Na versão documental 0.1, E02–E06 não tinham valores propostos. A versão 0.2 acrescenta os candidatos acima, detalhados em [07 — Perfil experimental M1-E0](07-perfil-experimental-prototipo.md), com autorização para continuar a etapa documental. Isso não muda os parâmetros aprovados A nem registra aceite das decisões D. E07 e as definições operacionais não cobertas continuam sem números. Atributos, geração inicial e de drops, curva de atleta, nomes e modelo esportivo também receberam propostas em 07; permanecem sujeitos à escolha do perfil.

## Q — Pendências e dependências

| ID | Pergunta / decisão necessária | Bloqueia |
|---|---|---|
| Q01 | Quais seis atributos, escala/precisão, tetos por atleta/raridade, fórmula/pesos/arredondamento de OVR? | Fichas, geração e evolução, simulador; US01/06 |
| Q02 | Curva XP→nível de atleta, ganho por resultado/região, distribuição por titular, efeito de nível em atributos e resto de progressão? | US04/06 |
| Q03 | Kit inicial: raridades, nomes, nível, atributos e tetos; geração de atleta drop e restrições? | US01/07 |
| Q04 | 1/12/60/150/320/600/1100 representam níveis permanentes do clube? Confirmar nível inicial 1 e unidade de progresso. | US10, mapeamento de região |
| Q05 | Qual cenário define ~1h (online contínuo, resultados de referência, tempo de UI)? Fórmula de XP de clube, efeito de derrota, offline e região? | Perfil de balanceamento, QA23 |
| Q06 | Ocorrência/número de drops de atleta; tabela de materiais, pacotes comuns, taxas online; Coins/XP base por região/resultado? | Todo pagamento jogável, US04/07/08/09 |
| Q07 | Ratificar D08–11: atenção/AFK; 10min contínuos ou acumulados; crédito inicial; 24h por orçamento ou por ausência; XP de clube offline; 50% absoluta ou multiplicador; materiais/atletas em janela mista? | US09 e bordas de US07 |
| Q08 | Conta/provedor de login, recuperação de sessão, política de conta por jogador e acesso local vs externo? | Entrada persistente e acesso externo; definir antes de implementar auth concreta |
| Q09 | Provedor de operação, retenção de replays/idempotência/presença, tamanho de páginas, rate limits, leases/retries, backup, indisponibilidade e SLO? | Operação; itens mínimos antes de testes externos |
| Q10 | Simulador mínimo: fórmula de força dos seis atributos, gols/chances, sorte, NPC por região, empate, efeitos do resultado? | US03/04/05; sem presumir fórmula herdada |
| Q11 | Cinco slots genéricos ou posições com goleiro? Formação fixa, restrições de elenco e papel de cada atributo no 5v5? | Snapshot, escalação e simulador |
| Q12 | Regras para nome do clube/atletas, unicidade pública ou não, geração de nomes NPC e catálogo inicial? | Criação e UI básica |

Questões sobre CT/P2P/ligas não bloqueiam M1. Antes dessas fases: custos e ganho de CT; forma de ampliar slots; significado exato de ~1% elegível P2P (população, atributo ou filtro?); unidade/preço mínimo e arredondamento da comissão; escrow/expiração de ofertas; divisão e pontuação da liga, calendário e snapshots. Não aplicar qualquer um desses parâmetros no slice por antecipação.

**Situação após a continuação documental:** Q01–Q07 e Q10–Q12 possuem candidatos em 07, mas continuam abertos para ratificação. Q08–Q09 permanecem sem solução completa. A escolha e versão do gerador determinístico de números aleatórios também precisam ser definidas tecnicamente antes de ativar o perfil. Não confundir uma fórmula proposta com teste estatístico concluído ou autorização para implementá-la.

## Contradições aparentes, tensões e resolução provisória

| Tema | Tensão / lacuna | Tratamento rastreável |
|---|---|---|
| Histórico ausente | H1 não contém o conteúdo completo da especificação funcional | Não declarar herança de fórmulas; U1 é base; perguntas Q ficam abertas |
| “Executável” sem programar | Especificação deve permitir implementação, mas programação está vedada | Entregar contratos, invariantes, testes e gates; não gerar projeto, migração ou lógica do jogo |
| Nível ilimitado vs OVR 99 | Nível poderia ser confundido com OVR | Separar XP/nível de atributos/OVR e tetos; nível continua após saturação, fórmula Q02 |
| Regional12 vs ~1h | Número não determina duração nem XP necessário | D03 nível de clube e E02 curva; não assumir 12 jogos nem 12 pontos |
| Permanente vs escalação | Uma média de titulares poderia reduzir região após troca | Contador de clube e tabela de unlock append-only; time não governa acesso |
| Atleta só online vs partida cruzando desconexão | “Online no fim” permitiria reconectar e ganhar atleta | D10 exige cobertura integral de 90s; proposta a ratificar |
| Offline e 50% de material | Chance absoluta e metade da chance online produzem economias diferentes | D11 explicita absoluta; Q07 mantém alternativa aberta |
| 24h/10min | Não está definido se 10min acumulam nem se crédito nasce cheio | D09 define contínuo e inicial zero, sem fingir aprovação |
| CT reserva vs XP de farm | Reserva poderia evoluir sem CT antes da fase | D07 limita XP a snapshot; CT só depois |
| MMO vs vertical slice | P2P/ligas parecem centrais à visão, mas ampliariam a entrega | M1 multiusuário isolado contra NPCs; sistemas sociais/econômicos futuros preservados no backlog |
| Materiais/Coins sem gasto | Economia ainda não tem sumidouros no primeiro build | Acumular e auditar; não inventar venda/crafting para preencher a lacuna |
| Sorte moderada | Observação H1 não fornece modelo matemático | E06 e Q10 calibram influência sem peso definitivo inventado |

## Protocolo de alteração

Para cada mudança: registrar ID afetado, origem da decisão, data, status (aprovado/experimental/indefinido), valor anterior/novo, motivo, documentos e testes afetados. Não editar retroativamente ruleset de partida já iniciada nem grant liquidado. Se um valor aprovado mudar por solicitação do usuário, registrar a nova autorização e publicar nova versão de regras/documentos.

**Estado ao encerrar esta entrega:** documentação pronta para revisão; Q continuam explícitas; não há autorização de programação, nenhum código de jogo foi produzido e nenhum repositório foi presumido.
