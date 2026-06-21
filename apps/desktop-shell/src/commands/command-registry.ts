export type CommandDefinition = {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  category: string;
  handler: () => void | Promise<void>;
};

export type PaletteResult = CommandDefinition & {
  score: number;
  highlights?: Array<[number, number]>;
};

export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();

  public register(cmd: CommandDefinition): void {
    this.commands.set(cmd.id, cmd);
  }

  public registerAll(cmds: CommandDefinition[]): void {
    for (const cmd of cmds) {
      this.commands.set(cmd.id, cmd);
    }
  }

  public unregister(id: string): void {
    this.commands.delete(id);
  }

  public get(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  public getAll(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  public getByCategory(category: string): CommandDefinition[] {
    return this.getAll().filter((c) => c.category === category);
  }

  public getCategories(): string[] {
    const cats = new Set<string>();
    for (const cmd of this.commands.values()) {
      cats.add(cmd.category);
    }
    return Array.from(cats).sort();
  }

  public search(query: string): PaletteResult[] {
    if (!query.trim()) {
      return this.getAll().map((cmd) => ({ ...cmd, score: 1 }));
    }

    const lower = query.toLowerCase();
    const results: PaletteResult[] = [];

    for (const cmd of this.commands.values()) {
      const score = this.fuzzyScore(cmd.label.toLowerCase(), cmd.category.toLowerCase(), lower);
      if (score > 0) {
        results.push({ ...cmd, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  public searchFiles(query: string, files: Array<{ path: string; name: string }>): PaletteResult[] {
    if (!query.trim()) {
      return files.slice(0, 20).map((f) => ({
        id: `file:${f.path}`,
        icon: "📄",
        label: f.path,
        category: "Files",
        handler: () => {},
        score: 1,
      }));
    }

    const lower = query.toLowerCase();
    const results: PaletteResult[] = [];

    for (const file of files) {
      const nameScore = this.simpleMatch(file.name.toLowerCase(), lower);
      const pathScore = this.simpleMatch(file.path.toLowerCase(), lower);
      const score = Math.max(nameScore * 1.2, pathScore);
      if (score > 0) {
        results.push({
          id: `file:${file.path}`,
          icon: "📄",
          label: file.path,
          category: "Files",
          handler: () => {},
          score: Math.min(score, 1),
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  private fuzzyScore(label: string, category: string, query: string): number {
    if (label === query) return 1;
    if (label.startsWith(query)) return 0.9;
    if (label.includes(query)) return 0.7;
    if (category.includes(query)) return 0.4;

    let qi = 0;
    let score = 0;
    for (let li = 0; li < label.length && qi < query.length; li++) {
      if (label[li] === query[qi]) {
        score += qi === 0 && li === 0 ? 0.15 : 0.05;
        qi++;
      }
    }
    if (qi === query.length) {
      return Math.min(score, 0.6);
    }
    return 0;
  }

  private simpleMatch(text: string, query: string): number {
    if (text === query) return 1;
    if (text.startsWith(query)) return 0.8;
    if (text.includes(query)) return 0.5;
    let qi = 0;
    for (let ti = 0; ti < text.length && qi < query.length; ti++) {
      if (text[ti] === query[qi]) qi++;
    }
    return qi === query.length ? 0.3 : 0;
  }
}
