import type { TourConfig } from "./tour.types.js";

export const mainAppTour: TourConfig = {
  id: "main-app-tour",
  name: "Oclushion Introduction",
  allowSkip: true,
  allowRestart: true,
  autoStart: true,
  steps: [
    {
      id: "welcome",
      target: "body",
      title: "Welcome to Oclushion",
      content: "The AI-native IDE that understands your codebase. This brief tour will show you the main features.",
      placement: "center",
    },
    {
      id: "chat-sidebar",
      target: '[data-testid="chat-sidebar-root"]',
      title: "AI Chat",
      content: "Ask the AI anything about your code. Use the sidebar to see conversation history and manage contexts.",
      placement: "right",
      onShow: (el) => {
        el?.classList?.add("tour-highlight");
      },
    },
    {
      id: "editor",
      target: '[data-testid="central-shell"]',
      title: "Smart Editor",
      content: "Code with AI assistance. Inline completions, smart diffs, and real-time suggestions powered by your chosen model.",
      placement: "bottom",
    },
    {
      id: "terminal",
      target: '[data-testid="terminal-panel-root"]',
      title: "Integrated Terminal",
      content: "Run commands safely. Commands are validated by the SecureExecutor before execution.",
      placement: "top",
    },
    {
      id: "marketplace",
      target: '[data-testid="marketplace-button"]',
      title: "Skill Marketplace",
      content: "Browse and install skills. Skills are curated prompt packs that extend Oclushion's capabilities.",
      placement: "left",
    },
    {
      id: "git",
      target: '[data-testid="repo-card"]',
      title: "Git Integration",
      content: "See changes at a glance. Oclushion highlights modified files and shows diff previews.",
      placement: "right",
    },
    {
      id: "agent",
      target: '[data-testid="active-agents"]',
      title: "AI Agents",
      content: "Let agents work for you. Configure automated tasks like code review, dependency updates, or documentation generation.",
      placement: "left",
    },
    {
      id: "settings",
      target: '[data-testid="settings-button"]',
      title: "Settings",
      content: "Configure your AI models, shortcuts, and security policies. Customize Oclushion to your workflow.",
      placement: "bottom",
    },
  ],
};

export const chatPanelTour: TourConfig = {
  id: "chat-panel-tour",
  name: "Chat Deep Dive",
  allowSkip: true,
  allowRestart: true,
  autoStart: false,
  steps: [
    {
      id: "chat-input",
      target: '[data-testid="chat-input"]',
      title: "Ask Anything",
      content: "Type your questions in natural language. The AI understands your codebase context.",
      placement: "top",
    },
    {
      id: "chat-context",
      target: '[data-testid="context-attachments"]',
      title: "Context Attachments",
      content: "Attach files, functions, or entire directories to give the AI more context.",
      placement: "bottom",
    },
    {
      id: "chat-history",
      target: '[data-testid="chat-history"]',
      title: "Conversation History",
      content: "Previous conversations are saved. You can search, rename, or export them.",
      placement: "right",
    },
  ],
};
