import { escapeHtml } from "../ui/utils/format";

export type FileSearchResult = {
  path: string;
  name: string;
  score: number;
  matches: Array<{ start: number; end: number }>;
};

export type FileSearchEvent =
  | { type: "filesearch:opened" }
  | { type: "filesearch:closed" }
  | { type: "filesearch:selected"; path: string };

export type FileSearchListener = (event: FileSearchEvent) => void;

const MAX_RESULTS = 15;
const MAX_SCORE = 1;

export class FileSearchService {
  private files: Array<{ path: string; name: string }> = [];
  private overlay: HTMLElement | null = null;
  private selectedIndex = 0;
  private listeners = new Set<FileSearchListener>();

  setFiles(files: Array<{ path: string }>): void {
    this.files = files.map((f) => ({
      path: f.path,
      name: f.path.split("/").pop() ?? f.path,
    }));
  }

  search(query: string): FileSearchResult[] {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const scored: FileSearchResult[] = [];

    for (const file of this.files) {
      const lowerName = file.name.toLowerCase();
      const lowerPath = file.path.toLowerCase();

      const nameScore = this.fuzzyScore(lowerName, lowerQuery);
      const pathScore = this.fuzzyScore(lowerPath, lowerQuery) * 0.5;
      const exactMatch = lowerName === lowerQuery ? 1 : 0;
      const startsWith = lowerName.startsWith(lowerQuery) ? 0.8 : 0;

      const score = Math.max(nameScore, pathScore, exactMatch, startsWith);

      if (score > 0.1) {
        const matches = this.findMatchPositions(file.name, query);
        scored.push({ path: file.path, name: file.name, score, matches });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);
  }

  showOverlay(callback: (path: string) => void): void {
    if (this.overlay) return;

    const overlay = document.createElement("div");
    overlay.className = "file-search-overlay";
    overlay.innerHTML = `
      <div class="file-search-panel">
        <input type="text" class="file-search-input" placeholder="Search files by name..." autofocus />
        <div class="file-search-results"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.selectedIndex = 0;

    const input = overlay.querySelector<HTMLInputElement>(".file-search-input");
    const resultsContainer = overlay.querySelector<HTMLElement>(".file-search-results");

    input?.focus();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    input?.addEventListener("input", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = input.value;
        const results = this.search(query);
        this.selectedIndex = 0;
        this.renderResults(resultsContainer!, results);
      }, 150);
    });

    input?.addEventListener("keydown", (e) => {
      const results = this.search(input.value);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, results.length - 1);
        this.renderResults(resultsContainer!, results);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.renderResults(resultsContainer!, results);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[this.selectedIndex];
        if (selected) {
          callback(selected.path);
          this.hideOverlay();
        }
      } else if (e.key === "Escape") {
        this.hideOverlay();
      }
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.hideOverlay();
      }
    });

    this.emit({ type: "filesearch:opened" });
  }

  hideOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.emit({ type: "filesearch:closed" });
  }

  subscribe(listener: FileSearchListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private renderResults(container: HTMLElement, results: FileSearchResult[]): void {
    if (results.length === 0) {
      container.innerHTML = '<div class="file-search-empty">No files found</div>';
      return;
    }

    container.innerHTML = results
      .map((result, index) => {
        const highlighted = this.highlightMatches(result.name, result.matches);
        const selected = index === this.selectedIndex ? " selected" : "";
        return `<button class="file-search-item${selected}" type="button" data-path="${escapeHtml(result.path)}"><span class="file-search-icon">📄</span><span class="file-search-name">${highlighted}</span><span class="file-search-path">${escapeHtml(result.path)}</span></button>`;
      })
      .join("");

    container.querySelectorAll<HTMLButtonElement>(".file-search-item").forEach((btn, index) => {
      btn.addEventListener("click", () => {
        const path = btn.dataset.path;
        if (path) {
          this.emit({ type: "filesearch:selected", path });
        }
      });
    });
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

    return Math.min(score / query.length, MAX_SCORE);
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

  private highlightMatches(text: string, matches: Array<{ start: number; end: number }>): string {
    if (matches.length === 0) return text;

    let result = "";
    let lastIndex = 0;

    for (const match of matches) {
      result += text.substring(lastIndex, match.start);
      result += `<mark class="file-search-highlight">${text.substring(match.start, match.end)}</mark>`;
      lastIndex = match.end;
    }

    result += text.substring(lastIndex);
    return result;
  }

  private emit(event: FileSearchEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
