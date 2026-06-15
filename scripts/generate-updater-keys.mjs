import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const OUT_DIR = resolve(import.meta.dirname, "..", "secrets");

function main() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const privDer = privateKey.replace(/-----BEGIN.*?-----/, "")
    .replace(/-----END.*?-----/, "")
    .replace(/\s/g, "");
  const pubDer = publicKey.replace(/-----BEGIN.*?-----/, "")
    .replace(/-----END.*?-----/, "")
    .replace(/\s/g, "");
  const pubBytes = Buffer.from(pubDer, "base64");
  const rawPubKey = pubBytes.slice(-32).toString("hex");

  writeFileSync(join(OUT_DIR, "updater-private.key"), privateKey, { mode: 0o600 });
  writeFileSync(join(OUT_DIR, "updater-public.key"), publicKey, { mode: 0o644 });
  writeFileSync(join(OUT_DIR, "updater-pubkey.hex"), rawPubKey, { mode: 0o644 });

  console.log("Ed25519 keypair generated for Tauri updater.");
  console.log("");
  console.log("Private key: secrets/updater-private.key  (KEEP SECRET — add to .gitignore)");
  console.log("Public key:  secrets/updater-public.key");
  console.log("");
  console.log("Add to tauri.conf.json > plugins.updater.pubkey:");
  console.log(rawPubKey);
  console.log("");
  console.log("Add to CI/CD as TAURI_SIGNING_PRIVATE_KEY (base64 DER):");
  console.log(privDer);
}

main();
