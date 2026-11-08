# Eureka! — Especificação do projeto e divisão para três pessoas

**Versão:** 1.2 — mobile, narração e guias de integração
**Data de referência:** 29/10/2026  
**Público deste documento:** os três integrantes do grupo e as IAs que os auxiliam.  
**Estado:** planejamento; nenhuma integração ou cota está confirmada na conta do grupo.  
**Objetivo da versão inicial:** aplicativo mobile Android/iOS em React Native + Expo, conectado a um backend online, em português brasileiro, que apresenta descobertas científicas e gera episódios curtos após a escolha do usuário.

> Este documento é a referência compartilhada do projeto. Uma IA deve lê-lo por inteiro antes de implementar sua parte. Depois, deve ler os arquivos e as decisões já existentes no repositório. O documento não substitui a revisão humana, os testes ou a confirmação das condições dos serviços.

> Estado atual (08/11/2026): consulte README.md, apps/mobile/README.md e docs/research-integration.md. Este plano mantém os critérios de aceite, incluindo funcionalidades futuras. Por decisão de Paulo, a preparação de evidências na busca agora é automática, com cota compartilhada, trechos verificáveis e auditoria semântica; não exige cadastro humano prévio. A revisão humana permanece no aceite de qualidade dos episódios. Guias antigos por pessoa e resultados históricos foram substituídos pela documentação atual.

## 1. Decisões obrigatórias

1. O produto é um app mobile Android e iPhone (iOS), em React Native + Expo. O backend funciona online, sem exigir que o computador de um integrante fique ligado. Página web, PWA ou WebView não substitui a entrega mobile.
2. Os seis temas são obrigatórios desde a primeira versão funcional: **Espaço, Saúde, Cérebro, Tecnologia, Natureza e Física**.
3. O orçamento para serviços é **R$ 0**. Não contratar plano pago, domínio pago, créditos, recarga automática ou recursos com cobrança por excedente.
4. Usar **Gemini Developer API** para geração de texto e narração, exclusivamente em modelos com acesso gratuito efetivamente disponível para a conta.
5. Organizar o backend em **módulos de uma única aplicação**, não em microserviços separados.
6. Três pessoas trabalharão em paralelo em um repositório compartilhado.
7. Fontes reais e evidências sustentam o conteúdo. Nunca preencher lacunas inventando estudos, datas ou afirmações.
8. O fluxo completo de escolha e reprodução tem prioridade. Implementar aprofundamentos somente depois de esse fluxo passar nos testes de integração.
9. Não reaproveitar nem republicar o antigo projeto baseado na OpenAI. O código anterior foi removido; esta especificação descreve uma nova implementação.
10. Não substituir silenciosamente geração por conteúdo estático, Gemini por outro provedor ou funcionamento online por IA local. Mudanças de requisito precisam de decisão do grupo.

### 1.1 O que orçamento zero significa

- Gratuito não significa ilimitado, permanente nem disponível para toda conta ou modelo.
- Antes de implementar dependências, confirmar acesso, cotas, região, necessidade de faturamento e limites de armazenamento na conta do grupo.
- Ao atingir um limite, informar a indisponibilidade e interromper novas gerações. Não iniciar consumo pago.
- Não criar contas adicionais para contornar limites.
- Não afirmar que uma assinatura do aplicativo Gemini concede automaticamente créditos para a API.
- Se um serviço exigir cartão, ativação de faturamento ou assinatura para o recurso necessário, registrar o bloqueio e procurar uma alternativa realmente gratuita com o grupo.
- Computadores pessoais podem ser usados para desenvolvimento e testes; não podem ser requisito de operação do produto publicado.

## 2. Produto e experiência

### 2.1 Temas e identificadores

Usar estes identificadores em contratos, banco e testes; os nomes visíveis continuam em português:

```text
space       -> Espaço
health      -> Saúde
brain       -> Cérebro
technology  -> Tecnologia
nature      -> Natureza
physics     -> Física
```

Não criar um modelo de IA diferente para cada tema. Os mesmos módulos trabalham com filtros, fontes e instruções apropriadas ao tema.

### 2.2 Fluxo principal obrigatório

1. O usuário entra no aplicativo e escolhe um tema.
2. O backend consulta as fontes e/ou material válido já coletado.
3. Identifica descobertas elegíveis e prioriza qualidade, atualidade, pertinência e assuntos ainda não ouvidos.
4. A interface recebe **zero, uma, duas ou três opções**.
5. Cada opção apresenta título, resumo curto, data de publicação e referências acessíveis.
6. O usuário escolhe uma descoberta ou aciona **“Me surpreenda”**.
7. O backend registra a escolha e gera o roteiro com as fontes da busca inicial.
8. O roteiro passa por verificação de evidências.
9. Somente um roteiro aprovado segue para geração de voz.
10. O áudio é medido e liberado apenas se respeitar o limite de três minutos.
11. O usuário reproduz o episódio, consulta o texto e a ficha de evidências.
12. Ao terminar o episódio, o sistema registra a escuta e apresenta as perguntas de aprofundamento, quando essa etapa estiver implementada.

### 2.3 Estados vazios e falhas

- **Nenhum resultado elegível:** explicar que não foram encontradas descobertas com evidências suficientes dentro dos critérios; permitir tentar novamente ou escolher outro tema.
- **Fonte fora do ar:** informar que a busca ficou incompleta; não tratar falha de rede como prova de inexistência de pesquisas.
- **Cota esgotada:** preservar o que já está pronto e explicar quando será possível tentar novamente, se essa informação estiver disponível.
- **Roteiro rejeitado:** não gerar áudio; permitir nova tentativa limitada ou outra descoberta.
- **Falha somente no áudio:** manter o roteiro aprovado; repetir apenas a etapa de voz quando autorizado.
- **Seleção expirada:** solicitar nova busca; não fabricar ou substituir silenciosamente a descoberta selecionada.

### 2.4 Roteiro e narração

- Um episódio trata de uma descoberta específica.
- Linguagem acessível em português brasileiro, sem jargão desnecessário.
- Estrutura: apresentação da descoberta, resultado principal, como a pesquisa chegou a ele, importância contextualizada e principal limitação.
- Diferenciar resultado observado, hipótese e interpretação.
- Não transformar resultados de estudos em recomendações médicas pessoais.
- Não atribuir porcentagens de veracidade.
- Mostrar aviso de voz gerada por IA.
- A duração máxima é **180 segundos de áudio real**, não apenas uma estimativa por palavras.
- Não cortar o áudio abruptamente aos três minutos para fingir cumprimento do requisito.
- Não gerar roteiro completo nem áudio para opções ainda não escolhidas. Gerar títulos/resumos curtos na busca é permitido e deve ser contabilizado na cota.

### 2.4.1 Voz natural: requisito obrigatório

- A narração deve soar fluida, natural e expressiva em português brasileiro, como alguém explicando ciência em uma conversa. Voz mecânica, metálica, monótona ou robótica reprova a entrega.
- Selecionar uma voz predefinida do provedor e orientar ritmo confortável, pausas de frase, entonação variada e pronúncia clara, sem imitar uma pessoa real.
- Preparar siglas, números, unidades e termos científicos para leitura sem mudar seu significado. Mudança factual exige nova auditoria.
- Separar direção vocal do texto: o modelo não deve ler instruções, marcações ou nomes de campos. Não acelerar artificialmente o áudio para caber em três minutos.
- Gemini TTS é candidato, não garantia de naturalidade. Expo reproduz o arquivo; a qualidade depende do modelo, da voz e da direção vocal.
- No Marco 0, comparar pelo menos duas vozes disponíveis, dentro da cota, com o mesmo trecho contendo termos científicos, números e uma limitação. Os três integrantes avaliam naturalidade, pronúncia, ritmo e fidelidade. Registrar modelo, voz, instruções e resultado em `docs/deployment.md`.
- No Marco 2, ouvir um episódio completo elegível por tema, além de amostras em alto-falantes e fones de Android e iPhone. Reprovar palavras omitidas, distorções, pausas anormais ou efeito robótico perceptível; resolver divergências do grupo antes do aceite.
- Testes de amostras qualificam a configuração, mas não garantem cada geração futura. Oferecer relato de problema no áudio, investigar e invalidar arquivos confirmados como defeituosos.
- Se nenhuma opção gratuita atender ao requisito, registrar bloqueio de qualidade. Não trocar silenciosamente por voz do sistema nem ativar cobrança. Regeneração corretiva respeita a cota e o limite de tentativas.
- Aplicar os mesmos critérios aos aprofundamentos de 30–60 segundos.

