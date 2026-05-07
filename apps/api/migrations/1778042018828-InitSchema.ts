import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1778042018828 implements MigrationInterface {
  name = 'InitSchema1778042018828';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "salary_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "pct_to_personal" integer NOT NULL, "pct_to_joint" integer NOT NULL, "fixed_amount_to_joint" bigint, CONSTRAINT "PK_d74fef3f2a320a5342d2fec2302" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('husband', 'wife')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "role" "public"."users_role_enum" NOT NULL, "email" character varying(255) NOT NULL, "hashed_password" character varying(255) NOT NULL, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."funds_type_enum" AS ENUM('personal', 'joint')`,
    );
    await queryRunner.query(
      `CREATE TABLE "funds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "type" "public"."funds_type_enum" NOT NULL, "owner_id" uuid, "balance" bigint NOT NULL DEFAULT '0', CONSTRAINT "PK_d785f4bb8f680f3febd40718f68" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_source_enum" AS ENUM('chat', 'form', 'photo', 'csv', 'recurring', 'salary')`,
    );
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "fund_id" uuid NOT NULL, "category_id" uuid, "amount" bigint NOT NULL, "note" text, "raw_text" text, "source" "public"."transactions_source_enum" NOT NULL, "date" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fe815e76e6d1e733cebfd0f903" ON "transactions" ("user_id", "date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3e3fdd0182d41724fd5e39e5b2" ON "transactions" ("fund_id", "date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "parent_id" uuid, "icon" character varying(16), "color" character varying(32), "is_essential" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b0be371d28245da6e4f4b6187" ON "categories" ("name") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."anomalies_severity_enum" AS ENUM('low', 'medium', 'high')`,
    );
    await queryRunner.query(
      `CREATE TABLE "anomalies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "detected_at" TIMESTAMP WITH TIME ZONE NOT NULL, "category_id" uuid, "fund_id" uuid, "severity" "public"."anomalies_severity_enum" NOT NULL, "message" text NOT NULL, "resolved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_85dc6428a06c59628d40b1c5f8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."budgets_period_enum" AS ENUM('monthly', 'weekly')`,
    );
    await queryRunner.query(
      `CREATE TABLE "budgets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fund_id" uuid, "category_id" uuid, "monthly_limit" bigint NOT NULL, "period" "public"."budgets_period_enum" NOT NULL DEFAULT 'monthly', CONSTRAINT "PK_9c8a51748f82387644b773da482" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."goals_period_enum" AS ENUM('month', 'year')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."goals_type_enum" AS ENUM('save', 'spend_under')`,
    );
    await queryRunner.query(
      `CREATE TABLE "goals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, "target_amount" bigint NOT NULL, "period" "public"."goals_period_enum" NOT NULL, "type" "public"."goals_type_enum" NOT NULL, "start_date" date NOT NULL, "deadline" date NOT NULL, CONSTRAINT "PK_26e17b251afab35580dff769223" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."insights_type_enum" AS ENUM('daily', 'weekly', 'monthly', 'anomaly', 'big_buy', 'ad_hoc')`,
    );
    await queryRunner.query(
      `CREATE TABLE "insights" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "generated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "type" "public"."insights_type_enum" NOT NULL, "content_md" text NOT NULL, "period_start" date, "period_end" date, "referenced_txn_ids" uuid array, CONSTRAINT "PK_8616ab29fa49b7942541b8c964a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_656252e1d7fad592ceacb01f56" ON "insights" ("type", "period_start") `,
    );
    await queryRunner.query(
      `ALTER TABLE "salary_rules" ADD CONSTRAINT "FK_ae588fd5c4b1f019260b2d8069f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "funds" ADD CONSTRAINT "FK_365fda657c455c020917a9bec3c" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_5d5caaa3ab51a790c1404a0d77e" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "anomalies" ADD CONSTRAINT "FK_db9df9097231c4cf09a1bb12e9f" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "anomalies" ADD CONSTRAINT "FK_b86be338e846b0865940cb1efd6" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD CONSTRAINT "FK_4d1e7bba25cd32dbe7113c2b0d6" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD CONSTRAINT "FK_4bb589bf6db49e8c1fd6af05f49" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_88b78010581f2d293699d064441" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "FK_88b78010581f2d293699d064441"`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" DROP CONSTRAINT "FK_4bb589bf6db49e8c1fd6af05f49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" DROP CONSTRAINT "FK_4d1e7bba25cd32dbe7113c2b0d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "anomalies" DROP CONSTRAINT "FK_b86be338e846b0865940cb1efd6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "anomalies" DROP CONSTRAINT "FK_db9df9097231c4cf09a1bb12e9f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_5d5caaa3ab51a790c1404a0d77e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "funds" DROP CONSTRAINT "FK_365fda657c455c020917a9bec3c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "salary_rules" DROP CONSTRAINT "FK_ae588fd5c4b1f019260b2d8069f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_656252e1d7fad592ceacb01f56"`,
    );
    await queryRunner.query(`DROP TABLE "insights"`);
    await queryRunner.query(`DROP TYPE "public"."insights_type_enum"`);
    await queryRunner.query(`DROP TABLE "goals"`);
    await queryRunner.query(`DROP TYPE "public"."goals_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."goals_period_enum"`);
    await queryRunner.query(`DROP TABLE "budgets"`);
    await queryRunner.query(`DROP TYPE "public"."budgets_period_enum"`);
    await queryRunner.query(`DROP TABLE "anomalies"`);
    await queryRunner.query(`DROP TYPE "public"."anomalies_severity_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8b0be371d28245da6e4f4b6187"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3e3fdd0182d41724fd5e39e5b2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fe815e76e6d1e733cebfd0f903"`,
    );
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_source_enum"`);
    await queryRunner.query(`DROP TABLE "funds"`);
    await queryRunner.query(`DROP TYPE "public"."funds_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TABLE "salary_rules"`);
  }
}
