import type { ModelRouter } from "../llm/model-router";
import { logger } from "../utils/logger";
import { z } from "zod";

export interface TerminalSuggestion {
  command: string;
  label: string;
  description: string;
  confidence: number;
}

const COMMON_TASKS: Record<string, TerminalSuggestion[]> = {
  "": [
    { command: "git status", label: "Git Status", description: "Show working tree status", confidence: 0.9 },
    { command: "git log --oneline -10", label: "Git Log", description: "Show recent commits", confidence: 0.9 },
    { command: "npm test", label: "Run Tests", description: "Run project test suite", confidence: 0.8 },
    { command: "npm run build", label: "Build", description: "Build the project", confidence: 0.8 },
    { command: "npm run dev", label: "Dev Server", description: "Start development server", confidence: 0.8 },
  ],
};

export class TerminalSuggestionsService {
  private modelRouter: ModelRouter | null = null;

  constructor(modelRouter?: ModelRouter) {
    if (modelRouter) {
      this.modelRouter = modelRouter;
    }
  }

  setModelRouter(router: ModelRouter): void {
    this.modelRouter = router;
  }

  async getSuggestions(currentInput: string, cwd: string): Promise<TerminalSuggestion[]> {
    const trimmed = currentInput.trim().toLowerCase();
    if (!trimmed) {
      return COMMON_TASKS[""] ?? [];
    }

    const allTasks: TerminalSuggestion[] = Object.values(COMMON_TASKS).flat().filter((s): s is TerminalSuggestion => s !== undefined);
    const staticMatches = allTasks.filter((s) =>
      s.command.toLowerCase().includes(trimmed) || s.label.toLowerCase().includes(trimmed),
    );
    if (staticMatches.length > 0) {
      return staticMatches.slice(0, 4);
    }

    if (!this.modelRouter) return [];
    try {
      const response = await this.modelRouter.generate({
        model: "gpt-5.4-mini",
        systemPrompt: "You are a terminal command suggestion assistant. Return ONLY valid JSON arrays.",
        userMessage: `Current input: "${currentInput}".\nSuggest 2-3 terminal commands as JSON: [{"command":"...","label":"...","description":"..."}]`,
      });
      const text = response?.content ?? "[]";
      const jsonStart = text.indexOf("[");
      const jsonEnd = text.lastIndexOf("]");
      const parsedZod = z.array(
        z.object({ command: z.string(), label: z.string().optional(), description: z.string().optional() })
      ).safeParse(JSON.parse(text.slice(jsonStart, jsonEnd + 1)));
      if (!parsedZod.success) return [];
      return parsedZod.data.map((s) => ({
        command: s.command,
        label: s.label ?? s.command,
        description: s.description ?? "",
        confidence: 0.5,
      }));
    } catch (err) {
      logger.debug("TerminalSuggestions", "AI suggestion failed:", err);
      return [];
    }
  }
}
