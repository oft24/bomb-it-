import { cn } from "@/lib/utils";

/** Original mark: a 3x3 grid with a lit core cell, echoing the shared safe-start zone. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect x="1" y="1" width="9" height="9" rx="1.5" className="fill-none stroke-ink-700" strokeWidth="1.5" />
      <rect x="11.5" y="1" width="9" height="9" rx="1.5" className="fill-none stroke-ink-700" strokeWidth="1.5" />
      <rect x="22" y="1" width="9" height="9" rx="1.5" className="fill-none stroke-ink-700" strokeWidth="1.5" />
      <rect x="1" y="11.5" width="9" height="9" rx="1.5" className="fill-none stroke-ink-700" strokeWidth="1.5" />
      <rect x="11.5" y="11.5" width="9" height="9" rx="2" fill="var(--color-cyan)" />
      <rect x="22" y="11.5" width="9" height="9" rx="1.5" className="fill-none stroke-ink-700" strokeWidth="1.5" />
      <rect x="1" y="22" width="9" height="9" rx="1.5" className="fill-none stroke-ink-700" strokeWidth="1.5" />
      <rect x="11.5" y="22" width="9" height="9" rx="1.5" className="fill-none stroke-ink-700" strokeWidth="1.5" />
      <rect x="22" y="22" width="9" height="9" rx="1.5" className="fill-none stroke-ink-700" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="text-lg font-bold tracking-[0.08em] text-ink-100">
        SECTOR<span className="text-cyan"> ZERO</span>
      </span>
    </div>
  );
}
