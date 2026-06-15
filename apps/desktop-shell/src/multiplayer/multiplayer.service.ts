import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

import type { CollaborationUser, MultiplayerRoom } from "./multiplayer.types";

type RoomListener = (room: MultiplayerRoom | null) => void;

export class MultiplayerService {
  private ydoc = new Y.Doc();
  private provider: WebsocketProvider | null = null;
  private room: MultiplayerRoom | null = null;
  private readonly listeners = new Set<RoomListener>();

  public constructor(private readonly localUser: CollaborationUser) {}

  public async joinRoom(input: {
    roomId: string;
    roomName?: string;
    serverUrl: string;
    encryptionKey?: string;
  }): Promise<MultiplayerRoom> {
    this.disconnect();
    this.ydoc = new Y.Doc();
    this.provider = new WebsocketProvider(input.serverUrl, input.roomId, this.ydoc);
    this.provider.awareness.setLocalStateField("user", this.localUser);
    this.room = {
      id: input.roomId,
      projectId: "default",
      name: input.roomName ?? input.roomId,
      activeUsers: [this.localUser],
      activeFilePaths: [],
      encrypted: Boolean(input.encryptionKey),
    };
    this.provider.awareness.on("change", () => this.refreshPresence());
    this.emit();
    return this.snapshot()!;
  }

  public bindFileToDoc(filePath: string): Y.Text {
    const ytext = this.ydoc.getText(filePath);
    if (this.room && !this.room.activeFilePaths.includes(filePath)) {
      this.room = { ...this.room, activeFilePaths: [...this.room.activeFilePaths, filePath] };
      this.emit();
    }
    return ytext;
  }

  public updateCursor(filePath: string, lineNumber: number, columnNumber: number): void {
    const user: CollaborationUser = {
      ...this.localUser,
      cursorPosition: { filePath, lineNumber, columnNumber },
    };
    this.provider?.awareness.setLocalStateField("user", user);
  }

  public getProvider(): WebsocketProvider | null {
    return this.provider;
  }

  public getDoc(): Y.Doc {
    return this.ydoc;
  }

  public snapshot(): MultiplayerRoom | null {
    return this.room
      ? {
          ...this.room,
          activeUsers: this.room.activeUsers.map((user) => ({ ...user })),
          activeFilePaths: [...this.room.activeFilePaths],
        }
      : null;
  }

  public subscribe(listener: RoomListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  public disconnect(): void {
    this.provider?.destroy();
    this.provider = null;
    this.room = null;
    this.ydoc.destroy();
    this.emit();
  }

  private refreshPresence(): void {
    if (!this.provider || !this.room) {
      return;
    }
    const users = [...this.provider.awareness.getStates().values()]
      .map((state) => state.user)
      .filter(isCollaborationUser);
    this.room = { ...this.room, activeUsers: users.length ? users : [this.localUser] };
    this.emit();
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function isCollaborationUser(value: unknown): value is CollaborationUser {
  const user = value as Partial<CollaborationUser>;
  return typeof user.id === "string" && typeof user.name === "string" && typeof user.color === "string";
}
