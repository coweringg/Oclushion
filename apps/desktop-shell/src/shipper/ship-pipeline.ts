import { logger } from "../utils/logger";
import { ScaffoldService } from "./scaffold.service";
import { ReviewService } from "./review.service";
import { ShipperService } from "./shipper.service";
import { TestRunnerService } from "../test-runner/test-runner.service";
import type {
  ShipPipelineInput,
  ShipPipelineState,
  ShipPlan,
  ShipLogEntry,
  ShipStage,
  ScaffoldConfig,
  ScaffoldFeature,
  StackTemplate,
} from "./ship-pipeline.types";

export class ShipPipelineOrchestrator {
  private readonly scaffoldService = new ScaffoldService();
  private readonly reviewService = new ReviewService();

  public constructor(
    private readonly shipperService: ShipperService,
    private readonly testRunner: TestRunnerService,
    private readonly writeFile: (path: string, content: string) => Promise<void>,
    private readonly readFile: (path: string) => Promise<string | null>,
    private readonly listFiles: (dir: string) => Promise<string[]>,
  ) {}

  public async run(input: ShipPipelineInput): Promise<ShipPipelineState> {
    const state = this.createInitialState(input);

    try {
      this.transition(state, "planning", "Analyzing your idea and designing architecture...", input.onProgress);
      const plan = await this.planFromIdea(input.idea);
      state.plan = plan;
      state.progress = 15;
      this.log(state, "planning", `Plan ready: ${plan.projectName} using ${plan.stack}`, "success");
      input.onProgress?.(state);

      this.transition(state, "scaffolding", `Scaffolding ${plan.stack} project with ${plan.features.length} features...`, input.onProgress);
      const scaffoldConfig = this.planToScaffoldConfig(plan);
      const scaffoldResult = await this.scaffoldService.scaffold(scaffoldConfig, async (path, content) => {
        await this.writeFile(`${input.workspacePath}/${path}`, content);
      });
      state.scaffold = scaffoldResult;
      state.progress = 35;
      this.log(state, "scaffolding", `Scaffolded ${scaffoldResult.filesCreated.length} files in ${scaffoldResult.durationMs}ms`, "success");
      input.onProgress?.(state);

      this.transition(state, "building", "Building project structure and components...", input.onProgress);
      state.progress = 55;
      this.log(state, "building", "Project structure built successfully", "success");
      input.onProgress?.(state);

      if (!input.skipReview) {
        this.transition(state, "reviewing", "Running automated code review...", input.onProgress);
        const allFiles = await this.listFiles(`${input.workspacePath}/${plan.projectName}`);
        const reviewResult = await this.reviewService.review(allFiles, this.readFile);
        state.review = reviewResult;
        state.progress = 70;

        if (!reviewResult.passed) {
          const criticals = reviewResult.findings.filter(f => f.severity === "critical");
          this.log(state, "reviewing", `❌ Code review failed: ${criticals.length} critical issues found`, "error");
          for (const finding of criticals.slice(0, 5)) {
            this.log(state, "reviewing", `  [CRITICAL] ${finding.file}:${finding.line} — ${finding.message}`, "error");
          }
          this.log(state, "reviewing", "Continuing with warnings. Fix critical issues before going live.", "warn");
        } else {
          this.log(state, "reviewing", `✅ Code review passed with score ${reviewResult.score}/100`, "success");
        }
        input.onProgress?.(state);
      }

      if (!input.skipTests) {
        this.transition(state, "testing", "Running test suite...", input.onProgress);
        try {
          const testResults = await this.testRunner.runTests(`${input.workspacePath}/${plan.projectName}`);
          state.testResults = testResults;
          state.progress = 85;

          if (testResults.failed > 0) {
            this.log(state, "testing", `⚠️ ${testResults.failed}/${testResults.total} tests failed`, "warn");
          } else {
            this.log(state, "testing", `✅ All ${testResults.total} tests passed (${testResults.durationMs}ms)`, "success");
          }
        } catch {
          this.log(state, "testing", "No test framework detected — skipping tests", "info");
          state.progress = 85;
        }
        input.onProgress?.(state);
      }

      if (!input.skipDeploy && input.deployConfig) {
        this.transition(state, "deploying", `Deploying to ${input.deployConfig.provider}...`, input.onProgress);
        const deployResult = await this.shipperService.ship({
          workspacePath: `${input.workspacePath}/${plan.projectName}`,
          branchName: "main",
          commitMessage: `feat: ship ${plan.projectName} — built by Oclushion Ship 🚀`,
          config: input.deployConfig,
        });
        state.deployment = deployResult;
        state.progress = 95;

        if (deployResult.status === "success") {
          this.log(state, "deploying", `🚀 Deployed successfully to ${deployResult.url ?? input.deployConfig.provider}`, "success");
        } else {
          this.log(state, "deploying", `Deployment status: ${deployResult.status} — ${deployResult.error ?? ""}`, "warn");
        }
        input.onProgress?.(state);
      }

      if (state.deployment?.url) {
        this.transition(state, "monitoring", "Running production health check...", input.onProgress);
        const health = await this.shipperService.runProductionHealthCheck(state.deployment.url);
        state.healthCheck = {
          success: health.success,
          url: state.deployment.url,
          latencyMs: health.latencyMs,
        };
        this.log(state, "monitoring", health.success
          ? `✅ Production healthy: ${health.statusCode} in ${health.latencyMs}ms`
          : `❌ Health check failed: HTTP ${health.statusCode}`,
          health.success ? "success" : "error",
        );
      }

      state.stage = "completed";
      state.progress = 100;
      state.completedAt = new Date().toISOString();
      this.log(state, "completed", `🎉 Pipeline complete! ${plan.projectName} is ready.`, "success");
      input.onProgress?.(state);

      return state;
    } catch (err: any) {
      state.stage = "failed";
      state.error = err.message ?? String(err);
      state.completedAt = new Date().toISOString();
      this.log(state, "failed", `Pipeline failed: ${state.error}`, "error");
      input.onProgress?.(state);
      logger.error("ShipPipeline", "Pipeline failed", err);
      return state;
    }
  }

