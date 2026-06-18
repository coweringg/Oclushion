import type { PackedRepositoryContext } from "../context.service";
import type { ModelRouter } from "../llm/model-router";
import { parseAssistantResponseForProposals } from "../safe-diff.service";
import { SecureExecutor } from "../security/secure-executor";
import { evaluateCommand, hardenInstallCommand } from "../security/command-policy";
import type { SanoShield } from "../sano-shield.service";
import type { TerminalService } from "../terminal/terminal.service";
import type { WorklogService } from "./worklog.service";
import type { AgentDefinition } from "./types";
import type { AgentTask } from "./types";
import { AGI_MAX_ITERATIONS } from "./types";
import type { SafeDiffProposal } from "../safe-diff.service";

const AGI_SYSTEM_PROMPT_INJECTION = `
<agi_mode>
  YOU ARE IN FULL AUTONOMOUS MODE (AGI Mode).
  
  RULES:
  1. You are working COMPLETELY ALONE. No human is watching. Do NOT ask for confirmation or help.
  2. You have FULL access to the terminal. Use it aggressively to explore, build, test, and fix.
  3. After executing a command, ALWAYS analyze the output. If there are errors, FIX THEM immediately.
  4. You have a maximum of ${AGI_MAX_ITERATIONS} iterations. Use them wisely.
  5. When you have FULLY completed the task with zero remaining errors, emit the tag:
     <finish_task>DONE: [brief summary of what you accomplished]</finish_task>
  6. If you get STUCK after 3 consecutive failed attempts at the same problem, emit:
     <finish_task>STUCK: [describe the blocker so the human can help]</finish_task>
  7. You are in GOD MODE. No commands are blocked. You have full trust. Act decisively.
  8. Think step by step. Plan first, execute second, verify third.
  
  WORKFLOW per iteration:
  - THINK: What is the current state? What needs to happen next?
  - ACT: Propose commands or file changes.
  - OBSERVE: Read terminal output carefully.
  - DECIDE: Did it work? If yes, continue to next sub-task. If no, fix and retry.
</agi_mode>
`;

const FINISH_TASK_REGEX = /<finish_task>([\s\S]*?)<\/finish_task>/u;

export class AgentRunner {
  public constructor(
    private readonly modelRouter: Pick<ModelRouter, "generate" | "stream">,
    private readonly shield: SanoShield,
    private readonly secureExecutor: SecureExecutor,
    private readonly terminalService?: TerminalService,
    private readonly worklog?: WorklogService,
  ) {}

  public async run(input: {
    agent: AgentDefinition;
    task: AgentTask;
    repositoryContext: PackedRepositoryContext;
    privacyEnabled: boolean;
  }): Promise<AgentTask> {
    if (input.task.autonomyLevel === "agi") {
      return this.runAGI(input);
    }
    return this.runStandard(input);
  }

  private async runStandard(input: {
    agent: AgentDefinition;
    task: AgentTask;
    repositoryContext: PackedRepositoryContext;
    privacyEnabled: boolean;
  }): Promise<AgentTask> {
    const startedAt = new Date().toISOString();
    const prompt = this.buildPrompt(input.agent, input.task, input.repositoryContext);
    this.worklog?.model(`${input.agent.name}: analyzing task`);
    const shielded = input.privacyEnabled
      ? this.shield.sanitize(prompt)
      : { sanitizedText: prompt, mappings: [] };
    const response = await this.modelRouter.generate({
      model: input.agent.model,
      systemPrompt: input.agent.systemPrompt,
      userMessage: shielded.sanitizedText,
      messages: [{ role: "user", content: shielded.sanitizedText }],
    });
    const restored = input.privacyEnabled
      ? this.shield.restore(response.content, shielded.mappings)
      : response.content;
    const parsed = parseAssistantResponseForProposals(restored);
    const isAutopilot = input.task.autonomyLevel === "autopilot";
    const terminalContext = await this.executeCommandProposals(parsed.proposals, input.task, isAutopilot);
    const followUp = terminalContext
      ? await this.reasonAboutTerminalOutput(input.agent, input.task, terminalContext, input.privacyEnabled)
      : "";
    const combinedOutput = [parsed.conversationText || restored, followUp].filter(Boolean).join("\n\n");
    const followUpParsed = followUp ? parseAssistantResponseForProposals(followUp) : { proposals: [] };
    const proposals = [...parsed.proposals, ...followUpParsed.proposals];
    
    let finalOutput = combinedOutput;
    if (input.task.agentRole === "qa") {
      const { VisualQAService } = await import("./visual-qa.service");
      const vqaService = new VisualQAService();
      const visualEvidence = await vqaService.executeVisualTest(input.task.input);
      finalOutput = combinedOutput + "\n\n" + visualEvidence;
    }

    this.worklog?.proposal(`${proposals.length} proposal${proposals.length === 1 ? "" : "s"} produced by ${input.agent.name}`);
    return {
      ...input.task,
      status: "completed",
      output: finalOutput,
      response,
      proposals: proposals.map((proposal) => ({
        ...proposal,
        id: `${input.task.agentRole}-${input.task.id}-${proposal.id}`,
        title: `${input.agent.name}: ${proposal.title}`,
      })),
      startedAt,
      completedAt: new Date().toISOString(),
      creditsUsed: estimateCredits(response.model, prompt.length + response.content.length),
      iterationsUsed: 1,
    };
  }

