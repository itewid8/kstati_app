/**
 * Виджет «Кстати» для iPhone (expo-widgets, SwiftUI из @expo/ui).
 *   Рабочий стол, маленький и средний: ближайшие дела и микрофон.
 *   Экран блокировки: круглый — микрофон, прямоугольный — два ближайших дела.
 * Нажатие — kstati://record: приложение открывается сразу в записи голоса (в этом весь смысл виджета).
 *
 * Код внутри 'widget' выполняется отдельно от приложения: без хуков, без функций и констант модуля —
 * всё готовое (подписи, цвета) приходит в props.
 */
import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, clipShape, containerBackground, font, foregroundStyle, frame, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type IosWidgetProps = {
  rows: { title: string; when: string }[];
  /** Цвета для светлой и тёмной темы телефона: [фон, текст, приглушённый, микрофон, значок на микрофоне] */
  light: string[];
  dark: string[];
};

/** Настройки виджета («Изменить виджет» на iPhone) — см. ios.configuration в app.json */
type Tone = 'auto' | 'light' | 'dark';
export type IosWidgetConfig = { mic: boolean; bg: Tone; micTone: Tone; text: Tone; time: Tone };

const KstatiWidgetView = (props: IosWidgetProps, environment: WidgetEnvironment<IosWidgetConfig>) => {
  'widget';
  const family = environment.widgetFamily;
  const cfg = environment.configuration;
  const showMic = cfg?.mic !== false;
  const themeDark = environment.colorScheme !== 'light';
  // Фон: как в теме телефона или принудительно светлый/тёмный
  const bgSet = cfg?.bg === 'light' ? props.light : cfg?.bg === 'dark' ? props.dark : themeDark ? props.dark : props.light;
  // Текст и микрофон: «как в теме» — контрастные к фону; «светлый» — светлые буквы
  const textSet = cfg?.text === 'light' ? props.dark : cfg?.text === 'dark' ? props.light : bgSet;
  const micSet = cfg?.micTone === 'light' ? props.dark : cfg?.micTone === 'dark' ? props.light : bgSet;
  const bg = bgSet[0];
  const text = textSet[1];
  const muted = bgSet[2];
  // Время: как в теме — приглушённое; светлое/тёмное — в полную яркость
  const timeColor = cfg?.time === 'light' ? props.dark[1] : cfg?.time === 'dark' ? props.light[1] : muted;
  const mic = micSet[3];
  const onMic = micSet[4];

  if (family === 'accessoryCircular') {
    return <Image systemName="mic.fill" size={20} modifiers={[widgetURL('kstati://record')]} />;
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL('kstati://record')]}>
        {props.rows.length === 0 ? <Text modifiers={[font({ size: 14 })]}>Дел нет</Text> : null}
        {props.rows.slice(0, 2).map((r, i) => (
          <Text key={i} modifiers={[font({ size: 14 }), lineLimit(1)]}>
            {r.when ? `${r.when}  ${r.title}` : r.title}
          </Text>
        ))}
      </VStack>
    );
  }

  const small = family === 'systemSmall';
  const large = family === 'systemLarge';
  const rows = props.rows.slice(0, small ? 3 : large ? 8 : 4);
  const micButton = showMic ? (
    <Image
      systemName="mic.fill"
      size={small ? 16 : 18}
      color={onMic}
      modifiers={[frame({ width: small ? 36 : 40, height: small ? 36 : 40 }), background(mic), clipShape('circle')]}
    />
  ) : null;

  // Время слева, название сразу за ним
  const list = (
    <VStack alignment="leading" spacing={5}>
      {rows.length === 0 ? <Text modifiers={[font({ size: 14 }), foregroundStyle(muted)]}>Дел нет</Text> : null}
      {rows.map((r, i) => (
        <HStack key={i} spacing={6}>
          {r.when ? <Text modifiers={[font({ size: 12, design: 'monospaced' }), foregroundStyle(timeColor), lineLimit(1)]}>{r.when}</Text> : null}
          <Text modifiers={[font({ size: 14 }), foregroundStyle(text), lineLimit(1)]}>{r.title}</Text>
        </HStack>
      ))}
    </VStack>
  );

  // Маленький и большой: дела сверху во всю ширину, микрофон снизу по центру
  if (small || large) {
    return (
      <VStack alignment="leading" modifiers={[widgetURL('kstati://record'), containerBackground(bg, 'widget')]}>
        {list}
        <Spacer />
        <HStack>
          <Spacer />
          {micButton}
          <Spacer />
        </HStack>
      </VStack>
    );
  }

  return (
    <HStack modifiers={[widgetURL('kstati://record'), containerBackground(bg, 'widget'), padding({ horizontal: 4 })]}>
      {list}
      <Spacer />
      {micButton}
    </HStack>
  );
};

export default createWidget('KstatiWidget', KstatiWidgetView);
