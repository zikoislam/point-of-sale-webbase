import mongoose, { Types, ClientSession } from 'mongoose';
import { PurchaseReturn, IPurchaseReturn, IPurchaseReturnItem } from '../models/PurchaseReturn';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { Supplier } from '../models/Supplier';
import { SupplierLedger } from '../models/SupplierLedger';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';
import { generatePurchaseReturnNo } from './SequenceService';
import { accountingService, HEADS } from './AccountingService';

export interface PurchaseReturnItemInput {
  variantId: string;
  quantity: number;
  reason: string;
  unitCost?: number;
}

export interface CreatePurchaseReturnInput {
  purchaseOrderId: string;
  items: PurchaseReturnItemInput[];
  refundMethod?: 'CASH' | 'BANK_TRANSFER' | 'CREDIT_NOTE' | 'ADJUSTED_AGAINST_PAYABLE';
  status?: 'DRAFT' | 'CONFIRMED' | 'REFUNDED';
  notes?: string;
}

export interface PurchaseReturnFilters {
  supplierId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

class PurchaseReturnService {
  /** Quantity of each variant already returned against a PO (non-cancelled). */
  private async returnedQtyByVariant(purchaseOrderId: Types.ObjectId): Promise<Map<string, number>> {
    const existing = await PurchaseReturn.find({
      purchaseOrderId,
      status: { $in: ['CONFIRMED', 'REFUNDED'] },
    }).lean();

    const map = new Map<string, number>();
    for (const ret of existing as any[]) {
      for (const item of ret.items || []) {
        const key = String(item.variantId);
        map.set(key, roundMoney((map.get(key) || 0) + (item.quantity || 0)));
      }
    }
    return map;
  }

