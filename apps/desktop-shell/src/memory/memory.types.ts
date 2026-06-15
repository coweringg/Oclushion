export type MemoryType = "fact" | "decision" | "convention" | "command" | "architecture" | "lesson";
export type MemorySource = "user" | "agent" | "auto-detected";

export type MemoryEntry = {
  id: string;
  type: MemoryType;
  content: string;
  tags: string[];
  source: MemorySource;
  confidence: number;
  createdAt: string;
  lastUsedAt: string;
  usageCount: number;
  embedding?: Float64Array;
};
