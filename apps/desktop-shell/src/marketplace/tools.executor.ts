import type { SecureExecutor } from "../security/secure-executor";
import type { InstalledTool } from "./marketplace.types";

export class ToolsExecutor {
  public constructor(private readonly secureExecutor: Pick<SecureExecutor, "runCommand">) {}

  public async executeInstalledTool(tool: InstalledTool, args: string[], projectRoot: string): Promise<void> {
    await this.secureExecutor.runCommand({
      command: tool.binPath,
      args,
      cwd: projectRoot,
      requirePromptOverride: false,
    });
  }
}
