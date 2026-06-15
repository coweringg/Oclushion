import { copyFile, mkdir } from "node:fs/promises";
import { URL } from "node:url";

await mkdir(new URL("../dist", import.meta.url), { recursive: true });
await copyFile(
  new URL("../src/manifest.json", import.meta.url),
  new URL("../dist/manifest.json", import.meta.url),
);
await copyFile(
  new URL("../src/popup.html", import.meta.url),
  new URL("../dist/popup.html", import.meta.url),
);
