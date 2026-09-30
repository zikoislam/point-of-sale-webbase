import mongoose, { Types, ClientSession } from 'mongoose';
import { StockTransfer, IStockTransfer, IStockTransferItem } from '../models/StockTransfer';
import { Branch } from '../models/Branch';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { AppError } from '../utils/app-error';
import { generateStockTransferNo } from './SequenceService';
import { roundMoney } from '../utils/helpers';
import { notificationService } from './NotificationService';

export interface StockTransferItemDto {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CreateStockTransferDto {
  fromBranchId: string;
  toBranchId: string;
  items: StockTransferItemDto[];
  notes?: string;
}

/**
 * Moves stock between branches of a chain.
 *
 * Stock lives on `variants[].currentStock` (organization-wide) with the split
 * per branch in `variants[].branchStock[]`, so a transfer only shifts quantity
 * between two branchStock entries of the *same* variant — the organisation
 * total is untouched and no SKU/barcode is ever duplicated.
 *
 * Lifecycle (issue request → approval → incoming → received):
 *   create   : PENDING  + PENDING_APPROVAL   (stock has not moved yet)
 *   approve  : PENDING  + APPROVED → dispatches → IN_TRANSIT (source ↓,
 *              and the destination now sees it on its incoming board)
 *   receive  : IN_TRANSIT → RECEIVED         (destination branch stock ↑)
 *   reject   : PENDING  + REJECTED           (nothing moved)
 *   cancel   : restores the source if the goods were already in transit
 */
class StockTransferService {
  /** The shop's own role names that may approve an issue request. */
  private static APPROVER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER'];

