import { MigrationInterface, QueryRunner } from 'typeorm';

export class FamilyMultiTenancy1779000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "anomalies" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "insights" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "budgets" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "goals" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "important_dates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "yearly_ai_dates_cache" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "salary_rules" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "funds" CASCADE`);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."funds_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."funds_purpose_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."transactions_source_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."goals_period_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."goals_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."important_dates_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."chat_messages_role_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."anomalies_severity_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."insights_type_enum" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."budgets_period_enum" CASCADE`);

    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "family_id" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" varchar(8) NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthdate" date NULL`);
    await queryRunner.query(`TRUNCATE TABLE "users" CASCADE`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "gender" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL`);

    await queryRunner.query(`
      CREATE TABLE "families" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "name" varchar(120) NOT NULL,
        "wedding_date" date NULL,
        "created_by_id" uuid NOT NULL,
        "completed_at" timestamptz NULL,
        CONSTRAINT "PK_families" PRIMARY KEY ("id"),
        CONSTRAINT "FK_families_creator" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "family_invitations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "email" varchar(320) NOT NULL,
        "token" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz NULL,
        "accepted_by_id" uuid NULL,
        CONSTRAINT "PK_family_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_family_invitations_token" UNIQUE ("token"),
        CONSTRAINT "FK_invitations_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invitations_creator" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_invitations_family" ON "family_invitations" ("family_id")`);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_family"
      FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "funds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "type" varchar(16) NOT NULL,
        "owner_id" uuid NULL,
        "balance" bigint NOT NULL DEFAULT 0,
        "purpose" varchar(16) NOT NULL DEFAULT 'spending',
        "target_amount" bigint NULL,
        "target_deadline" date NULL,
        "monthly_contribution_target" bigint NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "archived_at" timestamptz NULL,
        CONSTRAINT "PK_funds" PRIMARY KEY ("id"),
        CONSTRAINT "FK_funds_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_funds_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_funds_family" ON "funds" ("family_id")`);

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "parent_id" uuid NULL,
        "icon" varchar(16) NULL,
        "color" varchar(32) NULL,
        "is_essential" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_categories_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_categories_family" ON "categories" ("family_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_categories_name" ON "categories" ("name")`);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "fund_id" uuid NOT NULL,
        "category_id" uuid NULL,
        "amount" bigint NOT NULL,
        "note" text NULL,
        "raw_text" text NULL,
        "source" varchar(16) NOT NULL,
        "date" timestamptz NOT NULL,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_family" ON "transactions" ("family_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_fund_date" ON "transactions" ("fund_id", "date")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_user_date" ON "transactions" ("user_id", "date")`);

    await queryRunner.query(`
      CREATE TABLE "goals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "user_id" uuid NULL,
        "target_amount" bigint NOT NULL,
        "period" varchar(8) NOT NULL,
        "type" varchar(16) NOT NULL,
        "start_date" date NOT NULL,
        "deadline" date NOT NULL,
        CONSTRAINT "PK_goals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_goals_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_goals_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_goals_family" ON "goals" ("family_id")`);

    await queryRunner.query(`
      CREATE TABLE "important_dates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "type" varchar(32) NOT NULL DEFAULT 'other',
        "date" date NOT NULL,
        "is_lunar" boolean NOT NULL DEFAULT false,
        "remind_days_before" integer[] NOT NULL DEFAULT '{0}',
        "notes" text NULL,
        "created_by_id" uuid NOT NULL,
        CONSTRAINT "PK_important_dates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_important_dates_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_important_dates_creator" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_important_dates_family" ON "important_dates" ("family_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_important_dates_date" ON "important_dates" ("date")`);

    await queryRunner.query(`
      CREATE TABLE "yearly_ai_dates_cache" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "year" integer NOT NULL,
        "items" jsonb NOT NULL,
        "generated_at" timestamptz NOT NULL,
        CONSTRAINT "PK_yearly_ai_dates_cache" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_yearly_ai_dates_cache_family_year" UNIQUE ("family_id", "year"),
        CONSTRAINT "FK_yearly_ai_dates_cache_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_yearly_ai_dates_cache_family" ON "yearly_ai_dates_cache" ("family_id")`);

    await queryRunner.query(`
      CREATE TABLE "salary_rules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "pct_to_personal" integer NOT NULL,
        "pct_to_joint" integer NOT NULL,
        "fixed_amount_to_joint" bigint NULL,
        CONSTRAINT "PK_salary_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_salary_rules_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_salary_rules_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_salary_rules_family" ON "salary_rules" ("family_id")`);

    await queryRunner.query(`
      CREATE TABLE "insights" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "generated_at" timestamptz NOT NULL,
        "type" varchar(16) NOT NULL,
        "content_md" text NOT NULL,
        "period_start" date NULL,
        "period_end" date NULL,
        "referenced_txn_ids" uuid[] NULL,
        CONSTRAINT "PK_insights" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_insights_type_period_start" ON "insights" ("type", "period_start")`);

    await queryRunner.query(`
      CREATE TABLE "anomalies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "detected_at" timestamptz NOT NULL,
        "category_id" uuid NULL,
        "fund_id" uuid NULL,
        "severity" varchar(8) NOT NULL,
        "message" text NOT NULL,
        "resolved_at" timestamptz NULL,
        CONSTRAINT "PK_anomalies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_anomalies_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_anomalies_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "budgets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "fund_id" uuid NULL,
        "category_id" uuid NULL,
        "monthly_limit" bigint NOT NULL,
        "period" varchar(8) NOT NULL DEFAULT 'monthly',
        CONSTRAINT "PK_budgets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_budgets_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_budgets_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "chat_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "family_id" uuid NOT NULL,
        "fund_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "title" varchar(200) NOT NULL DEFAULT 'Cuộc trò chuyện mới',
        "last_message_at" timestamptz NOT NULL,
        CONSTRAINT "PK_chat_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_sessions_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_sessions_fund" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_sessions_creator" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_chat_sessions_family" ON "chat_sessions" ("family_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_sessions_fund_last_msg" ON "chat_sessions" ("fund_id", "last_message_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_sessions_creator_last_msg" ON "chat_sessions" ("created_by_id", "last_message_at")`);

    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "session_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" varchar(8) NOT NULL,
        "text" text NOT NULL,
        "actions_json" jsonb NULL,
        "usage_input_tokens" integer NULL,
        "usage_output_tokens" integer NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_messages_session" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_messages_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_session_created_at" ON "chat_messages" ("session_id", "created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error('FamilyMultiTenancy migration is not reversible. Restore DB from backup.');
  }
}
