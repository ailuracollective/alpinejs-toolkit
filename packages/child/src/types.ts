import type { Alpine } from "alpinejs";

export type ChildMergeMode = "default" | "merge" | "replace";

export interface ChildDirectiveConfig {
  readonly mode: ChildMergeMode;
}

export interface ChildPluginOptions {
  readonly id?: string;
  readonly directiveKey?: string;
}

export const DEFAULT_CHILD_DIRECTIVE_KEY = "child";

export type ChildAlpine = Alpine & {
  morph?(el: Element, newHtml: string | Element, options?: ChildMorphOptions): Element;
};

export interface ChildMorphOptions {
  readonly added?: (node: Node) => void;
}

export type ChildPluginCallback = (alpine: Alpine) => void;
