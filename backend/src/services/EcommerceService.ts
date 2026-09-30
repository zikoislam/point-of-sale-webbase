import { Types } from 'mongoose';
import { OnlineOrder, IOnlineOrder } from '../models/OnlineOrder';
import { Customer } from '../models/Customer';
import { AppError } from '../utils/app-error';
import { saleService } from './SaleService';

export class EcommerceService {
  async listOrders(status?: string): Promise<Array<any>> {
    const filter: Record<string, any> = {};
    if (status) filter.fulfillmentStatus = status;
    return OnlineOrder.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  }

  async getOrder(id: string): Promise<IOnlineOrder> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid order ID');
    const order = await OnlineOrder.findById(id).lean();
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Online order not found');
    return order as unknown as IOnlineOrder;
  }

  /**
   * Confirming an online order creates the real Sale (cash-on-delivery books
   * the full amount as customer due until it is collected) and links it.
   */
  async confirmOrder(id: string, actorId: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid order ID');
    const order: any = await OnlineOrder.findById(id).lean();
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Online order not found');
    if (order.fulfillmentStatus !== 'PENDING') {
      throw new AppError(409, 'ORDER_ALREADY_HANDLED', `Order is already ${order.fulfillmentStatus}`);
    }

    // Find or create the customer by phone
    let customer: any = await Customer.findOne({ phone: order.customer.phone }).lean();
    if (!customer) {
      customer = await Customer.create({
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.address,
        customerType: 'RETAIL',
        creditLimit: 0,
      });
    }

    const sale = await saleService.checkout(
      {
        customerId: String(customer._id),
        pricingTier: 'RETAIL',
        salesRepId: undefined,
        items: order.items.map((i: any) => ({
          variantId: String(i.variantId),
          quantity: i.quantity,
          unitSellingPrice: i.unitPrice,
          discount: 0,
        })),
        payments: [{ method: 'CUSTOMER_DUE', amount: order.totalAmount }],
        idempotencyKey: `WEB-ORDER-${order._id}`,
      },
      actorId
    );

    await OnlineOrder.updateOne(
      { _id: order._id },
      { $set: { fulfillmentStatus: 'CONFIRMED', saleId: sale._id, customerId: customer._id } }
    );

    return { orderNo: order.orderNo, invoiceNo: (sale as any).invoiceNo };
  }

  async setFulfillmentStatus(id: string, status: 'SHIPPED' | 'DELIVERED' | 'CANCELLED', trackingCode?: string): Promise<IOnlineOrder> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid order ID');
    const order = await OnlineOrder.findById(id);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Online order not found');

    if (status === 'CANCELLED') {
      if (order.fulfillmentStatus !== 'PENDING') {
        throw new AppError(409, 'ORDER_ALREADY_HANDLED', 'Only pending orders can be cancelled');
      }
      order.fulfillmentStatus = 'CANCELLED';
    } else {
      const flow = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
      const expectedPrev = status === 'SHIPPED' ? 'CONFIRMED' : 'SHIPPED';
      if (order.fulfillmentStatus !== expectedPrev) {
        throw new AppError(409, 'WRONG_ORDER_STATE', `To mark ${status} the order must be ${expectedPrev}`);
      }
      order.fulfillmentStatus = status;
      if (status === 'DELIVERED') order.paymentStatus = 'PAID';
    }
    if (trackingCode !== undefined) order.trackingCode = trackingCode;
    await order.save();
    return order.toObject() as unknown as IOnlineOrder;
  }
}

export const ecommerceService = new EcommerceService();
