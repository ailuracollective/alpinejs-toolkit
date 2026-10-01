import type { AstroComponentFactory } from "astro/runtime/server/index.js";

import AccordionDemo from "../components/demos/AccordionDemo.astro";
import AttentionDemo from "../components/demos/AttentionDemo.astro";
import CalendarDemo from "../components/demos/CalendarDemo.astro";
import CarouselDemo from "../components/demos/CarouselDemo.astro";
import ChildDemo from "../components/demos/ChildDemo.astro";
import CollectionDemo from "../components/demos/CollectionDemo.astro";
import CommandDemo from "../components/demos/CommandDemo.astro";
import CoreDemo from "../components/demos/CoreDemo.astro";
import DialogDemo from "../components/demos/DialogDemo.astro";
import EnvDemo from "../components/demos/EnvDemo.astro";
import FormDemo from "../components/demos/FormDemo.astro";
import GeoDemo from "../components/demos/GeoDemo.astro";
import GestureDemo from "../components/demos/GestureDemo.astro";
import HistoryDemo from "../components/demos/HistoryDemo.astro";
import JsonApiDemo from "../components/demos/JsonApiDemo.astro";
import KeyboardDemo from "../components/demos/KeyboardDemo.astro";
import LangDemo from "../components/demos/LangDemo.astro";
import MediaDemo from "../components/demos/MediaDemo.astro";
import MenuDemo from "../components/demos/MenuDemo.astro";
import NotifyDemo from "../components/demos/NotifyDemo.astro";
import OverlayDemo from "../components/demos/OverlayDemo.astro";
import PermissionsDemo from "../components/demos/PermissionsDemo.astro";
import QueryAdapterAlpineDemo from "../components/demos/QueryAdapterAlpineDemo.astro";
import QueryAdapterNanostoresDemo from "../components/demos/QueryAdapterNanostoresDemo.astro";
import QueryAdapterZustandDemo from "../components/demos/QueryAdapterZustandDemo.astro";
import QueryDemo from "../components/demos/QueryDemo.astro";
import ScrollDemo from "../components/demos/ScrollDemo.astro";
import SelectionDemo from "../components/demos/SelectionDemo.astro";
import SidebarDemo from "../components/demos/SidebarDemo.astro";
import StateMachineDemo from "../components/demos/StateMachineDemo.astro";
import TabsDemo from "../components/demos/TabsDemo.astro";
import ThemeDemo from "../components/demos/ThemeDemo.astro";
import TimerDemo from "../components/demos/TimerDemo.astro";
import ToastDemo from "../components/demos/ToastDemo.astro";
import TooltipDemo from "../components/demos/TooltipDemo.astro";
import TransferDemo from "../components/demos/TransferDemo.astro";
import VirtualDemo from "../components/demos/VirtualDemo.astro";

export const PLAYGROUND_DEMOS: Record<string, AstroComponentFactory> = {
  core: CoreDemo,
  "state-machine": StateMachineDemo,
  theme: ThemeDemo,
  timer: TimerDemo,
  sidebar: SidebarDemo,
  media: MediaDemo,
  scroll: ScrollDemo,
  geo: GeoDemo,
  form: FormDemo,
  gesture: GestureDemo,
  history: HistoryDemo,
  lang: LangDemo,
  collection: CollectionDemo,
  child: ChildDemo,
  overlay: OverlayDemo,
  permissions: PermissionsDemo,
  keyboard: KeyboardDemo,
  dialog: DialogDemo,
  menu: MenuDemo,
  tooltip: TooltipDemo,
  tabs: TabsDemo,
  accordion: AccordionDemo,
  command: CommandDemo,
  carousel: CarouselDemo,
  virtual: VirtualDemo,
  selection: SelectionDemo,
  toast: ToastDemo,
  attention: AttentionDemo,
  notify: NotifyDemo,
  calendar: CalendarDemo,
  query: QueryDemo,
  "query-adapter-alpine": QueryAdapterAlpineDemo,
  "query-adapter-zustand": QueryAdapterZustandDemo,
  "query-adapter-nanostores": QueryAdapterNanostoresDemo,
  env: EnvDemo,
  transfer: TransferDemo,
  "json-api": JsonApiDemo,
};

export function getPlaygroundDemo(id: string): AstroComponentFactory | undefined {
  return PLAYGROUND_DEMOS[id];
}
