import { Types } from 'mongoose';
import { OnlineOrder } from '../models/OnlineOrder';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';
import { notificationService } from './NotificationService';
import { nextSequence } from './SequenceService';

export type CourierProvider = 'PATHAO' | 'REDX' | 'MANUAL';

/** Provider credentials are optional: without them the shipment is recorded as MANUAL. */
function credentials(provider: CourierProvider) {
  if (provider === 'PATHAO') {
    return {
      configured: Boolean(process.env.PATHAO_BASE_URL && process.env.PATHAO_CLIENT_ID && process.env.PATHAO_CLIENT_SECRET),
      baseUrl: process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com',
      clientId: process.env.PATHAO_CLIENT_ID,
      clientSecret: process.env.PATHAO_CLIENT_SECRET,
      storeId: process.env.PATHAO_STORE_ID,
    };
  }
  if (provider === 'REDX') {
    return {
      configured: Boolean(process.env.REDX_API_KEY),
      baseUrl: process.env.REDX_BASE_URL || 'https://openapi.redx.com.bd/v1.0.0-beta',
      apiKey: process.env.REDX_API_KEY,
    };
  }
  return { configured: true, baseUrl: '', };
}

/** Provider status wording → our normalised status. */
const STATUS_MAP: Record<string, string> = {
  pending: 'PENDING',
  picked: 'PICKED',
  pickup: 'PICKED',
  assigned: 'PICKED',
  'in transit': 'IN_TRANSIT',
  intransit: 'IN_TRANSIT',
  'in_transit': 'IN_TRANSIT',
  'out for delivery': 'IN_TRANSIT',
  delivered: 'DELIVERED',
  'delivery completed': 'DELIVERED',
  returned: 'RETURNED',
  return: 'RETURNED',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  failed: 'FAILED',
  'delivery failed': 'FAILED',
  hold: 'FAILED',
};

function normaliseStatus(raw?: string): string | null {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return STATUS_MAP[key] || null;
}

/**
 * Delivery integration (Module 10).
 *
 * Pathao / RedX are wired as *hooks*: when the credentials exist in the
 * environment the real API is called, otherwise the shipment is recorded with
 * `provider: MANUAL` so the shop can still track it and paste the consignment
 * id the courier gave them. Status always flows back into the same fields —
 * whether it arrived by API, webhook or manual update — and a delivered COD
 * order is marked paid.
 */
class CourierService {
  /** Which providers this server can actually talk to. */
  getProviders() {
    const providers: CourierProvider[] = ['PATHAO', 'REDX', 'MANUAL'];
    return providers.map((p) => {
      const creds: any = credentials(p);
      return {
        provider: p,
        configured: creds.configured,
        mode: creds.configured && p !== 'MANUAL' ? 'LIVE' : p === 'MANUAL' ? 'MANUAL' : 'NOT_CONFIGURED',
      };
    });
  }

