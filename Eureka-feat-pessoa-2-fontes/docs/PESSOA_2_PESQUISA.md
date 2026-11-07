# Pessoa 2 — pesquisa, seleção e evidências

Este diretório é um módulo de pesquisa isolado, preparado para integração ao backend de referência da Pessoa 3. Não inclui chaves, dados científicos fixos, chamadas Gemini, rota Hono ou cópia das migrations.

## Contratos

- Entrada: um dos IDs `space`, `health`, `brain`, `technology`, `nature`, `physics`.
- Produção interna: registros normalizados com identificador, URL, data de publicação separada da atualização/coleta, status editorial explícito ou `unknown`, tipo de acesso e abstract quando a fonte oferece um.
- Produção para persistir: formato compatível com `Source`, `Discovery`, `EvidenceCard` e `SelectionInput` dos contratos existentes da Pessoa 3. `reviewStatus` e `alreadyHeard` são metadados da resposta pública, não campos novos dentro de `Discovery`.
- Busca: `discoverySearch` recebe identidade já autenticada, Store, cache, provedores e uma função `prepareDiscovery` que só pode retornar uma descoberta após revisão factual/evidencial. Ele usa `Store.saveSelection` com a lista validada e usa o ID/expiração retornados pelo Store.

## Fontes oficiais e cobertura

| Tema | Principal | Alternativa | Uso e limites conhecidos |
|---|---|---|---|
| Espaço | NASA NTRS API | arXiv (astro-ph) | NTRS cataloga STI da NASA, incluindo artigos, relatórios e papers; sua OpenAPI define busca, mas a consulta pública sem autenticação e seus limites não foram confirmados. arXiv é preprint salvo status editorial verificado separadamente. |
| Saúde | Europe PMC REST | OpenAlex | Europe PMC permite busca JSON e metadados/abstract/full-text links conforme disponibilidade; OpenAlex é índice de descoberta e não valida revisão por pares. |
| Cérebro | Europe PMC REST | OpenAlex | Mesmas limitações; preprints são inelegíveis para os temas Saúde/Cérebro, conforme plano. Status desconhecido fica marcado como desconhecido. |
| Tecnologia | arXiv | OpenAlex | arXiv aceita Atom e paginação; registros são tratados como preprints salvo status publicado verificado. OpenAlex auxilia descoberta, não evidência primária. |
| Natureza | Europe PMC REST | OpenAlex | Cobertura de ciências biológicas/ambientais precisa ser avaliada por consulta; OpenAlex é alternativa de descoberta, não prova de qualidade. |
| Física | arXiv | OpenAlex | arXiv aceita Atom e paginação; OpenAlex é alternativa de descoberta. Não se converte contagem de citações em qualidade. |

As consultas usam no máximo 10 itens por provedor, timeout padrão de 8 s, corpo máximo de 1 MB, HTTPS, allowlist de domínios e recusa de redirects. `RECENCY_DAYS` começa em 90 (parametrizável por argumento, atualmente não carregado de ambiente). A janela não é ampliada para encher cartões. Cache curto de metadados é delegado ao Store/cache do backend; o adaptador não inventa resultados vazios para ocultar falhas.

### Documentação oficial consultada

- NASA NTRS OpenAPI: <https://ntrs.nasa.gov/api/openapi/>. Define endpoints de busca de citações/publicações; limite público de taxa e forma exata de resultados da rota consultada continuam por validar.
- NASA NTRS: <https://ntrs.nasa.gov/>. Explica escopo e tipos de material disponibilizado; acesso público não implica revisão por pares.
- Europe PMC REST: <https://dev.europepmc.org/RestfulWebService>. Documenta busca, `format=json`, tipos `lite`/`core` e campos de abstract/links. Não foi localizada nesta consulta documentação oficial de cota numérica; usar baixo volume e cache.
- arXiv API User Manual: <https://info.arxiv.org/help/api/user-manual.html>. Documenta Atom, paginação, `published` (submissão v1), `updated` (versão obtida) e campos de journal reference/DOI. Orienta intervalo de 3 s para múltiplas chamadas sequenciais; a implementação atual faz no máximo uma chamada por tema/provedor por busca e ainda requer rate limiter compartilhado/cross-request.
- OpenAlex API: <https://docs.openalex.org/> e <https://help.openalex.org/api/authentication/>. Documentação consultada descreve API sem chave para uso básico, quotas/limites atuais e `mailto` para polite pool. Quotas mudam; monitorar cabeçalhos/429, sem pré-pago ou excedente.
- NASA feeds institucionais (alternativa editorial, não evidência primária): <https://www.nasa.gov/rss-feeds/>.

