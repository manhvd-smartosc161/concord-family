import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupDuplicateRootCategories1779700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM categories
      WHERE id IN (
        SELECT c.id FROM categories c
        WHERE c.parent_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.category_id = c.id)
          AND NOT EXISTS (SELECT 1 FROM categories child WHERE child.parent_id = c.id)
          AND EXISTS (
            SELECT 1 FROM categories c2
            WHERE c2.family_id = c.family_id
              AND c2.name = c.name
              AND c2.parent_id IS NOT NULL
          )
      )
    `);
  }

  public async down(): Promise<void> {
    // Cleanup migration: cannot restore deleted duplicate rows.
  }
}
