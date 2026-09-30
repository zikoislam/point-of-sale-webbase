import mongoose, { Types } from 'mongoose';
import { LetterOfCredit, LC_STATUSES, LcStatus } from '../models/LetterOfCredit';
import { ProformaInvoice, IPiItem } from '../models/ProformaInvoice';
import { CommercialInvoice, ICiItem } from '../models/CommercialInvoice';
import { CnfAgent, CnfAgentLedger } from '../models/CnfAgent';
import { Product } from '../models/Product';
import { Supplier } from '../models/Supplier';
import { StockMovement } from '../models/StockMovement';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';
import { notificationService } from './NotificationService';
import { generateLcNumber, generatePiNumber, generateCiNumber } from './SequenceService';

export interface CreateLcDto {
  lcType?: 'IMPORT' | 'EXPORT';
  beneficiarySupplierId?: string;
  buyerCustomerId?: string;
  issuingBank: string;
  bankBranch?: string;
  bankRefNo?: string;
  currency?: string;
  exchangeRate: number;
  lcAmount: number;
  issueDate?: string;
  expiryDate?: string;
  latestShipmentDate?: string;
  incoterms?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  charges?: Array<{ label: string; amount: number }>;
  marginPercent?: number;
  notes?: string;
}

export interface CreatePiDto {
  supplierPiNo?: string;
  supplierId: string;
  lcId?: string;
  currency?: string;
  exchangeRate: number;
  items: Array<{
    description: string;
    hsnCode?: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
  }>;
  freightCost?: number;
  insuranceCost?: number;
  incoterms?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  expectedShipmentDate?: string;
  notes?: string;
}

export interface CreateCiDto {
  supplierCiNo?: string;
  lcId?: string;
  piId?: string;
  supplierId: string;
  invoiceDate?: string;
  currency?: string;
  exchangeRate: number;
  allocationBasis?: 'VALUE' | 'QUANTITY';
  items: Array<{
    description: string;
    hsnCode?: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    productId?: string;
    variantId?: string;
  }>;
  freightCostBdt?: number;
  insuranceCostBdt?: number;
  dutyAmountBdt?: number;
  vatAmountBdt?: number;
  otherChargesBdt?: number;
  cnfChargesBdt?: number;
  shipping?: {
    blNumber?: string;
    blDate?: string;
    vesselName?: string;
    containerNo?: string;
    portOfLoading?: string;
    portOfDischarge?: string;
    arrivalDate?: string;
  };
  notes?: string;
}

/** Legal LC status moves — anything else is refused. */
const LC_TRANSITIONS: Record<LcStatus, LcStatus[]> = {
  DRAFT: ['OPENED', 'CANCELLED'],
  OPENED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['RETIRED'],
  RETIRED: [],
  CANCELLED: [],
};

const CI_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['CUSTOMS', 'CANCELLED'],
  CUSTOMS: ['CLEARED', 'CANCELLED'],
  CLEARED: [],
  CANCELLED: [],
};

/**
 * Import / export (LC) module.
 *
 * The important piece is the landed cost: goods value (at the LC exchange
 * rate) plus freight, insurance, customs duty, VAT, LC bank charges and C&F
 * charges, allocated across the shipment — then written onto the product
 * variants so inventory valuation and margin reports reflect reality.
 */
class ImportExportService {
  /* ───────────────────────────── Letters of credit ───────────────────────── */

  async listLcs(options: { status?: string; search?: string; limit?: number; page?: number } = {}) {
    const filter: Record<string, any> = {};
    if (options.status) filter.status = options.status;
    if (options.search) {
      const rx = new RegExp(options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ lcNumber: rx }, { issuingBank: rx }, { bankRefNo: rx }];
    }

