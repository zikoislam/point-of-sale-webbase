import { Types } from 'mongoose';
import { Lead, LEAD_STAGES, LEAD_SOURCES, ILead } from '../models/Lead';
import { Customer } from '../models/Customer';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';
import { nextSequence } from './SequenceService';
import { notificationService } from './NotificationService';

export interface LeadDto {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  address?: string;
  source?: (typeof LEAD_SOURCES)[number];
  stage?: (typeof LEAD_STAGES)[number];
  estimatedValue?: number;
  probability?: number;
  assignedTo?: string | null;
  interestedIn?: string;
  notes?: string;
  nextFollowUpAt?: string | null;
}

/**
 * Lead pipeline (Module 8).
 *
 * The Kanban board is the stage list: dragging a card calls `moveStage`, and
 * `convertToCustomer` is the point where a lead becomes real business — it
 * creates (or links) the customer record and stamps the conversion time, which
 * is what the conversion-rate report measures.
 */
class LeadService {
  private async generateLeadNo(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await nextSequence(`lead_seq_${year}`);
    return `LEAD-${year}-${String(seq).padStart(4, '0')}`;
  }

  /** Kanban board: all stages, with their cards. */
  async getBoard(options: { assignedTo?: string; includeClosed?: boolean } = {}) {
    const filter: Record<string, any> = {};
    if (options.assignedTo && Types.ObjectId.isValid(options.assignedTo)) {
      filter.assignedTo = new Types.ObjectId(options.assignedTo);
    }
    if (!options.includeClosed) {
      filter.stage = { $nin: ['WON', 'LOST'] };
    }

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'fullName username')
      .sort({ nextFollowUpAt: 1, createdAt: -1 })
      .lean();

    const now = Date.now();
    const columns = LEAD_STAGES.map((stage) => {
      const cards = leads.filter((l: any) => l.stage === stage);
      return {
        stage,
        count: cards.length,
        value: roundMoney(cards.reduce((s: number, l: any) => s + (l.estimatedValue || 0), 0)),
        weightedValue: roundMoney(
          cards.reduce((s: number, l: any) => s + (l.estimatedValue || 0) * ((l.probability || 0) / 100), 0)
        ),
        cards: cards.map((l: any) => ({
          id: String(l._id),
          leadNo: l.leadNo,
          name: l.name,
          phone: l.phone,
          company: l.company,
          source: l.source,
          stage: l.stage,
          estimatedValue: l.estimatedValue,
          probability: l.probability,
          assignedTo: l.assignedTo?.fullName || 'Unassigned',
          nextFollowUpAt: l.nextFollowUpAt,
          overdueFollowUp: !!l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now,
          daysInPipeline: Math.floor((now - new Date(l.createdAt).getTime()) / 86400000),
        })),
      };
    });

