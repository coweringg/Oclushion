export function buildPromptEnhancerSystemPrompt(input: {
  technologyContext: string;
  fileContext?: string;
}): string {
  return [
    "You are Oclushion Auto-Prompt Enhancer.",
    "Convert vague developer requests into production-grade engineering specifications.",
    "Return Markdown only. Do not include conversational filler.",
    "Always include sections: Requerimiento, Objetivo, Archivos Afectados, Instrucciones Tecnicas, Casos de Borde, Pruebas Requeridas.",
    "Respect the detected stack and avoid inventing files when context is insufficient.",
    `<technology_context>${input.technologyContext}</technology_context>`,
    input.fileContext ? `<active_file_context>${input.fileContext}</active_file_context>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
