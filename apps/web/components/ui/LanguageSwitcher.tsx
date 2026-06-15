"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LOCALES = [
  { code: "en", label: "EN", name: "English" },
  { code: "es", label: "ES", name: "Español" },
  { code: "fr", label: "FR", name: "Français" },
  { code: "zh", label: "ZH", name: "中文" },
  { code: "pt", label: "PT", name: "Português" },
  { code: "de", label: "DE", name: "Deutsch" },
  { code: "ja", label: "JA", name: "日本語" },
  { code: "ko", label: "KO", name: "한국어" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("languageSwitcher");
  const [open, setOpen] = useState(false);
  const active = LOCALES.find(({ code }) => code === locale) ?? LOCALES[0];

  function switchLocale(nextLocale: string): void {
    document.cookie = `ocl-locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    const segments = pathname.split("/");
    if (LOCALES.some(({ code }) => code === segments[1])) {
      segments[1] = nextLocale;
      router.push(segments.join("/") || `/${nextLocale}`);
      return;
    }
    router.push(`/${nextLocale}${pathname === "/" ? "" : pathname}`);
  }

  return (
    <div className={`ocl-lang-switcher ${open ? "open" : ""}`}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("label")}
        className="ocl-lang-trigger"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <GlobeIcon />
        <span>{active.label}</span>
        <ChevronIcon />
      </button>
      <div className="ocl-lang-menu" role="menu">
        {LOCALES.map(({ code, label, name }) => (
          <button
            aria-current={locale === code ? "true" : undefined}
            className={locale === code ? "active" : ""}
            key={code}
            onClick={() => switchLocale(code)}
            role="menuitem"
            type="button"
          >
            <span>{label}</span>
            <small>{name}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.7 2.5 4.1 5.5 4.1 9S14.7 18.5 12 21M12 3C9.3 5.5 7.9 8.5 7.9 12S9.3 18.5 12 21" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}
