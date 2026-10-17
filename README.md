# Football-Idle

Football Card Manager: futebol automático 11v11 com cartas Bronze, Prata, Ouro, Lendário e Fenômeno, packs de cinco cartas e campanha nas Séries D/C/B/A. Este repositório é a fonte central do código após a revisão e integração do PR de importação do Work.

## Desenvolvimento local

Node.js 22+ e npm. Execute `npm ci` e `npm run dev`. Abra http://127.0.0.1:3000; API em 3101. Sem `DATABASE_URL`, o banco PostgreSQL embutido fica em `.data/postgres`. Não apague essa pasta para atualizar. `.env.example` contém apenas exemplos; arquivos de ambiente e dados locais não entram no Git.

## Verificação

Execute `npm run lint`, `npm run typecheck`, `npm test` e `npm run build:check`. Lint verifica estilo com Prettier; TypeScript verifica tipos. GitHub Actions executa essas verificações em Linux e Windows, sem credenciais de produção.

## Estado e contribuição

O catálogo importado tem 844 identidades e 854 edições históricas; ratings e odds são regras experimentais. A campanha é individual contra AI em regulamento compacto, sem reproduzir integralmente os campeonatos da CBF. Não há pagamentos reais implementados.

- [Registro completo preservado do Work](docs/WORK-PROJECT.md)
- [Fluxo de issues, branches e revisão](docs/18-github-agent-workflow.md)
- [Backlog e critérios de aceitação](docs/19-github-backlog.md)

`main` recebe mudanças por PR revisado; cada issue usa uma branch `codex/<numero>-<resumo>`. Não há auto-merge nem deploy de produção neste fluxo. O título original deste README foi preservado; o histórico original da `main` é a base da importação.
