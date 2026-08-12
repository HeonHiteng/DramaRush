import { useCallback } from 'react';
import { useSettingsStore } from '@/store';
import { translations, DEFAULT_LANGUAGE, type TranslationKey, type LanguageCode } from './translations';

function isLanguageCode(v: string): v is LanguageCode {
  return v in translations;
}

/** Returns t(key, vars?) bound to the current interface language. Falls
 * back to English for any key missing in the active language, and to the
 * raw key itself if it's missing everywhere (visible-but-harmless, easier
 * to spot in review than a blank string). */
export function useTranslation() {
  const rawLanguage = useSettingsStore((s) => s.language);
  const language: LanguageCode = isLanguageCode(rawLanguage) ? rawLanguage : DEFAULT_LANGUAGE;

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const template = translations[language][key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
      if (!vars) return template;
      return Object.entries(vars).reduce<string>(
        (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
        template
      );
    },
    [language]
  );

  return { t, language };
}
