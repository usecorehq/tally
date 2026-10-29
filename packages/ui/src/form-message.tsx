import { cn } from "./lib/cn";
import { SolarIcon, type SolarIconName } from "./solar-icon";

interface FormMessageProps {
  message: string | null | undefined;
  variant?: "error" | "success" | "warning" | "info";
  className?: string;
}

// V2 tinted notice (v2-kit V2Notice): 14px, 13/20 text, no border. Colour is
// for meaning: info is the neutral grey well.
const variantConfig: Record<NonNullable<FormMessageProps["variant"]>, { container: string; icon: SolarIconName; ink: string }> = {
  error: { container: "bg-red-50 text-red-800", icon: "Danger-Circle", ink: "text-red-600" },
  success: { container: "bg-emerald-50 text-emerald-800", icon: "Check-Circle", ink: "text-emerald-600" },
  warning: { container: "bg-amber-50 text-amber-900", icon: "Danger-Triangle", ink: "text-amber-700" },
  info: { container: "bg-gray-100 text-gray-700", icon: "Info-Circle", ink: "text-gray-900" },
};

export function FormMessage({ message, variant = "error", className }: FormMessageProps) {
  if (!message) return null;
  const { container, icon, ink } = variantConfig[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-[14px] px-4 py-3 text-[13px] leading-5", container, className)}
    >
      <SolarIcon name={icon} iconStyle="Outline" size={18} className={cn("shrink-0", ink)} />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}
