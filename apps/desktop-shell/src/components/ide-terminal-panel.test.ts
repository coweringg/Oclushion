// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import "./ide-terminal-panel";

describe("ide-terminal-panel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  async function createPanel() {
    const el = document.createElement("ide-terminal-panel");
    document.body.appendChild(el);
    el.isOpen = true;
    await el.updateComplete;
    return el;
  }

  it("registers the custom element in the registry", () => {
    const el = document.createElement("ide-terminal-panel");
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("renders nothing when isOpen is false", () => {
    const el = document.createElement("ide-terminal-panel");
    document.body.appendChild(el);
    expect(el.innerHTML.trim()).toBe("");
    el.remove();
  });

  it("renders the terminal panel when isOpen is true", async () => {
    const el = await createPanel();
    const section = el.querySelector(".terminal-panel");
    expect(section).toBeTruthy();
    expect(section?.getAttribute("aria-label")).toBe("Integrated terminal");
    el.remove();
  });

  it("shows idle status when no agent session exists", async () => {
    const el = await createPanel();
    const statusSpan = el.querySelector("#terminal-agent-status");
    expect(statusSpan?.textContent?.trim()).toBe("Idle");
    el.remove();
  });

  it("shows Running status when agent session is alive", async () => {
    const el = await createPanel();
    el.agentSession = { id: "session-1", isAlive: true } as any;
    await el.updateComplete;
    const statusSpan = el.querySelector("#terminal-agent-status");
    expect(statusSpan?.textContent?.trim()).toBe("Running");
    expect(statusSpan?.classList.contains("running")).toBe(true);
    el.remove();
  });

  it("shows Idle status when agent session is not alive", async () => {
    const el = await createPanel();
    el.agentSession = { id: "session-1", isAlive: false } as any;
    await el.updateComplete;
    const statusSpan = el.querySelector("#terminal-agent-status");
    expect(statusSpan?.textContent?.trim()).toBe("Idle");
    expect(statusSpan?.classList.contains("running")).toBe(false);
    el.remove();
  });

  it("renders split content when provided", async () => {
    const el = await createPanel();
    el.splitContent =
      '<div class="test-split">Split Pane Content</div>';
    await el.updateComplete;
    const container = el.querySelector(".terminal-split-container");
    expect(container).toBeTruthy();
    expect(container?.innerHTML).toContain("Split Pane Content");
    el.remove();
  });

  it("renders the terminal-split-container for xterm mount", async () => {
    const el = await createPanel();
    const mount = el.querySelector("#terminal-user-mount");
    expect(mount).toBeTruthy();
    el.remove();
  });

  it("renders the agent mount point with session id", async () => {
    const el = await createPanel();
    el.agentSession = { id: "agent-42", isAlive: true } as any;
    await el.updateComplete;
    const agentMount = el.querySelector("#terminal-agent-mount");
    expect(agentMount).toBeTruthy();
    expect(agentMount?.getAttribute("data-terminal-session")).toBe("agent-42");
    el.remove();
  });

  it("renders the split toolbar buttons", async () => {
    const el = await createPanel();
    const splitH = el.querySelector<HTMLButtonElement>(
      "[data-terminal-split-h]",
    );
    const splitV = el.querySelector<HTMLButtonElement>(
      "[data-terminal-split-v]",
    );
    const newTerm = el.querySelector<HTMLButtonElement>(
      "#terminal-new-user-button",
    );
    expect(splitH).toBeTruthy();
    expect(splitV).toBeTruthy();
    expect(newTerm).toBeTruthy();
    el.remove();
  });

  it("reflects isOpen changes", async () => {
    const el = document.createElement("ide-terminal-panel");
    document.body.appendChild(el);
    expect(el.isOpen).toBe(false);
    el.isOpen = true;
    await el.updateComplete;
    expect(el.isOpen).toBe(true);
    el.remove();
  });
});
