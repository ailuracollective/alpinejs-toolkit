/// <reference types="astro/client" />
/// <reference types="alpinejs" />

// ── Type imports for Alpine augmentation ──────────────────────────────
type AccordionStore = import("@ailura/alpinejs-accordion").AccordionStore;
type BatteryState = import("@ailura/alpinejs-env").BatteryState;
type CalendarStore = import("@ailura/alpinejs-calendar").CalendarStore;
type CarouselStore = import("@ailura/alpinejs-carousel").CarouselStore;
type ClipboardMagic = import("@ailura/alpinejs-transfer").ClipboardMagic;
type CollectionStore = import("@ailura/alpinejs-collection").CollectionStore;
type CommandStore = import("@ailura/alpinejs-command").CommandStore;
type DialogStore = import("@ailura/alpinejs-dialog").DialogStore;
type EnvMagic = import("@ailura/alpinejs-env").EnvMagic;
type ExportMagic = import("@ailura/alpinejs-transfer").ExportMagic;
type FormStore = import("@ailura/alpinejs-form").FormStore;
type GestureStore = import("@ailura/alpinejs-gesture").GestureStore;
type GeoStore = import("@ailura/alpinejs-geo").GeoStore;
type HistoryStore = import("@ailura/alpinejs-history").HistoryStore;
type IdleMagic = import("@ailura/alpinejs-attention").IdleMagic;
type JsonApiClient = import("@ailura/alpinejs-json-api").JsonApiClient;
type KeyboardStore = import("@ailura/alpinejs-keyboard").KeyboardStore;
type LangStore = import("@ailura/alpinejs-lang").LangStore;
type MediaStore = import("@ailura/alpinejs-media").MediaStore;
type MenuStore = import("@ailura/alpinejs-menu").MenuStore;
type NetworkState = import("@ailura/alpinejs-env").NetworkState;
type NotifyMagic = import("@ailura/alpinejs-notify").NotifyMagic;
type OverlayStore = import("@ailura/alpinejs-overlay").OverlayStore;
type PermissionsMagic = import("@ailura/alpinejs-permissions").PermissionsMagic;
type PermissionsStore = import("@ailura/alpinejs-permissions").PermissionsStore;
type PlatformState = import("@ailura/alpinejs-env").PlatformState;
type QueryStore = import("@ailura/alpinejs-query").QueryStore;
type ScrollStore = import("@ailura/alpinejs-scroll").ScrollStore;
type SelectionStore = import("@ailura/alpinejs-selection").SelectionStore;
type ShareMagic = import("@ailura/alpinejs-transfer").ShareMagic;
type SidebarStore = import("@ailura/alpinejs-sidebar").SidebarStore;
type TabsStore = import("@ailura/alpinejs-tabs").TabsStore;
type ThemeStore = import("@ailura/alpinejs-theme").ThemeStore;
type TimerMagic = import("@ailura/alpinejs-timer").TimerMagic;
type ToastStore = import("@ailura/alpinejs-toast").ToastStore;
type TooltipStore = import("@ailura/alpinejs-tooltip").TooltipStore;
type VirtualStore = import("@ailura/alpinejs-virtual").VirtualStore;
type VisibilityState = import("@ailura/alpinejs-env").VisibilityState;
type WakeLockMagic = import("@ailura/alpinejs-attention").WakeLockMagic;

declare module "alpinejs" {
  // Declaration merging: `Alpine` the instance interface and `Alpine` the
  // namespace of store/magic maps are the two halves Alpine itself declares.
  // oxlint-disable-next-line no-redeclare -- module augmentation, not a redeclaration
  interface Alpine {
    $persist<T>(value: T): {
      as(key: string): T;
      using(storage: Storage): { as(key: string): T };
    };
  }

  namespace Alpine {
    interface Stores {
      accordion: AccordionStore;
      calendar: CalendarStore;
      carousel: CarouselStore;
      collection: CollectionStore;
      command: CommandStore;
      dialog: DialogStore;
      form: FormStore;
      gesture: GestureStore;
      geo: GeoStore;
      history: HistoryStore;
      jsonApi: JsonApiClient;
      keyboard: KeyboardStore;
      lang: LangStore;
      media: MediaStore;
      menu: MenuStore;
      overlay: OverlayStore;
      permissions: PermissionsStore;
      query: QueryStore;
      queryAlpine: QueryStore;
      queryZustand: QueryStore;
      queryNanostores: QueryStore;
      scroll: ScrollStore;
      selection: SelectionStore;
      sidebar: SidebarStore;
      tabs: TabsStore;
      theme: ThemeStore;
      toast: ToastStore;
      tooltip: TooltipStore;
      virtual: VirtualStore;
    }
    interface Magics<T> {
      $env: EnvMagic;
      $export: ExportMagic;
      $idle: IdleMagic;
      $machine: <S extends string, E extends string>(config: {
        initial: S;
        transitions: readonly { name: E; from: S; to: S }[];
      }) => unknown;
      $network: NetworkState;
      $notify: NotifyMagic;
      $overlay: OverlayStore;
      $permissions: PermissionsMagic;
      $platform: PlatformState;
      $query: QueryStore;
      $scroll: ScrollStore;
      $selection: SelectionStore;
      $share: ShareMagic;
      $sidebar: SidebarStore;
      $tabs: TabsStore;
      $theme: ThemeStore;
      $timer: TimerMagic;
      $toast: ToastStore;
      $tooltip: TooltipStore;
      $virtual: VirtualStore;
      $visibility: VisibilityState;
      $wakelock: WakeLockMagic;
      $battery: BatteryState;
      $clipboard: ClipboardMagic;
    }
  }
}

import type { AlpineInstance } from "./types/alpine";

declare global {
  var Alpine: AlpineInstance;
}
