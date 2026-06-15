import { logger } from "../utils/logger";
import type {
  TeamSession,
  TeamMember,
  AgentSyncMessage,
  AgentSyncMessageType,
  AgentSyncPayload,
  ConflictAlert,
  DailyStandup,
  StandupMemberSummary,
  Organization,
  OrgRole,
  InviteLink,
  InternalReviewRequest,
  ReviewComment,
} from "./multiplayer.types";

type TeamSyncListener = (session: TeamSession) => void;

export class TeamSyncService {
  private session: TeamSession | null = null;
  private currentOrg: Organization | null = null;
  private inviteLinks: InviteLink[] = [];
  private reviews: InternalReviewRequest[] = [];
  private comments: ReviewComment[] = [];
  private messageLog: AgentSyncMessage[] = [];
  private pendingIntents: Map<string, AgentSyncMessage> = new Map(); // agentId -> intent
  private readonly listeners = new Set<TeamSyncListener>();

  public createSession(input: {
    projectId: string;
    sessionName: string;
    localMember: TeamMember;
  }): TeamSession {
    this.session = {
      id: `team-${Date.now()}`,
      projectId: input.projectId,
      name: input.sessionName,
      createdAt: new Date().toISOString(),
      members: [input.localMember],
      activeConflicts: [],
    };
    logger.info("TeamSync", `Session created: ${this.session.name} (${this.session.id})`);
    this.emit();
    return this.session;
  }

  public addMember(member: TeamMember): void {
    if (!this.session) return;
    const exists = this.session.members.some((m) => m.userId === member.userId);
    if (exists) {
      this.session = {
        ...this.session,
        members: this.session.members.map((m) =>
          m.userId === member.userId ? { ...member, lastActivityAt: new Date().toISOString() } : m,
        ),
      };
    } else {
      this.session = {
        ...this.session,
        members: [...this.session.members, member],
      };
    }
    logger.info("TeamSync", `Member joined: ${member.userName} (agent: ${member.agentId})`);
    this.emit();
  }

  public removeMember(userId: string): void {
    if (!this.session) return;
    this.session = {
      ...this.session,
      members: this.session.members.filter((m) => m.userId !== userId),
    };
    this.emit();
  }

  public announceIntent(agentId: string, userName: string, targetFiles: string[], description: string): ConflictAlert | null {
    if (!this.session) return null;

    const message: AgentSyncMessage = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: this.session.id,
      fromAgentId: agentId,
      fromUserName: userName,
      timestamp: new Date().toISOString(),
      type: "intent_announce",
      payload: { targetFiles, description },
    };

    this.messageLog.push(message);
    this.pendingIntents.set(agentId, message);

    const conflict = this.detectConflict(agentId, targetFiles);
    if (conflict) {
      this.session = {
        ...this.session,
        activeConflicts: [...this.session.activeConflicts, conflict],
      };
      this.broadcastMessage(agentId, userName, "conflict_detected", {
        description: `Conflict detected on files: ${conflict.conflictingFiles.join(", ")}`,
        conflictId: conflict.id,
        targetFiles: conflict.conflictingFiles,
      });
      logger.warn("TeamSync", `⚠️ CONFLICT: ${conflict.conflictingFiles.join(", ")} — ${conflict.agents.map(a => a.userName).join(" vs ")}`);
    }

