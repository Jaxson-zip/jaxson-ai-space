import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "owner"."reflections" ADD COLUMN "inbox_key" varchar;
    ALTER TABLE "owner"."reflections" ADD COLUMN "inbox_digest" varchar;
    ALTER TABLE "owner"."reflections" ADD COLUMN "inbox_reply" varchar;
    ALTER TABLE "owner"."reflections" ADD COLUMN "inbox_count" numeric;
    CREATE UNIQUE INDEX "reflections_inbox_key_idx" ON "owner"."reflections" USING btree ("inbox_key");
    ALTER TABLE "owner"."ai_knowledge" ADD COLUMN "private_memory_key" varchar;
    CREATE UNIQUE INDEX "ai_knowledge_private_memory_key_idx" ON "owner"."ai_knowledge" USING btree ("private_memory_key");
    ALTER TABLE "owner"."ai_knowledge" ALTER COLUMN "is_public" SET DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "owner"."reflections_inbox_key_idx";
    DROP INDEX "owner"."ai_knowledge_private_memory_key_idx";
    ALTER TABLE "owner"."reflections" DROP COLUMN "inbox_key", DROP COLUMN "inbox_digest", DROP COLUMN "inbox_reply", DROP COLUMN "inbox_count";
    ALTER TABLE "owner"."ai_knowledge" DROP COLUMN "private_memory_key";
    ALTER TABLE "owner"."ai_knowledge" ALTER COLUMN "is_public" SET DEFAULT true;
  `)
}
