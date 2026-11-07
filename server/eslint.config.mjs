// Проверка кода сервера: типовые ошибки TypeScript и небезопасные паттерны (eslint-plugin-security).
// Запуск: npm run lint. Ошибки ломают проверку в GitHub Actions, предупреждения — нет.
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.data/**', 'logs/**'] },
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      // Доступ по ключу из своих же данных — почти всегда ложная тревога
      'security/detect-object-injection': 'off',
      // Регулярные выражения собираются из своих констант, а не из ввода; ReDoS проверен на длинных строках
      'security/detect-non-literal-regexp': 'off',
      'security/detect-unsafe-regex': 'warn',
      // Пути к файлам — из настроек сервера (журнал, локальная база), не из запроса
      'security/detect-non-literal-fs-filename': 'warn',
    },
  },
  {
    // Тесты, оценка и генератор датасета: свободнее с типами
    files: ['test/**', 'eval/**', 'train/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
