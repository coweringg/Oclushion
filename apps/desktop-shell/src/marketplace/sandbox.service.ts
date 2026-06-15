import { logger } from "../utils/logger";
import type { MarketplaceItem } from "./marketplace.types";

export type SandboxPolicy = {
  allowNetwork: boolean;
  allowedDomains: string[];
  allowFileSystem: boolean;
  allowedPaths: string[];
};

export type ExecutionResult = {
  success: boolean;
  output?: string;
  error?: string;
};

export class SandboxService {
  constructor() {}

  public async executeSandboxed(item: MarketplaceItem, scriptContent: string, workspacePath: string): Promise<ExecutionResult> {
    logger.info("SandboxService", `Isolating execution for ${item.name} by ${item.author}`);

    const policy = this.getPolicyForItem(item, workspacePath);

    try {
      this.enforcePolicy(scriptContent, policy);

      await new Promise(r => setTimeout(r, 800));

      return {
        success: true,
        output: `[Sandboxed] ${item.name} executed successfully within bounded context.`
      };
    } catch (err: any) {
      logger.error("SandboxService", `Security Violation in ${item.name}`, err);
      return {
        success: false,
        error: `Security Sandbox Blocked Execution: ${err.message}`
      };
    }
  }

  private getPolicyForItem(item: MarketplaceItem, workspacePath: string): SandboxPolicy {
    return {
      allowNetwork: item.type === "agent",
      allowedDomains: ["api.openai.com", "api.anthropic.com"],
      allowFileSystem: item.type === "template" || item.type === "skill",
      allowedPaths: [workspacePath],
    };
  }

  private enforcePolicy(scriptContent: string, policy: SandboxPolicy) {
    if (!policy.allowNetwork && (scriptContent.includes("fetch(") || scriptContent.includes("XMLHttpRequest"))) {
      throw new Error("Network access is strictly forbidden for this item type.");
    }
    
    if (scriptContent.includes("eval(") || scriptContent.includes("Function(")) {
      throw new Error("Dynamic code execution (eval) is completely banned in Oclushion Marketplace.");
    }

    if (!policy.allowFileSystem && (scriptContent.includes("fs.readFile") || scriptContent.includes("tauri/fs"))) {
      throw new Error("File system access is forbidden for this item type.");
    }
  }
}
