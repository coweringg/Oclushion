export type CursorPosition = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
};

export class LiveCursorsRenderer {
  public render(container: HTMLElement, cursors: CursorPosition[]): void {
    const existingStyle = document.getElementById("ocl-live-cursors-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-live-cursors-style";
      style.textContent = `
        .ocl-live-cursor-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          overflow: hidden;
        }

        .ocl-cursor-node {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
          will-change: transform;
          pointer-events: none;
        }

        .ocl-cursor-arrow {
          width: 16px;
          height: 16px;
          fill: var(--cursor-color);
          stroke: white;
          stroke-width: 1.5px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        .ocl-cursor-label {
          background: var(--cursor-color);
          color: white;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          border-top-left-radius: 0;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          margin-left: 12px;
          margin-top: -2px;
        }
      `;
      document.head.appendChild(style);
    }

    container.className = "ocl-live-cursor-layer";
    
    container.innerHTML = cursors.map(c => `
      <div class="ocl-cursor-node" style="transform: translate(${c.x}px, ${c.y}px); --cursor-color: ${c.color};">
        <svg class="ocl-cursor-arrow" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.083 1.018a1 1 0 0 1 1.258.125l16 16a1 1 0 0 1-.365 1.636l-6.843 2.28a1 1 0 0 0-.583.583l-2.28 6.843a1 1 0 0 1-1.636.365l-16-16a1 1 0 0 1 .125-1.258z" />
        </svg>
        <div class="ocl-cursor-label">${c.name}</div>
      </div>
    `).join("");
  }
}
