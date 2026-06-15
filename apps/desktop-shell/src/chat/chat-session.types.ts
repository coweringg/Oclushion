export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  model?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ChatSessionWithMessages = ChatSession & {
  messages: ChatMessage[];
};

export type GroupedSessions = {
  today: ChatSession[];
  yesterday: ChatSession[];
  thisWeek: ChatSession[];
  older: ChatSession[];
};