### 2.5 Ficha de evidências

Título obrigatório: **“O que sabemos × O que falta descobrir”**.

Exibir:

1. Resultado principal.
2. Evidência que sustenta o resultado, incluindo contexto relevante como amostra ou tipo de estudo.
3. Principal limitação.
4. Referências vinculadas aos itens.

Quando uma limitação específica não puder ser determinada, dizer isso. Não inventar uma limitação genérica e atribuí-la ao estudo. Se a ausência impedir uma explicação responsável da descoberta, ela deve ser considerada inelegível.

### 2.6 Aprofundamento — segunda etapa

Perguntas fixas:

```text
method      -> Como os cientistas descobriram isso?
unknowns    -> O que ainda não sabemos?
simplify    -> Me explica de um jeito mais simples.
```

- Aparecem após a conclusão do episódio principal.
- Cada pergunta gera sua resposta somente após o clique.
- Cada resposta tem áudio independente de **30 a 60 segundos**.
- Não adicionar a resposta ao arquivo ou à duração do episódio principal.
- Reutilizar as evidências do episódio, sem busca adicional automática nesta versão.
- Reconhecer explicitamente quando as evidências não sustentarem uma resposta completa.
- Não alongar uma resposta com afirmações inventadas para alcançar 30 segundos. Pode explicar por que não sabemos e o que seria necessário investigar.
- Se não for possível produzir uma resposta sustentada dentro do intervalo, informar a limitação e não liberar áudio fora do requisito.
- Pausar o episódio quando uma resposta começar a tocar e vice-versa.

## 3. Ferramentas escolhidas

As escolhas abaixo são a stack proposta para o grupo. A disponibilidade dos planos gratuitos é uma condição de início, não algo já validado por este documento.

### 3.1 Linguagem e organização

- **TypeScript:** interface, backend e contratos compartilhados.
- **Node.js LTS compatível com as ferramentas:** utilizado no desenvolvimento e na compilação; a produção roda no runtime do Cloudflare Workers.
- **npm workspaces:** um repositório com interface, API e contratos compartilhados, usando um único gerenciador de pacotes.
- **Git e GitHub:** versionamento, branches, pull requests e tarefas.
- **ESLint e Prettier:** verificações consistentes de estilo e problemas básicos.
- Registrar versões aprovadas, versão do Node e arquivo de lock. Não deixar cada IA escolher versões incompatíveis.

### 3.2 Interface mobile

- **React Native + Expo + TypeScript:** aplicativo compartilhado para Android e iOS.
- **Expo Router:** navegação nativa entre telas.
- **Componentes nativos e StyleSheet:** interface com áreas seguras, teclado, fonte ampliada e controles acessíveis.
- **expo-audio:** reprodução do arquivo de voz, pausa, duração, progresso e término. Esta biblioteca reproduz áudio; Gemini gera a narração.
- **expo-secure-store:** adaptador de armazenamento de sessão compatível com Supabase Auth; validar renovação, logout e limites de armazenamento. Nunca guardar chave Gemini no dispositivo.
- **React Native Linking:** abrir referências HTTPS e retornos de autenticação quando necessários.
- Fixar Expo SDK compatível com os dispositivos e Expo Go do piloto; instalar bibliotecas Expo com `npx expo install` e registrar versões mínimas Android/iOS.
- **Fetch API:** comunicação com o backend.
- A interface nunca chama Gemini diretamente.
- O player reproduz áudios gerados pelo serviço; não substituir por `expo-speech` ou voz padrão do sistema. Não usar DOM, CSS de navegador, HTMLAudioElement ou localStorage na implementação mobile.

### 3.3 Backend e publicação

- **Hono + TypeScript:** rotas HTTP e organização dos módulos.
- **Cloudflare Workers Free:** executar o backend online.
- O Worker hospeda somente a API HTTPS. O aplicativo Expo roda no dispositivo e utiliza essa API.
- **Wrangler:** desenvolvimento, configuração e publicação.
- Usar o subdomínio gratuito disponibilizado pela plataforma; não comprar domínio.
- O Worker faz consultas HTTP e coordena as etapas. Não executa modelos de IA, FFmpeg ou processamento pesado de áudio.
- Verificar limites de CPU, memória, requisições e tamanho de resposta antes da escolha final. Um arquivo de áudio pequeno ainda pode ter custo relevante de memória quando codificado em base64.

### 3.3.1 Distribuição mobile com orçamento zero

- **Expo Go:** gratuito para desenvolver e testar funcionalidades compatíveis em Android e iPhone. Não equivale a um app independente publicado.
- **EAS Build:** candidato para builds dentro da cota gratuita efetivamente disponível. Não contratar plano ou excedentes; registrar limites antes do uso.
- Android: prever APK de teste instalável fora da loja, com instruções claras de instalação e origem conhecida.
- iPhone: começar pelo Expo Go. Builds próprios em aparelho físico exigem avaliar assinatura, provisionamento e acesso ao Apple Developer Program. Simulador iOS requer macOS/Xcode; não presumir que o Windows oferece esse simulador.
- Publicação nas lojas é uma etapa separada e normalmente exige contas pagas: Google Play cobra cadastro e Apple Developer cobra assinatura. R$ 0 não permite prometer lançamento nas duas lojas sem acesso institucional elegível ou outra condição oficialmente confirmada.
- Pessoa 1 documenta com a pessoa 3 o caminho de entrega em `docs/mobile-distribution.md`: plataforma, aparelho, Expo Go/build próprio, custos e bloqueios. Não declarar distribuição independente concluída se apenas Expo Go com servidor Metro de um integrante foi testado.
- Computador de desenvolvimento pode ser necessário durante testes; isso não atende sozinho ao requisito de operação independente do produto final.
- Reprodução com tela bloqueada, controles do sistema e comportamento em segundo plano exigem configuração e testes em build nativo compatível. Expo Go sozinho não comprova esses recursos em produção; registrar separadamente qualquer bloqueio de validação no iPhone.

### 3.4 Login, banco e arquivos

- **Supabase Free:** PostgreSQL, autenticação e armazenamento de áudio.
- **Supabase Auth:** cada pessoa usa sua própria conta; não compartilhar senhas.
- **PostgreSQL:** fontes, descobertas, seleções, roteiros, etapas, histórico, idempotência e uso de cotas.
- **Supabase Storage:** bucket privado para os áudios; acesso por URL assinada de curta duração.
- **SDK JavaScript do Supabase:** acesso por HTTP, compatível com o backend escolhido.
- Não adicionar Cloudflare D1 ou R2 nesta versão: evitar bancos redundantes e mais serviços para configurar.
- Piloto fechado: contas dos três integrantes e de testadores convidados; cadastro público fica para uma decisão posterior.
- Confirmar como convidar/criar contas sem depender de envio ilimitado de e-mails ou serviço pago de e-mail.

Na consulta de 29/10/2026, a página do Supabase Free informa **500 MB de banco, 1 GB de arquivos, 5 GB de egress e pausa após uma semana de inatividade**. Isso não significa capacidade ilimitada e precisa ser conferido novamente antes da publicação. Não usar tentativas artificiais de manter projeto ativo para contornar políticas.

### 3.5 IA de texto e voz

