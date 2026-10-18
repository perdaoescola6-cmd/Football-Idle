# Desenvolvimento recorrente

## Infraestrutura ativa

Codex Automation no mesmo chat, com a sessão ChatGPT já autenticada e a conexão GitHub existente. Agenda: de duas em duas horas, das 8h às 22h, America/Sao_Paulo. Uma tarefa por execução e até três PRs independentes aguardando revisão. Não é necessário fornecer uma chave OpenAI para essa modalidade local.

O procedimento executável de seleção está em scripts/agent-plan.mjs; a política em .automation/policy.json e o prompt durável em .automation/WORKER.md. scripts/agent-snapshot.mjs coleta o backlog público com paginação e sem token; a integração GitHub autenticada continua disponível para commits, issues e PRs. scripts/agent-progress.mjs registra o resultado apenas na branch automation/state. Os testes de fila/progresso entram na suíte normal e a CI valida a política.

Um PR aguardando revisão não paralisa tarefas independentes. A fila ignora tarefas já cobertas, dependências pendentes, issues sem agent:ready e conteúdo de autores externos. O agente toma decisões técnicas, corrige testes e abre PRs; revisão/integração de funcionalidades continuam humanas. Não há auto-merge ou deploy.

## Retomada e teste inicial

O progresso é versionado na branch automation/state, em AUTONOMOUS_PROGRESS.md e .automation/progress.json, com um JSON por execução em .automation/runs/. O worker publica uma claim antes de implementar e um resultado depois. Push comum e atualização do mesmo runId evitam sobrescrever progresso concorrente. A branch de estado nunca é integrada à main.

O teste inicial usa a coleta real do GitHub, seleção determinística, gravação remota da claim, branch separada, implementação, testes e PR. Seu resultado concreto fica no registro canônico. Esse teste manual exercita o mesmo procedimento da agenda; não equivale a observar o primeiro disparo futuro do agendador.

## Permissões verificadas

Na inspeção, a conta conectada tem admin/push no repositório; envio de branches e criação de PRs já funcionam. Actions está habilitado. GITHUB_TOKEN tem leitura por padrão e não pode aprovar PRs; isso é suficiente para a CI, pois quem cria PRs é o worker autenticado local. Não ampliamos o token de CI nem disponibilizamos credenciais de escrita para código de forks.

Foi aplicada e conferida a restrição de Actions a componentes de propriedade do GitHub, preservando checkout e setup-node usados pela CI. Actions verificadas de terceiros e padrões adicionais não foram liberados. Os rótulos agent:ready, agent:blocked, agent:in-progress, prioridades e áreas foram criados no repositório, e o backlog restante recebeu a classificação correspondente, incluindo a melhoria visual #13.

A main exige uma aprovação, checks Linux/Windows com branch atualizada e conversas resolvidas; force push e exclusão estão bloqueados. O proprietário administrador tem bypass manual; o worker não o usa para integrar funcionalidades. Auto-merge permanece desativado.

Só o proprietário/admin pode conceder ou renovar permissões da conta/app, autorização de rede/arquivos em um ambiente gerenciado, acesso a outros repositórios, limites/plano e credenciais para um eventual agente hospedado no GitHub Actions. Não criamos nem solicitamos credencial porque o fluxo local já está autenticado. Se a política da conta negar um comando, o agente registra o bloqueio sem desativar proteções.

## Disponibilidade

O computador precisa estar ligado e o aplicativo em execução para usar arquivos locais; acesso GitHub e limites da conta também precisam estar disponíveis. Sem essas condições, não há promessa de execução contínua. Para rodar o agente em runners do GitHub sem depender do computador, seria necessário o proprietário configurar uma chave de API e suas políticas de custo/acesso; isso não faz parte da ativação local.

Referências oficiais: [tarefas agendadas](https://learn.chatgpt.com/docs/automations?surface=app), [permissões](https://learn.chatgpt.com/docs/permissions) e [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action).