    const openLeads = leads.filter((l: any) => !['WON', 'LOST'].includes(l.stage));
    return {
      summary: {
        total: leads.length,
        open: openLeads.length,
        pipelineValue: roundMoney(openLeads.reduce((s: number, l: any) => s + (l.estimatedValue || 0), 0)),
        weightedPipelineValue: roundMoney(
          openLeads.reduce((s: number, l: any) => s + (l.estimatedValue || 0) * ((l.probability || 0) / 100), 0)
        ),
        overdueFollowUps: leads.filter((l: any) => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now && !['WON', 'LOST'].includes(l.stage)).length,
        dueTodayFollowUps: leads.filter((l: any) => {
          if (!l.nextFollowUpAt) return false;
          const d = new Date(l.nextFollowUpAt);
          const today = new Date();
          return d.toDateString() === today.toDateString() && !['WON', 'LOST'].includes(l.stage);
        }).length,
      },
      columns,
    };
  }

  async list(options: { stage?: string; assignedTo?: string; search?: string; limit?: number } = {}) {
    const filter: Record<string, any> = {};
    if (options.stage) filter.stage = options.stage;
    if (options.assignedTo && Types.ObjectId.isValid(options.assignedTo)) {
      filter.assignedTo = new Types.ObjectId(options.assignedTo);
    }
    if (options.search) {
      const rx = new RegExp(options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { company: rx }, { leadNo: rx }];
    }

    return Lead.find(filter)
      .populate('assignedTo', 'fullName username')
      .populate('convertedCustomerId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(Math.min(options.limit || 100, 300))
      .lean();
  }

  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid lead ID');
    const lead = await Lead.findById(id)
      .populate('assignedTo', 'fullName username')
      .populate('convertedCustomerId', 'name phone currentDueBalance')
      .lean();
    if (!lead) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');
    return lead;
  }

  async create(dto: LeadDto, userId: string) {
    if (!dto.name?.trim()) throw new AppError(400, 'NAME_REQUIRED', 'A lead name is required');
    if (!dto.phone?.trim()) throw new AppError(400, 'PHONE_REQUIRED', 'A phone number is required');

    const leadNo = await this.generateLeadNo();
    const lead = await Lead.create({
      leadNo,
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      email: dto.email,
      company: dto.company,
      address: dto.address,
      source: dto.source || 'OTHER',
      stage: dto.stage || 'NEW',
      estimatedValue: dto.estimatedValue || 0,
      probability: dto.probability ?? 10,
      assignedTo: dto.assignedTo || null,
      interestedIn: dto.interestedIn,
      notes: dto.notes,
      nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null,
      createdBy: new Types.ObjectId(userId),
      stageHistory: [{ stage: dto.stage || 'NEW', at: new Date(), by: new Types.ObjectId(userId), note: 'Lead created' }],
    });

    return lead.toObject() as unknown as ILead;
  }

  async update(id: string, dto: Partial<LeadDto>) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid lead ID');
    const lead = await Lead.findById(id);
    if (!lead) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');
    if (lead.stage === 'WON' && dto.stage && dto.stage !== 'WON') {
      throw new AppError(409, 'LEAD_WON', 'A won lead cannot move back in the pipeline');
    }

    if (dto.name !== undefined) lead.name = dto.name.trim();
    if (dto.phone !== undefined) lead.phone = dto.phone.trim();
    if (dto.email !== undefined) lead.email = dto.email;
    if (dto.company !== undefined) lead.company = dto.company;
    if (dto.address !== undefined) lead.address = dto.address;
    if (dto.source !== undefined) lead.source = dto.source;
    if (dto.estimatedValue !== undefined) lead.estimatedValue = dto.estimatedValue;
    if (dto.probability !== undefined) lead.probability = dto.probability;
    if (dto.assignedTo !== undefined) lead.assignedTo = dto.assignedTo ? new Types.ObjectId(dto.assignedTo) : null;
    if (dto.interestedIn !== undefined) lead.interestedIn = dto.interestedIn;
    if (dto.notes !== undefined) lead.notes = dto.notes;
    if (dto.nextFollowUpAt !== undefined) lead.nextFollowUpAt = dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null;

    await lead.save();
    return lead.toObject();
  }

  /** Moves a lead along the pipeline (the Kanban drag). */
  async moveStage(id: string, dto: { stage: (typeof LEAD_STAGES)[number]; note?: string; probability?: number; lostReason?: string }, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid lead ID');
    if (!LEAD_STAGES.includes(dto.stage)) throw new AppError(400, 'INVALID_STAGE', `Unknown stage ${dto.stage}`);

    const lead = await Lead.findById(id);
    if (!lead) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');
    if (lead.stage === 'WON') throw new AppError(409, 'LEAD_WON', 'This lead is already won');

    lead.stage = dto.stage;
    if (dto.probability !== undefined) lead.probability = dto.probability;
    else if (dto.stage === 'WON') lead.probability = 100;
    else if (dto.stage === 'LOST') lead.probability = 0;
    if (dto.stage === 'LOST') lead.lostReason = dto.lostReason;
    lead.lastContactedAt = new Date();
    lead.stageHistory.push({ stage: dto.stage, at: new Date(), by: new Types.ObjectId(userId), note: dto.note });
    await lead.save();

    return lead.toObject();
  }

  /** Records a follow-up without changing the stage. */
  async logFollowUp(id: string, dto: { note?: string; nextFollowUpAt?: string | null }, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid lead ID');
    const lead = await Lead.findById(id);
    if (!lead) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');

    lead.lastContactedAt = new Date();
    lead.nextFollowUpAt = dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null;
    if (dto.note) {
      lead.stageHistory.push({ stage: lead.stage, at: new Date(), by: new Types.ObjectId(userId), note: dto.note });
    }
    await lead.save();
    return lead.toObject();
  }

  /** Won lead → customer record (the conversion that the funnel measures). */
  async convertToCustomer(id: string, dto: { customerType?: 'RETAIL' | 'WHOLESALE'; creditLimit?: number }, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid lead ID');
    const lead: any = await Lead.findById(id);
    if (!lead) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');
    if (lead.convertedCustomerId) {
      throw new AppError(409, 'ALREADY_CONVERTED', `This lead is already linked to a customer`);
    }

    // Reuse an existing customer with the same phone instead of duplicating
    let customer: any = await Customer.findOne({ phone: lead.phone });
    let created = false;
    if (!customer) {
      customer = await Customer.create({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        customerType: dto.customerType || 'RETAIL',
        creditLimit: dto.creditLimit || 0,
      });
      created = true;
    }

    lead.stage = 'WON';
    lead.probability = 100;
    lead.convertedCustomerId = customer._id;
    lead.convertedAt = new Date();
    lead.stageHistory.push({
      stage: 'WON',
      at: new Date(),
      by: new Types.ObjectId(userId),
      note: created ? 'Converted — new customer created' : 'Converted — linked to the existing customer',
    });
    await lead.save();

    notificationService.notify({
      type: 'SYSTEM',
      title: 'Lead converted',
      message: `${lead.name} (${lead.leadNo}) is now a customer — expected value ৳${roundMoney(lead.estimatedValue).toFixed(2)}`,
      entityType: 'crm/leads',
      entityId: String(lead._id),
    });

    return { lead: lead.toObject(), customer: { id: String(customer._id), name: customer.name, created } };
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid lead ID');
    const lead = await Lead.findById(id).lean();
    if (!lead) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');
    if ((lead as any).convertedCustomerId) {
      throw new AppError(409, 'LEAD_CONVERTED', 'A converted lead cannot be deleted — it is part of your customer history');
    }
    await Lead.deleteOne({ _id: id });
    return { ok: true };
  }

  /** Funnel + conversion rate, by stage and by source. */
  async getConversionReport(options: { from?: string; to?: string } = {}) {
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

    const leads = await Lead.find(filter).populate('assignedTo', 'fullName username').lean();
    const round = (n: number) => Math.round((n || 0) * 100) / 100;

    const won = leads.filter((l: any) => l.stage === 'WON');
    const lost = leads.filter((l: any) => l.stage === 'LOST');
    const open = leads.filter((l: any) => !['WON', 'LOST'].includes(l.stage));
    const decided = won.length + lost.length;

    const stageCounts = LEAD_STAGES.map((stage) => {
      const subset = leads.filter((l: any) => l.stage === stage);
      return {
        stage,
        leads: subset.length,
        value: round(subset.reduce((s: number, l: any) => s + (l.estimatedValue || 0), 0)),
        sharePercent: leads.length ? Math.round((subset.length / leads.length) * 1000) / 10 : 0,
      };
    });

    // Which channel actually converts
    const sourceMap = new Map<string, { source: string; leads: number; won: number; lost: number; value: number; wonValue: number }>();
    for (const l of leads as any[]) {
      const bucket = sourceMap.get(l.source) || { source: l.source, leads: 0, won: 0, lost: 0, value: 0, wonValue: 0 };
      bucket.leads += 1;
      bucket.value += l.estimatedValue || 0;
      if (l.stage === 'WON') {
        bucket.won += 1;
        bucket.wonValue += l.estimatedValue || 0;
      }
      if (l.stage === 'LOST') bucket.lost += 1;
      sourceMap.set(l.source, bucket);
    }

    const bySource = Array.from(sourceMap.values())
      .map((s) => ({
        source: s.source,
        leads: s.leads,
        won: s.won,
        lost: s.lost,
        conversionRatePercent: s.leads ? Math.round((s.won / s.leads) * 1000) / 10 : 0,
        pipelineValue: round(s.value),
        wonValue: round(s.wonValue),
      }))
      .sort((a, b) => b.leads - a.leads);

    const byOwner = new Map<string, { owner: string; leads: number; won: number; value: number }>();
    for (const l of leads as any[]) {
      const owner = l.assignedTo?.fullName || 'Unassigned';
      const bucket = byOwner.get(owner) || { owner, leads: 0, won: 0, value: 0 };
      bucket.leads += 1;
      if (l.stage === 'WON') bucket.won += 1;
      bucket.value += l.estimatedValue || 0;
      byOwner.set(owner, bucket);
    }

    const conversionDays = won
      .filter((l: any) => l.convertedAt)
      .map((l: any) => (new Date(l.convertedAt).getTime() - new Date(l.createdAt).getTime()) / 86400000);

    return {
      summary: {
        totalLeads: leads.length,
        open: open.length,
        won: won.length,
        lost: lost.length,
        conversionRatePercent: decided ? Math.round((won.length / decided) * 1000) / 10 : null,
        openPipelineValue: round(open.reduce((s: number, l: any) => s + (l.estimatedValue || 0), 0)),
        wonValue: round(won.reduce((s: number, l: any) => s + (l.estimatedValue || 0), 0)),
        lostValue: round(lost.reduce((s: number, l: any) => s + (l.estimatedValue || 0), 0)),
        averageDaysToConvert: conversionDays.length ? round(conversionDays.reduce((s, d) => s + d, 0) / conversionDays.length) : null,
        overdueFollowUps: leads.filter(
          (l: any) => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < Date.now() && !['WON', 'LOST'].includes(l.stage)
        ).length,
      },
      byStage: stageCounts,
      bySource,
      byOwner: Array.from(byOwner.values())
        .map((o) => ({ ...o, value: round(o.value), conversionRatePercent: o.leads ? Math.round((o.won / o.leads) * 1000) / 10 : 0 }))
        .sort((a, b) => b.leads - a.leads),
      data: leads.map((l: any) => ({
        id: String(l._id),
        leadNo: l.leadNo,
        name: l.name,
        phone: l.phone,
        company: l.company,
        source: l.source,
        stage: l.stage,
        estimatedValue: l.estimatedValue,
        probability: l.probability,
        assignedTo: l.assignedTo?.fullName || 'Unassigned',
        createdAt: l.createdAt,
        convertedAt: l.convertedAt,
        daysInPipeline: Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000),
        nextFollowUpAt: l.nextFollowUpAt,
        lostReason: l.lostReason,
      })),
    };
  }
}

export const leadService = new LeadService();
