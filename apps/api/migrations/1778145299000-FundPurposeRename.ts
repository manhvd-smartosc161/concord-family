import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rename fund_purpose enum values:
 *   'general'  → 'spending'   (3 core spending funds — cannot archive)
 *   'envelope' → 'savings'    (savings goal funds)
 *   add 'investment'          (investment funds — new)
 */
export class FundPurposeRename1778145299000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop default so the column can be retyped freely
    await queryRunner.query(`ALTER TABLE "funds" ALTER COLUMN "purpose" DROP DEFAULT`);

    // 2. Create new enum type
    await queryRunner.query(`
      CREATE TYPE "funds_purpose_enum_new" AS ENUM ('spending', 'savings', 'investment')
    `);

    // 3. Migrate column to new type, mapping old → new values
    await queryRunner.query(`
      ALTER TABLE "funds"
        ALTER COLUMN "purpose" TYPE "funds_purpose_enum_new"
        USING CASE
          WHEN "purpose"::text = 'general'  THEN 'spending'::funds_purpose_enum_new
          WHEN "purpose"::text = 'envelope' THEN 'savings'::funds_purpose_enum_new
        END
    `);

    // 4. Drop old enum
    await queryRunner.query(`DROP TYPE "funds_purpose_enum"`);

    // 5. Rename new enum to canonical name
    await queryRunner.query(`ALTER TYPE "funds_purpose_enum_new" RENAME TO "funds_purpose_enum"`);

    // 6. Restore default
    await queryRunner.query(`ALTER TABLE "funds" ALTER COLUMN "purpose" SET DEFAULT 'spending'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "funds" ALTER COLUMN "purpose" DROP DEFAULT`);

    await queryRunner.query(`
      CREATE TYPE "funds_purpose_enum_old" AS ENUM ('general', 'envelope')
    `);

    await queryRunner.query(`
      ALTER TABLE "funds"
        ALTER COLUMN "purpose" TYPE "funds_purpose_enum_old"
        USING CASE
          WHEN "purpose"::text = 'spending'    THEN 'general'::funds_purpose_enum_old
          WHEN "purpose"::text = 'savings'     THEN 'envelope'::funds_purpose_enum_old
          WHEN "purpose"::text = 'investment'  THEN 'envelope'::funds_purpose_enum_old
        END
    `);

    await queryRunner.query(`DROP TYPE "funds_purpose_enum"`);
    await queryRunner.query(`ALTER TYPE "funds_purpose_enum_old" RENAME TO "funds_purpose_enum"`);
    await queryRunner.query(`ALTER TABLE "funds" ALTER COLUMN "purpose" SET DEFAULT 'general'`);
  }
}
