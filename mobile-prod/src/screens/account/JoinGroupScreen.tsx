/**
 * Вступить в группу по коду приглашения: шесть ячеек как у кода из письма, снизу ОТМЕНА / ВСТУПИТЬ.
 * Код проверяет сервер; не подошёл или нет связи — код остаётся, под ним причина. Презентационный экран.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AccountPage, type PageInsets } from './components/AccountPage';
import { CodeCells } from './components/CodeCells';
import { ErrorLine } from './components/ErrorLine';

export const GROUP_CODE_LENGTH = 6;

export type JoinGroupScreenProps = {
  code: string;
  /** Сервер отказал: ячейки красные, ряд вздрагивает */
  error?: boolean;
  errorText?: string | null;
  busy?: boolean;
  /** Подпись рядом с «Назад»: «ГРУППЫ» / «ПЕРВАЯ ГРУППА» */
  caption?: string;
  autoFocus?: boolean;
  insets?: PageInsets;

  onBack?: () => void;
  onChangeCode?: (code: string) => void;
  onCancel?: () => void;
  onJoin?: () => void;
};

const NO_INSETS: PageInsets = { top: 0, bottom: 0 };

export const JoinGroupScreen = memo(function JoinGroupScreen(props: JoinGroupScreenProps) {
  const { code, error = false, errorText, busy = false, caption = 'ГРУППЫ', autoFocus = true, insets = NO_INSETS, onBack, onChangeCode, onCancel, onJoin } = props;
  return (
    <AccountPage
      caption={caption}
      title="Вступить"
      insets={insets}
      onBack={onBack}
      save={{ canSave: code.length === GROUP_CODE_LENGTH, busy, label: 'ВСТУПИТЬ', onCancel, onSave: onJoin }}
    >
      <View style={styles.code}>
        <CodeCells
          kind="text"
          value={code}
          onChange={onChangeCode}
          length={GROUP_CODE_LENGTH}
          error={error}
          editable={!busy}
          autoFocus={autoFocus}
          accessibilityLabel="Код группы"
        />
      </View>
      <ErrorLine text={errorText} />
    </AccountPage>
  );
});

const styles = StyleSheet.create({
  /** Как на C-Code: код через 22 под заголовком (у разделов — 12) */
  code: { marginTop: 10 },
});
