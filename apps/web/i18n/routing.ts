import { defineRouting } from "next-intl/routing";

export const locales = ["en", "es", "fr", "zh", "pt", "de", "ja", "ko"] as const;
export const defaultLocale = "en";
export const localeCookieName = "ocl-locale";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localeCookie: {
    name: localeCookieName,
    maxAge: 365 * 24 * 60 * 60,
  },
});

export type AppLocale = (typeof locales)[number];
