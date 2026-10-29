/**
 * Виджет «Кстати» для iPhone (expo-widgets, SwiftUI из @expo/ui) в стиле «Инструмент»:
 * шапка (группа и сегодня), строки дел (название слева, время моноширинным справа), квадратная кнопка REC.
 * Включается только со сборкой под платный аккаунт — см. app.config.js. Перед включением перенести в src/widget/.
 * Код внутри 'widget' выполняется отдельно от приложения: всё готовое (подписи, цвета) приходит в props.
 */
import { HStack, Rectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, containerBackground, font, foregroundStyle, frame, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type IosWidgetRow = { title: string; day: string | null; time: string };
/** Палитра: [фон, панель, текст, приглушённый, красный] */
export type IosWidgetProps = { label: string; today: string; rows: IosWidgetRow[]; light: string[]; dark: string[] };

type Tone = 'auto' | 'light' | 'dark';
export type IosWidgetConfig = { mic: boolean; bg: Tone; micTone: Tone; text: Tone; time: Tone };

const KstatiWidgetView = (props: IosWidgetProps, environment: WidgetEnvironment<IosWidgetConfig>) => {
  'widget';
  const family = environment.widgetFamily;
  const cfg = environment.configuration;
  const night = environment.colorScheme !== 'light';
  const pick = (t: Tone | undefined) => (t === 'light' ? props.light : t === 'dark' ? props.dark : night ? props.dark : props.light);
  const bgSet = pick(cfg?.bg);
  const textSet = cfg?.text === 'light' ? props.dark : cfg?.text === 'dark' ? props.light : bgSet;
  const timeSet = cfg?.time === 'light' ? props.dark : cfg?.time === 'dark' ? props.light : bgSet;
  const micSet = pick(cfg?.micTone);
  const mono = (size: number) => font({ size, design: 'monospaced', weight: 'semibold' });

  if (family === 'accessoryCircular') {
    return <Text modifiers={[mono(12), widgetURL('kstatiapp://record')]}>REC</Text>;
  }
  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL('kstatiapp://record')]}>
        {props.rows.slice(0, 2).map((r, i) => (
          <Text key={i} modifiers={[font({ size: 14 }), lineLimit(1)]}>{`${r.time}  ${r.title}`}</Text>
        ))}
      </VStack>
    );
  }

  const small = family === 'systemSmall';
  const large = family === 'systemLarge';
  const rows = props.rows.slice(0, small ? 3 : large ? 8 : 4);
  const rec =
    cfg?.mic !== false ? (
      <VStack modifiers={[frame({ width: small ? 40 : 44, height: small ? 40 : 44 }), background(micSet[1] ?? '#000')]}>
        <Rectangle modifiers={[frame({ width: 10, height: 10 }), foregroundStyle(micSet[4] ?? '#E0281E')]} />
        <Text modifiers={[mono(8), foregroundStyle(micSet[2] ?? '#111')]}>REC</Text>
      </VStack>
    ) : null;

  return (
    <VStack alignment="leading" spacing={6} modifiers={[widgetURL('kstatiapp://tasks'), containerBackground(bgSet[0] ?? '#E7E6E1', 'widget')]}>
      <HStack>
        <Text modifiers={[mono(10), foregroundStyle(textSet[2] ?? '#111'), lineLimit(1)]}>{props.label}</Text>
        <Spacer />
        <Text modifiers={[mono(10), foregroundStyle('#FFFFFF'), padding({ horizontal: 4 }), background(bgSet[4] ?? '#E0281E')]}>{props.today}</Text>
      </HStack>
      {rows.map((r, i) => (
        <HStack key={i} spacing={6} modifiers={[padding({ vertical: 2 })]}>
          <Text modifiers={[font({ size: 10.5, weight: 'medium' }), foregroundStyle(textSet[2] ?? '#111'), lineLimit(1)]}>{r.title}</Text>
          <Spacer />
          {r.day ? <Text modifiers={[mono(9), foregroundStyle(timeSet[3] ?? '#5E5E58')]}>{r.day}</Text> : null}
          <Text modifiers={[mono(9.5), foregroundStyle(timeSet[2] ?? '#111')]}>{r.time}</Text>
        </HStack>
      ))}
      <Spacer />
      {rec ? (
        <HStack>
          <Spacer />
          {rec}
        </HStack>
      ) : null}
    </VStack>
  );
};

export default createWidget('KstatiWidget', KstatiWidgetView);
