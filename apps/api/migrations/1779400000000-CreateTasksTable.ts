import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTasksTable1779400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE task_category_enum AS ENUM ('shopping', 'chores', 'finance', 'goal');
      CREATE TYPE task_assignee_enum AS ENUM ('husband', 'wife', 'both');
      CREATE TYPE task_status_enum AS ENUM ('todo', 'in_progress', 'done');

      CREATE TABLE tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id UUID NOT NULL,
        created_by UUID NOT NULL,
        title VARCHAR(200) NOT NULL,
        category task_category_enum NOT NULL,
        assignee task_assignee_enum NOT NULL,
        status task_status_enum NOT NULL DEFAULT 'todo',
        week_year VARCHAR(10) NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX idx_tasks_family_id ON tasks (family_id);
      CREATE INDEX idx_tasks_week_year ON tasks (week_year);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE tasks;
      DROP TYPE task_status_enum;
      DROP TYPE task_assignee_enum;
      DROP TYPE task_category_enum;
    `);
  }
}