    const limit = Math.min(100, options.limit || 20);
    const page = Math.max(1, options.page || 1);
    const [data, total] = await Promise.all([
      LetterOfCredit.find(filter)
        .populate('beneficiarySupplierId', 'companyName contactPerson')
        .populate('buyerCustomerId', 'name phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LetterOfCredit.countDocuments(filter),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getLc(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid LC ID');
    const lc: any = await LetterOfCredit.findById(id)
      .populate('beneficiarySupplierId', 'companyName contactPerson phone email address')
      .populate('buyerCustomerId', 'name phone address')
      .lean();
    if (!lc) throw new AppError(404, 'LC_NOT_FOUND', 'Letter of credit not found');

    const [pis, cis] = await Promise.all([
      ProformaInvoice.find({ lcId: lc._id }).select('piNumber totalValue totalValueBdt status').lean(),
      CommercialInvoice.find({ lcId: lc._id })
        .select('ciNumber goodsValueBdt landedCostBdt status costApplied')
        .lean(),
    ]);

    return { ...lc, proformaInvoices: pis, commercialInvoices: cis };
  }

  async createLc(dto: CreateLcDto, userId: string) {
    if (!dto.issuingBank?.trim()) throw new AppError(400, 'BANK_REQUIRED', 'Issuing bank is required');
    if (!(dto.exchangeRate > 0)) throw new AppError(400, 'INVALID_RATE', 'Exchange rate must be greater than zero');
    if (!(dto.lcAmount > 0)) throw new AppError(400, 'INVALID_AMOUNT', 'LC amount must be greater than zero');

    if (dto.beneficiarySupplierId && !(await Supplier.findById(dto.beneficiarySupplierId).lean())) {
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Beneficiary supplier not found');
    }

    const lcNumber = await generateLcNumber();
    const charges = (dto.charges || []).map((c) => ({
      label: String(c.label || '').trim() || 'Charge',
      amount: Number(c.amount) || 0,
    }));
    const totalCharges = roundMoney(charges.reduce((s, c) => s + c.amount, 0));

    const lc = await LetterOfCredit.create({
      lcNumber,
      lcType: dto.lcType || 'IMPORT',
      beneficiarySupplierId: dto.beneficiarySupplierId || null,
      buyerCustomerId: dto.buyerCustomerId || null,
      issuingBank: dto.issuingBank.trim(),
      bankBranch: dto.bankBranch,
      bankRefNo: dto.bankRefNo,
      currency: (dto.currency || 'USD').toUpperCase(),
      exchangeRate: dto.exchangeRate,
      lcAmount: dto.lcAmount,
      lcAmountBdt: roundMoney(dto.lcAmount * dto.exchangeRate),
      issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      latestShipmentDate: dto.latestShipmentDate ? new Date(dto.latestShipmentDate) : null,
      incoterms: dto.incoterms,
      portOfLoading: dto.portOfLoading,
      portOfDischarge: dto.portOfDischarge,
      charges,
      totalCharges,
      marginPercent: dto.marginPercent,
      status: 'DRAFT',
      notes: dto.notes,
      createdBy: new Types.ObjectId(userId),
      statusHistory: [{ status: 'DRAFT', at: new Date(), by: new Types.ObjectId(userId), note: 'Created' }],
    });

    return lc.toObject();
  }

  async updateLc(id: string, dto: Partial<CreateLcDto>, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid LC ID');
    const lc = await LetterOfCredit.findById(id);
    if (!lc) throw new AppError(404, 'LC_NOT_FOUND', 'Letter of credit not found');
    if (lc.status === 'RETIRED' || lc.status === 'CANCELLED') {
      throw new AppError(409, 'LC_LOCKED', `A ${lc.status.toLowerCase()} LC can no longer be edited`);
    }

    if (dto.issuingBank !== undefined) lc.issuingBank = dto.issuingBank.trim();
    if (dto.bankBranch !== undefined) lc.bankBranch = dto.bankBranch;
    if (dto.bankRefNo !== undefined) lc.bankRefNo = dto.bankRefNo;
    if (dto.currency !== undefined) lc.currency = dto.currency.toUpperCase();
    if (dto.lcType !== undefined) lc.lcType = dto.lcType;
    if (dto.beneficiarySupplierId !== undefined) {
      lc.beneficiarySupplierId = dto.beneficiarySupplierId ? new Types.ObjectId(dto.beneficiarySupplierId) : null;
    }
    if (dto.buyerCustomerId !== undefined) {
      lc.buyerCustomerId = dto.buyerCustomerId ? new Types.ObjectId(dto.buyerCustomerId) : null;
    }
    if (dto.exchangeRate !== undefined) lc.exchangeRate = dto.exchangeRate;
    if (dto.lcAmount !== undefined) lc.lcAmount = dto.lcAmount;
    if (dto.issueDate !== undefined) lc.issueDate = new Date(dto.issueDate);
    if (dto.expiryDate !== undefined) lc.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    if (dto.latestShipmentDate !== undefined) {
      lc.latestShipmentDate = dto.latestShipmentDate ? new Date(dto.latestShipmentDate) : null;
    }
    if (dto.incoterms !== undefined) lc.incoterms = dto.incoterms;
    if (dto.portOfLoading !== undefined) lc.portOfLoading = dto.portOfLoading;
    if (dto.portOfDischarge !== undefined) lc.portOfDischarge = dto.portOfDischarge;
    if (dto.marginPercent !== undefined) lc.marginPercent = dto.marginPercent;
    if (dto.notes !== undefined) lc.notes = dto.notes;
    if (dto.charges) {
      lc.charges = dto.charges.map((c) => ({
        label: String(c.label || '').trim() || 'Charge',
        amount: Number(c.amount) || 0,
      }));
      lc.totalCharges = roundMoney(lc.charges.reduce((s, c) => s + c.amount, 0));
    }

    lc.lcAmountBdt = roundMoney(lc.lcAmount * lc.exchangeRate);
    await lc.save();
    return lc.toObject();
  }

  /** Move the LC along its lifecycle (DRAFT → OPENED → SHIPPED → RECEIVED → RETIRED). */
  async updateLcStatus(id: string, status: LcStatus, userId: string, note?: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid LC ID');
    if (!LC_STATUSES.includes(status)) throw new AppError(400, 'INVALID_STATUS', `Unknown LC status ${status}`);

    const lc = await LetterOfCredit.findById(id);
    if (!lc) throw new AppError(404, 'LC_NOT_FOUND', 'Letter of credit not found');
    if (lc.status === status) return lc.toObject();

    const allowed = LC_TRANSITIONS[lc.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `An LC in ${lc.status} cannot move to ${status} (allowed: ${allowed.join(', ') || 'none'})`
      );
    }

    // Opening an LC can be gated by an approval workflow (Module 7)
    if (status === 'OPENED' && lc.status === 'DRAFT') {
      const { approvalService } = await import('./ApprovalService');
      const request: any = await approvalService.submit(
        {
          entityType: 'LETTER_OF_CREDIT',
          entityId: String(lc._id),
          entityRef: lc.lcNumber,
          title: `Letter of credit ${lc.lcNumber} with ${lc.issuingBank}`,
          amount: lc.lcAmountBdt || lc.lcAmount,
          requestedBy: userId,
        },
        userId
      );
      // A workflow exists but nobody has approved it yet → stay in draft
      if (request && request.status !== 'APPROVED') {
        throw new AppError(
          409,
          'LC_PENDING_APPROVAL',
          `This LC is waiting for approval (level ${request.currentLevel} of ${request.levels?.length || 1}). Approve it from the approvals inbox.`
        );
      }
    }

    lc.status = status;
    lc.statusHistory.push({ status, at: new Date(), by: new Types.ObjectId(userId), note });
    await lc.save();

    notificationService.notify({
      type: 'SYSTEM',
      title: `LC ${status.toLowerCase()}`,
      message: `${lc.lcNumber} moved to ${status}${note ? ` — ${note}` : ''}`,
      entityType: 'import-export',
      entityId: String(lc._id),
    });

    return lc.toObject();
  }

