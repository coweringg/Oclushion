export class MinimapService {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "editor-minimap";
    this.canvas.style.cssText = "position:absolute;right:0;top:0;bottom:0;width:80px;background:rgba(14,23,36,0.8);border-left:1px solid rgba(139,155,181,0.1);";
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.resize();
  }

  destroy(): void {
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.container = null;
  }

  render(content: string): void {
    if (!this.ctx || !this.canvas) return;

    const lines = content.split("\n");
    const lineHeight = 3;
    const charWidth = 1.2;

    this.canvas.height = Math.min(lines.length * lineHeight, 400);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const y = i * lineHeight;

      if (line.trim()) {
        const indent = line.search(/\S/);
        const x = Math.max(0, indent) * charWidth;
        const width = Math.min(line.trim().length * charWidth, this.canvas.width - x);

        this.ctx.fillStyle = this.getLineColor(line);
        this.ctx.fillRect(x, y, width, lineHeight - 1);
      }
    }
  }

  updateScroll(scrollTop: number, scrollHeight: number, clientHeight: number): void {
    if (!this.canvas) return;

    const viewport = this.canvas.querySelector<HTMLElement>(".minimap-viewport");
    if (viewport) {
      const scale = this.canvas.height / scrollHeight;
      viewport.style.top = `${scrollTop * scale}px`;
      viewport.style.height = `${clientHeight * scale}px`;
    }
  }

  private resize(): void {
    if (this.canvas && this.container) {
      this.canvas.width = 80;
    }
  }

  private getLineColor(line: string): string {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("