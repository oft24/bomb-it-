import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

// Pooled (pgbouncer transaction-mode) connection — right shape for a live
// server issuing many short queries. Migrations use DIRECT_URL instead
// (see prisma.config.ts), since DDL doesn't play well with transaction pooling.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
