import { Types } from 'mongoose';
import { Zone, IZone } from '../models/Zone';
import { Route, IRoute } from '../models/Route';
import { SalesRep, ISalesRep } from '../models/SalesRep';
import { SrOrder, ISrOrder, ISrOrderItem } from '../models/SrOrder';
import { Customer } from '../models/Customer';
import { Product } from '../models/Product';
import { Sale } from '../models/Sale';
import { AppError } from '../utils/app-error';
import { generateSrOrderNo } from './SequenceService';
import { saleService } from './SaleService';
import {
  CreateZoneInput,
  UpdateZoneInput,
  CreateRouteInput,
  UpdateRouteInput,
  CreateSalesRepInput,
  UpdateSalesRepInput,
  CreateSrOrderInput,
} from '../validators/distribution.validators';

function oid(id: string | null | undefined): Types.ObjectId | null {
  return id && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}

export class DistributionService {
  // ── zones (the territory level: zones group routes, routes group shops) ──
  async listZones(): Promise<Array<any>> {
    const zones = await Zone.find().sort({ name: 1 }).lean() as any[];
    const counts = await Route.aggregate([
      { $group: { _id: '$zoneId', routeCount: { $sum: 1 } } },
    ]);
    const shops = await Customer.aggregate([
      { $match: { routeId: { $ne: null } } },
      { $group: { _id: '$routeId', customerCount: { $sum: 1 } } },
    ]);
    const routeZone = await Route.find().select('_id zoneId').lean();
    const zoneOfRoute = new Map(routeZone.map((r: any) => [String(r._id), String(r.zoneId)]));
    const shopsByZone = new Map<string, number>();
    for (const row of shops as any[]) {
      const zone = zoneOfRoute.get(String(row._id));
      if (zone) shopsByZone.set(zone, (shopsByZone.get(zone) || 0) + row.customerCount);
    }
    const routeCountBy = new Map(counts.map((c: any) => [String(c._id), c.routeCount]));
    return zones.map((z: any) => ({
      ...z,
      routeCount: routeCountBy.get(String(z._id)) || 0,
      customerCount: shopsByZone.get(String(z._id)) || 0,
    }));
  }

  async createZone(data: CreateZoneInput): Promise<IZone> {
    const clash = await Zone.findOne({ code: data.code.toUpperCase() }).lean();
    if (clash) throw new AppError(409, 'ZONE_EXISTS', `Zone code "${data.code}" already exists`);
    const zone = await Zone.create({
      name: data.name,
      code: data.code.toUpperCase(),
      description: data.description,
      isActive: data.isActive ?? true,
    });
    return zone.toObject() as unknown as IZone;
  }

