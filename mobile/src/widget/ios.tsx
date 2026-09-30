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
  bg: string;
  text: string;
  muted: string;
  mic: string;
  onMic: string;
};

const KstatiWidgetView = (props: IosWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const family = environment.widgetFamily;

  if (family === 'accessoryCircular') {
    return <Image systemName="mic.fill" size={22} modifiers={[widgetURL('kstati://record')]} />;
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL('kstati://record')]}>
        {props.rows.length === 0 ? <Text modifiers={[font({ size: 14 })]}>Дел нет</Text> : null}
        {props.rows.slice(0, 2).map((r, i) => (
          <Text key={i} modifiers={[font({ size: 14 }), lineLimit(1)]}>
            {`${r.when}  ${r.title}`}
          </Text>
        ))}
      </VStack>
    );
  }

  const rows = props.rows.slice(0, family === 'systemSmall' ? 2 : 3);
  const micButton = (
    <Image
      systemName="mic.fill"
      size={family === 'systemSmall' ? 20 : 24}
      color={props.onMic}
      modifiers={[frame({ width: family === 'systemSmall' ? 44 : 56, height: family === 'systemSmall' ? 44 : 56 }), background(props.mic), clipShape('circle')]}
    />
  );

  const list = (
    <VStack alignment="leading" spacing={6}>
      {rows.length === 0 ? <Text modifiers={[font({ size: 14 }), foregroundStyle(props.muted)]}>Дел нет</Text> : null}
      {rows.map((r, i) => (
        <VStack key={i} alignment="leading" spacing={0}>
          <Text modifiers={[font({ size: 14 }), foregroundStyle(props.text), lineLimit(1)]}>{r.title}</Text>
          <Text modifiers={[font({ size: 12, design: 'monospaced' }), foregroundStyle(props.muted), lineLimit(1)]}>{r.when}</Text>
        </VStack>
      ))}
    </VStack>
  );

  if (family === 'systemSmall') {
    return (
      <VStack alignment="leading" modifiers={[widgetURL('kstati://record'), containerBackground(props.bg, 'widget')]}>
        {list}
        <Spacer />
        <HStack>
          <Spacer />
          {micButton}
        </HStack>
      </VStack>
    );
  }

  return (
    <HStack modifiers={[widgetURL('kstati://record'), containerBackground(props.bg, 'widget'), padding({ horizontal: 4 })]}>
      {list}
      <Spacer />
      {micButton}
    </HStack>
  );
};

export default createWidget('KstatiWidget', KstatiWidgetView);
