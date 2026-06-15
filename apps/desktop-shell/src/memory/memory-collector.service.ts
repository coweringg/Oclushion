import type { ProjectMemoryService } from "./project-memory.service";
import { logger } from "../utils/logger";

export class MemoryCollectorService {
  constructor(private readonly memoryService: ProjectMemoryService) {}

  public async processChatSession(chatLog: string): Promise<number> {
    try {
      const learned = await this.memoryService.learnFromText(chatLog, "auto-detected");
      if (learned.length > 0) {
        logger.info("MemoryCollector", `Extracted ${learned.length} new memory entries automatically.`);
      }
      return learned.length;
    } catch (err) {
      logger.warn("MemoryCollector", "Failed to process chat session for memory extraction", err);
      return 0;
    }
  }

  public async processCodeChanges(commitMessage: string, diff: string): Promise<number> {
    const context = `Commit: "${commitMessage}". Diff:\n${diff}`;
    try {
      const learned = await this.memoryService.learnFromText(context, "auto-detected");
      if (learned.length > 0) {
        logger.info("MemoryCollector", `Extracted ${learned.length} new memory entries from code changes.`);
      }
      return learned.length;
    } catch (err) {
      logger.warn("MemoryCollector", "Failed to extract memory from code changes", err);
      return 0;
    }
  }
}
