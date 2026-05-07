import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnvelopeFields1778090863334 implements MigrationInterface {
  name = 'AddEnvelopeFields1778090863334';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."funds_purpose_enum" AS ENUM('general', 'envelope')`,
    );
    await queryRunner.query(
      `ALTER TABLE "funds" ADD "purpose" "public"."funds_purpose_enum" NOT NULL DEFAULT 'general'`,
    );
    await queryRunner.query(`ALTER TABLE "funds" ADD "target_amount" bigint`);
    await queryRunner.query(`ALTER TABLE "funds" ADD "target_deadline" date`);
    await queryRunner.query(
      `ALTER TABLE "funds" ADD "monthly_contribution_target" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "funds" ADD "display_order" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "funds" ADD "archived_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "funds" DROP COLUMN "archived_at"`);
    await queryRunner.query(`ALTER TABLE "funds" DROP COLUMN "display_order"`);
    await queryRunner.query(
      `ALTER TABLE "funds" DROP COLUMN "monthly_contribution_target"`,
    );
    await queryRunner.query(
      `ALTER TABLE "funds" DROP COLUMN "target_deadline"`,
    );
    await queryRunner.query(`ALTER TABLE "funds" DROP COLUMN "target_amount"`);
    await queryRunner.query(`ALTER TABLE "funds" DROP COLUMN "purpose"`);
    await queryRunner.query(`DROP TYPE "public"."funds_purpose_enum"`);
  }
}
