import type { Extension } from "@codemirror/state";
import { logger } from "../utils/logger";
import type { Language } from "./editor.types";

const extensionMap: Record<string, Language> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  less: "css",
  py: "python",
  pyw: "python",
  rs: "rust",
  md: "markdown",
  mdx: "markdown",
  sql: "sql",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "shell",
  bat: "shell",
  cmd: "shell",
};

const languageLabels: Record<Language, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  python: "Python",
  rust: "Rust",
  markdown: "Markdown",
  sql: "SQL",
  xml: "XML",
  yaml: "YAML",
  toml: "TOML",
  shell: "Shell",
  plaintext: "Plain Text",
};

export class LanguageDetectorService {
  detect(extension: string): Language {
    return extensionMap[extension.toLowerCase()] ?? "plaintext";
  }

  getLabel(language: Language): string {
    return languageLabels[language] ?? "Plain Text";
  }

  getCodeMirrorLanguage(language: Language): Extension {
    switch (language) {
      case "typescript":
        return this.loadLang("@codemirror/lang-javascript", { typescript: true });
      case "javascript":
        return this.loadLang("@codemirror/lang-javascript", { typescript: false });
      case "json":
        return this.loadLang("@codemirror/lang-json");
      case "html":
        return this.loadLang("@codemirror/lang-html");
      case "css":
        return this.loadLang("@codemirror/lang-css");
      case "python":
        return this.loadLang("@codemirror/lang-python");
      case "rust":
        return this.loadLang("@codemirror/lang-rust");
      case "markdown":
        return this.loadLang("@codemirror/lang-markdown");
      case "sql":
        return this.loadLang("@codemirror/lang-sql");
      case "xml":
        return this.loadLang("@codemirror/lang-xml");
      default:
        return [];
    }
  }

  private loadLang(spec: string, options?: Record<string, unknown>): Extension {
    try {
      const mod = require(spec);
      const factory = mod[Object.keys(mod).find((k) => k !== "default") ?? "default"];
      return factory?.(options) ?? [];
    } catch (error) {
      logger.debug('LanguageDetector', `Failed to load language extension: ${spec}`, error);
      return [];
    }
  }
}
