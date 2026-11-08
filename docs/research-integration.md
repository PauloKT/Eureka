# Pesquisa e evidências automáticas

Decisão de 08/11/2026: a busca deve preparar suas próprias opções a partir das fontes; não depender de cadastro editorial humano. Revisão humana continua sendo parte do aceite dos primeiros episódios, sem bloquear cada busca.

## Fluxo

`POST /api/v1/discovery-searches`, autenticado, recebe somente `{themeId}`. Consulta Europe PMC, arXiv, NASA NTRS e/ou OpenAlex conforme o tema; filtra datas, duplicatas, conteúdo insuficiente e preprints de Saúde/Cérebro.

O cache global guarda metadados públicos por 15 minutos (30 segundos se houver falhas parciais). Até oito candidatos sem pacote válido seguem para preparação em lote. A primeira chamada Gemini produz até três títulos/resumos/fichas em português e trechos literais; a segunda verifica pertinência e suporte de título, resumo, resultado, evidência e limitação. O servidor confere os trechos contra o resumo original e define IDs, URLs e datas. Nenhum roteiro completo ou áudio é produzido na busca.

Pacotes são identificados como `reviewMethod: automated`, sem alegação de revisão humana. `reviewStatus` é independente: preprint ou status editorial desconhecido, salvo evidência editorial explícita. A revisão por IA não certifica verdade científica.

Uma preparação reserva duas chamadas no mesmo orçamento dos roteiros, com trava atômica no banco. Resultado concluído é reutilizado; uma falha incerta não dispara repetição automática. A reserva permanece contabilizada mesmo quando a revisão reprova candidatos. A preparação é armazenada por conteúdo, tema, modelo, versão e dia. Os pacotes expiram em 24h; não se altera a data original dos estudos.

## Contrato público

Resposta: `{selectionSetId,expiresAt,options,partial,emptyReason}`. Cada opção contém ID, tema, título, resumo, publicação, status editorial, `evidenceReview`, indicação de escuta anterior e referências públicas. Trechos internos e identidade de usuários não são enviados ao Gemini nem expostos no app.

`options: []` com `no_eligible_evidence` significa ausência de pacote suficientemente sustentado. `sources_unavailable_or_incomplete` identifica busca incompleta. Falha total de fontes retorna `RESEARCH_UNAVAILABLE`; cota esgotada retorna `QUOTA_EXHAUSTED`. A busca nunca inventa cartões para preencher a tela.

Escolha: `POST /episodes` com `Idempotency-Key` e `{mode:"chosen",selectionSetId,discoveryId}` ou `{mode:"surprise",selectionSetId}`. Não chama IA. Roteiro, áudio, acesso, recuperação e histórico usam as rotas em `apps/api/src/modules/episodes/routes.ts` e os schemas de `@eureka/contracts`.

## Banco e configuração

As migrations 001/002/003 já foram aplicadas. A automação requer `202611080004_automatic_research.sql`, que acrescenta reservas da pesquisa e soma essas reservas às dos episódios. Aplicar uma vez, antes de publicar `AUTO_RESEARCH_ENABLED=true`. Não reaplicar migrations anteriores nem elevar cotas para contornar falhas.

`LIVE_AI_ENABLED` permite IA; `AUTO_RESEARCH_ENABLED` permite preparação automática. As duas precisam estar ativas, com modelo/chave configurados. Preparação usa o adaptador Gemini central e não usa ferramentas de pesquisa pagas.
