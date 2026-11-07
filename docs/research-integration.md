# Pesquisa integrada — contrato para as Pessoas 1, 2 e 3

Implementação de 07/11/2026. Esta página substitui as pendências de integração descritas no guia inicial da Pessoa 2.

## API para a Pessoa 1

`POST /api/v1/discovery-searches`, com `Authorization: Bearer <sessão Supabase>` e JSON estrito `{ "themeId": "physics" }`.
Aceita os seis IDs de `ThemeId`. Não aceita identidade, estudos ou evidências enviados pelo celular.

A resposta segue `DiscoverySearchResponse` em `packages/contracts/src/index.ts`: `selectionSetId`, `expiresAt`, até três `options`, `partial` e `emptyReason`. As opções contêm ID, tema, título, resumo, data, `reviewStatus`, `alreadyHeard` e referências públicas. Trechos internos, hashes e nomes dos revisores não são enviados ao app.

- `options: []` + `no_eligible_evidence`: as fontes responderam, mas não há evidências elegíveis e revisadas para oferecer.
- `partial: true`: alguma fonte falhou ou estava ocupada; apresentar a busca como incompleta.
- HTTP 503 `RESEARCH_UNAVAILABLE`: nenhuma fonte pôde responder; permitir nova tentativa depois, sem afirmar ausência de estudos.
- HTTP 503 `STORAGE_UNAVAILABLE`: persistência indisponível; nenhuma opção é entregue sem seleção gravada.
- HTTP 400: JSON inválido, campos extras ou tema desconhecido. HTTP 401: sessão ausente/inválida.

Escolha: enviar `POST /api/v1/episodes` com `Idempotency-Key` e `{mode:"chosen",selectionSetId,discoveryId}`; surpresa usa `{mode:"surprise",selectionSetId}`. Esses passos não chamam Gemini. A seleção expira em 24 horas, conforme a fundação existente.

## Persistência e revisão editorial

Aplicar a nova migration `202611070003_research.sql` **antes de publicar o Worker integrado**. Ela cria cache de candidatos, snapshots editoriais por `(identifier, theme_id)` e slots de consulta compartilhados entre instâncias. As migrations 001/002 não foram alteradas.

As tabelas novas têm RLS e acesso somente pelo serviço. Histórico é consultado pelo usuário autenticado e pelo tema, com paginação. Cache global contém apenas metadados das fontes, nunca histórico ou ranking personalizado. TTL de resultados completos: 15 minutos; incompletos: 30 segundos. A leitura sempre verifica expiração. Slots atômicos permitem no máximo uma chamada por provedor a cada dez segundos entre Workers; ocupação é falha parcial explícita.

O módulo não inventa revisão científica. Um responsável prepara o pacote com `createEvidencePackage` e `buildDiscovery`, verifica os trechos e redige título, resumo e ficha em português. Só depois registra um `ReviewedDiscovery` com:

```text
{ discovery, reviewStatus, reviewedBy, reviewedAt, expiresAt }
```

`reviewedBy` identifica quem revisou; não é uma aprovação automática do sistema. `peer_reviewed` exige comprovação editorial independente. O schema verifica estrutura/referências, não equivalência científica das afirmações. Datas de revisão e validade são verificadas na ingestão e no consumo.

Validar um JSON revisado, sem enviar nada:

```sh
node scripts/import-reviewed-discovery.mjs reviewed.json
```

Após revisão humana, importar usando variáveis de ambiente **do servidor** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`:

```sh
node scripts/import-reviewed-discovery.mjs reviewed.json --write
```

Não há endpoint público de aprovação ou importação. Nunca guardar chaves no JSON nem no app. Nenhum snapshot fictício é importado pelos testes. Sem pacote editorial aprovado, uma fonte pode retornar estudos e a API ainda oferecer zero opções. Isso preserva a exigência de evidências e deve ser considerado no piloto.

## Fontes e limites

Europe PMC, arXiv, NASA NTRS e OpenAlex têm adaptadores conectados. Cada consulta pede até dez registros e uma janela de publicação de `RECENCY_DAYS` (padrão 90, permitido 1–365). Data ausente, futura ou inválida não vira a data da coleta. Resultados sem abstract são inelegíveis. OpenAlex reconstrói o abstract somente quando o índice invertido existe; o índice não comprova revisão por pares. NASA usa `publications[].publicationDate`, identifica documentos numéricos e não interpreta revisão técnica como revisão por pares.

São usados HTTPS, allowlist, recusa de redirects, timeout de oito segundos e máximo de 1 MB. Consultas públicas limitadas confirmaram respostas dos quatro provedores em 07/11/2026; disponibilidade, cobertura temática e quotas podem variar. O primeiro teste Europe PMC com um único item retornou lista vazia apesar de `hitCount` positivo; a consulta com dez registros retornou estudos e abstracts. Não se amplia a janela para preencher cartões.

Referências de protocolo: [NASA OpenAPI](https://sti.nasa.gov/docs/20221122_OpenAPI_Documentation.pdf), [arXiv API](https://info.arxiv.org/help/api/user-manual.html), [Europe PMC REST](https://europepmc.org/RestfulWebService), [OpenAlex](https://docs.openalex.org/).

## Verificação e publicação

`npm ci`, `npm run typecheck` e `npm test` executam a configuração compartilhada, regressões de pesquisa, autenticação, persistência e o fluxo pesquisa → seleção → escolha. Os testes não consomem serviços reais. Há testes PostgreSQL locais da nova migration, isolamento editorial por tema, permissões e slots compartilhados.

Merge de código não faz deploy nem aplica SQL. Esta integração não habilita IA, não altera cotas Gemini e não cria revisão automática de artigos. Antes do piloto publicado: aplicar migration 003, importar evidências efetivamente revisadas, publicar o Worker e validar com sessão real. A Pessoa 1 já pode implementar contra o contrato compartilhado e testar localmente.
