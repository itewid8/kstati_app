/** Быстрые действия по удержанию (C-QuickTask, C-QuickWish, C-QuickWatch, C-QuickIdea): данные окна */
import type { PersonColor } from '@/lib/types';
import type { LiftTarget } from '@/ui';

/** Плитка действия: значок по ключу (ГОТОВО / ПОСМОТРЕЛИ / ПОЛУЧИЛ — галочка, ПОДАРЮ — подарок…) */
export type QuickTileKey = 'done' | 'watched' | 'received' | 'gift' | 'edit' | 'plan' | 'openPlan' | 'copy' | 'link' | 'toTask' | 'remind';

export type QuickTile = {
  key: QuickTileKey;
  /** «ГОТОВО», «В ПЛАН» */
  label: string;
  /** Залитая плитка — главное действие */
  primary?: boolean;
  disabled?: boolean;
};

/** Карточка записи: полоса цвета людей, название, ярлык справа, подпись */
export type QuickCard = {
  title: string;
  /** «КАЖДУЮ НЕДЕЛЮ», «OZON.RU», «РЕМОНТ» */
  tag?: string;
  /** «ПН 05 ОКТ · 19:00–20:00 · КАРИНА» */
  meta: string;
  /** Сверху вниз; пусто — без полосы */
  colors: readonly PersonColor[];
};

/** Кнопка ряда «ПЕРЕНЕСТИ» / «В ТЕМУ» */
export type QuickSegment = { key: string; label: string; disabled?: boolean };

export type QuickSection = {
  /** «ПЕРЕНЕСТИ», «В ТЕМУ» */
  label: string;
  segments: readonly QuickSegment[];
};

/** Что показывает окно (адаптер → экран) */
export type QuickSheetData = {
  card: QuickCard;
  tiles: readonly QuickTile[];
  section?: QuickSection;
  /** Кнопка УДАЛИТЬ рядом с ЗАКРЫТЬ */
  deletable: boolean;
};

export type QuickActionsSheetProps = QuickSheetData & {
  /** Нажатый элемент, поднятый над затемнением */
  lift?: LiftTarget | null;
  bottomInset?: number;
  onTile?: (key: QuickTileKey) => void;
  onSegment?: (key: string) => void;
  onClose?: () => void;
  onDelete?: () => void;
};
