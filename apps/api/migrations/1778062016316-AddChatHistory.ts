import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatHistory1778062016316 implements MigrationInterface {
  name = 'AddChatHistory1778062016316';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "chat_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "title" character varying(200) NOT NULL DEFAULT 'Cuộc trò chuyện mới', "last_message_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_efc151a4aafa9a28b73dedc485f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_27ab3479a512f3cf14bd524534" ON "chat_sessions" ("user_id", "last_message_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_messages_role_enum" AS ENUM('user', 'agent')`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL, "role" "public"."chat_messages_role_enum" NOT NULL, "text" text NOT NULL, "actions_json" jsonb, "usage_input_tokens" integer, "usage_output_tokens" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_efbcf04c5086fabd02d6a0fb92" ON "chat_messages" ("session_id", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD CONSTRAINT "FK_1fa209cf48ae975a109366542a5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_0672782561e44d43febcfba2984" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_0672782561e44d43febcfba2984"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP CONSTRAINT "FK_1fa209cf48ae975a109366542a5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_efbcf04c5086fabd02d6a0fb92"`,
    );
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TYPE "public"."chat_messages_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_27ab3479a512f3cf14bd524534"`,
    );
    await queryRunner.query(`DROP TABLE "chat_sessions"`);
  }
}
