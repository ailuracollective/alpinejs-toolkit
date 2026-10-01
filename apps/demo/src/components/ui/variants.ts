import { cva } from "class-variance-authority";

/**
 * Class recipes shared by the Astro components in `components/ui/`.
 *
 * The demo is plain Alpine + Astro — no React runtime — so the shadcn recipes
 * are kept as `cva` class strings and composed by `.astro` components.
 */

export const cardVariants = cva(
  "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-[var(--ios-radius-lg)] bg-[var(--ios-bg-secondary)] py-(--card-spacing) text-sm text-[var(--ios-label)] border border-[var(--ios-separator)] shadow-sm shadow-black/5 dark:shadow-black/20 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-[var(--ios-radius-lg)] *:[img:last-child]:rounded-b-[var(--ios-radius-lg)]"
);

export const cardHeaderVariants = cva(
  "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-[var(--ios-radius-lg)] px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)"
);

export const cardTitleVariants = cva(
  "font-heading text-base leading-snug font-semibold tracking-tight group-data-[size=sm]/card:text-sm"
);

export const cardDescriptionVariants = cva("text-sm text-[var(--ios-label-secondary)]");

export const cardContentVariants = cva("px-(--card-spacing)");

export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-[var(--ios-blue)] focus-visible:ring-3 focus-visible:ring-[var(--ios-blue)]/30 active:not-aria-[haspopup]:scale-95 disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-[var(--ios-red)] aria-invalid:ring-3 aria-invalid:ring-[var(--ios-red)]/20 dark:aria-invalid:border-[var(--ios-red)]/50 dark:aria-invalid:ring-[var(--ios-red)]/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[var(--ios-blue)] text-white hover:bg-[var(--ios-blue)]/80 shadow-sm",
        outline:
          "border-[var(--ios-separator)] bg-[var(--ios-bg-secondary)] hover:bg-[var(--ios-fill-quaternary)] hover:text-[var(--ios-label)] aria-expanded:bg-[var(--ios-fill-tertiary)] aria-expanded:text-[var(--ios-label)]",
        secondary:
          "bg-[var(--ios-fill-tertiary)] text-[var(--ios-label)] hover:bg-[var(--ios-fill-secondary)] aria-expanded:bg-[var(--ios-fill-secondary)] aria-expanded:text-[var(--ios-label)]",
        ghost:
          "hover:bg-[var(--ios-fill-quaternary)] hover:text-[var(--ios-label)] aria-expanded:bg-[var(--ios-fill-tertiary)] aria-expanded:text-[var(--ios-label)]",
        destructive:
          "bg-[var(--ios-red)]/10 text-[var(--ios-red)] hover:bg-[var(--ios-red)]/20 focus-visible:border-[var(--ios-red)]/40 focus-visible:ring-[var(--ios-red)]/20 dark:bg-[var(--ios-red)]/20 dark:hover:bg-[var(--ios-red)]/30 dark:focus-visible:ring-[var(--ios-red)]/40",
        link: "text-[var(--ios-blue)] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-full px-2 text-xs in-data-[slot=button-group]:rounded-full has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-full px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-full has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8 rounded-full",
        "icon-xs":
          "size-6 rounded-full in-data-[slot=button-group]:rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-full in-data-[slot=button-group]:rounded-full",
        "icon-lg": "size-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap transition-all focus-visible:border-[var(--ios-blue)] focus-visible:ring-[3px] focus-visible:ring-[var(--ios-blue)]/30 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-[var(--ios-red)] aria-invalid:ring-[var(--ios-red)]/20 dark:aria-invalid:ring-[var(--ios-red)]/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-[var(--ios-blue)] text-white [a]:hover:bg-[var(--ios-blue)]/80",
        secondary:
          "bg-[var(--ios-fill-tertiary)] text-[var(--ios-label-secondary)] [a]:hover:bg-[var(--ios-fill-secondary)]",
        destructive:
          "bg-[var(--ios-red)]/10 text-[var(--ios-red)] focus-visible:ring-[var(--ios-red)]/20 dark:bg-[var(--ios-red)]/20 dark:focus-visible:ring-[var(--ios-red)]/40 [a]:hover:bg-[var(--ios-red)]/20",
        outline:
          "border-[var(--ios-separator)] text-[var(--ios-label-secondary)] [a]:hover:bg-[var(--ios-fill-quaternary)] [a]:hover:text-[var(--ios-label)]",
        ghost:
          "hover:bg-[var(--ios-fill-quaternary)] hover:text-[var(--ios-label-secondary)] dark:hover:bg-[var(--ios-fill-tertiary)]",
        link: "text-[var(--ios-blue)] underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-[var(--ios-radius-lg)] border border-[var(--ios-separator)] px-3 py-2.5 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[var(--ios-bg-secondary)] text-[var(--ios-label)]",
        destructive:
          "bg-[var(--ios-red)]/5 text-[var(--ios-red)] *:data-[slot=alert-description]:text-[var(--ios-red)]/90 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
