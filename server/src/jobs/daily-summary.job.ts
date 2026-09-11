import cron from 'node-cron';
import { Sale } from '../models/Sale';
import { Expense } from '../models/Expense';
import { DailySalesSummary } from '../models/DailySalesSummary';

export const runDailySummaryJob = async (targetDate?: string): Promise<any> => {
  const dateStr = targetDate || new Date().toISOString().slice(0, 10);
  console.log(`⏳ Running Daily Sales Summary consolidation for ${dateStr}...`);

  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);

  const [sales, expenses] = await Promise.all([
    Sale.find({ createdAt: { $gte: start, $lte: end } }).lean(),
    Expense.find({ createdAt: { $gte: start, $lte: end } }).populate('categoryId', 'code').lean(),
  ]);

  let totalSalesRevenue = 0;
  let totalCOGS = 0;
  let totalTaxCollected = 0;
  let totalDiscounts = 0;
  let totalItemsSold = 0;

  for (const s of sales) {
    totalSalesRevenue += s.totalAmount || 0;
    totalTaxCollected += s.totalTax || 0;
    totalDiscounts += s.discountAmount || 0;
    for (const item of s.items) {
      totalItemsSold += item.quantity;
      totalCOGS += item.quantity * (item.unitCostPrice || 0);
    }
  }

  let totalExpenses = 0;
  let totalWastageLoss = 0;

  for (const e of expenses) {
    const catCode = (e.categoryId as any)?.code || '';
    if (catCode === 'WASTAGE_LOSS') {
      totalWastageLoss += e.amount;
    } else {
      totalExpenses += e.amount;
    }
  }

  const netProfit = totalSalesRevenue - totalCOGS - totalExpenses - totalWastageLoss;

  const summary = await DailySalesSummary.findOneAndUpdate(
    { date: dateStr },
    {
      $set: {
        totalSalesRevenue,
        totalCOGS,
        totalTaxCollected,
        totalDiscounts,
        totalExpenses,
        totalWastageLoss,
        netProfit,
        totalInvoices: sales.length,
        totalItemsSold,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`✅ Daily Sales Summary saved for ${dateStr}: Revenue=৳${totalSalesRevenue}, NetProfit=৳${netProfit}`);
  return summary;
};

export const initJobs = (): void => {
  // Runs every midnight at 00:05 AM
  cron.schedule('5 0 * * *', async () => {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await runDailySummaryJob(yesterday);
    } catch (e) {
      console.error('❌ Daily summary job failed:', e);
    }
  });

  console.log('⏰ Background Cron Jobs initialized (Daily summary consolidation scheduled for 00:05)');
};
