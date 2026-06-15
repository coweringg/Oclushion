import { readTextFile } from "@tauri-apps/plugin-fs";
import { logger } from "../utils/logger";

export type SearchResult = {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string;
};

export class SearchService {
  private searchOverlay: HTMLElement | null = null;

  async searchInFiles(
    rootPath: string,
    query: string,
    files: Array<{ path: string; absolutePath: string }>,
  ): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const file of files.slice(0, 100)) {
      try {
        const content = await readTextFile(file.absolutePath);
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? "";
          const lowerLine = line.toLowerCase();
          let startIndex = 0;

          while (startIndex < lowerLine.length) {
            const index = lowerLine.indexOf(lowerQuery, startIndex);
            if (index === -1) break;

            results.push({
              file: file.path,
              line: i + 1,
              column: index + 1,
              match: line.substring(index, index + query.length),
              context: line.trim(),
            });

            startIndex = index + 1;
          }
        }
      } catch (error) {
        logger.debug('FileSearch', `Skipping unreadable file: ${file.path}`, error);
      }
    }

    return results;
  }

  showSearchOverlay(): void {
    if (this.searchOverlay) return;

    const overlay = document.createElement("div");
    overlay.className = "search-overlay";
    overlay.innerHTML = `
      <div class="search-panel">
        <input type="text" class="search-input" placeholder="Search in files..." autofocus />
        <div class="search-results"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.searchOverlay = overlay;

    const input = overlay.querySelector<HTMLInputElement>(".search-input");
    input?.focus();

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.hideSearchOverlay();
      }
    });

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideSearchOverlay();
      }
    });
  }

  hideSearchOverlay(): void {
    this.searchOverlay?.remove();
    this.searchOverlay = null;
  }

  isSearchOpen(): boolean {
    return this.searchOverlay !== null;
  }
}
