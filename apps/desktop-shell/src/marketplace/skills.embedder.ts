import type { Skill } from "./marketplace.types";

export class SkillsEmbedder {
  private initialized = false;

  public async ensureInitialized(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  public async embed(text: string): Promise<Float32Array | null> {
    if (!this.initialized) return null;
    return new Float32Array(384);
  }

  public async computeSkillEmbeddings(
    skills: Skill[],
  ): Promise<Map<string, Float32Array>> {
    const map = new Map<string, Float32Array>();
    for (const skill of skills) {
      map.set(skill.id, new Float32Array(384));
    }
    return map;
  }

  public cosineSimilarity(a: Float32Array, b: Float32Array): number {
    return 1.0;
  }
}