- **Gemini Developer API:** integração exclusivamente pelo backend.
- **Google AI Studio:** conferir chave, modelos, cotas e acesso gratuito.
- Texto: candidato inicial **`gemini-2.5-flash-lite`**, condicionado a disponibilidade, qualidade e acesso gratuito real na conta.
- Voz: candidato inicial **`gemini-3.1-flash-tts-preview`**, condicionado ao mesmo teste e aceitando que modelos preview podem mudar.
- Os nomes são candidatos documentados em 29/10/2026, não promessas de disponibilidade futura.
- Configurar o modelo em variáveis de ambiente; não espalhar nomes pelo código.
- Usar a API HTTP oficial com `fetch` no backend. Um SDK só deve ser adicionado se o grupo registrar a necessidade e verificar compatibilidade com Workers.
- Usar saída estruturada quando suportada e validar com **Zod**. JSON válido não prova que o conteúdo seja verdadeiro.
- Não confundir Gemini Developer API com Google Cloud Text-to-Speech: são serviços com regras de cobrança distintas.
- Não habilitar pesquisa Google, ferramentas extras ou outros recursos de Gemini sem verificar sua cota e gratuidade específicas.
- A documentação do plano gratuito informa possível uso do conteúdo para melhoria de produtos. Enviar apenas material científico necessário; não enviar e-mail, senha, histórico pessoal completo ou dados sensíveis do usuário.

### 3.6 Fontes científicas

- **NASA e feeds institucionais:** candidatos para Espaço e observação da Terra.
- **Europe PMC:** candidatos para Saúde, Cérebro e parte de Natureza.
- **arXiv:** candidatos para Física, Tecnologia e Espaço; identificar claramente preprints e status editorial conhecido.
- **OpenAlex:** descoberta de publicações por área; não é garantia de acesso ao texto integral nem certificado de qualidade.
- Fontes complementares podem ser adicionadas por adaptadores após verificar documentação, acesso e termos aplicáveis.
- Consultar APIs e feeds oficiais. Não depender de raspagem de resultados de Google ou de contornar paywalls.
- Respeitar limites por provedor e usar cache.
- Não tratar cota gratuita do OpenAlex como cobrança obrigatória; não ativar uso pré-pago nem excedentes.

### 3.7 Testes

- **Vitest:** regras de negócio, módulos e contratos.
- **Jest com jest-expo + React Native Testing Library:** componentes e interações mobile.
- **Mocks do cliente HTTP:** respostas controladas no app; MSW pode ser usado no backend quando compatível.
- **Testes ponta a ponta mobile:** roteiro manual obrigatório em Android e iPhone; automação nativa posterior sem serviço pago. Testes no navegador não comprovam funcionamento mobile.
- Testes automáticos usam simulações por padrão. Chamadas reais ao Gemini exigem habilitação explícita e consomem a cota compartilhada.
- Não adicionar teste real de geração a cada commit.

## 4. Arquitetura

```text
App Android / iPhone
  React Native + Expo: temas, descobertas, player e histórico
                   |
                   v
Único backend Hono em Cloudflare Workers
  auth -> research -> selection -> episodes
                             -> scripts -> evidence -> speech
                             -> followups (segunda etapa)
  compartilhados: gemini, quota, persistence, errors, logging
            |                  |                  |
            v                  v                  v
    Fontes científicas      Gemini API        Supabase
                                             Auth / DB / áudio
```

### 4.1 Responsabilidade de cada módulo

- **auth:** verificar identidade e autorização de cada operação.
- **research:** consultar provedores, normalizar fontes e obter conteúdo suficiente.
- **selection:** aplicar elegibilidade, ranking, histórico e duplicatas.
- **episodes:** registrar a escolha e controlar o estado do episódio.
- **scripts:** gerar o roteiro e sua relação com as fontes.
- **evidence:** validar dados, citações e suporte das afirmações; produzir o resultado da revisão.
- **speech:** narrar apenas roteiros aprovados, verificar formato e duração e armazenar o áudio.
- **followups:** respostas a perguntas fixas, independentes do episódio.
- **gemini:** único adaptador de acesso ao provedor de IA; reutilizado pelos outros módulos.
- **quota:** reserva de capacidade, limite de concorrência e interrupção quando a cota não permitir continuar.
- **persistence:** interfaces de banco e armazenamento; sem SQL duplicado em componentes.

### 4.2 Princípios de execução

- Cada etapa deve ter uma chamada delimitada e um resultado persistido.
- Evitar uma única requisição que busca fontes, gera roteiro, audita e produz voz de uma só vez.
- Não depender de trabalho invisível continuar após a resposta HTTP. Esta versão não pressupõe fila ou serviço de background gratuito.
- A escolha do usuário autoriza a sequência roteiro -> revisão -> voz daquele episódio. A interface pode avançar automaticamente entre essas etapas, exibindo o progresso.
- Reabrir o app não pode iniciar outra geração. Primeiro consultar o estado existente.
- Operações caras têm chave de idempotência e reserva atômica de execução no banco.
- Uma chamada que perdeu a conexão pode já ter consumido cota. Não repetir automaticamente sem resolver o estado da tentativa.
- O limite real de execução no ambiente hospedado deve ser testado. Se uma etapa não couber, registrar a limitação antes de adicionar filas ou mudar hospedagem.

## 5. Estrutura proposta do repositório

```text
eureka/
  PLANO_DO_PROJETO_EUREKA.md
  README.md
  package.json
  package-lock.json
  .gitignore
  .env.example
  apps/
    mobile/
      app.config.ts
      eas.json
      src/
        app/                    # rotas Expo Router
        features/auth/
        features/themes/
        features/discoveries/
        features/episodes/
        features/history/
        features/followups/
        components/
        services/
        styles/
    api/
      src/
        index.ts
        modules/auth/
        modules/research/
        modules/selection/
        modules/episodes/
        modules/scripts/
        modules/evidence/
        modules/speech/
        modules/followups/
        providers/gemini/
        shared/quota/
        shared/persistence/
        shared/errors/
        shared/logging/
      wrangler.jsonc
  packages/
    contracts/src/
  supabase/
    migrations/
  tests/
    fixtures/
    integration/
    e2e/
  docs/
    decisions/
    PESSOA_1_EXPO.md
    PESSOA_2_PESQUISA.md
    mobile-distribution.md
    api-contracts.md
    integration-log.md
    manual-qa.md
  .github/workflows/
```

É uma árvore planejada, não uma afirmação de que esses arquivos já existam. Não criar tudo como pastas vazias só para parecer completo. Criar conforme a primeira entrega vertical.

## 6. Pessoa 1 — Interface e experiência

### 6.1 Propriedade principal

`apps/mobile/**`, configuração Expo, navegação, builds mobile e testes de interface correspondentes. Coordenar distribuição e autenticação com a pessoa 3.

### 6.2 Entregas

**P1-01 — Base visual e navegação**

- Configurar React Native + Expo, Expo Router, telas e componentes nativos; definir identificadores Android/iOS e configuração do app.
- Exibir os seis temas, sem esconder temas por falta temporária de resultados.
- Criar identidade visual coerente, responsiva e legível.
- Separar telas de login, temas, opções, episódio e histórico.
- Integrar o login definido com a pessoa 3.

**P1-02 — Descobertas e escolha**

- Consultar o endpoint de pesquisa.
- Mostrar carregamento, fontes indisponíveis e lista vazia de forma distinta.
- Renderizar de uma a três descobertas sem cartões fictícios.
- Mostrar data em pt-BR sem deslocar o dia por fuso horário.
- Abrir referências em links seguros.
- Acionar seleção explícita ou surpresa.
- Não enviar corpo de fontes ou roteiro inventado pelo aplicativo ao backend.

**P1-03 — Progresso da geração**

- Mostrar estados reais: preparando roteiro, verificando evidências, gerando voz e pronto.
- Desabilitar cliques duplicados e reutilizar a mesma chave de idempotência em uma tentativa repetida.
- Exibir erros específicos sem revelar detalhes de credenciais.
- Se o roteiro já estiver aprovado, repetir apenas a voz.
- Ao voltar de outra tela ou reabrir o app, recuperar o estado do episódio existente.

**P1-04 — Player e ficha**

