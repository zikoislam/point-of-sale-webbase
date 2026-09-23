import mongoose, { Types } from 'mongoose';
import { PurchaseOrder, IPOItem } from '../models/PurchaseOrder';
import { Product } from '../models/Product';
import { Supplier } from '../models/Supplier';
import { SupplierLedger } from '../models/SupplierLedger';
import { postPurchaseReceiveJournal, postSupplierPaymentJournal, defaultWalletFor } from './accounting-postings';
import { StockMovement } from '../models/StockMovement';
import { AppError } from '../utils/app-error';
import { generatePONumber } from './SequenceService';
import { roundMoney } from '../utils/helpers';

export interface POItemDto {
  variantId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  unitCost: number;
}

export interface CreatePODto {
  supplierId: string;
  items: POItemDto[];
  taxAmount?: number;
  shippingCost?: number;
  expectedDeliveryDate?: string;
  notes?: string;
}

export interface GRNItemDto {
  variantId: string;
  receivedQty: number;
  unitCost?: number;
  batchNo?: string;
  expiryDate?: string;
}

export interface GRNDto {
  vendorInvoiceNo?: string;
  items: GRNItemDto[];
  paidNow?: number;
  notes?: string;
}

class PurchaseOrderService {
  async list(page = 1, limit = 20, status?: string, supplierId?: string) {
    const query: any = {};
    if (status) query.status = status;
    if (supplierId && Types.ObjectId.isValid(supplierId)) query.supplierId = supplierId;

    const [pos, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('supplierId', 'companyName phone')
        .populate('createdById', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PurchaseOrder.countDocuments(query),
    ]);

    return { data: pos, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid PO ID');
    const po = await PurchaseOrder.findById(id)
      .populate('supplierId', 'companyName contactPerson phone email')
      .populate('createdById', 'name')
      .populate('receivedById', 'name')
      .lean();
    if (!po) throw new AppError(404, 'PO_NOT_FOUND', 'Purchase Order not found');
    return po;
  }

  async create(dto: CreatePODto, userId: string) {
    if (!Types.ObjectId.isValid(dto.supplierId)) throw new AppError(400, 'INVALID_SUPPLIER_ID', 'Invalid supplier ID');

    const supplier = await Supplier.findById(dto.supplierId).lean();
    if (!supplier) throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');

    const poNumber = await generatePONumber();
    const items: IPOItem[] = dto.items.map((item) => ({
      variantId: new Types.ObjectId(item.variantId),
      productName: item.productName,
      sku: item.sku,
      orderedQty: item.orderedQty,
      receivedQty: 0,
      unitCost: item.unitCost,
      lineTotal: item.orderedQty * item.unitCost,
    }));

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const taxAmount = dto.taxAmount ?? 0;
    const shippingCost = dto.shippingCost ?? 0;
    const totalAmount = subtotal + taxAmount + shippingCost;

    const po = await PurchaseOrder.create({
      poNumber,
      supplierId: dto.supplierId,
      status: 'DRAFT',
      items,
      subtotal,
      taxAmount,
      shippingCost,
      totalAmount,
      paidAmount: 0,
      dueAmount: totalAmount,
      expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined,
      notes: dto.notes,
      createdById: userId,
    });

    return po.toObject();
  }

  async updateStatus(id: string, status: 'ORDERED' | 'CANCELLED') {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid PO ID');
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new AppError(404, 'PO_NOT_FOUND', 'Purchase Order not found');
    if (po.status === 'RECEIVED') throw new AppError(400, 'ALREADY_RECEIVED', 'Cannot modify a fully received PO');
    if (po.status === 'CANCELLED') throw new AppError(400, 'ALREADY_CANCELLED', 'PO is already cancelled');
    po.status = status;
    await po.save();
    return po.toObject();
  }

  async receiveGRN(poId: string, dto: GRNDto, userId: string) {
    if (!Types.ObjectId.isValid(poId)) throw new AppError(400, 'INVALID_ID', 'Invalid PO ID');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const po = await PurchaseOrder.findById(poId).session(session);
      if (!po) throw new AppError(404, 'PO_NOT_FOUND', 'Purchase Order not found');
      if (po.status === 'CANCELLED') throw new AppError(400, 'PO_CANCELLED', 'Cannot receive a cancelled PO');
      if (po.status === 'RECEIVED') throw new AppError(400, 'PO_RECEIVED', 'PO is already fully received');

      const supplier = await Supplier.findById(po.supplierId).session(session);
      if (!supplier) throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');

      let totalReceivedValue = 0;

      for (const grnItem of dto.items) {
        if (!grnItem.receivedQty || grnItem.receivedQty <= 0) continue;

        const poItem = po.items.find(
          (i) => i.variantId.toString() === grnItem.variantId
        );
        if (!poItem) throw new AppError(400, 'ITEM_NOT_FOUND', `Variant ${grnItem.variantId} not in PO`);

        const receivingCost = grnItem.unitCost ?? poItem.unitCost;

        // Rule: cannot receive more than ordered
        if (poItem.receivedQty + grnItem.receivedQty > poItem.orderedQty) {
          throw new AppError(
            422,
            'PARTIAL_RECEIVING_OVERFLOW',
            `Received quantity (${poItem.receivedQty + grnItem.receivedQty}) exceeds ordered quantity (${poItem.orderedQty}) for ${poItem.productName}`
          );
        }

        poItem.receivedQty += grnItem.receivedQty;
        poItem.unitCost = receivingCost;
        poItem.lineTotal = roundMoney(poItem.orderedQty * receivingCost);
        const lineValue = roundMoney(grnItem.receivedQty * receivingCost);
        totalReceivedValue = roundMoney(totalReceivedValue + lineValue);

        const product = await Product.findOne({ 'variants._id': new Types.ObjectId(grnItem.variantId) }).session(session);
        if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product not found for variant ${grnItem.variantId}`);

        const variant = product.variants.find(
          (v) => v._id.toString() === grnItem.variantId
        );
        if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', `Variant not found`);

        const stockBefore = variant.currentStock;
        const newStock = stockBefore + grnItem.receivedQty;

        const existingValue = stockBefore * variant.costPrice;
        const incomingValue = grnItem.receivedQty * receivingCost;
        const newWAC = newStock > 0 ? (existingValue + incomingValue) / newStock : receivingCost;

        variant.currentStock = roundMoney(newStock);
        variant.costPrice = parseFloat(newWAC.toFixed(4));

        if (grnItem.batchNo || grnItem.expiryDate) {
          if (!variant.batches) variant.batches = [];
          variant.batches.push({
            batchNo: grnItem.batchNo || `BATCH-${Date.now()}`,
            costPrice: receivingCost,
            expiryDate: grnItem.expiryDate ? new Date(grnItem.expiryDate) : undefined,
            quantity: grnItem.receivedQty,
            receivedAt: new Date(),
          });
        }

        await product.save({ session });

        await StockMovement.create([{
          productId: product._id,
          variantId: new Types.ObjectId(grnItem.variantId),
          type: 'IN',
          quantity: grnItem.receivedQty,
          stockBefore,
          stockAfter: newStock,
          unitCost: receivingCost,
          referenceType: 'PO',
          referenceId: po._id,
          userId,
        }], { session });
      }

      const allReceived = po.items.every((i) => i.receivedQty >= i.orderedQty);
      const anyReceived = po.items.some((i) => i.receivedQty > 0);
      po.status = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIAL' : po.status;
      po.actualReceivedDate = new Date();
      po.receivedById = new Types.ObjectId(userId);
      if (dto.vendorInvoiceNo) po.vendorInvoiceNo = dto.vendorInvoiceNo;

      const paidNow = roundMoney(dto.paidNow ?? 0);
      po.paidAmount = roundMoney(po.paidAmount + paidNow);
      if (po.paidAmount > po.totalAmount) po.paidAmount = po.totalAmount;
      po.dueAmount = roundMoney(Math.max(0, po.totalAmount - po.paidAmount));

      await po.save({ session });

      const balanceBefore = supplier.currentPayableBalance;
      const balanceAfter = balanceBefore + totalReceivedValue - paidNow;
      supplier.currentPayableBalance = balanceAfter;
      await supplier.save({ session });

      await SupplierLedger.create([{
        supplierId: supplier._id,
        transactionType: 'PO_GRN_BILL',
        amount: totalReceivedValue,
        balanceBefore,
        balanceAfter,
        referenceType: 'PO',
        referenceId: po._id,
        narration: `GRN received for PO ${po.poNumber}. Paid: ${paidNow}`,
        recordedById: userId,
      }], { session });

      // Double-entry: stock in, supplier owed; any amount paid now clears part
      // of the payable against the till.
      await postPurchaseReceiveJournal({
        amount: totalReceivedValue,
        supplierName: supplier.companyName,
        poNumber: po.poNumber,
        referenceId: po._id,
        userId,
        session,
      });

      if (paidNow > 0) {
        await postSupplierPaymentJournal({
          amount: paidNow,
          supplierName: supplier.companyName,
          walletAccountId: await defaultWalletFor('CASH'),
          date: po.actualReceivedDate,
          referenceId: po._id,
          userId,
          session,
        });
      }

      await session.commitTransaction();
      return po.toObject();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

export const purchaseOrderService = new PurchaseOrderService();
