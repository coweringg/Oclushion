import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const locales = ["en", "es", "fr", "zh", "pt", "de", "ja", "ko"];

function flatten(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flatten(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

const keysets = new Map();
for (const locale of locales) {
  const json = JSON.parse(readFileSync(join(root, "src", "i18n", "locales", `${locale}.json`), "utf8"));
  keysets.set(locale, new Set(flatten(json).filter(Boolean)));
}

const reference = keysets.get("en");
let failed = false;
for (const locale of locales.slice(1)) {
  const keys = keysets.get(locale);
  const missing = [...reference].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !reference.has(key));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`[i18n] ${locale}.json does not match en.json`);
    if (missing.length) console.error(`Missing: ${missing.join(", ")}`);
    if (extra.length) console.error(`Extra: ${extra.join(", ")}`);
  }
}

if (failed) {
  process.exit(1);
}

const mainSource = readFileSync(join(root, "src", "main.ts"), "utf8");
const forbiddenVisibleStrings = [
  "Catalog unavailable",
  "Connect a valid Oclushion Marketplace CDN endpoint to load production entries.",
  "First workspace",
  "Choose your Oclushion profile",
  "Install profile",
  "Suggested Skill",
  "Install & continue",
  "Continue without skill",
  "Write a task or chat prompt before running agents.",
  "Local model settings saved.",
  "Sign in before buying Oclushion credits.",
  "Daily spend cap saved.",
  "Oclushion desktop IDE shell",
  "Workspaces and profiles",
  "Manage skillpacks",
  "AI Workspace",
  "Multi-Chat",
  "Multi-Agent",
  "+ New Chat",
  "Active Agents",
  "Usage & Cost",
  "Manage Limits & Alerts",
  "Fast Apply",
  "Apply agent changes with review.",
  "Review & Apply (2)",
  "Activity",
  "View all",
  "Model selector",
  "Send",
  "Toggle integrated terminal",
  "Crear cuenta en Oclushion",
  "Iniciar sesion en Oclushion",
  "Crea tu cuenta en Oclushion",
  "Inicia sesion en Oclushion",
  "Nombre",
  "Correo electronico",
  "Contrasena",
  "Confirmar contrasena",
  "Recordarme en este dispositivo",
  "Olvidaste tu contrasena?",
  "Conectando...",
  "Crear cuenta",
  "Iniciar sesion",
  "Free forever. No credit card required.",
  "Ya tienes cuenta?",
  "No tienes cuenta?",
  "Hoy",
  "Ayer",
  "Esta semana",
  "Anterior",
  "Delete chat",
  "Agent Worklog",
  "No agent worklog events yet.",
  "Close notification",
  "Agent task completed in",
  "Oclushion - Task Complete",
  "SANO SHIELD",
  "Sensitive data protection is",
  "Local-first - Encrypted - Private",
];

const leaked = forbiddenVisibleStrings.filter((phrase) => mainSource.includes(phrase));
if (leaked.length) {
  console.error("[i18n] main.ts contains visible hardcoded strings that must use t(...):");
  for (const phrase of leaked) {
    console.error(`- ${phrase}`);
  }
  process.exit(1);
}
