// Page bootstrap: renders one screen from the registry (`__entry__`) into #root.
// URL: index.html?screen=<Name>&theme=light|dark   (no screen -> only lists screens)
import React from 'react';
import { createRoot } from 'react-dom/client';

type Theme = 'light' | 'dark';
type Screen = (props: { theme: Theme }) => React.ReactNode;
type Status = { screens: string[]; ready: boolean; error: string | null };

declare global {
  interface Window { __harness: Status }
}

const status: Status = (window.__harness = { screens: [], ready: false, error: null });
const fail = (e: unknown) => {
  status.error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
};
window.addEventListener('error', (e) => fail(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => fail(e.reason));

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { fail(e); }
  render() { return this.state.failed ? null : this.props.children; }
}

function loadScreens(): Record<string, Screen> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('__entry__');
  if (mod.screens) return mod.screens;
  if (mod.default) return { [mod.default.displayName || mod.default.name || 'Default']: mod.default };
  throw new Error('entry must export `screens` or a default component');
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

async function main() {
  const screens = loadScreens();
  status.screens = Object.keys(screens);
  const params = new URLSearchParams(location.search);
  const name = params.get('screen');
  const theme: Theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  if (name) {
    const ScreenComponent = screens[name];
    if (!ScreenComponent) throw new Error(`unknown screen "${name}"; registered: ${status.screens.join(', ')}`);
    createRoot(document.getElementById('root')!).render(
      <Boundary><ScreenComponent theme={theme} /></Boundary>,
    );
  }
  await nextFrame();
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => null)));
  await document.fonts.ready;
  const broken = [...document.fonts].filter((f) => f.status !== 'loaded');
  if (broken.length) throw new Error(`fonts not loaded: ${broken.map((f) => `${f.family} ${f.weight}`).join(', ')}`);
  await nextFrame();
  await nextFrame();
  status.ready = true;
}

main().catch(fail);
