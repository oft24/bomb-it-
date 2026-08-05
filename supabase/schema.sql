-- Sector Zero — Supabase schema setup.
--
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- for a fresh project. It's safe to re-run: every statement is idempotent.
--
-- The table DDL below mirrors apps/game-server/prisma/schema.prisma exactly
-- (generated via `npx prisma migrate diff --from-empty --to-schema` from that
-- file) — if you change the Prisma schema, regenerate this section the same
-- way and keep the trigger/RLS sections below it as-is.

-- === Tables (from Prisma schema) ============================================

-- id is UUID, not TEXT: it carries the Supabase auth user id and is a foreign
-- key onto auth.users(id), which is uuid. Postgres will not build a foreign key
-- between text and uuid, so the earlier TEXT version of this file could never
-- have been applied — it failed with 42804 on the profiles_id_fkey statement.
CREATE TABLE IF NOT EXISTS "profiles" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "matches" (
    "id" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "mine_count" INTEGER NOT NULL,
    "penalty_mode" TEXT NOT NULL,
    "ranked" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "match_players" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    -- Must match profiles.id exactly, for the same foreign-key reason.
    "profile_id" UUID,
    "username" TEXT NOT NULL,
    "placement" INTEGER NOT NULL,
    "finish_time_ms" INTEGER,
    "mistakes" INTEGER NOT NULL,
    "accuracy_pct" DOUBLE PRECISION NOT NULL,
    "rating_change" INTEGER NOT NULL,
    "xp_gained" INTEGER NOT NULL,

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "profiles_username_key" ON "profiles"("username");
CREATE INDEX IF NOT EXISTS "match_players_profile_id_idx" ON "match_players"("profile_id");
CREATE INDEX IF NOT EXISTS "match_players_match_id_idx" ON "match_players"("match_id");

DO $$ BEGIN
  ALTER TABLE "match_players"
    ADD CONSTRAINT "match_players_match_id_fkey"
    FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "match_players"
    ADD CONSTRAINT "match_players_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- profiles.id is the Supabase auth user id, not an independently generated
-- key — this FK plus the trigger below keep the two in lockstep.
DO $$ BEGIN
  ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_id_fkey"
    FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- === Auto-create a profile on signup ========================================
-- Reads the callsign passed as `data: { username }` at signUp() time; falls
-- back to the email's local part if that's missing.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    new.id,
    COALESCE(
      NULLIF(TRIM(new.raw_user_meta_data->>'username'), ''),
      SPLIT_PART(new.email, '@', 1),
      'Operative' || SUBSTRING(new.id::text, 1, 6)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- === Row Level Security ======================================================
-- The game-server connects with the `postgres` role (via the pooler), which
-- bypasses RLS — these policies only govern any *direct* client access, and
-- exist so the tables aren't flagged as unprotected in the Supabase dashboard.

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_players" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are publicly readable" ON "profiles";
CREATE POLICY "Profiles are publicly readable" ON "profiles"
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON "profiles";
-- No ::text cast: both sides are uuid now, and casting one of them made this
-- fail with 42883 (operator does not exist: text = uuid).
CREATE POLICY "Users can update their own profile" ON "profiles"
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Matches are publicly readable" ON "matches";
CREATE POLICY "Matches are publicly readable" ON "matches"
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Match results are publicly readable" ON "match_players";
CREATE POLICY "Match results are publicly readable" ON "match_players"
  FOR SELECT USING (true);