  private async runAGI(input: {
    agent: AgentDefinition;
    task: AgentTask;
    repositoryContext: PackedRepositoryContext;
    privacyEnabled: boolean;
  }): Promise<AgentTask> {
    const startedAt = new Date().toISOString();
    const allProposals: SafeDiffProposal[] = [];
    const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    const outputLog: string[] = [];
    let totalCredits = 0;
    let iteration = 0;
    let finishReason = "";

    const basePrompt = this.buildPrompt(input.agent, input.task, input.repositoryContext);
    const agiSystemPrompt = `${input.agent.systemPrompt}\n${AGI_SYSTEM_PROMPT_INJECTION}`;

    this.worklog?.model(`🤖 AGI MODE ACTIVATED for ${input.agent.name} — Max ${AGI_MAX_ITERATIONS} iterations`);

    conversationHistory.push({ role: "user", content: basePrompt });

    while (iteration < AGI_MAX_ITERATIONS) {
      iteration++;
      this.worklog?.model(`🔄 AGI Iteration ${iteration}/${AGI_MAX_ITERATIONS} — ${input.agent.name}`);

      const lastMessage = conversationHistory[conversationHistory.length - 1]!;
      const shielded = input.privacyEnabled
        ? this.shield.sanitize(lastMessage.content)
        : { sanitizedText: lastMessage.content, mappings: [] };

      const response = await this.modelRouter.generate({
        model: input.agent.model,
        systemPrompt: agiSystemPrompt,
        userMessage: shielded.sanitizedText,
        messages: conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const restored = input.privacyEnabled
        ? this.shield.restore(response.content, shielded.mappings)
        : response.content;

      totalCredits += estimateCredits(response.model, lastMessage.content.length + response.content.length);
      conversationHistory.push({ role: "assistant", content: restored });
      outputLog.push(`\n── AGI Iteration ${iteration} ──\n${restored}`);

      const finishMatch = FINISH_TASK_REGEX.exec(restored);
      if (finishMatch) {
        finishReason = finishMatch[1]?.trim() ?? "Task completed";
        this.worklog?.model(`✅ AGI finished at iteration ${iteration}: ${finishReason}`);
        break;
      }

      const parsed = parseAssistantResponseForProposals(restored);
      const newProposals = parsed.proposals.map((proposal) => ({
        ...proposal,
        id: `${input.task.agentRole}-${input.task.id}-iter${iteration}-${proposal.id}`,
        title: `[AGI #${iteration}] ${input.agent.name}: ${proposal.title}`,
      }));
      allProposals.push(...newProposals);

      const terminalOutput = await this.executeCommandProposals(parsed.proposals, input.task, true);

      if (!terminalOutput) {
        conversationHistory.push({
          role: "user",
          content: [
            "<agi_feedback>",
            `Iteration ${iteration}/${AGI_MAX_ITERATIONS} complete. No terminal commands were executed.`,
            "Analyze your progress. If the task is done, emit <finish_task>. Otherwise, propose the next concrete action.",
            "</agi_feedback>",
          ].join("\n"),
        });
        continue;
      }

      conversationHistory.push({
        role: "user",
        content: [
          "<agi_terminal_output>",
          terminalOutput.slice(-20_000),
          "</agi_terminal_output>",
          "",
          `Iteration ${iteration}/${AGI_MAX_ITERATIONS}. Analyze the output above.`,
          "If there are errors, fix them immediately. If the task is complete, emit <finish_task>.",
        ].join("\n"),
      });
    }

    if (!finishReason) {
      finishReason = `AGI exhausted maximum iterations (${AGI_MAX_ITERATIONS}). Manual review required.`;
      this.worklog?.model(`⚠️ AGI hit iteration limit for ${input.agent.name}`);
    }

    const finalOutput = [
      `🤖 OCLUSHION AGI MODE — ${input.agent.name}`,
      `📊 Iterations used: ${iteration}/${AGI_MAX_ITERATIONS}`,
      `🏁 Result: ${finishReason}`,
      "",
      "═══ Full Execution Log ═══",
      ...outputLog,
    ].join("\n");

    return {
      ...input.task,
      status: finishReason.startsWith("STUCK") ? "failed" : "completed",
      output: finalOutput,
      proposals: allProposals,
      startedAt,
      completedAt: new Date().toISOString(),
      creditsUsed: totalCredits,
      iterationsUsed: iteration,
    };
  }

  private async executeCommandProposals(
    proposals: ReturnType<typeof parseAssistantResponseForProposals>["proposals"],
    task: AgentTask,
    godMode: boolean = false,
  ): Promise<string> {
    const commands = proposals.filter((proposal) => proposal.kind === "command");
    if (!commands.length || !this.terminalService) {
      return "";
    }
    const terminal = await this.terminalService.getOrCreateAgentTerminal();
    const outputs: string[] = [];
    for (const proposal of commands) {
      const { command, args } = parseCommandLine(proposal.content);
      if (!command) {
        continue;
      }

      if (!godMode) {
        const policy = evaluateCommand(command, args);
        if (policy.riskLevel === "blocked") {
          this.worklog?.security(`BLOCKED: ${proposal.content}`, policy.reason);
          await this.terminalService.writeCommandEcho(terminal.id, `BLOCKED: ${proposal.content} (${policy.reason})`);
          continue;
        }
        if (policy.requiresApproval && !confirmAgentCommand(proposal.content, policy.reason)) {
          this.worklog?.security(`Approval denied: ${proposal.content}`, policy.reason);
          await this.terminalService.writeCommandEcho(terminal.id, `SKIPPED: ${proposal.content} (approval denied)`);
          continue;
        }
      }

      let finalArgs = [...args];
      if (!godMode) {
        const hardenedArgs = hardenInstallCommand(command, finalArgs);
        if (hardenedArgs.join("\u0000") !== finalArgs.join("\u0000")) {
          finalArgs = hardenedArgs;
          this.worklog?.security("Added --ignore-scripts to package install", [command, ...finalArgs].join(" "));
        }
      }

      const printable = [command, ...finalArgs].join(" ");
      this.worklog?.command(`${task.agentRole} executing: ${printable}`, godMode ? "AGI GOD MODE" : "standard");
      await this.terminalService.writeCommandEcho(terminal.id, printable);
      const result = await this.secureExecutor.runCommand({
        command,
        args: finalArgs,
        requirePromptOverride: true,
      });
      outputs.push(`[Command: ${printable}]\n[Exit: ${result.exitCode}]\n${result.stdout}${result.stderr}`);
    }
    return outputs.join("\n\n");
  }

  private async reasonAboutTerminalOutput(
    agent: AgentDefinition,
    task: AgentTask,
    terminalContext: string,
    privacyEnabled: boolean,
  ): Promise<string> {
    const prompt = [
      `<task>${task.input}</task>`,
      "<terminal_output>",
      terminalContext.slice(-20_000),
      "</terminal_output>",
      "Given the terminal output above, summarize what happened and propose any next Safe Diff changes if needed.",
    ].join("\n");
    const shielded = privacyEnabled ? this.shield.sanitize(prompt) : { sanitizedText: prompt, mappings: [] };
    const response = await this.modelRouter.generate({
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      userMessage: shielded.sanitizedText,
      messages: [{ role: "user", content: shielded.sanitizedText }],
    });
    this.worklog?.model(`${agent.name}: reviewed terminal output`, response.latencyMs);
    return privacyEnabled ? this.shield.restore(response.content, shielded.mappings) : response.content;
  }

  private buildPrompt(
    agent: AgentDefinition,
    task: AgentTask,
    repositoryContext: PackedRepositoryContext,
  ): string {
    const files = repositoryContext.files
      .map((file) => `<file path="${file.path}">\n${file.content}\n</file>`)
      .join("\n");
    return [
      `<agent role="${agent.role}" name="${agent.name}">`,
      agent.systemPrompt,
      "</agent>",
      `<task>${task.input}</task>`,
      `<target_paths>${task.targetPaths.join(", ")}</target_paths>`,
      `<repository_context used_tokens="${repositoryContext.usedTokens}">${files}</repository_context>`,
      "Return concise analysis plus fenced code blocks for any proposed file changes.",
    ].join("\n");
  }
}

function parseCommandLine(value: string): { command: string; args: string[] } {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  return { command: parts[0] ?? "", args: parts.slice(1) };
}

function confirmAgentCommand(command: string, reason: string): boolean {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return false;
  }
  return window.confirm(`Agent wants to run:\n${command}\n\n${reason}\n\nApprove?`);
}

function estimateCredits(model: string, characters: number): number {
  if (/^(local|ollama)\//iu.test(model)) {
    return 0;
  }
  return Math.max(1, Math.ceil(characters / 4 / 1000));
}
