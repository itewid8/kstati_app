import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { registerRecorder, stopRecording, useVoiceLevel } from '@/lib/voice';

/** AAC/m4a, моно, 16 кГц — речь, небольшой файл (7 с ≈ 30 КБ) */
const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
};

const SPEECH_DB = -40; // громче — считаем речью
const SILENCE_STOP_MS = 2000; // после речи 2 с тишины — автостоп

/** Невидимый компонент: держит микрофон и отдаёт управление в lib/voice.ts */
export function VoiceRecorder() {
  const rec = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(rec, 100);
  const phase = useStore((s) => s.voice);
  const spoke = useRef(false);
  const lastLoud = useRef(0);

  useEffect(() => {
    registerRecorder({
      start: async () => {
        try {
          const perm = await AudioModule.requestRecordingPermissionsAsync();
          if (!perm.granted) return 'denied';
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
          await rec.prepareToRecordAsync();
          rec.record();
          spoke.current = false;
          lastLoud.current = Date.now();
          return 'ok';
        } catch {
          return 'error';
        }
      },
      stop: async () => {
        try {
          await rec.stop();
          return rec.uri ?? null;
        } catch {
          return null;
        }
      },
    });
    return () => registerRecorder(null);
  }, [rec]);

  // Уровень звука и автостоп по тишине
  const db = state.metering;
  useEffect(() => {
    if (phase !== 'recording' || typeof db !== 'number') return;
    useVoiceLevel.setState({ level: Math.max(0, Math.min(1, (db + 60) / 60)) });
    const now = Date.now();
    if (db > SPEECH_DB) {
      spoke.current = true;
      lastLoud.current = now;
    } else if (spoke.current && now - lastLoud.current > SILENCE_STOP_MS) {
      stopRecording();
    }
  }, [db, phase]);

  return null;
}
