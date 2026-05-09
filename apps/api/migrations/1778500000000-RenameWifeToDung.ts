import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameWifeToDung1778500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "name" = 'Dung' WHERE "name" = 'Vợ' AND "role" = 'wife'`,
    );
    await queryRunner.query(
      `UPDATE "funds" SET "name" = 'Quỹ Dung' WHERE "name" = 'Quỹ Vợ'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "funds" SET "name" = 'Quỹ Vợ' WHERE "name" = 'Quỹ Dung'`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "name" = 'Vợ' WHERE "name" = 'Dung' AND "role" = 'wife'`,
    );
  }
}
