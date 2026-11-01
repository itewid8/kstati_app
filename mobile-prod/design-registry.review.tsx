// Все экраны для структурного ревью (design/review). Собирает реестры стенда + доп. экраны.
import { screens as account } from './design-registry.account';
import { screens as calendar } from './design-registry.calendar';
import { screens as editors } from './design-registry.editors';
import { screens as lists } from './design-registry.lists';
import { screens as quick } from './design-registry.quick';
import { screens as voice } from './design-registry.voice';
import { screens as widget } from './design-registry.widget';
import { screens as wishes } from './design-registry';
import { screens as extra } from './design-registry.extra';

export const screens = { ...account, ...calendar, ...editors, ...lists, ...quick, ...voice, ...widget, ...wishes, ...extra };
