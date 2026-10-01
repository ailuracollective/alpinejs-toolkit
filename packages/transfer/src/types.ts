import type { Alpine } from "alpinejs";

export const DEFAULT_TRANSFER_CLIPBOARD_KEY = "clipboard" as const;
export const DEFAULT_TRANSFER_SHARE_KEY = "share" as const;
export const DEFAULT_TRANSFER_EXPORT_KEY = "export" as const;

export type ClipboardCopyMode = "auto" | "clipboard" | "legacy";
export type ClipboardCopyText = string | number | boolean | bigint;
export interface ClipboardCopyOptions {
  mode?: ClipboardCopyMode;
}
/**
 * `$clipboard(text, modeOrOptions?)` — three overloads so a call site can pass
 * the mode as a bare string or as `{ mode }`.
 */
export type CopyToClipboard = {
  (text: ClipboardCopyText): Promise<void>;
  (text: ClipboardCopyText, mode: ClipboardCopyMode): Promise<void>;
  (text: ClipboardCopyText, options: ClipboardCopyOptions): Promise<void>;
};
export type ClipboardMagic = CopyToClipboard;

export type ShareMagic = ((data: ShareData) => Promise<boolean>) & {
  readonly isSupported: boolean;
  canShare(data?: ShareData): boolean;
};

export type ExportOptions = {
  filename?: string;
  mimeType?: string;
};
export type ExportSource = string | Blob | File;
export type ExportMagic = ((
  source: ExportSource,
  options?: ExportOptions | string
) => Promise<boolean>) & {
  readonly isSupported: boolean;
};

/**
 * Legacy alias of {@link TransferPluginOptions} — the two interfaces are
 * identical and the plugin factory is typed with `TransferPluginOptions`.
 */
export interface TransferOptions {
  clipboard?: boolean;
  share?: boolean;
  export?: boolean;
  readonly clipboardKey?: string;
  readonly shareKey?: string;
  readonly exportKey?: string;
}
/**
 * The three magics as one type. Nothing in the package produces it: the plugin
 * registers `$clipboard`, `$share` and `$export` separately, each independently
 * disableable.
 */
export type TransferMagic = ClipboardMagic & ShareMagic & ExportMagic;

export interface TransferPluginOptions {
  clipboard?: boolean;
  share?: boolean;
  export?: boolean;
  readonly clipboardKey?: string;
  readonly shareKey?: string;
  readonly exportKey?: string;
}

export type TransferAlpine = Alpine;
export type TransferPluginCallback = (alpine: Alpine) => void;

export type TransferControllerOptions = {
  /** Controller id. Generated when absent. */
  readonly id?: string;
};
