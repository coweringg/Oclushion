export type SkillpackRole =
  | "fullstack-node"
  | "security-auditor"
  | "nextjs-app-router"
  | "postgres-dba"
  | "devops"
  | "architect"
  | "qa"
  | "documentation";

export type SkillpackPlanTier = "Free" | "Pro" | "Team" | "Enterprise";

export type SkillpackOutputFormat = {
  style: "concise" | "review-first" | "implementation-first";
  sections: string[];
  requiresTestsSummary: boolean;
};

export type Skillpack = {
  id: string;
  name: string;
  version: string;
  role: SkillpackRole;
  planTier: SkillpackPlanTier;
  description: string;
  systemRules: string[];
  forbiddenPatterns: string[];
  requiredPractices: string[];
  outputFormat: SkillpackOutputFormat;
  contextDirectives: string[];
};

export type InstalledSkillpack = {
  skillpack: Skillpack;
  state: "active" | "installed" | "locked";
};

export type MarketplaceSkillpack = Skillpack & {
  author: string;
  category: "official" | "community" | "enterprise";
  installState: "available" | "installed" | "downloading" | "update_available";
  sha256?: string;
  hmac?: string;
};
