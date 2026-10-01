import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { DialogEvents } from "./events";
import type {
  DialogChangeSource,
  DialogInstance,
  DialogOptions,
  DialogOpenOptions,
  DialogStore,
  DialogControllerOptions,
} from "./types";

function createInstance(options: DialogOptions = {}): DialogInstance {
  return {
    open: false,
    closeOnEscape: options.closeOnEscape ?? true,
    closeOnOutsideClick: options.closeOnOutsideClick ?? true,
    labelledBy: options.labelledBy,
    describedBy: options.describedBy,
    trigger: null,
    container: null,
    onOpen: options.onOpen,
    onClose: options.onClose,
  };
}

export class DialogController extends BaseController<DialogEvents> {
  readonly id: string;
  #instances: Record<string, DialogInstance> = {};
  #defaultCloseOnEscape: boolean;
  #defaultCloseOnOutsideClick: boolean;

  constructor(config: DialogControllerOptions = {}) {
    super();
    this.id = config.id ?? generateId("dialog");
    this.#defaultCloseOnEscape = config.defaultCloseOnEscape ?? true;
    this.#defaultCloseOnOutsideClick = config.defaultCloseOnOutsideClick ?? true;
  }

  private get frozen(): boolean {
    return this.lifecycle === "destroyed";
  }

  hasInstance(id: string): boolean {
    return id in this.#instances;
  }

