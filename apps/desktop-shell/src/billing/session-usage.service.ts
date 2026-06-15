export type SessionUsageSnapshot = {
  creditsUsed: number;
  tokensSent: number;
  promptsCount: number;
};

export class SessionUsageService {
  private creditsUsed = 0;
  private tokensSent = 0;
  private promptsCount = 0;

  public recordPrompt(inputTokens: number, creditsConsumed: number): void {
    this.tokensSent += Math.max(0, Math.round(inputTokens));
    this.creditsUsed += Math.max(0, Math.round(creditsConsumed));
    this.promptsCount += 1;
  }

  public getSnapshot(): SessionUsageSnapshot {
    return {
      creditsUsed: this.creditsUsed,
      tokensSent: this.tokensSent,
      promptsCount: this.promptsCount,
    };
  }

  public reset(): void {
    this.creditsUsed = 0;
    this.tokensSent = 0;
    this.promptsCount = 0;
  }
}
