import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const C = { bg: "#050706", card: "#121713", raised: "#1A211D", line: "#29342D", text: "#F2F5F2", muted: "#9CA9A0", green: "#69C895", darkGreen: "#1D6744", mint: "#173626", error: "#F2A18D" };

const TOPICS = [
  ["Astronomia e espaço", "🪐"],
  ["Biologia e biodiversidade", "🦋"],
  ["Saúde e medicina", "🫀"],
  ["Meio ambiente e clima", "🌱"],
  ["Física e química", "⚗️"],
  ["Computação e robótica", "🤖"],
];

const SAMPLE = {
  "Astronomia e espaço": [
    ["O universo está se expandindo mais rápido do que esperávamos?", "Uma pergunta em aberto na cosmologia: diferentes métodos para estimar a expansão do universo chegam a resultados distintos."],
    ["Planetas errantes viajam sem uma estrela", "Explore como astrônomos procuram mundos que não parecem orbitar uma estrela."],
    ["A Lua também tem pequenos terremotos", "Missões lunares encontraram sinais de atividade sísmica e novas perguntas sobre o interior da Lua."],
  ],
  "Biologia e biodiversidade": [
    ["Florestas têm redes subterrâneas de fungos?", "Fungos e raízes interagem no solo. Pesquisadores investigam como essas relações funcionam nos ecossistemas."],
    ["Polvos editam o próprio RNA para lidar com o frio", "Um exemplo de como alguns animais podem ajustar moléculas envolvidas no funcionamento de suas células."],
    ["O canto das baleias muda com o ambiente", "Bioacústica ajuda pesquisadores a acompanhar vocalizações, migrações e mudanças no ambiente marinho."],
  ],
  "Saúde e medicina": [
    ["O que o sono faz com a memória?", "Estudos investigam como diferentes fases do sono participam da consolidação de memórias."],
    ["Bactérias intestinais e medicamentos", "A microbiota pode interagir com alguns medicamentos; as aplicações clínicas seguem em estudo."],
    ["Por que a dor pode persistir depois da lesão?", "Pesquisas sobre dor crônica investigam mudanças no sistema nervoso e diferenças entre pessoas."],
  ],
  "Meio ambiente e clima": [
    ["Recifes podem encontrar refúgio em águas profundas?", "Cientistas estudam se áreas mais profundas podem ajudar a proteger espécies de coral sob pressão climática."],
    ["Como as cidades podem reduzir o calor", "Árvores, sombra e materiais urbanos são algumas das estratégias estudadas para reduzir ilhas de calor."],
    ["O solo guarda grandes estoques de carbono", "O carbono do solo tem papel importante nos ecossistemas e no ciclo global do carbono."],
  ],
  "Física e química": [
    ["Cristais do tempo: padrões que se repetem", "Sistemas quânticos podem apresentar padrões periódicos no tempo; o nome não descreve uma máquina de movimento perpétuo."],
    ["O caminho dos íons pode inspirar baterias melhores", "A estrutura dos materiais e o movimento de íons são estudados para entender o desempenho de baterias."],
    ["Vidro é sólido ou líquido?", "O vidro é um sólido amorfo, com uma estrutura diferente da organização regular de um cristal."],
  ],
  "Computação e robótica": [
    ["Robôs podem aprender tarefas observando vídeos?", "Pesquisadores testam como demonstrações podem ensinar habilidades a robôs e quais são os limites dessa abordagem."],
    ["Computadores quânticos e correção de erros", "Qubits são sensíveis a ruído; códigos de correção são uma área ativa de pesquisa."],
    ["Sensores dão tato às mãos robóticas", "Sensores táteis ajudam robôs a detectar pressão e contato ao manipular objetos."],
  ],
};

const QUESTIONS = [
  "Como os pesquisadores estudam esse fenômeno?",
  "O que ainda falta descobrir?",
  "Como isso pode afetar o nosso futuro?",
];

function makeSample(topic) {
  return SAMPLE[topic].map((entry, index) => ({
    id: topic + "-" + index,
    title: entry[0],
    summary: entry[1],
    date: ["18 out 2026", "12 out 2026", "03 out 2026"][index],
    source: "Mock de interface · fonte científica não conectada",
    known: "A evidência disponível será resumida aqui quando a busca científica for conectada.",
    unknown: "Limitações e perguntas abertas serão preenchidas com base nas fontes verificadas.",
    questions: QUESTIONS,
  }));
}

