import { Types } from 'mongoose';
import { SupportTicket, TICKET_PRIORITIES, TICKET_STATUSES } from '../models/SupportTicket';
import { AppError } from '../utils/app-error';
import { notificationService } from './NotificationService';
import { nextSequence } from './SequenceService';

export interface CreateTicketDto {
  subject: string;
  description: string;
  category?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  relatedOrderNo?: string;
  priority?: (typeof TICKET_PRIORITIES)[number];
  assigneeId?: string | null;
  slaHours?: number;
}

/** Response-time targets per priority (hours), overridable per ticket. */
const SLA_HOURS: Record<string, number> = {
  URGENT: 2,
  HIGH: 8,
  NORMAL: 24,
  LOW: 72,
};

/**
 * Customer support tickets with an SLA clock (Module 8).
 *
 * The clock starts when the ticket is created and stops at the first
 * customer-visible reply — so "how fast do we answer?" is measured honestly,
 * and the SLA report can separate on-time from breached.
 */
class SupportTicketService {
  private async generateTicketNo(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await nextSequence(`support_ticket_seq_${year}`);
    return `TKT-${year}-${String(seq).padStart(4, '0')}`;
  }

  async list(options: { status?: string; priority?: string; customerId?: string; breachedOnly?: boolean; limit?: number } = {}) {
    const filter: Record<string, any> = {};
    if (options.status) filter.status = options.status;
    if (options.priority) filter.priority = options.priority;
    if (options.customerId && Types.ObjectId.isValid(options.customerId)) {
      filter.customerId = new Types.ObjectId(options.customerId);
    }
    if (options.breachedOnly) {
      filter.status = { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER'] };
      filter.slaDueAt = { $lt: new Date() };
      filter.firstResponseAt = null;
    }

    const rows = await SupportTicket.find(filter)
      .populate('customerId', 'name phone')
      .populate('assigneeId', 'fullName username')
      .sort({ status: 1, slaDueAt: 1 })
      .limit(Math.min(options.limit || 100, 300))
      .lean();

    const now = Date.now();
    return rows.map((t: any) => {
      const responded = !!t.firstResponseAt;
      return {
        ...t,
        isBreached: !responded && new Date(t.slaDueAt).getTime() < now,
        hoursToSla: responded ? null : Math.round(((new Date(t.slaDueAt).getTime() - now) / 3600000) * 10) / 10,
        responseHours: responded
          ? Math.round(((new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime()) / 3600000) * 10) / 10
          : null,
      };
    });
  }

  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid ticket ID');
    const ticket = await SupportTicket.findById(id)
      .populate('customerId', 'name phone address')
      .populate('assigneeId', 'fullName username')
      .lean();
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Support ticket not found');
    return ticket;
  }

  async create(dto: CreateTicketDto, userId: string) {
    if (!dto.subject?.trim()) throw new AppError(400, 'SUBJECT_REQUIRED', 'A subject is required');
    if (!dto.description?.trim()) throw new AppError(400, 'DESCRIPTION_REQUIRED', 'A description is required');

    const priority = dto.priority || 'NORMAL';
    const slaHours = dto.slaHours || SLA_HOURS[priority] || 24;
    const ticketNo = await this.generateTicketNo();

    const ticket = await SupportTicket.create({
      ticketNo,
      subject: dto.subject.trim(),
      description: dto.description.trim(),
      category: dto.category,
      customerId: dto.customerId || null,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      relatedOrderNo: dto.relatedOrderNo,
      priority,
      status: 'OPEN',
      assigneeId: dto.assigneeId || null,
      slaHours,
      slaDueAt: new Date(Date.now() + slaHours * 3600000),
      createdBy: new Types.ObjectId(userId),
    });

    notificationService.notify({
      type: 'SYSTEM',
      title: `New support ticket ${ticketNo}`,
      message: `${dto.subject.trim()} · ${priority} priority · respond within ${slaHours}h`,
      entityType: 'support-tickets',
      entityId: String(ticket._id),
    });

    return ticket.toObject();
  }

  async update(id: string, dto: Partial<CreateTicketDto> & { status?: (typeof TICKET_STATUSES)[number] }) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid ticket ID');
    const ticket = await SupportTicket.findById(id);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Support ticket not found');

