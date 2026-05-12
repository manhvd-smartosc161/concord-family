import { MigrationInterface, QueryRunner } from "typeorm";

export class FixJointFundType1778598554622 implements MigrationInterface {
    name = 'FixJointFundType1778598554622'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "funds" SET "type" = 'joint' WHERE "owner_id" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // no-op: không revert data fix
    }
}