  private async pathaoToken(): Promise<string> {
    const creds: any = credentials('PATHAO');
    const res = await fetch(`${creds.baseUrl}/aladdin/api/v1/issue-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'password',
        username: process.env.PATHAO_USERNAME,
        password: process.env.PATHAO_PASSWORD,
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body?.access_token) {
      throw new AppError(502, 'PATHAO_AUTH_FAILED', body?.message || 'Pathao authentication failed');
    }
    return body.access_token;
  }

  /** Creates the consignment either at the provider or as a manual record. */
  async createShipment(
    orderId: string,
    dto: {
      provider?: CourierProvider;
      deliveryFee?: number;
      weightKg?: number;
      note?: string;
      consignmentId?: string;
      trackingCode?: string;
    },
    userId: string
  ) {
    if (!Types.ObjectId.isValid(orderId)) throw new AppError(400, 'INVALID_ID', 'Invalid order ID');
    const order: any = await OnlineOrder.findById(orderId);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Online order not found');
    if (order.fulfillmentStatus === 'CANCELLED') {
      throw new AppError(409, 'ORDER_CANCELLED', 'A cancelled order cannot be shipped');
    }
    // Never create a second live consignment for a parcel that is already on
    // its way. A manual record may still be replaced (e.g. once the API keys
    // are added, or after a failed/returned attempt).
    const existingUnfinished =
      order.courier && ['PENDING', 'PICKED', 'IN_TRANSIT'].includes(order.courier.status);
    if (existingUnfinished && order.courier.provider !== 'MANUAL') {
      throw new AppError(
        409,
        'ALREADY_SHIPPED',
        `${order.orderNo} is already with ${order.courier.provider} (${order.courier.status}) — tracking ${order.courier.trackingCode || 'n/a'}`
      );
    }

    const requestedProvider: CourierProvider = dto.provider || 'MANUAL';
    const requestedCreds: any = credentials(requestedProvider);
    // Without credentials the shipment really is manual — say so instead of
    // recording a provider we never talked to.
    const provider: CourierProvider = requestedCreds.configured ? requestedProvider : 'MANUAL';
    const creds: any = credentials(provider);
    const codAmount = order.paymentMethod === 'COD' && order.paymentStatus === 'UNPAID' ? order.totalAmount : 0;

    let consignmentId = dto.consignmentId;
    let trackingCode = dto.trackingCode;
    let deliveryFee = dto.deliveryFee ?? 0;
    let source: 'API' | 'MANUAL' = 'MANUAL';
    let apiNote =
      requestedProvider !== 'MANUAL' && !requestedCreds.configured
        ? `${requestedProvider} credentials are not configured — recorded as a manual shipment (add the API keys to switch to live dispatch).`
        : '';

    if (provider === 'PATHAO') {
      try {
        const token = await this.pathaoToken();
        const res = await fetch(`${creds.baseUrl}/aladdin/api/v1/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            store_id: Number(creds.storeId),
            merchant_order_id: order.orderNo,
            recipient_name: order.customer.name,
            recipient_phone: order.customer.phone,
            recipient_address: order.customer.address,
            delivery_type: 48,
            item_type: 2,
            item_quantity: order.items.length,
            item_weight: dto.weightKg ? Number(dto.weightKg) : 0.5,
            amount_to_collect: codAmount,
            special_instruction: dto.note,
          }),
        });
        const body: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new AppError(502, 'PATHAO_CREATE_FAILED', body?.message || `Pathao rejected the order (${res.status})`);
        }
        consignmentId = String(body?.data?.consignment_id || consignmentId || '');
        trackingCode = String(body?.data?.merchant_order_id || order.orderNo);
        deliveryFee = Number(body?.data?.delivery_fee || deliveryFee);
        source = 'API';
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(502, 'PATHAO_UNAVAILABLE', `Could not reach Pathao: ${(err as Error).message}`);
      }
    } else if (provider === 'REDX') {
      try {
        const res = await fetch(`${creds.baseUrl}/parcel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'API-ACCESS-TOKEN': `Bearer ${creds.apiKey}` },
          body: JSON.stringify({
            customer_name: order.customer.name,
            customer_phone: order.customer.phone,
            delivery_area: order.customer.address,
            customer_address: order.customer.address,
            merchant_invoice_id: order.orderNo,
            cash_collection_amount: String(codAmount),
            parcel_weight: dto.weightKg ? Number(dto.weightKg) * 1000 : 500,
            value: order.totalAmount,
            parcel_details_json: order.items.map((i: any) => ({ name: i.productName, quantity: i.quantity })),
          }),
        });
        const body: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new AppError(502, 'REDX_CREATE_FAILED', body?.message || `RedX rejected the order (${res.status})`);
        }
        consignmentId = String(body?.tracking_id || consignmentId || '');
        trackingCode = String(body?.tracking_id || trackingCode || '');
        source = 'API';
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(502, 'REDX_UNAVAILABLE', `Could not reach RedX: ${(err as Error).message}`);
      }
    }

    // Manual / unconfigured fallback: keep a traceable reference
    if (!consignmentId && provider === 'MANUAL') {
      const seq = await nextSequence('courier_manual_seq');
      consignmentId = `MANUAL-${Date.now().toString(36).toUpperCase()}-${seq}`;
      trackingCode = consignmentId;
    }

    order.courier = {
      provider,
      consignmentId,
      trackingCode,
      status: 'PENDING',
      deliveryFee: roundMoney(deliveryFee),
      codAmount: roundMoney(codAmount),
      weightKg: dto.weightKg,
      note: dto.note || apiNote || undefined,
      sentAt: new Date(),
      deliveredAt: null,
      lastSyncAt: new Date(),
    };
    order.trackingCode = trackingCode || order.trackingCode;
    order.fulfillmentStatus = 'SHIPPED';
    order.courierHistory.push({
      at: new Date(),
      status: 'PENDING',
      source,
      note: `${provider} shipment created${apiNote ? ` — ${apiNote}` : ''}`,
    });
    await order.save();

    notificationService.notify({
      type: 'SYSTEM',
      title: 'Online order shipped',
      message: `${order.orderNo} handed to ${provider}${trackingCode ? ` · tracking ${trackingCode}` : ''}${codAmount > 0 ? ` · COD ৳${codAmount.toFixed(2)}` : ''}`,
      entityType: 'ecommerce/orders',
      entityId: String(order._id),
    });

    return { order: order.toObject(), provider, mode: source, consignmentId, trackingCode, warning: apiNote || undefined };
  }

  /**
   * Applies a courier status change (manual update, API sync or webhook) and
   * keeps the order itself in step — a delivered COD parcel is collected cash.
   */
  async applyStatus(
    orderId: string,
    dto: { status: string; source?: 'API' | 'WEBHOOK' | 'MANUAL'; providerStatus?: string; note?: string; consignmentId?: string; trackingCode?: string },
    userId?: string
  ) {
    if (!Types.ObjectId.isValid(orderId)) throw new AppError(400, 'INVALID_ID', 'Invalid order ID');
    const order: any = await OnlineOrder.findById(orderId);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Online order not found');
    if (!order.courier) throw new AppError(409, 'NO_SHIPMENT', 'This order has not been handed to a courier yet');

    const status = normaliseStatus(dto.status) || String(dto.status).toUpperCase();
    const allowed = ['PENDING', 'PICKED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED', 'FAILED'];
    if (!allowed.includes(status)) {
      throw new AppError(400, 'INVALID_STATUS', `Unknown courier status "${dto.status}" (allowed: ${allowed.join(', ')})`);
    }

    const before = order.courier.status;
    order.courier.status = status;
    order.courier.lastSyncAt = new Date();
    if (dto.consignmentId) order.courier.consignmentId = dto.consignmentId;
    if (dto.trackingCode) {
      order.courier.trackingCode = dto.trackingCode;
      order.trackingCode = dto.trackingCode;
    }

    if (status === 'DELIVERED') {
      order.courier.deliveredAt = new Date();
      order.fulfillmentStatus = 'DELIVERED';
      if (order.paymentMethod === 'COD') order.paymentStatus = 'PAID';
    } else if (status === 'RETURNED' || status === 'FAILED') {
      // Parcel came back — the order is no longer shipped
      order.fulfillmentStatus = 'CONFIRMED';
    } else if (status === 'CANCELLED') {
      order.fulfillmentStatus = 'CANCELLED';
    } else if (order.fulfillmentStatus !== 'DELIVERED') {
      order.fulfillmentStatus = 'SHIPPED';
    }

    order.courierHistory.push({
      at: new Date(),
      status,
      source: dto.source || 'MANUAL',
      note: dto.note || (dto.providerStatus ? `provider said "${dto.providerStatus}"` : undefined),
    });
    await order.save();

    if (status !== before) {
      notificationService.notify({
        type: 'SYSTEM',
        title: status === 'DELIVERED' ? 'Online order delivered' : `Courier update: ${status.replace('_', ' ').toLowerCase()}`,
        message: `${order.orderNo} (${order.courier.provider})${order.trackingCode ? ` · ${order.trackingCode}` : ''}`,
        entityType: 'ecommerce/orders',
        entityId: String(order._id),
      });
    }

    return { order: order.toObject(), previousStatus: before, status, changed: status !== before };
  }

  /**
   * Provider webhook entry point. Runs without a session, so the order is
   * looked up by consignment / tracking id across organizations; an optional
   * shared secret (COURIER_WEBHOOK_SECRET) is enforced when configured.
   */
  async handleWebhook(provider: CourierProvider, payload: any, token?: string) {
    const secret = process.env.COURIER_WEBHOOK_SECRET;
    if (secret && token !== secret) {
      throw new AppError(401, 'INVALID_WEBHOOK_TOKEN', 'Webhook token does not match');
    }

    const consignmentId =
      payload?.consignment_id || payload?.consignmentId || payload?.tracking_id || payload?.trackingId;
    const trackingCode = payload?.merchant_order_id || payload?.merchantOrderId || payload?.tracking_code || payload?.trackingCode;
    const providerStatus = payload?.status || payload?.delivery_status || payload?.order_status;

    const { runWithOrg } = await import('../middlewares/org.context');
    const query: any[] = [];
    if (consignmentId) query.push({ 'courier.consignmentId': String(consignmentId) });
    if (trackingCode) query.push({ 'courier.trackingCode': String(trackingCode) }, { orderNo: String(trackingCode) });
    if (query.length === 0) {
      throw new AppError(400, 'MISSING_REFERENCE', 'Webhook needs a consignment id or tracking code');
    }

    // Platform scope: find the order without a tenant filter, then act inside it
    const found: any = await runWithOrg({ skipScope: true }, async () => OnlineOrder.findOne({ $or: query }).lean());
    if (!found) throw new AppError(404, 'ORDER_NOT_FOUND', `No order matches ${consignmentId || trackingCode}`);

    return runWithOrg({ orgId: String(found.orgId) }, () =>
      this.applyStatus(
        String(found._id),
        { status: String(providerStatus || ''), providerStatus: providerStatus ? String(providerStatus) : undefined, source: 'WEBHOOK', consignmentId: consignmentId ? String(consignmentId) : undefined, trackingCode: trackingCode ? String(trackingCode) : undefined, note: `${provider} webhook` },
        undefined
      )
    );
  }

  /** Shipment board: everything handed to a courier, newest first. */
  async listShipments(options: { status?: string; provider?: string; limit?: number } = {}) {
    const filter: Record<string, any> = { courier: { $ne: null } };
    if (options.status) filter['courier.status'] = options.status;
    if (options.provider) filter['courier.provider'] = options.provider;

    const rows = await OnlineOrder.find(filter)
      .select('orderNo customer totalAmount paymentStatus fulfillmentStatus courier trackingCode createdAt')
      .sort({ 'courier.sentAt': -1 })
      .limit(Math.min(options.limit || 100, 300))
      .lean();

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const summary = {
      shipments: rows.length,
      inTransit: rows.filter((r: any) => ['PENDING', 'PICKED', 'IN_TRANSIT'].includes(r.courier?.status)).length,
      delivered: rows.filter((r: any) => r.courier?.status === 'DELIVERED').length,
      returnedOrFailed: rows.filter((r: any) => ['RETURNED', 'FAILED'].includes(r.courier?.status)).length,
      codOutstanding: round(
        rows
          .filter((r: any) => r.courier?.status !== 'DELIVERED' && r.paymentStatus === 'UNPAID')
          .reduce((s: number, r: any) => s + (r.courier?.codAmount || 0), 0)
      ),
      codCollected: round(
        rows
          .filter((r: any) => r.courier?.status === 'DELIVERED')
          .reduce((s: number, r: any) => s + (r.courier?.codAmount || 0), 0)
      ),
    };

    return { summary, data: rows };
  }

  /** Delivery performance per provider. */
  async getCourierStats() {
    const shipments = await OnlineOrder.find({ courier: { $ne: null } })
      .select('courier fulfillmentStatus createdAt updatedAt')
      .lean();

    const byProvider = new Map<string, any>();
    for (const s of shipments as any[]) {
      const key = s.courier.provider;
      const bucket = byProvider.get(key) || { provider: key, shipments: 0, delivered: 0, returned: 0, inTransit: 0, codCollected: 0, deliveryDays: [] as number[] };
      bucket.shipments += 1;
      bucket.codCollected += s.courier.deliveredAt ? s.courier.codAmount || 0 : 0;
      if (s.courier.status === 'DELIVERED') {
        bucket.delivered += 1;
        if (s.courier.deliveredAt && s.courier.sentAt) {
          bucket.deliveryDays.push(
            (new Date(s.courier.deliveredAt).getTime() - new Date(s.courier.sentAt).getTime()) / 86400000
          );
        }
      } else if (['RETURNED', 'FAILED'].includes(s.courier.status)) {
        bucket.returned += 1;
      } else {
        bucket.inTransit += 1;
      }
      byProvider.set(key, bucket);
    }

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const data = Array.from(byProvider.values()).map((b) => ({
      provider: b.provider,
      shipments: b.shipments,
      delivered: b.delivered,
      returnedOrFailed: b.returned,
      inTransit: b.inTransit,
      successRatePercent: b.shipments ? Math.round((b.delivered / b.shipments) * 1000) / 10 : 0,
      averageDeliveryDays: b.deliveryDays.length ? round(b.deliveryDays.reduce((s: number, d: number) => s + d, 0) / b.deliveryDays.length) : null,
      codCollected: round(b.codCollected),
    }));

    return {
      summary: {
        providers: data.length,
        shipments: data.reduce((s, d) => s + d.shipments, 0),
        delivered: data.reduce((s, d) => s + d.delivered, 0),
        inTransit: data.reduce((s, d) => s + d.inTransit, 0),
        returnedOrFailed: data.reduce((s, d) => s + d.returnedOrFailed, 0),
        codCollected: round(data.reduce((s, d) => s + d.codCollected, 0)),
      },
      data,
    };
  }
}

export const courierService = new CourierService();
