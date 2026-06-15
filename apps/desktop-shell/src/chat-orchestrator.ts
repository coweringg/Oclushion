import type { PackedRepositoryContext } from "./context.service";
import type { ModelRouter } from "./llm/model-router";
import type { LLMGenerateResponse } from "./llm/provider";
import type { PromptBuilder } from "./prompt-builder";
import type { RepoScanResult } from "./repo-scanner";
import type { Skillpack } from "./types/skillpack";
import type { SanoShield, SanoShieldTokenMapping } from "./sano-shield.service";
import { toRecentHistory, type HistoryMessage } from "./chat/message-history";
import { sanitizeModelPayload, extractSanitizedUserMessage } from "./chat/payload-sanitizer";

export type ChatOrchestratorInput = {
  userMessage: string;
  model: string;
  skillpack: Skillpack;
  repo: RepoScanResult;
  repositoryContext: PackedRepositoryContext;
  promptBuilder: PromptBuilder;
  modelRouter: Pick<ModelRouter, "generate" | "stream">;
  sanoShield: SanoShield;
  privacyEnabled: boolean;
  externalContext?: string;
  marketplaceSkillsContext?: string;
  historyMessages?: Array<{ role: "user" | "assistant" | "system" | "tool"; content: string }>;
  studentMode?: boolean; // Idea 5: Oclushion Learn Toggle
};

export type ChatOrchestratorResult = {
  systemPrompt: string;
  outboundSystemPrompt: string;
  outboundUserMessage: string;
  response: LLMGenerateResponse;
  restoredContent: string;
  mappings: SanoShieldTokenMapping[];
};

export async function runOclushionChatTurn(
  input: ChatOrchestratorInput,
): Promise<ChatOrchestratorResult> {
  const baseSystemPrompt = input.promptBuilder.buildSystemPrompt(input.skillpack, {
    repo: input.repo,
    repositoryContext: input.repositoryContext,
    marketplaceSkillsContext: input.marketplaceSkillsContext,
    userTask: `${input.externalContext ? `${input.externalContext}\n\n` : ""}${input.userMessage}`,
    studentMode: input.studentMode,
  });
  const systemPrompt = `${baseSystemPrompt}\n\n<available_tools>\n  <tool name="spawn_new_chat">\n    Use this only when a sub-task should continue in a separate visible thread.\n    Emit exactly: <tool_call name="spawn_new_chat"><title>Short title</title><context>Relevant context for the delegated agent</context></tool_call>\n  </tool>\n</available_tools>`;
  const mergedOutbound = `${systemPrompt}\n\n${input.externalContext ?? ""}\n\n<user_message>${input.userMessage}</user_message>`;
  const history = toRecentHistory(input.historyMessages);
  
  const isLocalModel = /^(local|ollama)\//iu.test(input.model);
  const effectivePrivacyEnabled = isLocalModel ? false : input.privacyEnabled;

  const shielded = effectivePrivacyEnabled
    ? sanitizeModelPayload(input.sanoShield, { systemPrompt: mergedOutbound, messages: history })
    : { systemPrompt: mergedOutbound, messages: history, mappings: [] };
  const outboundUserMessage = effectivePrivacyEnabled
    ? extractSanitizedUserMessage(shielded.systemPrompt) ?? input.userMessage
    : input.userMessage;

  const messages: HistoryMessage[] = [
    ...shielded.messages,
    { role: "user", content: outboundUserMessage },
  ];

  const startedAt = performance.now();
  let content = "";
  for await (const chunk of input.modelRouter.stream({
    model: input.model,
    systemPrompt: shielded.systemPrompt,
    userMessage: outboundUserMessage,
    messages,
  })) {
    content += chunk.delta;
  }
  const latencyMs = Math.round(performance.now() - startedAt);

  const response = { provider: input.model, model: input.model, content, latencyMs };

  const restoredContent = effectivePrivacyEnabled
    ? input.sanoShield.restore(response.content, shielded.mappings)
    : response.content;

  return {
    systemPrompt,
    outboundSystemPrompt: shielded.systemPrompt,
    outboundUserMessage,
    response,
    restoredContent,
    mappings: shielded.mappings,
  };
}
