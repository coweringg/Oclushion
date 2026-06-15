import { logger } from "../utils/logger";
import type { AgentOrchestrator } from "./agent-orchestrator";
import type { KanbanService } from "../kanban/kanban.service";
import type { ModelRouter } from "../llm/model-router";

export type IntentType = "CODE_EDIT" | "COMMAND" | "CREATE_TASK" | "CHAT" | "UNKNOWN";

export interface IntentDecision {
  intent: IntentType;
  actionPayload: string;
  confidence: number;
}

export class IntentRouter {
  public constructor(
    private readonly orchestrator: AgentOrchestrator,
    private readonly kanban: KanbanService,
    private readonly modelRouter: ModelRouter
  ) {}

  public async route(voiceText: string): Promise<IntentDecision> {
    try {
      const decision = await this.classifyWithLLM(voiceText);
      await this.executeIntent(decision);
      return decision;
    } catch (error) {
      logger.error("IntentRouter", "Failed to route intent", error);
      return { intent: "UNKNOWN", actionPayload: voiceText, confidence: 0 };
    }
  }

  private async classifyWithLLM(text: string): Promise<IntentDecision> {
    const prompt = `
You are the Oclushion Intent Router. Classify the user's voice dictation into one of the following intents:
1. CODE_EDIT: The user wants to modify code, create a file, or fix a bug.
2. COMMAND: The user wants to execute an IDE command (e.g., "abre la terminal", "cierra la pestaña").
3. CREATE_TASK: The user wants to add a reminder or task to the Kanban board.
4. CHAT: The user is asking a general question or wants to talk.

Respond in pure JSON format:
{
  "intent": "CODE_EDIT|COMMAND|CREATE_TASK|CHAT",
  "actionPayload": "The extracted actionable text",
  "confidence": 0.0-1.0
}

User Dictation: "${text}"
`;

    try {
      const response = await this.modelRouter.routeFastest({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });

      const jsonStr = response.content.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      
      return {
        intent: parsed.intent as IntentType,
        actionPayload: parsed.actionPayload || text,
        confidence: parsed.confidence || 1.0,
      };
    } catch (err) {
      logger.warn("IntentRouter", "LLM classification failed, falling back to heuristics", err);
      return this.heuristicClassification(text);
    }
  }

  private heuristicClassification(text: string): IntentDecision {
    const lower = text.toLowerCase();
    if (lower.includes("tarea") || lower.includes("recordatorio") || lower.includes("kanban")) {
      return { intent: "CREATE_TASK", actionPayload: text, confidence: 0.6 };
    }
    if (lower.includes("crea un archivo") || lower.includes("refactoriza") || lower.includes("código")) {
      return { intent: "CODE_EDIT", actionPayload: text, confidence: 0.7 };
    }
    if (lower.includes("abre") || lower.includes("cierra") || lower.includes("tema")) {
      return { intent: "COMMAND", actionPayload: text, confidence: 0.5 };
    }
    return { intent: "CHAT", actionPayload: text, confidence: 0.5 };
  }

  private async executeIntent(decision: IntentDecision): Promise<void> {
    switch (decision.intent) {
      case "CODE_EDIT":
        this.orchestrator.spawnAgent({
          type: "coding",
          prompt: decision.actionPayload,
          priority: "high"
        });
        break;
      case "CREATE_TASK":
        await this.kanban.createTask({
          title: decision.actionPayload.slice(0, 50),
          description: decision.actionPayload,
          columnId: "todo",
          tags: ["voice-generated"]
        });
        break;
      case "COMMAND":
        document.dispatchEvent(new CustomEvent("ocl-command-intent", { detail: decision.actionPayload }));
        break;
      case "CHAT":
        document.dispatchEvent(new CustomEvent("ocl-chat-intent", { detail: decision.actionPayload }));
        break;
    }
  }
}
