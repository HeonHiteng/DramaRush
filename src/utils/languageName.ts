const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ms: 'Malay',
  zh: 'Chinese',
  ko: 'Korean',
  es: 'Spanish',
  pt: 'Portuguese',
};

/** `series.language` holds either a code ("ms") or a full name ("English"),
 * depending on how the series was uploaded. Unknown values pass through. */
export function languageName(language: string): string {
  return LANGUAGE_NAMES[language.toLowerCase()] ?? language;
}
