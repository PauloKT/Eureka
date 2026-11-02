# Pessoa 1 — guia de implementação para o agente de IA

Estado verificado em 02/11/2026. Responsável por integrar as entregas: **Paulo (Pessoa 3)**.

## 1. Leia antes de editar

Leia este arquivo inteiro, `../PLANO_DO_PROJETO_EUREKA.md`, `../README.md`, `../packages/contracts/src/index.ts` e as rotas em `../apps/api/src/modules/episodes/routes.ts`. O plano descreve o produto completo; este guia distingue o que já existe do que falta. O código atual é a referência de comportamento HTTP. Se houver divergência, documente e coordene com Paulo em vez de mudar silenciosamente um contrato.

Você implementará **um app mobile React Native + Expo + TypeScript para Android e iPhone**, em `apps/mobile`. Não criar site, PWA ou WebView como substituto. Não reconstruir a API existente nem integrar Gemini diretamente no celular.

Crie uma branch de trabalho a partir da base que contém a entrega da Pessoa 3. Se ela já estiver na master, use a master atualizada. Se não, use a branch/commit da Pessoa 3 como base e informe isso no PR. Não misture um contrato antigo da master com backend novo. Não fazer deploy no Worker compartilhado por conta própria; Paulo fará a integração.

## 2. O que Paulo já entregou

- Monorepo npm workspaces, Node/TypeScript, lockfile e testes.
- API Hono em Cloudflare Workers, HTTPS funcionando.
- Autenticação: valida o access_token com Supabase Auth; não confia em userId enviado pelo cliente.
- Seis temas fixos: `space` Espaço, `health` Saúde, `brain` Cérebro, `technology` Tecnologia, `nature` Natureza, `physics` Física.
- Contratos Zod em `@eureka/contracts`: ThemeId, Source, Discovery, SelectionInput, EpisodeChoice, ScriptCandidate, EvidenceCard, Audit e ApprovedScript.
- SQL de seleção/episódios/operações/histórico/cotas, bucket privado e arquivo de tentativas. Migrations 001 e 002 já aplicadas no projeto compartilhado; **não reaplicar**.
- Escolha explícita/surpresa apenas entre opções salvas; criação sem IA; idempotência.
- Pipeline implementado: roteiro → integridade de referências → revisão semântica → áudio → WAV validado → Storage privado.
- Texto `gemini-3.1-flash-lite`; voz `gemini-3.1-flash-tts-preview`, **Kore**. Paulo aprovou uma amostra de 30,04 s. Isso não substitui avaliação de episódios completos.
- Áudio até 180 s, URLs assinadas de cinco minutos, expiração em sete dias.
- Recuperação de checkpoints sem chamar IA; uma tentativa corretiva para falhas determinadas; cron de limpeza diário às 05:00 UTC, preservando roteiro/histórico.
- Budgets internos compartilhados: texto 100/24h e 10/60s; voz 8/24h e 2/60s. Roteiro reserva duas chamadas de texto; voz uma. Tentativa anterior continua contando.
- TypeScript, 34 testes offline e build Worker passaram. Endpoints públicos verificados online; rotas privadas negaram acesso anônimo.

**Não está pronto:** app Expo, busca real (Pessoa 2), login real no celular, episódio completo com fontes reais, teste de recuperação/remoção de arquivo real no ambiente publicado e aprofundamentos. **Geração e aprofundamentos estão desativados** no Worker. Não confundir código implementado com fluxo real aprovado.

## 3. Configuração mobile

Base publicada: `https://eureka-api.eureka-api.workers.dev/api/v1`.

Variáveis públicas propostas para `apps/mobile/.env` (versionar somente `.env.example` com placeholders):

```text
EXPO_PUBLIC_API_BASE_URL=https://eureka-api.eureka-api.workers.dev/api/v1
EXPO_PUBLIC_SUPABASE_URL=<URL do projeto compartilhado>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave publicável>
```

Peça a Paulo URL e chave **publicável**, fornecidas pelo canal acordado pelo grupo. Elas não são a Secret key. Não copiar `apps/api/.dev.vars`, chave Gemini ou service_role para o Expo, screenshots, logs ou Git. Valores EXPO_PUBLIC fazem parte do bundle e não guardam segredos.

Use Supabase Auth com armazenamento de sessão apropriado ao React Native, renovação e logout, coordenando com Paulo o fluxo de contas do piloto. Não criar usuários/policies em produção sem combinar. Uma chave publicável sozinha não autentica um usuário.