    this.emit();
    return conflict;
  }

  public completeIntent(agentId: string, userName: string, targetFiles: string[], diff?: string): void {
    if (!this.session) return;

    this.pendingIntents.delete(agentId);
    this.broadcastMessage(agentId, userName, "intent_complete", {
      description: `Completed changes on ${targetFiles.join(", ")}`,
      targetFiles,
      diff,
    });

    this.session = {
      ...this.session,
      activeConflicts: this.session.activeConflicts.map((c) => {
        const involved = c.agents.some((a) => a.agentId === agentId);
        if (involved && c.status === "open") {
          return { ...c, status: "auto_resolved", resolution: `${userName}'s agent completed first. Other agents should rebase.` };
        }
        return c;
      }),
    };

    this.emit();
  }

  public shareKnowledge(agentId: string, userName: string, description: string): void {
    this.broadcastMessage(agentId, userName, "knowledge_share", { description });
  }

  public requestHelp(agentId: string, userName: string, description: string, targetFiles?: string[]): void {
    this.broadcastMessage(agentId, userName, "help_request", { description, targetFiles });
    logger.info("TeamSync", `🆘 Help requested by ${userName}: ${description}`);
  }

  private detectConflict(currentAgentId: string, targetFiles: string[]): ConflictAlert | null {
    if (!this.session) return null;

    for (const [otherAgentId, otherIntent] of this.pendingIntents.entries()) {
      if (otherAgentId === currentAgentId) continue;

      const otherFiles = otherIntent.payload.targetFiles ?? [];
      const overlapping = targetFiles.filter((f) => otherFiles.includes(f));

      if (overlapping.length > 0) {
        const severity = this.calculateConflictSeverity(overlapping);
        return {
          id: `conflict-${Date.now()}`,
          sessionId: this.session.id,
          detectedAt: new Date().toISOString(),
          severity,
          status: "open",
          conflictingFiles: overlapping,
          agents: [
            {
              agentId: otherAgentId,
              userName: otherIntent.fromUserName,
              intendedChange: otherIntent.payload.description,
            },
            {
              agentId: currentAgentId,
              userName: this.session.members.find((m) => m.agentId === currentAgentId)?.userName ?? "Unknown",
              intendedChange: "New intent",
            },
          ],
        };
      }
    }

    return null;
  }

  private calculateConflictSeverity(files: string[]): ConflictAlert["severity"] {
    const criticalPatterns = /(auth|billing|migration|schema|\.env|security)/iu;
    const hasCritical = files.some((f) => criticalPatterns.test(f));
    if (hasCritical) return "critical";
    if (files.length >= 3) return "high";
    if (files.length >= 2) return "medium";
    return "low";
  }

  public generateDailyStandup(): DailyStandup | null {
    if (!this.session) return null;

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentMessages = this.messageLog.filter(
      (m) => new Date(m.timestamp) >= twentyFourHoursAgo,
    );

    const memberSummaries: StandupMemberSummary[] = this.session.members.map((member) => {
      const memberMessages = recentMessages.filter((m) => m.fromAgentId === member.agentId);
      const completedIntents = memberMessages.filter((m) => m.type === "intent_complete");
      const activeIntents = memberMessages.filter((m) => m.type === "intent_announce");

      const allFiles = completedIntents.flatMap((m) => m.payload.targetFiles ?? []);
      const uniqueFiles = [...new Set(allFiles)];

      return {
        userId: member.agentId,
        userName: member.userName,
        tasksCompleted: completedIntents.map((m) => m.payload.description),
        blockers: [],
        timeStuckOnTaskMinutes: 0,
        wellbeingStatus: "excellent",
        healthScore: 100,
        aiCreditsUsed: completedIntents.length * 3,
      };
    });

    const conflicts = this.session.activeConflicts.filter(
      (c) => new Date(c.detectedAt) >= twentyFourHoursAgo,
    );

    const standup: DailyStandup = {
      id: `standup-${Date.now()}`,
      sessionId: this.session.id,
      generatedAt: now.toISOString(),
      period: {
        from: twentyFourHoursAgo.toISOString(),
        to: now.toISOString(),
      },
      memberSummaries,
      teamHighlights: [
        `${memberSummaries.reduce((sum, m) => sum + m.tasksCompleted.length, 0)} tasks completed by the team`,
        `${conflicts.length} conflicts detected (${conflicts.filter(c => c.status !== "open").length} resolved)`,
      ],
      blockers: conflicts
        .filter((c) => c.status === "open")
        .map((c) => `Unresolved conflict on ${c.conflictingFiles.join(", ")}`),
    };

    this.session = { ...this.session, lastStandup: standup };
    this.broadcastMessage("system", "Oclushion", "standup_broadcast", {
      description: standup.teamHighlights.join(" | "),
    });

    logger.info("TeamSync", `📋 Daily Standup generated: ${standup.teamHighlights[0]}`);
    this.emit();
    return standup;
  }

  public broadcastCrossRoomAwareness(
    agentId: string,
    agentName: string,
    architecturalChange: string,
    affectedApis: string[],
  ): void {
    const payload: AgentSyncPayload = {
      description: `[Cross-Room Intelligence] The ${agentName} agent has initiated an architectural change: ${architecturalChange}. Expected impact on APIs/Models: ${affectedApis.join(", ")}`,
      targetFiles: affectedApis,
    };
    
    this.broadcastMessage(agentId, agentName, "cross_room_awareness", payload);
    logger.info("TeamSync", `Cross-Room Awareness broadcasted by ${agentName}: ${architecturalChange}`);
  }

  public createOrganization(name: string, requireInternalReviews: boolean, creatorId: string): Organization {
    this.currentOrg = {
      id: `org-${Date.now()}`,
      name,
      tier: "free",
      members: [{ userId: creatorId, role: "owner" }],
      settings: { requireInternalReviews },
    };
    logger.info("TeamSync", `Organization created: ${name}`);
    return this.currentOrg;
  }

  public generateInviteLink(creatorId: string, expiresHours: number | null): InviteLink {
    if (!this.currentOrg) throw new Error("No active organization");
    const link: InviteLink = {
      code: `join-${Math.random().toString(36).slice(2, 10)}`,
      orgId: this.currentOrg.id,
      createdBy: creatorId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresHours ? new Date(Date.now() + expiresHours * 3600 * 1000).toISOString() : null,
      maxUses: null,
      uses: 0,
    };
    this.inviteLinks.push(link);
    return link;
  }

  public submitForReview(authorId: string, title: string, diff: string): InternalReviewRequest {
    if (this.currentOrg && !this.currentOrg.settings.requireInternalReviews) {
      logger.info("TeamSync", "Internal reviews disabled by org settings. Skipping.");
    }
    const req: InternalReviewRequest = {
      id: `rev-${Date.now()}`,
      projectId: this.session?.projectId ?? "unknown",
      authorId,
      title,
      diff,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.reviews.push(req);
    logger.info("TeamSync", `Review requested: ${title}`);
    return req;
  }

  public addReviewComment(reviewId: string, authorId: string, filePath: string, lineNumber: number, content: string): ReviewComment {
    const comment: ReviewComment = {
      id: `com-${Date.now()}`,
      reviewId,
      authorId,
      filePath,
      lineNumber,
      content,
      resolved: false,
      isResolvingWithAI: false,
    };
    this.comments.push(comment);
    return comment;
  }

  public triggerAIResolution(commentId: string): void {
    const commentIndex = this.comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;
    
    this.comments[commentIndex]!.isResolvingWithAI = true;
    const comment = this.comments[commentIndex]!;
    
    logger.info("TeamSync", `Triggered AI Auto-Resolve for comment: ${comment.content}`);

    this.broadcastMessage("system", "Oclushion Review", "help_request", {
      description: `Please resolve this review comment: "${comment.content}" on line ${comment.lineNumber}`,
      targetFiles: [comment.filePath],
      conflictId: comment.id, // Reusing conflictId to track the comment resolution
    });
    
    this.emit();
  }

  public getSession(): TeamSession | null {
    return this.session;
  }

  public getMessageLog(): AgentSyncMessage[] {
    return [...this.messageLog];
  }

  public getActiveConflicts(): ConflictAlert[] {
    return this.session?.activeConflicts.filter((c) => c.status === "open") ?? [];
  }

  public subscribe(listener: TeamSyncListener): () => void {
    this.listeners.add(listener);
    if (this.session) listener(this.session);
    return () => this.listeners.delete(listener);
  }

  public destroy(): void {
    this.session = null;
    this.messageLog = [];
    this.pendingIntents.clear();
    this.listeners.clear();
  }

  private broadcastMessage(
    agentId: string,
    userName: string,
    type: AgentSyncMessageType,
    payload: AgentSyncPayload,
  ): void {
    if (!this.session) return;
    const message: AgentSyncMessage = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: this.session.id,
      fromAgentId: agentId,
      fromUserName: userName,
      timestamp: new Date().toISOString(),
      type,
      payload,
    };
    this.messageLog.push(message);
  }

  private emit(): void {
    if (!this.session) return;
    const snapshot = { ...this.session };
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
