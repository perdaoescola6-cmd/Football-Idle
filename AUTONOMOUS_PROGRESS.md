# Progresso do desenvolvimento autônomo

O registro canônico de execuções fica na [branch automation/state](https://github.com/perdaoescola6-cmd/Football-Idle/blob/automation/state/AUTONOMOUS_PROGRESS.md), para não exigir commits diretos na main ou um merge só para atualizar progresso.

Essa branch contém .automation/progress.json, os relatórios .automation/runs/ e o histórico legível. As branches de funcionalidades e seus PRs continuam separados. O worker lê o registro remoto a cada execução e não interpreta a ausência de mudanças na main como ausência de progresso.

Procedimento: [.automation/WORKER.md](.automation/WORKER.md). Configuração: [.automation/policy.json](.automation/policy.json).
