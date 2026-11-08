# Operação e publicação

API: `https://eureka-api.eureka-api.workers.dev/api/v1`. Worker `eureka-api`; configurações em `apps/api/wrangler.jsonc`. Segredos em Cloudflare e no `.dev.vars` local ignorado pelo Git.

## Situação

Em 08/11/2026, Paulo autorizou geração no piloto mantendo orçamento R$ 0. As migrations 001/002/003/004 foram confirmadas e a API foi publicada com `LIVE_AI_ENABLED=true` e `AUTO_RESEARCH_ENABLED=true`; aprofundamentos continuam false. Versão atual: `babd2695-2148-4ff4-985d-62d9e0055a38`. O teste online autenticou uma conta dedicada, buscou estudos reais, gerou roteiro auditado e WAV privado de 95,32 segundos, confirmou conclusão idempotente/histórico e reutilização sem nova geração. Paulo confirmou login, geração de roteiro e reprodução no Android. Os 96 testes automatizados passaram e os bundles Android/iOS foram exportados; download e demais testes de aparelho continuam no roteiro de aceite.

Na rodada online final, os seis temas retornaram três opções cada. Espaço, Saúde e Cérebro tiveram busca completa; Física, Tecnologia e Natureza tiveram busca parcial porque OpenAlex respondeu HTTP 429, com opções reais das outras fontes. Foram corrigidas a ordenação do Europe PMC, a abrangência das consultas arXiv e a comparação de horários que descartava evidências produzidas durante a própria requisição. Reservas antigas sem resultado confirmado permanecem preservadas; não foram apagadas para reiniciar chamadas. Retornar opções não equivale a validar narração de todos os estudos. O estado ao vivo deve ser conferido em `/health` e `/capabilities`; não inferir deploy a partir de um commit.

## Publicar

```sh
npm run typecheck
npm test
npm run deploy --workspace @eureka/api
```

Use `wrangler whoami` para conferir autenticação. `scripts/configurar-segredos-cloudflare.mjs` envia os segredos por stdin sem imprimir valores. Nunca habilitar faturamento, excedentes ou planos pagos. `LIVE_AI_ENABLED=false` interrompe novas gerações; recuperação e consulta continuam disponíveis.

Rollback: consultar `wrangler deployments list` e escolher a versão compatível com o schema. Rollback de Worker não desfaz SQL nem chamadas já consumidas.

## Modelos e cotas

Texto: `gemini-3.1-flash-lite`. Voz: `gemini-3.1-flash-tts-preview`, Kore, português brasileiro. Os budgets internos conferidos são texto 100 chamadas/24h e 10/60s; voz 8/24h e 2/60s. São limites conservadores do app, não garantias do provedor.

Busca automatizada reserva duas chamadas de texto por lote; roteiro reserva duas (geração/revisão); áudio reserva uma de voz. Tentativas anteriores, inclusive falhas, continuam contando. HTTP 429 interrompe a etapa. Não trocar de chave/projeto para contornar cotas.

## Recuperação e retenção

`POST /episodes/:id/recover` com `{stage:"script"|"audio"}` recupera checkpoint sem IA. Operação com lease ativo de cinco minutos retorna conflito. Áudio recuperado precisa coincidir com tamanho e SHA-256 do checkpoint.

`POST /episodes/:id/retry` prepara uma única correção para falhas determinadas, sem gerar. Exige nova intenção de geração depois. Resultado desconhecido não autoriza repetição cega. Falha de voz preserva roteiro aprovado.

Áudios WAV têm até 180s, Storage privado, URL assinada de cinco minutos e retenção de sete dias. Cron `0 5 * * *` executa às 01:00 em Cuiabá e processa até 20 arquivos vencidos, preservando texto/ficha/histórico. Candidatos são caminhos registrados pelo app; não se apagam arquivos arbitrários do bucket. Falhas mantêm reservas de espaço até reconciliação.

## Aceite ainda necessário

Testar o fluxo publicado, login no Android, fidelidade/naturalidade de episódios completos, acessibilidade, interrupções, segundo plano e iPhone. Uma amostra curta de Kore foi aprovada anteriormente; isso não equivale a aprovação de todos os episódios. APK independente, lojas e aprofundamentos ainda não foram entregues.
