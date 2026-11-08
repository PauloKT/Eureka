import React, { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './client';
import { audioExpired } from './api.mjs';
import { Button, Notice, colors, s } from './ui';
const clock = value => `${Math.floor((value || 0) / 60)}:${String(Math.floor((value || 0) % 60)).padStart(2, '0')}`;
export default function AudioPlayer({ episode, userId, onCompleted }) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [completed, setCompleted] = useState(false), [pendingCompletion, setPendingCompletion] = useState(false);
  const expiry = useRef(0), restore = useRef(null), completionSent = useRef(false), loading = useRef(false), mounted = useRef(true);
  const completionKey = `eureka.completed.${userId}.${episode.id}`;
  async function recordCompletion() {
    if (completionSent.current) return;
    completionSent.current = true;
    try {
      await AsyncStorage.setItem(completionKey, 'pending');
      await api(`/episodes/${episode.id}/completion`, { method: 'POST' });
      await AsyncStorage.removeItem(completionKey);
      if (mounted.current) { setCompleted(true); setPendingCompletion(false); onCompleted(); }
    } catch {
      completionSent.current = false;
      if (mounted.current) { setPendingCompletion(true); setError('Escuta concluída. Falta sincronizar o histórico; tente novamente quando a conexão voltar.'); }
    }
  }
  async function loadAudio(play = false) {
    if (loading.current) return;
    loading.current = true; setBusy(true); setError('');
    try {
      if (audioExpired(episode)) throw new Error('O áudio expirou. A ficha e a transcrição continuam disponíveis.');
      const position = player.currentTime || 0;
      player.pause();
      const access = await api(`/episodes/${episode.id}/audio-access`);
      if (!mounted.current) return;
      if (!access.url?.startsWith('https://')) throw new Error('Não foi possível abrir o áudio.');
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix', shouldPlayInBackground: true });
      expiry.current = Date.now() + access.expiresIn * 1000 - 15000;
      restore.current = { position, play };
      player.replace({ uri: access.url });
      player.setActiveForLockScreen(true, { title: episode.title, artist: 'Eureka · voz gerada por IA' });
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { loading.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    mounted.current = true; loadAudio();
    AsyncStorage.getItem(completionKey).then(value => { if (value && mounted.current) { setPendingCompletion(true); recordCompletion(); } }).catch(() => {});
    const sub = AppState.addEventListener('change', state => { if (state === 'active' && !player.playing && Date.now() >= expiry.current) loadAudio(); });
    return () => { mounted.current = false; sub.remove(); player.pause(); player.clearLockScreenControls(); };
  }, []);
  useEffect(() => {
    if (status.isLoaded && restore.current) {
      const next = restore.current; restore.current = null;
      player.seekTo(Math.min(next.position, status.duration || next.position)).then(() => { if (mounted.current && next.play) player.play(); }).catch(() => { if (mounted.current) setError('Não foi possível retomar a posição do áudio.'); });
    }
  }, [status.isLoaded, status.duration]);
  useEffect(() => { if (status.didJustFinish) recordCompletion(); }, [status.didJustFinish]);
  async function toggle() {
    try {
      if (player.playing) { player.pause(); return; }
      if (audioExpired(episode)) throw new Error('O prazo de acesso ao áudio terminou.');
      if (Date.now() >= expiry.current || status.error) { await loadAudio(true); return; }
      if (status.currentTime >= status.duration - 0.1) await player.seekTo(0);
      player.play();
    } catch (e) { setError(e.message); }
  }
  const duration = status.duration || episode.audio.durationSeconds;
  return <View style={s.card}>
    <Text style={s.subtitle}>Ouvir episódio</Text><Text style={s.caption}>Voz gerada por inteligência artificial.</Text>
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: duration, now: status.currentTime || 0 }} style={s.progress}><View style={{ height: '100%', backgroundColor: colors.green, width: `${Math.min(100, 100 * (status.currentTime || 0) / (duration || 1))}%` }} /></View>
    <Text style={s.body}>{clock(status.currentTime)} / {clock(duration)}{status.isBuffering ? ' · Carregando áudio…' : ''}</Text>
    <Button label={status.playing ? 'Pausar' : 'Reproduzir'} disabled={busy || !status.isLoaded || audioExpired(episode)} onPress={toggle} />
    <View style={s.row}><Button label="Voltar 15 s" secondary disabled={!status.isLoaded} onPress={() => player.seekTo(Math.max(0, player.currentTime - 15)).catch(() => setError('Não foi possível mudar a posição.'))} /><Button label="Avançar 15 s" secondary disabled={!status.isLoaded} onPress={() => player.seekTo(Math.min(duration, player.currentTime + 15)).catch(() => setError('Não foi possível mudar a posição.'))} /></View>
    {(error || status.error) ? <Notice error>{error || 'Falha na reprodução. Renove o acesso para tentar novamente.'}</Notice> : null}
    <Button label={busy ? 'Obtendo acesso…' : 'Renovar acesso ao áudio'} secondary disabled={busy || audioExpired(episode)} onPress={() => loadAudio()} />
    {pendingCompletion ? <Button label="Sincronizar escuta concluída" secondary onPress={recordCompletion} /> : null}
    {completed ? <Notice>Escuta registrada no histórico.</Notice> : null}
  </View>;
}