- Reproduzir, pausar, buscar posição e mostrar duração.
- Implementar com expo-audio, controlar interrupções por chamadas, saída de fones, troca de tela e bloqueio de tela. Evitar players duplicados e liberar recursos corretamente.
- Ao retornar do segundo plano, consultar o estado do servidor; o sistema operacional pode suspender o app durante uma geração. Não depender de tarefas JavaScript continuarem executando indefinidamente.
- Tratar URL de áudio expirada renovando o acesso, não gerando a voz novamente.
- Exibir roteiro acessível para quem não pode ouvir.
- Mostrar ficha e referências vinculadas.
- Registrar conclusão somente quando a reprodução chegar ao fim; não contar mera geração como escuta.
- Manter apenas um áudio tocando.

**P1-05 — Histórico**

- Consultar o histórico do usuário autenticado.
- Exibir descoberta, tema e data de conclusão.
- Não assumir que áudio ainda está armazenado: tratar expiração separadamente do histórico.
- Reproduzir um áudio existente somente após clique.

**P1-06 — Aprofundamento, após marco principal**

- Mostrar as três perguntas fixas após o episódio.
- Solicitar resposta apenas da pergunta escolhida.
- Player separado, aviso de evidência insuficiente e transcrição.
- Reutilizar resposta pronta para a mesma pergunta em vez de gerar novamente.

### 6.3 Critérios de conclusão

- Funciona em Android e iPhone reais, inclusive telas pequenas, áreas seguras, fonte ampliada e botão voltar do Android.
- Controles acessíveis com TalkBack e VoiceOver, rótulos, ordem de foco, áreas de toque adequadas e estados anunciados.
- Zero chamada de IA direta no aplicativo e zero segredo no bundle.
- Testes cobrem zero/uma/duas/três opções, surpresa, dupla seleção, falha de áudio, retomada e cota esgotada.
- Dados de teste são explicitamente identificados e não são fallback de produção.

### 6.4 Dependências e limites

- Depende dos contratos aprovados e de respostas simuladas fornecidas em conjunto com as pessoas 2 e 3.
- Não altera ranking científico, SQL ou instruções do Gemini por conta própria.
- Pode propor mudanças de contrato por pull request; não inventa campos temporários incompatíveis.

## 7. Pessoa 2 — Pesquisa e evidências

### 7.1 Propriedade principal

`modules/research/**`, `modules/selection/**`, regras e testes de evidência, adaptadores de fontes e fixtures científicas.

### 7.2 Entregas

**P2-01 — Mapa de fontes dos seis temas**

- Para cada tema, listar fonte principal, fonte alternativa, endpoint/feed documentado, formato e limites.
- Demonstrar uma consulta real em cada tema quando houver acesso.
- Documentar consultas que retornam zero itens e falhas parciais.
- Não prometer que toda fonte institucional oferece API gratuita ou texto reutilizável.

**P2-02 — Adaptadores e normalização**

- Criar interface comum de busca para provedores.
- Extrair título, autores quando disponíveis, publicador, data, DOI/identificador, endereço e status editorial conhecido.
- Separar data do artigo, data do comunicado, atualização da página e data da coleta.
- Aplicar timeout, limites de tamanho e limites de concorrência.
- Validar endereços e redirecionamentos para evitar acesso a rede privada.
- Tratar texto de páginas como dados, nunca como instruções para ferramentas ou IA.

**P2-03 — Elegibilidade e ranking**

- Exigir tema compatível, data verificável, fonte rastreável e conteúdo suficiente.
- Regra inicial proposta: publicações dos últimos **90 dias**, configurável em `RECENCY_DAYS`.
- Essa janela é uma decisão inicial de implementação, não uma garantia de três opções nem uma medida de qualidade.
- Não ampliar a janela silenciosamente para completar resultados.
- Distinguir artigo revisado, preprint, comunicação institucional e estado desconhecido.
- Para Saúde e Cérebro, priorizar trabalhos revisados; nesta primeira versão, excluir preprints desses dois temas da lista final.
- Nos demais temas, permitir preprints apenas com identificação clara e revisão de adequação.
- Eliminar duplicatas por DOI/identificador primeiro, URL canônica depois, similaridade de título/assunto por último.
- Privilegiar assuntos novos entre candidatos adequados. Um estudo relevante que atualiza um assunto ouvido não é automaticamente repetição.
- Se só existirem opções já ouvidas, permitir mostrá-las com indicação, sem fingir novidade.
- Não transformar contagem de citações em prova de confiabilidade, especialmente para estudos recentes.

**P2-04 — Pacote de evidências**

- Guardar material suficiente para a geração posterior, com versão/hash e data da coleta.
- Guardar conteúdo apenas quando permitido; preferir trechos necessários e não republicar artigos completos na interface.
- Relacionar resultado, método/evidência e limitação com trechos concretos.
- Uma URL isolada, um título ou um texto não lido não contam como validação.
- Material insuficiente torna a descoberta inelegível ou exige uma explicação mais limitada.
- Preparar título e resumo em português. Se for necessário Gemini para tradução/extrair fatos, usar o adaptador central da pessoa 3; não criar outra integração nem gerar roteiro completo nesta etapa.

**P2-05 — Verificação do roteiro**

- Definir a estrutura de referências por afirmação com a pessoa 3.
- Implementar verificações determinísticas: identificadores existentes, trechos realmente presentes, datas coerentes, ausência de fontes inventadas.
- Definir instruções de auditoria de suporte semântico, incluindo causalidade, população estudada, incerteza e limitações.
- Não confundir correspondência literal de citação com suporte de uma conclusão.
- Uma segunda chamada ao Gemini é uma revisão automatizada auxiliar, não garantia de verdade.
- Revisar manualmente os primeiros episódios de cada tema antes da apresentação do piloto.

### 7.3 Critérios de conclusão

- Existem adaptadores e consultas documentadas para os seis temas.
- Resultados têm datas e fontes verificáveis.
- Testes cobrem duplicatas, artigos antigos/futuros, preprints, conteúdo insuficiente, fonte indisponível e histórico.
- Não se inventam opções nem limitações.
- Pacote de evidências pode ser reutilizado sem refazer a busca na etapa de roteiro.
- Auditoria rejeita citações inexistentes e exemplos de extrapolação definidos pelo grupo.

### 7.4 Dependências e limites

- Pessoa 3 fornece persistência, identidade, quota e adaptador Gemini.
- Pessoa 2 é responsável pelo conteúdo e pelas regras; pessoa 3 conecta essas regras ao ciclo de geração.
- Migrações de banco e contratos compartilhados precisam de revisão cruzada.

## 8. Pessoa 3 — IA, áudio, persistência e publicação

### 8.1 Propriedade principal

Backend base, `providers/gemini/**`, `modules/auth/**`, `modules/episodes/**`, `modules/scripts/**`, `modules/speech/**`, `modules/followups/**`, infraestrutura compartilhada, migrações e configuração de publicação.

Essa frente tem mais infraestrutura. As pessoas 1 e 2 devem colaborar com testes, documentação e revisão; não deixar integração e QA inteiramente para a pessoa 3.

### 8.2 Entregas

**P3-01 — Prova de acesso gratuito**

- Confirmar acesso aos modelos de texto e voz, cotas por modelo e disponibilidade de português.
- Executar teste pequeno de texto e voz apenas após configurar a chave com segurança.
- Coordenar com o grupo a aprovação das vozes conforme seção 2.4.1. Acesso gratuito sem qualidade natural não conclui esta tarefa.
- Registrar modelo exato, data do teste, duração/latência, resultado e limitações em `docs/deployment.md`.
- Diferenciar teste com simulação, teste real local e teste no backend hospedado.
- Se voz não estiver disponível na modalidade gratuita, registrar bloqueio. Não trocar por áudio falso nem ativar faturamento.

**P3-02 — Fundação compartilhada**

- Configurar workspaces, backend Hono e implantação inicial com endpoint de saúde.
- Implementar autenticação, autorização e cliente de persistência.
- Criar o adaptador Gemini com timeout, resposta estruturada e classificação de erros.
- Modelos, chaves e cotas ficam centralizados.
- Implementar interfaces falsas de teste compatíveis para as pessoas 1 e 2.

**P3-03 — Geração do roteiro**

