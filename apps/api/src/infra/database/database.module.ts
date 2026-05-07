import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from '../../data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const useSsl =
          config.get<string>('POSTGRES_SSL') === 'true' ||
          (databaseUrl?.includes('sslmode=require') ?? false);
        return {
          type: 'postgres' as const,
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: config.get<string>('POSTGRES_HOST', 'localhost'),
                port: parseInt(config.get<string>('POSTGRES_PORT', '5436'), 10),
                username: config.get<string>('POSTGRES_USER', 'concord'),
                password: config.get<string>('POSTGRES_PASSWORD', 'concord'),
                database: config.get<string>('POSTGRES_DB', 'concord'),
              }),
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          entities,
          synchronize: false,
          logging:
            config.get<string>('NODE_ENV') === 'development'
              ? ['error', 'warn']
              : ['error'],
        };
      },
    }),
  ],
})
export class DatabaseModule {}
