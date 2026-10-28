import * as React from "react";
import { cn } from "./lib/cn";
import { SolarIcon, type SolarIconName } from "./solar-icon";

/*
 * Design V2 building blocks, lifted from Qorelly packages/ui (v2-kit.tsx,
 * list-kit.tsx, notice.tsx, page-header.tsx, close-button.tsx). Class strings
 * are Qorelly's, so Tally draws the same material. No hooks here: every piece
 * renders on the server; handlers make a client parent.
 */

// ── Buttons ────────────────────────────────────────────────────────────────

/** A 40px icon button on a light surface (header actions, back, close). */
export function IconButton({
  icon,
  label,
  tone = "soft",
  iconStyle = "Outline",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: SolarIconName;
  label: string;
  tone?: "soft" | "quiet" | "ghost";
  iconStyle?: "Outline" | "Fill";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-700 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/15 active:scale-[0.97]",
        tone === "soft" && "bg-gray-100 hover:bg-gray-200",
        tone === "quiet" && "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06] hover:bg-gray-50",
        tone === "ghost" && "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
        className,
      )}
    >
      <SolarIcon name={icon} iconStyle={iconStyle} size={18} />
    </button>
  );
}

/** The modal close: a bare × on a grey disc. */
export function CloseButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label="Close"
      {...props}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-200/70 text-gray-700 outline-none transition-colors hover:bg-gray-300/70 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/15 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <SolarIcon name="Close-Circle" size={18} />
    </button>
  );
}

// ── Chips & segmented ──────────────────────────────────────────────────────

/** A filter chip: brand tint when active, grey well when idle. */
export function FilterChip({
  active = false,
  count,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.97]",
        active ? "bg-primary-light text-primary" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
        className,
      )}
    >
      {children}
      {count != null && (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
            active ? "bg-white text-primary" : "bg-primary-light text-primary",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Segmented control: grey track, white thumb. */
export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
  block = false,
  label,
}: {
  options: ReadonlyArray<{ key: K; label: React.ReactNode; disabled?: boolean }>;
  value: K;
  onChange: (key: K) => void;
  block?: boolean;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex max-w-full gap-0.5 rounded-xl bg-gray-100 p-1", block ? "w-full" : "w-fit")}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.key)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-[14px] font-medium transition-[color,background-color,box-shadow] duration-150 ease-out disabled:opacity-40",
              block && "flex-1",
              on ? "bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-gray-500 hover:text-gray-900",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Inputs ─────────────────────────────────────────────────────────────────

/** Grey-well search field. */
export function SearchWell({
  className,
  onClear,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }) {
  return (
    <div className={cn("relative", className)}>
      <SolarIcon
        name="Rounded-Magnifer"
        iconStyle="Outline"
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="search"
        {...props}
        className="h-11 w-full rounded-xl bg-gray-100 pl-10 pr-10 text-[15px] text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {onClear && props.value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700"
        >
          <SolarIcon name="Close-Circle" size={16} />
        </button>
      ) : null}
    </div>
  );
}

/** Field label with V2's "· optional" hint. */
export function FieldLabel({ children, optional = false, htmlFor }: { children: React.ReactNode; optional?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-medium text-gray-900">
      {children}
      {optional && <span className="font-normal text-gray-400"> · optional</span>}
    </label>
  );
}

/** Quantity stepper: grey well, minus in grey, plus in brand. */
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 999_999,
  size = "md",
  label = "Quantity",
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "md" | "lg";
  label?: string;
  className?: string;
}) {
  const h = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-xl bg-gray-100", size === "lg" && "p-0.5", className)}>
      <button
        type="button"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={cn(
          h,
          "flex items-center justify-center rounded-xl text-gray-500 transition-[background-color,transform] duration-150 hover:bg-gray-200 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent",
        )}
      >
        <SolarIcon name="Minus-Circle" size={18} />
      </button>
      <span aria-live="polite" className={cn("text-center font-semibold tabular-nums text-gray-900", size === "lg" ? "min-w-10 text-[15px]" : "min-w-8 text-sm")}>
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={cn(
          h,
          "flex items-center justify-center rounded-xl text-primary transition-[background-color,transform] duration-150 hover:bg-primary-light active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent",
        )}
      >
        <SolarIcon name="Add-Circle" size={18} />
      </button>
    </div>
  );
}

