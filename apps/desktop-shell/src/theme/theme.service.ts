export type Theme = "dark" | "light" | "high-contrast";

const STORAGE_KEY = "ocl_theme";
const THEME_ATTR = "data-theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readSavedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light" || saved === "high-contrast") return saved;
  } catch {}
  return null;
}

export class ThemeService {
  private current: Theme;
  private listeners = new Set<(theme: Theme) => void>();
  private mediaQuery: MediaQueryList | null = null;
  private mediaHandler: (() => void) | null = null;

  constructor() {
    this.current = readSavedTheme() ?? getSystemTheme();
    this.apply(this.current);
    this.watchSystem();
  }

  get(): Theme {
    return this.current;
  }

  set(theme: Theme): void {
    this.current = theme;
    this.apply(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    for (const fn of this.listeners) fn(theme);
  }

  toggle(): Theme {
    const next: Record<Theme, Theme> = {
      dark: "light",
      light: "high-contrast",
      "high-contrast": "dark",
    };
    this.set(next[this.current]);
    return this.current;
  }

  reset(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    this.set(getSystemTheme());
  }

  onChange(fn: (theme: Theme) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  destroy(): void {
    this.listeners.clear();
    if (this.mediaQuery && this.mediaHandler) {
      this.mediaQuery.removeEventListener("change", this.mediaHandler);
    }
  }

  private apply(theme: Theme): void {
    document.documentElement.setAttribute(THEME_ATTR, theme);
  }

  private watchSystem(): void {
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    this.mediaHandler = () => {
      const saved = readSavedTheme();
      if (!saved) {
        this.current = getSystemTheme();
        this.apply(this.current);
      }
    };
    this.mediaQuery.addEventListener("change", this.mediaHandler);
  }
}
