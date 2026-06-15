import { createHmac, randomBytes } from "node:crypto";

const TOTP_INTERVAL = 30;
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_BYTES = 10;

function hotp(secret: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = Number(counter & 0xffn);
    counter >>= 8n;
  }
  const hmac = createHmac("sha1", secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function totp(secret: Buffer, timestamp: number = Date.now()): string {
  const counter = BigInt(Math.floor(timestamp / 1000 / TOTP_INTERVAL));
  return hotp(secret, counter);
}

export function generateTotpSecret(): { base32: string; buffer: Buffer } {
  const buffer = randomBytes(20);
  const base32 = bufferToBase32(buffer);
  return { base32, buffer };
}

export function verifyTotpToken(token: string, secretBase32: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const secret = base32ToBuffer(secretBase32);
  const now = Date.now();
  for (let drift = -1; drift <= 1; drift++) {
    const expected = totp(secret, now + drift * TOTP_INTERVAL * 1000);
    if (token === expected) return true;
  }
  return false;
}

export function generateRecoveryCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = randomBytes(RECOVERY_CODE_BYTES)
      .toString("hex")
      .toUpperCase()
      .match(/.{1,4}/g)!
      .join("-");
    plain.push(code);
    hashed.push(hashRecoveryCode(code));
  }
  return { plain, hashed };
}

export function verifyRecoveryCode(code: string, hashedCodes: string[]): { valid: boolean; index: number } {
  const clean = code.replace(/-/g, "").toLowerCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (hashRecoveryCode(clean) === hashedCodes[i]) {
      return { valid: true, index: i };
    }
  }
  return { valid: false, index: -1 };
}

function hashRecoveryCode(code: string): string {
  return createHmac("sha256", "oclushion-recovery").update(code.toLowerCase().replace(/-/g, "")).digest("hex");
}

export function buildTotpUri(secretBase32: string, email: string, issuer = "Oclushion"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_INTERVAL}`;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function bufferToBase32(buffer: Buffer): string {
  let bits = 0;
  let bitCount = 0;
  let result = "";
  for (const byte of buffer) {
    bits = (bits << 8) | byte;
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      result += BASE32_ALPHABET[(bits >> bitCount) & 0x1f];
    }
  }
  if (bitCount > 0) {
    result += BASE32_ALPHABET[(bits << (5 - bitCount)) & 0x1f];
  }
  return result;
}

function base32ToBuffer(base32: string): Buffer {
  const cleaned = base32.replace(/[^A-Za-z2-7]/g, "").toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const char of cleaned) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      bytes.push((buffer >> bitsLeft) & 0xff);
    }
  }
  return Buffer.from(bytes);
}
