import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFinancialMonthCutoffDay1779263718699 implements MigrationInterface {
    name = 'AddFinancialMonthCutoffDay1779263718699'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "families" ADD "financial_month_cutoff_day" smallint NOT NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "families" DROP COLUMN "financial_month_cutoff_day"`);
    }

}
