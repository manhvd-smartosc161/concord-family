import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMonthlyAiCache1778175898509 implements MigrationInterface {
    name = 'AddMonthlyAiCache1778175898509'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "monthly_ai_dates_cache" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "year" integer NOT NULL, "month" integer NOT NULL, "items" jsonb NOT NULL, "generated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_e507c72c34482a5e030f0b5a545" UNIQUE ("year", "month"), CONSTRAINT "PK_61a4db782395909c92a1e9e5126" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1832bfc710de86c106db53020b" ON "monthly_ai_dates_cache" ("year") `);
        await queryRunner.query(`CREATE INDEX "IDX_fbf8d085f5a7dc7736b6211cd1" ON "monthly_ai_dates_cache" ("month") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fbf8d085f5a7dc7736b6211cd1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1832bfc710de86c106db53020b"`);
        await queryRunner.query(`DROP TABLE "monthly_ai_dates_cache"`);
    }

}