// ── Selection ──────────────────────────────────────────────────────────────

/** The radio / checkbox mark of a ChoiceCard. */
export function ChoiceMark({ checked, multiple = false }: { checked: boolean; multiple?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center border transition-colors",
        multiple ? "rounded-md" : "rounded-full",
        checked ? "border-primary bg-primary text-white" : "border-gray-300 bg-white",
      )}
    >
      {checked && (
        <svg viewBox="0 0 24 24" className="q-pop h-3.5 w-3.5" fill="none" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/** A selectable card: brand tint and border when selected. */
export function ChoiceCard({
  selected,
  multiple = false,
  media,
  title,
  description,
  trailing,
  disabled,
  onClick,
  className,
}: {
  selected: boolean;
  multiple?: boolean;
  media?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px] border p-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "border-primary bg-primary-light" : "border-gray-200 bg-white hover:bg-gray-50",
        !media && "px-4",
        className,
      )}
    >
      {media}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-gray-900">{title}</span>
        {description != null && <span className="mt-0.5 block truncate text-[13px] text-gray-500">{description}</span>}
      </span>
      {trailing}
      <ChoiceMark checked={selected} multiple={multiple} />
    </button>
  );
}

/** A round media tile for a ChoiceCard or row: brand when on, grey well when off. */
export function IconTile({ icon, active = false, className }: { icon: SolarIconName; active?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
        active ? "bg-primary text-white" : "bg-gray-100 text-gray-700",
        className,
      )}
    >
      <SolarIcon name={icon} iconStyle={active ? "Fill" : "Outline"} size={22} />
    </span>
  );
}

// ── Flow chrome ────────────────────────────────────────────────────────────

/** The top of a flow step: back / close, "Step N of M", the step trail, then the question. */
export function StepHeader({
  step,
  steps,
  title,
  description,
  onBack,
  onClose,
}: {
  step?: number;
  steps?: readonly string[];
  title: React.ReactNode;
  description?: React.ReactNode;
  onBack?: () => void;
  onClose?: () => void;
}) {
  return (
    <div>
      <div className="flex min-h-10 items-center gap-3">
        {onBack && <IconButton icon="Alt-Arrow-Left" label="Back" tone="ghost" onClick={onBack} className="-ml-2" />}
        {step != null && steps && steps.length > 1 && (
          <>
            <span className="shrink-0 rounded-full bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary">
              Step {step} of {steps.length}
            </span>
            <span className="min-w-0 truncate text-xs text-gray-500 max-sm:hidden">{steps.join(" → ")}</span>
          </>
        )}
        {onClose && <IconButton icon="Close-Circle" label="Close" tone="ghost" onClick={onClose} className="-mr-2 ml-auto" />}
      </div>
      <h1 className="mt-4 text-[24px] font-medium leading-tight tracking-tight text-gray-900 sm:text-[28px]">{title}</h1>
      {description != null && <p className="mt-1.5 text-[14px] leading-5 text-gray-500">{description}</p>}
    </div>
  );
}