Bibliotecas previstas: Expo Router, expo-audio, componentes nativos/StyleSheet, safe areas, Linking para referências HTTPS e armazenamento seguro de sessão. Escolher Expo SDK estável e compatível com os celulares do grupo, fixando versões; instalar módulos Expo com `npx expo install`. Não instalar versões arbitrárias de React Native separadamente do SDK.

Expo Go serve ao desenvolvimento. Recursos como áudio com tela bloqueada precisam de teste em build nativo compatível. Não declarar aplicativo independente concluído apenas porque roda no Expo Go conectado ao Metro. Publicação nas lojas depende de contas/distribuição, não está resolvida pelo backend gratuito.

## 4. Fluxo obrigatório, em ordem de implementação

1. Base Expo, navegação e login; seis temas sempre visíveis.
2. Selecionar tema e buscar opções. Mostrar loading, zero/uma/duas/três opções, falha parcial, erro de rede e limite de uso de forma distinta.
3. Cada opção mostra título, resumo, data de publicação e referências. Não deslocar datas YYYY-MM-DD por fuso horário. Não preencher cartões fictícios.
4. Escolher descoberta ou Me surpreenda. Não gerar conteúdo antes desse gesto. Persistir ID do episódio e chave de idempotência para retomada.
5. Orquestrar roteiro e depois áudio, exibindo estados reais. Nunca inventar barra de progresso baseada em conclusão não confirmada.
6. Player expo-audio: reprodução/pausa, avanço de posição, duração, buffering, falha e renovação da URL assinada. Um único player ativo, liberação de recursos e tratamento de interrupções, fones e retorno do background.
7. Ficha **O que sabemos × O que falta descobrir**, resultado/evidência/limitação com fontes. Transcrição acessível, aviso de voz gerada por IA, nenhuma porcentagem de veracidade.
8. Registrar conclusão de escuta e exibir histórico. Histórico de áudio expirado continua disponível, mas o arquivo não é regenerado automaticamente.
9. Testar Android/iPhone, TalkBack/VoiceOver, fonte ampliada, teclado, safe areas, telas pequenas, voltar do Android e rede instável.

## 5. API existente: formatos que devem ser respeitados

Rotas com prefixo `/api/v1` já incluído na base acima. Rotas privadas recebem `Authorization: Bearer <access_token>`.

- `GET /health` → `{status:"ok",service:"eureka-api"}`.
- `GET /themes` → `{themes:[{id,name},...]}`.
- `GET /capabilities` → `{textEnabled,speechEnabled,followupsEnabled}`. Atualmente todos false. Não significa que o aplicativo falhou; mostrar indisponibilidade de geração. Flags true não garantem cota restante.
- `GET /me` → `{user:{id}}`, somente com sessão válida.
- `POST /episodes` → corpo `{selectionSetId,mode:"chosen",discoveryId}` ou `{selectionSetId,mode:"surprise"}`. Surpresa não envia discoveryId. Retorna `{episode}` e não chama IA.
- `GET /episodes/:id` → `{episode}`; consulta não gera nada.
- `POST /episodes/:id/script` → sem texto do cliente; gera/revisa, retorna `{episode}`.
- `POST /episodes/:id/audio` → sem texto do cliente; narra roteiro aprovado, retorna `{episode}`.
- `GET /episodes/:id/audio-access` → `{url,expiresIn:300}`. Renovar URL é diferente de gerar áudio.
- `POST /episodes/:id/completion` → `{completed:true}`, idempotente, registra escuta de episódio pronto.
- `GET /history?cursor=...` → `{items,nextCursor}`; 20 por página. Itens atuais: `episode_id`, `discovery_id`, `study_key`, `topic_key`, `completed_at`. Não presumir título/URL no item; obter detalhes por GET de episódio, com cache/concorrência limitada, ou coordenar extensão da projeção com Paulo. Cursor opaco, encaminhado com URL encoding.
- `POST /episodes/:id/recover` → `{stage:"script"|"audio"}`; recupera resultado preservado sem consumir IA.
- `POST /episodes/:id/retry` → mesmo corpo; prepara uma correção permitida, não gera. Nova geração após isso usa nova chave de idempotência e depende de ação explícita do usuário.

