# @oclushion/sano-shield-sdk

Cliente TypeScript ligero para enviar solicitudes OpenAI o Anthropic a traves del proxy Sano.

```ts
import { SanoClient } from "@oclushion/sano-shield-sdk";

const sano = new SanoClient({
  baseUrl: "https://proxy.example.com",
  apiKey: process.env.SANO_API_KEY!,
  providerApiKey: process.env.OPENAI_API_KEY!,
});

const completion = await sano.openai.chat.completions.create({
  model: process.env.OPENAI_MODEL!,
  messages: [{ role: "user", content: "Escribe a juan@example.com" }],
});
```

La clave Sano viaja en `x-sano-api-key`; la clave del proveedor se reenvia exclusivamente al
upstream seleccionado. El SDK no almacena ni registra contenidos o credenciales.
