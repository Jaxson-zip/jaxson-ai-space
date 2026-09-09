import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "owner"."enum_projects_category" AS ENUM('工具应用 · 原型落地', '求职工具 · 开源二次开发', 'AI 产品 · 私有概念探索', '全栈工程 · 真实交付');
  CREATE TYPE "owner"."enum_projects_visibility" AS ENUM('public', 'private');
  CREATE TYPE "owner"."enum_experiences_type" AS ENUM('internship', 'education', 'campus');
  CREATE TYPE "owner"."enum_credentials_category" AS ENUM('award', 'skill', 'certificate');
  CREATE TYPE "owner"."enum_ai_knowledge_category" AS ENUM('internship', 'project', 'skill', 'education', 'jd_match');
  CREATE TYPE "owner"."enum_reflections_type" AS ENUM('daily', 'weekly', 'interview', 'technical');
  CREATE TYPE "owner"."enum_reflections_extraction_status" AS ENUM('pending', 'extracted', 'skipped');
  CREATE TYPE "owner"."enum_memories_category" AS ENUM('project_experience', 'internship_business', 'architecture_thinking', 'pitfall_solution', 'skill_gap_goal');
  CREATE TYPE "owner"."enum_memories_status" AS ENUM('candidate', 'approved', 'archived');
  CREATE TABLE "owner"."projects_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "owner"."projects_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "owner"."projects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"role" varchar NOT NULL,
  	"category" "owner"."enum_projects_category" NOT NULL,
  	"visibility" "owner"."enum_projects_visibility" DEFAULT 'public' NOT NULL,
  	"status" varchar NOT NULL,
  	"summary" varchar NOT NULL,
  	"cover_image_id" integer,
  	"problem" varchar,
  	"approach" varchar,
  	"outcome" varchar,
  	"demo_url" varchar,
  	"repo_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "owner"."experiences_bullets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"bullet" varchar
  );
  
  CREATE TABLE "owner"."experiences_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "owner"."experiences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"organization" varchar NOT NULL,
  	"role" varchar NOT NULL,
  	"period" varchar NOT NULL,
  	"type" "owner"."enum_experiences_type" NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "owner"."credentials" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"category" "owner"."enum_credentials_category" NOT NULL,
  	"year" varchar,
  	"level" varchar,
  	"items" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "owner"."ai_knowledge" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"category" "owner"."enum_ai_knowledge_category" NOT NULL,
  	"content" varchar NOT NULL,
  	"is_public" boolean DEFAULT true,
  	"evidence_tag" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "owner"."reflections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"type" "owner"."enum_reflections_type" DEFAULT 'daily' NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"content" varchar NOT NULL,
  	"challenges" varchar,
  	"solution" varchar,
  	"takeaways" varchar,
  	"next_steps" varchar,
  	"extraction_status" "owner"."enum_reflections_extraction_status" DEFAULT 'pending',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "owner"."memories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"category" "owner"."enum_memories_category" DEFAULT 'project_experience' NOT NULL,
  	"status" "owner"."enum_memories_status" DEFAULT 'candidate' NOT NULL,
  	"content" varchar NOT NULL,
  	"evidence_tag" varchar DEFAULT '本人复盘提炼' NOT NULL,
  	"confidence" numeric DEFAULT 0.95,
  	"source_reflection_id" varchar,
  	"tags" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "owner"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "owner"."users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "owner"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "owner"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "owner"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "owner"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"projects_id" integer,
  	"experiences_id" integer,
  	"credentials_id" integer,
  	"ai_knowledge_id" integer,
  	"reflections_id" integer,
  	"memories_id" integer,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "owner"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "owner"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "owner"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "owner"."projects_tags" ADD CONSTRAINT "projects_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "owner"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."projects_highlights" ADD CONSTRAINT "projects_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "owner"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."projects" ADD CONSTRAINT "projects_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "owner"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "owner"."experiences_bullets" ADD CONSTRAINT "experiences_bullets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "owner"."experiences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."experiences_tags" ADD CONSTRAINT "experiences_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "owner"."experiences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "owner"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "owner"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "owner"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_experiences_fk" FOREIGN KEY ("experiences_id") REFERENCES "owner"."experiences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_credentials_fk" FOREIGN KEY ("credentials_id") REFERENCES "owner"."credentials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_knowledge_fk" FOREIGN KEY ("ai_knowledge_id") REFERENCES "owner"."ai_knowledge"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reflections_fk" FOREIGN KEY ("reflections_id") REFERENCES "owner"."reflections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_memories_fk" FOREIGN KEY ("memories_id") REFERENCES "owner"."memories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "owner"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "owner"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "owner"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "owner"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "owner"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_tags_order_idx" ON "owner"."projects_tags" USING btree ("_order");
  CREATE INDEX "projects_tags_parent_id_idx" ON "owner"."projects_tags" USING btree ("_parent_id");
  CREATE INDEX "projects_highlights_order_idx" ON "owner"."projects_highlights" USING btree ("_order");
  CREATE INDEX "projects_highlights_parent_id_idx" ON "owner"."projects_highlights" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "projects_slug_idx" ON "owner"."projects" USING btree ("slug");
  CREATE INDEX "projects_cover_image_idx" ON "owner"."projects" USING btree ("cover_image_id");
  CREATE INDEX "projects_updated_at_idx" ON "owner"."projects" USING btree ("updated_at");
  CREATE INDEX "projects_created_at_idx" ON "owner"."projects" USING btree ("created_at");
  CREATE INDEX "experiences_bullets_order_idx" ON "owner"."experiences_bullets" USING btree ("_order");
  CREATE INDEX "experiences_bullets_parent_id_idx" ON "owner"."experiences_bullets" USING btree ("_parent_id");
  CREATE INDEX "experiences_tags_order_idx" ON "owner"."experiences_tags" USING btree ("_order");
  CREATE INDEX "experiences_tags_parent_id_idx" ON "owner"."experiences_tags" USING btree ("_parent_id");
  CREATE INDEX "experiences_updated_at_idx" ON "owner"."experiences" USING btree ("updated_at");
  CREATE INDEX "experiences_created_at_idx" ON "owner"."experiences" USING btree ("created_at");
  CREATE INDEX "credentials_updated_at_idx" ON "owner"."credentials" USING btree ("updated_at");
  CREATE INDEX "credentials_created_at_idx" ON "owner"."credentials" USING btree ("created_at");
  CREATE INDEX "ai_knowledge_updated_at_idx" ON "owner"."ai_knowledge" USING btree ("updated_at");
  CREATE INDEX "ai_knowledge_created_at_idx" ON "owner"."ai_knowledge" USING btree ("created_at");
  CREATE INDEX "reflections_updated_at_idx" ON "owner"."reflections" USING btree ("updated_at");
  CREATE INDEX "reflections_created_at_idx" ON "owner"."reflections" USING btree ("created_at");
  CREATE INDEX "memories_updated_at_idx" ON "owner"."memories" USING btree ("updated_at");
  CREATE INDEX "memories_created_at_idx" ON "owner"."memories" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "owner"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "owner"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "owner"."media" USING btree ("filename");
  CREATE INDEX "users_sessions_order_idx" ON "owner"."users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "owner"."users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "owner"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "owner"."users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "owner"."users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "owner"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "owner"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "owner"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "owner"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "owner"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "owner"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "owner"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_projects_id_idx" ON "owner"."payload_locked_documents_rels" USING btree ("projects_id");
  CREATE INDEX "payload_locked_documents_rels_experiences_id_idx" ON "owner"."payload_locked_documents_rels" USING btree ("experiences_id");
  CREATE INDEX "payload_locked_documents_rels_credentials_id_idx" ON "owner"."payload_locked_documents_rels" USING btree ("credentials_id");
  CREATE INDEX "payload_locked_documents_rels_ai_knowledge_id_idx" ON "owner"."payload_locked_documents_rels" USING btree ("ai_knowledge_id");
  CREATE INDEX "payload_locked_documents_rels_reflections_id_idx" ON "owner"."payload_locked_documents_rels" USING btree ("reflections_id");
  CREATE INDEX "payload_locked_documents_rels_memories_id_idx" ON "owner"."payload_locked_documents_rels" USING btree ("memories_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "owner"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "owner"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "owner"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "owner"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "owner"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "owner"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "owner"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "owner"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "owner"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "owner"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "owner"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "owner"."projects_tags" CASCADE;
  DROP TABLE "owner"."projects_highlights" CASCADE;
  DROP TABLE "owner"."projects" CASCADE;
  DROP TABLE "owner"."experiences_bullets" CASCADE;
  DROP TABLE "owner"."experiences_tags" CASCADE;
  DROP TABLE "owner"."experiences" CASCADE;
  DROP TABLE "owner"."credentials" CASCADE;
  DROP TABLE "owner"."ai_knowledge" CASCADE;
  DROP TABLE "owner"."reflections" CASCADE;
  DROP TABLE "owner"."memories" CASCADE;
  DROP TABLE "owner"."media" CASCADE;
  DROP TABLE "owner"."users_sessions" CASCADE;
  DROP TABLE "owner"."users" CASCADE;
  DROP TABLE "owner"."payload_kv" CASCADE;
  DROP TABLE "owner"."payload_locked_documents" CASCADE;
  DROP TABLE "owner"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "owner"."payload_preferences" CASCADE;
  DROP TABLE "owner"."payload_preferences_rels" CASCADE;
  DROP TABLE "owner"."payload_migrations" CASCADE;
  DROP TYPE "owner"."enum_projects_category";
  DROP TYPE "owner"."enum_projects_visibility";
  DROP TYPE "owner"."enum_experiences_type";
  DROP TYPE "owner"."enum_credentials_category";
  DROP TYPE "owner"."enum_ai_knowledge_category";
  DROP TYPE "owner"."enum_reflections_type";
  DROP TYPE "owner"."enum_reflections_extraction_status";
  DROP TYPE "owner"."enum_memories_category";
  DROP TYPE "owner"."enum_memories_status";`)
}
