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
import { notificationService } from './NotificationService';
import { currentBranchId } from '../middlewares/org.context';

export interface POItemDto {
  variantId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  unitCost: number;
}

export interface CreatePODto {
  supplierId: string;
  /** Branch / warehouse the goods are ordered for. */
  branchId?: string;
  /** Project this purchase belongs to (job costing). */
  projectId?: string;
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
  async list(page = 1, limit = 20, status?: string, supplierId?: string, approvalStatus?: string) {
    const query: any = {};
    if (status) query.status = status;
    if (supplierId && Types.ObjectId.isValid(supplierId)) query.supplierId = supplierId;
    if (approvalStatus) query.approvalStatus = approvalStatus;

    const [pos, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('supplierId', 'companyName phone')
        .populate('createdById', 'name')
        .populate('requestedBy', 'fullName username')
        .populate('approvedBy', 'fullName username')
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

    // Approval workflow: orders above the shop's threshold wait for a manager
    const { Settings } = await import('../models/Settings');
    const settings: any = await Settings.findOne({}).lean();
    const threshold = Number(settings?.poApprovalThreshold || 0);
    const needsApproval = threshold > 0 && totalAmount > threshold;

    const po = await PurchaseOrder.create({
      poNumber,
      supplierId: dto.supplierId,
      // The branch decides where received goods land and the project drives
      // job costing, so both have to survive validation.
      branchId: dto.branchId && Types.ObjectId.isValid(dto.branchId)
        ? new Types.ObjectId(dto.branchId)
        : (currentBranchId() ? new Types.ObjectId(currentBranchId()!) : null),
      projectId: dto.projectId && Types.ObjectId.isValid(dto.projectId)
        ? new Types.ObjectId(dto.projectId)
        : null,
      status: 'DRAFT',
      approvalStatus: needsApproval ? 'PENDING_APPROVAL' : 'AUTO_APPROVED',
      requestedBy: new Types.ObjectId(userId),
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

    // Big orders ping the managers straight away (bell + live socket)
    if (needsApproval) {
      notificationService.notify({
        type: 'PO_APPROVAL',
        title: 'Purchase order needs approval',
        message: `${poNumber} for ৳${totalAmount.toFixed(2)} from ${supplier.companyName} crossed the approval threshold`,
        entityType: 'purchase-orders',
        entityId: String(po._id),
      });

      // Multi-tier workflow (Module 7) — only when one is configured for this amount
      const { approvalService } = await import('./ApprovalService');
      await approvalService.submit(
        {
          entityType: 'PURCHASE_ORDER',
          entityId: String(po._id),
          entityRef: poNumber,
          title: `Purchase order from ${supplier.companyName}`,
          amount: totalAmount,
          requestedBy: userId,
        },
        userId
      );
    } else {
      notificationService.notify({
        type: 'SYSTEM',
        title: 'Purchase order created',
        message: `${poNumber} for ৳${totalAmount.toFixed(2)} from ${supplier.companyName}`,
        entityType: 'purchase-orders',
        entityId: String(po._id),
      });
    }

    return po.toObject();
  }

  async updateStatus(id: string, status: 'ORDERED' | 'CANCELLED') {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid PO ID');
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new AppError(404, 'PO_NOT_FOUND', 'Purchase Order not found');
    if (po.status === 'RECEIVED') throw new AppError(400, 'ALREADY_RECEIVED', 'Cannot modify a fully received PO');
    if (po.status === 'CANCELLED') throw new AppError(400, 'ALREADY_CANCELLED', 'PO is already cancelled');

    // An unapproved (or rejected) order must never be sent to the supplier
    if (status === 'ORDERED') {
      const approval: any = (po as any).approvalStatus;
      if (approval === 'PENDING_APPROVAL') {
        throw new AppError(403, 'PO_PENDING_APPROVAL', 'This purchase order is waiting for manager approval');
      }
      if (approval === 'REJECTED') {
        throw new AppError(403, 'PO_REJECTED', 'This purchase order was rejected — edit it or raise a new one');
      }
    }

    po.status = status;
    await po.save();
    return po.toObject();
  }

  /** Manager approves a purchase order that is above the threshold. */
  async approve(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid PO ID');
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new AppError(404, 'PO_NOT_FOUND', 'Purchase Order not found');
    if ((po as any).approvalStatus === 'APPROVED') {
      throw new AppError(409, 'ALREADY_APPROVED', 'This purchase order is already approved');
    }
    (po as any).approvalStatus = 'APPROVED';
    (po as any).approvedBy = new Types.ObjectId(userId);
    (po as any).approvedAt = new Date();
    (po as any).rejectionReason = undefined;
    await po.save();

    notificationService.notify({
      type: 'PO_APPROVAL',
      title: 'Purchase order approved',
      message: `${po.poNumber} was approved and can be sent to the supplier`,
      entityType: 'purchase-orders',
      entityId: String(po._id),
      userId: (po as any).requestedBy ? String((po as any).requestedBy) : null,
    });

    return po.toObject();
  }

  /** Manager rejects a purchase order with a reason. */
  async reject(id: string, userId: string, reason: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid PO ID');
    if (!reason || !reason.trim()) throw new AppError(400, 'REASON_REQUIRED', 'A rejection reason is required');
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new AppError(404, 'PO_NOT_FOUND', 'Purchase Order not found');
    if (po.status === 'RECEIVED') throw new AppError(400, 'ALREADY_RECEIVED', 'A received order cannot be rejected');

    (po as any).approvalStatus = 'REJECTED';
    (po as any).approvedBy = new Types.ObjectId(userId);
    (po as any).approvedAt = new Date();
    (po as any).rejectionReason = reason.trim();
    await po.save();

    notificationService.notify({
      type: 'PO_APPROVAL',
      title: 'Purchase order rejected',
      message: `${po.poNumber} was rejected — ${reason.trim()}`,
      entityType: 'purchase-orders',
      entityId: String(po._id),
      userId: (po as any).requestedBy ? String((po as any).requestedBy) : null,
    });

    return po.toObject();
  }

  /**
   * Purchases waiting for their goods: everything that can still be received.
   *
   * A purchase waiting for approval is deliberately excluded — the goods must
   * not be booked in before a manager has signed the order off.
   */
  async listPendingReceive() {
    const rows = await PurchaseOrder.find({
      status: { $in: ['DRAFT', 'ORDERED', 'PARTIAL'] },
      approvalStatus: { $nin: ['PENDING_APPROVAL', 'REJECTED'] },
    })
      .populate('supplierId', 'companyName contactPerson phone')
      .populate('branchId', 'name code')
      .sort({ createdAt: 1 })
      .lean();

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const data = rows.map((po: any) => {
      const pendingQty = (po.items || []).reduce(
        (s: number, i: any) => s + Math.max(0, (i.orderedQty || 0) - (i.receivedQty || 0)),
        0
      );
      const pendingValue = (po.items || []).reduce(
        (s: number, i: any) => s + Math.max(0, (i.orderedQty || 0) - (i.receivedQty || 0)) * (i.unitCost || 0),
        0
      );
      return {
        id: String(po._id),
        poNumber: po.poNumber,
        supplierName: po.supplierId?.companyName || '—',
        branchName: po.branchId?.name || null,
        status: po.status,
        approvalStatus: po.approvalStatus,
        itemsCount: (po.items || []).length,
        pendingQty: round(pendingQty),
        totalAmount: po.totalAmount,
        pendingValue: round(pendingValue),
        orderedItems: (po.items || []).map((i: any) => ({
          variantId: String(i.variantId),
          productName: i.productName,
          sku: i.sku,
          orderedQty: i.orderedQty,
          receivedQty: i.receivedQty,
          pendingQty: round(Math.max(0, (i.orderedQty || 0) - (i.receivedQty || 0))),
          unitCost: i.unitCost,
        })),
        createdAt: po.createdAt,
        expectedDeliveryDate: po.expectedDeliveryDate,
        waitingDays: Math.floor((Date.now() - new Date(po.createdAt).getTime()) / 86400000),
      };
    });

    return {
      summary: {
        purchases: data.length,
        pendingQty: round(data.reduce((s, p) => s + p.pendingQty, 0)),
        pendingValue: round(data.reduce((s, p) => s + p.pendingValue, 0)),
        overdueDays: data.filter((p) => p.waitingDays > 7).length,
      },
      data,
    };
  }

  /**
   * Manual purchase receive: books in **everything still outstanding** on the
   * purchase in one action (the shop does not do partial receipts for manual
   * purchases), then flips the status to RECEIVED.
   *
   * Reuses the GRN path, so stock, weighted-average cost, stock movements,
   * supplier ledger and the double-entry journal are all identical to a
   * normal receipt — only the quantities are pre-filled.
   */
  async receiveFull(poId: string, userId: string, dto: { vendorInvoiceNo?: string; paidNow?: number } = {}) {
    if (!Types.ObjectId.isValid(poId)) throw new AppError(400, 'INVALID_ID', 'Invalid PO ID');

    const po: any = await PurchaseOrder.findById(poId).lean();
    if (!po) throw new AppError(404, 'PO_NOT_FOUND', 'Purchase Order not found');
    if (po.status === 'CANCELLED') throw new AppError(400, 'PO_CANCELLED', 'A cancelled purchase cannot be received');
    if (po.status === 'RECEIVED') throw new AppError(409, 'PO_ALREADY_RECEIVED', `${po.poNumber} is already fully received`);
    if (po.approvalStatus === 'PENDING_APPROVAL' || po.approvalStatus === 'REJECTED') {
      throw new AppError(403, 'PO_NOT_APPROVED', 'This purchase order must be approved before goods can be received');
    }

    const items = (po.items || [])
      .map((i: any) => ({
        variantId: String(i.variantId),
        receivedQty: roundMoney(Math.max(0, (i.orderedQty || 0) - (i.receivedQty || 0))),
        unitCost: i.unitCost,
      }))
      .filter((i: any) => i.receivedQty > 0);

    if (items.length === 0) {
      throw new AppError(409, 'NOTHING_TO_RECEIVE', 'Every line on this purchase has already been received');
    }

    const received = await this.receiveGRN(
      poId,
      { items, vendorInvoiceNo: dto.vendorInvoiceNo, paidNow: dto.paidNow } as GRNDto,
      userId
    );

    return {
      purchaseOrder: received,
      receivedItems: items.length,
      receivedQty: roundMoney(items.reduce((s: number, i: any) => s + i.receivedQty, 0)),
      status: (received as any)?.status,
    };
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
      const approval: any = (po as any).approvalStatus;
      if (approval === 'PENDING_APPROVAL' || approval === 'REJECTED') {
        throw new AppError(403, 'PO_NOT_APPROVED', 'This purchase order must be approved before goods can be received');
      }

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

        // Goods ordered *for* a branch land in that branch's holding; fall back
        // to the receiving user's own branch when the PO has none.
        const receivingBranchId = (po as any).branchId ? String((po as any).branchId) : currentBranchId();
        if (receivingBranchId && (variant.branchStock || []).length > 0) {
          const entry = variant.branchStock!.find((e: any) => String(e.branchId) === String(receivingBranchId));
          if (entry) {
            entry.quantity = roundMoney(entry.quantity + grnItem.receivedQty);
            entry.updatedAt = new Date();
          } else {
            variant.branchStock!.push({
              branchId: new Types.ObjectId(receivingBranchId),
              quantity: grnItem.receivedQty,
              updatedAt: new Date(),
            });
          }
        }

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
          branchId: receivingBranchId ? new Types.ObjectId(receivingBranchId) : undefined,
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
