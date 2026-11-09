import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { isRunningInExpoGo } from 'expo';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { api } from '../src/client';
import AudioPlayer from '../src/AudioPlayer';

jest.mock('expo', () => ({ isRunningInExpoGo: jest.fn() }));
jest.mock('expo-audio', () => ({ setAudioModeAsync: jest.fn(), useAudioPlayer: jest.fn(), useAudioPlayerStatus: jest.fn() }));
jest.mock('../src/client', () => ({ api: jest.fn() }));
jest.mock('../src/DownloadAudio', () => () => null);
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const episode = { id: 'test-episode', title: 'Test episode', state: 'ready', audio: { expiresAt: '2099-01-01T00:00:00Z', durationSeconds: 60 } };

test.each([true, false])('playback works with Expo Go=%s and only native builds activate lock-screen controls', async expoGo => {
  isRunningInExpoGo.mockReturnValue(expoGo);
  const player = { currentTime: 0, playing: false, pause: jest.fn(), play: jest.fn(), replace: jest.fn(), seekTo: jest.fn().mockResolvedValue(), setActiveForLockScreen: jest.fn(), clearLockScreenControls: jest.fn() };
  useAudioPlayer.mockReturnValue(player);
  useAudioPlayerStatus.mockReturnValue({ isLoaded: true, duration: 60, currentTime: 0, playing: false });
  setAudioModeAsync.mockResolvedValue();
  api.mockResolvedValue({ url: 'https://example.org/audio.wav', expiresIn: 300 });

  const view = await render(<AudioPlayer episode={episode} userId="test-user" onCompleted={jest.fn()} />);
  await waitFor(() => expect(player.replace).toHaveBeenCalledWith({ uri: 'https://example.org/audio.wav' }));
  expect(setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ shouldPlayInBackground: !expoGo }));
  expect(player.setActiveForLockScreen).toHaveBeenCalledTimes(expoGo ? 0 : 1);
  await fireEvent.press(screen.getByText('Reproduzir'));
  expect(player.play).toHaveBeenCalledTimes(1);
  await view.unmount();
  expect(player.clearLockScreenControls).toHaveBeenCalledTimes(expoGo ? 0 : 1);
});