- Aceitar somente descoberta pertencente à seleção válida do usuário.
- Carregar o pacote de evidências pelo ID do servidor.
- Gerar título, parágrafos, referências das afirmações e ficha.
- Orientar uma faixa inicial de palavras e medir a duração real posteriormente.
- Validar formato, conteúdo mínimo, idioma e referências.
- Integrar as verificações da pessoa 2 e persistir decisão da auditoria.
- Roteiro reprovado nunca pode ser narrado por um caminho alternativo.

**P3-04 — Áudio**

- Aceitar somente roteiro aprovado, identificado por hash/versão.
- Instruir o modelo a narrar fielmente, em português brasileiro, sem acrescentar explicações.
- Ler o formato/sample rate retornado; não presumir sempre a mesma configuração.
- Se o retorno for PCM, encapsular corretamente em WAV e calcular duração por amostras, canais e profundidade de bits.
- Não medir duração contando caracteres ou pelo tempo da requisição.
- Validar arquivo legível, limites de tamanho e duração antes de disponibilizá-lo.
- Se ultrapassar 180 segundos, não cortar. Permitir no máximo uma tentativa corretiva dentro da cota; se mudar o texto, repetir a auditoria antes de narrar.
- Persistir áudio e duração real. Se upload falhar após geração, não tratar como sucesso e não regenerar automaticamente sem controle.
- Conferir fidelidade da narração ao texto nos testes humanos; duração correta não prova que o TTS leu tudo corretamente.
- Aplicar o requisito de naturalidade da seção 2.4.1; versionar modelo, voz e direção vocal. Mudanças na configuração exigem nova avaliação das amostras.

**P3-05 — Persistência, cotas e segurança**

- Salvar estados entre requisições.
- Garantir uma execução simultânea por episódio/etapa, com bloqueio atômico no banco e prazo de expiração.
- Aplicar autorização antes de usar qualquer chave privilegiada do Supabase.
- Reservar capacidade antes da chamada externa; reconciliar com metadados reais quando disponíveis.
- Tratar 429, acesso negado, modelo indisponível, erro de formato e timeout separadamente.
- Não prometer exatamente quantos episódios a cota permite: busca, tradução, auditoria, voz e perguntas têm consumos diferentes.

**P3-06 — Publicação online**

- Publicar a API no Worker com segredos no ambiente; configurar a base HTTPS no app Expo com a pessoa 1.
- Pessoa 1 coordena builds mobile; pessoa 3 coordena infraestrutura, sessão, renovação de token e deep links autorizados de autenticação, quando usados.
- Configurar Supabase Auth e bucket privado.
- Testar leitura autorizada, isolamento de usuários e expiração de URLs.
- Configurar logs sem segredos e sem textos completos desnecessários.
- Documentar publicação, rollback e exclusão dos recursos.

**P3-07 — Aprofundamentos, depois do marco principal**

- Implementar as três perguntas fixas.
- Reutilizar o pacote de evidências do episódio.
- Gerar, verificar e narrar cada resposta somente quando solicitada.
- Garantir áudio separado de 30 a 60 segundos.
- Cache por usuário, episódio, pergunta e versão do roteiro; não reaproveitar resposta de outra fonte sem verificar equivalência.

### 8.3 Critérios de conclusão

- Episódio inteiro funciona no ambiente publicado sem computador pessoal como servidor.
- Nenhuma chave privada está no Git, frontend, logs ou respostas HTTP.
- Repetição de requisição não duplica geração.
- Estado de falha permite retomada controlada.
- Áudios inválidos não chegam ao player como sucesso.
- Ao faltar cota, novas gerações param e o app continua mostrando conteúdo já pronto quando disponível.

## 9. Contratos compartilhados

`packages/contracts` conterá tipos TypeScript e schemas Zod utilizados pelas duas aplicações. Abaixo estão os campos mínimos; a implementação deve transformar isso em schemas reais, sem copiar apenas os exemplos como validação.

### 9.1 Entidades

**SourceSnapshot — servidor, não exposto integralmente ao aplicativo**

- `id`, `provider`, `canonicalUrl`, `title`, `publisher`.
- `doi`/identificador externo quando existir.
- `publishedAt`: data verificada ou nulo; `publicationDateKind`: artigo/comunicado/preprint.
- `retrievedAt`, `contentHash`, `reviewStatus`.
- `contentScope`: texto integral autorizado / resumo / comunicado / trechos.
- `evidenceExcerpts`: trechos com IDs, localização e procedência.
- `accessStatus`: disponível / parcial / indisponível.

**Discovery — opção selecionável**

- `id`, `themeId`, `title`, `summary`, `publishedAt`.
- `studyKey`: DOI/identificador canônico para deduplicação.
- `topicKey`: chave de assunto, sem usar apenas o título.
- `sourceIds`, `evidencePackageId`, `reviewStatus`.
- Resultado/evidência/limitação extraídos ou indicação de insuficiência.
- Motivos internos de elegibilidade e ranking; não exibir como porcentagem de verdade.

**DiscoveryView — resposta pública da opção**

- `id`, `themeId`, `title`, `summary`, `publishedAt`, `reviewStatus`, `alreadyHeard`.
- `sources`: somente ID, título, publicador, URL e data pertinente.
- Não incluir chaves, instruções internas nem artigo completo.

**SelectionSet — resultado de uma busca**

- `id`, `userId`, `themeId`, `createdAt`, `expiresAt`.
- IDs das opções elegíveis, na ordem de exibição.
- `partial`: alguma fonte falhou.
- `emptyReason`: sem recentes / evidência insuficiente / fontes indisponíveis, quando aplicável.
- Prazo inicial: 24 horas. Após expirar, pedir atualização antes de iniciar um novo episódio.

**Script — roteiro aprovado ou candidato**

- `id`, `version`, `contentHash`, `language`.
- `paragraphs`: ID, texto e IDs das afirmações.
- `claims`: texto da afirmação, IDs de fontes e trechos de apoio.
- `evidenceCard`: resultado, evidência e limitação, cada um com referências.
- `auditStatus`: pendente / aprovado / rejeitado; motivo interno e mensagem segura ao usuário.
- `modelId`, `promptVersion`, `sourcePackageHash`, `createdAt`.

**Episode**

- `id`, `userId`, `selectionSetId`, `discoveryId`, `themeId`.
- `state`, `scriptId`, `audioId`, `createdAt`, `updatedAt`.
- `errorCode` e `retryAfterSeconds`, quando existirem.

**AudioAsset**

- `id`, `userId`, `episodeId`, `followupId` opcional.
- `storagePath`, `mimeType`, `byteLength`, `durationSeconds`, `scriptHash`.
- `createdAt`, `expiresAt`, `status`.
- URL assinada é temporária: gerar no acesso, não tratá-la como caminho permanente.

**Followup**

- `id`, `userId`, `episodeId`, `questionId`, `state`.
- `scriptId`, `audioId`, `insufficientEvidence`, `createdAt`.

**HistoryEntry**

- `userId`, `episodeId`, `discoveryId`, `studyKey`, `topicKey`, `completedAt`.
- Distinguir episódio gerado de episódio ouvido.
- Um evento de conclusão enviado pelo aplicativo é sinal de uso, não prova inviolável de atenção.

### 9.2 Endpoints mínimos propostos

Prefixo: `/api/v1`. Rotas de dados exigem autenticação, exceto saúde/configuração pública mínima. As rotas abaixo são internas do Eureka, não endpoints da API Gemini.

```text
GET    /health
GET    /themes
GET    /capabilities

POST   /discovery-searches
       body: { themeId }
       resposta: { selectionSetId, expiresAt, options, partial, emptyReason }

POST   /episodes
       body: { selectionSetId, discoveryId?, mode: "chosen" | "surprise" }
       cabeçalho: Idempotency-Key
       cria/retorna episódio; não chama IA nesta rota

GET    /episodes/:episodeId

POST   /episodes/:episodeId/script
       gera e audita roteiro a partir do pacote salvo
       cabeçalho: Idempotency-Key

POST   /episodes/:episodeId/audio
       narra somente roteiro aprovado
       cabeçalho: Idempotency-Key

GET    /episodes/:episodeId/audio-access
       retorna URL temporária do áudio já existente

POST   /episodes/:episodeId/completion
       registra conclusão de reprodução de forma idempotente

GET    /history?cursor=...

POST   /episodes/:episodeId/followups
       body: { questionId }
       cria/retorna resposta escolhida; não gera as outras perguntas

GET    /followups/:followupId
POST   /followups/:followupId/script
POST   /followups/:followupId/audio
GET    /followups/:followupId/audio-access
```

