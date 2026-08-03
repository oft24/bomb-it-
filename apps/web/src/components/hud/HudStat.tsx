import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HudStat({
  label,
  value,
  accentClassName,
  align = "left",
}: {
  label: string;
  value: ReactNode;
  accentClassName?: string;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", align === "right" && "items-end text-right")}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        {label}
      </span>
      <span className={cn("font-hud text-2xl font-bold text-ink-100", accentClassName)}>
        {value}
      </span>
    </div>
  );
}
