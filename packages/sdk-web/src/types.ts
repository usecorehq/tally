export type Theme = {
  primary?: string;
  primaryForeground?: string;
  primaryInk?: string;
  colorScheme?: "light" | "dark" | "auto";
  radius?: number;
};

export type EmbedEvent = { name: string; data: unknown };
export type EmbedError = { code: string; message: string };

export type MountOptions = {
  container?: string | HTMLElement;
  clientId: string;
  getSessionToken: () => Promise<string>;
  embedOrigin?: string;
  mode?: "inline" | "modal";
  theme?: Theme;
  onEvent?: (e: EmbedEvent) => void;
  onError?: (e: EmbedError) => void;
  onClose?: () => void;
};

export type EmbedController = {
  open(): void;
  close(): void;
  destroy(): void;
  setTheme(t: Theme): void;
  iframe: HTMLIFrameElement;
};

export type ConnectResult = { code?: string; state?: string; error?: string };

export type ConnectOptions = {
  authorizeUrl: string;
  mode?: "redirect" | "popup";
  onResult?: (r: ConnectResult) => void;
};
