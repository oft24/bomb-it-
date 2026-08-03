"use client";

import { useState } from "react";
import { DEFAULT_MATCH_SETTINGS } from "@sectorzero/shared-types";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { PlayerCard } from "@/components/lobby/PlayerCard";
import { RoomCodePanel } from "@/components/lobby/RoomCodePanel";
import { SettingsPanel } from "@/components/lobby/SettingsPanel";
import { mockPlayers } from "@/lib/mock";
import { Users } from "lucide-react";

/** Static demo of the lobby at scale (~24 operatives) — no live connection. */
export default function LobbyPreviewPage() {
  const [settings, setSettings] = useState({ ...DEFAULT_MATCH_SETTINGS, maxPlayers: 30 });
  const players = mockPlayers(24, "You");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-8 py-4">
        <Logo />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-700">
          Design Preview — Not Connected
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="flex flex-1 flex-col gap-4">
          <RoomCodePanel roomId="7KQ9XZ" />

          <Panel className="flex flex-1 flex-col overflow-hidden">
            <PanelHeader>
              <div className="flex items-center gap-2">
                <Users className="size-4 text-ink-500" />
                <PanelTitle>Operatives</PanelTitle>
              </div>
              <span className="font-hud text-xs text-ink-500">
                {players.length} / {settings.maxPlayers}
              </span>
            </PanelHeader>
            <div className="grid max-h-[560px] grid-cols-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2 xl:grid-cols-3">
              {players.map((p) => (
                <PlayerCard key={p.id} player={p} isLocal={p.id === "local-player"} />
              ))}
              {Array.from({ length: Math.max(0, settings.maxPlayers - players.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex h-[52px] items-center justify-center rounded-md border border-dashed border-border-subtle text-[10px] uppercase tracking-wide text-ink-900"
                >
                  Open Slot
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-80">
          <SettingsPanel settings={settings} editable onChange={(p) => setSettings((s) => ({ ...s, ...p }))} />
          <Panel className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-500">Ready</span>
              <span className="font-hud text-ink-300">18 / {players.length}</span>
            </div>
            <Button size="lg">Start Match</Button>
          </Panel>
        </div>
      </main>
    </div>
  );
}
