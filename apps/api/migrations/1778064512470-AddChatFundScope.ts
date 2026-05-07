import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatFundScope1778064512470 implements MigrationInterface {
  name = 'AddChatFundScope1778064512470';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP CONSTRAINT "FK_1fa209cf48ae975a109366542a5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_27ab3479a512f3cf14bd524534"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP COLUMN "user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD "fund_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD "created_by_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "user_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd3d7d3989b339aeefe214ba9c" ON "chat_sessions" ("created_by_id", "last_message_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b4bccd781ae3fb44f8b1dba3e6" ON "chat_sessions" ("fund_id", "last_message_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD CONSTRAINT "FK_ccc97021018571d6b7a2345d9e9" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD CONSTRAINT "FK_49853d0c8e7b7088de1d4ea8a31" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_5588b6cea298cedec7063c0d33e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_5588b6cea298cedec7063c0d33e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP CONSTRAINT "FK_49853d0c8e7b7088de1d4ea8a31"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP CONSTRAINT "FK_ccc97021018571d6b7a2345d9e9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b4bccd781ae3fb44f8b1dba3e6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cd3d7d3989b339aeefe214ba9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP COLUMN "created_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP COLUMN "fund_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD "user_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_27ab3479a512f3cf14bd524534" ON "chat_sessions" ("user_id", "last_message_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD CONSTRAINT "FK_1fa209cf48ae975a109366542a5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
