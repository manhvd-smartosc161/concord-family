import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatSessionVisibility1779500000000 implements MigrationInterface {
  name = 'ChatSessionVisibility1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add visibility column (default 'public' temporarily for backfill)
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD COLUMN "visibility" varchar(10) NOT NULL DEFAULT 'public'`,
    );

    // 2. Backfill: personal fund sessions → 'private', joint → 'public'
    await queryRunner.query(
      `UPDATE "chat_sessions" cs
       SET "visibility" = CASE WHEN f.type = 'personal' THEN 'private' ELSE 'public' END
       FROM "funds" f
       WHERE cs.fund_id = f.id`,
    );

    // 3. Swap indexes: drop fund_id index, add visibility index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_b4bccd781ae3fb44f8b1dba3e6"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_chat_sessions_visibility_last_message_at" ON "chat_sessions" ("visibility", "last_message_at")`,
    );

    // 4. Drop FK constraint and fund_id column
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP CONSTRAINT IF EXISTS "FK_ccc97021018571d6b7a2345d9e9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP COLUMN "fund_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore fund_id column (nullable for rollback safety)
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD COLUMN "fund_id" uuid`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_chat_sessions_visibility_last_message_at"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b4bccd781ae3fb44f8b1dba3e6" ON "chat_sessions" ("fund_id", "last_message_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP COLUMN "visibility"`,
    );
  }
}
