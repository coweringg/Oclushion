import { z } from "zod";

export const openaiChatResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable().optional() }).optional(),
    delta: z.object({ content: z.string().nullable().optional() }).optional(),
    finish_reason: z.string().nullable().optional(),
  })).optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});

export const anthropicResponseSchema = z.object({
  content: z.array(z.object({
    type: z.string(),
    text: z.string().optional(),
  })).optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});

export const ollamaGenerateResponseSchema = z.object({
  response: z.string().optional(),
  error: z.string().optional(),
  done: z.boolean().optional(),
});

export const anthropicStreamEventSchema = z.object({
  type: z.string(),
  delta: z.object({
    type: z.string().optional(),
    text: z.string().optional(),
    stop_reason: z.string().optional(),
  }).optional(),
});