Regras dos endpoints:

- `chosen` exige `discoveryId` pertencente ao conjunto. `surprise` escolhe no servidor entre as opções daquele conjunto; não executa nova pesquisa.
- O aplicativo não envia `userId` como autoridade nem texto de roteiro para ser narrado.
- A criação do episódio é seguida pela sequência de etapas somente em decorrência da escolha do usuário.
- Operação já concluída retorna o resultado existente. Operação em andamento retorna conflito/estado em andamento; nunca inicia outra chamada cara.
- GET não gera roteiro, voz ou pesquisa nova.
- Renovar URL assinada de áudio é uma operação de acesso, não de geração.
- `/capabilities` informa apenas disponibilidade, por exemplo `textEnabled`, `speechEnabled`, `followupsEnabled`; não revela chaves ou detalhes de conta.
- Sem trabalho em background confirmado, não retornar `202` prometendo que algo acontecerá sozinho depois. Consulta de estado não deve iniciar geração.

### 9.3 Envelope de erro

```json
{
  "error": {
    "code": "QUOTA_EXHAUSTED",
    "message": "O limite gratuito de geração foi atingido. Tente novamente mais tarde.",
    "retryable": true,
    "retryAfterSeconds": null,
    "requestId": "identificador-da-requisicao"
  }
}
```

Códigos previstos:

```text
AUTH_REQUIRED             401
FORBIDDEN                 403
INVALID_INPUT             400
NOT_FOUND                 404
SELECTION_EXPIRED         409
OPERATION_IN_PROGRESS     409
IDEMPOTENCY_CONFLICT      409
INSUFFICIENT_EVIDENCE      422
SCRIPT_REJECTED           422
AUDIO_DURATION_INVALID    422
QUOTA_EXHAUSTED           429
RATE_LIMITED              429
PROVIDER_UNAVAILABLE      503
STORAGE_UNAVAILABLE       503
STORAGE_LIMIT_REACHED     503
PROVIDER_OUTCOME_UNKNOWN  503
```

Nenhuma descoberta adequada é resultado normal de busca, com `options: []`; não é automaticamente um erro 500. Uma falha total do provedor deve ser identificada como falha, não escondida como lista vazia.

## 10. Estados e recuperação

### 10.1 Episódio

```text
selected
  -> script_generating
  -> script_reviewing
  -> script_ready
  -> audio_generating
  -> ready
```

Estados de interrupção: `script_rejected`, `script_failed`, `audio_failed`, `quota_blocked`, `provider_outcome_unknown`.

- Erro de voz não apaga roteiro aprovado.
- Roteiro alterado invalida o áudio anterior e exige nova auditoria.
- A reprodução concluída é registro de histórico; não destrói o estado `ready`.
- Uma tentativa travada precisa de lease/expiração e recuperação explícita. Não ficar eternamente em “gerando”.
- `provider_outcome_unknown` significa que a chamada pode ter consumido cota sem resposta recuperável. Não repetir imediatamente em loop.

### 10.2 Respostas

Usar a mesma lógica de geração/revisão/voz com identificador separado e limite de 30–60 segundos. Concluir uma resposta não aumenta o tempo do episódio nem registra uma nova descoberta no histórico.

### 10.3 Idempotência

- Persistir chave, usuário, operação, hash do corpo, estado e resultado.
- Mesma chave com corpo diferente retorna conflito.
- Chave nova não deve permitir duas gerações simultâneas da mesma etapa do mesmo episódio.
- Usar transação/função SQL para reivindicar a etapa; não confiar em variável em memória do Worker.
- Modelo/versionamento, pacote de evidências e hash do roteiro participam da decisão de reaproveitamento.

## 11. Banco, áudio e retenção

Entidades/tabelas propostas:

```text
profiles
source_snapshots
discoveries
discovery_sources
selection_sets
selection_options
evidence_packages
episodes
scripts
audio_assets
followups
listening_history
generation_operations
quota_usage
```

- Esquema inicial e migrações sob responsabilidade da pessoa 3, com revisão da pessoa 2 para fontes/evidências.
- Migrações versionadas e progressivas. Nunca editar uma migração já aplicada para disfarçar mudanças.
- IDs pertencentes a usuários precisam de autorização em toda leitura e escrita.
- Políticas de Row Level Security para tabelas expostas ao cliente.
- Chave de serviço do Supabase contorna RLS: se utilizada no backend, exigir checagem explícita de dono e finalidade antes de acessar dados.
- Históricos e áudios não devem ser públicos.
- Compartilhar cache de fontes públicas não autoriza compartilhar histórico ou áudio privado de outro usuário.
- Armazenar binários no Storage, não em colunas de texto/base64 no PostgreSQL.
- Proposta inicial de retenção: áudio por 7 dias, com prazo visível; preservar metadados/histórico. Expiração não pode causar regeneração automática.
- Fontes referenciadas por episódios precisam permanecer disponíveis para auditoria enquanto o episódio estiver retido, respeitando as condições de armazenamento da fonte.
- Definir limpeza explícita e contabilização dos bytes. Não deixar acúmulo ilimitado de arquivos órfãos ou tentativas rejeitadas.
- Remover arquivos expirados por procedimento documentado; automatização futura só após confirmar que não introduz recurso pago.
- Validar o custo de tráfego da reprodução, além do tamanho armazenado. Áudio gratuito para gerar ainda consome armazenamento e egress.
- WAV pode ser adequado ao piloto; não assumir que compressão pesada rodará dentro do Worker. Se armazenamento/tráfego inviabilizar o piloto, registrar e revisar a solução.

## 12. Controle do orçamento

### 12.1 Limites do próprio aplicativo

Definir limites internos conservadores após medir chamadas reais, sempre abaixo das cotas disponíveis:

- Máximo de pesquisas por usuário e por dia.
- Máximo de novos episódios por usuário e por dia.
- Máximo de aprofundamentos por episódio.
- Máximo de chamadas simultâneas ao Gemini por projeto.
- Máximo de tokens/texto enviados por requisição.
- Máximo de tentativas de correção por etapa.
- Limites de bytes armazenados e tráfego de áudio.

Esses números são decisões do grupo. Não inventar valores e descrevê-los como cotas oficiais.

### 12.2 Reaproveitamento

- Cache de consultas e fontes por tema e período, preservando timestamps.
- Aplicar histórico por usuário depois de obter os candidatos comuns.
- Reutilizar roteiro e áudio já aprovados do mesmo episódio quando o usuário tenta novamente.
- Não gerar os três áudios para acelerar uma possível escolha.
- Não pré-gerar as três perguntas de aprofundamento.
- Cache não significa atualizar a data da publicação; mostrar coleta/atualização separadamente quando necessário.
- Se um conteúdo for invalidado ou corrigido, invalidar também os resultados derivados.

### 12.3 Quando a cota acabar

- Parar chamadas novas ao modelo afetado.
- Manter navegação, histórico e reprodução de arquivos existentes quando os serviços correspondentes ainda estiverem disponíveis.
- Informar que a limitação é da modalidade gratuita.
- Respeitar `Retry-After`/orientações documentadas e limitar retentativas.
- Não trocar automaticamente para plano pago, outro projeto ou outra chave para driblar a restrição.
- Indicadores internos ajudam a prevenir excesso, mas a cota real do provedor é a autoridade final.

## 13. Segurança e configuração

### 13.1 Variáveis previstas

Servidor:

```text
GEMINI_API_KEY
GEMINI_TEXT_MODEL
GEMINI_TTS_MODEL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY  (somente se necessário; tratar como segredo privilegiado)
OPENALEX_API_KEY          (opcional; modalidade gratuita)
RECENCY_DAYS
FOLLOWUPS_ENABLED
LIVE_AI_ENABLED
```

