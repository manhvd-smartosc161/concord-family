import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES_WITH_BOTH = [
  'families',
  'family_invitations',
  'funds',
  'categories',
  'transactions',
  'goals',
  'important_dates',
  'yearly_ai_dates_cache',
  'chat_sessions',
  'salary_rules',
  'anomalies',
  'budgets',
  'insights',
];

const TABLES_CREATED_ONLY = ['chat_messages'];

export class FixTimestampColumnNames1779100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES_WITH_BOTH) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "created_at" TO "createdAt"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "updated_at" TO "updatedAt"`,
      );
    }
    for (const table of TABLES_CREATED_ONLY) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "created_at" TO "createdAt"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES_WITH_BOTH) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "createdAt" TO "created_at"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "updatedAt" TO "updated_at"`,
      );
    }
    for (const table of TABLES_CREATED_ONLY) {
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "createdAt" TO "created_at"`,
      );
    }
  }
}
