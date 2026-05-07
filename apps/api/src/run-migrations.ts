import 'reflect-metadata';
import { AppDataSource } from './data-source';

async function main(): Promise<void> {
  const start = Date.now();
  console.log('[migrations] connecting…');
  await AppDataSource.initialize();
  console.log('[migrations] connected, running pending migrations…');
  const ran = await AppDataSource.runMigrations({ transaction: 'each' });
  console.log(
    `[migrations] applied ${ran.length} migration(s) in ${Date.now() - start}ms`,
  );
  for (const m of ran) console.log(`  ✓ ${m.name}`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('[migrations] FAILED:', err);
  process.exit(1);
});
