import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "owner"."projects" ADD COLUMN "featured" boolean DEFAULT false;
    ALTER TABLE "owner"."projects" ADD COLUMN "sort_order" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "owner"."projects" DROP COLUMN "sort_order";
    ALTER TABLE "owner"."projects" DROP COLUMN "featured";
  `)
}
