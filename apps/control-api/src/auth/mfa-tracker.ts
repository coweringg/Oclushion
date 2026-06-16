import { Redis } from "ioredis";

const MFA_SETUP_TTL_SECONDS = 300;
const MFA_TRACKER_KEY_PREFIX = "mfa-setup:";

export interface MfaSetupTracker {
  isInProgress(userId: string): Promise<boolean>;
  markInProgress(userId: string): Promise<void>;
  close?(): Promise<void>;
}

export function createMfaSetupTracker(redisUrl?: string): MfaSetupTracker {
  const url = redisUrl ?? process.env.REDIS_URL;
  if (url) {
    return new RedisMfaSetupTracker(url);
  }
  return new InMemoryMfaSetupTracker();
}

class InMemoryMfaSetupTracker implements MfaSetupTracker {
  private readonly state = new Map<string, number>();

  async isInProgress(userId: string): Promise<boolean> {
    const ts = this.state.get(userId);
    if (ts === undefined) return false;
    if (Date.now() - ts > MFA_SETUP_TTL_SECONDS * 1000) {
      this.state.delete(userId);
      return false;
    }
    return true;
  }

  async markInProgress(userId: string): Promise<void> {
    this.state.set(userId, Date.now());
  }

  async close(): Promise<void> {
    this.state.clear();
  }
}

class RedisMfaSetupTracker implements MfaSetupTracker {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    this.redis.on("error", () => {});
  }

  async isInProgress(userId: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(`${MFA_TRACKER_KEY_PREFIX}${userId}`);
      return exists === 1;
    } catch {
      return false;
    }
  }

  async markInProgress(userId: string): Promise<void> {
    try {
      await this.redis.setex(`${MFA_TRACKER_KEY_PREFIX}${userId}`, MFA_SETUP_TTL_SECONDS, "1");
    } catch {
    }
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => {});
  }
}
