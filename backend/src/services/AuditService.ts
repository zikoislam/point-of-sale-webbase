import { Types } from 'mongoose';
import { AuditLog, IAuditLog } from '../models/AuditLog';

class AuditService {
  async logAction(
    userId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PRICE_OVERRIDE' | 'OFFLINE_OVERSELL' | 'SHIFT_DISCREPANCY',
    entity: string,
    entityId: string,
    metadata: Record<string, any> = {},
    ipAddress?: string
  ): Promise<IAuditLog> {
    const log = await AuditLog.create({
      userId: new Types.ObjectId(userId),
      action,
      entity,
      entityId,
      metadata,
      ipAddress,
    });
    return log.toObject() as unknown as IAuditLog;
  }

  async list(page = 1, limit = 50, entity?: string, action?: string, userId?: string) {
    const query: any = {};
    if (entity) query.entity = entity;
    if (action) query.action = action;
    if (userId && Types.ObjectId.isValid(userId)) query.userId = new Types.ObjectId(userId);

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return { data: logs, total, page, totalPages: Math.ceil(total / limit) };
  }
}

export const auditService = new AuditService();