  snapshotInstances(): Record<string, DialogInstance> {
    const out: Record<string, DialogInstance> = {};
    for (const k in this.#instances) out[k] = { ...this.#instances[k] };
    return out;
  }

  create(id: string, options: DialogOptions = {}): void {
    if (this.frozen) return;
    this.#instances[id] = createInstance({
      closeOnEscape: options.closeOnEscape ?? this.#defaultCloseOnEscape,
      closeOnOutsideClick: options.closeOnOutsideClick ?? this.#defaultCloseOnOutsideClick,
      labelledBy: options.labelledBy,
      describedBy: options.describedBy,
      onOpen: options.onOpen,
      onClose: options.onClose,
    });
    this.emit("change", { instanceId: id });
  }

  /**
   * `destroy(dialogId)` drops ONE dialog; `destroy()` tears down the controller.
   *
   * The overload exists because `BaseController.destroy()` is the controller's
   * own teardown and cannot be renamed. The argument is what separates them.
   */
  override destroy(dialogId?: string): void {
    if (this.frozen) return;
    if (dialogId === undefined) {
      for (const id of Object.keys(this.#instances)) this.#destroyInstance(id);
      super.destroy();
      return;
    }
    this.#destroyInstance(dialogId);
  }

  /** Destroy every dialog, leaving the controller itself usable. */
  destroyAll(): void {
    if (this.frozen) return;
    for (const id of Object.keys(this.#instances)) this.#destroyInstance(id);
  }

  #destroyInstance(dialogId: string): void {
    if (this.isOpen(dialogId)) this.close(dialogId);
    delete this.#instances[dialogId];
    this.emit("change", { instanceId: dialogId });
  }

  /**
   * Open a dialog, creating the instance if it does not exist.
   *
   * The early return on an already-open dialog is what makes `onOpen` a
   * once-per-open hook rather than a once-per-call one.
   *
   * `options.trigger` is recorded on the instance and nothing more: this
   * package has no focus management, so it never moves focus into the panel
   * here and never restores it in `close()`. It is stored so a host can read it
   * back out of `instances[id].trigger` and act on it itself.
   */
  open(id: string, options: DialogOpenOptions = {}, source: DialogChangeSource = "user"): void {
    if (this.frozen) return;
    const instance = this.#getOrCreate(id);
    if (instance.open) return;
    instance.open = true;
    if (options.trigger !== undefined) instance.trigger = options.trigger;
    if (options.labelledBy !== undefined) instance.labelledBy = options.labelledBy;
    if (options.describedBy !== undefined) instance.describedBy = options.describedBy;
    instance.onOpen?.();
    this.emit("open", { instanceId: id, source });
    this.emit("change", { instanceId: id });
  }

  close(id: string, source: DialogChangeSource = "user"): void {
    if (this.frozen) return;
    const instance = this.#instances[id];
    if (!instance?.open) return;
    instance.open = false;
    instance.onClose?.();
    this.emit("close", { instanceId: id, source });
    this.emit("change", { instanceId: id });
  }

  toggle(id: string, options: DialogOpenOptions = {}): void {
    if (this.isOpen(id)) this.close(id);
    else this.open(id, options);
  }

  isOpen(id: string): boolean {
    return this.#instances[id]?.open ?? false;
  }

  /**
   * Hand the panel element over so `handleOutsideClick()` has something to test
   * the click target against. `null` releases it.
   */
  bindContainer(id: string, container: HTMLElement | null): void {
    if (this.frozen) return;
    const instance = this.#getOrCreate(id);
    instance.container = container;
    this.emit("change", { instanceId: id });
  }

  /**
   * `Escape` closes, when the dialog is open and its own `closeOnEscape` is on.
   *
   * Gated per instance rather than globally, so one dialog can be
   * non-dismissible while another closes. Nothing else is handled, and no focus
   * is trapped while the dialog is open.
   */
  handleKeydown(id: string, event: KeyboardEvent): void {
    const instance = this.#instances[id];
    if (!(instance?.open && instance.closeOnEscape)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.close(id);
    }
  }

  /**
   * Close when the click landed outside the bound container.
   *
   * Requires `bindContainer()` (or `x-dialog.panel`, which does it): with no
   * container the guard fails and the call is a silent no-op, so a hand-wired
   * backdrop that forgot the binding looks like a backdrop that does nothing.
   */
  handleOutsideClick(id: string, event: MouseEvent): void {
    const instance = this.#instances[id];
    if (!(instance?.open && instance.closeOnOutsideClick && instance.container)) return;
    const target = event.target;
    if (target instanceof Node && !instance.container.contains(target)) {
      this.close(id);
    }
  }

  /**
   * Every value here is fixed for the life of the element, which is what makes
   * it safe to spread into one `x-bind` — the object-form `x-bind` Alpine
   * applies exactly once cannot go stale here.
   */
  dialogProps(id: string): Record<string, string | boolean | undefined> {
    const instance = this.#instances[id];
    return {
      role: "dialog",
      "aria-modal": true,
      "aria-labelledby": instance?.labelledBy,
      "aria-describedby": instance?.describedBy,
    };
  }

  toStore(): DialogStore {
    return {
      // A fresh record, never the private registry: the plugin's sync writes
      // plain snapshots here, so aliasing the private map would destroy the
      // controller's internal instance state.
      instances: {} as DialogStore["instances"],
      open: (id, opts) => this.open(id, opts),
      close: (id) => this.close(id),
      toggle: (id, opts) => this.toggle(id, opts),
      isOpen: (id) => this.isOpen(id),
      create: (id, opts) => this.create(id, opts),
      // One key, both arities, argument forwarded: `destroy: () =>
      // this.destroy()` would make `store.destroy("settings")` tear the
      // controller down instead of one dialog.
      destroy: (id?: string) => this.destroy(id),
      destroyAll: () => this.destroyAll(),
      bindContainer: (id, c) => this.bindContainer(id, c),
      handleKeydown: (id, e) => this.handleKeydown(id, e),
      handleOutsideClick: (id, e) => this.handleOutsideClick(id, e),
      dialogProps: (id) => this.dialogProps(id),
    };
  }

  #getOrCreate(id: string): DialogInstance {
    this.#instances[id] ??= createInstance({
      closeOnEscape: this.#defaultCloseOnEscape,
      closeOnOutsideClick: this.#defaultCloseOnOutsideClick,
    });
    return this.#instances[id];
  }
}

/**
 * A mounted controller. Mounted here because every mutator is gated on
 * `lifecycle !== 'destroyed'`, so an unmounted controller would accept writes
 * the base class never authorised.
 */
export function createDialogController(config: DialogControllerOptions = {}): DialogController {
  const controller = new DialogController(config);
  controller.mount();
  return controller;
}
