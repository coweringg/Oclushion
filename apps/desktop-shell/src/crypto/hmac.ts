import { secureKeysService } from "../llm/secure-keys.service";

const keyCache = new Map<string, string>();

export async function getHmacKey(keyId: string): Promise<string> {
  const cached = keyCache.get(keyId);
  if (cached) {
    return cached;
  }
  const key = await secureKeysService.getOrCreateKey("hmac", keyId);
  keyCache.set(keyId, key);
  return key;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export async function hmacSha256(data: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const dataBytes = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
  return bytesToHex(new Uint8Array(signature));
}

function sha256Sync(data: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const bitLen = data.length * 8;
  const padLen = (data.length + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const dv = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  dv.setUint32(padLen - 4, bitLen >>> 0, false);

  for (let offset = 0; offset < padLen; offset += 64) {
    const W = new Array<number>(64);
    for (let t = 0; t < 16; t += 1) {
      W[t] = dv.getUint32(offset + t * 4, false);
    }
    for (let t = 16; t < 64; t += 1) {
      const w15 = W[t - 15]!;
      const w2 = W[t - 2]!;
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[t] = ((W[t - 16]! + s0 + W[t - 7]! + s1) | 0) as number;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let t = 0; t < 64; t += 1) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const wt = W[t]!;
      const kt = K[t]!;
      const temp1 = (hh + S1 + ch + kt + wt) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + hh) | 0;
  }

  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer, result.byteOffset, result.byteLength);
  rv.setUint32(0, h0, false); rv.setUint32(4, h1, false);
  rv.setUint32(8, h2, false); rv.setUint32(12, h3, false);
  rv.setUint32(16, h4, false); rv.setUint32(20, h5, false);
  rv.setUint32(24, h6, false); rv.setUint32(28, h7, false);
  return result;
}

export function hmacSha256Sync(data: string, key: string): string {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  const dataBytes = encoder.encode(data);

  const blockLen = 64;
  let keyArr = keyBytes;
  if (keyArr.length > blockLen) {
    keyArr = new Uint8Array(sha256Sync(keyBytes).slice(0, blockLen));
  }

  if (keyArr.length < blockLen) {
    const padded = new Uint8Array(blockLen);
    padded.set(keyArr);
    keyArr = padded;
  }

  const ipad = new Uint8Array(blockLen);
  const opad = new Uint8Array(blockLen);
  for (let i = 0; i < blockLen; i += 1) {
    ipad[i] = (keyArr[i] ?? 0) ^ 0x36;
    opad[i] = (keyArr[i] ?? 0) ^ 0x5c;
  }

  const innerData = new Uint8Array(blockLen + dataBytes.length);
  innerData.set(ipad);
  innerData.set(dataBytes, blockLen);

  const innerHash = sha256Sync(innerData);

  const outerData = new Uint8Array(blockLen + innerHash.length);
  outerData.set(opad);
  outerData.set(innerHash, blockLen);

  return bytesToHex(sha256Sync(outerData));
}

export async function verifyHmac(
  data: string,
  expectedHmac: string,
  keyId: string,
): Promise<boolean> {
  const key = await getHmacKey(keyId);
  const actual = await hmacSha256(data, key);
  return constantTimeEqual(actual.toLowerCase(), expectedHmac.toLowerCase());
}

export async function computeHmac(
  data: string,
  keyId: string,
): Promise<string> {
  const key = await getHmacKey(keyId);
  return hmacSha256(data, key);
}

export function verifyHmacSync(
  data: string,
  expectedHmac: string,
  keyId: string,
): boolean {
  const key = keyCache.get(keyId);
  if (!key) {
    return false;
  }
  const actual = hmacSha256Sync(data, key);
  return constantTimeEqual(actual.toLowerCase(), expectedHmac.toLowerCase());
}

export function computeHmacSync(data: string, keyId: string): string | null {
  const key = keyCache.get(keyId);
  if (!key) {
    return null;
  }
  return hmacSha256Sync(data, key);
}
