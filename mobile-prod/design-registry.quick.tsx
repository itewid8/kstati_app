// Реестр окон быстрых действий (удержание записи) для стенда сверки с макетами (design/harness/run.mjs).
// Ключ = имя макета в design/mockups; тема приходит пропсом (и через prefers-color-scheme).
// Под окном — упрощённый список, как в макетах; нажатая строка поднята над затемнением.
import { StyleSheet, View } from 'react-native';
import { QuickBackdrop, backdropLift } from '@/screens/fixtures/quick/Backdrop';
import {
  quickIdeaFixture,
  quickTaskFixture,
  quickWatchFixture,
  quickWishFixture,
  type QuickFixture,
} from '@/screens/fixtures/quick';
import { QuickActionsSheet } from '@/screens/quick';
import type { Scheme } from '@/ui';

type Props = { theme: Scheme };

const Stage = ({ fixture }: { fixture: QuickFixture }) => (
  <View style={styles.stage}>
    <QuickBackdrop {...fixture.backdrop} />
    <QuickActionsSheet {...fixture.sheet} lift={backdropLift(fixture.backdrop, fixture.lift)} />
  </View>
);

export const screens = {
  'C-QuickTask': (_: Props) => <Stage fixture={quickTaskFixture} />,
  'C-QuickWish': (_: Props) => <Stage fixture={quickWishFixture} />,
  'C-QuickWatch': (_: Props) => <Stage fixture={quickWatchFixture} />,
  'C-QuickIdea': (_: Props) => <Stage fixture={quickIdeaFixture} />,
};

const styles = StyleSheet.create({
  stage: { flex: 1 },
});
