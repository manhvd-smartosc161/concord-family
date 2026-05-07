import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Transaction } from '../modules/transactions/entities/transaction.entity';
import { ChatMessage } from '../modules/chat/entities/chat-message.entity';
import { ChatSession } from '../modules/chat/entities/chat-session.entity';
import { Fund } from '../modules/funds/entities/fund.entity';
import { OPENING_BALANCE_NOTE } from '../modules/funds/opening-balance.constants';

const KEEP_OPENING = process.argv.includes('--keep-opening');
const DROP_ENVELOPES = process.argv.includes('--drop-envelopes');

async function main() {
  await AppDataSource.initialize();
  console.log('🔌 Connected to database');

  await AppDataSource.transaction(async (manager) => {
    const txnRepo = manager.getRepository(Transaction);
    const chatMsgRepo = manager.getRepository(ChatMessage);
    const chatSessRepo = manager.getRepository(ChatSession);
    const fundRepo = manager.getRepository(Fund);

    const msgsBefore = await chatMsgRepo.count();
    const sessBefore = await chatSessRepo.count();
    await chatMsgRepo.createQueryBuilder().delete().execute();
    await chatSessRepo.createQueryBuilder().delete().execute();
    console.log(
      `🗑️  Deleted ${msgsBefore} chat messages, ${sessBefore} sessions`,
    );

    if (KEEP_OPENING) {
      const result = await txnRepo
        .createQueryBuilder()
        .delete()
        .where('note IS NULL OR note <> :marker', {
          marker: OPENING_BALANCE_NOTE,
        })
        .execute();
      console.log(
        `🗑️  Deleted ${result.affected ?? 0} transactions (kept opening balance entries)`,
      );

      const funds = await fundRepo.find();
      for (const fund of funds) {
        const sum = await txnRepo
          .createQueryBuilder('t')
          .select('COALESCE(SUM(t.amount), 0)', 'total')
          .where('t.fund_id = :id', { id: fund.id })
          .getRawOne<{ total: string }>();
        const total = parseInt(sum?.total ?? '0', 10);
        await fundRepo.update({ id: fund.id }, { balance: total });
      }
      console.log(`💰 Recomputed balance for ${funds.length} funds`);
    } else {
      const result = await txnRepo.createQueryBuilder().delete().execute();
      console.log(`🗑️  Deleted ${result.affected ?? 0} transactions (full)`);

      const funds = await fundRepo.find();
      for (const fund of funds) {
        await fundRepo.update({ id: fund.id }, { balance: 0 });
      }
      console.log(`💰 Reset ${funds.length} funds to balance=0`);
    }

    if (DROP_ENVELOPES) {
      const envResult = await fundRepo
        .createQueryBuilder()
        .delete()
        .where('purpose = :p', { p: 'envelope' })
        .execute();
      console.log(`🗑️  Deleted ${envResult.affected ?? 0} envelope funds`);
    }
  });

  console.log('✅ Reset complete');
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
