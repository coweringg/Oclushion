import { readTextFile } from "@tauri-apps/plugin-fs";

import type { ModelRouter } from "../llm/model-router";
import type { RepoScanResult } from "../repo-scanner";
import { SanoShield } from "../sano-shield.service";
import { buildPromptEnhancerSystemPrompt } from "./prompt-enhancer.prompt";

export type PromptEnhancerFileReader = (path: string) => Promise<string>;

export class PromptEnhancerService {
  public constructor(
    private readonly modelRouter: Pick<ModelRouter, "generate" | "stream">,
    private readonly shield: SanoShield,
    private readonly readFile: PromptEnhancerFileReader = readTextFile,
  ) {}

  public async enhance(input: {
    basicPrompt: string;
    repo: RepoScanResult;
    model: string;
    activeFilePath?: string;
  }): Promise<string> {
    const cleanPrompt = input.basicPrompt.trim();
    if (!cleanPrompt) {
      throw new Error("Cannot enhance an empty prompt.");
    }
    const fileContext = input.activeFilePath ? await this.getFileSignature(input.activeFilePath) : "";
    const systemPrompt = buildPromptEnhancerSystemPrompt({
      technologyContext: this.detectProjectStack(input.repo),
      fileContext,
    });
    const shielded = this.shield.sanitize(cleanPrompt);
    const response = await this.modelRouter.generate({
      model: input.model,
      systemPrompt,
      userMessage: shielded.sanitizedText,
      messages: [{ role: "user", content: shielded.sanitizedText }],
    });
    const restored = this.shield.restore(response.content, shielded.mappings).trim();
    return ensureStructuredPrompt(restored, cleanPrompt);
  }

  private detectProjectStack(repo: RepoScanResult): string {
    return [
      `Language: ${repo.detectedLanguage}`,
      `Framework: ${repo.detectedFramework ?? "unknown"}`,
      `Monorepo: ${repo.isMonorepo}`,
      `Packages: ${repo.packages.join(", ") || "none detected"}`,
      `Tests: ${repo.hasTests ? "available" : "not detected"}`,
    ].join("\n");
  }

  private async getFileSignature(path: string): Promise<string> {
    const content = await this.readFile(path);
    return content.split("\n").slice(0, 100).join("\n");
  }
}

function ensureStructuredPrompt(output: string, original: string): string {
  if (/^#\s+Requerimiento:/u.test(output)) {
    return output;
  }
  return [
    `# Requerimiento: ${original.slice(0, 90)}`,
    "",
    "## Objetivo",
    output || original,
    "",
    "## Archivos Afectados",
    "- Pendiente de inferir desde el contexto activo del repositorio.",
    "",
    "## Instrucciones Tecnicas",
    "- Implementar con tipado estricto y respetando la arquitectura existente.",
    "",
    "## Casos de Borde",
    "- Validar estados de error, carga y datos incompletos.",
    "",
    "## Pruebas Requeridas",
    "- Agregar o actualizar tests unitarios/integracion segun el alcance.",
  ].join("\n");
}