`POST /episodes`, `/script` e `/audio` exigem `Idempotency-Key`: 8–128 caracteres `[a-zA-Z0-9_-]`. Usar UUID é adequado. Uma chave por intenção/etapa, reutilizada se repetir a mesma tentativa após consultar o estado. Não criar chaves novas automaticamente em timeout para contornar o bloqueio.

Projeção atual de `episode`:

```typescript
{
  id, discoveryId, themeId, state, title, createdAt, updatedAt, errorCode,
  script: null | {
    title, paragraphs: [{id, text}],
    evidenceCard: {
      result: {text, references: [{sourceId, excerptId}]},
      evidence: {text, references: [{sourceId, excerptId}]},
      limitation: {text, references: [{sourceId, excerptId}]}
    }
  },
  sources: [{id, title, publisher, url, publishedAt}],
  audio: null | {durationSeconds, expiresAt}
}
```

A forma acima é descritiva; veja `publicEpisode` para o código exato. `title` é o título da descoberta; `script.title` pode diferir. Não esperar trechos completos das fontes ou storagePath no cliente. Mapear referências por sourceId.

Estados atuais: `selected`, `script_generating`, `script_ready`, `audio_generating`, `ready`, `failed`. A revisão ocorre dentro de `/script`; **não há estado persistido script_reviewing nesta versão**. Não interpretar ready como ouvido.

Erros: `{error:{code,message,retryable,retryAfterSeconds,requestId}}`. Usar code; não comparar mensagens. 401 pede sessão válida; 503 de autenticação não prova que o usuário saiu. 429 pede pausa. 409 pode representar operação em execução, seleção expirada, conflito ou retry esgotado. `PROVIDER_OUTCOME_UNKNOWN` não autoriza regeneração. `AUDIO_EXPIRED` preserva ficha e histórico. Respeitar a mensagem do backend, sem loops automáticos de POST.

Ao fechar/reabrir o app ou perder rede, consultar estado antes de retomar. O backend não promete processamento independente após desconexão nem fila de jobs.

## 6. Dependência da Pessoa 2: busca AINDA NÃO implementada

`POST /discovery-searches`, corpo `{themeId}`, será implementado pela Pessoa 2. Resposta planejada:

```typescript
{ selectionSetId, expiresAt, options: [
  {id,themeId,title,summary,publishedAt,reviewStatus,alreadyHeard,
   sources:[{id,title,publisher,url,publishedAt}]}
], partial, emptyReason }
```

Confirmar/schema compartilhado com Pessoa 2 antes de integração final. Não tratar esse endpoint como disponível no Worker atual. Criar adapter HTTP substituível e fixtures claramente de teste para avançar na UI; fixtures nunca devem ser fallback automático de produção ou enviadas ao backend como descobertas reais.

## 7. Aprofundamentos: aguardar Marco 2

Depois do fluxo principal aprovado, mostrar após escuta:
- “Como os cientistas descobriram isso?” (`method`)
- “O que ainda não sabemos?” (`unknowns`)
- “Me explica de um jeito mais simples.” (`simplify`)

Texto/voz somente após escolha, resposta separada de 30–60 s, reconhecendo falta de evidência. Endpoints de followup ainda NÃO existem. Não implementar geração especulativa nem mostrar botões como funcionais com feature flag false.

## 8. Limites de escopo e entrega

- Proprietário: `apps/mobile/**` e seus testes. Mudanças de raiz/lockfile e contratos são coordenadas; não sobrescrever alterações dos outros agentes.
- Preservar chamadas Gemini no backend, budgets, autenticação e funções SQL. Não ativar geração/serviços pagos para demonstrar uma tela.
- Antes de editar, inspecionar estado Git e dependências existentes. Não apagar código de colegas.
- Testes mobile: Jest/jest-expo e React Native Testing Library conforme SDK; mocks de rede. Não transformar Vitest do backend em configuração de React Native.
- Entregar branch/PR, instruções de execução, `.env.example` sem valores privados, testes e lista do que foi simulado versus testado em aparelho real.
- Rodar testes do backend ao alterar contrato compartilhado. Paulo integra as branches e decide quando habilitar a geração para piloto.

Prompt de início para este agente:

> Leia docs/PESSOA_1_EXPO.md inteiro e os arquivos indicados. Implemente minha frente mobile em etapas na minha branch, preservando a API e os contratos da Pessoa 3. Comece pelo Expo, login, temas e adapter de busca; use mocks explícitos para dependências ainda ausentes. Não faça deploy nem ative Gemini. Relate o que foi testado e quais integrações dependem das outras pessoas.
