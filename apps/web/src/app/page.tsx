"use client";

import Link from "next/link";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { RankBadge } from "@/components/ui/RankBadge";
import { useAuthStore, type Profile } from "@/store/authStore";
import { AudioMenu } from "@/components/audio/AudioMenu";
import { AudioSettings } from "@/components/audio/AudioSettings";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Trophy, Users, Swords, GraduationCap, Sparkles, Crosshair, ShieldCheck, UserRound, Settings as SettingsIcon } from "lucide-react";

const NAV_ITEMS = ["Play", "Career", "Leaderboards", "Profile", "Settings"];

const MODES = [
  { label: "Casual", icon: Users, href: "/play", desc: "Jump into an open lobby, no stakes." },
  { label: "Ranked", icon: Trophy, href: "/play", desc: "Rated matchmaking.", soon: true },
  { label: "Custom Game", icon: Swords, href: "/play", desc: "Host a private room, invite by code." },
  { label: "Training", icon: GraduationCap, href: "/play", desc: "Solo drills, no ranking impact.", soon: true },
];

export default function HomePage() {
  const { session, profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<(typeof NAV_ITEMS)[number]>("Play");
  // Playing never requires an account — /play asks for a name if you're a guest.
  const playHref = "/play";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-8 py-4">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setActiveTab(item)}
              className={`relative py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${activeTab === item ? "text-cyan" : "text-ink-500 hover:text-ink-100"}`}
            >
              {item}
              {activeTab === item && <motion.span layoutId="nav-active" className="absolute inset-x-0 -bottom-[17px] h-px bg-cyan" />}
            </button>
          ))}
        </nav>
        <AudioMenu />
      </header>

      <div className="flex overflow-x-auto border-b border-border-subtle px-4 md:hidden">
        {NAV_ITEMS.map((item) => <button type="button" key={item} onClick={() => setActiveTab(item)} className={`shrink-0 px-3 py-3 text-[10px] font-bold uppercase tracking-wider ${activeTab === item ? "text-cyan" : "text-ink-500"}`}>{item}</button>)}
      </div>

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20">
        <BackgroundGrid />

        {activeTab === "Play" ? <motion.div key="play" animate={{ opacity: 1, y: 0 }} className="relative z-10 flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface-800/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            <Sparkles className="size-3 text-cyan" />
            Open Beta — Season Zero
          </div>

          <LogoMark className="size-16" />
          <h1 className="text-5xl font-black lowercase tracking-tight text-ink-100 sm:text-6xl">
            minesw<span className="text-cyan">1</span>pe
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-ink-500">
            30 players. One identical grid. Clear it clean and clear it first —
            everyone else is racing the same mines, in real time.
          </p>

          <div className="mt-2 flex items-center gap-3">
            <Link href={playHref}>
              <Button size="lg" className="min-w-48">
                Play
              </Button>
            </Link>
          </div>

          {session ? (
            profile && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-800/60 px-4 py-2.5">
                <span className="text-xs font-semibold text-ink-100">{profile.username}</span>
                <span className="h-3 w-px bg-border" />
                <RankBadge rank={profile.rank} size="sm" />
                <span className="h-3 w-px bg-border" />
                <span className="font-hud text-xs text-ink-500">
                  LVL <span className="text-ink-300">{profile.level}</span>
                </span>
                <span className="h-3 w-px bg-border" />
                <span className="font-hud text-xs text-ink-500">
                  RATING <span className="text-ink-300">{profile.rating.toLocaleString()}</span>
                </span>
              </div>
            )
          ) : (
            <Link
              href="/auth?redirect=/play"
              className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-500 hover:text-cyan"
            >
              Sign in to save your stats
            </Link>
          )}
        </motion.div> : <HomeTabPanel key={activeTab} tab={activeTab} profile={profile} session={Boolean(session)} />}

        {activeTab === "Play" && <motion.div animate={{ opacity: 1 }} className="relative z-10 mt-14 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {MODES.map((mode) => (
            <Link
              key={mode.label}
              href={mode.href}
              aria-disabled={mode.soon}
              onClick={(event) => { if (mode.soon) event.preventDefault(); }}
              className={`group flex flex-col items-start gap-2 rounded-lg border border-border-subtle bg-surface-800/60 p-4 transition-all hover:-translate-y-1 hover:border-border-strong hover:bg-surface-700/60 ${mode.soon ? "cursor-not-allowed opacity-55 hover:translate-y-0" : ""}`}
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
        </motion.div>}
      </main>
    </div>
  );
}

