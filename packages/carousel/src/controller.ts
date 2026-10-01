import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { CarouselEvents } from "./events";
import type {
  CarouselControllerOptions,
  CarouselInstance,
  CarouselOptions,
  CarouselStore,
} from "./types";

type InternalInstance = CarouselInstance & {
  viewport: HTMLElement | null;
  embla: unknown | null;
};

function createInstance(options: CarouselOptions = {}): InternalInstance {
  return {
    currentIndex: 0,
    totalSlides: 0,
    progress: 0,
    isFirst: true,
    isLast: false,
    isPlaying: false,
    canNext: false,
    canPrevious: false,
    slidesInView: [],
    options,
    ariaLive: options.ariaLive ?? "polite",
    viewport: null,
    embla: null,
  };
}

function snapshot(inst: InternalInstance): CarouselInstance {
  return {
    currentIndex: inst.currentIndex,
    totalSlides: inst.totalSlides,
    progress: inst.progress,
    isFirst: inst.isFirst,
    isLast: inst.isLast,
    isPlaying: inst.isPlaying,
    canNext: inst.canNext,
    canPrevious: inst.canPrevious,
    slidesInView: [...inst.slidesInView],
    options: { ...inst.options },
    ariaLive: inst.ariaLive,
  };
}

export class CarouselController extends BaseController<CarouselEvents> {
  readonly id: string;
  #instances: Record<string, InternalInstance> = {};

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("carousel");
  }

  private get frozen(): boolean {
    return this.lifecycle === "destroyed";
  }

  hasInstance(id: string): boolean {
    return id in this.#instances;
  }

  snapshotInstances(): Record<string, CarouselInstance> {
    const out: Record<string, CarouselInstance> = {};
    for (const k in this.#instances) out[k] = snapshot(this.#instances[k]);
    return out;
  }

  create(id: string, options: CarouselOptions = {}): void {
    if (this.frozen) return;
    if (!this.#instances[id]) this.#instances[id] = createInstance(options);
    else Object.assign(this.#instances[id].options, options);
    this.emit("change", { carouselId: id });
  }

  destroy(id?: string): void {
    if (id !== undefined) {
      if (this.frozen) return;
      const inst = this.#instances[id];
      if (!inst) return;
      const embla = inst.embla as { destroy?: () => void } | null;
      embla?.destroy?.();
      delete this.#instances[id];
      this.emit("change", { carouselId: id });
      return;
    }
    for (const k of Object.keys(this.#instances)) this.destroy(k);
    super.destroy();
  }

  destroyAll(): void {
    for (const k of Object.keys(this.#instances)) this.destroy(k);
  }

  bindViewport(id: string, viewport: HTMLElement | null): void {
    if (this.frozen) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const inst = this.#instances[id] ?? createInstance();
    this.#instances[id] = inst;
    inst.viewport = viewport;
    if (!viewport) {
      const embla = inst.embla as { destroy?: () => void } | null;
      embla?.destroy?.();
      inst.embla = null;
      this.emit("change", { carouselId: id });
      return;
    }
    // Lazy Embla init — dynamic import keeps SSR safe
    void (async () => {
      try {
        const mod = await import("embla-carousel");
        const EmblaCarousel = (
          mod as unknown as {
            default: (el: HTMLElement, opts: unknown, plugins?: unknown[]) => unknown;
          }
        ).default;
        let autoplayPlugin: unknown = undefined;
        if (inst.options.autoplay) {
          try {
            const am = await import("embla-carousel-autoplay");
            const Autoplay = (am as unknown as { default: (o: unknown) => unknown }).default;
            autoplayPlugin = Autoplay({
              delay: inst.options.autoplayOptions?.delay ?? 4000,
              stopOnInteraction: inst.options.autoplayOptions?.stopOnInteraction ?? true,
            });
          } catch {}
        }
        const embla = EmblaCarousel(
          viewport,
          {
            loop: inst.options.loop ?? false,
            axis: inst.options.axis ?? "x",
            align: inst.options.align ?? "start",
            containScroll: inst.options.containScroll ?? "trimSnaps",
            dragFree: inst.options.dragFree ?? false,
            duration: inst.options.duration ?? 25,
          },
          autoplayPlugin ? [autoplayPlugin] : []
        );
        inst.embla = embla;
        const e = embla as {
          on: (ev: string, cb: () => void) => void;
          selectedScrollSnap: () => number;
          scrollSnapList: () => number[];
          scrollProgress: () => number;
          canScrollNext: () => boolean;
          canScrollPrev: () => boolean;
          slidesInView: () => number[];
          scrollNext: () => void;
          scrollPrev: () => void;
          scrollTo: (i: number) => void;
        };
        const sync = () => {
          const prev = inst.currentIndex;
          inst.currentIndex = e.selectedScrollSnap();
          inst.totalSlides = e.scrollSnapList().length;
          inst.progress = e.scrollProgress();
          inst.canNext = e.canScrollNext();
          inst.canPrevious = e.canScrollPrev();
          inst.slidesInView = e.slidesInView();
          inst.isFirst = inst.currentIndex === 0;
          inst.isLast = inst.totalSlides > 0 && inst.currentIndex === inst.totalSlides - 1;
          if (prev !== inst.currentIndex) {
            this.emit("slideChange", {
              carouselId: id,
              index: inst.currentIndex,
              totalSlides: inst.totalSlides,
            });
            inst.options.onChange?.(inst.currentIndex);
          }
          this.emit("change", { carouselId: id });
        };
        e.on("select", sync);
        e.on("reInit", sync);
        sync();
      } catch {}
    })();
    this.emit("change", { carouselId: id });
  }

  next(id: string): void {
    const e = this.#instances[id]?.embla as { scrollNext?: () => void } | null;
    e?.scrollNext?.();
  }

  previous(id: string): void {
    const e = this.#instances[id]?.embla as { scrollPrev?: () => void } | null;
    e?.scrollPrev?.();
  }

  goTo(id: string, index: number): void {
    const e = this.#instances[id]?.embla as { scrollTo?: (i: number) => void } | null;
    e?.scrollTo?.(index);
  }

  current(id: string): number {
    return this.#instances[id]?.currentIndex ?? 0;
  }
  count(id: string): number {
    return this.#instances[id]?.totalSlides ?? 0;
  }
  canNext(id: string): boolean {
    return this.#instances[id]?.canNext ?? false;
  }
  canPrevious(id: string): boolean {
    return this.#instances[id]?.canPrevious ?? false;
  }

  play(id: string): void {
    const inst = this.#instances[id];
    if (!inst) return;
    const ap = (
      inst.embla as unknown as { plugins?: () => { autoplay?: { play: () => void } } }
    )?.plugins?.()?.autoplay;
    ap?.play();
    inst.isPlaying = true;
    this.emit("change", { carouselId: id });
  }

  pause(id: string): void {
    const inst = this.#instances[id];
    if (!inst) return;
    inst.isPlaying = false;
    this.emit("change", { carouselId: id });
  }

  isPlaying(id: string): boolean {
    return this.#instances[id]?.isPlaying ?? false;
  }

  handleKeydown(id: string, event: KeyboardEvent): void {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        this.previous(id);
        break;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        this.next(id);
        break;
      case "Home":
        event.preventDefault();
        this.goTo(id, 0);
        break;
      case "End":
        event.preventDefault();
        {
          const last = this.count(id) - 1;
          if (last >= 0) this.goTo(id, last);
          break;
        }
    }
  }

  carouselProps(
    id: string,
    options: { label?: string } = {}
  ): Record<string, string | boolean | undefined> {
    return {
      role: "region",
      "aria-roledescription": "carousel",
      "aria-live": this.#instances[id]?.ariaLive ?? "polite",
      "aria-label": options.label,
    };
  }

  viewportProps(
    _id: string,
    options: { slideSize?: string | false } = {}
  ): Record<string, string | number | boolean | undefined> {
    const props: Record<string, string | number | boolean | undefined> = { tabindex: 0 };
    if (options.slideSize !== false)
      props["style"] = `--slide-size: ${options.slideSize ?? "100%"}`;
    return props;
  }

  slideProps(id: string, index: number): Record<string, string | boolean | undefined> {
    const cur = this.current(id);
    const total = this.count(id);
    return {
      role: "group",
      "aria-roledescription": "slide",
      "aria-label": `${index + 1} of ${total}`,
      "aria-hidden": cur !== index ? true : undefined,
    };
  }

  indicatorProps(id: string, index: number): Record<string, string | boolean | undefined> {
    const selected = this.current(id) === index;
    return {
      type: "button",
      "aria-label": `Go to slide ${index + 1}`,
      "aria-current": selected ? "true" : undefined,
    };
  }

  toStore(): import("./types").CarouselStore {
    return {
      // A fresh record, never the private registry: the plugin's sync writes
      // plain snapshots here, so aliasing the private map would destroy the
      // controller's internal instance state (viewport, embla).
      instances: {} as CarouselStore["instances"],
      create: (id, o) => this.create(id, o),
      destroy: (id) => this.destroy(id),
      bindViewport: (id, el) => this.bindViewport(id, el),
      next: (id) => this.next(id),
      previous: (id) => this.previous(id),
      goTo: (id, i) => this.goTo(id, i),
      current: (id) => this.current(id),
      count: (id) => this.count(id),
      canNext: (id) => this.canNext(id),
      canPrevious: (id) => this.canPrevious(id),
      play: (id) => this.play(id),
      pause: (id) => this.pause(id),
      isPlaying: (id) => this.isPlaying(id),
      handleKeydown: (id, e) => this.handleKeydown(id, e),
      carouselProps: (id, o) => this.carouselProps(id, o),
      viewportProps: (id, o) => this.viewportProps(id, o),
      slideProps: (id, i) => this.slideProps(id, i),
      indicatorProps: (id, i) => this.indicatorProps(id, i),
      destroyAll: () => this.destroyAll(),
    };
  }
}

export function createCarouselController(
  options: CarouselControllerOptions = {}
): CarouselController {
  const controller = new CarouselController(options.id);
  controller.mount();
  return controller;
}
