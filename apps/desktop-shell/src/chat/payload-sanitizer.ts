import { z } from "zod";
import { SanoShield, type SanoShieldTokenMapping } from "../sano-shield.service";
import { logger } from "../utils/logger";
import type { HistoryMessage } from "./message-history";

const payloadShapeSchema = z.object({
  systemPrompt: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
});

const messageShapeSchema = z.object({
  role: z.unknown().optional(),
  content: z.unknown().optional(),
});

export function sanitizeModelPayload(
  shield: SanoShield,
  payload: {
    systemPrompt: string;
    messages: HistoryMessage[];
  },
): {
  systemPrompt: string;
  messages: HistoryMessage[];
  mappings: SanoShieldTokenMapping[];
} {
  const sanitized = shield.sanitize(JSON.stringify(payload));
  try {
    const raw = JSON.parse(sanitized.sanitizedText);
    const shape = payloadShapeSchema.parse(raw);
    const validatedMessages = (shape.messages ?? [])
      .map((m) => {
        const msg = messageShapeSchema.safeParse(m);
        if (!msg.success) return null;
        const role = msg.data.role;
        const content = msg.data.content;
        if (typeof content !== "string") return null;
        const normalizedRole = role === "user" || role === "assistant" || role === "system"
          ? role
          : "assistant";
        return { role: normalizedRole, content } as HistoryMessage;
      })
      .filter((m): m is HistoryMessage => m !== null && m.content.length > 0);
    return {
      systemPrompt: shape.systemPrompt ?? payload.systemPrompt,
      messages: validatedMessages.length > 0 ? validatedMessages : payload.messages,
      mappings: sanitized.mappings,
    };
  } catch (error) {
    logger.warn('PayloadSanitizer', 'Failed to parse sanitized payload', error);
    return { systemPrompt: payload.systemPrompt, messages: payload.messages, mappings: sanitized.mappings };
  }
}

export function extractSanitizedUserMessage(outboundPrompt: string): string | null {
  return outboundPrompt.match(/<user_message>([\s\S]*?)<\/user_message>/)?.[1] ?? null;
}
