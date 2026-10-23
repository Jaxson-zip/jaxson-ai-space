import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

// The project dialog's demo video, linked to the media library the same way as the cover image.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "owner"."projects" ADD COLUMN "demo_video_id" integer;
    ALTER TABLE "owner"."projects" ADD CONSTRAINT "projects_demo_video_id_media_id_fk" FOREIGN KEY ("demo_video_id") REFERENCES "owner"."media"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "projects_demo_video_idx" ON "owner"."projects" USING btree ("demo_video_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "owner"."projects_demo_video_idx";
    ALTER TABLE "owner"."projects" DROP CONSTRAINT "projects_demo_video_id_media_id_fk";
    ALTER TABLE "owner"."projects" DROP COLUMN "demo_video_id";
  `)
}