function HomeTabPanel({ tab, profile, session }: { tab: string; profile: Profile | null; session: boolean }) {
  const content = {
    Career: { icon: Crosshair, title: "Career", text: session ? "Your competitive identity is active. Finish matches to build rating and experience." : "Play as a guest now, or sign in to preserve your match history and progression." },
    Leaderboards: { icon: Trophy, title: "Leaderboards", text: "Global standings are being connected to persisted match results. Live lobby rankings remain available during every match." },
    Profile: { icon: UserRound, title: profile?.username ?? "Guest profile", text: profile ? `Level ${profile.level} · ${profile.rating.toLocaleString()} rating · ${profile.rank}` : "Guest sessions are private to this browser tab and are not stored." },
    Settings: { icon: SettingsIcon, title: "Settings", text: "Your audio preferences apply immediately and persist after refresh." },
  }[tab] ?? { icon: ShieldCheck, title: tab, text: "Ready." };
  const Icon = content.icon;
  return <motion.section animate={{ opacity: 1, y: 0, scale: 1 }} className="relative z-10 w-full max-w-xl rounded-2xl border border-border bg-surface-800/80 p-7 shadow-[0_24px_80px_rgba(0,0,0,.35)] backdrop-blur-xl">
    <div className="mb-5 flex items-center gap-4"><div className="flex size-11 items-center justify-center rounded-xl border border-cyan/25 bg-cyan/10"><Icon className="size-5 text-cyan" /></div><div><h2 className="font-hud text-xl font-black uppercase tracking-wide">{content.title}</h2><p className="mt-1 text-xs leading-relaxed text-ink-500">{content.text}</p></div></div>
    {tab === "Settings" ? <AudioSettings /> : tab === "Leaderboards" ? <LeaderboardPanel /> : tab === "Career" && profile ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Matches",profile.stats.matchesPlayed],["Wins",profile.stats.wins],["Top 3",profile.stats.top3Finishes],["Win rate",`${profile.stats.winRatePct}%`]].map(([label,value])=><div key={label} className="rounded-lg border border-border-subtle bg-bg-900/70 p-3"><p className="text-[9px] uppercase text-ink-700">{label}</p><p className="mt-1 font-hud text-lg text-ink-100">{value}</p></div>)}</div> : <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border-subtle bg-bg-900/70 p-4"><p className="text-[10px] uppercase text-ink-700">Status</p><p className="mt-1 font-hud text-sm text-success">{session ? "ONLINE" : "GUEST"}</p></div><Link href="/play" className="flex items-center justify-center rounded-lg border border-cyan/30 bg-cyan/10 text-xs font-bold uppercase text-cyan transition hover:bg-cyan/20">Enter arena</Link></div>}
  </motion.section>;
}

type LeaderRow = { id: string; username: string; rating: number; level: number; rank: string };
function LeaderboardPanel() {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const server = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4001";
    fetch(`${server}/api/leaderboard?limit=5`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then((data: {profiles: LeaderRow[]}) => setRows(data.profiles)).catch(() => setRows([]));
    return () => controller.abort();
  }, []);
  if (rows === null) return <div className="rounded-lg border border-border-subtle bg-bg-900/60 p-5 text-center text-xs text-ink-500">Loading standings…</div>;
  if (rows.length === 0) return <div className="rounded-lg border border-border-subtle bg-bg-900/60 p-5 text-center text-xs text-ink-500">No persisted standings yet, or the Render service is waking up.</div>;
  return <div className="overflow-hidden rounded-lg border border-border-subtle">{rows.map((row,index)=><div key={row.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-border-subtle bg-bg-900/60 px-4 py-2.5 last:border-0"><span className="font-hud text-xs text-cyan">#{index+1}</span><div><p className="text-xs font-semibold text-ink-100">{row.username}</p><p className="text-[9px] uppercase text-ink-700">Level {row.level} · {row.rank}</p></div><span className="font-hud text-xs text-ink-300">{row.rating}</span></div>)}</div>;
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