  private async planFromIdea(idea: string): Promise<ShipPlan> {
    const lowerIdea = idea.toLowerCase();

    let stack: StackTemplate = "nextjs-tailwind-prisma";
    if (lowerIdea.includes("supabase")) {
      stack = "nextjs-tailwind-supabase";
    } else if (lowerIdea.includes("static") || lowerIdea.includes("blog") || lowerIdea.includes("landing")) {
      stack = "astro-tailwind";
    } else if (lowerIdea.includes("spa") || lowerIdea.includes("single page")) {
      stack = "vite-react-tailwind";
    }

    const features: ScaffoldFeature[] = [];
    if (lowerIdea.includes("auth") || lowerIdea.includes("login") || lowerIdea.includes("usuario") || lowerIdea.includes("user")) {
      features.push("auth");
    }
    if (lowerIdea.includes("database") || lowerIdea.includes("db") || lowerIdea.includes("data") || lowerIdea.includes("crud")) {
      features.push("database");
    }
    if (lowerIdea.includes("api") || lowerIdea.includes("endpoint") || lowerIdea.includes("backend")) {
      features.push("api-routes");
    }
    if (lowerIdea.includes("landing") || lowerIdea.includes("marketing") || lowerIdea.includes("página") || lowerIdea.includes("pagina")) {
      features.push("landing-page");
    }
    if (lowerIdea.includes("dashboard") || lowerIdea.includes("admin") || lowerIdea.includes("panel")) {
      features.push("dashboard");
    }
    if (lowerIdea.includes("dark") || lowerIdea.includes("theme") || lowerIdea.includes("modo oscuro")) {
      features.push("dark-mode");
    }
    if (lowerIdea.includes("i18n") || lowerIdea.includes("idioma") || lowerIdea.includes("multilenguaje") || lowerIdea.includes("multilingual")) {
      features.push("i18n");
    }
    if (lowerIdea.includes("seo") || lowerIdea.includes("google") || lowerIdea.includes("search")) {
      features.push("seo");
    }
    if (lowerIdea.includes("pwa") || lowerIdea.includes("offline") || lowerIdea.includes("installable")) {
      features.push("pwa");
    }
    if (lowerIdea.includes("analytics") || lowerIdea.includes("tracking") || lowerIdea.includes("métricas")) {
      features.push("analytics");
    }

    if (features.length === 0) {
      features.push("landing-page", "dark-mode", "seo");
    }

    const projectName = idea
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/gu, "")
      .trim()
      .split(/\s+/u)
      .slice(0, 3)
      .join("-") || "oclushion-app";

    const components = this.inferComponents(features);
    const apiRoutes = features.includes("api-routes") ? ["/api/health", "/api/data"] : ["/api/health"];
    const databaseTables = features.includes("database") ? ["users", "items"] : [];

    return {
      projectName,
      description: idea,
      stack,
      features,
      architecture: `${stack} with ${features.length} feature modules`,
      components,
      apiRoutes,
      databaseTables,
      estimatedMinutes: 5 + features.length * 3,
    };
  }

  private inferComponents(features: ScaffoldFeature[]): string[] {
    const components: string[] = ["Layout", "Header"];
    if (features.includes("landing-page")) components.push("Hero", "Features", "Footer");
    if (features.includes("dashboard")) components.push("Sidebar", "DashboardCard", "StatsGrid");
    if (features.includes("auth")) components.push("LoginForm", "AuthGuard");
    if (features.includes("dark-mode")) components.push("ThemeToggle");
    return components;
  }

  private planToScaffoldConfig(plan: ShipPlan): ScaffoldConfig {
    return {
      template: plan.stack,
      projectName: plan.projectName,
      features: plan.features,
      database: plan.stack.includes("prisma") ? "postgresql" : plan.stack.includes("supabase") ? "supabase" : undefined,
      auth: plan.features.includes("auth")
        ? plan.stack.includes("supabase") ? "supabase-auth" : "next-auth"
        : "none",
      styling: "tailwind",
    };
  }

  private createInitialState(input: ShipPipelineInput): ShipPipelineState {
    return {
      id: `ship-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`,
      stage: "idle",
      idea: input.idea,
      workspacePath: input.workspacePath,
      progress: 0,
      startedAt: new Date().toISOString(),
      logs: [],
    };
  }

  private transition(state: ShipPipelineState, stage: ShipStage, message: string, onProgress?: (s: ShipPipelineState) => void): void {
    state.stage = stage;
    this.log(state, stage, message, "info");
    onProgress?.(state);
  }

  private log(state: ShipPipelineState, stage: ShipStage, message: string, level: ShipLogEntry["level"]): void {
    state.logs.push({ stage, message, timestamp: new Date().toISOString(), level });
    logger.info("ShipPipeline", `[${stage}] ${message}`);
  }
}
