/** Данные макета C-Code (design/mockups/C-Code.dc.html): введены три цифры, до повтора 42 с */
import type { CodeScreenProps } from '../../account/CodeScreen';

export function codeFixture(): CodeScreenProps {
  return {
    email: 'sasha@yandex.ru',
    code: '481',
    resendIn: 42,
  };
}