// Substituir esta função pela API quando o contrato estiver disponível.
async function getDiscoveriesMock(topic) {
  await new Promise((resolve) => setTimeout(resolve, 450));
  if (!SAMPLE[topic]) throw new Error("Tema indisponível");
  return makeSample(topic).slice(0, 3);
}

function Button({ label, onPress, secondary, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondaryButton : styles.primaryButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

function Player({ label, duration, onStart }) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      setPosition((current) => {
        if (current + 1 >= duration) {
          clearInterval(timer);
          setPlaying(false);
          return duration;
        }
        return current + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, duration]);

  const toggle = () => {
    if (position >= duration) setPosition(0);
    const next = !playing;
    setPlaying(next);
    if (next && onStart) onStart();
  };

  return (
    <View style={styles.player}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={(playing ? "Pausar " : "Reproduzir ") + label}
        onPress={toggle}
        style={styles.playButton}
      >
        <Text style={styles.playIcon}>{playing ? "Ⅱ" : "▶"}</Text>
      </Pressable>
      <View style={styles.playerContent}>
        <Text style={styles.playerLabel}>{label}</Text>
        <Text style={styles.caption}>Player de demonstração · áudio não incluído</Text>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: duration, now: position }} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: (position / duration * 100) + "%" }]} />
        </View>
      </View>
      <Text style={styles.time}>{time(position)} /{"\n"}{time(duration)}</Text>
    </View>
  );
}

