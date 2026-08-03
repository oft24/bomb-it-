import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations run DDL, which doesn't play well with pgbouncer's transaction
// pooling — use the direct (session-mode) connection here. The app's own
// PrismaClient uses the pooled DATABASE_URL instead (see src/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
