import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSign } from "node:crypto";

const SECRETS_DIR = resolve(import.meta.dirname, "..", "secrets");

function main() {
  const archivePath = process.argv[2];
  if (!archivePath) {
    console.error("Usage: node sign-release.mjs <path-to-archive>");
    console.error("Example: node sign-release.mjs ./target/release/bundle/msi/Oclushion_1.0.1_x64_en-US.msi.zip");
    process.exit(1);
  }

  if (!existsSync(archivePath)) {
    console.error(`Archive not found: ${archivePath}`);
    process.exit(1);
  }

  const privateKey = readPrivateKey();
  const archive = readFileSync(archivePath);

  const sign = createSign("ed25519");
  sign.update(archive);
  sign.end();

  const signature = sign.sign(privateKey, "base64");
  const signatureBlock = [
    "dW50cnVzdGVkIGNvbW1lbnQ6IGxpYnJhcnkgdmVyc2lvbjogMiwgY29tbWl0OiB1cGRhdGVy",
    signature,
  ].join("\n");

  const sigPath = archivePath + ".sig";
  writeFileSync(sigPath, signatureBlock);

  console.log(`Signature written to: ${sigPath}`);
  console.log("");
  console.log("JSON update payload signature field:");
  console.log(signatureBlock);
}

function readPrivateKey() {
  const privKeyPath = resolve(SECRETS_DIR, "updater-private.key");

  if (process.env.TAURI_SIGNING_PRIVATE_KEY) {
    const b64 = process.env.TAURI_SIGNING_PRIVATE_KEY;
    const der = Buffer.from(b64, "base64");
    return `-----BEGIN PRIVATE KEY-----\n${der.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----`;
  }

  if (existsSync(privKeyPath)) {
    return readFileSync(privKeyPath, "utf-8");
  }

  console.error("No private key found. Set TAURI_SIGNING_PRIVATE_KEY or generate keys with:");
  console.error("  node scripts/generate-updater-keys.mjs");
  process.exit(1);
}

main();
