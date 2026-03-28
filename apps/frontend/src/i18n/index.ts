/**
 * @file i18n/index.ts — i18next initialisation.
 *
 * Configures the i18next instance with:
 * - **Automatic language detection** via `i18next-browser-languagedetector`
 *   (reads from `localStorage`, `navigator.language`, etc.).
 * - **React integration** via `react-i18next` so that `useTranslation()`
 *   hooks re-render components when the language changes.
 * - Three supported locales: `en`, `pt-BR`, `es`.
 * - `fallbackLng: 'en'` — any unsupported locale falls back to English.
 *
 * Import this module once (in `App.tsx`) as a side effect:
 * ```ts
 * import './i18n';
 * ```
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';
import es from './locales/es.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'pt-BR': { translation: ptBR },
      es: { translation: es },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
