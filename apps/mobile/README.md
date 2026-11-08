# Eureka mobile — protótipo demonstrativo

Entrega da Pessoa 1 integrada ao monorepo em 08/11/2026. O código original foi movido da raiz para este workspace, preservando a API, os contratos e a pesquisa existentes.

## Executar

Na raiz do repositório, com Node.js compatível com as dependências:

```sh
npm ci
npm run dev:mobile
```

Abra em um Expo Go compatível com SDK 58 ou emulador. `npm run android --workspace @eureka/mobile` e `npm run ios --workspace @eureka/mobile` iniciam o Expo para essas plataformas; o simulador iOS exige macOS.

## Escopo real da entrega

- Interface React Native em JavaScript, seleção de temas, cartões, escolha explícita/surpresa e ficha demonstrativa.
- Descobertas e datas são fixtures locais marcadas MOCK. Não há requisições HTTP, autenticação Supabase ou persistência.
- Players são temporizadores visuais, sem arquivo de áudio. Podem funcionar simultaneamente; não são o player de produção.
- Histórico em memória registra o início da simulação, não a conclusão de uma escuta real.
- Aprofundamentos são demonstrações locais; não existem endpoints correspondentes.

## Pendências para integração funcional

Seguir `../../docs/PESSOA_1_EXPO.md` e os contratos atuais de `@eureka/contracts`: implementar login/sessão, seis temas canônicos (incluindo Cérebro), busca autenticada, seleção salva no servidor, idempotência e retomada, geração respeitando capabilities, expo-audio, referências/transcrição e histórico de conclusão. Os temas atuais do protótipo não correspondem aos IDs da API.

Não usar os mocks como fallback de produção. O endpoint de pesquisa já existe no código integrado; sua publicação depende da migration 003 e do deploy descritos em `../../docs/research-integration.md`.

Não foram fornecidos testes mobile nem evidência de validação em Android/iPhone, leitores de tela ou build nativo. O merge não habilita geração, não faz deploy e não representa um fluxo completo aprovado.

## Verificação da integração

Em 08/11/2026: checagem de tipos e 64 testes existentes passaram (18 de pesquisa/integração e 46 da API). O Expo exportou os bundles Android e iOS com sucesso. A checagem offline das dependências não apontou incompatibilidades com o SDK instalado. Isso não substitui teste em aparelho. Os arquivos do backend e as versões de suas dependências existentes foram preservados.
