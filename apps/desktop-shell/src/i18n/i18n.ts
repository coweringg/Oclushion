import i18next from "i18next";
import { logger } from "../utils/logger";

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import pt from "./locales/pt.json";
import zh from "./locales/zh.json";
import { translateUI } from "./translate";

const STORAGE_KEY = "ocl-lang";
const DEFAULT_LANG = "en";
const SUPPORTED_LANGS = ["en", "es", "fr", "zh", "pt", "de", "ja", "ko"] as const;

export type IdeLanguage = (typeof SUPPORTED_LANGS)[number];

export const i18n = i18next;

export async function initI18n(): Promise<void> {
  const savedLang = normalizeLanguage(readSavedLanguage());

  await i18next.init({
    lng: savedLang,
    fallbackLng: DEFAULT_LANG,
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      zh: { translation: zh },
      pt: { translation: pt },
      de: { translation: de },
      ja: { translation: ja },
      ko: { translation: ko },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export async function changeLanguage(lang: string): Promise<void> {
  const normalized = normalizeLanguage(lang);
  await i18next.changeLanguage(normalized);
  localStorage.setItem(STORAGE_KEY, normalized);
  translateUI();
}

export function getCurrentLanguage(): IdeLanguage {
  return normalizeLanguage(i18next.language);
}

function readSavedLanguage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    logger.debug('I18n', 'Failed to read saved language from localStorage', error);
    return null;
  }
}

function normalizeLanguage(value: string | null | undefined): IdeLanguage {
  return SUPPORTED_LANGS.includes(value as IdeLanguage) ? (value as IdeLanguage) : DEFAULT_LANG;
}
