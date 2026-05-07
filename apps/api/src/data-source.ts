import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

import { Anomaly } from './modules/insights/entities/anomaly.entity';
import { Budget } from './modules/budgets/entities/budget.entity';
import { Category } from './modules/categories/entities/category.entity';
import { ChatMessage } from './modules/chat/entities/chat-message.entity';
import { ChatSession } from './modules/chat/entities/chat-session.entity';
import { Fund } from './modules/funds/entities/fund.entity';
import { Goal } from './modules/goals/entities/goal.entity';
import { ImportantDate } from './modules/important-dates/entities/important-date.entity';
import { Insight } from './modules/insights/entities/insight.entity';
import { SalaryRule } from './modules/salary-rules/entities/salary-rule.entity';
import { Transaction } from './modules/transactions/entities/transaction.entity';
import { User } from './modules/users/entities/user.entity';
import { DeviceToken } from './shared/notifications/entities/device-token.entity';

// Load root-level .env (concord/.env). Works when CLI is run from apps/api
// (cwd = apps/api, file = apps/api/dist/data-source.js or src/data-source.ts).
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export const entities = [
  User,
  SalaryRule,
  Fund,
  Category,
  Transaction,
  Budget,
  Goal,
  Insight,
  Anomaly,
  ChatSession,
  ChatMessage,
  ImportantDate,
  DeviceToken,
];

const databaseUrl = process.env.DATABASE_URL;
const useSsl =
  process.env.POSTGRES_SSL === 'true' ||
  (databaseUrl?.includes('sslmode=require') ?? false);

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: process.env.POSTGRES_HOST ?? 'localhost',
        port: parseInt(process.env.POSTGRES_PORT ?? '5436', 10),
        username: process.env.POSTGRES_USER ?? 'concord',
        password: process.env.POSTGRES_PASSWORD ?? 'concord',
        database: process.env.POSTGRES_DB ?? 'concord',
      }),
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  entities,
  migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: ['error', 'warn', 'migration', 'schema'],
});
