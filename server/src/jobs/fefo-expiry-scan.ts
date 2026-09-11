import cron from 'node-cron';
import { Product } from '../models/Product';
import { emitEvent } from '../sockets';

export const scanFefoExpiryAlerts = async (): Promise<number> => {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  console.log(`🔍 [CRON] Scanning for products expiring before ${thirtyDaysFromNow.toISOString().slice(0, 10)}...`);

  const products = await Product.find({
    isActive: true,
    $or: [
      { 'variants.expiryDate': { $lte: thirtyDaysFromNow } },
      { 'variants.batches.expiryDate': { $lte: thirtyDaysFromNow } },
    ],
  }).lean();

  let alertCount = 0;

  for (const p of products) {
    for (const v of p.variants) {
      // Check top-level expiry date
      const expDate = (v as any).expiryDate;
      if (expDate && new Date(expDate) <= thirtyDaysFromNow) {
        alertCount++;
        emitEvent('LOW_STOCK_ALERT', {
          productName: p.name,
          sku: v.sku,
          variantName: v.attributeName,
          currentStock: v.currentStock,
          alertQty: v.alertQty,
          expiryDate: expDate,
          isExpiryAlert: true,
        });
      }

      // Check batch-level expiry dates
      if (v.batches && v.batches.length > 0) {
        for (const b of v.batches) {
          if (b.expiryDate && new Date(b.expiryDate) <= thirtyDaysFromNow) {
            alertCount++;
            emitEvent('LOW_STOCK_ALERT', {
              productName: `${p.name} (Batch: ${b.batchNo})`,
              sku: v.sku,
              variantName: v.attributeName,
              currentStock: b.quantity,
              expiryDate: b.expiryDate,
              isExpiryAlert: true,
            });
          }
        }
      }
    }
  }

  console.log(`✅ [CRON] FEFO scan complete. ${alertCount} expiry alerts broadcasted.`);
  return alertCount;
};
