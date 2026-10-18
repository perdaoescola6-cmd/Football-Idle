# GitHub e rotina do agente

Atualização: o procedimento recorrente vigente está em [.automation/WORKER.md](../.automation/WORKER.md), com configuração e limites em [desenvolvimento autônomo](24-autonomous-development.md). Ele substitui os limites antigos de um único PR e a agenda diária descritos no registro histórico abaixo: agora até três tarefas independentes podem aguardar revisão, com progresso na branch automation/state. As restrições de produção, segredos, force push e merge automático continuam válidas.

## Origem e integração

Inspeção em 17/10/2026: conexão GitHub com acesso admin/push; repositório público contendo somente README.md na main, commit 69766d5275e94bd82889b522df728863c60e4079. Código atual encontrado no espelho local FutIdle: apps/, packages/, scripts/, tests/, docs/ e lockfile npm. A pasta sources/ estava sem arquivos e não foi alterada. Não havia Git no espelho.

A cópia isolada github-football-idle usa a história existente e a branch codex/import-work-project. O título original do README é preservado e o README completo do Work foi copiado para docs/WORK-PROJECT.md. Bancos, caches, dependências instaladas, arquivos de ambiente, temporários e saídas de build foram excluídos. Código e assets de execução foram preservados; ajustes de estilo não mudam comportamento. Até a integração humana do PR, a main ainda contém apenas o conteúdo anterior.

## Ciclo por issue

1. Buscar issues abertas e PRs existentes. Selecionar a issue prioritária com critérios claros, sem dependências pendentes ou PR em revisão. Manter no máximo um PR autônomo pendente para evitar branches acumuladas.
2. Verificar permissões e árvore limpa. Atualizar origin/main sem resetar trabalho local. Criar checkout/worktree isolado e branch codex/NUMERO-resumo a partir de origin/main. Não modificar este espelho do Work como se fosse o checkout Git.
3. Ler AGENTS.md, instruções aninhadas e os contratos afetados. Implementar somente a issue e testes de comportamento necessários, preservando saves, transações e idempotência.
4. Executar npm ci, npm run lint, npm run typecheck, npm test e npm run build:check. Para mudanças de tela, verificar o fluxo relevante em navegador e celular quando disponível. Não esconder falhas.
5. Inspecionar o diff e os arquivos staged para segredos, dados locais e mudanças alheias. Commit e push apenas da branch. Abrir PR para main com Closes #NUMERO, critérios, resultados e riscos. Nenhum auto-merge, force push ou deploy de produção.
6. Aguardar revisão humana e CI. Corrigir no mesmo PR quando autorizado. Só iniciar outra issue após resolver ou integrar o PR pendente. Em bloqueio, registrar exatamente acesso/comando/etapa necessária sem incluir segredos.

## CI e proteção

CI valida estilo (Prettier), tipos, testes de jogo/API/persistência e build Next.js em Node 22 no Linux e Windows. O PostgreSQL embutido atende os testes; não há banco de produção nem segredo necessário. Não se usa pull_request_target nem execução de agente com secrets em código de forks.

Proteção aplicada e confirmada via API em 17/10/2026: PR obrigatório, uma aprovação, checks validate (ubuntu-latest) e validate (windows-latest) com branch atualizada, conversas resolvidas, force push e deleção proibidos. A conta administradora mantém bypass manual, pois o proprietário é também o autor dos PRs e não pode aprovar o próprio PR. O agente não usa esse bypass para integrar mudanças. Auto-merge permanece desativado. A integração GitHub devolveu 403 ao consultar proteção; a credencial Git já configurada permitiu aplicar a regra via API, sem imprimir ou salvar o segredo.

Verificação local da importação: npm ci, lint, tipos, 51/51 testes e build aprovados. No sandbox Windows, um teste de reabertura PGlite abortou; repetição com acesso local normal passou integralmente. A primeira CI Linux passou; o Windows revelou conversão CRLF pelo checkout, corrigida com .gitattributes para LF. Capturas importadas são históricas; não houve novo QA de navegador nesta integração.

## Acompanhamento periódico

Rotina criada no aplicativo, ID football-idle-acompanhamento-di-rio: uma verificação diária às 10h de São Paulo neste chat. Inspecionar o PR de integração e seu CI; depois da integração, selecionar no máximo uma issue seguindo o ciclo acima. Sem iniciar outra enquanto houver PR autônomo aguardando revisão. Notificar apenas mudança significativa, conclusão, falha ou ação humana necessária; ficar em silêncio quando o estado não mudar. A rotina só foi cadastrada; sua primeira execução ainda não foi observada.

A execução depende de agenda habilitada, computador ligado, aplicativo em execução, acesso aos arquivos/GitHub e limites da conta. Não equivale a operação contínua 24/7. Uma agenda só está ativa após confirmação da ferramenta do aplicativo; não há cron de agente no GitHub Actions nem uso automático de chaves de API.

Referência: https://learn.chatgpt.com/docs/automations?surface=app
