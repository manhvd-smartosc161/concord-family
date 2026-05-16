import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsLegacyToDebts1779000000000 implements MigrationInterface {
  name = 'AddIsLegacyToDebts1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "debts" ADD "is_legacy" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "is_legacy"`);
  }
}
