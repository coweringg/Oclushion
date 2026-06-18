import type { DeployConfig, DeployState } from "./shipper.types";
import type { TestRunSummary } from "../test-runner/test-runner.service";

export type ShipStage =
  | "idle"
  | "planning"
  | "scaffolding"
  | "building"
  | "reviewing"
  | "testing"
  | "deploying"
  | "monitoring"
  | "completed"
  | "failed";

export type StackTemplate =
  | "nextjs-tailwind-prisma"
  | "nextjs-tailwind-supabase"
  | "vite-react-tailwind"
  | "astro-tailwind"
  | "custom";

export type ScaffoldConfig = {
  template: StackTemplate;
  projectName: string;
  features: ScaffoldFeature[];
  database?: "postgresql" | "sqlite" | "mysql" | "supabase";
  auth?: "next-auth" | "clerk" | "supabase-auth" | "none";
  styling?: "tailwind" | "css-modules" | "vanilla-css";
};

export type ScaffoldFeature =
  | "auth"
  | "database"
  | "api-routes"
  | "landing-page"
  | "dashboard"
  | "dark-mode"
  | "i18n"
  | "seo"
  | "pwa"
  | "analytics";

export type ReviewSeverity = "critical" | "warning" | "suggestion";

export type ReviewFinding = {
  file: string;
  line: number;
  severity: ReviewSeverity;
  message: string;
  fix?: string;
};

export type ReviewResult = {
  passed: boolean;
  score: number;
  findings: ReviewFinding[];
  autoFixedCount: number;
  timestamp: string;
};

export type ShipPipelineState = {
  id: string;
  stage: ShipStage;
  idea: string;
  workspacePath: string;
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;

  plan?: ShipPlan;
  scaffold?: ScaffoldResult;
  review?: ReviewResult;
  testResults?: TestRunSummary;
  deployment?: DeployState;
  healthCheck?: { success: boolean; url: string; latencyMs: number };

  logs: ShipLogEntry[];
};

export type ShipLogEntry = {
  stage: ShipStage;
  message: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
};

export type ShipPlan = {
  projectName: string;
  description: string;
  stack: StackTemplate;
  features: ScaffoldFeature[];
  architecture: string;
  components: string[];
  apiRoutes: string[];
  databaseTables: string[];
  estimatedMinutes: number;
};

export type ScaffoldResult = {
  template: StackTemplate;
  filesCreated: string[];
  dependenciesInstalled: boolean;
  durationMs: number;
};

export type ShipPipelineInput = {
  idea: string;
  workspacePath: string;
  deployConfig?: DeployConfig;
  skipTests?: boolean;
  skipReview?: boolean;
  skipDeploy?: boolean;
  onProgress?: (state: ShipPipelineState) => void;
};
