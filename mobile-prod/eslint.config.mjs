// Проверка кода приложения: типовые ошибки TypeScript, правила хуков React и небезопасные паттерны.
// Запуск: npm run lint. Ошибки ломают проверку в GitHub Actions, предупреждения — нет.
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'dist/**',
      'dist-web/**',
      '.expo/**',
      'scripts/shims/**',
      'design-registry*.tsx',
      '.preview-*',
      '**/*.js',
      '**/*.mjs',
    ],
  },
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', caughtErrors: 'none' }],
      // Нативные модули подключаются через require — если их нет (веб, Expo Go), приложение работает без них
      '@typescript-eslint/no-require-imports': 'off',
      // Доступ по ключу из своих же данных — почти всегда ложная тревога
      'security/detect-object-injection': 'off',
      // Регулярные выражения собираются из своих констант, а не из ввода
      'security/detect-non-literal-regexp': 'off',
      'security/detect-unsafe-regex': 'warn',
      // Сравнение строк в интерфейсе — не проверка секретов
      'security/detect-possible-timing-attacks': 'off',
    },
  },
  {
    files: ['**/*.test.ts', 'src/screens/fixtures/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
