import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Persistence is optional. Guests play without an account and nothing about
 * their matches is stored, so a server with no DATABASE_URL is a perfectly
 * valid deployment — it just can't serve profiles, leaderboards or history.
 * Everything that writes must go through `prisma`-is-null checks rather than
 * assuming a live client.
 */
export const databaseEnabled = Boolean(process.env.DATABASE_URL);

// Pooled (pgbouncer transaction-mode) connection — right shape for a live
// server issuing many short queries. Migrations use DIRECT_URL instead
// (see prisma.config.ts), since DDL doesn't play well with transaction pooling.
export const prisma = databaseEnabled
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  : null;

if (!databaseEnabled) {
  console.warn("[db] DATABASE_URL not set — running without persistence (guest-only mode).");
}
