# Eureka — app científico em áudio

Aplicativo **React Native + Expo para Android/iOS**, com API Hono/Cloudflare e Supabase. Orçamento de serviços: R$ 0. Este repositório contém a entrega inicial da **Pessoa 3 (Paulo)**; mobile e pesquisa real ainda serão integrados.

## Leia sua frente

- [Pessoa 1 — Expo, telas, sessão e player](docs/PESSOA_1_EXPO.md)
- [Pessoa 2 — pesquisa, seleção e evidências](docs/PESSOA_2_PESQUISA.md)
- [Plano completo do produto](PLANO_DO_PROJETO_EUREKA.md)
- [Operação e publicação](docs/deployment.md)
- [Recuperação, limpeza e cotas](docs/recovery-cleanup-quotas.md)

Os guias para agentes descrevem os contratos atuais. O plano contém também funcionalidades futuras; não presumir que todo endpoint planejado já existe.

## Base entregue

API publicada: `https://eureka-api.eureka-api.workers.dev/api/v1`.

Implementados: autenticação, temas, escolha do episódio, roteiro com referências/revisão, voz Kore, WAV até 180s, Storage privado, histórico, cotas atômicas, recuperação, uma tentativa corretiva e limpeza agendada. Migrations 001 e 002 aplicadas no projeto compartilhado. HTTPS e recusa de acesso anônimo verificados; 34 testes offline passaram na última validação funcional.

**Geração e aprofundamentos continuam desligados.** Não há ainda app Expo, busca real, episódio completo validado em celular ou endpoints de aprofundamento. Amostra de voz aprovada por Paulo; isso não substitui validação dos episódios completos. A auditoria por IA não certifica verdade científica.

## Desenvolver

Instale Node.js LTS compatível (ambiente validado: Node 24.22.2). O Node portátil de Paulo em `.tools` é ignorado pelo Git e **não acompanha um clone**.

```sh
npm ci
npm run typecheck
npm test
npm run dev:api
```

No Windows, se PowerShell bloquear npm.ps1, usar `npm.cmd`. Paulo pode ativar seu Node portátil com `. .\scripts\ativar-node.ps1` na raiz. npm workspaces e lockfile são compartilhados; não usar outro gerenciador ou substituir lockfile indiscriminadamente.

Para configurar backend local, copiar `apps/api/.dev.vars.example` para `.dev.vars` na mesma pasta. Preencher só no ambiente autorizado; testes offline não exigem chaves. Não versionar credenciais, tokens, áudios de teste nem `.tools`.

O Expo usa a base HTTPS da API e apenas a URL/chave publicável do Supabase, nunca Secret key ou chave Gemini. `localhost` no celular não é o computador do desenvolvedor. Rodar Metro não publica o backend.

## Organização

- `apps/api`: backend da Pessoa 3 e futura pesquisa da Pessoa 2.
- `apps/mobile`: será criado pela Pessoa 1.
- `packages/contracts`: schemas e tipos compartilhados.
- `supabase/migrations`: SQL versionado; não reaplicar no projeto compartilhado nem editar migration já aplicada.
- `scripts`: ativação local do Node, smoke de conexão Supabase e configuração de segredos Cloudflare. Operações reais não são testes automáticos.

## Branches e integração

1. Paulo publica código e os dois guias **juntos na branch da Pessoa 3**. Fazer revisão antes do merge.
2. Preferencialmente integrar essa base à `master`; as Pessoas 1 e 2 criam suas branches a partir dela (`feat/pessoa-1-mobile`, `feat/pessoa-2-pesquisa`). Merge de código não habilita geração nem equivale à conclusão do produto.
3. Se a master não puder receber a base ainda, criar branches a partir da branch/commit da Pessoa 3. Informar a base no PR; Paulo coordena a integração posterior. Não copiar só os Markdown e trabalhar sobre código incompatível.
4. API publicada é independente de qual branch cada integrante abriu. Checkout não faz deploy e merge na master também não faz deploy automaticamente: não há workflow de publicação configurado. A API só reflete o último código efetivamente publicado.
5. Mudanças em contratos, raiz, lockfile e migrations devem ser combinadas. Cada agente entrega sua branch/PR e testes; Paulo faz merge e valida o fluxo completo.

Antes de subir: revisar `git status`/diff e confirmar que `.dev.vars`, `.env`, `node_modules`, `.tools` e arquivos privados não foram incluídos. Não fazer force push nem apagar trabalho remoto para resolver divergências.
