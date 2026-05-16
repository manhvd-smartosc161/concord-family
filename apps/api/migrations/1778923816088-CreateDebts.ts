import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDebts1778923816088 implements MigrationInterface {
  name = 'CreateDebts1778923816088';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(
      `CREATE TYPE "public"."debts_direction_enum" AS ENUM('i_owe', 'they_owe_me')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."debts_visibility_enum" AS ENUM('private', 'shared')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."debts_status_enum" AS ENUM('open', 'closed')`,
    );

    await queryRunner.query(
      `CREATE TABLE "debts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "owner_id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "direction" "public"."debts_direction_enum" NOT NULL,
        "counterparty" character varying(200) NOT NULL,
        "principal" bigint NOT NULL,
        "outstanding" bigint NOT NULL,
        "visibility" "public"."debts_visibility_enum" NOT NULL DEFAULT 'private',
        "due_date" date,
        "note" text,
        "status" "public"."debts_status_enum" NOT NULL DEFAULT 'open',
        "closed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_debts_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_debts_principal_positive" CHECK ("principal" > 0),
        CONSTRAINT "CHK_debts_outstanding_nonneg" CHECK ("outstanding" >= 0)
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_debts_family_owner_status" ON "debts" ("family_id", "owner_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_debts_family_visibility" ON "debts" ("family_id", "visibility")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_debts_counterparty_trgm" ON "debts" USING gin ("counterparty" gin_trgm_ops)`,
    );

    await queryRunner.query(
      `ALTER TABLE "debts" ADD CONSTRAINT "FK_debts_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "debts" ADD CONSTRAINT "FK_debts_family" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE "debt_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "debt_id" uuid NOT NULL,
        "transaction_id" uuid,
        "amount" bigint NOT NULL,
        "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "note" text,
        CONSTRAINT "PK_debt_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_debt_payments_amount_positive" CHECK ("amount" > 0)
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_debt_payments_debt" ON "debt_payments" ("debt_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "debt_payments" ADD CONSTRAINT "FK_debt_payments_debt" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "debt_payments" ADD CONSTRAINT "FK_debt_payments_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debt_payments" DROP CONSTRAINT "FK_debt_payments_transaction"`);
    await queryRunner.query(`ALTER TABLE "debt_payments" DROP CONSTRAINT "FK_debt_payments_debt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_debt_payments_debt"`);
    await queryRunner.query(`DROP TABLE "debt_payments"`);

    await queryRunner.query(`ALTER TABLE "debts" DROP CONSTRAINT "FK_debts_family"`);
    await queryRunner.query(`ALTER TABLE "debts" DROP CONSTRAINT "FK_debts_owner"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_debts_counterparty_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_debts_family_visibility"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_debts_family_owner_status"`);
    await queryRunner.query(`DROP TABLE "debts"`);

    await queryRunner.query(`DROP TYPE "public"."debts_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."debts_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "public"."debts_direction_enum"`);
  }
}
