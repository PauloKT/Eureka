# Pesquisa e evidências automáticas

Decisão de 08/11/2026: a busca deve preparar suas próprias opções a partir das fontes; não depender de cadastro editorial humano. Revisão humana continua sendo parte do aceite dos primeiros episódios, sem bloquear cada busca.

## Fluxo

`POST /api/v1/discovery-searches`, autenticado, recebe somente `{themeId}`. Consulta Europe PMC, arXiv, NASA NTRS e/ou OpenAlex conforme o tema; filtra datas, duplicatas, conteúdo insuficiente e preprints de Saúde/Cérebro.

Europe PMC usa relevância dentro da janela temporal e exige resumo disponível; a ordenação por data foi retirada após retornar resultados sem metadados core. arXiv recebe categorias específicas para Espaço, Tecnologia e Física. O servidor ordena os candidatos válidos e verifica os horários das evidências ao final da preparação, permitindo devolver uma revisão feita durante a própria busca.

O cache global guarda metadados públicos por 15 minutos (30 segundos se houver falhas parciais). Até oito candidatos sem pacote válido seguem para preparação em lote. O servidor divide cada resumo em trechos literais com IDs. A primeira chamada Gemini produz até três títulos/resumos/fichas em português e seleciona os IDs que sustentam cada fato; a segunda verifica pertinência e suporte de título, resumo, resultado, evidência e limitação. O servidor resolve os IDs contra os trechos originais e define URLs e datas. Nenhum roteiro completo ou áudio é produzido na busca.

Pacotes são identificados como `reviewMethod: automated`, sem alegação de revisão humana. `reviewStatus` é independente: preprint ou status editorial desconhecido, salvo evidência editorial explícita. A revisão por IA não certifica verdade científica.

Uma preparação reserva duas chamadas no mesmo orçamento dos roteiros, com trava atômica no banco. Resultado concluído é reutilizado; uma falha incerta não dispara repetição automática. A reserva permanece contabilizada mesmo quando a revisão reprova candidatos. A preparação é armazenada por conteúdo, tema, modelo, versão e dia. Os pacotes expiram em 24h; não se altera a data original dos estudos.

## Contrato público

Resposta: `{selectionSetId,expiresAt,options,partial,emptyReason}`. Cada opção contém ID, tema, título, resumo, publicação, status editorial, `evidenceReview`, indicação de escuta anterior e referências públicas. Trechos científicos públicos são enviados ao Gemini para revisão. Identidade e histórico dos usuários não entram no prompt; os trechos internos não são expostos na resposta da busca.

`options: []` com `no_eligible_evidence` significa ausência de pacote suficientemente sustentado. `sources_unavailable_or_incomplete` identifica busca incompleta. Falha total de fontes retorna `RESEARCH_UNAVAILABLE`; cota esgotada retorna `QUOTA_EXHAUSTED`. A busca nunca inventa cartões para preencher a tela.

Escolha: `POST /episodes` com `Idempotency-Key` e `{mode:"chosen",selectionSetId,discoveryId}` ou `{mode:"surprise",selectionSetId}`. Não chama IA. Roteiro, áudio, acesso, recuperação e histórico usam as rotas em `apps/api/src/modules/episodes/routes.ts` e os schemas de `@eureka/contracts`.

## Banco e configuração

As migrations 001/002/003/004 já foram aplicadas no piloto. A `202611080004_automatic_research.sql` acrescenta reservas da pesquisa e soma essas reservas às dos episódios. Em outro ambiente, aplicar cada migration uma vez, em ordem, antes de habilitar a automação. Não reaplicar migrations anteriores nem elevar cotas para contornar falhas.

`LIVE_AI_ENABLED` permite IA; `AUTO_RESEARCH_ENABLED` permite preparação automática. As duas precisam estar ativas, com modelo/chave configurados. Preparação usa o adaptador Gemini central e não usa ferramentas de pesquisa pagas.
