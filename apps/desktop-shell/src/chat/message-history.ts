import { z } from "zod";

const rawMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

export const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export type HistoryMessage = z.infer<typeof historyMessageSchema>;

export function toRecentHistory(
  historyMessages: Array<{ role: string; content: string }> | undefined,
): HistoryMessage[] {
  return (historyMessages ?? [])
    .slice(-12)
    .map((message) => {
      const parsed = rawMessageSchema.parse(message);
      return {
        role: parsed.role === "tool" ? "assistant" : parsed.role,
        content: parsed.content,
      } as HistoryMessage;
    })
    .filter((m): m is HistoryMessage => historyMessageSchema.safeParse(m).success);
}
