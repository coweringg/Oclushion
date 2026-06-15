declare const chrome: {
  runtime: {
    onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: unknown) => void,
        ) => boolean | void,
      ): void;
    };
    sendMessage(message: unknown): Promise<unknown>;
  };
  storage: {
    local: {
      get<T extends Record<string, unknown>>(keys: string[]): Promise<Partial<T>>;
      set(values: Record<string, unknown>): Promise<void>;
    };
  };
};
