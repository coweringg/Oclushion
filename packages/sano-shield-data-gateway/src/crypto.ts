import { createCipheriv, createHash, randomBytes } from "node:crypto";

export function resolveEncryptionKey(source: string) {
  const decoded = Buffer.from(source, "base64");
  if (decoded.length === 32) {
    return decoded;
  }
  return createHash("sha256").update(source).digest();
}

export function encryptValue(plaintext: string, aad: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}
