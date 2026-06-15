export type GodModeScope = "project-only" | "unrestricted";

export type GodModeSession = {
  isActive: boolean;
  grantedAt?: string;
  expiresAt?: string;
  scope: GodModeScope;
};

export class GodModeStore {
  private session: GodModeSession = { isActive: false, scope: "project-only" };

  public get(): GodModeSession {
    if (this.session.isActive && this.session.expiresAt && Date.now() > Date.parse(this.session.expiresAt)) {
      this.disable();
    }
    return { ...this.session };
  }

  public enable(scope: GodModeScope, ttlMs = 15 * 60 * 1000): GodModeSession {
    const now = Date.now();
    this.session = {
      isActive: true,
      scope,
      grantedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };
    return this.get();
  }

  public disable(): GodModeSession {
    this.session = { isActive: false, scope: "project-only" };
    return this.get();
  }
}
