import { MigrationInterface, QueryRunner } from "typeorm";

export class AddImportantDatesAndDeviceTokens1778170516917 implements MigrationInterface {
    name = 'AddImportantDatesAndDeviceTokens1778170516917'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."important_dates_type_enum" AS ENUM('birthday', 'death_anniversary', 'anniversary', 'other')`);
        await queryRunner.query(`CREATE TABLE "important_dates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(120) NOT NULL, "type" "public"."important_dates_type_enum" NOT NULL DEFAULT 'other', "date" date NOT NULL, "is_lunar" boolean NOT NULL DEFAULT false, "remind_days_before" integer array NOT NULL DEFAULT '{0}', "notes" text, "created_by_id" uuid NOT NULL, CONSTRAINT "PK_e84d5a342e07ae2f0932b9170fd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_88b0208953f7ad8fa77cab4992" ON "important_dates" ("date") `);
        await queryRunner.query(`CREATE TYPE "public"."device_tokens_platform_enum" AS ENUM('ios_pwa', 'android', 'desktop')`);
        await queryRunner.query(`CREATE TABLE "device_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "fcm_token" character varying(512) NOT NULL, "platform" "public"."device_tokens_platform_enum" NOT NULL DEFAULT 'desktop', "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" uuid, CONSTRAINT "PK_84700be257607cfb1f9dc2e52c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_17e1f528b993c6d55def4cf5be" ON "device_tokens" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_52448abf66ece84fb989738c35" ON "device_tokens" ("fcm_token") `);
        await queryRunner.query(`ALTER TYPE "public"."funds_purpose_enum" RENAME TO "funds_purpose_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."funds_purpose_enum" AS ENUM('spending', 'savings', 'investment')`);
        await queryRunner.query(`ALTER TABLE "funds" ALTER COLUMN "purpose" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "funds" ALTER COLUMN "purpose" TYPE "public"."funds_purpose_enum" USING "purpose"::"text"::"public"."funds_purpose_enum"`);
        await queryRunner.query(`ALTER TABLE "funds" ALTER COLUMN "purpose" SET DEFAULT 'spending'`);
        await queryRunner.query(`DROP TYPE "public"."funds_purpose_enum_old"`);
        await queryRunner.query(`ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_511957e3e8443429dc3fb00120c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "device_tokens" DROP CONSTRAINT "FK_511957e3e8443429dc3fb00120c"`);
        await queryRunner.query(`CREATE TYPE "public"."funds_purpose_enum_old" AS ENUM('general', 'envelope')`);
        await queryRunner.query(`ALTER TABLE "funds" ALTER COLUMN "purpose" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "funds" ALTER COLUMN "purpose" TYPE "public"."funds_purpose_enum_old" USING "purpose"::"text"::"public"."funds_purpose_enum_old"`);
        await queryRunner.query(`ALTER TABLE "funds" ALTER COLUMN "purpose" SET DEFAULT 'general'`);
        await queryRunner.query(`DROP TYPE "public"."funds_purpose_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."funds_purpose_enum_old" RENAME TO "funds_purpose_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52448abf66ece84fb989738c35"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_17e1f528b993c6d55def4cf5be"`);
        await queryRunner.query(`DROP TABLE "device_tokens"`);
        await queryRunner.query(`DROP TYPE "public"."device_tokens_platform_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_88b0208953f7ad8fa77cab4992"`);
        await queryRunner.query(`DROP TABLE "important_dates"`);
        await queryRunner.query(`DROP TYPE "public"."important_dates_type_enum"`);
    }

}
