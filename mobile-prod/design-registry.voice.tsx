// Реестр голосовых окон для стенда сверки с макетами (design/harness/run.mjs).
// Ключ = имя макета в design/mockups; тема приходит пропсом (и через prefers-color-scheme).
// Под каждым окном — упрощённый экран «Дела», как в макетах.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AskAgendaSheet, AskDeleteSheet, AskMoveSheet, VoiceCreateSheet } from '@/screens/voice';
import { VoiceBackdrop } from '@/screens/fixtures/voice/Backdrop';
import {
  askDeleteFixture,
  askMoveFixture,
  askWeekFixture,
  askWeekendFixture,
  voiceCreateFixture,
} from '@/screens/fixtures/voice';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };

const Stage = ({ children }: { children: ReactNode }) => (
  <View style={styles.stage}>
    <VoiceBackdrop />
    {children}
  </View>
);

export const screens = {
  'C-Voice': (_: Props) => (
    <Stage>
      <VoiceCreateSheet {...voiceCreateFixture} />
    </Stage>
  ),
  'C-AskDelete': (_: Props) => (
    <Stage>
      <AskDeleteSheet {...askDeleteFixture} />
    </Stage>
  ),
  'C-AskMove': (_: Props) => (
    <Stage>
      <AskMoveSheet {...askMoveFixture} />
    </Stage>
  ),
  'C-AskWeek': (_: Props) => (
    <Stage>
      <AskAgendaSheet {...askWeekFixture} />
    </Stage>
  ),
  'C-AskWeekend': (_: Props) => (
    <Stage>
      <AskAgendaSheet {...askWeekendFixture} />
    </Stage>
  ),
};

const styles = StyleSheet.create({
  stage: { flex: 1 },
});