Cliente, apenas valores públicos:

```text
EXPO_PUBLIC_API_BASE_URL
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

- A chave publicável do Supabase não é a chave de serviço; acesso precisa estar protegido por políticas.
- Nunca prefixar segredo Gemini ou chave de serviço com `EXPO_PUBLIC_`.
- `.env.example` contém somente nomes e valores fictícios claramente identificados.
- Arquivos reais de ambiente são ignorados pelo Git.
- Não colar chave em chat de IA, prints, issues, commits, documentação ou logs.
- Membros recebem acesso de colaborador às plataformas quando possível, sem compartilhar senha da conta proprietária.
- Configurar credenciais de produção no painel de segredos, não no arquivo de configuração versionado.

### 13.2 Entradas e conteúdo externo

- Validar todas as entradas com schemas.
- Autorizar cada recurso pelo usuário autenticado.
- O cliente escolhe um ID, não uma URL arbitrária para o servidor visitar.
- Adaptadores usam fontes permitidas e validam redirecionamentos, tamanho, tipo e tempo de resposta.
- Não interpretar instruções encontradas em artigos como comandos do sistema.
- Renderizar texto com escape; não injetar HTML bruto das fontes.
- Não enviar dados de autenticação ou histórico identificável ao Gemini. Para seleção, preferir IDs de assuntos já ouvidos processados no próprio backend.
- Evitar logs de prompts completos; registrar etapa, modelo, duração, uso agregado, erro e request ID.

## 14. Cronograma por marcos, não por datas fictícias

### Marco 0 — Viabilidade e acordo técnico

Participação dos três.

- Pessoa 1: fluxo de telas e contratos necessários.
- Pessoa 1: app Expo mínimo em Android e iPhone e caminho de distribuição documentado.
- Pessoa 2: teste de acesso a fontes nos seis temas.
- Pessoa 3: acesso gratuito a texto/voz, banco, armazenamento e hospedagem; primeira chamada hospedada pequena.
- Aprovar tipos, árvore, convenções e limites.
- Os três: aprovar amostras de voz natural e registrar os limites de distribuição gratuita.
- Registrar todas as verificações e o que ainda não foi testado.

**Saída:** evidência de que as dependências permitem um piloto online sem pagamento. Se uma dependência essencial falhar, resolver antes de construir o app inteiro.

### Marco 1 — Temas, busca e escolha

- Seis temas navegáveis.
- Fontes reais integradas e opções com datas.
- Zero/uma/duas/três opções e falhas parciais tratados.
- Seleção explícita e surpresa válidas no servidor.
- Nenhuma geração de roteiro completo ou voz na busca.

**Saída:** usuário escolhe uma descoberta real.

### Marco 2 — Episódio completo

- Roteiro e auditoria com fontes preservadas.
- Narração, validação de duração e Storage.
- Voz natural aprovada em testes reais conforme seção 2.4.1 e fluxo completo validado em Android e iPhone.
- Player, transcrição e ficha.
- Histórico, idempotência, autorização e limites.
- Revisão humana dos primeiros episódios de cada tema.

**Saída:** fluxo principal passa nos testes no ambiente online. Este marco bloqueia o início funcional dos aprofundamentos.

### Marco 3 — Aprofundamentos

- Três perguntas fixas.
- Texto e áudio gerados apenas após escolha.
- Respostas separadas, duração correta e reconhecimento de insuficiência.
- Reaproveitamento de resposta pronta e erro isolado do episódio principal.

### Marco 4 — Entrega do piloto

- Teste em Android e iPhone; registrar dispositivo, versão do sistema e modalidade (Expo Go ou build próprio).
- Teste de cotas esgotadas e serviços indisponíveis.
- Revisão de segurança, chaves e autorização.
- Documentação de acesso, execução, publicação, rollback e exclusão.
- Demonstração com contas de teste e conteúdo científico conferido.

## 15. Como trabalhar em grupo sem as IAs sobrescreverem tudo

### 15.1 Organização

- Um repositório compartilhado.
- Branch principal sempre compilando.
- Cada tarefa em branch curta: `feat/p1-player`, `feat/p2-europe-pmc`, `feat/p3-gemini-speech` etc.
- Pull requests pequenos, com objetivo, arquivos alterados, testes e limitações.
- Revisão de outro integrante antes de integrar alterações importantes.
- Não deixar integração para o último dia.
- Usar issues com dono, dependências e critérios de aceite.

### 15.2 Donos de arquivos compartilhados

- Pessoa 3 coordena arquivos raiz, lockfile, publicação e migrações.
- Pessoa 2 coordena conteúdo dos contratos de fonte/descoberta/evidência.
- Pessoa 3 coordena contratos de episódio, autenticação e áudio.
- Pessoa 1 revisa os contratos expostos à interface.
- Mudança em `packages/contracts` deve ser aprovada pelos consumidores afetados.
- Ninguém renomeia endpoint/campo compartilhado silenciosamente.
- Novas dependências entram por alteração coordenada; não manter três lockfiles diferentes.

### 15.3 Decisões

Registrar decisões em `docs/decisions/` com:

```text
Contexto
Decisão
Motivo
Impacto nas outras pessoas
Impacto no orçamento
Como foi validada
O que permanece incerto
```

Se uma decisão conflitar com este documento, atualizar a especificação junto com o código. A IA não deve resolver conflito de requisitos inventando uma exceção.

## 16. Testes mínimos obrigatórios

### 16.1 Busca e seleção

- Todos os seis IDs reconhecidos; tema desconhecido rejeitado.
- Datas antigas, futuras, ausentes e datas de atualização confundidas com publicação.
- Mesmo estudo em dois provedores.
- História já ouvida versus alternativa inédita.
- Atualização relevante de assunto antigo.
- Uma e duas opções sem preenchimento artificial.
- Nenhuma opção adequada.
- Falha parcial e falha total de fontes.
- Fonte maliciosa, endereço privado e redirecionamento não autorizado.

### 16.2 Roteiro e evidências

- Nenhum roteiro completo antes da escolha.
- Tentativa de escolher descoberta fora do conjunto.
- Nenhuma busca nova silenciosa durante geração.
- Fonte e trecho inexistentes.
- Afirmação não sustentada por trecho verdadeiro.
- Associação apresentada como causa.
- Estudo em animais generalizado para humanos.
- Falta de dados reconhecida.
- Texto de fonte tentando instruir a IA.

### 16.3 Áudio e reprodução

- Nenhum áudio de roteiro reprovado.
- Áudio vazio, corrompido ou com formato inesperado.
- Episódio com duração real acima de 180 segundos.
- Resposta abaixo de 30 ou acima de 60 segundos.
- URL de Storage expirada e renovação sem nova geração.
- Repetição de clique e concorrência entre abas.
- Falha de upload após geração.
- Fechamento e reabertura do app durante cada etapa.
- Apenas um player tocando.

### 16.4 Segurança e orçamento

- Usuário A não lê roteiro, histórico ou áudio privado de B.
- Credenciais não aparecem no bundle ou nos logs.
- Cota esgotada bloqueia chamadas novas.
- Mesma operação repetida não duplica consumo.
- Falha de rede não gera loop de retentativas.
- Limite de armazenamento impede upload sem apagar arquivos ativos arbitrariamente.
- Configuração de produção não ativa simuladores.

### 16.5 Integração e revisão humana

- Percorrer tema -> opções -> escolha -> roteiro -> áudio -> ficha -> histórico no app Android e iPhone conectado ao backend hospedado.
- Fazer ao menos uma revisão de conteúdo de cada tema, se houver descoberta adequada disponível.
- Se um tema não tiver resultado real no dia, registrar isso; testar sua UI com fixture, sem chamar a fixture de validação real.
- Avaliar pronúncia, clareza, fidelidade e compreensão, não apenas status HTTP 200.
- Distinguir na documentação o que passou com mocks do que passou com serviços reais.

## 17. Prompts para cada integrante usar com sua IA

### 17.1 Pessoa 1

```text
Leia integralmente PLANO_DO_PROJETO_EUREKA.md, as decisões em docs/decisions
e os contratos existentes em packages/contracts. Estou responsável pela
Pessoa 1: interface mobile Android/iOS com React Native + Expo.

