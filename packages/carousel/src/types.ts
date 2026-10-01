import type { Alpine } from "alpinejs";

export type CarouselAlign =
  | "start"
  | "center"
  | "end"
  | ((viewSize: number, snapSize: number, index: number) => number);

export type CarouselContainScroll = "trimSnaps" | "keepSnaps" | false;

export type CarouselAutoplayOptions = {
  delay?: number;
  stopOnInteraction?: boolean;
  stopOnMouseEnter?: boolean;
  stopOnFocusIn?: boolean;
  stopWhenHidden?: boolean;
};

export type CarouselOptions = {
  loop?: boolean;
  autoplay?: boolean;
  autoplayOptions?: CarouselAutoplayOptions;
  axis?: "x" | "y";
  align?: CarouselAlign;
  containScroll?: CarouselContainScroll;
  dragFree?: boolean;
  duration?: number;
  ariaLive?: "off" | "polite" | "assertive";
  onChange?: (index: number) => void;
};

export type CarouselInstance = {
  currentIndex: number;
  totalSlides: number;
  progress: number;
  isFirst: boolean;
  isLast: boolean;
  isPlaying: boolean;
  canNext: boolean;
  canPrevious: boolean;
  slidesInView: number[];
  options: CarouselOptions;
  ariaLive: "off" | "polite" | "assertive";
};

export type CarouselStore = {
  instances: Record<string, CarouselInstance>;
  create(id: string, options?: CarouselOptions): void;
  destroy(id: string): void;
  bindViewport(id: string, viewport: HTMLElement | null): void;
  next(id: string): void;
  previous(id: string): void;
  goTo(id: string, index: number): void;
  current(id: string): number;
  count(id: string): number;
  canNext(id: string): boolean;
  canPrevious(id: string): boolean;
  play(id: string): void;
  pause(id: string): void;
  isPlaying(id: string): boolean;
  handleKeydown(id: string, event: KeyboardEvent): void;
  carouselProps(
    id: string,
    options?: { label?: string }
  ): Record<string, string | boolean | undefined>;
  viewportProps(
    id: string,
    options?: { slideSize?: string | false }
  ): Record<string, string | number | boolean | undefined>;
  slideProps(id: string, index: number): Record<string, string | boolean | undefined>;
  indicatorProps(id: string, index: number): Record<string, string | boolean | undefined>;
  destroyAll(): void;
};

export interface CreateCarouselOptions {
  readonly id?: string;
  readonly storeKey?: string;
  /**
   * Alpine directive name, without the `x-` prefix, that binds a viewport
   * element to an instance and releases the binding when Alpine removes that
   * element. Defaults to {@link DEFAULT_CAROUSEL_DIRECTIVE_KEY}.
   *
   * The expression is either a bare id (`x-carousel="'hero'"`) or an options
   * bag (`x-carousel="{ id: 'loop', loop: true }"`). The instance is created
   * when it does not exist yet, which is what removes the separate
   * `create()` call. Add `.viewport` to bind without creating, for when the host
   * creates the instance elsewhere.
   *
   * The hand-written `$store.carousel.create` / `bindViewport` remain available
   * and unchanged.
   */
  readonly directiveKey?: string;
}

/**
 * The `x-carousel` directive's expression.
 *
 * Either a bare instance id (`x-carousel="'hero'"`) or the options bag plus the
 * id (`x-carousel="{ id: 'loop', loop: true }"`). `id` belongs to the
 * directive's contract rather than the controller's, so it is declared here
 * instead of widening {@link CarouselOptions} for everyone.
 */
export type CarouselDirectiveOptions = CarouselOptions & {
  readonly id: string;
};

export const DEFAULT_CAROUSEL_STORE_KEY = "carousel";
export const DEFAULT_CAROUSEL_DIRECTIVE_KEY = "carousel";

export type CarouselAlpine = Alpine;
export type CarouselPluginCallback = (alpine: Alpine) => void;

export type CarouselControllerOptions = {
  /** Instance id. Generated when absent. */
  readonly id?: string;
};
