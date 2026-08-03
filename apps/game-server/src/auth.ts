import { createClient } from "@supabase/supabase-js";
import { prisma } from "./db.js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY environment variables");
}

// Server-side client used only to verify tokens against Supabase's auth API
// (auth.getUser sends the JWT to Supabase and returns the user if valid —
// no service-role key or local JWT secret needed for this).
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface AuthedProfile {
  id: string;
  username: string;
  rating: number;
  level: number;
  xp: number;
}

/**
 * Verifies a Supabase access token and returns (creating if necessary) the
 * matching profile row. The DB trigger on auth.users normally creates the
 * profile at signup — this upsert is just a defensive fallback so a race or
 * a missed trigger never locks a real, authenticated user out of playing.
 */
export async function verifyAccessToken(accessToken: string): Promise<AuthedProfile | null> {
  if (!accessToken) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  const user = data.user;
  const fallbackUsername =
    (user.user_metadata?.username as string | undefined)?.slice(0, 20) ||
    user.email?.split("@")[0]?.slice(0, 20) ||
    `Operative${user.id.slice(0, 6)}`;

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
  };
}
