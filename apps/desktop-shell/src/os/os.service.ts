import { logger } from "../utils/logger";
import type {
  BrowserTab,
  BrowserHistory,
  MockupBoard,
  MockupElement,
  ChatChannel,
  ChatMessage,
  LiveDoc,
  AnalyticsDashboard,
  AnalyticsMetric,
  OclushionOSSnapshot,
  OSNotification,
  NotificationSettings,
} from "./os.types";

type OSListener = (snapshot: OclushionOSSnapshot) => void;

export class OclushionOSService {
  private tabs: BrowserTab[] = [];
  private history: BrowserHistory[] = [];
  private mockups: MockupBoard[] = [];
  private channels: ChatChannel[] = [];
  private messages: ChatMessage[] = [];
  private docs: LiveDoc[] = [];
  private analytics: AnalyticsDashboard | null = null;
  
  private notifications: OSNotification[] = [];
  private notifSettings: NotificationSettings = {
    muteLow: false,
    muteMedium: false,
    adminWatchMode: false,
  };
  
  private readonly listeners = new Set<OSListener>();

  constructor() {
    this.channels = [
      { id: "ch-general", name: "#general", type: "general", members: [], unreadCount: 0 },
      { id: "ch-ai-feed", name: "#ai-activity", type: "ai-feed", members: [], unreadCount: 0 },
    ];
  }

  public openTab(url: string, title?: string): BrowserTab {
    this.tabs = this.tabs.map((t) => ({ ...t, isActive: false }));

    const tab: BrowserTab = {
      id: `tab-${Date.now()}`,
      url,
      title: title ?? url,
      isActive: true,
      isLoading: true,
      openedAt: new Date().toISOString(),
    };
    this.tabs.push(tab);
    this.history.push({ url, title: tab.title, visitedAt: tab.openedAt });

    setTimeout(() => {
      this.tabs = this.tabs.map((t) => (t.id === tab.id ? { ...t, isLoading: false } : t));
      this.emit();
    }, 800);

    logger.info("OclushionOS", `Browser: opened tab "${tab.title}" → ${url}`);
    this.emit();
    return tab;
  }

  public closeTab(tabId: string): void {
    const wasActive = this.tabs.find((t) => t.id === tabId)?.isActive;
    this.tabs = this.tabs.filter((t) => t.id !== tabId);
    if (wasActive && this.tabs.length > 0) {
      this.tabs[this.tabs.length - 1]!.isActive = true;
    }
    this.emit();
  }

  public switchTab(tabId: string): void {
    this.tabs = this.tabs.map((t) => ({ ...t, isActive: t.id === tabId }));
    this.emit();
  }

  public navigateTab(tabId: string, url: string): void {
    this.tabs = this.tabs.map((t) =>
      t.id === tabId ? { ...t, url, isLoading: true } : t,
    );
    this.history.push({ url, title: url, visitedAt: new Date().toISOString() });
    setTimeout(() => {
      this.tabs = this.tabs.map((t) => (t.id === tabId ? { ...t, isLoading: false } : t));
      this.emit();
    }, 600);
    this.emit();
  }

  public createMockup(name: string, linkedFiles?: string[]): MockupBoard {
    const board: MockupBoard = {
      id: `mockup-${Date.now()}`,
      name,
      elements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      linkedFiles,
    };
    this.mockups.push(board);
    logger.info("OclushionOS", `Mockup: created board "${name}"`);
    this.emit();
    return board;
  }

  public addMockupElement(boardId: string, element: Omit<MockupElement, "id">): MockupElement {
    const full: MockupElement = { ...element, id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    this.mockups = this.mockups.map((b) =>
      b.id === boardId
        ? { ...b, elements: [...b.elements, full], updatedAt: new Date().toISOString() }
        : b,
    );
    this.emit();
    return full;
  }

  public deleteMockup(boardId: string): void {
    this.mockups = this.mockups.filter((b) => b.id !== boardId);
    this.emit();
  }

  public sendMessage(channelId: string, authorId: string, authorName: string, content: string, authorType: "human" | "agent" = "human"): ChatMessage {
    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      channelId,
      authorId,
      authorName,
      authorType,
      content,
      timestamp: new Date().toISOString(),
    };
    this.messages.push(message);

    this.channels = this.channels.map((ch) =>
      ch.id === channelId ? { ...ch, unreadCount: ch.unreadCount + 1 } : ch,
    );

    this.emit();
    return message;
  }

