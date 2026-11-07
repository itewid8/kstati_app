import { memo, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ScreenTitle, size as S, space, useTheme } from '@/ui';
import { AccountHeader } from './AccountHeader';
import { SaveBar } from './SaveBar';

export type PageInsets = { top: number; bottom: number };

export type PageSave = {
  canSave: boolean;
  busy?: boolean;
  /** «СОХРАНИТЬ» по умолчанию */
  label?: string;
  onCancel?: () => void;
  onSave?: () => void;
};

type Props = {
  /** Подпись рядом с «Назад»: «ПРОФИЛЬ», «ГРУППЫ» */
  caption?: string;
  title: string;
  insets: PageInsets;
  /** Без «Назад» (вход, первая группа) */
  back?: boolean;
  onBack?: () => void;
  /** Справа в шапке (знак приложения на входе) */
  headerRight?: ReactNode;
  /** Нижняя плашка ОТМЕНА / СОХРАНИТЬ; нет — страница без неё */
  save?: PageSave;
  /** Под содержимым, прижато к низу (ссылка «ПОЗЖЕ», «СОЗДАТЬ АККАУНТ») */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Страница аккаунта: «Назад» и название с подписью одной строкой (top 8; без «Назад» — подпись и заголовок 40/42),
 * разделы через 8,
 * снизу — плашка ОТМЕНА / СОХРАНИТЬ. Клавиатура поднимает плашку вместе со страницей
 */
export const AccountPage = memo(function AccountPage(props: Props) {
  const { caption, title, insets, back = true, onBack, headerRight, save, footer, children } = props;
  const { c } = useTheme();
  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: c.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        // Непрозрачный фон: на web прозрачный слой прокрутки выключает субпиксельное сглаживание текста
        style={[styles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + S.topBarTop, paddingBottom: save ? 24 : insets.bottom + 18 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {back ? (
          <AccountHeader caption={caption} title={title} onBack={onBack} right={headerRight} />
        ) : (
          <>
            <AccountHeader caption={caption} back={false} right={headerRight} />
            <ScreenTitle title={title} style={styles.title} />
          </>
        )}
        <View style={styles.body}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
      {save ? (
        <SaveBar
          canSave={save.canSave}
          busy={save.busy}
          saveLabel={save.label}
          bottomInset={insets.bottom}
          onCancel={save.onCancel}
          onSave={save.onSave}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: space.side },
  title: { marginTop: 14 },
  body: { marginTop: 12, gap: 8 },
  footer: { marginTop: 'auto', paddingTop: 24 },
});
