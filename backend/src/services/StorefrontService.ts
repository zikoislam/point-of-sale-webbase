import { Types } from 'mongoose';
import { Organization } from '../models/Organization';
import { Product } from '../models/Product';
import { OnlineOrder } from '../models/OnlineOrder';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';

export interface PlaceOrderInput {
  customer: { name: string; phone: string; address: string };
  items: Array<{ variantId: string; quantity: number }>;
  notes?: string;
}

/** Public storefront reads and order placement — all org resolution by slug. */
export class StorefrontService {
  private async orgBySlug(slug: string): Promise<any> {
    const org = await Organization.findOne({ slug: slug.toLowerCase(), status: 'ACTIVE' }).lean();
    if (!org) throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found');
    return org;
  }

  /** Public catalog: web-visible, in-stock products with their first variant. */
  async catalog(slug: string): Promise<Array<any>> {
    const org = await this.orgBySlug(slug);
    const products = await Product.find({ isActive: true, isWebVisible: true })
      .select('name categoryId imageUrl taxType taxRate description variants')
      .populate('categoryId', 'name')
      .lean();
    return products
      .map((p: any) => {
        const variant: any = p.variants?.[0];
        if (!variant) return null;
        return {
          productId: String(p._id),
          variantId: String(variant._id),
          name: p.name,
          category: p.categoryId?.name || '',
          description: p.description || '',
          imageUrl: p.imageUrl || '',
          sku: variant.sku,
          attributeName: variant.attributeName,
          price: roundMoney(variant.retailSellingPrice),
          inStock: variant.currentStock > 0,
        };
      })
      .filter(Boolean);
  }

  async placeOrder(slug: string, data: PlaceOrderInput): Promise<{ orderNo: string; totalAmount: number }> {
    const org = await this.orgBySlug(slug);
    if (!data.items?.length) throw new AppError(400, 'EMPTY_ORDER', 'The cart is empty');
    if (!data.customer?.name || !data.customer?.phone || !data.customer?.address) {
      throw new AppError(400, 'CUSTOMER_INFO_REQUIRED', 'Name, phone and address are required');
    }

    const items: any[] = [];
    let total = 0;
    for (const item of data.items) {
      if (!Types.ObjectId.isValid(item.variantId)) throw new AppError(400, 'INVALID_ITEM', 'Invalid item in the cart');
      const product: any = await Product.findOne({
        _id: { $exists: true },
        isActive: true,
        isWebVisible: true,
        'variants._id': new Types.ObjectId(item.variantId),
      }).lean();
      if (!product) throw new AppError(404, 'PRODUCT_NOT_AVAILABLE', 'A product in your cart is no longer available');
      const variant: any = product.variants.find((v: any) => String(v._id) === item.variantId);
      if (!variant || variant.currentStock < item.quantity) {
        throw new AppError(422, 'OUT_OF_STOCK', `Not enough stock for ${product.name}`);
      }
      const unitPrice = roundMoney(variant.retailSellingPrice);
      items.push({
        productId: product._id,
        variantId: variant._id,
        variantSku: variant.sku,
        productName: product.name,
        variantName: variant.attributeName,
        quantity: item.quantity,
        unitPrice,
      });
      total = roundMoney(total + unitPrice * item.quantity);
    }

    const seq = (await OnlineOrder.countDocuments({ orgId: org._id })) + 1;
    const orderNo = `WEB-${String(seq).padStart(6, '0')}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

    const order = await OnlineOrder.create({
      orgId: org._id,
      orderNo,
      customer: data.customer,
      items,
      totalAmount: total,
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'PENDING',
      notes: data.notes,
    });

    return { orderNo: order.orderNo, totalAmount: order.totalAmount };
  }

  /** Customer order tracking by order number + phone (no auth). */
  async trackOrder(slug: string, orderNo: string, phone: string): Promise<any> {
    await this.orgBySlug(slug);
    const order = await OnlineOrder.findOne({
      orderNo: orderNo.toUpperCase().trim(),
      'customer.phone': phone.trim(),
    })
      .select('orderNo totalAmount paymentMethod paymentStatus fulfillmentStatus createdAt items trackingCode')
      .lean();
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'No order found for those details');
    return order;
  }
}

export const storefrontService = new StorefrontService();
