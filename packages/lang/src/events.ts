import type { LangChangeDetail } from "./types";

export interface LangEvents extends Record<string, unknown[]> {
  change: [LangChangeDetail];
}
