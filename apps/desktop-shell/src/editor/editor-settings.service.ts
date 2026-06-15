import { logger } from "../utils/logger";
import { z } from "zod";

export type EditorTheme = "dark" | "light" | "monokai" | "solarized";

export type EditorSettings = {
  autoSave: boolean;
  autoSaveDelay: number;
  wordWrap: boolean;
  fontSize: number;
  theme: EditorTheme;
  lineNumbers: boolean;
  codeFolding: boolean;
  formatOnSave: boolean;
  tabSize: number;
};

export type EditorSettingsEvent = {
  type: "settings:changed";
  key: keyof EditorSettings;
  value: unknown;
};

export type EditorSettingsListener = (event: EditorSettingsEvent) => void;

const STORAGE_KEY = "ocl_editor_settings";

const DEFAULT_SETTINGS: EditorSettings = {
  autoSave: false,
  autoSaveDelay: 1000,
  wordWrap: false,
  fontSize: 13,
  theme: "dark",
  lineNumbers: true,
  codeFolding: true,
  formatOnSave: false,
  tabSize: 2,
};

export class EditorSettingsService {
  private settings: EditorSettings = { ...DEFAULT_SETTINGS };
  private listeners = new Set<EditorSettingsListener>();

  constructor() {
    this.load();
  }

  get<K extends keyof EditorSettings>(key: K): EditorSettings[K] {
    return this.settings[key];
  }

  getAll(): EditorSettings {
    return { ...this.settings };
  }

  set<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]): void {
    this.settings[key] = value;
    this.save();
    this.emit({ type: "settings:changed", key, value });
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof EditorSettings>) {
      this.emit({ type: "settings:changed", key, value: this.settings[key] });
    }
  }

  subscribe(listener: EditorSettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(stored));
        if (parsed.success) {
          this.settings = { ...DEFAULT_SETTINGS, ...(parsed.data as Partial<EditorSettings>) };
        }
      }
    } catch (error) {
      logger.debug('EditorSettings', 'Failed to load settings, using defaults', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      logger.debug('EditorSettings', 'Failed to save settings to localStorage', error);
    }
  }

  private emit(event: EditorSettingsEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
