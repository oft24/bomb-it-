"use client";

import type { MatchSettings, PenaltyMode } from "@sectorzero/shared-types";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/Panel";
import { cn } from "@/lib/utils";

interface BoardPreset {
  label: string;
  width: number;
  height: number;
  mineCount: number;
  casinoMode: boolean;
  hint: string;
}

// RANDOM rides on the RECON grid deliberately: with a table game between you and
// every single cell, a full-size board would take all night.
const BOARD_PRESETS: BoardPreset[] = [
  { label: "RECON", width: 12, height: 12, mineCount: 20, casinoMode: false, hint: "Small and quick" },
  { label: "STANDARD", width: 24, height: 24, mineCount: 99, casinoMode: false, hint: "The classic race" },
  { label: "SIEGE", width: 30, height: 24, mineCount: 180, casinoMode: false, hint: "Long and brutal" },
  {
    label: "RANDOM",
    width: 12,
    height: 12,
    mineCount: 20,
    casinoMode: true,
    hint: "Casino mode — beat the house to open each cell",
  },
];

const PENALTY_OPTIONS: { value: PenaltyMode; label: string; hint: string }[] = [
  { value: "RACE", label: "Race", hint: "+3s penalty, keep racing" },
  { value: "CLASSIC_ELIMINATION", label: "Elimination", hint: "One mistake, you're out" },
  { value: "HARDCORE", label: "Hardcore", hint: "Elimination, faster pace" },
  { value: "CHAOS", label: "Chaos", hint: "Brief disruption, no elimination" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        {label}
      </span>
      {children}
    </div>
  );
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
        on ? "bg-cyan" : "bg-surface-600",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-bg-950 transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function SettingsPanel({
  settings,
  editable,
  onChange,
}: {
  settings: MatchSettings;
  editable: boolean;
  onChange: (partial: Partial<MatchSettings>) => void;
}) {
  // RECON and RANDOM share a grid, so casinoMode is what tells them apart.
  const activePreset = BOARD_PRESETS.find(
    (p) =>
      p.width === settings.boardWidth &&
      p.height === settings.boardHeight &&
      p.mineCount === settings.mineCount &&
      p.casinoMode === settings.casinoMode,
  )?.label;

  return (
    <Panel className="flex flex-col gap-5 p-5">
      <PanelHeader className="-mx-5 -mt-5 px-5">
        <PanelTitle>Match Settings</PanelTitle>
        {!editable && <span className="text-[10px] font-hud text-ink-700">HOST ONLY</span>}
      </PanelHeader>

      <Field label="Grid">
        <div className="grid grid-cols-2 gap-2">
          {BOARD_PRESETS.map((preset) => (
            <button
              key={preset.label}
              disabled={!editable}
              title={preset.hint}
              onClick={() =>
                onChange({
                  boardWidth: preset.width,
                  boardHeight: preset.height,
                  mineCount: preset.mineCount,
                  casinoMode: preset.casinoMode,
                })
              }
              className={cn(
                "flex-1 rounded-md border px-2 py-2 text-xs font-bold uppercase tracking-wide transition-colors",
                activePreset === preset.label
                  ? preset.casinoMode
                    ? "border-warning/60 bg-warning/10 text-warning"
                    : "border-cyan/50 bg-cyan/10 text-cyan"
                  : "border-border-subtle bg-surface-700 text-ink-500 hover:text-ink-300",
                !editable && "pointer-events-none",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="font-hud text-xs text-ink-500">
          {settings.boardWidth} × {settings.boardHeight} — {settings.mineCount} mines
        </div>
        {settings.casinoMode && (
          <div className="rounded-md border border-warning/30 bg-warning/5 px-2.5 py-2 text-[11px] leading-snug text-warning">
            Every cell you open is a bet: blackjack, roulette or dice against the
            house. Lose the hand and the cell stays shut.
          </div>
        )}
      </Field>

      <Field label={`Max Operatives — ${settings.maxPlayers}`}>
        <input
          type="range"
          min={2}
          max={30}
          value={settings.maxPlayers}
          disabled={!editable}
          onChange={(e) => onChange({ maxPlayers: Number(e.target.value) })}
          className="accent-cyan"
        />
      </Field>

      <Field label="Penalty Mode">
        <div className="grid grid-cols-2 gap-2">
          {PENALTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              disabled={!editable}
              onClick={() => onChange({ penaltyMode: opt.value })}
              title={opt.hint}
              className={cn(
                "rounded-md border px-2 py-1.5 text-left text-xs font-semibold transition-colors",
                settings.penaltyMode === opt.value
                  ? "border-cyan/50 bg-cyan/10 text-cyan"
                  : "border-border-subtle bg-surface-700 text-ink-400 hover:text-ink-200",
                !editable && "pointer-events-none",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="flex items-center justify-between">
        <Field label="Ranked Match">
          <span className="text-xs text-ink-500">Affects rating</span>
        </Field>
        <Toggle on={settings.ranked} disabled={!editable} onClick={() => onChange({ ranked: !settings.ranked })} />
      </div>

      <div className="flex items-center justify-between">
        <Field label="Spectators">
          <span className="text-xs text-ink-500">Allow observers</span>
        </Field>
        <Toggle
          on={settings.spectatorsAllowed}
          disabled={!editable}
          onClick={() => onChange({ spectatorsAllowed: !settings.spectatorsAllowed })}
        />
      </div>
    </Panel>
  );
}
