import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVersionToYearlyAiCache1779200000000
  implements MigrationInterface
{
  name = 'AddVersionToYearlyAiCache1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "yearly_ai_dates_cache" ADD COLUMN "version" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "yearly_ai_dates_cache" DROP COLUMN "version"`,
    );
  }
}
