export type SupportedAiSite = {
  id: "chatgpt" | "claude" | "gemini" | "copilot";
  hostPattern: RegExp;
  promptSelectors: string[];
};

export const supportedAiSites: SupportedAiSite[] = [
  {
    id: "chatgpt",
    hostPattern: /(^|\.)chatgpt\.com$/iu,
    promptSelectors: ["#prompt-textarea", "textarea", "[contenteditable='true']"],
  },
  {
    id: "claude",
    hostPattern: /(^|\.)claude\.ai$/iu,
    promptSelectors: ["div[contenteditable='true']", "textarea"],
  },
  {
    id: "gemini",
    hostPattern: /^gemini\.google\.com$/iu,
    promptSelectors: ["rich-textarea div[contenteditable='true']", "textarea"],
  },
  {
    id: "copilot",
    hostPattern: /^copilot\.microsoft\.com$/iu,
    promptSelectors: ["textarea", "[contenteditable='true']"],
  },
];

export function matchSupportedSite(host: string) {
  return supportedAiSites.find((site) => site.hostPattern.test(host));
}

export function findPromptElement(root: ParentNode, host: string): HTMLElement | null {
  const site = matchSupportedSite(host);
  if (!site) {
    return null;
  }
  for (const selector of site.promptSelectors) {
    const element = root.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }
  return null;
}