  async updateZone(id: string, data: UpdateZoneInput): Promise<IZone> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid zone ID');
    const zone = await Zone.findById(id);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'Zone not found');
    if (data.name !== undefined) zone.name = data.name;
    if (data.description !== undefined) zone.description = data.description;
    if (data.isActive !== undefined) zone.isActive = data.isActive;
    await zone.save();
    return zone.toObject() as unknown as IZone;
  }

  /**
   * Archives a territory. Zones are referenced by routes (and routes by shops),
   * so a hard delete would orphan live data — deactivating is the safe move and
   * keeps historical reports intact.
   */
  async archiveZone(id: string): Promise<{ archived: true; routeCount: number }> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid zone ID');
    const zone = await Zone.findById(id);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND', 'Zone not found');
    zone.isActive = false;
    await zone.save();
    const routeCount = await Route.countDocuments({ zoneId: zone._id });
    return { archived: true, routeCount };
  }

  // ── routes ───────────────────────────────────────────────────────────────
  async listRoutes(): Promise<Array<any>> {
    const routes = await Route.find()
      .populate('zoneId', 'name code')
      .populate('assignedSRId', 'name code')
      .sort({ name: 1 })
      .lean();
    const counts = await Customer.aggregate([
      { $match: { routeId: { $ne: null } } },
      { $group: { _id: '$routeId', customerCount: { $sum: 1 }, dueTotal: { $sum: '$currentDueBalance' } } },
    ]);
    const byRoute = new Map(counts.map((c: any) => [String(c._id), c]));
    return routes.map((r: any) => ({
      ...r,
      customerCount: byRoute.get(String(r._id))?.customerCount || 0,
      dueTotal: byRoute.get(String(r._id))?.dueTotal || 0,
    }));
  }

  async createRoute(data: CreateRouteInput): Promise<any> {
    if (!Types.ObjectId.isValid(data.zoneId)) throw new AppError(400, 'INVALID_ID', 'Invalid zone ID');
    const clash = await Route.findOne({ code: data.code.toUpperCase() }).lean();
    if (clash) throw new AppError(409, 'ROUTE_EXISTS', `Route code "${data.code}" already exists`);
    const route = await Route.create({
      zoneId: new Types.ObjectId(data.zoneId),
      name: data.name,
      code: data.code.toUpperCase(),
      areas: data.areas,
      daysOfWeek: data.daysOfWeek || [],
      assignedSRId: oid(data.assignedSRId),
      isActive: data.isActive ?? true,
    });
    return route.toObject();
  }

  async updateRoute(id: string, data: UpdateRouteInput): Promise<any> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid route ID');
    const route = await Route.findById(id);
    if (!route) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
    if (data.zoneId !== undefined && Types.ObjectId.isValid(data.zoneId)) route.zoneId = new Types.ObjectId(data.zoneId);
    if (data.name !== undefined) route.name = data.name;
    if (data.areas !== undefined) route.areas = data.areas;
    if (data.daysOfWeek !== undefined) route.daysOfWeek = data.daysOfWeek;
    if (data.assignedSRId !== undefined) route.assignedSRId = oid(data.assignedSRId);
    if (data.isActive !== undefined) route.isActive = data.isActive;
    await route.save();
    return route.toObject();
  }

  /** Archives a route — the shops on it stay put, they just stop being visited. */
  async archiveRoute(id: string): Promise<{ archived: true; customerCount: number }> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid route ID');
    const route = await Route.findById(id);
    if (!route) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
    route.isActive = false;
    await route.save();
    const customerCount = await Customer.countDocuments({ routeId: route._id });
    return { archived: true, customerCount };
  }

  /** The shops on a route — the SR's call list for the day. */
  async getRouteCustomers(routeId: string): Promise<Array<any>> {
    if (!Types.ObjectId.isValid(routeId)) throw new AppError(400, 'INVALID_ID', 'Invalid route ID');
    const route = await Route.findById(routeId).populate('zoneId', 'name code').lean();
    if (!route) throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
    const customers = await Customer.find({ routeId: new Types.ObjectId(routeId) })
      .populate('assignedSRId', 'name code')
      .populate('priceTierId', 'name discountPercent')
      .sort({ name: 1 })
      .lean();
    return customers;
  }

  // ── sales reps ───────────────────────────────────────────────────────────
  async listSalesReps(): Promise<Array<any>> {
    const reps = await SalesRep.find()
      .populate('zoneId', 'name code')
      .sort({ code: 1 })
      .lean();
    // Attach this month's achievement per rep
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const totals = await Sale.aggregate([
      { $match: { salesRepId: { $ne: null }, createdAt: { $gte: monthStart } } },
      { $group: { _id: '$salesRepId', total: { $sum: '$totalAmount' } } },
    ]);
    const totalByRep = new Map(totals.map((t: any) => [String(t._id), t.total]));
    return reps.map((r: any) => ({
      ...r,
      monthSalesTotal: totalByRep.get(String(r._id)) || 0,
    }));
  }

  async createSalesRep(data: CreateSalesRepInput): Promise<ISalesRep> {
    const clash = await SalesRep.findOne({ code: data.code.toUpperCase() }).lean();
    if (clash) throw new AppError(409, 'SR_EXISTS', `SR code "${data.code}" already exists`);
    const rep = await SalesRep.create({
      code: data.code.toUpperCase(),
      name: data.name,
      phone: data.phone,
      userId: oid(data.userId),
      zoneId: oid(data.zoneId),
      commissionPercent: data.commissionPercent,
      monthlyTargetAmount: data.monthlyTargetAmount,
      address: data.address,
      isActive: data.isActive ?? true,
    });
    return rep.toObject() as unknown as ISalesRep;
  }

  async updateSalesRep(id: string, data: UpdateSalesRepInput): Promise<ISalesRep> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid SR ID');
    const rep = await SalesRep.findById(id);
    if (!rep) throw new AppError(404, 'SR_NOT_FOUND', 'Sales rep not found');
    if (data.code !== undefined) rep.code = data.code.toUpperCase();
    if (data.name !== undefined) rep.name = data.name;
    if (data.phone !== undefined) rep.phone = data.phone;
    if (data.userId !== undefined) rep.userId = oid(data.userId);
    if (data.zoneId !== undefined) rep.zoneId = oid(data.zoneId);
    if (data.commissionPercent !== undefined) rep.commissionPercent = data.commissionPercent;
    if (data.monthlyTargetAmount !== undefined) rep.monthlyTargetAmount = data.monthlyTargetAmount;
    if (data.address !== undefined) rep.address = data.address;
    if (data.isActive !== undefined) rep.isActive = data.isActive;
    await rep.save();
    return rep.toObject() as unknown as ISalesRep;
  }

  // ── dealers (customers with customerType=DEALER) ─────────────────────────
  async listDealers(): Promise<Array<any>> {
    return Customer.find({ customerType: 'DEALER' })
      .populate('priceTierId', 'name discountPercent')
      .populate('routeId', 'name code')
      .populate('assignedSRId', 'name code')
      .sort({ name: 1 })
      .lean();
  }

  // ── SR orders ────────────────────────────────────────────────────────────
  async listSrOrders(status?: string): Promise<Array<any>> {
    const filter: Record<string, any> = {};
    if (status && ['PENDING', 'CONFIRMED', 'CONVERTED', 'CANCELLED'].includes(status)) {
      filter.status = status;
    }
    return SrOrder.find(filter)
      .populate('repId', 'name code')
      .populate('customerId', 'name phone')
      .populate('saleId', 'invoiceNo')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
  }

  /** SR (or admin on behalf) collects an order in the field. */
  async createSrOrder(data: CreateSrOrderInput, actorId: string, canManage = false): Promise<ISrOrder> {
    if (!Types.ObjectId.isValid(data.repId) || !Types.ObjectId.isValid(data.customerId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid rep or customer');
    }

    const [rep, customer] = await Promise.all([
      SalesRep.findById(data.repId).lean(),
      Customer.findById(data.customerId).lean(),
    ]);
    if (!rep) throw new AppError(404, 'SR_NOT_FOUND', 'Sales rep not found');
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');

    // A logged-in SR may only place orders for themselves; managers can for any
    const repDoc: any = rep;
    if (repDoc.userId && String(repDoc.userId) !== actorId && !canManage) {
      throw new AppError(403, 'PERMISSION_DENIED', 'You can only place orders for your own SR account');
    }

    const items: ISrOrderItem[] = [];
    let total = 0;
    for (const item of data.items) {
      if (!Types.ObjectId.isValid(item.variantId)) {
        throw new AppError(400, 'INVALID_ID', `Invalid variant ID: ${item.variantId}`);
      }
      const product: any = await Product.findOne({ 'variants._id': new Types.ObjectId(item.variantId) }).lean();
      if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product not found for variant ${item.variantId}`);
      const variant: any = product.variants.find((v: any) => String(v._id) === item.variantId);
      if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', `Variant not found: ${item.variantId}`);

      // Price: explicit unit price (from the field app) else the customer's tier price else retail
      let unitPrice = item.unitPrice;
      if (unitPrice === undefined) {
        let discountPercent = 0;
        if ((customer as any).priceTierId) {
          const { PriceTier } = await import('../models/PriceTier');
          const tier: any = await PriceTier.findById((customer as any).priceTierId).lean();
          if (tier?.isActive) discountPercent = tier.discountPercent || 0;
        }
        unitPrice = Math.round(variant.retailSellingPrice * (1 - discountPercent / 100) * 100) / 100;
      }

      items.push({
        productId: product._id,
        variantId: variant._id,
        productName: product.name,
        variantName: variant.attributeName,
        sku: variant.sku,
        quantity: item.quantity,
        unitPrice,
      });
      total = Math.round((total + item.quantity * unitPrice) * 100) / 100;
    }

    const orderNo = await generateSrOrderNo();
    const order = await SrOrder.create({
      orderNo,
      repId: rep._id,
      customerId: customer._id,
      items,
      totalAmount: total,
      status: 'PENDING',
      notes: data.notes,
    });
    return order.toObject() as unknown as ISrOrder;
  }

  /** Confirm (or cancel) a pending order. Confirmed orders stay until converted. */
  async actionSrOrder(id: string, action: 'CONFIRM' | 'CANCEL', actorId: string): Promise<ISrOrder> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid order ID');
    const order = await SrOrder.findById(id);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'SR order not found');
    if (order.status !== 'PENDING') {
      throw new AppError(409, 'ORDER_NOT_PENDING', `Order is already ${order.status}`);
    }

    if (action === 'CANCEL') {
      order.status = 'CANCELLED';
    } else {
      order.status = 'CONFIRMED';
      order.confirmedById = new Types.ObjectId(actorId);
    }
    await order.save();
    return order.toObject() as unknown as ISrOrder;
  }

  /**
   * Converts a confirmed SR order into a real Sale (full CUSTOMER_DUE — the
   * dealer pays through the due book). Attributed to the SR.
   */
  async convertSrOrder(id: string, actorId: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid order ID');
    const order: any = await SrOrder.findById(id).lean();
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'SR order not found');
    if (order.status !== 'CONFIRMED') {
      throw new AppError(409, 'ORDER_NOT_CONFIRMED', 'Only confirmed orders can be converted to a sale');
    }

    const sale = await saleService.checkout(
      {
        customerId: String(order.customerId),
        pricingTier: 'RETAIL', // line prices below are already tier-adjusted by the SR
        salesRepId: String(order.repId),
        items: order.items.map((i: any) => ({
          variantId: String(i.variantId),
          quantity: i.quantity,
          unitSellingPrice: i.unitPrice,
          discount: 0,
        })),
        payments: [
          {
            method: 'CUSTOMER_DUE',
            amount: order.totalAmount,
          },
        ],
        idempotencyKey: `SR-ORDER-${order._id}`,
      },
      actorId
    );

    await SrOrder.updateOne({ _id: order._id }, { $set: { status: 'CONVERTED', saleId: sale._id } });
    return sale;
  }

  /** SR performance: target vs achievement + commission for a month. */
  async srReport(monthsBack = 3): Promise<Array<any>> {
    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const reps = await SalesRep.find().lean();
    const sales = await Sale.aggregate([
      { $match: { salesRepId: { $ne: null }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { rep: '$salesRepId', month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    return reps.map((r: any) => {
      const rows = sales.filter((s: any) => String(s._id.rep) === String(r._id));
      return {
        rep: { id: String(r._id), code: r.code, name: r.name, commissionPercent: r.commissionPercent, monthlyTargetAmount: r.monthlyTargetAmount, isActive: r.isActive },
        months: rows.map((row: any) => ({
          month: row._id.month,
          total: row.total,
          count: row.count,
          commission: Math.round(((row.total * (r.commissionPercent || 0)) / 100) * 100) / 100,
          targetAchievedPercent: r.monthlyTargetAmount ? Math.round((row.total / r.monthlyTargetAmount) * 1000) / 10 : null,
        })),
      };
    });
  }
}

export const distributionService = new DistributionService();
