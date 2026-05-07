import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropDeviceTokens1778174475626 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "device_tokens"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "device_tokens_platform_enum"`);
  }

  public async down(): Promise<void> {
    throw new Error(
      'DropDeviceTokens is not reversible — FCM was removed from the app',
    );
  }
}
