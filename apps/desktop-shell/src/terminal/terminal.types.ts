export type TerminalOwner = "user" | "agent";

export type TerminalSession = {
  id: string;
  owner: TerminalOwner;
  pid?: number;
  title: string;
  cwd: string;
  isAlive: boolean;
  scrollback: string[];
  createdAt: string;
};

export type TerminalDataEvent = {
  sessionId: string;
  data: string;
};

export type TerminalExitEvent = {
  sessionId: string;
  code: number | null;
};
