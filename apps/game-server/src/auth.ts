import { createClient } from "@supabase/supabase-js";
import { prisma } from "./db.js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

/**
 * Accounts are optional: guests join with a name and play a fully real match.
 * So a missing Supabase config is a valid deployment (guest-only) rather than a
 * fatal error — it just means no one can sign in on this server.
 */
export const accountsEnabled = Boolean(supabaseUrl && supabaseKey);

// Server-side client used only to verify tokens against Supabase's auth API
// (auth.getUser sends the JWT to Supabase and returns the user if valid —
// no service-role key or local JWT secret needed for this).
const supabase = accountsEnabled
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

if (!accountsEnabled) {
  console.warn("[auth] Supabase not configured — sign-in disabled, guests only.");
}

export interface AuthedProfile {
  id: string;
  username: string;
  rating: number;
  level: number;
  xp: number;
  isGuest: boolean;
}

const GUEST_DEFAULTS = { rating: 1000, level: 1, xp: 0 };
const MAX_USERNAME_LENGTH = 20;

// C0/C1 controls plus the zero-width and bidi-override range: all invisible in a
// leaderboard row, all usable to spoof another player's name.
const INVISIBLE_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

/**
 * Strips invisible characters and collapses whitespace so a guest can't inject
 * layout-breaking or impersonating names into everyone else's leaderboard.
 */
export function sanitizeGuestName(raw: string): string | null {
  const cleaned = raw
    .replace(INVISIBLE_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_USERNAME_LENGTH);
  return cleaned.length >= 2 ? cleaned : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mints a throwaway identity for a name-only player. The id is random rather
 * than derived from the name, so two guests picking "Luis" stay distinct
 * players instead of colliding into one session.
 *
 * `existingId` lets a guest who reloaded resume as the same player. It's only
 * honoured if it's a well-formed UUID, so a client can't hand itself an id that
 * collides with an account id (those are bare UUIDs, these are `guest:`-prefixed).
 */
export function createGuestProfile(rawName: string, existingId?: string): AuthedProfile | null {
  const username = sanitizeGuestName(rawName);
  if (!username) return null;
  const id = existingId && UUID_RE.test(existingId) ? existingId : crypto.randomUUID();
  return { id: `guest:${id}`, username, ...GUEST_DEFAULTS, isGuest: true };
}

/**
 * Verifies a Supabase access token and returns (creating if necessary) the
 * matching profile row. The DB trigger on auth.users normally creates the
 * profile at signup — this upsert is just a defensive fallback so a race or
 * a missed trigger never locks a real, authenticated user out of playing.
 */
export async function verifyAccessToken(accessToken: string): Promise<AuthedProfile | null> {
  if (!accessToken || !supabase) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  const user = data.user;
  const fallbackUsername =
    (user.user_metadata?.username as string | undefined)?.slice(0, MAX_USERNAME_LENGTH) ||
    user.email?.split("@")[0]?.slice(0, MAX_USERNAME_LENGTH) ||
    `Operative${user.id.slice(0, 6)}`;

  // Without a database there's no profile row to read; the verified token is
  // still proof of identity, so let them play with defaults.
  if (!prisma) {
    return { id: user.id, username: fallbackUsername, ...GUEST_DEFAULTS, isGuest: false };
  }

  const profile = await prisma.profile.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, username: fallbackUsername },
  });

  return {
    id: profile.id,
    username: profile.username,
    rating: profile.rating,
    level: profile.level,
    xp: profile.xp,
    isGuest: false,
  };
}
