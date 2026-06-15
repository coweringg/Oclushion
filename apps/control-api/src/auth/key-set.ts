import { createHmac, timingSafeEqual } from "node:crypto";

export type SigningKey = { kid: string; secret: Buffer };

export class KeySet {
  private readonly keys: SigningKey[];

  constructor(keys: SigningKey[]) {
    if (!keys.length) throw new Error("KeySet requires at least one signing key");
    this.keys = keys;
  }

  static fromSerialized(input: string): KeySet {
    const keys: SigningKey[] = [];
    for (const entry of input.split(",")) {
      const colon = entry.indexOf(":");
      if (colon === -1) {
        keys.push({ kid: "default", secret: Buffer.from(entry, "utf8") });
      } else {
        const kid = entry.slice(0, colon);
        const secretBase64 = entry.slice(colon + 1);
        keys.push({ kid, secret: Buffer.from(secretBase64, "base64") });
      }
    }
    return new KeySet(keys);
  }

  static fromSecret(secret: string): KeySet {
    return new KeySet([{ kid: "default", secret: Buffer.from(secret, "utf8") }]);
  }

  get current(): SigningKey {
    return this.keys[0]!;
  }

  getByKid(kid: string): SigningKey | undefined {
    return this.keys.find((k) => k.kid === kid);
  }

  sign(headerPayload: string): string {
    return createHmac("sha256", this.current.secret).update(headerPayload).digest("base64url");
  }

  verify(header: string, payload: string, signature: string): boolean {
    const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString());
    const kid: string = parsedHeader.kid ?? "default";
    const key = this.getByKid(kid);
    if (!key) return false;
    const expected = createHmac("sha256", key.secret).update(`${header}.${payload}`).digest();
    const supplied = Buffer.from(signature, "base64url");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }
}
