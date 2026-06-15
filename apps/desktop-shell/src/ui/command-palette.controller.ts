import { CommandPaletteRenderer } from "./renderers/command-palette.renderer";
import type { VoiceCaptureService } from "../voice/voice-capture.service";
import type { IntentRouter } from "../agents/intent-router";
import { showToast } from "./toast";

export class CommandPaletteController {
  private readonly renderer = new CommandPaletteRenderer();
  private isOpen = false;
  private isRecording = false;

  public constructor(
    private readonly voiceCapture?: VoiceCaptureService,
    private readonly intentRouter?: IntentRouter
  ) {}

  public mount(root: HTMLElement): void {
    const mount = document.createElement("div");
    mount.id = "command-palette-root";
    root.appendChild(mount);
    this.renderer.render(mount);
    this.attachEvents();
  }

  private attachEvents(): void {
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    });

    document.addEventListener("click", (e) => {
      const overlay = document.getElementById("command-palette-overlay");
      if (this.isOpen && e.target === overlay) {
        this.close();
      }
    });

    document.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id === "command-palette-input") {
        const results = document.getElementById("command-palette-results");
        if (results) {
          const filtered = this.renderer.filterCommands(target.value);
          results.innerHTML = this.renderer.renderItems(filtered);
        }
      }
    });

    document.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(".ocl-command-item");
      if (item) {
        const commandId = item.getAttribute("data-command-id");
        if (commandId) {
          this.executeCommand(commandId);
          this.close();
        }
      }
    });
  }

  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    this.isOpen = true;
    const overlay = document.getElementById("command-palette-overlay");
    const input = document.getElementById("command-palette-input") as HTMLInputElement;
    if (overlay) overlay.classList.add("open");
    if (input) {
      input.value = "";
      input.focus();
    }
    const results = document.getElementById("command-palette-results");
    if (results) {
      results.innerHTML = this.renderer.renderItems(this.renderer.filterCommands(""));
    }
  }

  private close(): void {
    this.isOpen = false;
    const overlay = document.getElementById("command-palette-overlay");
    if (overlay) overlay.classList.remove("open");
  }

  private async executeCommand(id: string): Promise<void> {
    if (id === "start-voice" && this.voiceCapture && this.intentRouter) {
      await this.handleVoiceCommand();
      return;
    }
    const event = new CustomEvent("ocl-command", { detail: { commandId: id } });
    document.dispatchEvent(event);
  }

  private async handleVoiceCommand(): Promise<void> {
    if (!this.voiceCapture || !this.intentRouter) return;

    if (this.isRecording) {
      try {
        const audio = await this.voiceCapture.stopRecording();
        this.isRecording = false;
        showToast({ message: "Procesando voz...", severity: "info" });
        const text = await this.voiceCapture.transcribe(audio);
        const decision = await this.intentRouter.route(text);
        showToast({ message: `Intención: ${decision.intent} — ${decision.actionPayload}`, severity: "success" });
      } catch (err) {
        this.isRecording = false;
        showToast({ message: "Error en Voice Capture", severity: "error" });
      }
    } else {
      try {
        await this.voiceCapture.startRecording();
        this.isRecording = true;
        showToast({ message: "🎤 Grabando... — Vuelve a ejecutar el comando para detener", severity: "info" });
      } catch (err) {
        showToast({ message: "Microfono no disponible", severity: "error" });
      }
    }
  }
}
