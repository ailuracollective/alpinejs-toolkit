import { guardMagic } from "@ailura/alpinejs-core/guards";
import type { Alpine } from "alpinejs";

import { TransferController } from "./controller";
import {
  DEFAULT_TRANSFER_CLIPBOARD_KEY,
  DEFAULT_TRANSFER_EXPORT_KEY,
  DEFAULT_TRANSFER_SHARE_KEY,
  type TransferPluginCallback,
  type TransferPluginOptions,
} from "./types";

const packageName = "@ailura/alpinejs-transfer";

export function transferPlugin(options: TransferPluginOptions = {}): TransferPluginCallback {
  const clipboardKey = options.clipboardKey ?? DEFAULT_TRANSFER_CLIPBOARD_KEY;
  const shareKey = options.shareKey ?? DEFAULT_TRANSFER_SHARE_KEY;
  const exportKey = options.exportKey ?? DEFAULT_TRANSFER_EXPORT_KEY;

  return function registerTransfer(alpine: Alpine): void {
    const controller = new TransferController();

    // Each magic is opt-out rather than opt-in, because a plugin that registers
    // `$export` on a page that has no `$export` is harmless, while one that
    // omits `$clipboard` is a broken build. `false` means "do not register".
    const clipboardEnabled = options.clipboard !== false;
    const shareEnabled = options.share !== false;
    const exportEnabled = options.export !== false;

    if (clipboardEnabled) {
      guardMagic(alpine, clipboardKey, () => controller.copy.bind(controller), packageName);
    }

    if (shareEnabled) {
      const shareMagic = ((data: ShareData) => controller.share(data)) as unknown as Record<
        string,
        unknown
      >;
      Object.defineProperty(shareMagic, "isSupported", {
        get: () => controller.isShareSupported(),
      });
      (shareMagic as unknown as { canShare: (d?: ShareData) => boolean }).canShare = (
        d?: ShareData
      ) => controller.canShare(d);
      guardMagic(alpine, shareKey, () => shareMagic, packageName);
    }

    if (exportEnabled) {
      const exportMagic = ((source: unknown, opts?: unknown) =>
        controller.export(source as never, opts as never)) as unknown as Record<string, unknown>;
      Object.defineProperty(exportMagic, "isSupported", {
        get: () => controller.isExportSupported(),
      });
      guardMagic(alpine, exportKey, () => exportMagic, packageName);
    }
  };
}

export default transferPlugin;
