import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

// Payload 3.92 adds a reset-request timestamp. Existing published projects stay published.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "owner"."users" ADD COLUMN "reset_password_requested_at" timestamp(3) with time zone;
    ALTER TABLE "owner"."projects" ALTER COLUMN "visibility" SET DEFAULT 'private';
  `)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "owner"."projects" ALTER COLUMN "visibility" SET DEFAULT 'public';
    ALTER TABLE "owner"."users" DROP COLUMN "reset_password_requested_at";
  `)
}
