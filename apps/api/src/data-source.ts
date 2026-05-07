import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

import { Anomaly } from './insights/entities/anomaly.entity';
import { Budget } from './budgets/entities/budget.entity';
import { Category } from './categories/entities/category.entity';
import { ChatMessage } from './chat/entities/chat-message.entity';
import { ChatSession } from './chat/entities/chat-session.entity';
import { Fund } from './funds/entities/fund.entity';
import { Goal } from './goals/entities/goal.entity';
import { Insight } from './insights/entities/insight.entity';
import { SalaryRule } from './users/entities/salary-rule.entity';
import { Transaction } from './transactions/entities/transaction.entity';
import { User } from './users/entities/user.entity';

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
];

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: parseInt(process.env.POSTGRES_PORT ?? '5436', 10),
  username: process.env.POSTGRES_USER ?? 'concord',
  password: process.env.POSTGRES_PASSWORD ?? 'concord',
  database: process.env.POSTGRES_DB ?? 'concord',
  entities,
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: ['error', 'warn', 'migration', 'schema'],
});
