// Sample: only the top bar + «Хочу» title of C-Wishes, to prove the harness end to end.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Theme = 'light' | 'dark';

const palette = {
  light: { bg: '#E7E6E1', panel: '#F4F3EF', border: '#161616', text: '#111111', muted: '#5E5E58', s: '#2F6BDB', sInk: '#FFFFFF' },
  dark: { bg: '#0B0B0B', panel: '#151515', border: '#2E2E2E', text: '#F2F2F0', muted: '#7C7C78', s: '#5B8DEF', sInk: '#1A1A1A' },
} as const;

const PLUS = 'M12 5v14M5 12h14';
const BELL = 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0';

function IconButton({ d, theme }: { d: string; theme: Theme }) {
  const p = palette[theme];
  return (
    <View style={[styles.button, { borderColor: p.border, backgroundColor: p.panel }]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={p.text} strokeWidth={2}>
        <Path d={d} />
      </Svg>
    </View>
  );
}

export function WishesHeader({ theme }: { theme: Theme }) {
  const p = palette[theme];
  return (
    <View style={[styles.screen, { backgroundColor: p.bg }]}>
      <View style={styles.topBar}>
        <Text style={[styles.caption, { color: p.muted }]}>ВИШЛИСТЫ · 4 ЧЕЛОВЕКА</Text>
        <IconButton d={PLUS} theme={theme} />
        <IconButton d={BELL} theme={theme} />
        <View style={[styles.button, { borderColor: p.border, backgroundColor: p.s }]}>
          <Text style={[styles.avatar, { color: p.sInk }]}>С</Text>
        </View>
      </View>
      <Text style={[styles.title, { color: p.text }]}>Хочу</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, top: 20, height: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  caption: { flex: 1, fontFamily: 'Geist Mono', fontSize: 10, letterSpacing: 0.8 },
  button: { width: 40, height: 40, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  avatar: { fontFamily: 'Geist Mono', fontSize: 15, fontWeight: '600' },
  title: { position: 'absolute', left: 16, right: 16, top: 70, fontFamily: 'Geist', fontSize: 40, fontWeight: '700', letterSpacing: -2, lineHeight: 42 },
});
