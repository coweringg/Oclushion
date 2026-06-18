export type MarketplacePlanTier = "free" | "pro" | "enterprise";

export type UserTier = "free" | "pro" | "team" | "enterprise";

export type SkillCategory =
  | "fullstack"
  | "frontend"
  | "backend"
  | "devops"
  | "security"
  | "data"
  | "design"
  | "mobile"
  | "architecture"
  | "ai-ml"
  | "ai"
  | "testing"
  | "productivity"
  | "research"
  | "documentation"
  | "code-review"
  | "game-development"
  | "media";

export type MarketplaceItemType = "skill" | "template" | "agent" | "theme";

export type MarketplaceItem = {
  id: string;
  name: string;
  description: string;
  type?: MarketplaceItemType;
  category: SkillCategory;
  tier: MarketplacePlanTier;
  version: string;
  downloadUrl: string;
  sha256: string;
  sizeKb: number;
  keywords: string[];
  previewLines: string[];
  author?: string;
  priceUsd?: number;
  rating?: number;
  revenueShare?: number;
  
  allowedTiers?: MarketplacePlanTier[];
  organizationId?: string;
};

export type Skill = MarketplaceItem;

export type InstalledSkill = {
  id: string;
  version: string;
  category: SkillCategory;
  contentPath: string;
  sha256: string;
  installedAt: string;
  updatedAt: string;
};

export type ToolPlatform = "windows" | "macos" | "linux" | "all";

export type AiTool = {
  id: string;
  name: string;
  description: string;
  version: string;
  downloadUrl: string;
  platform: ToolPlatform;
  requiredBin: string;
  gitignoreEntry: ".oclushion-tools/";
  sha256: string;
};

export type InstalledTool = {
  id: string;
  version: string;
  platform: ToolPlatform;
  binPath: string;
  sha256: string;
  installedAt: string;
};

export type MarketplaceCatalog = {
  skills: Skill[];
  tools: AiTool[];
};

export type SkillInstallState = "available" | "installed" | "update_available" | "locked" | "locked_requires_purchase";

export type LockResult = {
  locked: boolean;
  requiredTier?: MarketplacePlanTier;
  reason?: string;
  upgradeLabel?: string;
};

export type MarketplaceSkillView = Skill & {
  installState: SkillInstallState;
  lockResult?: LockResult;
};

export type MarketplaceToolView = AiTool & {
  installState: Exclude<SkillInstallState, "locked">;
};

export type WorkProfileId = "fullstack" | "frontend" | "backend" | "data" | "security";

export type WorkProfile = {
  id: WorkProfileId;
  name: string;
  description: string;
  coreSkillIds: string[];
};

export type SuggestedSkill = {
  skill: Skill;
  reason: string;
  confidence: number;
  matchedKeywords: string[];
};

export type MarketplaceSnapshot = {
  skills: MarketplaceSkillView[];
  tools: MarketplaceToolView[];
  installedSkills: InstalledSkill[];
  installedTools: InstalledTool[];
};

export type InstallationStep = "downloading" | "verifying" | "writing" | "activating";

export type InstallationTaskStatus = "pending" | "active" | "completed" | "failed" | "cancelled";

export type InstallationTask = {
  id: string;
  name: string;
  version: string;
  step: InstallationStep;
  status: InstallationTaskStatus;
  progress: number;
  error?: string;
};

export type InstallationProgress = {
  id: string;
  title: string;
  tasks: InstallationTask[];
  totalProgress: number;
  status: "installing" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
};
