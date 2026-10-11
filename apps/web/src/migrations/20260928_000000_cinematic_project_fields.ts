import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "owner"."projects" ADD COLUMN "short_title" varchar;
    ALTER TABLE "owner"."projects" ADD COLUMN "project_date" varchar;
    ALTER TABLE "owner"."projects" ADD COLUMN "editorial_note" text;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "owner"."projects" DROP COLUMN "editorial_note";
    ALTER TABLE "owner"."projects" DROP COLUMN "project_date";
    ALTER TABLE "owner"."projects" DROP COLUMN "short_title";
  `)
}
