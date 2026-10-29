/** Заметки-списки голосом: разбор перечня и правка пунктов */
import assert from 'node:assert/strict';
import { applyListEdit, bodyHint, listBody, spokenList } from '../src/lists.js';

assert.deepEqual(spokenList('Список продуктов: молоко, яйца, хлеб, крупа, макароны и что-нибудь сладенькое'), {
  title: 'Список продуктов',
  items: ['молоко', 'яйца', 'хлеб', 'крупа', 'макароны', 'что-нибудь сладенькое'],
});
assert.equal(spokenList('Мысль: одна'), null, 'один пункт — не список');
assert.equal(spokenList('Без двоеточия, но с запятыми'), null);
assert.equal(listBody(['молоко', 'яйца.']), '- [ ] Молоко\n- [ ] Яйца');

const body = '- [ ] Молоко\n- [x] Яйца\n- [ ] Хлеб белый';
let r = applyListEdit(body, { add: ['сыр', 'кефир'], remove: ['хлеб'], replace: [{ from: 'молоко', to: 'кефир' }], check: ['кефир'] });
assert.equal(r.body, '- [x] Кефир\n- [x] Яйца\n- [ ] Сыр');
assert.deepEqual(r.changes, ['Молоко → Кефир', '− Хлеб белый', '✓ Кефир', '+ Сыр']);
r = applyListEdit('# Поездка\nВзять:\n- [ ] Палатка\nЗаметка в конце', { add: ['термос'], uncheck: ['палатка'] });
assert.equal(r.body, '# Поездка\nВзять:\n- [ ] Палатка\n- [ ] Термос\nЗаметка в конце', 'новый пункт — после последнего пункта');
assert.deepEqual(applyListEdit('', { add: ['хлеб'] }).body, '- [ ] Хлеб', 'пустая тема');
assert.equal(applyListEdit(body, { remove: ['ананас'] }).changes.length, 0, 'чего нет — не трогаем');
assert.equal(bodyHint(body), 'Молоко; ✓Яйца; Хлеб белый');

console.log('✓ заметки-списки: разбор и правка пунктов');
