import { semanticEmbedder } from "../embeddings/semantic-embedder";
import { logger } from "../utils/logger";
import { z } from "zod";

export type MarketplaceItemType = "skill" | "tool" | "profile";

export type MarketplaceSortOption = "relevance" | "newest" | "popular" | "name";

export type MarketplaceFilter = {
  type?: MarketplaceItemType;
  tier?: string;
  sort: MarketplaceSortOption;
};

export type MarketplaceSearchResult = {
  id: string;
  name: string;
  description: string;
  type: MarketplaceItemType;
  tier: string;
  score: number;
  matches: Array<{ start: number; end: number }>;
};

const MAX_RESULTS = 20;
const MAX_SAVED_FILTERS = 50;

export class MarketplaceSearchService {
  private filters: MarketplaceFilter = { sort: "relevance" };
  private savedFilters: MarketplaceFilter[] = [];
  private embedder = semanticEmbedder;
  private embedderReady = false;

  constructor() {
    this.loadSavedFilters();
    this.initializeEmbedder();
  }

  private async initializeEmbedder(): Promise<void> {
    this.embedderReady = await this.embedder.ensureInitialized();
  }

  async search(
    items: Array<{ id: string; name: string; description: string; type: MarketplaceItemType; tier: string }>,
    query: string,
  ): Promise<MarketplaceSearchResult[]> {
    const filtered = items.filter((item) => {
      if (this.filters.type && item.type !== this.filters.type) return false;
      if (this.filters.tier && item.tier !== this.filters.tier) return false;
      return true;
    });

    if (!query.trim()) {
      return this.sortResults(filtered.map((item) => ({
        ...item,
        score: 1,
        matches: [],
      })));
    }

    if (this.embedderReady) {
      return this.searchWithEmbeddings(filtered, query);
    }

    return this.searchWithFuzzy(filtered, query);
  }

  private async searchWithEmbeddings(
    items: Array<{ id: string; name: string; description: string; type: MarketplaceItemType; tier: string }>,
    query: string,
  ): Promise<MarketplaceSearchResult[]> {
    const queryVec = await this.embedder.embed(query);
    if (!queryVec) return this.searchWithFuzzy(items, query);

    const results: MarketplaceSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const item of items) {
      const text = `${item.name} ${item.description}`;
      const itemVec = await this.embedder.embed(text);
      if (!itemVec) continue;

      const semanticScore = this.embedder.cosineSimilarity(queryVec, itemVec);
      const nameScore = this.fuzzyScore(item.name.toLowerCase(), lowerQuery) * 0.3;
      const score = Math.min(1, semanticScore * 0.7 + nameScore);
      const matches = this.findMatchPositions(item.name, query);

      if (score > 0.15) {
        results.push({ ...item, score, matches });
      }
    }

    return this.sortResults(results);
  }

  private searchWithFuzzy(
    items: Array<{ id: string; name: string; description: string; type: MarketplaceItemType; tier: string }>,
    query: string,
  ): MarketplaceSearchResult[] {
    const lowerQuery = query.toLowerCase();
    const results: MarketplaceSearchResult[] = [];

    for (const item of items) {
      const nameScore = this.fuzzyScore(item.name.toLowerCase(), lowerQuery);
      const descScore = this.fuzzyScore(item.description.toLowerCase(), lowerQuery) * 0.5;
      const score = Math.max(nameScore, descScore);

      if (score > 0.1) {
        const matches = this.findMatchPositions(item.name, query);
        results.push({ ...item, score, matches });
      }
    }

    return this.sortResults(results);
  }

  setFilter(filter: Partial<MarketplaceFilter>): void {
    this.filters = { ...this.filters, ...filter };
  }

  getFilter(): MarketplaceFilter {
    return { ...this.filters };
  }

  resetFilter(): void {
    this.filters = { sort: "relevance" };
  }

  saveCurrentFilter(): void {
    const exists = this.savedFilters.some(
      (f) => f.type === this.filters.type && f.tier === this.filters.tier && f.sort === this.filters.sort,
    );
    if (!exists) {
      this.savedFilters.push({ ...this.filters });
      if (this.savedFilters.length > MAX_SAVED_FILTERS) {
        this.savedFilters = this.savedFilters.slice(-MAX_SAVED_FILTERS);
      }
      this.persistSavedFilters();
    }
  }

  getSavedFilters(): MarketplaceFilter[] {
    return [...this.savedFilters];
  }

  removeSavedFilter(index: number): void {
    if (index < 0 || index >= this.savedFilters.length) return;
    this.savedFilters.splice(index, 1);
    this.persistSavedFilters();
  }

  private sortResults(results: MarketplaceSearchResult[]): MarketplaceSearchResult[] {
    switch (this.filters.sort) {
      case "relevance":
        return results.sort((a, b) => b.score - a.score);
      case "newest":
        return results.sort((a, b) => b.name.localeCompare(a.name));
      case "popular":
        return results.sort((a, b) => b.description.length - a.description.length);
      case "name":
        return results.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return results;
    }
  }

  private fuzzyScore(text: string, query: string): number {
    if (query.length === 0) return 1;

    let queryIndex = 0;
    let score = 0;
    let consecutive = 0;

    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        queryIndex++;
        consecutive++;
        score += consecutive * 0.1;
      } else {
        consecutive = 0;
      }
    }

    if (queryIndex < query.length) return 0;
    return Math.min(score / query.length, 1);
  }

  private findMatchPositions(text: string, query: string): Array<{ start: number; end: number }> {
    const positions: Array<{ start: number; end: number }> = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let startIndex = 0;

    while (startIndex < lowerText.length) {
      const index = lowerText.indexOf(lowerQuery, startIndex);
      if (index === -1) break;
      positions.push({ start: index, end: index + query.length });
      startIndex = index + 1;
    }

    return positions;
  }

  private loadSavedFilters(): void {
    try {
      const stored = localStorage.getItem("ocl_marketplace_saved_filters");
      if (stored) {
        const parsed = z.array(z.unknown()).safeParse(JSON.parse(stored));
        if (parsed.success) {
          this.savedFilters = parsed.data.filter(
            (f): f is MarketplaceFilter =>
              f !== null && typeof f === "object" && typeof (f as any).sort === "string",
          );
        }
      }
    } catch (err) {
      logger.warn("MarketplaceSearch", "Failed to load saved filters:", err);
    }
  }

  private persistSavedFilters(): void {
    try {
      localStorage.setItem("ocl_marketplace_saved_filters", JSON.stringify(this.savedFilters));
    } catch (err) {
      logger.warn("MarketplaceSearch", "Failed to persist saved filters:", err);
    }
  }
}
