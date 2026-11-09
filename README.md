# Eureka — ciência em áudio

Aplicativo Android/iOS que transforma estudos científicos em episódios de áudio em português, com fontes, transcrição e ficha de evidências. Temas: Espaço, Saúde, Cérebro, Tecnologia, Natureza e Física.

## Tecnologias

- Aplicativo: React Native, Expo SDK 58 e expo-audio.
- API: Hono e Cloudflare Workers.
- Autenticação, banco e arquivos privados: Supabase.
- Preparação de evidências, roteiro e voz: Gemini.
- Fontes científicas: Europe PMC, arXiv, NASA NTRS e OpenAlex.

## Executar o aplicativo

Use Node.js 24 ou superior e npm. Na raiz do projeto:

```sh
npm ci
```

Copie `apps/mobile/.env.example` para `apps/mobile/.env` e preencha:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://sua-api.example/api/v1
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
```

O exemplo já aponta para a API do piloto. Usando essa API, não é necessário iniciar o backend local.

```sh
npm run dev:mobile
```

Abra o projeto no Expo Go compatível com SDK 58 pelo QR code do terminal. Celular e computador devem estar na mesma rede. Entre com uma conta do Supabase Authentication; a conta administrativa do painel não serve como login do aplicativo. O piloto usa contas por convite.

No PowerShell, use `npm.cmd` se a política bloquear `npm.ps1`. Se o Node portátil já estiver em `.tools`, ative-o com `. .\scripts\ativar-node.ps1`.

### Áudio no Expo Go

Mantenha o aplicativo aberto durante a reprodução. No Expo Go, o player desativa o modo de segundo plano e os controles da tela bloqueada para evitar a falha de ativação do serviço nativo.

Esses recursos ficam habilitados nos builds nativos, com `enableBackgroundPlayback: true` em `apps/mobile/app.json`. Alterar a configuração nativa exige gerar e instalar um novo build.

## Backend local

Copie `apps/api/.dev.vars.example` para `apps/api/.dev.vars`. Configure as credenciais do Supabase e, para usar geração, a chave e os modelos Gemini. Chaves de serviço e de IA pertencem somente ao backend.

Em um banco novo, aplique os arquivos de `supabase/migrations` uma vez, na ordem dos nomes. Não reaplique migrations já executadas.

```sh
npm run dev:api
```

Ajuste a URL do aplicativo para um endpoint HTTPS acessível pelo celular. `localhost` no celular aponta para o próprio aparelho.

Flags de configuração:

- `LIVE_AI_ENABLED`: permite novas gerações.
- `AUTO_RESEARCH_ENABLED`: permite preparar descobertas automaticamente.
- `FOLLOWUPS_ENABLED`: controla aprofundamentos.

A busca automatizada exige as duas primeiras flags ativas e os modelos configurados. O exemplo local mantém a geração desativada. Confira também as flags em `apps/api/wrangler.jsonc` antes de publicar.

## Uso

1. Entre, escolha um tema e toque em **Buscar descobertas**.
2. Confira fontes, datas e resumos; escolha uma descoberta ou use **Me surpreenda**.
3. Gere o roteiro e, depois, o áudio. Essas etapas exigem ações explícitas.
4. Ouça e consulte a ficha de evidências e a transcrição. O histórico registra a escuta ao terminar a reprodução.
5. Use **Baixar áudio** para exportar o WAV: escolha uma pasta no Android ou Salvar em Arquivos no iOS.

A busca retorna até três opções e pode retornar menos quando não há evidências suficientes. Preprints são excluídos de Saúde e Cérebro. Revisão por IA não equivale a revisão por pares nem certifica a verdade científica.

Se a conexão cair, use **Atualizar estado** ou **Recuperar resultado preservado**. Recuperar e renovar acesso ao áudio não geram novo conteúdo. Uma tentativa corretiva só é preparada quando o servidor permite e exige tocar novamente em Gerar.

Os áudios têm até 180 segundos e retenção de sete dias no servidor. Após a expiração, a transcrição e o histórico permanecem disponíveis; cópias exportadas ficam no aparelho. Baixar um arquivo não registra uma nova escuta.

## Verificação

```sh
npm run typecheck
npm test
```

Os testes cobrem pesquisa, contratos, API, banco local com PGlite, fluxo mobile, download e componentes. As integrações externas são simuladas nos testes automatizados.

Para exportar os bundles Android e iOS:

```sh
npm exec --workspace @eureka/mobile -- expo export --platform android --platform ios
```

A exportação não gera APK/IPA. Valide em aparelhos reais a reprodução, download, interrupções, acessibilidade e, em builds nativos, áudio em segundo plano e controles da tela bloqueada.

## Publicar a API

Depois de validar os testes, as migrations e os segredos do ambiente Cloudflare:

```sh
npm run deploy --workspace @eureka/api
```

Confira `/api/v1/health` e `/api/v1/capabilities` após a publicação. Não habilite faturamento ou eleve cotas para contornar falhas. Desativar `LIVE_AI_ENABLED` interrompe novas gerações, preservando consulta e recuperação.

## Estrutura

- `apps/mobile`: aplicativo Expo e testes da interface.
- `apps/api`: API, integrações e testes do backend.
- `packages/contracts`: schemas e validação compartilhada.
- `src`: pesquisa, seleção e evidências científicas.
- `supabase/migrations`: evolução do banco de dados.
- `test`: testes de pesquisa e integração.
- `scripts`: utilitários de desenvolvimento e operação.
- `.tools`: ferramentas e artefatos locais, ignorados pelo Git.

Arquivos `.env` e `.dev.vars` preenchidos não devem ser versionados. Os arquivos `.example` contêm apenas modelos de configuração. Aprofundamentos e distribuição nas lojas ainda não fazem parte do fluxo entregue.
