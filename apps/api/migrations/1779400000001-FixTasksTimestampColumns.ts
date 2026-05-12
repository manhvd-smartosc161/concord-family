import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTasksTimestampColumns1779400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks RENAME COLUMN created_at TO "createdAt";
      ALTER TABLE tasks RENAME COLUMN updated_at TO "updatedAt";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks RENAME COLUMN "createdAt" TO created_at;
      ALTER TABLE tasks RENAME COLUMN "updatedAt" TO updated_at;
    `);
  }
}