  async addLcDocument(id: string, document: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid LC ID');
    if (!document?.trim()) throw new AppError(400, 'DOCUMENT_REQUIRED', 'Which document was received?');
    const lc = await LetterOfCredit.findById(id);
    if (!lc) throw new AppError(404, 'LC_NOT_FOUND', 'Letter of credit not found');
    if (!lc.documentsReceived.includes(document.trim())) lc.documentsReceived.push(document.trim());
    await lc.save();
    return lc.toObject();
  }

  async removeLc(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid LC ID');
    const lc = await LetterOfCredit.findById(id).lean();
    if (!lc) throw new AppError(404, 'LC_NOT_FOUND', 'Letter of credit not found');
    if (lc.status !== 'DRAFT') throw new AppError(409, 'LC_IN_USE', 'Only a draft LC can be deleted — cancel it instead');

    const [pis, cis] = await Promise.all([
      ProformaInvoice.countDocuments({ lcId: lc._id }),
      CommercialInvoice.countDocuments({ lcId: lc._id }),
    ]);
    if (pis + cis > 0) throw new AppError(409, 'LC_IN_USE', 'This LC already has invoices against it');

    await LetterOfCredit.deleteOne({ _id: lc._id });
    return { ok: true };
  }

  /* ───────────────────────────── Proforma invoices ──────────────────────── */

