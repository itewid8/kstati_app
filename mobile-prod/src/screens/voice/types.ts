/**
 * Общие типы голосовых окон (C-Voice, C-AskDelete, C-AskMove, C-AskWeek, C-AskWeekend).
 */
import type { ID, PersonColor } from '@/lib/types';

/** Человек в распознанной команде: квадрат его цвета + имя */
export type VoicePerson = {
  id: ID;
  /** «САНЯ» */
  name: string;
  color: PersonColor;
};

/**
 * Шапка окна: длительность записи, волна громкости, ярлык действия.
 * live — идёт запись (красная точка «REC», яркая волна по центру);
 * иначе запись закончена (серая точка, приглушённая волна слева и ярлык «УДАЛИТЬ» / «ПОКАЗАТЬ»).
 */
export type VoiceSheetHeader = {
  /** «00:04» */
  duration: string;
  /** Громкость по столбикам, 0–100 */
  levels: readonly number[];
  live?: boolean;
  /** Ярлык распознанного действия: «ПЕРЕНЕСТИ» */
  badge?: string;
};

export type SheetActionTone = 'default' | 'primary' | 'danger';

/** Кнопка нижнего ряда окна */
export type SheetAction = {
  key: string;
  label: string;
  /** default — панель, primary — заливка цветом текста, danger — красная */
  tone?: SheetActionTone;
  /** Доля ширины (по умолчанию 1; главная кнопка 1.3 / 1.6) */
  flex?: number;
  onPress?: () => void;
};

/** Дело в карточке «о чём речь» (удаление, перенос) */
export type VoiceTaskCard = {
  id: ID;
  title: string;
  /** Справа от названия: «КАЖДУЮ НЕДЕЛЮ», «КЛИНИКА НА МИРА» */
  tag?: string;
  /** «СБ 10 ОКТ · 10:00–11:30 · КАРИНА» */
  meta: string;
  /** Цвета участников — полоса слева (несколько — делится поровну) */
  colors: readonly PersonColor[];
};