Implemente somente a tarefa [ID E DESCRIÇÃO] na minha branch. Mantenha os
seis temas, o orçamento zero e o funcionamento online. Não mude contratos,
dependências compartilhadas ou arquivos de outra pessoa sem explicar a
necessidade e coordenar a alteração.

Antes de editar, informe o marco atual, dependências da tarefa, arquivos
que pretende alterar e critérios de aceite. Use mocks identificados se a
API ainda não estiver pronta, sem apresentá-los como dados reais.

Não coloque segredos no frontend. Ao terminar, execute os testes adequados
e relate mudanças, testes executados e limitações. Não declare integração
real concluída se só testou com mocks.
```

### 17.2 Pessoa 2

```text
Leia integralmente PLANO_DO_PROJETO_EUREKA.md, docs/decisions e os contratos
existentes. Estou responsável pela Pessoa 2: pesquisa, seleção e evidências.

Implemente somente a tarefa [ID E DESCRIÇÃO]. Use documentação oficial das
fontes, respeite cotas e cubra os seis temas. Não invente resultados, datas,
trechos, limitações ou status de revisão científica.

Preserve o pacote de evidências para reutilização. Se precisar de Gemini,
use o adaptador central, com quota; não crie outra integração. Não gere
roteiro completo ou áudio durante a busca.

Antes de editar, indique os contratos consumidos/produzidos e qualquer
dependência de outra pessoa. Termine com testes, fontes verificadas e
distinção entre dados reais, mocks e verificações ainda pendentes.
```

### 17.3 Pessoa 3

```text
Leia integralmente PLANO_DO_PROJETO_EUREKA.md, docs/decisions e os contratos
existentes. Estou responsável pela Pessoa 3: Gemini, episódios, voz,
persistência, autenticação e publicação.

Implemente somente a tarefa [ID E DESCRIÇÃO]. O sistema é online e usa
modalidades gratuitas. Não habilite faturamento, plano pago, excedentes,
recarga ou infraestrutura nova sem decisão explícita do grupo.

Confirme modelos/cotas com documentação e conta antes de afirmar suporte.
Não peça para colar segredos no chat nem os grave no repositório. Use apenas
credenciais configuradas pelo fluxo seguro acordado e chamadas reais de
teste expressamente habilitadas.

Exija escolha antes do roteiro e aprovação antes da voz. Valide voz natural em pt-BR conforme seção 2.4.1, sem fallback robótico. Reutilize fontes,
controle idempotência, autorização, estados e cotas. Não implemente
aprofundamentos antes da aprovação do Marco 2.

Ao terminar, informe arquivos alterados, testes, consumo de chamadas reais
se houver, limites encontrados e passos manuais que ainda faltam.
```

### 17.4 Prompt de revisão, para qualquer pessoa

```text
Revise este pull request contra PLANO_DO_PROJETO_EUREKA.md e os contratos
atuais. Procure falhas de comportamento, evidência científica, autorização,
idempotência e orçamento zero. Não reescreva todo o projeto e não implemente
outra frente. Priorize problemas concretos, indicando arquivo, impacto e
forma de reproduzir. Diferencie erro confirmado, risco e sugestão opcional.
```

### 17.5 Como usar esses prompts

1. Cada integrante clona o mesmo repositório e cria sua branch.
2. Abre a pasta inteira no editor; não envia apenas um arquivo isolado sem contexto.
3. Pede à IA para ler este documento e informa **qual pessoa representa e qual tarefa vai executar**.
4. Confere a proposta de alteração e os arquivos afetados.
5. Revisa o código, executa testes e abre pull request.
6. Outro integrante revisa; decisões compartilhadas são registradas.

Ler o Markdown ajuda bastante, mas não garante que IAs diferentes mantenham consistência sozinhas. Tipos compartilhados, testes de contrato e revisão são os mecanismos que evitam incompatibilidades.

## 18. Critério de pronto do projeto

O piloto só está pronto quando:

- [ ] Os seis temas existem e têm integração de fontes documentada.
- [ ] Busca mostra até três descobertas reais, com título, resumo e data.
- [ ] Nenhuma opção é inventada para preencher a tela.
- [ ] Escolha e “Me surpreenda” operam apenas sobre opções válidas.
- [ ] Roteiro e voz são gerados somente após escolha.
- [ ] Fontes da busca são reutilizadas e sustentam as afirmações aceitas.
- [ ] Episódio tem no máximo três minutos reais de áudio.
- [ ] Narração natural, sem efeito mecânico ou robótico, aprovada em testes reais documentados.
- [ ] App React Native + Expo testado em Android e iPhone; modalidade de distribuição e bloqueios explicitados.
- [ ] Builds independentes e recursos nativos não são declarados concluídos apenas com testes no Expo Go.
- [ ] Ficha apresenta resultado, evidência e limitação, sem porcentagens de veracidade.
- [ ] Histórico orienta novidade sem misturar usuários.
- [ ] Fluxo principal foi validado antes dos aprofundamentos.
- [ ] Perguntas geram respostas separadas de 30 a 60 segundos somente após clique.
- [ ] Insuficiência de evidências é reconhecida.
- [ ] App funciona online sem servidor no computador dos integrantes.
- [ ] Cotas esgotadas são tratadas sem cobrança automática.
- [ ] Login, dados e arquivos respeitam autorização.
- [ ] Há testes com mocks e registro separado dos testes reais.
- [ ] Há documentação para configurar, publicar, recuperar e excluir o sistema.

## 19. Fontes oficiais e verificação de condições

Consultadas em 29/10/2026. Documentação e planos podem mudar; a pessoa responsável deve registrar uma nova verificação antes da implementação/publicação. Exemplos e valores deste documento não são garantia contratual de serviço.

- Gemini: preços e modelos gratuitos — https://ai.google.dev/gemini-api/docs/pricing
- Gemini: cotas — https://ai.google.dev/gemini-api/docs/rate-limits
- Gemini: geração de voz — https://ai.google.dev/gemini-api/docs/speech-generation
- Gemini: saída estruturada — https://ai.google.dev/gemini-api/docs/structured-output
- Cloudflare Workers: limites — https://developers.cloudflare.com/workers/platform/limits/
- Expo Router — https://docs.expo.dev/router/introduction/
- Expo Audio — https://docs.expo.dev/versions/latest/sdk/audio/
- Expo: builds e contas das lojas — https://docs.expo.dev/build/setup/
- Expo: ambiente de desenvolvimento — https://docs.expo.dev/get-started/set-up-your-environment/
- Expo: gratuidade do Expo Go — https://docs.expo.dev/faq/
- Hono em Cloudflare Workers — https://hono.dev/docs/getting-started/cloudflare-workers
- Supabase: plano gratuito — https://supabase.com/pricing
- Supabase Storage: controle de acesso — https://supabase.com/docs/guides/storage/security/access-control
- NASA: feeds — https://www.nasa.gov/rss-feeds/
- Europe PMC: API — https://europepmc.org/RestfulWebService
- arXiv: API — https://info.arxiv.org/help/api/user-manual.html
- OpenAlex: API — https://help.openalex.org/api/
- OpenAlex: modalidade gratuita e preços — https://help.openalex.org/access/pricing/

## 20. Primeiras tarefas do grupo

1. Preencher os nomes: Pessoa 1 = ___; Pessoa 2 = ___; Pessoa 3 = ___.
2. Ler e aprovar a especificação; registrar dúvidas antes de gerar código em paralelo.
3. Criar o repositório compartilhado e as tarefas do Marco 0.
4. Validar fontes, Gemini texto/voz e hospedagem sem pagamento.
5. Definir os contratos executáveis e exemplos de resposta.
6. Começar as três frentes do Marco 1.

**Regra final para as IAs:** entregar a tarefa combinada, preservar os contratos e relatar o que foi realmente verificado. Não simular conclusão, não esconder bloqueios e não acrescentar dependências pagas para fazer o projeto parecer pronto.
