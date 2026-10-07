import { Product, Sale, Customer, Supplier, PurchaseOrder, Organization } from '../models';

export type SearchResultType =
  | 'product'
  | 'sale'
  | 'customer'
  | 'supplier'
  | 'purchase-order'
  | 'organization';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
  /** Lower sorts first (0 = exact identifier match). Internal only. */
  rank: number;
}

export interface SearchOptions {
  permissions: string[];
  isSuper: boolean;
  limit?: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cross-module "jump to anything" search. Every query runs inside the tenant
 * scope opened by requireOrg (the org-scope plugin filters each model), and a
 * result type is only searched when the caller holds its module permission.
 */
class SearchService {
  async search(rawQuery: string, opts: SearchOptions) {
    const q = (rawQuery || '').trim();
    const limit = opts.limit ?? 6;
    if (q.length < 2) return { query: q, results: [] as SearchResult[] };

    const rx = new RegExp(escapeRegex(q), 'i');
    const exact = new RegExp(`^${escapeRegex(q)}$`, 'i');
    const can = (permission: string) => opts.isSuper || opts.permissions.includes(permission);

    const jobs: Array<Promise<SearchResult[]>> = [];

    if (can('inv:view')) {
      jobs.push(
        (async () => {
          const products = await Product.find({
            $or: [
              { name: rx },
              { color: rx },
              { modelNo: rx },
              { partNumber: rx },
              { tags: rx },
              { searchKeywords: rx },
              { 'variants.sku': rx },
              { 'variants.barcode': rx },
              { 'variants.altBarcodes': rx },
            ],
          })
            .select(
              'name color modelNo partNumber tags variants.attributeName variants.sku variants.barcode variants.altBarcodes variants.retailSellingPrice variants.currentStock'
            )
            .limit(limit)
            .lean();
          return products.map((p: any) => {
            const variants: any[] = p.variants || [];
            const matchesId = (x: any, test: RegExp) =>
              (x.barcode && test.test(x.barcode)) ||
              (x.sku && test.test(x.sku)) ||
              (x.altBarcodes || []).some((b: string) => test.test(b));
            const v = variants.find((x) => matchesId(x, exact)) || variants.find((x) => matchesId(x, rx)) || variants[0] || {};
            const isExact = variants.some((x) => matchesId(x, exact));
            // Deep-link with the exact identifier so the products list opens on it.
            const token = v.barcode || (v.altBarcodes || [])[0] || v.sku || p.name;
            return {
              type: 'product' as const,
              id: String(p._id),
              title: p.name,
              subtitle: [p.color, p.modelNo, v.attributeName, v.sku ? `SKU ${v.sku}` : null]
                .filter(Boolean)
                .join(' · '),
              badge: v.barcode || (v.altBarcodes || [])[0] || v.sku,
              href: `/products?search=${encodeURIComponent(token)}`,
              rank: isExact ? 0 : 1,
            };
          });
        })()
      );
    }

    if (can('sales:view')) {
      jobs.push(
        (async () => {
          const sales = await Sale.find({ invoiceNo: rx })
            .select('invoiceNo totalAmount dueAmount createdAt')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
          return sales.map((s: any) => ({
            type: 'sale' as const,
            id: String(s._id),
            title: s.invoiceNo,
            subtitle: new Date(s.createdAt).toLocaleDateString(),
            badge: 'Invoice',
            href: `/sales/${s._id}`,
            rank: exact.test(s.invoiceNo) ? 0 : 1,
          }));
        })()
      );
    }

    if (can('customers:view')) {
      jobs.push(
        (async () => {
          const customers = await Customer.find({ $or: [{ name: rx }, { phone: rx }] })
            .select('name phone currentDueBalance')
            .limit(limit)
            .lean();
          return customers.map((c: any) => ({
            type: 'customer' as const,
            id: String(c._id),
            title: c.name,
            subtitle: c.phone,
            badge: c.currentDueBalance > 0 ? `Due ${c.currentDueBalance}` : 'Customer',
            href: `/customers/${c._id}/ledger`,
            rank: exact.test(c.phone) ? 0 : 1,
          }));
        })()
      );
    }

    if (can('procurement:view')) {
      jobs.push(
        (async () => {
          const suppliers = await Supplier.find({ $or: [{ companyName: rx }, { contactPerson: rx }, { phone: rx }] })
            .select('companyName contactPerson phone currentPayableBalance')
            .limit(limit)
            .lean();
          return suppliers.map((s: any) => ({
            type: 'supplier' as const,
            id: String(s._id),
            title: s.companyName,
            subtitle: [s.contactPerson, s.phone].filter(Boolean).join(' · '),
            badge: 'Supplier',
            href: `/suppliers/${s._id}/ledger`,
            rank: 1,
          }));
        })()
      );

      jobs.push(
        (async () => {
          const orders = await PurchaseOrder.find({ poNumber: rx })
            .select('poNumber status totalAmount createdAt')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
          return orders.map((o: any) => ({
            type: 'purchase-order' as const,
            id: String(o._id),
            title: o.poNumber,
            subtitle: [o.status, new Date(o.createdAt).toLocaleDateString()].join(' · '),
            badge: 'PO',
            href: `/purchase-orders/${o._id}`,
            rank: exact.test(o.poNumber) ? 0 : 1,
          }));
        })()
      );
    }

    // Platform Super Admin only: find a shop by its organization name/phone.
    if (opts.isSuper) {
      jobs.push(
        (async () => {
          const orgs = await Organization.find({ $or: [{ name: rx }, { slug: rx }, { contactPhone: rx }] })
            .select('name slug status contactPhone')
            .limit(limit)
            .lean();
          return orgs.map((o: any) => ({
            type: 'organization' as const,
            id: String(o._id),
            title: o.name,
            subtitle: [o.slug, o.status].filter(Boolean).join(' · '),
            badge: 'Organization',
            href: '/organizations',
            rank: 1,
          }));
        })()
      );
    }

    const groups = await Promise.all(jobs);
    const results = groups
      .flat()
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 40);
    return { query: q, results };
  }
}

export const searchService = new SearchService();
