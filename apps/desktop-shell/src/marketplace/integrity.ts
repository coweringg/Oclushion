export async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = normalizeBytes(input);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function assertSha256(
  input: string | ArrayBuffer | Uint8Array,
  expectedSha256: string,
  label: string,
): Promise<string> {
  const actual = await sha256Hex(input);
  if (!constantTimeEqual(actual.toLowerCase(), expectedSha256.toLowerCase())) {
    throw new Error(`Integrity check failed for ${label}. Expected ${expectedSha256}, got ${actual}.`);
  }
  return actual;
}

function normalizeBytes(input: string | ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  if (typeof input === "string") {
    return new TextEncoder().encode(input);
  }
  if (input instanceof Uint8Array) {
    return new Uint8Array(input);
  }
  return new Uint8Array(input);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}
