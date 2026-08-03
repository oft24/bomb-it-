import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-cyan text-bg-950 hover:bg-cyan/90 shadow-[0_0_0_1px_rgba(63,224,255,0.3),0_8px_24px_-8px_rgba(63,224,255,0.45)] disabled:shadow-none",
  secondary:
    "bg-surface-700 text-ink-100 border border-border-strong hover:bg-surface-600 hover:border-ink-500",
  ghost: "bg-transparent text-ink-300 hover:text-ink-100 hover:bg-surface-800",
  danger: "bg-danger text-ink-100 hover:bg-danger/90",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-8 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-semibold uppercase tracking-wide",
          "transition-all duration-150 ease-[var(--ease-game)] active:scale-[0.97]",
          "disabled:opacity-40 disabled:pointer-events-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-950",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