  async list(options: { status?: string; approvalStatus?: string; branchId?: string; limit?: number; page?: number } = {}) {
    const filter: Record<string, any> = {};
    if (options.status) filter.status = options.status;
    if (options.approvalStatus) filter.approvalStatus = options.approvalStatus;
    if (options.branchId && Types.ObjectId.isValid(options.branchId)) {
      const oid = new Types.ObjectId(options.branchId);
      filter.$or = [{ fromBranchId: oid }, { toBranchId: oid }];
    }

    const limit = Math.min(100, options.limit || 20);
    const page = Math.max(1, options.page || 1);

    const [rows, total] = await Promise.all([
      StockTransfer.find(filter)
        .populate('fromBranchId', 'name code')
        .populate('toBranchId', 'name code')
        .populate('createdBy', 'fullName username')
        .populate('requestedById', 'fullName username')
        .populate('approvedById', 'fullName username')
        .populate('sentBy', 'fullName username')
        .populate('receivedBy', 'fullName username')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StockTransfer.countDocuments(filter),
    ]);

    return { data: rows, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Incoming board for a branch: goods approved and dispatched to it that are
   * still waiting to be received.
   */
  async listIncoming(options: { branchId?: string; includeReceived?: boolean } = {}) {
    const filter: Record<string, any> = {};
    if (options.branchId && Types.ObjectId.isValid(options.branchId)) {
      filter.toBranchId = new Types.ObjectId(options.branchId);
    }
    filter.status = options.includeReceived ? { $in: ['IN_TRANSIT', 'RECEIVED'] } : 'IN_TRANSIT';

    const rows = await StockTransfer.find(filter)
      .populate('fromBranchId', 'name code')
      .populate('toBranchId', 'name code')
      .populate('sentBy', 'fullName username')
      .populate('approvedById', 'fullName username')
      .sort({ sentAt: -1 })
      .lean();

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    return {
      summary: {
        transfers: rows.length,
        items: rows.reduce((s: number, r: any) => s + (r.items?.length || 0), 0),
        value: round(rows.reduce((s: number, r: any) => s + (r.totalValue || 0), 0)),
        oldestSentAt: rows.length ? rows[rows.length - 1]?.sentAt : null,
      },
      data: rows,
    };
  }

  /** The manager's approval queue: issue requests that have not moved yet. */
  async listPendingApproval() {
    const rows = await StockTransfer.find({ approvalStatus: 'PENDING_APPROVAL', status: 'PENDING' })
      .populate('fromBranchId', 'name code')
      .populate('toBranchId', 'name code')
      .populate('requestedById', 'fullName username')
      .sort({ createdAt: 1 })
      .lean();

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    return {
      summary: {
        requests: rows.length,
        value: round(rows.reduce((s: number, r: any) => s + (r.totalValue || 0), 0)),
        oldestRequestedAt: rows.length ? rows[0]?.createdAt : null,
      },
      data: rows,
    };
  }

  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid transfer ID');
    const transfer = await StockTransfer.findById(id)
      .populate('fromBranchId', 'name code address city phone')
      .populate('toBranchId', 'name code address city phone')
      .populate('createdBy', 'fullName username')
      .populate('sentBy', 'fullName username')
      .populate('receivedBy', 'fullName username')
      .lean();
    if (!transfer) throw new AppError(404, 'TRANSFER_NOT_FOUND', 'Stock transfer not found');
    return transfer;
  }

  async create(dto: CreateStockTransferDto, userId: string, requesterRole?: string) {
    if (!dto.items?.length) throw new AppError(400, 'NO_ITEMS', 'Add at least one item to transfer');
    if (dto.fromBranchId === dto.toBranchId) {
      throw new AppError(400, 'SAME_BRANCH', 'Source and destination branch cannot be the same');
    }

    const fromBranch = await Branch.findById(dto.fromBranchId).lean();
    if (!fromBranch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Source branch not found');
    const toBranch = await Branch.findById(dto.toBranchId).lean();
    if (!toBranch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Destination branch not found');

    const items: IStockTransferItem[] = [];
    let totalValue = 0;

    for (const line of dto.items) {
      if (!Types.ObjectId.isValid(line.productId) || !Types.ObjectId.isValid(line.variantId)) {
        throw new AppError(400, 'INVALID_ID', 'Invalid product or variant ID');
      }
      if (!(line.quantity > 0)) throw new AppError(400, 'INVALID_QTY', 'Quantity must be greater than zero');

      const product: any = await Product.findById(line.productId).lean();
      if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product not found`);
      const variant: any = (product.variants || []).find((v: any) => String(v._id) === String(line.variantId));
      if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', `Variant not found for ${product.name}`);

      // Availability at the source: branch split when present, else org total
      const entry = (variant.branchStock || []).find(
        (e: any) => String(e.branchId) === String(fromBranch._id)
      );
      const availableAtSource = entry ? entry.quantity : variant.currentStock;
      if (availableAtSource < line.quantity) {
        throw new AppError(
          400,
          'INSUFFICIENT_STOCK',
          `${product.name} (${variant.attributeName}) has only ${availableAtSource} at ${fromBranch.name}`
        );
      }

      items.push({
        productId: new Types.ObjectId(line.productId),
        variantId: new Types.ObjectId(line.variantId),
        productName: product.name,
        variantName: variant.attributeName,
        sku: variant.sku,
        quantity: line.quantity,
        unitCost: variant.costPrice || 0,
        receivedQty: 0,
      });
      totalValue += line.quantity * (variant.costPrice || 0);
    }

    const transferNumber = await generateStockTransferNo();
    // A manager issuing stock does not need to approve their own request, so
    // the chain only kicks in for staff-raised issues.
    const isManager = !!requesterRole && StockTransferService.APPROVER_ROLES.includes(String(requesterRole).toUpperCase());
    const transfer = await StockTransfer.create({
      transferNumber,
      fromBranchId: dto.fromBranchId,
      toBranchId: dto.toBranchId,
      items,
      totalValue: roundMoney(totalValue),
      status: 'PENDING',
      approvalStatus: isManager ? 'APPROVED' : 'PENDING_APPROVAL',
      requestedById: new Types.ObjectId(userId),
      approvedById: isManager ? new Types.ObjectId(userId) : null,
      approvedAt: isManager ? new Date() : null,
      notes: dto.notes,
      createdBy: new Types.ObjectId(userId),
    });

    // Raised by a manager → dispatch immediately so the destination branch sees
    // it on its incoming board right away.
    if (isManager) {
      return this.dispatch(String(transfer._id), userId, 'Raised by a manager — auto-dispatched');
    }

    notificationService.notify({
      type: 'SYSTEM',
      title: 'Stock issue request needs approval',
      message: `${transferNumber}: ${items.length} item(s) from ${fromBranch.name} to ${toBranch.name} — waiting for a manager`,
      entityType: 'stock-transfers',
      entityId: String(transfer._id),
    });

    return transfer.toObject() as unknown as IStockTransfer;
  }

  /**
   * Manager approval of an issue request. Approving *is* the issue: the goods
   * leave the source branch and the destination branch sees them on its
   * incoming board.
   */
  async approve(id: string, userId: string, note?: string, approverRole?: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid transfer ID');
    const transfer = await StockTransfer.findById(id);
    if (!transfer) throw new AppError(404, 'TRANSFER_NOT_FOUND', 'Stock transfer not found');
    if (transfer.approvalStatus === 'REJECTED') {
      throw new AppError(409, 'TRANSFER_REJECTED', 'A rejected issue request cannot be approved');
    }
    if (transfer.approvalStatus === 'APPROVED' && transfer.status !== 'PENDING') {
      throw new AppError(409, 'ALREADY_APPROVED', `This transfer is already ${transfer.status.toLowerCase()}`);
    }

    // A manager approves; the requester cannot wave their own request through
    // unless they hold an approver role.
    const role = String(approverRole || '').toUpperCase();
    const isApprover = StockTransferService.APPROVER_ROLES.includes(role) || !approverRole;
    const isRequester = String((transfer as any).requestedById || transfer.createdBy) === String(userId);
    if (isRequester && !StockTransferService.APPROVER_ROLES.includes(role) && approverRole) {
      throw new AppError(403, 'SELF_APPROVAL', 'An issue request must be approved by a manager, not by the requester');
    }
    if (approverRole && !isApprover) {
      throw new AppError(403, 'NOT_AN_APPROVER', 'Only a manager or admin can approve a stock issue request');
    }

    transfer.approvalStatus = 'APPROVED';
    transfer.approvedById = new Types.ObjectId(userId);
    transfer.approvedAt = new Date();
    await transfer.save();

    return this.dispatch(id, userId, note || 'Approved and dispatched');
  }

  /** Manager rejects the issue request — nothing moves. */
  async reject(id: string, userId: string, reason?: string, approverRole?: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid transfer ID');
    const transfer = await StockTransfer.findById(id);
    if (!transfer) throw new AppError(404, 'TRANSFER_NOT_FOUND', 'Stock transfer not found');
    if (transfer.status !== 'PENDING') {
      throw new AppError(409, 'INVALID_STATUS', `A ${transfer.status.toLowerCase()} transfer can no longer be rejected`);
    }
    const role = String(approverRole || '').toUpperCase();
    if (approverRole && !StockTransferService.APPROVER_ROLES.includes(role)) {
      throw new AppError(403, 'NOT_AN_APPROVER', 'Only a manager or admin can reject a stock issue request');
    }

    transfer.approvalStatus = 'REJECTED';
    transfer.approvedById = new Types.ObjectId(userId);
    transfer.approvedAt = new Date();
    transfer.rejectionReason = reason;
    await transfer.save();

    notificationService.notify({
      type: 'SYSTEM',
      title: 'Stock issue rejected',
      message: `${transfer.transferNumber} was rejected${reason ? ` — ${reason}` : ''}`,
      entityType: 'stock-transfers',
      entityId: String(transfer._id),
      userId: String((transfer as any).requestedById || transfer.createdBy),
    });

    return transfer.toObject() as unknown as IStockTransfer;
  }

  /** Kept for compatibility: an approved request that has not left yet. */
  async send(id: string, userId: string) {
    return this.dispatch(id, userId, 'Dispatched');
  }

  /** Dispatch: take the goods out of the source branch into transit. */
  async dispatch(id: string, userId: string, note?: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid transfer ID');
    const transfer = await StockTransfer.findById(id);
    if (!transfer) throw new AppError(404, 'TRANSFER_NOT_FOUND', 'Stock transfer not found');
    if (transfer.approvalStatus === 'PENDING_APPROVAL') {
      throw new AppError(409, 'TRANSFER_PENDING_APPROVAL', 'This issue request is waiting for a manager to approve it');
    }
    if (transfer.approvalStatus === 'REJECTED') {
      throw new AppError(409, 'TRANSFER_REJECTED', 'This issue request was rejected');
    }
    if (transfer.status !== 'PENDING') {
      throw new AppError(409, 'INVALID_STATUS', `A ${transfer.status.toLowerCase()} transfer cannot be sent`);
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of transfer.items) {
          const { stockBefore, stockAfter } = await this.adjustBranchStock(
            String(item.productId),
            String(item.variantId),
            String(transfer.fromBranchId),
            -item.quantity,
            session
          );

          await StockMovement.create(
            [
              {
                branchId: transfer.fromBranchId,
                productId: item.productId,
                variantId: item.variantId,
                type: 'OUT',
                quantity: item.quantity,
                stockBefore,
                stockAfter,
                unitCost: item.unitCost,
                referenceType: 'MANUAL',
                referenceId: transfer._id,
                reason: `Transfer ${transfer.transferNumber} issued${note ? ` — ${note}` : ''}`,
                userId: new Types.ObjectId(userId),
              },
            ],
            { session }
          );
        }

        transfer.status = 'IN_TRANSIT';
        transfer.sentBy = new Types.ObjectId(userId);
        transfer.sentAt = new Date();
        await transfer.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return transfer.toObject() as unknown as IStockTransfer;
  }

  /** Receive at the destination (quantities may be short — shortfall is lost). */
  async receive(id: string, received: Array<{ variantId: string; quantity: number }>, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid transfer ID');
    const transfer = await StockTransfer.findById(id);
    if (!transfer) throw new AppError(404, 'TRANSFER_NOT_FOUND', 'Stock transfer not found');
    if (transfer.status !== 'IN_TRANSIT') {
      throw new AppError(409, 'INVALID_STATUS', `Only an in-transit transfer can be received (current: ${transfer.status})`);
    }

    const receivedMap = new Map((received || []).map((r) => [String(r.variantId), r.quantity]));

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of transfer.items) {
          const qty = receivedMap.has(String(item.variantId))
            ? Number(receivedMap.get(String(item.variantId)))
            : item.quantity;
          if (qty < 0 || qty > item.quantity) {
            throw new AppError(400, 'INVALID_QTY', `Received quantity for ${item.productName} must be between 0 and ${item.quantity}`);
          }
          item.receivedQty = qty;

          if (qty > 0) {
            const { stockBefore, stockAfter } = await this.adjustBranchStock(
              String(item.productId),
              String(item.variantId),
              String(transfer.toBranchId),
              qty,
              session
            );

            await StockMovement.create(
              [
                {
                  branchId: transfer.toBranchId,
                  productId: item.productId,
                  variantId: item.variantId,
                  type: 'IN',
                  quantity: qty,
                  stockBefore,
                  stockAfter,
                  unitCost: item.unitCost,
                  referenceType: 'MANUAL',
                  referenceId: transfer._id,
                  reason: `Transfer ${transfer.transferNumber} received`,
                  userId: new Types.ObjectId(userId),
                },
              ],
              { session }
            );
          }
        }

        transfer.status = 'RECEIVED';
        transfer.receivedBy = new Types.ObjectId(userId);
        transfer.receivedAt = new Date();
        await transfer.save({ session });
      });
    } finally {
      await session.endSession();
    }

    notificationService.notify({
      type: 'SYSTEM',
      title: 'Stock transfer received',
      message: `${transfer.transferNumber} was received with ${transfer.items.reduce((s, i) => s + i.receivedQty, 0)} of ${transfer.items.reduce((s, i) => s + i.quantity, 0)} unit(s)`,
      entityType: 'stock-transfers',
      entityId: String(transfer._id),
    });

    return transfer.toObject() as unknown as IStockTransfer;
  }

  /** Cancel before receiving; if already dispatched, the stock returns home. */
  async cancel(id: string, userId: string, reason?: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid transfer ID');
    const transfer = await StockTransfer.findById(id);
    if (!transfer) throw new AppError(404, 'TRANSFER_NOT_FOUND', 'Stock transfer not found');
    if (transfer.status === 'RECEIVED') throw new AppError(409, 'INVALID_STATUS', 'A received transfer cannot be cancelled');
    if (transfer.status === 'CANCELLED') throw new AppError(409, 'INVALID_STATUS', 'This transfer is already cancelled');

    const wasInTransit = transfer.status === 'IN_TRANSIT';

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (wasInTransit) {
          for (const item of transfer.items) {
            const { stockBefore, stockAfter } = await this.adjustBranchStock(
              String(item.productId),
              String(item.variantId),
              String(transfer.fromBranchId),
              item.quantity,
              session
            );
            await StockMovement.create(
              [
                {
                  branchId: transfer.fromBranchId,
                  productId: item.productId,
                  variantId: item.variantId,
                  type: 'IN',
                  quantity: item.quantity,
                  stockBefore,
                  stockAfter,
                  unitCost: item.unitCost,
                  referenceType: 'MANUAL',
                  referenceId: transfer._id,
                  reason: `Transfer ${transfer.transferNumber} cancelled — stock returned`,
                  userId: new Types.ObjectId(userId),
                },
              ],
              { session }
            );
          }
        }
        transfer.status = 'CANCELLED';
        transfer.notes = reason ? `${transfer.notes ? `${transfer.notes} | ` : ''}Cancelled: ${reason}` : transfer.notes;
        await transfer.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return transfer.toObject() as unknown as IStockTransfer;
  }

  /**
   * Single write path for per-branch stock: keeps `branchStock[]` and the
   * organization-wide `currentStock` consistent.
   *
   * `delta` is signed. When the variant has no branch split yet we create one
   * that mirrors the current total, so nothing is silently lost.
   */
  async adjustBranchStock(
    productId: string,
    variantId: string,
    branchId: string,
    delta: number,
    session?: ClientSession
  ): Promise<{ stockBefore: number; stockAfter: number }> {
    const product: any = await Product.findById(productId).session(session || null);
    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');

    const variant: any = product.variants.id(variantId);
    if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Variant not found');

    const stockBefore = roundMoney(variant.currentStock || 0);
    if (!Array.isArray(variant.branchStock)) variant.branchStock = [];

    if (variant.branchStock.length === 0 && (variant.currentStock || 0) + delta > 0) {
      // Nothing was ever split across branches: treat the whole on-hand stock
      // as sitting at the branch being adjusted, then apply the delta. No
      // quantity is invented or lost.
      variant.branchStock.push({
        branchId: new Types.ObjectId(branchId),
        quantity: variant.currentStock || 0,
        updatedAt: new Date(),
      });
    }

    const entry = variant.branchStock.find((e: any) => String(e.branchId) === String(branchId));
    const next = roundMoney((entry?.quantity || 0) + delta);
    if (next < 0) {
      throw new AppError(400, 'INSUFFICIENT_STOCK', `Not enough stock at this branch (${entry?.quantity || 0} available)`);
    }

    if (entry) {
      entry.quantity = next;
      entry.updatedAt = new Date();
    } else if (delta > 0) {
      variant.branchStock.push({ branchId: new Types.ObjectId(branchId), quantity: next, updatedAt: new Date() });
    }

    // Organization total follows every movement
    variant.currentStock = roundMoney((variant.currentStock || 0) + delta);
    if (variant.currentStock < 0) variant.currentStock = 0;

    await product.save({ session });
    return { stockBefore, stockAfter: variant.currentStock };
  }
}

export const stockTransferService = new StockTransferService();
