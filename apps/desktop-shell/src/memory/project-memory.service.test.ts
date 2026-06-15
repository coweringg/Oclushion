import { describe, expect, it } from "vitest";

import { MemoryKeyValueStore } from "../persistent-store";
import { ProjectMemoryService } from "./project-memory.service";

describe("ProjectMemoryService", () => {
  it("learns durable project facts and renders prompt context", async () => {
    const store = new MemoryKeyValueStore();
    const memory = await ProjectMemoryService.create(store);

    await memory.learnFromText("Siempre usa Zod para validacion de inputs. Prefer Fastify services.", "user");
    const restored = await ProjectMemoryService.create(store);
    const hits = await restored.search("Zod");
    const context = await restored.buildPromptContext("Zod");

    expect(hits.some((entry) => entry.content.includes("Zod"))).toBe(true);
    expect(context).toContain("<project_memory>");
    expect(context).toContain("Zod");
  });
});
