import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { RankTier } from "@sectorzero/shared-types";

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4001";

export interface ProfileStats {
  matchesPlayed: number;
  wins: number;
  top3Finishes: number;
  winRatePct: number;
  avgPlacement: number | null;
  bestTimeMs: number | null;
}

export interface Profile {
  id: string;
  username: string;
  rating: number;
  level: number;
  xp: number;
  rank: RankTier;
  stats: ProfileStats;
}

interface AuthStoreState {
  initialized: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  authError: string | null;
  pendingConfirmation: boolean;

  init: () => void;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthError: () => void;
}

let initStarted = false;

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  initialized: false,
  session: null,
  user: null,
  profile: null,
  authError: null,
  pendingConfirmation: false,

  init: () => {
    if (initStarted) return;
    initStarted = true;

    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, initialized: true });
      if (data.session) get().refreshProfile();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session) get().refreshProfile();
      else set({ profile: null });
    });
  },

  signUp: async (email, password, username) => {
    set({ authError: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) {
      set({ authError: error.message });
      return;
    }
    if (!data.session) {
      // Email confirmation is required before a session is issued.
      set({ pendingConfirmation: true });
    }
  },

  signIn: async (email, password) => {
    set({ authError: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) set({ authError: error.message });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  refreshProfile: async () => {
    const token = get().session?.access_token;
    if (!token) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const profile = (await res.json()) as Profile;
      set({ profile });
    } catch {
      // Profile is a nice-to-have display layer — a failed fetch shouldn't block play.
    }
  },

  clearAuthError: () => set({ authError: null }),
}));
