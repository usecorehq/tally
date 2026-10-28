import * as React from "react";
import { cn } from "./lib/cn";

/*
 * Tray — Design V2's "white sheet on a grey well" material (Qorelly
 * packages/ui/src/tray.tsx, list-kit SheetTable). A Tray is a grey-100 well, a
 * TraySheet the white surface in it, a TrayFooter the caption row on the well
 * below. Radii are concentric (outer = inner + inset) so the pair reads as one
 * object. Size `lg` is the hero tray (sign-in, empty states); pass the same
 * size to the Tray and its TraySheet.
 *
 *   ┌ Tray ──────────────────────────────┐
 *   │ ┌ TraySheet ─────────────────────┐ │
 *   │ │ …                              │ │
 *   │ └────────────────────────────────┘ │
 *   │  Caption                  Action → │  ← TrayFooter
 *   └────────────────────────────────────┘
 */

type TraySize = "default" | "lg";
const TRAY_SIZE: Record<TraySize, string> = {
  default: "rounded-[18px] p-1",
  lg: "rounded-[32px] p-2 ring-1 ring-black/[0.04]",
};
const SHEET_SIZE: Record<TraySize, string> = {
  default: "rounded-[14px] p-5",
  lg: "rounded-[24px] p-8 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)]",
};

export interface TrayProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: TraySize;
}

export function Tray({ size = "default", className, ...props }: TrayProps) {
  return <div className={cn("flex min-w-0 flex-col bg-gray-100", TRAY_SIZE[size], className)} {...props} />;
}

export function TraySheet({ size = "default", className, ...props }: TrayProps) {
  return (
    <div
      className={cn("bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]", SHEET_SIZE[size], className)}
      {...props}
    />
  );
}

export function TrayFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-3 text-sm text-gray-500", className)} {...props} />
  );
}

export interface TrayTileProps {
  label: string;
  value: React.ReactNode;
  /** Leading 16px glyph for the label. */
  icon?: React.ReactNode;
  /** Small line under the value, e.g. "of 37 items". */
  hint?: React.ReactNode;
  className?: string;
}

/** Metric tile: a flat grey well, a quiet label and a large value. No border, no shadow — the number is the content. */
export function TrayTile({ label, value, icon, hint, className }: TrayTileProps) {
  return (
    <div className={cn("flex flex-col gap-6 rounded-[18px] bg-gray-100 p-4", className)}>
      <div className="flex items-center gap-2 text-sm">
        {icon && <span className="text-gray-900">{icon}</span>}
        <span className="text-gray-500">{label}</span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-3xl font-medium leading-none tracking-tight tabular-nums text-gray-900">{value}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}

export interface WellHeaderProps {
  title: React.ReactNode;
  /** A quiet number after the title, e.g. a row count. */
  count?: number;
  description?: React.ReactNode;
  /** A small caption on the title's line, right-aligned. */
  caption?: React.ReactNode;
  /** Right-aligned slot — usually one quiet button. */
  action?: React.ReactNode;
  className?: string;
}

/** A section's title row on the grey well, above its white sheet. */
export function WellHeader({ title, count, description, caption, action, className }: WellHeaderProps) {
  return (
    <div
      className={cn(
        "flex justify-between px-4 pb-2.5 pt-3",
        caption != null ? "flex-wrap items-baseline gap-x-3 gap-y-1" : "items-start gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="font-medium tracking-tight text-gray-900">
          {title}
          {count != null && <span className="ml-1.5 font-normal tabular-nums text-gray-400">{count.toLocaleString()}</span>}
        </h2>
        {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
      </div>
      {caption != null && <span className="text-xs text-gray-500">{caption}</span>}
      {action && <div className="-my-1 shrink-0">{action}</div>}
    </div>
  );
}

export interface TraySectionProps extends WellHeaderProps {
  /** Classes for the white sheet (default p-5). */
  sheetClassName?: string;
  children: React.ReactNode;
}

/** A titled section: the title on the well, the content on one white sheet. */
export function TraySection({ className, sheetClassName, children, ...header }: TraySectionProps) {
  return (
    <Tray className={className}>
      <WellHeader {...header} />
      <TraySheet className={sheetClassName}>{children}</TraySheet>
    </Tray>
  );
}

/** Section title for a page body: small on purpose, the page title carries the hierarchy. */
export function SectionHeading({
  title,
  icon,
  description,
  action,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-gray-900">
          {icon}
          <h2 className="font-medium tracking-tight">{title}</h2>
        </div>
        {description && <p className={cn("text-sm text-gray-500", icon && "pl-6")}>{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * A list or table on a sheet in a grey well (list-kit SheetTable): pass a
 * plain <table> or rows. The wrapper styles th/td so call sites stay bare.
 */
export function SheetTable({
  children,
  footer,
  className,
  sheetClassName,
  ...header
}: {
  children: React.ReactNode;
  /** A caption row on the well, below the sheet. */
  footer?: React.ReactNode;
  className?: string;
  sheetClassName?: string;
} & Partial<WellHeaderProps>) {
  return (
    <div className={cn("min-w-0 rounded-[18px] bg-gray-100 p-1", className)}>
      {header.title != null && <WellHeader {...(header as WellHeaderProps)} />}
      <div
        className={cn(
          "overflow-x-auto rounded-[14px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]",
          "[&_table]:w-full [&_table]:text-left [&_table]:text-sm [&_table]:text-gray-900",
          "[&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3 [&_th]:text-[13px] [&_th]:font-normal [&_th]:text-gray-500",
          "[&_td]:px-4 [&_td]:py-3 [&_td]:align-middle",
          "[&_tbody_tr]:border-t [&_tbody_tr]:border-gray-100 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-gray-50/70",
          sheetClassName,
        )}
      >
        {children}
      </div>
      {footer && <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-3 text-sm text-gray-500">{footer}</div>}
    </div>
  );
}

/** The app frame's content panel: a white sheet inset into the grey shell. */
export function InsetPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col overflow-clip rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05]",
        className,
      )}
      {...props}
    />
  );
}
