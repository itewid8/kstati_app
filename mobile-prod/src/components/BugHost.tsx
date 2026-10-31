/**
 * Всё про отчёты об ошибках в корне приложения: кнопка-жучок, окно отчёта, журнал переходов между экранами,
 * ловушка падений и вопрос «В прошлый раз приложение закрылось с ошибкой — отправить отчёт?» после запуска.
 */
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { openMenu } from '@/components/ActionMenu';
import { useBug } from '@/lib/bugReport';
import { installCrashHandler, logEvent, takeCrash } from '@/lib/diag';
import { useStore } from '@/lib/store';
import { BugButton } from './BugButton';
import { BugReport } from './BugReport';

installCrashHandler();

export function BugHost() {
  const route = usePathname();
  const signedIn = useStore((s) => !!s.session);
  useEffect(() => logEvent('route', route), [route]);
  // Падение прошлого запуска — спросить, когда приложение уже открылось и человек вошёл
  useEffect(() => {
    if (!signedIn) return;
    const crash = takeCrash();
    if (!crash) return;
    const t = setTimeout(
      () =>
        openMenu({
          title: 'В прошлый раз приложение закрылось с ошибкой. Отправить отчёт?',
          actions: [{ label: 'Отправить отчёт', onPress: () => setTimeout(() => useBug.getState().open({ shot: null, route, crash }), 300) }],
        }),
      1500,
    );
    return () => clearTimeout(t);
    // Только при входе: маршрут в отчёте — тот, что открыт сейчас
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);
  return (
    <>
      <BugButton />
      <BugReport />
    </>
  );
}