  async listPis(options: { status?: string; lcId?: string; limit?: number; page?: number } = {}) {
    const filter: Record<string, any> = {};
    if (options.status) filter.status = options.status;
    if (options.lcId && Types.ObjectId.isValid(options.lcId)) filter.lcId = new Types.ObjectId(options.lcId);

    const limit = Math.min(100, options.limit || 20);
    const page = Math.max(1, options.page || 1);
    const [data, total] = await Promise.all([
      ProformaInvoice.find(filter)
        .populate('supplierId', 'companyName contactPerson')
        .populate('lcId', 'lcNumber status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProformaInvoice.countDocuments(filter),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getPi(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid PI ID');
    const pi = await ProformaInvoice.findById(id)
      .populate('supplierId', 'companyName contactPerson phone email address')
      .populate('lcId', 'lcNumber status')
      .lean();
    if (!pi) throw new AppError(404, 'PI_NOT_FOUND', 'Proforma invoice not found');
    return pi;
  }

  async createPi(dto: CreatePiDto, userId: string) {
    if (!dto.supplierId || !Types.ObjectId.isValid(dto.supplierId)) {
      throw new AppError(400, 'INVALID_SUPPLIER_ID', 'A valid supplier is required');
    }
    if (!dto.items?.length) throw new AppError(400, 'NO_ITEMS', 'A proforma invoice needs at least one item');
    if (!(dto.exchangeRate > 0)) throw new AppError(400, 'INVALID_RATE', 'Exchange rate must be greater than zero');

    const items: IPiItem[] = dto.items.map((i) => ({
      description: i.description.trim(),
      hsnCode: i.hsnCode,
      quantity: i.quantity,
      unit: i.unit || 'Pcs',
      unitPrice: i.unitPrice,
      amount: roundMoney(i.quantity * i.unitPrice),
    }));
    const goodsValue = roundMoney(items.reduce((s, i) => s + i.amount, 0));
    const freightCost = dto.freightCost ?? 0;
    const insuranceCost = dto.insuranceCost ?? 0;
    const totalValue = roundMoney(goodsValue + freightCost + insuranceCost);

    const piNumber = await generatePiNumber();
    const pi = await ProformaInvoice.create({
      piNumber,
      supplierPiNo: dto.supplierPiNo,
      supplierId: dto.supplierId,
      lcId: dto.lcId || null,
      currency: (dto.currency || 'USD').toUpperCase(),
      exchangeRate: dto.exchangeRate,
      items,
      goodsValue,
      freightCost,
      insuranceCost,
      totalValue,
      totalValueBdt: roundMoney(totalValue * dto.exchangeRate),
      incoterms: dto.incoterms,
      portOfLoading: dto.portOfLoading,
      portOfDischarge: dto.portOfDischarge,
      expectedShipmentDate: dto.expectedShipmentDate ? new Date(dto.expectedShipmentDate) : null,
      status: 'DRAFT',
      notes: dto.notes,
      createdBy: new Types.ObjectId(userId),
    });

    return pi.toObject();
  }

  /** Approve a PI, or link it to an LC once the LC is opened. */
  async updatePiStatus(id: string, status: 'DRAFT' | 'APPROVED' | 'LC_OPENED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED', userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid PI ID');
    const pi = await ProformaInvoice.findById(id);
    if (!pi) throw new AppError(404, 'PI_NOT_FOUND', 'Proforma invoice not found');
    if (pi.status === 'CANCELLED') throw new AppError(409, 'PI_CANCELLED', 'This proforma invoice is cancelled');
    pi.status = status;
    await pi.save();
    return pi.toObject();
  }

  async linkPiToLc(piId: string, lcId: string, userId: string) {
    if (!Types.ObjectId.isValid(piId) || !Types.ObjectId.isValid(lcId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid PI or LC ID');
    }
    const [pi, lc] = await Promise.all([
      ProformaInvoice.findById(piId),
      LetterOfCredit.findById(lcId),
    ]);
    if (!pi) throw new AppError(404, 'PI_NOT_FOUND', 'Proforma invoice not found');
    if (!lc) throw new AppError(404, 'LC_NOT_FOUND', 'Letter of credit not found');

    pi.lcId = lc._id;
    pi.status = 'LC_OPENED';
    await pi.save();
    return pi.toObject();
  }

  /* ──────────────────────────── Commercial invoices ─────────────────────── */

  async listCis(options: { status?: string; lcId?: string; limit?: number; page?: number } = {}) {
    const filter: Record<string, any> = {};
    if (options.status) filter.status = options.status;
    if (options.lcId && Types.ObjectId.isValid(options.lcId)) filter.lcId = new Types.ObjectId(options.lcId);

    const limit = Math.min(100, options.limit || 20);
    const page = Math.max(1, options.page || 1);
    const [data, total] = await Promise.all([
      CommercialInvoice.find(filter)
        .populate('supplierId', 'companyName contactPerson')
        .populate('lcId', 'lcNumber status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommercialInvoice.countDocuments(filter),
    ]);

    return { data, total, page, initialPage: page, totalPages: Math.ceil(total / limit) };
  }

  async getCi(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid CI ID');
    const ci = await CommercialInvoice.findById(id)
      .populate('supplierId', 'companyName contactPerson phone email address')
      .populate('lcId', 'lcNumber status issuingBank currency exchangeRate charges totalCharges')
      .populate('piId', 'piNumber totalValue')
      .lean();
    if (!ci) throw new AppError(404, 'CI_NOT_FOUND', 'Commercial invoice not found');
    return ci;
  }

  async createCi(dto: CreateCiDto, userId: string) {
    if (!dto.supplierId || !Types.ObjectId.isValid(dto.supplierId)) {
      throw new AppError(400, 'INVALID_SUPPLIER_ID', 'A valid supplier is required');
    }
    if (!dto.items?.length) throw new AppError(400, 'NO_ITEMS', 'A commercial invoice needs at least one item');
    if (!(dto.exchangeRate > 0)) throw new AppError(400, 'INVALID_RATE', 'Exchange rate must be greater than zero');

    const lc: any = dto.lcId ? await LetterOfCredit.findById(dto.lcId).lean() : null;
    if (dto.lcId && !lc) throw new AppError(404, 'LC_NOT_FOUND', 'Letter of credit not found');

    const items: ICiItem[] = dto.items.map((i) => ({
      description: i.description.trim(),
      hsnCode: i.hsnCode,
      quantity: i.quantity,
      unit: i.unit || 'Pcs',
      unitPrice: i.unitPrice,
      amount: roundMoney(i.quantity * i.unitPrice),
      productId: i.productId && Types.ObjectId.isValid(i.productId) ? new Types.ObjectId(i.productId) : null,
      variantId: i.variantId && Types.ObjectId.isValid(i.variantId) ? new Types.ObjectId(i.variantId) : null,
    }));

    const goodsValue = roundMoney(items.reduce((s, i) => s + i.amount, 0));
    const goodsValueBdt = roundMoney(goodsValue * dto.exchangeRate);
    const lcChargesBdt = lc ? roundMoney(lc.totalCharges || 0) : 0;
    const freightCostBdt = dto.freightCostBdt ?? 0;
    const insuranceCostBdt = dto.insuranceCostBdt ?? 0;
    const dutyAmountBdt = dto.dutyAmountBdt ?? 0;
    const vatAmountBdt = dto.vatAmountBdt ?? 0;
    const otherChargesBdt = dto.otherChargesBdt ?? 0;
    const cnfChargesBdt = dto.cnfChargesBdt ?? 0;
    const landedCostBdt = roundMoney(
      goodsValueBdt + freightCostBdt + insuranceCostBdt + dutyAmountBdt + vatAmountBdt + otherChargesBdt + lcChargesBdt + cnfChargesBdt
    );

    const ciNumber = await generateCiNumber();
    const ci = await CommercialInvoice.create({
      ciNumber,
      supplierCiNo: dto.supplierCiNo,
      lcId: dto.lcId || null,
      piId: dto.piId || null,
      supplierId: dto.supplierId,
      invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
      currency: (dto.currency || lc?.currency || 'USD').toUpperCase(),
      exchangeRate: dto.exchangeRate,
      items,
      goodsValue,
      goodsValueBdt,
      freightCostBdt,
      insuranceCostBdt,
      dutyAmountBdt,
      vatAmountBdt,
      otherChargesBdt,
      lcChargesBdt,
      cnfChargesBdt,
      landedCostBdt,
      landedCostPerItem: items.length ? roundMoney(landedCostBdt / items.reduce((s, i) => s + i.quantity, 0)) : 0,
      shipping: {
        blNumber: dto.shipping?.blNumber,
        blDate: dto.shipping?.blDate ? new Date(dto.shipping.blDate) : null,
        vesselName: dto.shipping?.vesselName,
        containerNo: dto.shipping?.containerNo,
        portOfLoading: dto.shipping?.portOfLoading || lc?.portOfLoading,
        portOfDischarge: dto.shipping?.portOfDischarge || lc?.portOfDischarge,
        arrivalDate: dto.shipping?.arrivalDate ? new Date(dto.shipping.arrivalDate) : null,
      },
      allocationBasis: dto.allocationBasis || 'VALUE',
      status: 'DRAFT',
      notes: dto.notes,
      createdBy: new Types.ObjectId(userId),
    });

    return ci.toObject();
  }

  async updateCiStatus(id: string, status: string, userId: string, note?: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid CI ID');
    const ci = await CommercialInvoice.findById(id);
    if (!ci) throw new AppError(404, 'CI_NOT_FOUND', 'Commercial invoice not found');
    const allowed = CI_TRANSITIONS[ci.status] || [];
    if (ci.status !== status && !allowed.includes(status)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `A ${ci.status} invoice cannot move to ${status} (allowed: ${allowed.join(', ') || 'none'})`
      );
    }
    (ci as any).status = status;
    await ci.save();
    return ci.toObject();
  }

  /**
   * The money shot: distribute every import cost across the shipment items,
   * then write the landed unit cost onto each product variant (weighted
   * average with the stock already on hand) and optionally bring the stock in.
   */
  async clearCommercialInvoice(
    id: string,
    options: { postStock?: boolean; agentId?: string; allocationBasis?: 'VALUE' | 'QUANTITY' },
    userId: string
  ) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid CI ID');
    const ci = await CommercialInvoice.findById(id);
    if (!ci) throw new AppError(404, 'CI_NOT_FOUND', 'Commercial invoice not found');
    if (ci.status === 'CANCELLED') throw new AppError(409, 'CI_CANCELLED', 'This invoice is cancelled');
    if (ci.costApplied) {
      throw new AppError(409, 'COST_ALREADY_APPLIED', 'The landed cost of this invoice has already been applied');
    }

    const basis = options.allocationBasis || ci.allocationBasis;
    const postStock = options.postStock !== false;

    const totalQty = ci.items.reduce((s, i) => s + i.quantity, 0);
    const goodsValue = ci.goodsValue || 0;
    if (goodsValue <= 0 && totalQty <= 0) {
      throw new AppError(400, 'EMPTY_INVOICE', 'This invoice has no items to apportion');
    }

    // Costs that ride along with the goods
    const freightPool = roundMoney(ci.freightCostBdt + ci.insuranceCostBdt);
    const dutyPool = roundMoney(ci.dutyAmountBdt + ci.vatAmountBdt);
    const otherPool = roundMoney(ci.otherChargesBdt + ci.lcChargesBdt + ci.cnfChargesBdt);

    const session = await mongoose.startSession();
    const appliedCosts: Array<{ description: string; variantId?: string | null; unitCost: number; quantity: number }> = [];

    try {
      await session.withTransaction(async () => {
        for (const item of ci.items) {
          const weight = basis === 'QUANTITY'
            ? (totalQty > 0 ? item.quantity / totalQty : 0)
            : (goodsValue > 0 ? item.amount / goodsValue : 0);

          const goodsCostBdt = roundMoney(item.amount * ci.exchangeRate);
          const allocatedFreight = roundMoney(freightPool * weight);
          const allocatedDuty = roundMoney(dutyPool * weight);
          const allocatedOther = roundMoney(otherPool * weight);
          const itemLanded = roundMoney(goodsCostBdt + allocatedFreight + allocatedDuty + allocatedOther);
          const landedUnitCost = roundMoney(itemLanded / item.quantity);

          item.goodsCostBdt = goodsCostBdt;
          item.allocatedFreight = allocatedFreight;
          item.allocatedDuty = allocatedDuty;
          item.allocatedOther = allocatedOther;
          item.landedUnitCost = landedUnitCost;

          appliedCosts.push({
            description: item.description,
            variantId: item.variantId ? String(item.variantId) : null,
            unitCost: landedUnitCost,
            quantity: item.quantity,
          });

          // No product link → nothing to update, the allocation is still recorded
          if (!item.productId || !item.variantId) continue;

          const product: any = await Product.findById(item.productId).session(session);
          if (!product) continue;
          const variant: any = product.variants.id(item.variantId);
          if (!variant) continue;

          if (postStock) {
            const stockBefore = Number(variant.currentStock || 0);
            const existingValue = stockBefore * Number(variant.costPrice || 0);
            const incomingValue = item.quantity * landedUnitCost;
            const stockAfter = roundMoney(stockBefore + item.quantity);
            variant.currentStock = stockAfter;
            variant.costPrice = stockAfter > 0 ? parseFloat(((existingValue + incomingValue) / stockAfter).toFixed(4)) : landedUnitCost;

            await StockMovement.create(
              [
                {
                  productId: item.productId,
                  variantId: item.variantId,
                  type: 'IN',
                  quantity: item.quantity,
                  stockBefore,
                  stockAfter,
                  unitCost: landedUnitCost,
                  referenceType: 'IMPORT',
                  referenceId: ci._id,
                  reason: `Import ${ci.ciNumber} cleared — landed cost applied`,
                  userId: new Types.ObjectId(userId),
                },
              ],
              { session }
            );
          } else {
            // Cost only: replace the acquisition cost with the true landed cost
            variant.costPrice = landedUnitCost;
          }

          await product.save({ session });
        }

        ci.landedCostBdt = roundMoney(
          ci.goodsValueBdt + freightPool + dutyPool + otherPool
        );
        ci.landedCostPerItem = totalQty > 0 ? roundMoney(ci.landedCostBdt / totalQty) : 0;
        ci.costApplied = true;
        ci.costAppliedAt = new Date();
        ci.costAppliedBy = new Types.ObjectId(userId);
        ci.stockPosted = postStock;
        ci.status = 'CLEARED';
        await ci.save({ session });
      });
    } finally {
      await session.endSession();
    }

    // C&F agent charge (outside the stock transaction — the ledger has its own balance maths)
    if (ci.cnfChargesBdt > 0 && options.agentId) {
      await this.recordAgentTransaction(
        options.agentId,
        {
          entryType: 'CHARGE',
          amount: ci.cnfChargesBdt,
          narration: `C&F charges for ${ci.ciNumber}`,
          referenceType: 'COMMERCIAL_INVOICE',
          referenceId: String(ci._id),
        },
        userId
      );
    }

    notificationService.notify({
      type: 'SYSTEM',
      title: 'Import cleared — landed cost applied',
      message: `${ci.ciNumber}: landed cost ৳${ci.landedCostBdt.toFixed(2)} across ${ci.items.length} item(s)${postStock ? ' + stock received' : ' (cost only)'}`,
      entityType: 'import-export',
      entityId: String(ci._id),
    });

    const refreshed = await CommercialInvoice.findById(ci._id).lean();
    return {
      commercialInvoice: refreshed,
      appliedCosts,
      landedCost: {
        goodsValueBdt: ci.goodsValueBdt,
        freightAndInsurance: freightPool,
        dutyAndVat: dutyPool,
        otherAndLcAndCnf: otherPool,
        totalLandedCost: ci.landedCostBdt,
        perUnitAverage: ci.landedCostPerItem,
      },
      stockPosted: postStock,
    };
  }

  /* ─────────────────────────── Landed cost analysis ─────────────────────── */

  /** Margin check: landed cost versus the current selling price. */
  async getLandedCostAnalysis(ciId?: string) {
    const filter: Record<string, any> = { costApplied: true };
    if (ciId && Types.ObjectId.isValid(ciId)) filter._id = new Types.ObjectId(ciId);

    const invoices = await CommercialInvoice.find(filter)
      .populate('supplierId', 'companyName')
      .sort({ costAppliedAt: -1 })
      .limit(ciId ? 1 : 50)
      .lean();

    const rows: any[] = [];
    for (const ci of invoices) {
      const productIds = (ci.items || [])
        .map((i) => i.productId)
        .filter((p) => !!p) as Types.ObjectId[];
      const products: any[] = productIds.length
        ? await Product.find({ _id: { $in: productIds } }).select('name unit variants').lean()
        : [];
      const productById = new Map(products.map((p: any) => [String(p._id), p]));

      for (const item of ci.items || []) {
        const product: any = item.productId ? productById.get(String(item.productId)) : null;
        const variant: any = product
          ? (product.variants || []).find((v: any) => String(v._id) === String(item.variantId))
          : null;
        const sellingPrice = variant?.retailSellingPrice || 0;
        const landed = item.landedUnitCost || 0;
        // The stored allocations are LINE totals — per-unit values are derived
        const goodsLine = item.goodsCostBdt || 0;
        const freightLine = item.allocatedFreight || 0;
        const dutyLine = item.allocatedDuty || 0;
        const otherLine = item.allocatedOther || 0;
        const landedLine = roundMoney(landed * item.quantity);
        rows.push({
          commercialInvoiceId: String(ci._id),
          ciNumber: ci.ciNumber,
          supplierName: (ci.supplierId as any)?.companyName || '—',
          invoiceDate: ci.invoiceDate,
          clearedAt: ci.costAppliedAt,
          productName: product?.name || item.description,
          variantName: variant?.attributeName || '',
          sku: variant?.sku || '',
          unit: product?.unit || item.unit,
          quantity: item.quantity,
          // line totals (what the invoice actually cost)
          goodsCostBdt: goodsLine,
          allocatedFreight: freightLine,
          allocatedDuty: dutyLine,
          allocatedOther: otherLine,
          landedTotal: landedLine,
          // per-unit view
          landedUnitCost: landed,
          goodsUnitCost: item.quantity > 0 ? roundMoney(goodsLine / item.quantity) : 0,
          freightUnitCost: item.quantity > 0 ? roundMoney(freightLine / item.quantity) : 0,
          dutyUnitCost: item.quantity > 0 ? roundMoney(dutyLine / item.quantity) : 0,
          currentCostPrice: variant?.costPrice ?? null,
          sellingPrice,
          marginPerUnit: roundMoney(sellingPrice - landed),
          marginPercent: sellingPrice > 0 ? Math.round(((sellingPrice - landed) / sellingPrice) * 1000) / 10 : null,
        });
      }
    }

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    return {
      summary: {
        invoices: invoices.length,
        items: rows.length,
        totalLandedCost: round(rows.reduce((s, r) => s + r.landedTotal, 0)),
        totalGoodsCost: round(rows.reduce((s, r) => s + r.goodsCostBdt, 0)),
        totalFreight: round(rows.reduce((s, r) => s + r.allocatedFreight, 0)),
        totalDuty: round(rows.reduce((s, r) => s + r.allocatedDuty, 0)),
        totalOther: round(rows.reduce((s, r) => s + r.allocatedOther, 0)),
        averageMarginPercent: rows.length
          ? Math.round((rows.filter((r) => r.marginPercent !== null).reduce((s, r) => s + (r.marginPercent || 0), 0) / rows.length) * 10) / 10
          : 0,
      },
      data: rows,
    };
  }

  /** LC status board: exposure, deadlines and where each LC stands. */
  async getLcStatusReport() {
    const lcs = await LetterOfCredit.find({})
      .populate('beneficiarySupplierId', 'companyName')
      .sort({ issueDate: -1 })
      .lean();

    const now = Date.now();
    const byStatus: Record<string, { count: number; amountBdt: number }> = {};
    for (const status of LC_STATUSES) byStatus[status] = { count: 0, amountBdt: 0 };

    const rows = lcs.map((lc: any) => {
      const outstandingBdt = lc.status === 'RETIRED' ? 0 : lc.lcAmountBdt;
      byStatus[lc.status].count += 1;
      byStatus[lc.status].amountBdt = roundMoney(byStatus[lc.status].amountBdt + lc.lcAmountBdt);

      const shipmentDays = lc.latestShipmentDate
        ? Math.ceil((new Date(lc.latestShipmentDate).getTime() - now) / 86400000)
        : null;
      const expiryDays = lc.expiryDate ? Math.ceil((new Date(lc.expiryDate).getTime() - now) / 86400000) : null;

      let alert: string | null = null;
      if (lc.status === 'DRAFT') alert = 'NOT_OPENED';
      else if (lc.status !== 'RETIRED' && lc.status !== 'CANCELLED') {
        if (expiryDays !== null && expiryDays <= 15) alert = 'EXPIRING_SOON';
        if (shipmentDays !== null && shipmentDays <= 0) alert = 'SHIPMENT_DEADLINE_PASSED';
      }

      return {
        id: String(lc._id),
        lcNumber: lc.lcNumber,
        lcType: lc.lcType,
        status: lc.status,
        beneficiary: lc.beneficiarySupplierId?.companyName || '—',
        issuingBank: lc.issuingBank,
        currency: lc.currency,
        lcAmount: lc.lcAmount,
        lcAmountBdt: lc.lcAmountBdt,
        totalChargesBdt: lc.totalCharges || 0,
        outstandingBdt,
        issueDate: lc.issueDate,
        latestShipmentDate: lc.latestShipmentDate,
        expiryDate: lc.expiryDate,
        shipmentDaysLeft: shipmentDays,
        expiryDaysLeft: expiryDays,
        documentsReceived: (lc.documentsReceived || []).length,
        alert,
      };
    });

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    return {
      summary: {
        totalLcs: rows.length,
        openLcs: rows.filter((r) => !['RETIRED', 'CANCELLED'].includes(r.status)).length,
        totalExposureBdt: round(rows.reduce((s, r) => s + r.outstandingBdt, 0)),
        totalChargesBdt: round(rows.reduce((s, r) => s + r.totalChargesBdt, 0)),
        expiringSoon: rows.filter((r) => r.alert === 'EXPIRING_SOON').length,
        shipmentDeadlinePassed: rows.filter((r) => r.alert === 'SHIPMENT_DEADLINE_PASSED').length,
        notOpened: rows.filter((r) => r.alert === 'NOT_OPENED').length,
        byStatus: Object.entries(byStatus).map(([status, v]) => ({ status, ...v })),
      },
      data: rows,
    };
  }

  /* ────────────────────────── C&F / freight agents ──────────────────────── */

  async listAgents(options: { includeInactive?: boolean } = {}) {
    const filter: Record<string, any> = {};
    if (!options.includeInactive) filter.isActive = true;
    return CnfAgent.find(filter).sort({ name: 1 }).lean();
  }

  async createAgent(
    dto: {
      name: string;
      agentType?: 'FREIGHT_FORWARDER' | 'CNF_AGENT' | 'BOTH';
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
      licenseNo?: string;
      openingPayable?: number;
    },
    userId: string
  ) {
    if (!dto.name?.trim()) throw new AppError(400, 'NAME_REQUIRED', 'Agent name is required');
    const agent = await CnfAgent.create({
      name: dto.name.trim(),
      agentType: dto.agentType || 'CNF_AGENT',
      contactPerson: dto.contactPerson,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      licenseNo: dto.licenseNo,
      currentPayable: dto.openingPayable || 0,
    });
    return agent.toObject();
  }

  async updateAgent(id: string, dto: any) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid agent ID');
    const agent = await CnfAgent.findById(id);
    if (!agent) throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    for (const key of ['name', 'agentType', 'contactPerson', 'phone', 'email', 'address', 'licenseNo']) {
      if (dto[key] !== undefined) (agent as any)[key] = dto[key];
    }
    if (dto.isActive !== undefined) agent.isActive = !!dto.isActive;
    await agent.save();
    return agent.toObject();
  }

  /** CHARGE raises the payable, PAYMENT settles it. */
  async recordAgentTransaction(
    agentId: string,
    dto: {
      entryType: 'CHARGE' | 'PAYMENT';
      amount: number;
      narration?: string;
      referenceType?: 'COMMERCIAL_INVOICE' | 'MANUAL';
      referenceId?: string;
      entryDate?: string;
    },
    userId: string
  ) {
    if (!Types.ObjectId.isValid(agentId)) throw new AppError(400, 'INVALID_ID', 'Invalid agent ID');
    if (!(dto.amount > 0)) throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero');

    const agent = await CnfAgent.findById(agentId);
    if (!agent) throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');

    const balanceBefore = roundMoney(agent.currentPayable || 0);
    const delta = dto.entryType === 'CHARGE' ? dto.amount : -dto.amount;
    const balanceAfter = roundMoney(balanceBefore + delta);

    if (balanceAfter < 0 && dto.entryType === 'PAYMENT') {
      throw new AppError(
        400,
        'OVERPAYMENT',
        `A payment of ৳${dto.amount} exceeds the outstanding ৳${balanceBefore}`
      );
    }

    const entry = await CnfAgentLedger.create({
      agentId: agent._id,
      entryType: dto.entryType,
      amount: roundMoney(dto.amount),
      balanceBefore,
      balanceAfter,
      referenceType: dto.referenceType || 'MANUAL',
      referenceId: dto.referenceId && Types.ObjectId.isValid(dto.referenceId) ? new Types.ObjectId(dto.referenceId) : null,
      narration: dto.narration?.trim() || (dto.entryType === 'CHARGE' ? 'C&F charge' : 'Payment to agent'),
      entryDate: dto.entryDate ? new Date(dto.entryDate) : new Date(),
      recordedById: new Types.ObjectId(userId),
    });

    agent.currentPayable = balanceAfter;
    await agent.save();

    return entry.toObject();
  }

  async getAgentLedger(agentId: string) {
    if (!Types.ObjectId.isValid(agentId)) throw new AppError(400, 'INVALID_ID', 'Invalid agent ID');
    const agent = await CnfAgent.findById(agentId).lean();
    if (!agent) throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');

    const entries = await CnfAgentLedger.find({ agentId })
      .populate('recordedById', 'fullName username')
      .sort({ entryDate: 1, createdAt: 1 })
      .lean();

    const totalCharged = roundMoney(
      entries.filter((e: any) => e.entryType === 'CHARGE').reduce((s: number, e: any) => s + e.amount, 0)
    );
    const totalPaid = roundMoney(
      entries.filter((e: any) => e.entryType === 'PAYMENT').reduce((s: number, e: any) => s + e.amount, 0)
    );

    return {
      agent,
      summary: { totalCharged, totalPaid, outstanding: roundMoney(agent.currentPayable || 0), entries: entries.length },
      data: entries,
    };
  }

  /** Payables across all agents — the C&F side of the payables report. */
  async getAgentPayables() {
    const agents = await CnfAgent.find({}).sort({ currentPayable: -1 }).lean();
    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const data = agents.map((a: any) => ({
      id: String(a._id),
      name: a.name,
      agentType: a.agentType,
      phone: a.phone,
      payable: round(a.currentPayable || 0),
      isActive: a.isActive,
    }));
    return {
      summary: {
        agents: data.length,
        totalPayable: round(data.reduce((s, a) => s + a.payable, 0)),
        agentsWithDues: data.filter((a) => a.payable > 0).length,
      },
      data,
    };
  }
}

export const importExportService = new ImportExportService();
