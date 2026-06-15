export type DemoMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export type DemoTerminalLine = {
  id: string;
  text: string;
  type: "input" | "output" | "info" | "error";
};

export const DEMO_LIMIT_KEY = "ocl_demo_prompts";
export const DEMO_MAX_PROMPTS = 10;
export const DEMO_SAMPLE_CODE = `import { defineConfig } from 'oclushion';

export default defineConfig({
  project: {
    name: 'my-app',
    stack: 'nextjs',
  },
  agents: [
    {
      role: 'architect',
      model: 'claude-sonnet-4',
      systemPrompt: 'You are a senior architect...',
    },
  ],
  security: {
    piiMasking: true,
    allowedCommands: ['npm', 'git', 'pnpm'],
  },
});
`;

export const DEMO_TERMINAL_LINES: DemoTerminalLine[] = [
  { id: "t1", text: "$ oclushion init my-app --stack nextjs", type: "input" },
  { id: "t2", text: "  ✓ Project created", type: "output" },
  { id: "t3", text: "  ✓ Next.js 16 configured", type: "output" },
  { id: "t4", text: "  ✓ SanoShield proxy connected", type: "output" },
  { id: "t5", text: "  ✓ Agent pipeline initialized", type: "output" },
  { id: "t6", text: "Ready! Run 'oclushion dev' to start.", type: "info" },
];
