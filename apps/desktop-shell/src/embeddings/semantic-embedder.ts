import { logger } from "../utils/logger";

export class SemanticEmbedder {
  private pipeline: ((text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: Float64Array }>) | null = null;
  private initialized = false;
  private initPromise: Promise<boolean> | null = null;

  public async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initialize();
    return this.initPromise;
  }

  private async initialize(): Promise<boolean> {
    try {
      const mod = await import("@huggingface/transformers");
      this.pipeline = await mod.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      this.initialized = true;
      logger.info("SemanticEmbedder", "Embedding model loaded successfully");
      return true;
    } catch (err) {
      logger.warn("SemanticEmbedder", "Failed to load embedding model", err);
      return false;
    }
  }

  public async embed(text: string): Promise<Float64Array | null> {
    if (!(await this.ensureInitialized())) return null;
    try {
      const result = await this.pipeline!(text, { pooling: "mean", normalize: true });
      return result.data;
    } catch (err) {
      logger.warn("SemanticEmbedder", "Embedding failed", err);
      return null;
    }
  }

  public cosineSimilarity(a: Float64Array | number[], b: Float64Array | number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

export const semanticEmbedder = new SemanticEmbedder();
