import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StatusBar, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { DiscoverySearchResponse } from '@eureka/contracts';
import { api, configError, supabase } from './src/client';
import { audioExpired, createEpisodeFlow, formatDate, stageFor } from './src/api.mjs';
import AudioPlayer from './src/AudioPlayer';
import { Button, Notice, colors, s } from './src/ui';
const THEMES = [{ id: 'space', name: 'Espaço', icon: '🪐' }, { id: 'health', name: 'Saúde', icon: '🫀' }, { id: 'brain', name: 'Cérebro', icon: '🧠' }, { id: 'technology', name: 'Tecnologia', icon: '🤖' }, { id: 'nature', name: 'Natureza', icon: '🌱' }, { id: 'physics', name: 'Física', icon: '⚛️' }];
const STATES = { selected: 'Descoberta selecionada', script_generating: 'Preparando e revisando roteiro', script_ready: 'Roteiro aprovado', audio_generating: 'Gerando narração', ready: 'Episódio pronto', failed: 'Etapa interrompida' };
const REVIEWS = { peer_reviewed: 'Revisado por pares', preprint: 'Preprint · ainda sem revisão por pares', institutional_release: 'Publicação institucional', unknown: 'Revisão editorial não informada' };

export default function App() {
  const [session, setSession] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let live = true;
    supabase.auth.getSession().then(({ data, error: e }) => { if (live) { setSession(data.session); setError(e ? 'Não foi possível recuperar sua sessão. Entre novamente.' : ''); setLoading(false); } }).catch(() => { if (live) { setError('Não foi possível recuperar sua sessão.'); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => { if (live) setSession(value); });
    const refresh = state => state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh();
    refresh(AppState.currentState);
    const sub = AppState.addEventListener('change', refresh);
    return () => { live = false; data.subscription.unsubscribe(); sub.remove(); supabase.auth.stopAutoRefresh(); };
  }, []);
  return <SafeAreaProvider><SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={colors.bg} />
    {configError ? <View style={s.page}><Text style={s.brand}>Eureka</Text><Notice error>{configError}</Notice></View>
      : loading ? <ActivityIndicator color={colors.green} accessibilityLabel="Recuperando sessão" />
        : session ? <Home key={session.user.id} session={session} /> : <Login initialError={error} />}
  </SafeAreaView></SafeAreaProvider>;
}
function Login({ initialError }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(initialError);
  const pending = useRef(false);
  async function submit() {
    if (pending.current) return;
    if (!email.trim() || password.length < 6) { setMessage('Informe seu e-mail e uma senha com pelo menos seis caracteres.'); return; }
    pending.current = true; setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setMessage(error.code === 'invalid_credentials' ? 'E-mail ou senha incorretos.' : error.code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar.' : 'Não foi possível entrar ou cadastrar. Confira os dados e tente novamente.'); return; }
      setPassword('');
      if (!data.session) setMessage('Confira sua caixa de entrada e confirme o e-mail. Depois volte e toque em Entrar.');
    } catch { setMessage('Sem conexão com o login. Tente novamente.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
    <Text style={s.brand}>✳ Eureka</Text><Text style={s.title}>Ciência para ouvir e entender.</Text><Text style={s.body}>Entre para explorar descobertas e guardar seus episódios.</Text>
    <Text style={s.text}>E-mail</Text><TextInput accessibilityLabel="E-mail" style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy} />
    <Text style={s.text}>Senha</Text><TextInput accessibilityLabel="Senha" style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" editable={!busy} />
    {message ? <Notice>{message}</Notice> : null}
    <Button label={busy ? 'Aguarde…' : 'Entrar'} onPress={submit} disabled={busy} />
    <Text style={s.caption}>Piloto por convite. Peça sua conta de teste ao responsável. A conta de administração do painel Supabase é separada.</Text>
  </ScrollView></KeyboardAvoidingView>;
}
function Sources({ sources, onError, sourceIds }) {
  return <View style={{ gap: 12 }}>{sources.filter(source => !sourceIds || sourceIds.includes(source.id)).map(source => <View key={source.id}>
    <Pressable accessibilityRole="link" onPress={() => { if (!source.url?.startsWith('https://')) { onError('Referência indisponível.'); return; } Linking.openURL(source.url).catch(() => onError('Não foi possível abrir a referência.')); }}><Text style={s.link}>{source.title}</Text></Pressable>
    <Text style={s.caption}>{source.publisher} · {formatDate(source.publishedAt)}</Text>
  </View>)}</View>;
}
function Home({ session }) {
  const [theme, setTheme] = useState('space'), [selection, setSelection] = useState(null), [episode, setEpisode] = useState(null);
  const [screen, setScreen] = useState('discover'), [busy, setBusy] = useState(''), [error, setError] = useState(''), [info, setInfo] = useState('');
  const [capabilities, setCapabilities] = useState(null), [pendingIntent, setPendingIntent] = useState(null);
  const [history, setHistory] = useState([]), [cursor, setCursor] = useState(null), [historyLoaded, setHistoryLoaded] = useState(false);
  const lock = useRef(false), mounted = useRef(true), currentEpisode = useRef(null);
  const flow = useMemo(() => createEpisodeFlow({ api, storage: AsyncStorage, userId: session.user.id, uuid: randomUUID }), [session.user.id]);
  async function run(label, work) {
    if (lock.current) return;
    lock.current = true; setBusy(label); setError(''); setInfo('');
    try { await work(); } catch (e) { if (mounted.current) setError(e.message || 'Não foi possível concluir. Tente novamente.'); }
    finally { lock.current = false; if (mounted.current) setBusy(''); }
  }
  function showEpisode(value) { currentEpisode.current = value.id; setEpisode(value); setScreen('episode'); setPendingIntent(null); }
  async function refreshCapabilities() { const caps = await api('/capabilities', { publicRoute: true }); if (mounted.current) setCapabilities(caps); }
  async function refreshEpisode() {
    if (!currentEpisode.current) return;
    const id = currentEpisode.current; const { episode: value } = await api(`/episodes/${id}`);
    if (mounted.current && currentEpisode.current === id) setEpisode(value);
  }
  useEffect(() => {
    mounted.current = true;
    run('Recuperando sessão…', async () => { await api('/me'); await refreshCapabilities(); const intent = await flow.load(); if (intent?.episodeId) showEpisode(await flow.open(intent.episodeId)); else if (intent?.choice) setPendingIntent(intent); });
    const sub = AppState.addEventListener('change', state => { if (state === 'active' && !lock.current) run('Atualizando estado…', async () => { await refreshCapabilities(); await refreshEpisode(); }); });
    return () => { mounted.current = false; sub.remove(); };
  }, []);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (screen !== 'discover') { setScreen('discover'); return true; } return false; }); return () => sub.remove(); }, [screen]);
  useEffect(() => {
    if (!episode?.state.endsWith('_generating')) return;
    let stopped = false, polling = false;
    const timer = setInterval(async () => { if (stopped || polling || lock.current || AppState.currentState !== 'active') return; polling = true; try { await refreshEpisode(); } catch { if (!stopped) { setError('Não foi possível consultar a geração. Toque em Atualizar estado.'); clearInterval(timer); } } finally { polling = false; } }, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, [episode?.id, episode?.state]);
  async function search() { await run('Buscando estudos…', async () => { setSelection(null); setSelection(DiscoverySearchResponse.parse(await api('/discovery-searches', { method: 'POST', body: { themeId: theme } }))); }); }
  async function choose(mode, discoveryId) {
    await run('Salvando escolha…', async () => {
      const choice = { selectionSetId: selection.selectionSetId, mode, ...(mode === 'chosen' ? { discoveryId } : {}) };
      try { showEpisode(await flow.choose(choice)); } finally { const intent = await flow.load(); if (intent && !intent.episodeId) setPendingIntent(intent); }
    });
  }
  async function historyPage(more = false) {
    await run('Carregando histórico…', async () => {
      const value = await api('/history' + (more && cursor ? `?cursor=${encodeURIComponent(cursor)}` : '')); const items = [];
      for (const item of value.items) { try { items.push({ ...item, episode: (await api(`/episodes/${item.episode_id}`)).episode }); } catch { items.push(item); } }
      setHistory(old => more ? [...old, ...items.filter(item => !old.some(x => x.episode_id === item.episode_id))] : items); setCursor(value.nextCursor); setHistoryLoaded(true);
    });
  }
  const stage = stageFor(episode);
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
    <View style={s.header}><Text style={s.brand}>✳ Eureka</Text><Button label="Sair" secondary disabled={!!busy} onPress={() => run('Saindo…', async () => { const { error: e } = await supabase.auth.signOut({ scope: 'local' }); if (e) throw e; })} /></View>
    <View style={s.row}><Button label="Descobertas" secondary onPress={() => { setScreen('discover'); setError(''); }} /><Button label="Histórico" secondary disabled={!!busy} onPress={() => { setScreen('history'); historyPage(); }} />{episode ? <Button label="Meu episódio" secondary onPress={() => setScreen('episode')} /> : null}</View>
    {busy ? <View style={s.row}><ActivityIndicator color={colors.green} /><Text style={s.body}>{busy}</Text></View> : null}
    {error ? <Notice error>{error}</Notice> : null}{info ? <Notice>{info}</Notice> : null}
    {screen === 'discover' ? <>
      <Text style={s.title}>Qual descoberta você quer ouvir hoje?</Text><Text style={s.body}>Escolha um tema e busque estudos com fontes e evidências.</Text>
      <View style={s.themes}>{THEMES.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: theme === item.id, disabled: !!busy }} disabled={!!busy} onPress={() => { setTheme(item.id); setSelection(null); }} style={[s.theme, theme === item.id && s.selected]}><Text style={s.text}>{item.icon} {item.name}</Text></Pressable>)}</View>
      <Button label="Buscar descobertas" disabled={!!busy} onPress={search} />
      {pendingIntent ? <><Notice>Uma escolha ficou sem confirmação. Retome com a mesma tentativa para evitar criar outro episódio.</Notice><Button label="Retomar escolha pendente" disabled={!!busy} secondary onPress={() => run('Retomando escolha…', async () => showEpisode(await flow.choose(pendingIntent.choice)))} /></> : null}
      {selection?.partial ? <Notice>A busca ficou incompleta porque algumas fontes não responderam. Você pode tentar novamente.</Notice> : null}
      {selection && !selection.options.length ? <Notice>{selection.emptyReason === 'sources_unavailable_or_incomplete' ? 'Não foi possível obter evidências suficientes nesta busca. Tente novamente mais tarde.' : 'Nenhum estudo com evidências revisadas está disponível neste tema agora. Tente outro tema.'}</Notice> : null}
      {selection?.options.map(item => <View key={item.id} style={s.card}><Text style={s.caption}>{formatDate(item.publishedAt)} · {REVIEWS[item.reviewStatus]}</Text><Text style={s.subtitle}>{item.title}</Text><Text style={s.body}>{item.summary}</Text>{item.evidenceReview === 'automated' ? <Text style={s.caption}>Resumo e evidências revisados por IA. Confira as fontes.</Text> : null}{item.alreadyHeard ? <Text style={s.caption}>Você já ouviu esta descoberta.</Text> : null}<Sources sources={item.sources} onError={setError} /><Button label="Escolher descoberta" disabled={!!busy} onPress={() => choose('chosen', item.id)} /></View>)}
      {selection?.options.length ? <Button label="Me surpreenda" secondary disabled={!!busy} onPress={() => choose('surprise')} /> : null}
    </> : null}
    {screen === 'episode' && episode ? <>
      <Text style={s.title}>{episode.title}</Text><Notice>{STATES[episode.state] || episode.state}</Notice>
      {episode.errorCode ? <Notice error>Etapa interrompida ({episode.errorCode}). Consulte o estado ou tente recuperar o resultado antes de gerar novamente.</Notice> : null}
      <Button label="Atualizar estado" secondary disabled={!!busy} onPress={() => run('Consultando episódio…', async () => { await refreshCapabilities(); await refreshEpisode(); })} />
      {episode.state === 'selected' || episode.state === 'script_ready' ? <>
        {!(stage === 'script' ? capabilities?.textEnabled : capabilities?.speechEnabled) ? <Notice>A geração desta etapa está indisponível no momento. Atualize o estado para verificar novamente.</Notice> : null}
        <Button label={stage === 'script' ? 'Gerar roteiro com fontes' : 'Gerar áudio do roteiro'} disabled={!!busy || !(stage === 'script' ? capabilities?.textEnabled : capabilities?.speechEnabled)} onPress={() => run(stage === 'script' ? 'Preparando e revisando roteiro…' : 'Gerando áudio…', async () => showEpisode(await flow.generate(stage)))} />
      </> : null}
      {episode.state === 'failed' || episode.state.endsWith('_generating') ? <><Button label="Recuperar resultado preservado" secondary disabled={!!busy} onPress={() => run('Recuperando resultado…', async () => showEpisode(await flow.recover(stage)))} /><Button label="Preparar tentativa corretiva" secondary disabled={!!busy} onPress={() => run('Verificando tentativa permitida…', async () => { showEpisode(await flow.prepareRetry(stage)); setInfo('Correção preparada. Toque em Gerar para iniciar a nova tentativa.'); })} /></> : null}
      {episode.state === 'ready' && episode.audio ? audioExpired(episode) ? <Notice>O áudio expirou. A ficha e a transcrição continuam aqui; nenhum áudio será regenerado automaticamente.</Notice> : <AudioPlayer key={episode.id} episode={episode} userId={session.user.id} onCompleted={() => setHistoryLoaded(false)} /> : null}
      {episode.script ? <><Text style={s.subtitle}>O que sabemos × O que falta descobrir</Text>
        {Object.entries({ result: 'Resultado', evidence: 'Evidência', limitation: 'Limitações e perguntas abertas' }).map(([key, label]) => { const fact = episode.script.evidenceCard[key]; return <View key={key} style={s.card}><Text style={s.subtitle}>{label}</Text><Text style={s.text}>{fact.text}</Text><Sources sources={episode.sources} sourceIds={fact.references.map(ref => ref.sourceId)} onError={setError} /></View>; })}
        <View style={s.card}><Text style={s.subtitle}>Transcrição</Text>{episode.script.paragraphs.map(p => <Text key={p.id} selectable style={s.text}>{p.text}</Text>)}</View>
      </> : null}
      <Text style={s.subtitle}>Referências</Text><Sources sources={episode.sources} onError={setError} /><Text style={s.caption}>A revisão por IA não certifica a verdade científica. Aprofundamentos ainda não estão disponíveis.</Text>
    </> : null}
    {screen === 'history' ? <><Text style={s.title}>Suas escutas</Text><Text style={s.body}>Os episódios aparecem aqui quando a reprodução termina.</Text>
      {!historyLoaded && !busy ? <Button label="Atualizar histórico" onPress={() => historyPage()} /> : null}{historyLoaded && !history.length ? <Notice>Você ainda não concluiu uma escuta.</Notice> : null}
      {history.map(item => <View style={s.card} key={item.episode_id}><Text style={s.subtitle}>{item.episode?.title || 'Episódio concluído'}</Text><Text style={s.caption}>{formatDate(item.completed_at.slice(0, 10))}{item.episode && audioExpired(item.episode) ? ' · áudio expirado' : ''}</Text><Button label="Abrir episódio" secondary disabled={!!busy} onPress={() => run('Abrindo episódio…', async () => showEpisode(await flow.open(item.episode_id)))} /></View>)}
      {cursor ? <Button label="Carregar mais" disabled={!!busy} onPress={() => historyPage(true)} /> : null}
    </> : null}
  </ScrollView>;
}
