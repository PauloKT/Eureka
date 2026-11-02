# Recuperação, limpeza e cotas — 02/11/2026

**Estado:** migration 002 aplicada por Paulo e conferida no Supabase; código publicado no Worker em 02/11/2026. TypeScript, 34 testes e build aprovados. Schema/arquivo de tentativas respondem HTTP 200, budgets confirmados em 100/10 para texto e 8/2 para voz (24h/60s). Consulta real de candidatos à limpeza respondeu com lista vazia. Sem novas chamadas Gemini nesta etapa.

Deploy: `18e8cc5a-6fa5-4a51-b516-ffe6bf39be0f`; cron diário registrado pela Cloudflare. Após deploy, health/themes/capabilities responderam 200; me/recover/retry sem login responderam 401. Geração e aprofundamentos continuam false. Ainda não foi observado um disparo real do cron removendo um arquivo expirado, nem recuperação de um episódio real de produção.

## HTTPS

Confirmados no endereço https://eureka-api.eureka-api.workers.dev/api/v1:
- health: HTTP 200;
- themes: HTTP 200, seis temas;
- capabilities: HTTP 200, geração e aprofundamentos false;
- me sem sessão: HTTP 401.

O erro TLS inicial deixou de ocorrer sem desativar validação de certificados. A causa original não foi determinada.

## Migration 002

Aplicar uma única vez `supabase/migrations/202611020002_recovery_cleanup.sql`, após a 001. Não reaplicar a 001. A 002 adiciona checkpoint, arquivo de tentativas, funções de recuperação e limpeza, e atualiza a reserva de cotas para contar tentativas anteriores.

## Recuperação no Expo

- `POST /api/v1/episodes/:id/recover`, corpo `{ "stage": "script" }` ou `{ "stage": "audio" }`: recupera um resultado aprovado já preservado. Não chama Gemini, mesmo com geração desativada.
- Operações ainda dentro do lease de cinco minutos retornam 409. Consultar o episódio antes de tentar novamente; não fazer polling de recuperação.
- Para áudio, compara tamanho e SHA-256 do WAV no Storage com os metadados persistidos antes do upload. Só confirma o episódio se o arquivo corresponder. Arquivo ausente ou divergente não é interpretado como sucesso.
- Se não existir resultado recuperável, mantém `PROVIDER_OUTCOME_UNKNOWN`: é necessário investigar, nunca repetir cegamente a geração.
- `POST /api/v1/episodes/:id/retry`, mesmo corpo: prepara **uma** tentativa corretiva, apenas após falhas determinadas `SCRIPT_REJECTED`, `AUDIO_DURATION_INVALID` ou `QUOTA_EXHAUSTED`, sem checkpoint recuperável. Não gera nada nessa rota.
- Depois de preparar, o usuário pode solicitar novamente `/script` ou `/audio` com uma nova Idempotency-Key. O orçamento é reservado novamente; o consumo anterior permanece contabilizado.
- Erro de áudio preserva roteiro aprovado. Nunca gera novamente o roteiro apenas para repetir a voz.
- Término incerto, falha de upload com checkpoint e timeout não são liberados para regeneração automática.

## Limpeza

Cron do Worker: `0 5 * * *`, 05:00 UTC (01:00 em Cuiabá). Cada execução processa até 20 arquivos expirados, incluindo checkpoints órfãos com caminho conhecido.

Remove o arquivo pela API Storage e só então marca liberação de espaço. Se Storage ou banco falhar, a execução seguinte repete a limpeza com segurança. Não apaga episódios, roteiros, fichas ou histórico; marca o áudio como excluído. Acesso após sete dias continua bloqueado mesmo se houver atraso na remoção física.

A rotina não escaneia nem apaga arquivos arbitrários do bucket: só caminhos vinculados a episódios e operações da aplicação. Reservas de resultado desconhecido sem checkpoint continuam retidas, exigindo revisão administrativa. Nenhuma chamada de IA ocorre durante limpeza ou recuperação.

## Cotas

Paulo confirmou texto `gemini-3.1-flash-lite`: painel mostrou **1 / 500 RPD**, ou seja, limite de 500/dia e uma chamada registrada. Captura anterior mostrava 15 RPM. Voz `gemini-3.1-flash-tts-preview`: 10 RPD e 3 RPM.

Orçamento interno conservador na 002:
- texto: 100 chamadas em janela móvel de 24h, 10 em 60 segundos;
- voz: 8 chamadas em janela móvel de 24h, 2 em 60 segundos.

Roteiro reserva duas chamadas de texto (geração e revisão). Áudio reserva uma de voz. Reservas de falha não são devolvidas automaticamente. Tentativas arquivadas continuam entrando na soma. Os limites são por projeto/modelo, compartilhados entre usuários; não são por pessoa. A janela local é conservadora, não uma reprodução do horário de reset do provedor.

O app continua com `LIVE_AI_ENABLED=false`. Configurar budgets não ativa geração. Testes manuais no AI Studio e scripts fora do backend também consomem a cota do provedor e não são vistos pelo contador local. Os limites de tokens do provedor continuam valendo; HTTP 429 bloqueia a tentativa sem retry automático. A busca da Pessoa 2 não deve fazer chamadas de IA fora do controle compartilhado.

## Limites da validação

Tests SQL em PostgreSQL embarcado validam autorização, reservas, arquivo de tentativas, retry, recuperação e exclusão lógica. Testes HTTP simulam falhas de Storage e comparação de hash. Não substituem episódio real completo, login Expo ou execução de cron com arquivo real vencido no ambiente online.
