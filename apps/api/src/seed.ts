import { AppDataSource } from './data-source';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  console.log(
    '[seed] No-op. After deploy, register users via POST /api/auth/register, ' +
      'then create or join a family. Funds + categories + important dates ' +
      'are auto-created when family is complete (2 spouses).',
  );
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