Referências oficiais foram conferidas em 07/11/2026 via documentação. Não foi feita consulta API real nesta implementação, portanto a conectividade, schema ao vivo, limites específicos e resposta por tema ainda não estão verificados. NASA News/feeds são comunicados institucionais, não artigo revisado por pares. A adaptação de NTRS/OpenAlex para abstract depende de confirmar o JSON real no smoke autorizado.

## Normalização, elegibilidade e ranking

- Datas mantêm publicação, atualização e coleta separadas. Datas ausentes ou inválidas nunca são preenchidas com a data atual. Data futura, fora da janela, fonte/ID/abstract insuficiente são inelegíveis.
- Duplicatas eliminadas por identificador, URL canônica e por último título normalizado.
- Para Saúde e Cérebro preprint é excluído; em demais temas preprint fica identificado, não promovido a revisado.
- Histórico de escuta é obtido por usuário e tema, após sessão. Estudos ouvidos continuam elegíveis, mas os novos são priorizados.
- Falha parcial fica visível (`partial`) e não é tratada como ausência de pesquisa. A resposta distingue busca incompleta de resultado elegível vazio.
- O status `peer_reviewed` só pode ser atribuído com prova editorial verificada por `prepareDiscovery`; os adaptadores não inferem isso por tipo de publicação, fonte ou índice.

## Pacote de evidências e auditoria

`createEvidencePackage` conserva identificador, fonte, datas distintas, acesso, hash SHA-256 do abstract, data de captura e trechos selecionados (não artigo integral). Trechos precisam existir literalmente no conteúdo recebido. `buildDiscovery` exige revisão humana, ficha com resultado/evidência/limitação e referências a trechos existentes. Não sintetiza automaticamente limitação: o revisor deve fornecer um trecho-fonte apropriado; se não existir, a descoberta não deve ser aprovada.

`auditScriptReferences` implementa somente a parte determinística (resolução de IDs/trechos e claims não vazias). Não verifica equivalência semântica, causalidade, população, magnitude nem extrapolação. Isso exige revisão científica humana e, se acordado, etapa auxiliar pelo adaptador Gemini central da Pessoa 3 com quota de pesquisa global transacional. Até essa extensão, Gemini permanece desligado e nenhuma chamada é feita.

## Integração pendente

1. Pessoa 3 monta `POST /api/v1/discovery-searches` com `requireSession`, validação estrita `{themeId}`, `c.get('userId')` e mapeamento de erros.
2. Store precisa implementar `getCompletedStudyKeys(userId, themeId)`, `getEvidenceDiscovery(identifier)` e `saveEvidenceDiscovery(identifier, discovery)` com isolamento de usuário quando aplicável, cache/TTL e retenção suficiente para reutilizar evidências. Sem essa persistência, as funções não devem ser expostas em produção. `saveSelection` deve ser o método existente da Pessoa 3.
3. A resposta pública deve ser adicionada aos contratos compartilhados após revisão da Pessoa 1 e Pessoa 3. Enum proposto: `peer_reviewed | preprint | institutional_release | unknown`; `emptyReason`: `no_eligible_evidence | sources_unavailable_or_incomplete | null`. `partial` e `emptyReason` ficam na resposta; a tabela atual não persiste esses campos.
4. Coordenar rate limiter/TTL entre requests, cache, histórico e integração de consulta NTRS. Não usar Gemini até existir extensão quota/idempotência genérica aprovada pela Pessoa 3.
5. Consultas reais de cada tema e testes de compatibilidade com o schema ao vivo ainda precisam de smoke limitado sem IA e sem publicar migrations/deploy.

## Execução

```powershell
npm test
npm run typecheck
```

Testes são mocks explícitos das respostas de fonte, do cache e do Store. Nenhum resultado mock é conteúdo de produção. Nenhum artigo/abstract real, pesquisa manual de episódio, chamada Gemini, endpoint hospedado ou seleção real foi exercitado nesta entrega.