/** A section heading inside a step. */
export function StepSection({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-medium text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The grey footer well under a step: summary above, actions below. */
export function StepFooter({ summary, children, className }: { summary?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-gray-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3", className)}>
      {summary != null && <div className="mb-3 text-[13px] text-gray-600">{summary}</div>}
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

// ── Totals ─────────────────────────────────────────────────────────────────

export function SummaryWell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("space-y-1.5 rounded-2xl bg-gray-100 px-4 py-3.5", className)}>{children}</div>;
}

export function SummaryRow({
  label,
  value,
  emphasis = false,
  tone,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  emphasis?: boolean;
  tone?: "muted";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        emphasis ? "pt-1 text-[17px] font-semibold text-gray-900" : "text-[14px] text-gray-600",
        tone === "muted" && "text-[13px] text-gray-500",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// ── Status ─────────────────────────────────────────────────────────────────

export type PillTone = "green" | "amber" | "red" | "blue" | "violet" | "gray";
const PILL: Record<PillTone, [string, string]> = {
  green: ["bg-emerald-50 text-emerald-700", "bg-emerald-500"],
  amber: ["bg-amber-50 text-amber-700", "bg-amber-500"],
  red: ["bg-red-50 text-red-600", "bg-red-500"],
  blue: ["bg-blue-50 text-blue-700", "bg-blue-500"],
  violet: ["bg-violet-50 text-violet-700", "bg-violet-500"],
  gray: ["bg-gray-100 text-gray-600", "bg-gray-400"],
};

/** Status pill: full radius, optional 6px dot, 12 medium. */
export function Pill({ tone = "gray", dot = true, className, children }: { tone?: PillTone; dot?: boolean; className?: string; children: React.ReactNode }) {
  const [cls, dotCls] = PILL[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", cls, className)}>
      {dot && <span className={cn("size-1.5 rounded-full", dotCls)} />}
      {children}
    </span>
  );
}

/** A quiet notice on the page (not a form error): grey, or amber for a caution. */
export function Notice({
  tone = "gray",
  icon,
  title,
  children,
  className,
}: {
  tone?: "gray" | "amber" | "brand";
  icon?: SolarIconName;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = {
    gray: ["bg-gray-100 text-gray-600", "text-gray-900"],
    amber: ["bg-amber-50 text-amber-900", "text-amber-700"],
    brand: ["bg-primary-light text-gray-700", "text-primary"],
  }[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-[18px] px-4 py-3 text-sm", t[0], className)}>
      <SolarIcon
        name={icon ?? (tone === "amber" ? "Danger-Triangle" : tone === "brand" ? "Stars" : "Info-Circle")}
        iconStyle="Outline"
        size={18}
        className={cn("mt-0.5 shrink-0", t[1])}
      />
      <div className="min-w-0">
        {title && <p className="font-medium text-gray-900">{title}</p>}
        {children && <div className={cn("break-words", title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

/** An empty or failed state inside a sheet: a glyph on a grey disc, a title, a line, an action. */
export function EmptyState({
  icon = "Box",
  title,
  body,
  action,
  className,
}: {
  icon?: SolarIconName;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-14 text-center", className)}>
      <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <SolarIcon name={icon} iconStyle="Outline" size={20} />
      </span>
      <p className="font-medium tracking-tight text-gray-900">{title}</p>
      {body && <p className="max-w-xs text-sm text-gray-500">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

/** The page title row: optional back, title (24px semibold), subtitle, actions on the right. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  back,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  /** A back control (e.g. an IconButton wrapped in a link). */
  back?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {back}
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 text-sm text-gray-500">{eyebrow}</div>}
          <h1 className="truncate text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-base text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Initials ───────────────────────────────────────────────────────────────

const TONES = [
  ["#FFF7ED", "#C2410C"],
  ["#ECFDF5", "#047857"],
  ["#EEF2FF", "#4338CA"],
  ["#FDF2F8", "#BE185D"],
  ["#F0F9FF", "#0369A1"],
  ["#FEFCE8", "#A16207"],
  ["#F5F3FF", "#6D28D9"],
] as const;

/** A stable soft tone for a name, so a business keeps its colour everywhere. */
export function nameTone(name: string): { backgroundColor: string; color: string } {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [backgroundColor, color] = TONES[h % TONES.length]!;
  return { backgroundColor, color };
}

export function nameInitials(name: string): string {
  const s = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return s || "?";
}

/** The initials tile. Size it with className (default 40px, 10px corners). */
export function InitialsTile({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center font-semibold tracking-tight", className ?? "h-10 w-10 rounded-[10px] text-[15px]")}
      style={nameTone(name)}
    >
      {nameInitials(name)}
    </span>
  );
}
