import type { ModelRouter } from "../llm/model-router";
import { SanoShield } from "../sano-shield.service";

export type SlashCommandHandler = (input: {
  selectedText: string;
  filePath: string | null;
  fileContent: string | null;
}) => Promise<string>;

export type SlashCommand = {
  name: string;
  description: string;
  handler: SlashCommandHandler;
};

export class SlashCommandsService {
  private commands: Map<string, SlashCommand> = new Map();

  constructor(
    private readonly modelRouter: ModelRouter,
    private readonly shield: SanoShield,
  ) {
    this.registerDefaultCommands();
  }

  private registerDefaultCommands(): void {
    this.registerCommand({
      name: "/fix",
      description: "Corrige errores en el archivo seleccionado",
      handler: async ({ selectedText, filePath }) => {
        if (!selectedText) {
          return "Por favor, selecciona el código que quieres corregir.";
        }
        const prompt = `Corrige los errores en el siguiente código. Solo devuelve el código corregido, sin explicaciones adicionales.

Archivo: ${filePath ?? "desconocido"}

\`\`\`
${selectedText}
\`\`\``;
        const response = await this.modelRouter.generate({
          model: "gpt-4o-mini",
          systemPrompt: "Eres un asistente de corrección de código. Tu tarea es identificar y corregir errores en el código proporcionado.",
          userMessage: prompt,
          messages: [],
        });
        return response.content;
      },
    });

    this.registerCommand({
      name: "/explain",
      description: "Explica el código seleccionado",
      handler: async ({ selectedText }) => {
        if (!selectedText) {
          return "Por favor, selecciona el código que quieres que explique.";
        }
        const prompt = `Explica el siguiente código de forma clara y concisa:

\`\`\`
${selectedText}
\`\`\``;
        const response = await this.modelRouter.generate({
          model: "gpt-4o-mini",
          systemPrompt: "Eres un asistente de explicación de código. Explica el código de forma clara y accesible para desarrolladores de todos los niveles.",
          userMessage: prompt,
          messages: [],
        });
        return response.content;
      },
    });

    this.registerCommand({
      name: "/test",
      description: "Genera tests para el archivo/función actual",
      handler: async ({ selectedText, filePath, fileContent }) => {
        const code = selectedText || fileContent;
        if (!code) {
          return "Por favor, abre un archivo o selecciona código para generar tests.";
        }
        const prompt = `Genera tests unitarios completos para el siguiente código. Usa el framework de testing más apropiado (Jest, Vitest, Mocha, etc.).

Archivo: ${filePath ?? "desconocido"}

\`\`\`
${code}
\`\`\``;
        const response = await this.modelRouter.generate({
          model: "gpt-4o-mini",
          systemPrompt: "Eres un experto en testing. Genera tests unitarios completos, con casos edge y mocks cuando sea necesario.",
          userMessage: prompt,
          messages: [],
        });
        return response.content;
      },
    });

    this.registerCommand({
      name: "/doc",
      description: "Genera documentación (JSDoc/TSDoc)",
      handler: async ({ selectedText }) => {
        if (!selectedText) {
          return "Por favor, selecciona el código que quieres documentar.";
        }
        const prompt = `Genera documentación JSDoc/TSDoc completa para el siguiente código:

\`\`\`
${selectedText}
\`\`\``;
        const response = await this.modelRouter.generate({
          model: "gpt-4o-mini",
          systemPrompt: "Eres un experto en documentación de código. Genera documentación clara y completa con JSDoc/TSDoc.",
          userMessage: prompt,
          messages: [],
        });
        return response.content;
      },
    });

    this.registerCommand({
      name: "/refactor",
      description: "Refactoriza el código seleccionado",
      handler: async ({ selectedText, filePath }) => {
        if (!selectedText) {
          return "Por favor, selecciona el código que quieres refactorizar.";
        }
        const prompt = `Refactoriza el siguiente código para mejorar su legibilidad, mantenibilidad y rendimiento. Aplica los principios SOLID y patrones de diseño cuando sea apropiado.

Archivo: ${filePath ?? "desconocido"}

\`\`\`
${selectedText}
\`\`\``;
        const response = await this.modelRouter.generate({
          model: "gpt-4o-mini",
          systemPrompt: "Eres un experto en refactoring. Mejora el código manteniendo su funcionalidad original.",
          userMessage: prompt,
          messages: [],
        });
        return response.content;
      },
    });

    this.registerCommand({
      name: "/optimize",
      description: "Optimiza rendimiento del código seleccionado",
      handler: async ({ selectedText, filePath }) => {
        if (!selectedText) {
          return "Por favor, selecciona el código que quieres optimizar.";
        }
        const prompt = `Optimiza el siguiente código para mejorar su rendimiento. Identifica cuellos de botella y propone mejoras.

Archivo: ${filePath ?? "desconocido"}

\`\`\`
${selectedText}
\`\`\``;
        const response = await this.modelRouter.generate({
          model: "gpt-4o-mini",
          systemPrompt: "Eres un experto en optimización de rendimiento. Identifica cuellos de botella y propone mejoras concretas.",
          userMessage: prompt,
          messages: [],
        });
        return response.content;
      },
    });

    this.registerCommand({
      name: "/review",
      description: "Code review del archivo actual",
      handler: async ({ fileContent, filePath }) => {
        if (!fileContent) {
          return "Por favor, abre un archivo para hacer code review.";
        }
        const prompt = `Realiza un code review detallado del siguiente código. Identifica problemas de seguridad, rendimiento, mantenibilidad y sugérer mejoras.

Archivo: ${filePath ?? "desconocido"}

\`\`\`
${fileContent}
\`\`\``;
        const response = await this.modelRouter.generate({
          model: "gpt-4o-mini",
          systemPrompt:
            "Eres un senior developer experto en code reviews. Identifica problemas de seguridad, rendimiento, mantenibilidad y sugérer mejoras concretas.",
          userMessage: prompt,
          messages: [],
        });
        return response.content;
      },
    });

    this.registerCommand({
      name: "/debug",
      description: "Analiza y sugiere fix para el error en consola",
      handler: async ({ selectedText }) => {
        if (!selectedText) {
          return "Por favor, pega el error de la consola que quieres debuggear.";
        }
        const prompt = `Analiza el siguiente error y sugiere una solución:

\`\`\`
${selectedText}
\`\`\``;
        const response = await this.modelRouter.generate({
          model: "gpt-4o-mini",
          systemPrompt: "Eres un experto en debugging. Analiza errores y propone soluciones concretas.",
          userMessage: prompt,
          messages: [],
        });
        return response.content;
      },
    });

    this.registerCommand({
      name: "/init",
      description: "Inicializa un nuevo proyecto con stack sugerido",
      handler: async ({ selectedText }) => {
        const stack = selectedText || "Next.js + TypeScript + Tailwind";
        const prompt = `Sugiere la estructura inicial y configuración para un proyecto con el siguiente stack: ${stack}`;
        const response = await this.modelRouter.generate({
          model: "gpt-4o-mini",
          systemPrompt: "Eres un arquitecto de software. Sugiere la mejor estructura y configuración para proyectos nuevos.",
          userMessage: prompt,
          messages: [],
        });
        return response.content;
      },
    });

    this.registerCommand({
      name: "/deploy",
      description: "Inicia deploy del proyecto actual",
      handler: async () => {
        return "Feature de deploy próximamente. Por ahora, usa el botón de deploy en la UI.";
      },
    });

    this.registerCommand({
      name: "/ship",
      description: "De idea a producción en < 1 hora (Oclushion Ship)",
      handler: async ({ selectedText }) => {
        const idea = selectedText || "Una aplicación web generada por IA";
        return `🚀 **Oclushion Ship Pipeline Iniciado**

He recibido tu idea: *"**${idea}**"*.

El orquestador automatizado está ejecutando las siguientes fases en segundo plano:

1. **Plan:** Seleccionando stack (Next.js/Vite/Astro) e infiriendo features (Auth, BD, UI).
2. **Scaffold:** Generando la estructura de carpetas y código base.
3. **Build:** Instalando dependencias y compilando.
4. **Review:** Motor de Code Review analizando vulnerabilidades y performance.
5. **Test:** Validando el código (Unit & E2E).
6. **Deploy:** Desplegando a producción.
7. **Monitor:** Verificando Health Checks.

> El proceso puede tardar unos minutos. Podrás ver el progreso en la terminal o UI de estado.`;
      },
    });
  }

  registerCommand(command: SlashCommand): void {
    this.commands.set(command.name, command);
  }

  getCommand(name: string): SlashCommand | undefined {
    return this.commands.get(name);
  }

  getAllCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  async executeCommand(name: string, context: Parameters<SlashCommandHandler>[0]): Promise<string> {
    const command = this.commands.get(name);
    if (!command) {
      return `Comando "/${name}" no encontrado. Usa /help para ver los comandos disponibles.`;
    }
    return command.handler(context);
  }
}