  /**
   * Creates the debit note. Unless it is saved as a DRAFT, the effects are
   * posted immediately: stock out, supplier payable down, balanced journal.
   */
  async create(data: CreatePurchaseReturnInput, createdBy: string): Promise<IPurchaseReturn> {
    if (!Types.ObjectId.isValid(data.purchaseOrderId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid purchase order ID');
    }
    if (!data.items || data.items.length === 0) {
      throw new AppError(400, 'NO_ITEMS', 'Select at least one item to return');
    }

    const po: any = await PurchaseOrder.findById(data.purchaseOrderId).lean();
    if (!po) throw new AppError(404, 'PO_NOT_FOUND', 'Purchase order not found');
    if (po.status === 'DRAFT' || po.status === 'CANCELLED') {
      throw new AppError(400, 'PO_NOT_RECEIVED', 'Only received purchase orders can be returned against');
    }

    const alreadyReturned = await this.returnedQtyByVariant(po._id);
    const items: IPurchaseReturnItem[] = [];
    let totalAmount = 0;

    for (const input of data.items) {
      if (!Types.ObjectId.isValid(input.variantId)) {
        throw new AppError(400, 'INVALID_ID', `Invalid variant ID: ${input.variantId}`);
      }
      const quantity = Number(input.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new AppError(400, 'INVALID_QUANTITY', 'Return quantity must be greater than zero');
      }
      if (!input.reason || !input.reason.trim()) {
        throw new AppError(400, 'REASON_REQUIRED', 'A reason is required for every returned item');
      }

      const poItem: any = (po.items || []).find((i: any) => String(i.variantId) === input.variantId);
      if (!poItem) throw new AppError(400, 'ITEM_NOT_IN_PO', 'That item is not part of this purchase order');

      const returnable = roundMoney((poItem.receivedQty || 0) - (alreadyReturned.get(input.variantId) || 0));
      if (quantity > returnable) {
        throw new AppError(
          422,
          'RETURN_EXCEEDS_RECEIVED',
          `Cannot return ${quantity} of ${poItem.productName} — only ${returnable} received and not yet returned`
        );
      }

      const unitCost = roundMoney(input.unitCost !== undefined ? Number(input.unitCost) : poItem.unitCost || 0);
      const totalCost = roundMoney(quantity * unitCost);

      const product: any = await Product.findOne({ 'variants._id': new Types.ObjectId(input.variantId) }).lean();
      const variant: any = product?.variants?.find((v: any) => String(v._id) === input.variantId);

      items.push({
        productId: product?._id || poItem.variantId,
        variantId: new Types.ObjectId(input.variantId),
        productName: poItem.productName || product?.name || 'Item',
        variantName: poItem.variantName || variant?.attributeName || '',
        sku: poItem.sku || variant?.sku || '',
        quantity,
        unitCost,
        totalCost,
        reason: input.reason.trim(),
      });
      totalAmount = roundMoney(totalAmount + totalCost);
    }

    const status = data.status || 'CONFIRMED';
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const returnNumber = await generatePurchaseReturnNo(session);
      const doc = await PurchaseReturn.create(
        [
          {
            returnNumber,
            purchaseOrderId: po._id,
            supplierId: po.supplierId,
            items,
            totalAmount,
            status,
            refundMethod: data.refundMethod || 'ADJUSTED_AGAINST_PAYABLE',
            effectsApplied: false,
            notes: data.notes,
            createdBy: new Types.ObjectId(createdBy),
          },
        ],
        { session }
      );

      const created = doc[0];
      if (status !== 'DRAFT') {
        await this.applyEffects(created, createdBy, session);
      }

      await session.commitTransaction();
      return created.toObject() as unknown as IPurchaseReturn;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Posts the return's effects exactly once: stock out, supplier payable down
   * and Dr Supplier Payable / Cr Inventory.
   */
  private async applyEffects(
    purchaseReturn: IPurchaseReturn & { _id: Types.ObjectId },
    userId: string,
    session?: ClientSession
  ): Promise<void> {
    const doc: any = purchaseReturn;

    // 1. Stock out + movement trail
    for (const item of doc.items) {
      const product: any = await Product.findOne({
        'variants._id': new Types.ObjectId(item.variantId),
      }).session(session || null);

      if (product) {
        const variant: any = product.variants.find((v: any) => String(v._id) === String(item.variantId));
        if (variant) {
          const stockBefore = variant.currentStock;
          variant.currentStock = roundMoney(variant.currentStock - item.quantity);
          await product.save({ session });

          await StockMovement.create(
            [
              {
                productId: product._id,
                variantId: variant._id,
                type: 'OUT',
                quantity: item.quantity,
                stockBefore,
                stockAfter: variant.currentStock,
                unitCost: item.unitCost,
                referenceType: 'RETURN',
                referenceId: doc._id,
                reason: `Purchase return ${doc.returnNumber} · ${item.reason}`,
                userId: new Types.ObjectId(userId),
              },
            ],
            { session }
          );
        }
      }
    }

    // 2. Supplier payable down (debit note)
    const supplier = await Supplier.findById(doc.supplierId).session(session || null);
    if (supplier) {
      const balanceBefore = supplier.currentPayableBalance;
      const balanceAfter = roundMoney(balanceBefore - doc.totalAmount);
      supplier.currentPayableBalance = balanceAfter;
      await supplier.save({ session });

      await SupplierLedger.create(
        [
          {
            supplierId: supplier._id,
            transactionType: 'PURCHASE_RETURN',
            amount: doc.totalAmount,
            balanceBefore,
            balanceAfter,
            referenceType: 'PO',
            referenceId: doc.purchaseOrderId,
            narration: `Purchase return ${doc.returnNumber} (${doc.refundMethod})`,
            recordedById: new Types.ObjectId(userId),
          },
        ],
        { session }
      );
    }

    // 3. Balanced journal: Dr Supplier Payable, Cr Inventory
    if (doc.totalAmount > 0) {
      await accountingService.postJournal({
        date: new Date(),
        narration: `Purchase return ${doc.returnNumber}`,
        source: 'PURCHASE_RETURN',
        referenceType: 'PURCHASE_RETURN',
        referenceId: doc._id,
        createdById: userId,
        session,
        lines: [
          { accountCode: HEADS.PAYABLE, debit: doc.totalAmount, credit: 0, memo: `Debit note ${doc.returnNumber}` },
          { accountCode: HEADS.INVENTORY, debit: 0, credit: doc.totalAmount, memo: 'Goods returned to supplier' },
        ],
      });
    }

    doc.effectsApplied = true;
    await (doc as any).save?.({ session });
  }

  async list(filters: PurchaseReturnFilters = {}, page = 1, limit = 50) {
    const query: Record<string, any> = {};
    if (filters.supplierId && Types.ObjectId.isValid(filters.supplierId)) {
      query.supplierId = new Types.ObjectId(filters.supplierId);
    }
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const [rows, total] = await Promise.all([
      PurchaseReturn.find(query)
        .populate('supplierId', 'companyName phone')
        .populate('purchaseOrderId', 'poNumber')
        .populate('createdBy', 'fullName username')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PurchaseReturn.countDocuments(query),
    ]);

    return { data: rows, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid return ID');
    const doc = await PurchaseReturn.findById(id)
      .populate('supplierId', 'companyName phone email address currentPayableBalance')
      .populate('purchaseOrderId', 'poNumber createdAt status')
      .populate('createdBy', 'fullName username')
      .lean();
    if (!doc) throw new AppError(404, 'PURCHASE_RETURN_NOT_FOUND', 'Purchase return not found');
    return doc;
  }

  /** DRAFT → CONFIRMED posts the effects; CONFIRMED → REFUNDED is bookkeeping. */
  async updateStatus(id: string, status: 'DRAFT' | 'CONFIRMED' | 'REFUNDED', userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid return ID');
    const doc = await PurchaseReturn.findById(id);
    if (!doc) throw new AppError(404, 'PURCHASE_RETURN_NOT_FOUND', 'Purchase return not found');

    if (status === 'CONFIRMED' && !doc.effectsApplied) {
      await this.applyEffects(doc as any, userId);
    }
    doc.status = status;
    await doc.save();
    return doc.toObject() as unknown as IPurchaseReturn;
  }
}

export const purchaseReturnService = new PurchaseReturnService();
