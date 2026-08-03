"use client";

import Link from "next/link";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { RankBadge } from "@/components/ui/RankBadge";
import { Trophy, Users, Swords, GraduationCap, Sparkles } from "lucide-react";

const NAV_ITEMS = ["Play", "Career", "Leaderboards", "Profile", "Settings"];

const MODES = [
  { label: "Casual", icon: Users, href: "/play", desc: "Jump into an open lobby, no stakes." },
  { label: "Ranked", icon: Trophy, href: "/play", desc: "Rated matchmaking.", soon: true },
  { label: "Custom Game", icon: Swords, href: "/play", desc: "Host a private room, invite by code." },
  { label: "Training", icon: GraduationCap, href: "/play", desc: "Solo drills, no ranking impact.", soon: true },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-8 py-4">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_ITEMS.map((item) => (
            <span
              key={item}
              className="cursor-default text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-ink-100"
            >
              {item}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-xs text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success shadow-[0_0_6px_theme(colors.success)]" />
            <span className="font-hud">4,812</span> online
          </span>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20">
        <BackgroundGrid />

        <div className="relative z-10 flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface-800/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            <Sparkles className="size-3 text-cyan" />
            Open Beta — Season Zero
          </div>

          <LogoMark className="size-16" />
          <h1 className="text-5xl font-black tracking-tight text-ink-100 sm:text-6xl">
            SECTOR<span className="text-cyan"> ZERO</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-ink-500">
            30 operatives. One identical grid. Clear it clean and clear it first —
            everyone else is racing the same hazards, in real time.
          </p>

          <div className="mt-2 flex items-center gap-3">
            <Link href="/play">
              <Button size="lg" className="min-w-48">
                Play
              </Button>
            </Link>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-800/60 px-4 py-2.5">
            <RankBadge rank="OPERATIVE" size="sm" />
            <span className="h-3 w-px bg-border" />
            <span className="font-hud text-xs text-ink-500">
              LVL <span className="text-ink-300">14</span>
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="font-hud text-xs text-ink-500">
              RATING <span className="text-ink-300">1,247</span>
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-14 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {MODES.map((mode) => (
            <Link
              key={mode.label}
              href={mode.href}
              aria-disabled={mode.soon}
              className="group flex flex-col items-start gap-2 rounded-lg border border-border-subtle bg-surface-800/60 p-4 transition-colors hover:border-border-strong hover:bg-surface-700/60"
            >
              <mode.icon className="size-4 text-ink-500 transition-colors group-hover:text-cyan" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-ink-100">
                  {mode.label}
                </span>
                {mode.soon && (
                  <span className="rounded bg-surface-600 px-1.5 py-0.5 text-[9px] font-bold text-ink-500">
                    SOON
                  </span>
                )}
              </div>
              <span className="text-left text-[11px] leading-snug text-ink-500">{mode.desc}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

function BackgroundGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage:
          "linear-gradient(var(--color-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-subtle) 1px, transparent 1px)",
        backgroundSize: "42px 42px",
        maskImage: "radial-gradient(ellipse 60% 55% at 50% 35%, black 40%, transparent 100%)",
      }}
    />
  );
}
