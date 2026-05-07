import { MigrationInterface, QueryRunner } from 'typeorm';

export class SwitchToYearlyAiCache1778178107232 implements MigrationInterface {
  name = 'SwitchToYearlyAiCache1778178107232';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "monthly_ai_dates_cache"`);
    await queryRunner.query(
      `CREATE TABLE "yearly_ai_dates_cache" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "year" integer NOT NULL, "items" jsonb NOT NULL, "generated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_8962ffa8c08c70a9d60154880ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f19eacfc6325fa560794490cbc" ON "yearly_ai_dates_cache" ("year") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f19eacfc6325fa560794490cbc"`,
    );
    await queryRunner.query(`DROP TABLE "yearly_ai_dates_cache"`);
  }
}
