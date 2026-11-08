# Eureka — ciência em áudio

App Android/iOS em React Native + Expo, com API Hono/Cloudflare Workers, Supabase e Gemini. Os seis temas são Espaço, Saúde, Cérebro, Tecnologia, Natureza e Física.

## Executar e testar

Node.js 22 ou superior (ambiente local validado com Node 24). Na raiz:

```sh
npm ci
npm run typecheck
npm test
npm run dev:mobile
```

No PowerShell, use `npm.cmd` se a política bloquear `npm.ps1`. Para o Node portátil deste computador: `. .\scripts\ativar-node.ps1`.

Copie `apps/mobile/.env.example` para `.env` e configure somente API HTTPS, URL Supabase e chave publicável. No backend, use `apps/api/.dev.vars.example` como referência. Nunca copie a chave de serviço ou Gemini para o app.

## Fluxo

Login → tema → busca em fontes científicas → extração e revisão automatizada das evidências → até três opções → escolha → roteiro auditado → áudio de até 180 segundos → ficha, transcrição e histórico.

Não há notícias pré-cadastradas nem mocks como fallback. A busca pode retornar menos de três opções ou nenhuma se as evidências forem insuficientes. Revisão automatizada não equivale a revisão por pares. Preprints são identificados e excluídos de Saúde/Cérebro.

## Documentação mantida

- [Plano e critérios de aceite](PLANO_DO_PROJETO_EUREKA.md)
- [Busca, evidências e contratos](docs/research-integration.md)
- [Publicação, cotas e recuperação](docs/deployment.md)
- [Executar o app e testar no Android](apps/mobile/README.md)
- [Roteiro de validação manual](docs/manual-qa.md)

## Limites atuais

Aprofundamentos ainda estão desativados. Testes automáticos e exportação de bundles não comprovam reprodução, acessibilidade ou qualidade da voz em aparelho real. Expo Go com Metro é o caminho de desenvolvimento; ainda não há APK independente nem publicação nas lojas. A API é online e não depende do computador.

## Organização

`apps/api`: API; `apps/mobile`: aplicativo; `packages/contracts`: validação compartilhada; `src`: pesquisa/evidências; `supabase/migrations`: SQL progressivo; `test` e testes dos workspaces: regressões. `.tools` contém ferramentas e artefatos locais ignorados pelo Git.
