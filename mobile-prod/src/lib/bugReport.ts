/**
 * Отчёт с кнопки-жучка: что сейчас открыто (снимок, экран, падение) — общее для кнопки, окна отчёта и ловушки ошибок.
 * Не сохраняется на телефоне: живёт, пока открыто окно.
 */
import { create } from 'zustand';
import type { CrashInfo } from './diag';

export type BugReportDraft = {
  /** Снимок экрана (файл); null — без снимка */
  shot: string | null;
  /** Экран, где нажали кнопку */
  route: string;
  /** Падение прошлого запуска или ошибка интерфейса — приложится к отчёту */
  crash?: CrashInfo | null;
};

type BugState = {
  /** Кнопка спрятана на время снимка */
  capturing: boolean;
  report: BugReportDraft | null;
  setCapturing: (on: boolean) => void;
  open: (report: BugReportDraft) => void;
  close: () => void;
};

export const useBug = create<BugState>((set) => ({
  capturing: false,
  report: null,
  setCapturing: (capturing) => set({ capturing }),
  open: (report) => set({ report, capturing: false }),
  close: () => set({ report: null }),
}));
