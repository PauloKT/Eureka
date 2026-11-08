# Eureka mobile

Interface conectada ao Supabase Auth e à API HTTPS. Dados de demonstração foram removidos do aplicativo.

## Testar no Android

1. Instale um Expo Go compatível com Expo SDK 58.
2. Configure `apps/mobile/.env` a partir de `.env.example` (somente valores públicos).
3. Na raiz, execute `npm run dev:mobile`.
4. Mantenha celular e computador na mesma rede e leia o QR code no Expo Go. Se o firewall bloquear o Metro, permita acesso na rede privada.
5. Entre com uma conta de **Authentication do projeto**, que é diferente da conta administrativa do painel Supabase.
6. Escolha um tema, busque, selecione uma descoberta, gere o roteiro e depois o áudio. A escuta é registrada ao terminar a reprodução.

O piloto é fechado. O responsável cria/confirma contas de teste em Authentication; senhas não devem ser compartilhadas no chat. O app não altera políticas de cadastro do projeto.

## Retomada e erros

- Reabrir consulta o episódio salvo; não inicia geração.
- Se a conexão cair, use **Atualizar estado**. **Recuperar resultado preservado** não chama IA.
- **Preparar tentativa corretiva** só funciona quando o servidor permite; depois é necessário tocar em Gerar.
- Renovar acesso ao áudio obtém outra URL assinada, sem gerar voz novamente.
- Áudio expirado mantém transcrição e histórico. Somente um player fica montado por vez.
- Sessão é persistida no SecureStore; intenção e chaves de idempotência ficam no armazenamento local por usuário.

## Verificações

`npm test` na raiz roda testes de pesquisa, API, PostgreSQL local, fluxo mobile e componentes com Jest/Testing Library. Os testes de componentes usam rede simulada; o app em execução utiliza somente os serviços configurados.

Exportação de bundles: `npm exec --workspace @eureka/mobile -- expo export --platform android --platform ios`. Isso não gera APK/IPA. Build nativo, comportamento com tela bloqueada, fones, chamadas, TalkBack/VoiceOver e iPhone precisam de validação em aparelhos; consulte `../../docs/manual-qa.md`.
