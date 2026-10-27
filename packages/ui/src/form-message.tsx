import { cn } from "./lib/cn";
import { SolarIcon, type SolarIconName } from "./solar-icon";

interface FormMessageProps {
  message: string | null | undefined;
  variant?: "error" | "success" | "warning" | "info";
  className?: string;
}

const variantConfig: Record<NonNullable<FormMessageProps["variant"]>, { container: string; icon: SolarIconName }> = {
  error: { container: "bg-red-50 text-red-700 border border-red-100", icon: "Danger-Circle" },
  success: { container: "bg-green-50 text-green-700 border border-green-100", icon: "Check-Circle" },
  warning: { container: "bg-amber-50 text-amber-700 border border-amber-100", icon: "Danger-Triangle" },
  info: { container: "bg-blue-50 text-blue-700 border border-blue-100", icon: "Info-Circle" },
};

export function FormMessage({ message, variant = "error", className }: FormMessageProps) {
  if (!message) return null;
  const { container, icon } = variantConfig[variant];
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-xl p-3 text-sm", container, className)}>
      <SolarIcon name={icon} size={16} className="mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
