/** Веб: AppMetrica для React Native в браузере не работает — те же вызовы, которые ничего не делают */
export const initAnalytics = () => {};
export const track = (_event: string, _params?: Record<string, string | number | boolean>) => {};
export const setAnalyticsUser = (_id: string | null) => {};
export const reportCrash = (_e: unknown, _trail: string) => {};
export const reportProblem = (_e: unknown, _trail: string) => {};
