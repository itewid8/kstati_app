/**
 * Голосовые окна поверх всех экранов (INTEGRATION.md 1.3): состояние s.voice × s.card (source 'voice') × ожидание нажатия
 * по ссылке kstatiapp://record. Что рисует хост, а что старый CardSheet — voiceView (одна функция для обоих).
 * Android «назад» закрывает окно (запись — отменяет).
 */
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { voiceView } from '@/adapters/voice/view';
import { useStore } from '@/lib/store';
import { useVoiceUi } from '@/lib/voice';
import { useSignedIn } from '../common/signedIn';
import { useClock } from '../common/useClock';
import { useInsets } from '../common/useInsets';
import { useSnapshot } from '../common/useSnapshot';
import { closeVoice, editVoiceResult } from './actions';
import { useLevelHistory, useRecordedMs } from './useLevelHistory';
import { AgendaSheet, ArmSheet, CreateSheet, DeleteSheet, ErrorSheet, MoveSheet, RecordingSheet } from './VoiceSheets';

/** Столбиков в волне шапки (VoiceSheet) */
const BARS = 40;

export function VoiceHost() {
  const phase = useStore((s) => s.voice);
  const card = useStore((s) => s.card);
  const signedIn = useSignedIn();
  const { armed, cancelling } = useVoiceUi(useShallow((u) => ({ armed: u.armed, cancelling: u.cancelling })));
  const s = useSnapshot();
  const clock = useClock();
  const insets = useInsets();
  const levels = useLevelHistory(BARS);
  const live = phase === 'recording';
  const ms = useRecordedMs(live);

  const view = useMemo(() => (card && signedIn ? voiceView(card, s, clock) : null), [card, signedIn, s, clock]);

  // «Изменить» во время записи: как только придёт ответ — сразу правка (одна запись, несколько, правка — editVoiceResult).
  // Ждём именно голосовую карточку: setVoice('idle') и setCard могут прийти разными рендерами. Новая запись — намерение сброшено
  const editAfter = useRef(false);
  const onEditAfter = useCallback(() => {
    editAfter.current = true;
  }, []);
  useEffect(() => {
    if (phase === 'recording') editAfter.current = false;
  }, [phase]);
  useEffect(() => {
    if (!editAfter.current || phase !== 'idle' || card?.source !== 'voice') return;
    editAfter.current = false;
    editVoiceResult(card);
  }, [phase, card]);

  const busy = phase === 'recording' || (phase === 'processing' && !cancelling);
  const visible = busy || !!view || (armed && phase === 'idle');

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeVoice();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  if (!visible) return null;
  const base = { levels, ms, bottomInset: insets.bottom };
  let sheet: ReactNode = null;
  if (busy) sheet = <RecordingSheet {...base} live={live} onEditAfter={onEditAfter} />;
  else if (view?.kind === 'create') sheet = <CreateSheet {...base} item={view.item} transcript={view.transcript} s={s} />;
  else if (view?.kind === 'delete')
    sheet = (
      <DeleteSheet
        key={`${view.transcript}|${view.change.key}|${view.change.chosen}|${view.change.occ ?? ''}`}
        {...base}
        change={view.change}
        transcript={view.transcript}
        s={s}
        clock={clock}
      />
    );
  else if (view?.kind === 'move') sheet = <MoveSheet {...base} change={view.change} transcript={view.transcript} s={s} clock={clock} />;
  else if (view?.kind === 'agenda')
    sheet = <AgendaSheet {...base} answer={view.answer} transcript={view.transcript} s={s} clock={clock} insets={insets} />;
  else if (view?.kind === 'problem') sheet = <ErrorSheet {...base} card={view.card} />;
  else sheet = <ArmSheet bottomInset={insets.bottom} />;

  return (
    <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {sheet}
    </Animated.View>
  );
}
