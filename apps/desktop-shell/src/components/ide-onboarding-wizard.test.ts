// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "./ide-onboarding-wizard";

describe("ide-onboarding-wizard", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => store[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        store[key] = value;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  async function createWizard() {
    const el = document.createElement("ide-onboarding-wizard");
    document.body.appendChild(el);
    el.active = true;
    await el.updateComplete;
    return el;
  }

  it("registers the custom element in the registry", () => {
    const el = document.createElement("ide-onboarding-wizard");
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("renders nothing when active is false", () => {
    const el = document.createElement("ide-onboarding-wizard");
    document.body.appendChild(el);
    expect(el.innerHTML).toBe("");
    el.remove();
  });

  it("renders the wizard overlay when active is true", async () => {
    const el = await createWizard();
    expect(el.querySelector("#onboarding-wizard-overlay")).toBeTruthy();
    expect(el.querySelector(".ocl-wizard-steps")).toBeTruthy();
    el.remove();
  });

  it("shows the welcome step initially", async () => {
    const el = await createWizard();
    const heading = el.querySelector(".ocl-wizard-heading");
    expect(heading?.textContent).toContain("Welcome");
    el.remove();
  });

  it("navigates to the next step when the get-started button is clicked", async () => {
    const el = await createWizard();

    const nextBtn = el.querySelector<HTMLButtonElement>("#onboarding-next");
    expect(nextBtn).toBeTruthy();
    nextBtn!.click();
    await el.updateComplete;

    const heading = el.querySelector(".ocl-wizard-heading");
    expect(heading?.textContent).toContain("Open a Repository");
    el.remove();
  });

  it("calls onOpenRepo when choosing folder in open-repo step", async () => {
    const onOpenRepo = vi.fn().mockResolvedValue("/some/path");
    const el = await createWizard();
    el.onOpenRepo = onOpenRepo;

    // Navigate to step 1 (open-repo)
    const nextBtn = el.querySelector<HTMLButtonElement>("#onboarding-next");
    nextBtn!.click();
    await el.updateComplete;

    // Click "Choose Folder"
    const pickBtn = el.querySelector<HTMLButtonElement>("#onboarding-pick-folder");
    expect(pickBtn).toBeTruthy();
    pickBtn!.click();

    expect(onOpenRepo).toHaveBeenCalledTimes(1);
    el.remove();
  });

  it("skips the folder step when skip is clicked", async () => {
    const el = await createWizard();

    // Navigate to step 1 (open-repo)
    const nextBtn = el.querySelector<HTMLButtonElement>("#onboarding-next");
    nextBtn!.click();
    await el.updateComplete;

    // Click "Skip"
    const skipBtn = el.querySelector<HTMLButtonElement>(
      "#onboarding-skip-folder",
    );
    expect(skipBtn).toBeTruthy();
    skipBtn!.click();
    await el.updateComplete;

    // Should be on config-ai step
    const heading = el.querySelector(".ocl-wizard-heading");
    expect(heading?.textContent).toContain("Configure AI");
    el.remove();
  });

  it("calls onSaveApiKey when saving key in config-ai step", async () => {
    const onSaveApiKey = vi.fn().mockResolvedValue(undefined);
    const el = await createWizard();
    el.onSaveApiKey = onSaveApiKey;

    // Advance to open-repo step then skip to config-ai
    let nextBtn = el.querySelector<HTMLButtonElement>("#onboarding-next");
    nextBtn!.click();
    await el.updateComplete;
    const skipFolder = el.querySelector<HTMLButtonElement>(
      "#onboarding-skip-folder",
    );
    skipFolder!.click();
    await el.updateComplete;

    // Fill in the API key
    const keyInput = el.querySelector<HTMLInputElement>("#onboarding-api-key");
    if (keyInput) {
      keyInput.value = "sk-ant-test123";
      keyInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const saveBtn = el.querySelector<HTMLButtonElement>("#onboarding-save-key");
    expect(saveBtn).toBeTruthy();
    saveBtn!.click();

    await vi.waitFor(() => {
      expect(onSaveApiKey).toHaveBeenCalledWith(
        "anthropic",
        "sk-ant-test123",
      );
    });
    el.remove();
  });

  it("sends the example prompt when send-prompt is clicked", async () => {
    const onSendPrompt = vi.fn();
    const el = await createWizard();
    el.onSendPrompt = onSendPrompt;

    // Advance through all steps to reach first-prompt
    let nextBtn = el.querySelector<HTMLButtonElement>("#onboarding-next");
    nextBtn!.click();
    await el.updateComplete;
    let skipBtn = el.querySelector<HTMLButtonElement>(
      "#onboarding-skip-folder",
    );
    skipBtn!.click();
    await el.updateComplete;
    let skipKey = el.querySelector<HTMLButtonElement>("#onboarding-skip-key");
    skipKey!.click();
    await el.updateComplete;

    // Now on first-prompt step
    const sendBtn = el.querySelector<HTMLButtonElement>(
      "#onboarding-send-prompt",
    );
    expect(sendBtn).toBeTruthy();
    sendBtn!.click();

    expect(onSendPrompt).toHaveBeenCalledTimes(1);
    expect(onSendPrompt.mock.calls[0]![0]).toContain("architecture");
    el.remove();
  });

  it("dispatches onboarding-completed event when finishing", async () => {
    const el = await createWizard();

    const handler = vi.fn();
    el.addEventListener("onboarding-completed", handler);

    // Advance through all steps
    let nextBtn = el.querySelector<HTMLButtonElement>("#onboarding-next");
    nextBtn!.click();
    await el.updateComplete;
    let skipBtn = el.querySelector<HTMLButtonElement>(
      "#onboarding-skip-folder",
    );
    skipBtn!.click();
    await el.updateComplete;
    let skipKey = el.querySelector<HTMLButtonElement>("#onboarding-skip-key");
    skipKey!.click();
    await el.updateComplete;
    let writeOwn = el.querySelector<HTMLButtonElement>("#onboarding-write-own");
    writeOwn!.click();
    await el.updateComplete;

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].type).toBe("onboarding-completed");
    expect(el.active).toBe(false);
    el.remove();
  });

  it("dispatches onboarding-skipped event when clicking skip all", async () => {
    const el = await createWizard();

    const handler = vi.fn();
    el.addEventListener("onboarding-skipped", handler);

    const skipAll = el.querySelector<HTMLButtonElement>(
      "#onboarding-skip-all",
    );
    expect(skipAll).toBeTruthy();
    skipAll!.click();
    await el.updateComplete;

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].type).toBe("onboarding-skipped");
    expect(el.active).toBe(false);
    el.remove();
  });

  it("resets currentStepIndex when re-activated after completion", async () => {
    const el = await createWizard();

    // Skip
    const skipAll = el.querySelector<HTMLButtonElement>(
      "#onboarding-skip-all",
    );
    skipAll!.click();
    await el.updateComplete;
    expect(el.active).toBe(false);

    // Re-activate: should start at step 0 again
    el.active = true;
    await el.updateComplete;
    const heading = el.querySelector(".ocl-wizard-heading");
    expect(heading?.textContent).toContain("Welcome");
    el.remove();
  });
});
