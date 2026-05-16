import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDebts1778949610492 implements MigrationInterface {
    name = 'AddDebts1778949610492'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."debt_payments_kind_enum" AS ENUM('open', 'repayment')`);
        await queryRunner.query(`CREATE TABLE "debt_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "debt_id" uuid NOT NULL, "transaction_id" uuid NOT NULL, "kind" "public"."debt_payments_kind_enum" NOT NULL, "amount" bigint NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_debt_payments_transaction_id" UNIQUE ("transaction_id"), CONSTRAINT "PK_debt_payments" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_debt_payments_debt_id" ON "debt_payments" ("debt_id") `);
        await queryRunner.query(`CREATE TYPE "public"."debts_direction_enum" AS ENUM('lent', 'borrowed')`);
        await queryRunner.query(`CREATE TYPE "public"."debts_status_enum" AS ENUM('open', 'settled')`);
        await queryRunner.query(`CREATE TABLE "debts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "family_id" uuid NOT NULL, "user_id" uuid NOT NULL, "fund_id" uuid NOT NULL, "direction" "public"."debts_direction_enum" NOT NULL, "counterparty_name" text NOT NULL, "principal" bigint NOT NULL, "remaining_amount" bigint NOT NULL, "status" "public"."debts_status_enum" NOT NULL DEFAULT 'open', "note" text, "opened_at" TIMESTAMP WITH TIME ZONE NOT NULL, "closed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_debts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_debts_user_id_status" ON "debts" ("user_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_debts_fund_id" ON "debts" ("fund_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_debts_family_id" ON "debts" ("family_id") `);
        await queryRunner.query(`ALTER TABLE "debt_payments" ADD CONSTRAINT "FK_debt_payments_debt_id" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "debt_payments" ADD CONSTRAINT "FK_debt_payments_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "debts" ADD CONSTRAINT "FK_debts_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "debts" ADD CONSTRAINT "FK_debts_fund_id" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "debts" DROP CONSTRAINT "FK_debts_fund_id"`);
        await queryRunner.query(`ALTER TABLE "debts" DROP CONSTRAINT "FK_debts_user_id"`);
        await queryRunner.query(`ALTER TABLE "debt_payments" DROP CONSTRAINT "FK_debt_payments_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "debt_payments" DROP CONSTRAINT "FK_debt_payments_debt_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_debts_family_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_debts_fund_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_debts_user_id_status"`);
        await queryRunner.query(`DROP TABLE "debts"`);
        await queryRunner.query(`DROP TYPE "public"."debts_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."debts_direction_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_debt_payments_debt_id"`);
        await queryRunner.query(`DROP TABLE "debt_payments"`);
        await queryRunner.query(`DROP TYPE "public"."debt_payments_kind_enum"`);
    }

}