    if (dto.subject !== undefined) ticket.subject = dto.subject.trim();
    if (dto.description !== undefined) ticket.description = dto.description.trim();
    if (dto.category !== undefined) ticket.category = dto.category;
    if (dto.relatedOrderNo !== undefined) ticket.relatedOrderNo = dto.relatedOrderNo;
    if (dto.customerName !== undefined) ticket.customerName = dto.customerName;
    if (dto.customerPhone !== undefined) ticket.customerPhone = dto.customerPhone;
    if (dto.assigneeId !== undefined) ticket.assigneeId = dto.assigneeId ? new Types.ObjectId(dto.assigneeId) : null;
    if (dto.priority !== undefined) {
      ticket.priority = dto.priority;
      ticket.slaHours = dto.slaHours || SLA_HOURS[dto.priority] || ticket.slaHours;
      // Moving the priority re-plans the response deadline from now
      if (!ticket.firstResponseAt) ticket.slaDueAt = new Date(Date.now() + ticket.slaHours * 3600000);
    }
    if (dto.slaHours !== undefined && dto.priority === undefined) {
      ticket.slaHours = dto.slaHours;
      if (!ticket.firstResponseAt) ticket.slaDueAt = new Date(Date.now() + dto.slaHours * 3600000);
    }
    if (dto.status !== undefined) {
      ticket.status = dto.status;
      if (['RESOLVED', 'CLOSED'].includes(dto.status)) {
        ticket.resolvedAt = ticket.resolvedAt || new Date();
      } else if (dto.status === 'OPEN' || dto.status === 'IN_PROGRESS') {
        ticket.resolvedAt = null;
      }
    }

