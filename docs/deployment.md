# Publicação do backend — 02/11/2026

- Worker: `eureka-api`.
- Base da API: `https://eureka-api.eureka-api.workers.dev/api/v1`.
- Aplicativo cliente: React Native + Expo; este endereço é API, não interface web.
- Deploy inicial e deploy de configuração de segredos confirmados pelo Wrangler.
- Segredos enviados por stdin, com autorização explícita de Paulo: URL/chaves Supabase, chave Gemini e nomes dos dois modelos. Nenhum valor foi colocado no código, no Expo ou neste documento.
- `LIVE_AI_ENABLED=false` e `FOLLOWUPS_ENABLED=false` mantidos.
- Supabase: tabelas da base e arquivo de tentativas verificados; budgets internos de texto 100/24h e 10/60s, voz 8/24h e 2/60s, bucket privado e bloqueio de leitura anônima confirmados. Flags de geração continuam desativadas.

## Verificação pública concluída

Em nova verificação em 02/11/2026, HTTPS respondeu normalmente: health/themes/capabilities com 200 e me sem sessão com 401. A falha TLS inicial deixou de ocorrer sem desativar validação de certificados; sua causa não foi determinada.

Os checks públicos passaram. Migration 002 aplicada e atualização de recuperação/limpeza publicada: versão `18e8cc5a-6fa5-4a51-b516-ffe6bf39be0f`. Cron `0 5 * * *` registrado. Rotas recover/retry sem sessão retornam 401. Ainda testar login real no Expo e fluxo autorizado com dados reais da Pessoa 2.

## Registro consolidado de texto e voz

- Teste real local em 02/11/2026: `gemini-2.5-flash-lite` retornou HTTP 404 em duas tentativas; não é o modelo configurado para o app.
- Alternativa `gemini-3.1-flash-lite`: uma chamada de texto bem-sucedida. TTS `gemini-3.1-flash-tts-preview`, Kore: uma chamada bem-sucedida, PCM mono 24 kHz/16 bits, WAV de 30,04 s.
- Amostra local preservada em `.tools/gemini-validation/amostra-kore.wav`, fora do Git. Paulo ouviu e avaliou “ficou muito boa a voz”. Direção: português brasileiro, conversa acolhedora, entonação variada, pausas curtas, sem tom publicitário nem palavras adicionais.
- A aprovação se limita a essa amostra. Não houve comparação completa entre duas vozes pelo grupo nem aprovação de episódios científicos completos em Android/iOS.
- O script exploratório antigo foi removido na limpeza; testes de regressão permanecem em `apps/api/test`. Relatórios e amostra local continuam em `.tools/gemini-validation`. Não há chamada real de Gemini nos testes automáticos.

## Configuração e recuperação do serviço

- Configuração do Worker: `apps/api/wrangler.jsonc`.
- Atualizar segredos: `node scripts/configurar-segredos-cloudflare.mjs`, após login autorizado no Wrangler. O script não imprime os valores.
- Não versionar `.dev.vars` nem arquivos da pasta `.tools`.
- Rollback: identificar versão anterior em `wrangler deployments list`, então usar o rollback da Cloudflare para a versão escolhida. Conferir compatibilidade do banco; rollback de código não desfaz migrations nem chamadas de IA.
- Desativar: manter flag de geração false e budgets zero. Excluir Worker/bucket/projeto exige decisão explícita; não executar exclusão como tentativa de corrigir uma falha de publicação.

Paulo confirmou limite de 500 RPD para texto 3.1. Limpeza e recuperação implementadas e publicadas, 34 testes e build aprovados; budgets internos confirmados no banco e geração desativada. Disparo real do cron com arquivo vencido, recuperação real, busca integrada e testes completos Android/iOS ainda pendentes. Veja recovery-cleanup-quotas.md.
