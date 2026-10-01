import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type {
  TransferControllerOptions,
  ClipboardCopyOptions,
  ClipboardCopyText,
  ExportOptions,
  ExportSource,
} from "./types";

function hasClipboardApi(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";
}

export class TransferController extends BaseController<Record<string, unknown[]>> {
  readonly id: string;

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("transfer");
  }

  async copy(text: ClipboardCopyText, options?: ClipboardCopyOptions | string): Promise<void> {
    const value = String(text);
    const mode = typeof options === "string" ? options : (options?.mode ?? "auto");
    if (mode === "clipboard" || (mode === "auto" && hasClipboardApi())) {
      if (!hasClipboardApi()) throw new Error("Clipboard API is not available");
      await navigator.clipboard.writeText(value);
      return;
    }
    // The legacy path needs a live document: a server has no `document` to
    // create the textarea in, so `auto` on the server throws here rather than
    // failing quietly. Import is still safe — nothing runs until `copy()`.
    if (mode === "legacy" || mode === "auto") {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok =
        typeof (document as unknown as { execCommand?: (c: string) => boolean }).execCommand ===
        "function"
          ? (document as unknown as { execCommand: (c: string) => boolean }).execCommand("copy")
          : false;
      document.body.removeChild(area);
      // Only the explicit mode reports a failed copy. Under `auto` a refused
      // `execCommand` is swallowed, so a caller that cannot reach the Clipboard
      // API at all gets a resolved promise and no clipboard — pass `legacy` when
      // the outcome matters.
      if (!ok && mode === "legacy") throw new Error("Failed to copy to clipboard");
    }
  }

  isShareSupported(): boolean {
    // `isSecureContext` is checked explicitly because `navigator.share` exists
    // on an insecure origin in some browsers and then throws on use; probing for
    // the function alone would report a capability the page does not have.
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      globalThis.isSecureContext === true
    );
  }

  canShare(data?: ShareData): boolean {
    if (!this.isShareSupported()) return false;
    if (!data) return true;
    if (typeof navigator.canShare === "function") {
      try {
        return navigator.canShare(data);
      } catch {
        return false;
      }
    }
    if (data.files?.length) return false;
    return Boolean(data.title || data.text || data.url);
  }

  async share(data: ShareData): Promise<boolean> {
    if (!this.canShare(data)) return false;
    try {
      await navigator.share(data);
      return true;
    } catch {
      // A user dismissing the share sheet rejects with `AbortError`, and so does
      // a platform that cannot handle the payload. `false` is the answer to
      // "did it go out", not to "did the user want it to" — check `canShare()`
      // first if you need to tell the two apart.
      return false;
    }
  }

  isExportSupported(): boolean {
    return (
      typeof document !== "undefined" &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function"
    );
  }

  // Async by contract, not by need: the return type is part of the public API
  // and mirrors `copy`/`share`. The download itself is fully synchronous, so
  // there is no `await` to write.
  // oxlint-disable-next-line require-await -- Promise-returning public API, no async work
  async export(source: ExportSource, options?: ExportOptions | string): Promise<boolean> {
    if (!this.isExportSupported()) return false;
    const opts: ExportOptions =
      typeof options === "string" ? { filename: options } : (options ?? {});
    try {
      if (source instanceof Blob) {
        const name = opts.filename ?? (source instanceof File ? source.name : "export");
        const url = URL.createObjectURL(source);
        const a = document.createElement("a");
        a.href = url;
        if (name) a.download = name;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 0);
        return true;
      }
      const value = String(source);
      // A string has no name of its own, so there is nothing to download it as.
      // Returning false beats inventing `"download.txt"`: a caller that named its
      // file knows what it wanted.
      if (!opts.filename) return false;
      const blob = new Blob([value], { type: opts.mimeType ?? "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = opts.filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      return true;
    } catch {
      return false;
    }
  }
}

export function createTransferController(
  options: TransferControllerOptions = {}
): TransferController {
  return new TransferController(options.id);
}