    await ticket.save();
    return ticket.toObject();
  }

  /** Adds a reply; the first customer-visible one stops the SLA clock. */
  async addResponse(
    id: string,
    dto: { message: string; isCustomerVisible?: boolean; byName?: string },
    userId: string
  ) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid ticket ID');
    if (!dto.message?.trim()) throw new AppError(400, 'MESSAGE_REQUIRED', 'A message is required');

    const ticket = await SupportTicket.findById(id);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Support ticket not found');

    const isCustomerVisible = dto.isCustomerVisible !== false;
    ticket.responses.push({
      at: new Date(),
      by: new Types.ObjectId(userId),
      byName: dto.byName,
      isCustomerVisible,
      message: dto.message.trim(),
    });

    let slaMet: boolean | null = null;
    if (isCustomerVisible && !ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date();
      slaMet = ticket.firstResponseAt <= ticket.slaDueAt;
    }
    if (ticket.status === 'OPEN') ticket.status = 'IN_PROGRESS';

    await ticket.save();
    return { ticket: ticket.toObject(), slaMet };
  }

  /** Closes a ticket with its resolution. */
  async resolve(id: string, dto: { resolution: string; satisfactionRating?: number }, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid ticket ID');
    const ticket = await SupportTicket.findById(id);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Support ticket not found');
    if (!ticket.firstResponseAt) ticket.firstResponseAt = new Date();

    ticket.resolution = dto.resolution;
    ticket.satisfactionRating = dto.satisfactionRating;
    ticket.status = 'RESOLVED';
    ticket.resolvedAt = new Date();
    await ticket.save();

    const responseHours = (ticket.resolvedAt.getTime() - new Date(ticket.createdAt).getTime()) / 3600000;
    return { ticket: ticket.toObject(), resolutionHours: Math.round(responseHours * 10) / 10 };
  }

  /** Ticket stats + SLA compliance (also used by the report). */
  async getSlaReport(options: { from?: string; to?: string } = {}) {
    const filter: Record<string, any> = {};
    if (options.from || options.to) {
      filter.createdAt = {};
      if (options.from) filter.createdAt.$gte = new Date(options.from);
      if (options.to) {
        const end = new Date(options.to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const tickets = await SupportTicket.find(filter)
      .populate('assigneeId', 'fullName username')
      .lean();

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const now = Date.now();
    const open = tickets.filter((t: any) => ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER'].includes(t.status));
    const responded = tickets.filter((t: any) => !!t.firstResponseAt);
    const breached = responded.filter((t: any) => new Date(t.firstResponseAt) > new Date(t.slaDueAt));
    // "Overdue" = still unanswered past the deadline; an already-answered
    // ticket is a breach, not an open risk.
    const openBreached = open.filter((t: any) => !t.firstResponseAt && new Date(t.slaDueAt) < new Date(now));
    const resolved = tickets.filter((t: any) => !!t.resolvedAt);

    const responseTimes = responded.map(
      (t: any) => (new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime()) / 3600000
    );
    const resolutionTimes = resolved.map(
      (t: any) => (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000
    );

    const byPriority = TICKET_PRIORITIES.map((priority) => {
      const subset = tickets.filter((t: any) => t.priority === priority);
      const subResponded = subset.filter((t: any) => !!t.firstResponseAt);
      const subBreached = subResponded.filter((t: any) => new Date(t.firstResponseAt) > new Date(t.slaDueAt));
      return {
        priority,
        tickets: subset.length,
        responded: subResponded.length,
        breached: subBreached.length,
        compliancePercent: subResponded.length
          ? Math.round(((subResponded.length - subBreached.length) / subResponded.length) * 1000) / 10
          : null,
      };
    }).filter((r) => r.tickets > 0);

    const byStatus = TICKET_STATUSES.map((status) => ({
      status,
      tickets: tickets.filter((t: any) => t.status === status).length,
    })).filter((r) => r.tickets > 0);

    // Per-agent workload, so a manager can see who is carrying the load
    const agentMap = new Map<string, { agent: string; assigned: number; resolved: number; breached: number }>();
    for (const t of tickets as any[]) {
      const name = t.assigneeId?.fullName || 'Unassigned';
      const bucket = agentMap.get(name) || { agent: name, assigned: 0, resolved: 0, breached: 0 };
      bucket.assigned += 1;
      if (t.resolvedAt) bucket.resolved += 1;
      if (t.firstResponseAt && new Date(t.firstResponseAt) > new Date(t.slaDueAt)) bucket.breached += 1;
      agentMap.set(name, bucket);
    }

    return {
      summary: {
        tickets: tickets.length,
        open: open.length,
        resolved: resolved.length,
        slaBreached: breached.length + openBreached.length,
        slaCompliancePercent: responded.length
          ? Math.round(((responded.length - breached.length) / responded.length) * 1000) / 10
          : null,
        averageResponseHours: responseTimes.length ? round(responseTimes.reduce((s, h) => s + h, 0) / responseTimes.length) : null,
        averageResolutionHours: resolutionTimes.length ? round(resolutionTimes.reduce((s, h) => s + h, 0) / resolutionTimes.length) : null,
        currentlyOverdue: openBreached.length,
        averageRating: (() => {
          const rated = tickets.filter((t: any) => t.satisfactionRating);
          return rated.length
            ? round(rated.reduce((s: number, t: any) => s + t.satisfactionRating, 0) / rated.length)
            : null;
        })(),
      },
      byPriority,
      byStatus,
      byAgent: Array.from(agentMap.values()).sort((a, b) => b.assigned - a.assigned),
      data: tickets.map((t: any) => ({
        id: String(t._id),
        ticketNo: t.ticketNo,
        subject: t.subject,
        customer: t.customerName || t.customerId?.name || '—',
        priority: t.priority,
        status: t.status,
        assignee: t.assigneeId?.fullName || 'Unassigned',
        createdAt: t.createdAt,
        slaDueAt: t.slaDueAt,
        firstResponseAt: t.firstResponseAt,
        resolvedAt: t.resolvedAt,
        responseHours: t.firstResponseAt
          ? round((new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)
          : null,
        resolutionHours: t.resolvedAt
          ? round((new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)
          : null,
        slaMet: t.firstResponseAt ? new Date(t.firstResponseAt) <= new Date(t.slaDueAt) : null,
        isBreached: !t.firstResponseAt && new Date(t.slaDueAt).getTime() < now,
        responses: (t.responses || []).length,
      })),
    };
  }
}

export const supportTicketService = new SupportTicketService();