  public createChannel(name: string, type: ChatChannel["type"] = "project"): ChatChannel {
    const channel: ChatChannel = {
      id: `ch-${Date.now()}`,
      name: `#${name}`,
      type,
      members: [],
      unreadCount: 0,
    };
    this.channels.push(channel);
    this.emit();
    return channel;
  }

  public markChannelRead(channelId: string): void {
    this.channels = this.channels.map((ch) =>
      ch.id === channelId ? { ...ch, unreadCount: 0 } : ch,
    );
    this.emit();
  }

  public getChannelMessages(channelId: string): ChatMessage[] {
    return this.messages.filter((m) => m.channelId === channelId);
  }

  public registerDoc(doc: Omit<LiveDoc, "id" | "lastSyncedAt">): LiveDoc {
    const full: LiveDoc = {
      ...doc,
      id: `doc-${Date.now()}`,
      lastSyncedAt: new Date().toISOString(),
    };
    this.docs.push(full);
    logger.info("OclushionOS", `Docs: registered "${full.title}"`);
    this.emit();
    return full;
  }

  public markDocStale(docId: string, reason: string): void {
    this.docs = this.docs.map((d) =>
      d.id === docId ? { ...d, staleWarning: reason } : d,
    );
    this.emit();
  }

  public syncDoc(docId: string, newContent: string): void {
    this.docs = this.docs.map((d) =>
      d.id === docId
        ? { ...d, content: newContent, lastSyncedAt: new Date().toISOString(), staleWarning: undefined }
        : d,
    );
    this.emit();
  }

  public updateAnalytics(projectId: string, metrics: AnalyticsMetric[], extras?: { activeUsers?: number; errorRate?: number; p95Latency?: number }): void {
    this.analytics = {
      projectId,
      lastUpdated: new Date().toISOString(),
      metrics,
      ...extras,
    };
    logger.info("OclushionOS", `Analytics: updated ${metrics.length} metrics for ${projectId}`);
    this.emit();
  }

  public pushNotification(notification: Omit<OSNotification, "id" | "timestamp" | "isRead">): OSNotification | null {
    if (this.notifSettings.muteLow && notification.severity === "low") return null;
    if (this.notifSettings.muteMedium && notification.severity === "medium") return null;

    const fullNotif: OSNotification = {
      ...notification,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      isRead: false,
    };
    
    this.notifications = [fullNotif, ...this.notifications].slice(0, 100);
    logger.info("OclushionOS", `Notification received: [${fullNotif.severity}] ${fullNotif.title}`);
    this.emit();
    return fullNotif;
  }

  public updateNotificationSettings(settings: Partial<NotificationSettings>): void {
    this.notifSettings = { ...this.notifSettings, ...settings };
    logger.info("OclushionOS", `Notification settings updated: ${JSON.stringify(this.notifSettings)}`);
    this.emit();
  }

  public markNotificationRead(id: string): void {
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    this.emit();
  }

  public clearAllNotifications(): void {
    this.notifications = [];
    this.emit();
  }

  public snapshot(): OclushionOSSnapshot & { notifications: OSNotification[], notificationSettings: NotificationSettings } {
    return {
      browser: {
        tabs: [...this.tabs],
        history: this.history.slice(-50),
      },
      mockups: [...this.mockups],
      chat: {
        channels: [...this.channels],
        recentMessages: this.messages.slice(-100),
      },
      docs: [...this.docs],
      analytics: this.analytics,
      notifications: [...this.notifications],
      notificationSettings: { ...this.notifSettings },
    };
  }

  public subscribe(listener: OSListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }
}
