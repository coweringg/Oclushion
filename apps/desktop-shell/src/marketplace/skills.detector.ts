import type { Skill, SuggestedSkill, MarketplacePlanTier } from "./marketplace.types";
import { normalizeTier } from "../billing/license-validator.js";
import { SkillsEmbedder } from "./skills.embedder";
import { logger } from "../utils/logger";

type TokenIndex = Map<string, { df: number; idf: number }>;

export class SkillsDetector {
  private tokenIndex: TokenIndex | null = null;
  private skillVectors: Map<string, Map<string, number>> | null = null;
  private embedder = new SkillsEmbedder();
  private embedderReady = false;

  public async initializeEmbedder(): Promise<void> {
    this.embedderReady = await this.embedder.ensureInitialized();
  }

  public async suggest(
    userMessage: string,
    availableSkills: Skill[],
    installedSkillIds: string[],
    userTier?: string,
  ): Promise<SuggestedSkill | null> {
    const normalized = normalize(userMessage);
    const installed = new Set(installedSkillIds);
    const tier = normalizeTier(userTier);
    const candidates = availableSkills
      .filter((skill) => !installed.has(skill.id) && isSkillAccessible(skill, tier));

    if (candidates.length === 0) return null;

    if (this.embedderReady) {
      return this.suggestWithEmbeddings(normalized, candidates);
    }

    return this.suggestWithTfIdf(normalized, candidates);
  }

  private async suggestWithEmbeddings(
    normalized: string,
    candidates: Skill[],
  ): Promise<SuggestedSkill | null> {
    const queryVec = await this.embedder.embed(normalized);
    if (!queryVec) return this.suggestWithTfIdf(normalized, candidates);

    const skillVecs = await this.embedder.computeSkillEmbeddings(candidates);

    let best: SuggestedSkill | null = null;

    for (const skill of candidates) {
      const sv = skillVecs.get(skill.id);
      if (!sv) continue;

      const sim = this.embedder.cosineSimilarity(queryVec, sv);
      const boost = normalized.includes(skill.category) ? 0.05 : 0;
      const confidence = Math.min(1, sim + boost);

      if (confidence >= 0.25 && (!best || confidence > best.confidence)) {
        best = {
          skill,
          reason: `This request semantically relates to ${skill.category} capabilities.`,
          confidence,
          matchedKeywords: [],
        };
      }
    }

    return best;
  }

  private suggestWithTfIdf(
    normalized: string,
    candidates: Skill[],
  ): SuggestedSkill | null {
    this.buildIndex(candidates);
    const queryVector = this.buildQueryVector(normalized);
    const queryNorm = magnitude(queryVector);

    if (queryNorm === 0) return null;

    let best: SuggestedSkill | null = null;

    for (const skill of candidates) {
      const skillVec = this.skillVectors!.get(skill.id);
      if (!skillVec) continue;

      let dot = 0;
      for (const [term, qwt] of queryVector) {
        const swt = skillVec.get(term) ?? 0;
        dot += qwt * swt;
      }
      const skillNorm = magnitude(skillVec);
      const sim = skillNorm === 0 ? 0 : dot / (queryNorm * skillNorm);
      const boost = normalized.includes(skill.category) ? 0.08 : 0;
      const confidence = Math.min(1, sim + boost);

      if (confidence >= 0.28 && (!best || confidence > best.confidence)) {
        const topTerms = [...queryVector.entries()]
          .filter(([t]) => skillVec.has(t))
          .slice(0, 3)
          .map(([t]) => t);

        best = {
          skill,
          reason: topTerms.length
            ? `This request relates to ${topTerms.join(", ")}.`
            : `Relevant to ${skill.category} skills.`,
          confidence,
          matchedKeywords: topTerms,
        };
      }
    }

    return best;
  }

  private buildIndex(skills: Skill[]): void {
    if (this.tokenIndex && this.skillVectors) return;

    const df = new Map<string, number>();
    const sv = new Map<string, Map<string, number>>();
    const n = skills.length;

    for (const skill of skills) {
      const terms = this.tokenize(skill);
      const seen = new Set<string>();
      const tfs = new Map<string, number>();

      for (const term of terms) {
        tfs.set(term, (tfs.get(term) ?? 0) + 1);
        if (!seen.has(term)) {
          df.set(term, (df.get(term) ?? 0) + 1);
          seen.add(term);
        }
      }

      const maxFreq = Math.max(1, ...tfs.values());
      const vec = new Map<string, number>();
      for (const [term, freq] of tfs) {
        vec.set(term, freq / maxFreq);
      }
      sv.set(skill.id, vec);
    }

    const index: TokenIndex = new Map();
    for (const [term, docCount] of df) {
      index.set(term, { df: docCount, idf: Math.log(1 + (n - docCount + 0.5) / (docCount + 0.5)) + 1 });
    }

    for (const [, vec] of sv) {
      for (const [term, tf] of vec) {
        const idf = index.get(term)?.idf ?? 1;
        vec.set(term, tf * idf);
      }
    }

    this.tokenIndex = index;
    this.skillVectors = sv;
  }

  private buildQueryVector(query: string): Map<string, number> {
    const tokens = query.split(/\s+/).filter((t) => t.length > 2);
    const freq = new Map<string, number>();
    for (const token of tokens) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
    const maxFreq = Math.max(1, ...freq.values());
    const vec = new Map<string, number>();
    for (const [term, f] of freq) {
      const idf = this.tokenIndex?.get(term)?.idf ?? Math.log(1.5);
      vec.set(term, (f / maxFreq) * idf);
    }
    return vec;
  }

  private tokenize(skill: Skill): string[] {
    const text = [
      skill.name,
      skill.description,
      ...skill.keywords,
      skill.category,
    ].join(" ");
    return normalize(text).split(/\s+/).filter((t) => t.length > 2);
  }
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function magnitude(vec: Map<string, number>): number {
  let sum = 0;
  for (const v of vec.values()) sum += v * v;
  return Math.sqrt(sum);
}

function isSkillAccessible(skill: Skill, userTier: MarketplacePlanTier): boolean {
  if (skill.allowedTiers && skill.allowedTiers.length > 0) {
    return skill.allowedTiers.includes(userTier);
  }
  
  const skillTier = skill.tier;
  if (skillTier === "free") return true;
  if (skillTier === "pro") return userTier === "pro" || userTier === "enterprise";
  return userTier === "enterprise";
}
