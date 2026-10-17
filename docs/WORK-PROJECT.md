# FutIdle — Football Card Manager V2

Pivot implementado no projeto existente com Next.js, Fastify, PostgreSQL/PGlite, sessão local, worker, ledger e idempotência reaproveitados. Desenvolvimento local, sem publicação comercial.

## Rodar a versão atual

Node.js 22+. No PowerShell, nesta pasta:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abra [http://127.0.0.1:3000](http://127.0.0.1:3000). API na porta 3101; worker junto da API. O banco `.data/postgres` é persistente: não o remova para atualizar e não execute duas APIs sobre a mesma pasta.

## Atualização atual — campanha e ferramentas do treinador

Rodadas com quatro confrontos simultâneos, pausa global da campanha individual, até cinco substituições pelo mesmo setor e súmula com estatísticas, escalações, condição e notas. Campo tático estático opcional; animação de jogadores retirada. Negociações foram retiradas da navegação ativa em favor dos packs. Os parágrafos V2 abaixo registram a base anterior; esta atualização e os documentos 15–17 prevalecem onde houver diferenças.

Packs agora permitem foco por setor, com odds e exceções visíveis. Fichas mostram arquétipos derivados dos atributos. Na pausa, o assistente opcional sugere trocas e exige confirmação manual. **51 testes passaram**, TypeScript e build de produção aprovados. Veja [perfis, packs e assistente](docs/17-perfis-packs-assistente.md), [súmula e pós-jogo](docs/16-sumula-pos-jogo.md) e [rodada do treinador](docs/15-rodada-treinador.md), incluindo regras experimentais e provas visuais novas.

## Ciclo jogável — base V2

Crie o clube ou ative o modo 11v11 no clube existente. Receba onze titulares aptos em 4-4-2, 10.000 Coins iniciais uma única vez e um pack de boas-vindas de cinco cartas, também único. Compre os cinco tipos de packs exclusivamente com Coins do jogo; confira odds e garantias na loja. Monte onze jogadores distintos e até sete reservas, escolha formação/tática e dispute a próxima rodada oficial. A simulação automática dura 90 segundos reais, com campo 2D, resultado e recompensa no servidor. A coleção tem filtros, duplicatas, proteção, organizador e revisão manual da venda em lote ao NPC.

São quatro divisões D→C→B→A com clubes reais de 2024 e regulamento próprio **BR-2024-compact-v1**: seu clube + sete clubes AI, 14 rodadas em turno/returno; dois primeiros sobem e dois últimos descem. O formato compacto é identificado na tela e não reproduz o regulamento integral da CBF. Os AI são identificados e usam elencos sintéticos, sem fingir contas humanas ou escalações oficiais.

O catálogo V2 tem **844 jogadores distintos e 854 edições fixas**: 831 registros da lista oficial do Mundial de 2022 e as 23 edições brasileiras anteriores, com dez identidades compartilhadas entre edições. Fichas mostram biografia, fonte, ano do clube de referência, atributos por função, comparação e desempenho real no jogo. Clubes históricos não representam os elencos atuais. Ratings são balanceamento experimental; cada carta admite até três treinos pagos em Coins. Os retratos ilustrados são originais, sem fotos ou escudos reais. Nenhuma compra de moeda premium ou pagamento real está implementado.

O saldo, XP, atletas e histórico antigos são preservados. Uma partida antiga termina normalmente antes da ativação. Depois, farm/treino/comandos antigos ficam arquivados, anúncios antigos são cancelados e reservas de Coins liberadas. A V2 acrescenta mercado P2P próprio para as cartas novas, com preços livres, comissão de 15%, proteção dos atletas e transferência transacional. O mercado legado continua arquivado.

As oito telas incluem campeonato, elenco, packs, coleção/depósito, catálogo, rankings, mercado e histórico. O motor V2 gera passes, conduções, chutes, defesas de goleiro, gols e assistências; seus eventos alimentam os sprites de uniforme, a bola, a narração e as estatísticas. Há pré/pós-jogo, calendário consultável, temporadas encerradas, premiações, capitão com efeito e sugestão de escalação. Os rankings separam desempenho em partidas de qualidade das cartas e consideram somente contas reais desta instalação.

## Verificar a versão atual

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:check
```

`build:check` usa `.next-check`, sem disputar a saída do servidor de desenvolvimento. `npm.cmd run build` gera a saída padrão para `npm.cmd run start:web`; a API também precisa estar ativa. No Windows, o teste de reabertura do banco temporário precisa de acesso local normal: alguns isolamentos bloqueiam o filesystem WASM do PGlite.

Validação V2: **41 testes passaram**, incluindo persistência, distribuição dos packs, motor, temporadas e concorrência/rollback das transferências; TypeScript e build de produção passaram. O navegador foi exercitado em desktop e celular, com provas antes/depois.

Veja [a auditoria e entrega V2](docs/15-v2-auditoria-expansao.md) para arquivos, fontes, fórmulas, cobertura de testes, capturas e limitações. O [registro do primeiro pivot](docs/14-brasfoot-pivot.md) permanece como histórico. Limites atuais: sessão anônima em cookie, temporadas individuais compactas contra AI, ausência de substituições durante a partida e de regulamentos integrais da CBF. JSONB/mutex global ainda não foram validados em carga MMO pública. Não houve deploy nem publicação comercial; direitos continuam pendentes.

<details>
<summary>Registro histórico da versão Retro E2 (anterior ao pivot)</summary>

## Football Idle MMO — Retro E2 — alpha local

Browser game em português, com Next.js/TypeScript, API Fastify e PostgreSQL. Regras experimentais **RETRO-E2**, baseadas no [perfil documental M1-E0](docs/07-perfil-experimental-prototipo.md). Esta versão é local e não foi publicada.

## Jogar no ambiente atual

Com o processo de desenvolvimento rodando, abra **[http://127.0.0.1:3000](http://127.0.0.1:3000)**. Use esse endereço exato: a API valida a origem das ações.

A atualização E2 acrescenta pixel art original, organização automática gratuita, proteção, venda em lote transacional, depósito de atletas, CT pausável e reserva de Coins nas ofertas. Veja o [registro E2](docs/13-retro-e2.md) para contratos, parâmetros e limites de verificação. QA visual E2 está pendente por bloqueio da ferramenta de navegador; as capturas E1 são históricas.

Consulte o [guia de como jogar](docs/11-como-jogar.md) e o [registro técnico e parâmetros do alpha E1](docs/10-alpha-e1.md).

Crie o clube, confira os cinco atletas e clique em **Iniciar farm**. Cada partida dura 90 segundos reais. Ao terminar, o servidor confirma XP, Coins e possíveis drops, e o histórico permite rever a partida. Alterações de escalação valem para a próxima partida. **Parar após esta partida** encerra a sequência, preservando a recompensa da partida atual.

## Iniciar novamente

Requisito do projeto: Node.js 22 ou superior. Neste ambiente, validado com Node.js 24.14.0.

No PowerShell, dentro desta pasta:

```powershell
npm.cmd ci
npm.cmd run dev
```

As dependências já estão instaladas neste ambiente; para continuar aqui basta `npm.cmd run dev` se o servidor não estiver ativo. O comando inicia frontend na porta 3000 e API na 3101, ambos em `127.0.0.1`. O worker local roda junto da API. Encerrar com Ctrl+C.

Na primeira execução, o banco e a migrações são criados automaticamente em `.data/postgres`. Nas seguintes, os dados são reutilizados. Não abrir dois processos de API usando a mesma pasta do banco embarcado. Não editar/remover essa pasta enquanto o servidor estiver rodando.

O login deste primeiro protótipo é uma **sessão anônima local**, em cookie HttpOnly, válida por 30 dias. O clube pertence à conta criada no servidor, mas o navegador precisa manter o cookie para acessá-la. Ainda não há recuperação de conta, senha, login em outro dispositivo ou troca de clube na interface. Navegadores/perfis diferentes criam contas diferentes. Isso é uma limitação explícita da versão local.

## PostgreSQL externo e worker separado

O desenvolvimento usa [PGlite](https://pglite.dev/docs/api), PostgreSQL embarcado com persistência em arquivo. Para testar a arquitetura com um servidor PostgreSQL convencional, crie um banco vazio e configure `.env.local` a partir de `.env.example`:

```dotenv
APP_ORIGIN=http://127.0.0.1:3000
DATABASE_URL=postgresql://USUARIO:SENHA@127.0.0.1:5432/football_idle
EXTERNAL_WORKER=1
```

Inicie `npm.cmd run dev` para criar o esquema e levantar a API. Depois, em outro terminal na mesma pasta, execute `npm.cmd run worker`. Sem `DATABASE_URL`, o worker separado é recusado; o PGlite mantém um único processo dono do banco. A limitação está descrita na [documentação do PGlite](https://pglite.dev/docs/pglite-socket).

Mudar a conexão **não migra automaticamente os dados locais** para o banco externo. O adaptador externo está implementado, mas não foi exercitado contra um serviço PostgreSQL de rede neste ambiente, onde não havia serviço instalado. Não há deploy nem provisionamento de conta externa.

## Verificar

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Os testes automatizados usam PostgreSQL embarcado em memória, sem alterar o clube jogado no navegador. A suíte pode controlar relógio e seeds. O **God mode local**, solicitado posteriormente, permite acelerar o relógio do próprio clube, sem definir saldo/XP/raridade diretamente; sua rota fica ausente em produção.

Verificação atual: **20 testes passando**, checagem de tipos e build concluídos; criação, escalação, partidas, recompensas, replay, persistência e God mode conferidos no browser. O navegador usado na demonstração possui o clube de teste **União da Vila**, que pode ser usado para experimentar.

## God mode e novo visual

O cabeçalho tem o botão **God mode**, com Normal (1×), 10× e 60×. Inicie o farm para ver partidas a cada 9s ou 1,5s reais, respectivamente. Voltar a Normal conserva os ganhos. A velocidade persiste e também vale para o offline; clubes/partidas usados em teste ficam identificados.

Disponível somente no ambiente local com banco embarcado, fora de `production`. Pode ocultar os controles com `ENABLE_GOD_MODE=0` em `.env.local`; volte a Normal antes. Essa configuração não apaga nem converte progresso de teste. Detalhes em [Visual e God mode](docs/09-visual-e-god-mode.md).

## O que já funciona

- Clube com cinco atletas e escalação manual versionada.
- Farm 5v5 de 90s, transmissão animada, placar ao vivo e replay pelos mesmos eventos.
- Seis atributos, tetos individuais, XP e nível sem teto de jogo, OVR até 99.
- Coins, livro-razão imutável, concessões transacionais e repetição segura de comandos.
- Chance experimental de atleta por partida online; distribuição P1–P5 aprovada preservada por drop.
- Coleção, Depósito e histórico recente.
- Presença por heartbeat, renovação offline após 10min contínuos, até 24h de crédito, fatores de 50% e nenhum atleta offline.
- Progresso permanente do clube, com Regional no 40º jogo integral online do perfil atual.

O alpha E1 acrescenta mapa das sete regiões, cartas clicáveis com retratos próprios, olheiro, venda ao NPC, treino de reservas, temporadas com sorteio de clubes por divisão e NPCs de alternativa e P2P entre contas da instalação local. Custos novos são experimentais; clubes que usaram God mode ficam fora do P2P. A versão não está pronta para exposição pública: faltam autenticação recuperável, políticas de retenção e operação, controle distribuído de tráfego e validação de carga/balanceamento.

## Organização

| Caminho | Responsabilidade |
|---|---|
| `apps/web` | Interface Next.js, sem autoridade sobre recompensas |
| `apps/server/src` | API, autenticação local, repositório e worker |
| `apps/server/migrations` | Esquema SQL aplicado no banco |
| `packages/game` | Regras, RNG determinístico e máquina de execução |
| `packages/contracts` | Tipos compartilhados, sem segredos de servidor |
| `tests` | Testes de regras, tempo, transações, isolamento e API |
| `docs` | Especificação, parâmetros e registro da implementação |

Consulte [o registro da primeira implementação](docs/08-primeira-implementacao.md) para diferenças em relação ao contrato documental completo e limites das verificações. `sources/` permanece somente leitura e não foi modificado.

Para verificar a compilação sem disputar os arquivos do servidor de desenvolvimento ativo, use `npm.cmd run build:check`. O resultado fica em `apps/web/.next-check`; `npm.cmd run build` continua produzindo a saída normal para `npm.cmd run start:web`.

</details>

## Atualização — central de rodada pausável

A experiência ativa agora acompanha os quatro jogos do campeonato por placares e súmula, sem animação de atletas. Clique num confronto para detalhar. Pause a rodada para trocar até cinco jogadores pelo mesmo setor; o banco precisa estar definido antes. O cansaço é só da partida e volta a 100% no jogo seguinte. A campanha é individual contra clubes controlados pelo jogo.

Packs continuam como fonte de reforços com os preços/odds publicados. Novas negociações ficam desativadas após a primeira rodada no modo novo; anúncios anteriores podem ser cancelados. Consulte [regras, testes e sugestões](docs/15-rodada-treinador.md). Recarregue a aba após a atualização para montar a interface nova.

## Súmula e pós-jogo

A referência Treineiros orienta a nova apresentação: placar compacto, barras de estatísticas, narração clicável, notas e melhor em campo, escalações com entradas/saídas e campo tático estático opcional. Súmula continua como padrão. [Registro da entrega e verificação](docs/16-sumula-pos-jogo.md). Nenhuma probabilidade de pack ou recompensa foi alterada nesta etapa.