function time(seconds) {
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

export default function App() {
  const requestRef = useRef(0);
  const [topic, setTopic] = useState(TOPICS[0][0]);
  const [discoveries, setDiscoveries] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [selected, setSelected] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [history, setHistory] = useState([]);

  async function load(subject) {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoadState("loading");
    setDiscoveries([]);
    setSelected(null);
    setEpisode(null);
    setActiveQuestion(null);
    try {
      const result = await getDiscoveriesMock(subject);
      if (requestId !== requestRef.current) return;
      setDiscoveries(result);
      setLoadState("success");
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setLoadState("error");
    }
  }

  useEffect(() => { load(topic); }, [topic]);

  const fresh = discoveries.filter((item) => !history.some((heard) => heard.id === item.id));

  function surprise() {
    if (!fresh.length) return;
    setSelected(fresh[Math.floor(Math.random() * fresh.length)]);
  }

  function addToHistory(item) {
    setHistory((old) => old.some((entry) => entry.id === item.id)
      ? old
      : [{ ...item, topic }, ...old].slice(0, 8));
  }

  function renderDiscoveryState() {
    if (loadState === "loading") {
      return (
        <View style={styles.stateCard} accessibilityLiveRegion="polite">
          <ActivityIndicator color={C.green} />
          <Text style={styles.cardTitle}>Buscando descobertas…</Text>
          <Text style={styles.body}>Estamos preparando até três destaques para você.</Text>
        </View>
      );
    }
    if (loadState === "error") {
      return (
        <View style={[styles.stateCard, styles.errorCard]} accessibilityRole="alert">
          <Text style={styles.cardTitle}>Não conseguimos carregar as descobertas</Text>
          <Text style={styles.body}>A busca falhou. Tente novamente em instantes.</Text>
          <Button label="Tentar novamente" secondary onPress={() => load(topic)} />
        </View>
      );
    }
    if (!fresh.length) {
      return (
        <View style={styles.stateCard}>
          <Text style={styles.cardTitle}>Nenhuma descoberta nova por aqui</Text>
          <Text style={styles.body}>Você já ouviu os destaques deste tema. Escolha outro para continuar explorando.</Text>
        </View>
      );
    }
    return fresh.slice(0, 3).map((item) => (
      <View key={item.id} style={[styles.discoveryCard, selected && selected.id === item.id && styles.selectedCard]}>
        <View style={styles.cardTop}>
          <Text style={styles.mockTag}>MOCK · {item.date}</Text>
        </View>
        <Text style={styles.discoveryTitle}>{item.title}</Text>
        <Text style={styles.body}>{item.summary}</Text>
        <Text style={styles.source}>{item.source}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !!selected && selected.id === item.id }}
          accessibilityLabel={"Escolher descoberta: " + item.title}
          onPress={() => setSelected(item)}
          style={styles.chooseButton}
        >
          <Text style={styles.chooseText}>{selected && selected.id === item.id ? "Selecionada ✓" : "Escolher descoberta →"}</Text>
        </Pressable>
      </View>
    ));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>✳</Text></View>
          <Text style={styles.brand}>Eureka</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.headerCaption}>CIÊNCIA EM ÁUDIO</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>SEU INTERVALO DE CURIOSIDADE</Text>
          <Text style={styles.heroTitle}>Uma descoberta.{"\n"}Uma boa conversa.</Text>
          <Text style={styles.body}>Escolha um tema, encontre algo novo e transforme ciência em um episódio curto para ouvir.</Text>
          <Text style={styles.badge}>☀️  5 minutos para aprender</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Por onde vamos começar?</Text>
          <Text style={styles.hint}>Escolha um tema</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicList} accessibilityLabel="Seis temas de ciência">
          {TOPICS.map((item) => {
            const active = topic === item[0];
            return (
              <Pressable
                key={item[0]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={"Tema: " + item[0]}
                onPress={() => active ? null : setTopic(item[0])}
                style={[styles.topic, active && styles.topicActive]}
              >
                <Text style={styles.topicIcon}>{item[1]}</Text>
                <Text style={[styles.topicText, active && styles.topicTextActive]}>{item[0]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.sectionHeader, styles.discoverHeader]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Descobertas para você</Text>
            <Text style={styles.hint}>{topic} · até 3 destaques</Text>
          </View>
          <Button label="↻ Atualizar" secondary disabled={loadState === "loading"} onPress={() => load(topic)} />
        </View>

        <View accessibilityLiveRegion="polite">{renderDiscoveryState()}</View>

        {selected && !episode ? (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmText}>Descoberta selecionada. O episódio só é preparado após sua confirmação.</Text>
            <Button label="Ver episódio demonstrativo →" onPress={() => { setEpisode(selected); setActiveQuestion(null); }} />
          </View>
        ) : null}

        {!episode ? (
          <Button label="✦  Me surpreenda" disabled={loadState !== "success" || !fresh.length} onPress={surprise} />
        ) : null}

        {episode ? (
          <View style={styles.episodeArea}>
            <Text style={styles.eyebrow}>SEU EPISÓDIO · {topic.toUpperCase()}</Text>
            <Text style={styles.episodeTitle}>{episode.title}</Text>
            <Text style={styles.body}>Duração prevista de até três minutos.</Text>
            <Text style={styles.mockTag}>EPISÓDIO DE DEMONSTRAÇÃO</Text>
            <Player label="Ouvir episódio" duration={144} onStart={() => addToHistory(episode)} />

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>O que sabemos × O que falta descobrir</Text>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>O QUE SABEMOS</Text>
                <Text style={styles.factText}>{episode.known}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>O QUE FALTA DESCOBRIR</Text>
                <Text style={styles.factText}>{episode.unknown}</Text>
              </View>
              <Text style={styles.caption}>Fontes e trechos de evidência aparecerão aqui após a integração científica.</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Quer aprofundar?</Text>
              <Text style={styles.body}>Escolha uma das três perguntas para abrir um player separado.</Text>
              {episode.questions.map((question, index) => (
                <Pressable
                  key={question}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeQuestion === index }}
                  onPress={() => setActiveQuestion(index)}
                  style={[styles.question, activeQuestion === index && styles.selectedCard]}
                >
                  <Text style={styles.questionText}>{question}</Text>
                  <Text style={styles.caption}>Resposta em áudio · 30–60 segundos</Text>
                </Pressable>
              ))}
              {activeQuestion !== null ? (
                <Player label={"Resposta: " + episode.questions[activeQuestion]} duration={42} />
              ) : null}
            </View>
            <Button label="Voltar às descobertas" secondary onPress={() => setEpisode(null)} />
          </View>
        ) : null}

        <View style={styles.history}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Ouvidos recentemente</Text>
            {history.length ? <Pressable accessibilityRole="button" onPress={() => setHistory([])}><Text style={styles.chooseText}>Limpar</Text></Pressable> : null}
          </View>
          {history.length ? history.map((item) => (
            <View key={item.id} style={styles.historyItem}>
              <Text style={styles.factLabel}>{item.topic}</Text>
              <Text style={styles.historyText}>{item.title}</Text>
            </View>
          )) : <Text style={styles.body}>Seus episódios ouvidos aparecerão aqui quando você der play.</Text>}
        </View>

        <Text style={styles.footer}>Eureka · interface e conteúdo demonstrativos</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: { paddingHorizontal: 19, paddingBottom: 40, backgroundColor: C.bg },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.line },
  logo: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.darkGreen, alignItems: "center", justifyContent: "center", marginRight: 9 },
  logoText: { color: "#FFFFFF", fontSize: 18 },
  brand: { color: C.text, fontSize: 20, fontWeight: "800" },
  headerCaption: { color: C.muted, fontSize: 9, letterSpacing: 1 },
  hero: { paddingTop: 32, paddingBottom: 13 },
  eyebrow: { color: C.green, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { color: C.text, fontSize: 35, lineHeight: 40, fontWeight: "800", letterSpacing: -1.2, marginTop: 11 },
  body: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  badge: { color: C.muted, fontSize: 11, marginTop: 15, backgroundColor: C.card, padding: 9, borderRadius: 22, alignSelf: "flex-start" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 22, marginBottom: 11 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "700" },
  hint: { color: C.muted, fontSize: 10, marginTop: 3 },
  topicList: { gap: 9, paddingBottom: 4 },
  topic: { width: 142, height: 92, borderRadius: 14, padding: 11, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, justifyContent: "space-between" },
  topicActive: { borderColor: C.green, backgroundColor: "#10251A" },
  topicIcon: { fontSize: 22 },
  topicText: { color: C.muted, fontSize: 11, lineHeight: 14, fontWeight: "700" },
  topicTextActive: { color: C.text },
  discoverHeader: { marginTop: 29 },
  button: { borderRadius: 11, minHeight: 42, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  primaryButton: { backgroundColor: C.darkGreen },
  secondaryButton: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1 },
  buttonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  secondaryButtonText: { color: C.text },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  stateCard: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 15, padding: 18, marginBottom: 10 },
  errorCard: { backgroundColor: "#211715", borderColor: "#663D33" },
  discoveryCard: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 15, padding: 16, marginBottom: 10 },
  selectedCard: { borderColor: C.green },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mockTag: { color: C.green, backgroundColor: C.mint, borderRadius: 18, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: "700", alignSelf: "flex-start", marginTop: 5 },
  cardTitle: { color: C.text, fontSize: 15, lineHeight: 20, fontWeight: "700", marginTop: 8, marginBottom: 3 },
  discoveryTitle: { color: C.text, fontSize: 16, lineHeight: 21, fontWeight: "700", marginTop: 11, marginBottom: 3 },
  source: { color: C.muted, fontSize: 9, marginTop: 7 },
  chooseButton: { alignSelf: "flex-start", paddingTop: 10, paddingBottom: 2 },
  chooseText: { color: C.green, fontSize: 11, fontWeight: "700" },
  confirmCard: { backgroundColor: C.mint, borderColor: "#28583A", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8 },
  confirmText: { color: C.text, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  episodeArea: { marginTop: 26, gap: 12 },
  episodeTitle: { color: C.text, fontSize: 22, lineHeight: 28, fontWeight: "700", marginTop: 7 },
  player: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 13, backgroundColor: C.raised, marginTop: 8 },
  playButton: { width: 40, height: 40, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.darkGreen },
  playIcon: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  playerContent: { flex: 1 },
  playerLabel: { color: C.text, fontSize: 11, fontWeight: "700" },
  caption: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  progressTrack: { height: 4, backgroundColor: "#354139", borderRadius: 5, overflow: "hidden", marginTop: 7 },
  progressFill: { height: "100%", backgroundColor: C.green },
  time: { color: C.muted, fontSize: 9, lineHeight: 13, textAlign: "right", width: 43 },
  panel: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 15, gap: 8 },
  panelTitle: { color: C.text, fontSize: 14, fontWeight: "700", marginBottom: 3 },
  fact: { backgroundColor: C.raised, borderRadius: 10, padding: 11 },
  factLabel: { color: C.green, fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  factText: { color: "#C9D2CC", fontSize: 11, lineHeight: 17, marginTop: 4 },
  question: { backgroundColor: C.raised, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 2 },
  questionText: { color: C.text, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  history: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 26, paddingTop: 16, gap: 9 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyItem: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 11, padding: 10 },
  historyText: { color: C.text, fontSize: 11, marginTop: 4 },
  footer: { textAlign: "center", color: C.muted, fontSize: 9, marginTop: 22 },
});
