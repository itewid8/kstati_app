/** Сайт и поддержка: политика конфиденциальности и письмо в поддержку (настройки, регистрация) */
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

export const SITE = 'https://kstati-app.ru';
export const PRIVACY_URL = `${SITE}/privacy`;
export const SUPPORT_EMAIL = 'support@kstati-app.ru';

export const openPrivacy = () => void WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => Linking.openURL(PRIVACY_URL).catch(() => {}));
export const contactSupport = () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Кстати')}`).catch(() => {});
