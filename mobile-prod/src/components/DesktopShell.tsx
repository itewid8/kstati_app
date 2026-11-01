/**
 * Компьютерная раскладка веб-версии (окно от 1024 px): боковая панель слева, содержимое справа.
 * В панели — группа, разделы, лента, профиль и запись голоса (на телефоне это верхняя панель и нижняя навигация).
 * Списки и формы — по центру шириной до CONTENT_MAX, календарь — во всю ширину.
 * Горячие клавиши: 1–4 — разделы, N — новое дело, R — запись голоса, Esc — закрыть окно голоса.
 */
import { router, usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useChrome } from '@/containers/common/useChrome';
import { nav } from '@/containers/common/nav';
import { useSignedIn } from '@/containers/common/signedIn';
import { cancelVoice, toggleRecording } from '@/lib/voice';
import { useStore } from '@/lib/store';
import { CONTENT_MAX, Icon, SIDEBAR_WIDTH, fonts, hovered, personColor, personInk, size as S, type as T, useDesktop, useTheme, type IconName, type NavTab } from '@/ui';

const TABS: ReadonlyArray<{ key: NavTab; label: string; key1: string }> = [
  { key: 'tasks', label: 'Дела', key1: '1' },
  { key: 'wishes', label: 'Хочу', key1: '2' },
  { key: 'watch', label: 'Смотреть', key1: '3' },
  { key: 'ideas', label: 'Заметки', key1: '4' },
];

/** Раздел по адресу: план и редакторы дел — «Дела», темы и заметки — «Заметки» */
function tabOf(path: string): NavTab | null {
  if (/^\/(tasks|edit)/.test(path)) return 'tasks';
  if (path.startsWith('/wishes')) return 'wishes';
  if (path.startsWith('/watch')) return 'watch';
  if (/^\/(ideas|note|notes-import)/.test(path)) return 'ideas';
  return null;
}

/* ---------- наведение, фокус, прокрутка: стили браузера один раз ---------- */
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('kstati-desktop-css')) {
  const el = document.createElement('style');
  el.id = 'kstati-desktop-css';
  el.textContent = `
    @media (hover: hover) and (min-width: 1024px) {
      [role="button"]:not([aria-disabled="true"]):hover, [role="tab"]:hover, [role="checkbox"]:hover, [role="switch"]:hover { opacity: .82 }
    }
    :focus-visible { outline: 2px solid #2F6BDB !important; outline-offset: 2px }
    * { scrollbar-width: thin }
  `;
  document.head.appendChild(el);
}

/** Горячие клавиши (не в полях ввода и не с Cmd/Ctrl) */
function useHotkeys(onNavigate: (t: NavTab) => void) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const tab = TABS.find((x) => x.key1 === e.key);
      if (tab) return onNavigate(tab.key);
      const k = e.key.toLowerCase();
      if (k === 'n' || k === 'т') {
        e.preventDefault();
        router.push(nav.taskEditor({ date: useStore.getState().calendarDate }));
      } else if (k === 'r' || k === 'к') {
        e.preventDefault();
        toggleRecording();
      } else if (e.key === 'Escape') cancelVoice();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNavigate]);
}

export function DesktopShell({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  const signedIn = useSignedIn();
  const path = usePathname();
  const { c } = useTheme();
  if (!desktop || !signedIn || /^\/(login|onboarding)/.test(path)) return <>{children}</>;
  const full = path.startsWith('/tasks');
  return (
    <View style={[styles.row, { backgroundColor: c.bg }]}>
      <Sidebar active={tabOf(path)} />
      <View style={[styles.main, { borderLeftColor: c.border }]}>
        <View style={[styles.content, !full && styles.narrow]}>{children}</View>
      </View>
    </View>
  );
}

function Sidebar({ active }: { active: NavTab | null }) {
  const { c, scheme } = useTheme();
  const chrome = useChrome(active ?? 'tasks');
  useHotkeys(chrome.onNavigate);
  const meFill = personColor(chrome.me.color, scheme);
  return (
    <View style={[styles.side, { backgroundColor: c.bg }]}>
      <Text style={[styles.brand, { color: c.text }]}>Кстати</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Группа: ${chrome.groupLabel}`}
        onPress={chrome.onPickGroup}
        style={(st) => [styles.group, { borderColor: c.border, backgroundColor: hovered(st) ? c.hair : c.panel }]}
      >
        <Text numberOfLines={1} style={[T.group, styles.flex, { color: c.text }]}>{chrome.groupLabel}</Text>
        <Icon name="chevronDown" size={12} color={c.text} strokeWidth={2.5} />
      </Pressable>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => chrome.onNavigate(t.key)}
              style={(st) => [styles.tab, { borderColor: c.border, backgroundColor: on ? c.text : hovered(st) ? c.hair : c.panel }]}
            >
              <Text style={[styles.tabLabel, { color: on ? c.bg : c.text }]}>{t.label}</Text>
              <Text style={[styles.hint, { color: on ? c.bg : c.muted }]}>{t.key1}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.flex} />

      <SideLink icon="bell" label="Лента" dot={chrome.hasNews} onPress={chrome.onOpenFeed} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Профиль и настройки"
        onPress={chrome.onOpenSettings}
        style={(st) => [styles.link, { backgroundColor: hovered(st) ? c.hair : 'transparent' }]}
      >
        <View style={[styles.avatar, { backgroundColor: meFill }]}>
          <Text style={[styles.avatarText, { color: personInk(chrome.me.color, scheme) }]}>{chrome.me.letter}</Text>
        </View>
        <Text style={[styles.linkLabel, { color: c.text }]}>Профиль</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Голосовая команда"
        onPress={chrome.onRec}
        style={(st) => [styles.rec, { borderColor: c.border, backgroundColor: hovered(st) ? c.hair : c.panel }]}
      >
        <View style={[styles.recDot, { backgroundColor: c.red }]} />
        <Text style={[T.navActive, styles.flex, { color: c.text }]}>ЗАПИСАТЬ</Text>
        <Text style={[styles.hint, { color: c.muted }]}>R</Text>
      </Pressable>
    </View>
  );
}

function SideLink({ icon, label, dot, onPress }: { icon: IconName; label: string; dot?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={(st) => [styles.link, { backgroundColor: hovered(st) ? c.hair : 'transparent' }]}>
      <View style={styles.icon}>
        <Icon name={icon} size={18} color={c.text} />
        {dot ? <View style={[styles.dot, { backgroundColor: c.red }]} /> : null}
      </View>
      <Text style={[styles.linkLabel, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, borderLeftWidth: S.border },
  content: { flex: 1, width: '100%' },
  narrow: { maxWidth: CONTENT_MAX, alignSelf: 'center' },
  flex: { flex: 1 },
  side: { width: SIDEBAR_WIDTH, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 10 },
  brand: { fontFamily: fonts.sans700, fontSize: 24, letterSpacing: -1, marginBottom: 6 },
  group: { height: 40, borderWidth: S.border, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabs: { gap: 6, marginTop: 6 },
  tab: { height: 40, borderWidth: S.border, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  tabLabel: { flex: 1, fontFamily: fonts.sans500, fontSize: 14 },
  hint: { fontFamily: fonts.mono400, fontSize: 10, letterSpacing: 0.8 },
  link: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  linkLabel: { fontFamily: fonts.sans500, fontSize: 14 },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 1, right: 1, width: 7, height: 7, borderRadius: 4 },
  avatar: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.mono600, fontSize: 11 },
  rec: { height: 52, borderWidth: S.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  recDot: { width: 16, height: 16, borderRadius: 8 },
});
