export type SafeDiffProposalKind = "code" | "command";

export type DiffChunk = {
  id: string;
  oldContent: string;
  newContent: string;
  status: "pending" | "approved" | "rejected";
};

export type SafeDiffProposal = {
  id: string;
  kind: SafeDiffProposalKind;
  language: string;
  targetFile?: string;
  content: string;
  chunks: DiffChunk[];
  title: string;
  status: "pending" | "approved" | "rejected" | "explained" | "queued";
};

export type ParsedAssistantResponse = {
  conversationText: string;
  proposals: SafeDiffProposal[];
};

const fencedBlockPattern = /```([^\n`]*)\n([\s\S]*?)```/g;
const commandLanguages = new Set(["bash", "sh", "shell", "zsh", "powershell", "ps1", "cmd"]);

export function parseAssistantResponseForProposals(response: string): ParsedAssistantResponse {
  const proposals: SafeDiffProposal[] = [];
  let conversationText = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fencedBlockPattern.exec(response)) !== null) {
    conversationText += response.slice(cursor, match.index);
    cursor = match.index + match[0].length;

    const language = normalizeLanguage(match[1]);
    const content = (match[2] ?? "").trim();
    if (!content) {
      continue;
    }

    const kind: SafeDiffProposalKind = isCommandLanguage(language) ? "command" : "code";
    
    let targetFile = "unknown";
    const fileMatch = content.match(/^(\/\/\s*|\#\s*)([a-zA-Z0-9_\-\.\/]+\.[a-z]+)/);
    if (fileMatch && fileMatch[2]) {
      targetFile = fileMatch[2];
    }

    proposals.push({
      id: `proposal-${proposals.length + 1}`,
      kind,
      language,
      targetFile,
      content,
      chunks: [{
        id: `chunk-${proposals.length + 1}-1`,
        oldContent: "", // Simplification for parser. Real logic would diff original file.
        newContent: content,
        status: "pending"
      }],
      title: kind === "command" ? "Command in quarantine" : `Code proposal${language ? ` (${language})` : ""}`,
      status: "pending",
    });
  }

  conversationText += response.slice(cursor);

  return {
    conversationText: normalizeConversationText(conversationText),
    proposals,
  };
}

function normalizeLanguage(language: string | undefined): string {
  return (language ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function isCommandLanguage(language: string): boolean {
  return commandLanguages.has(language);
}

function normalizeConversationText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
