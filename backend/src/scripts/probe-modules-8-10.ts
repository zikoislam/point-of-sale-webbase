/** Modules 8-10 — support tickets, leads, leave requests, couriers + reports. */
import mongoose from 'mongoose';

import '../models';

import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Customer } from '../models/Customer';
import { Employee } from '../models/Employee';
import { Attendance } from '../models/Attendance';
import { OnlineOrder } from '../models/OnlineOrder';
import { Sale } from '../models/Sale';
import { LeaveRequest } from '../models/LeaveRequest';
import { Lead } from '../models/Lead';
import { SupportTicket } from '../models/SupportTicket';
import { Settings } from '../models/Settings';
import { Shift } from '../models/Shift';
import { StockMovement } from '../models/StockMovement';
import { Counter } from '../models/Counter';
import { Notification } from '../models/Notification';
import { Account } from '../models/Account';
import { JournalEntry } from '../models/JournalEntry';
import { ALL_PERMISSIONS } from '../config/permissions';
import { runWithOrg } from '../middlewares/org.context';
import { orgService } from '../services/OrgService';

const BASE = 'http://localhost:5000/api/v1';
const USERNAME = 'qa_m810_user';
const ORG_NAME = 'QA Modules 8-10 Org';

async function api(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const id = (r: any) => r.body?.data?._id || r.body?.data?.id;

async function run() {
  await connectDB();
  let orgId = '';

  try {
    await Organization.deleteMany({ name: ORG_NAME });
    const org: any = await orgService.createOrg({ name: ORG_NAME, adminPermissionSet: [...ALL_PERMISSIONS] });
    orgId = org.id;
    const adminRole: any = await Role.findOne({ orgId, name: 'ADMIN' }).lean();

    await User.deleteMany({ username: USERNAME });
    const user: any = await User.create({
      username: USERNAME, fullName: 'QA Ops User', email: `${USERNAME}@example.com`, phone: '+8801792000000',
      passwordHash: 'Probe@123', pinHash: '4141', roleId: adminRole._id, isActive: true,
      memberships: [{ orgId, roleId: adminRole._id, isActive: true }],
    });
    const userId = String(user._id);

    const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: 'Probe@123' }) });
    const token = login.body?.data?.token;
    if (!token) throw new Error('login failed');
    console.log('✓ throwaway org + user ready');

    // ── Fixtures ────────────────────────────────────────────────────────────
    const cat: any = await runWithOrg({ orgId }, async () =>
      Category.create({ name: 'QA Ops Cat', code: `QAO${Date.now().toString(36).toUpperCase()}` })
    );
    const product: any = await runWithOrg({ orgId }, async () =>
      Product.create({
        name: 'QA Courier Product', categoryId: cat._id, unit: 'Pcs', taxType: 'INCLUSIVE', taxRate: 0, isActive: true,
        variants: [{ attributeName: 'Std', sku: `QA-OPS-${Date.now().toString(36).toUpperCase()}`, barcode: `QA-OPS-BC-${Date.now()}`, costPrice: 100, retailSellingPrice: 250, wholesaleSellingPrice: 220, currentStock: 100, alertQty: 5, isAvailable: true }],
      })
    );
    const employee: any = await runWithOrg({ orgId }, async () =>
      Employee.create({ employeeCode: `EMP${Date.now().toString(36).toUpperCase()}`, name: 'Rahim Uddin', phone: '+8801712345678', designation: 'Cashier', department: 'Sales', joinDate: new Date(), salary: { basic: 20000 } })
    );
    console.log(`✓ product + employee ready (${employee.employeeCode})`);

    /* ══════════════ MODULE 10 — courier hooks ══════════════ */
    console.log('\n── Module 10: courier + online orders ──');
    const order: any = await runWithOrg({ orgId }, async () =>
      OnlineOrder.create({
        orderNo: `WEB-${Date.now().toString().slice(-6)}`,
        customer: { name: 'Online Buyer', phone: '+8801812345678', address: 'House 12, Road 5, Dhanmondi, Dhaka' },
        items: [{ productId: product._id, variantId: product.variants[0]._id, variantSku: product.variants[0].sku, productName: product.name, variantName: 'Std', quantity: 2, unitPrice: 250 }],
        totalAmount: 500, paymentMethod: 'COD', paymentStatus: 'UNPAID', fulfillmentStatus: 'CONFIRMED',
      })
    );
    const orderId = String(order._id);
    console.log(`✓ online order ${order.orderNo} (COD ৳500) created`);

    const providers = await api('/couriers/providers', {}, token);
    console.log(`providers → ${(providers.body?.data || []).map((p: any) => `${p.provider}:${p.mode}`).join(', ')}`);

    const shipment = await api(`/couriers/shipments/${orderId}`, {
      method: 'POST',
      body: JSON.stringify({ provider: 'MANUAL', deliveryFee: 80, note: 'Fragile' }),
    }, token);
    const ship = shipment.body?.data;
    console.log(`shipment → ${shipment.status} | provider ${ship?.provider} | mode ${ship?.mode} | tracking ${ship?.trackingCode}`);
    console.log(`  message: ${shipment.body?.message}`);

    const pathaoAttempt = await api(`/couriers/shipments/${orderId}`, { method: 'POST', body: JSON.stringify({ provider: 'PATHAO' }) }, token);
    console.log(`re-dispatching a live shipment → ${pathaoAttempt.status} (manual record is replaceable, so this upgrades the record)`);
    const manualSwap = await api(`/couriers/shipments/${orderId}`, { method: 'POST', body: JSON.stringify({ provider: 'REDX' }) }, token);
    console.log(`recording provider ${manualSwap.body?.data?.provider} (requested REDX) | note: ${manualSwap.body?.data?.warning ? 'explained' : '—'}`);

    const inTransit = await api(`/couriers/shipments/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'in transit', note: 'Left the hub' }) }, token);
    console.log(`status "in transit" → ${inTransit.status} | normalised to ${inTransit.body?.data?.status} (expect IN_TRANSIT)`);

    const badStatus = await api(`/couriers/shipments/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'teleported' }) }, token);
    console.log(`unknown status → ${badStatus.status} ${badStatus.body?.error?.code} (expect 400)`);

    // Webhook: a courier pushes "Delivered" with no session at all
    const consignment = ship?.consignmentId;
    const webhook = await fetch(`${BASE}/couriers/webhooks/patnao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consignment_id: consignment, merchant_order_id: order.orderNo, status: 'Delivered' }),
    });
    const webhookBody: any = await webhook.json().catch(() => ({}));
    console.log(`webhook (no auth) → ${webhook.status} | order ${webhookBody?.data?.order?.fulfillmentStatus} | courier ${webhookBody?.data?.order?.courier?.status} | paid ${webhookBody?.data?.order?.paymentStatus}`);

    const unknownWebhook = await fetch(`${BASE}/couriers/webhooks/patnao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consignment_id: 'NOPE-999', status: 'Delivered' }),
    });
    console.log(`webhook for an unknown parcel → ${unknownWebhook.status} (expect 404)`);

    const stats = await api('/couriers/stats', {}, token);
    console.log(`courier stats → shipments ${stats.body?.data?.summary?.shipments} | delivered ${stats.body?.data?.summary?.delivered} | COD collected ৳${stats.body?.data?.summary?.codCollected}`);
    for (const c of stats.body?.data?.data || []) {
      console.log(`  ${c.provider}: ${c.shipments} shipment(s) | success ${c.successRatePercent}% | avg ${c.averageDeliveryDays}d`);
    }

    /* ══════════════ MODULE 8 — support tickets ══════════════ */
    console.log('\n── Module 8: support tickets ──');
    const urgent = await api('/support-tickets', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Delivered item is damaged', description: 'The parcel arrived with a torn packaging.', priority: 'URGENT', customerName: 'Online Buyer', customerPhone: '+8801812345678', relatedOrderNo: order.orderNo, category: 'Delivery' }),
    }, token);
    const urgentId = id(urgent);
    console.log(`ticket created → ${urgent.status} ${urgent.body?.data?.ticketNo} | priority ${urgent.body?.data?.priority} | SLA ${urgent.body?.data?.slaHours}h`);

    const response = await api(`/support-tickets/${urgentId}/responses`, {
      method: 'POST',
      body: JSON.stringify({ message: 'Sorry about that — we are sending a replacement today.', isCustomerVisible: true }),
    }, token);
    console.log(`first reply → ${response.status} | SLA met: ${response.body?.data?.slaMet} | status now ${response.body?.data?.ticket?.status}`);

    const resolved = await api(`/support-tickets/${urgentId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution: 'Replacement dispatched', satisfactionRating: 5 }),
    }, token);
    console.log(`resolved → ${resolved.status} | ${resolved.body?.data?.ticket?.status} | resolution ${resolved.body?.data?.resolutionHours}h`);

    // A ticket that breached its SLA: backdate the deadline, then answer
    const late = await api('/support-tickets', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Slow response complaint', description: 'Nobody called me back.', priority: 'HIGH' }),
    }, token);
    const lateId = id(late);
    await runWithOrg({ orgId }, async () =>
      SupportTicket.updateOne({ _id: new mongoose.Types.ObjectId(lateId) }, { $set: { slaDueAt: new Date(Date.now() - 3600000) } })
    );
    const lateReply = await api(`/support-tickets/${lateId}/responses`, { method: 'POST', body: JSON.stringify({ message: 'Apologies for the delay.' }) }, token);
    console.log(`late reply → ${lateReply.status} | SLA met: ${lateReply.body?.data?.slaMet} (expect false)`);

    const breachedList = await api('/support-tickets?breachedOnly=true', {}, token);
    console.log(`breached-only filter → ${breachedList.status} | ${(breachedList.body?.data || []).length} ticket(s) past their deadline and unanswered`);

    const sla = await api('/support-tickets/report/sla', {}, token);
    console.log(`SLA report → tickets ${sla.body?.data?.summary?.tickets} | open ${sla.body?.data?.summary?.open} | compliance ${sla.body?.data?.summary?.slaCompliancePercent}% | avg response ${sla.body?.data?.summary?.averageResponseHours}h | rating ${sla.body?.data?.summary?.averageRating}`);
    for (const p of sla.body?.data?.byPriority || []) {
      console.log(`  ${p.priority}: ${p.tickets} ticket(s), ${p.breached} breached, compliance ${p.compliancePercent}%`);
    }

    /* ══════════════ MODULE 8 — lead pipeline ══════════════ */
    console.log('\n── Module 8: lead pipeline ──');
    const mkLead = (name: string, source: string, value: number) =>
      api('/leads', { method: 'POST', body: JSON.stringify({ name, phone: `+88018123456${Math.floor(Math.random() * 90 + 10)}`, source, estimatedValue: value, assignedTo: userId }) }, token);
    const leadA = await mkLead('Ayesha Traders', 'REFERRAL', 120000);
    const leadB = await mkLead('Dhaka Fabrics', 'FACEBOOK', 80000);
    const leadC = await mkLead('Mega Store', 'WALK_IN', 45000);
    const leadD = await mkLead('City Interiors', 'ONLINE_STORE', 60000);
    console.log(`4 leads created → ${[leadA, leadB, leadC, leadD].map((l) => l.status).join(', ')}`);

    const leadAId = id(leadA);
    await api(`/leads/${leadAId}/stage`, { method: 'PUT', body: JSON.stringify({ stage: 'CONTACTED', note: 'Called — asked for samples' }) }, token);
    await api(`/leads/${leadAId}/stage`, { method: 'PUT', body: JSON.stringify({ stage: 'QUALIFIED', probability: 60 }) }, token);
    const converted = await api(`/leads/${leadAId}/convert`, { method: 'POST', body: JSON.stringify({ customerType: 'WHOLESALE', creditLimit: 100000 }) }, token);
    console.log(`convert → ${converted.status} | ${converted.body?.message} | stage ${converted.body?.data?.lead?.stage}`);
    console.log(`  customer: ${converted.body?.data?.customer?.name} (created: ${converted.body?.data?.customer?.created})`);

    const lost = await api(`/leads/${id(leadC)}/stage`, { method: 'PUT', body: JSON.stringify({ stage: 'LOST', lostReason: 'Chose another supplier' }) }, token);
    console.log(`mark lost → ${lost.status} | ${lost.body?.data?.stage} | reason "${lost.body?.data?.lostReason}"`);

    const convertTwice = await api(`/leads/${leadAId}/convert`, { method: 'POST', body: JSON.stringify({}) }, token);
    console.log(`convert twice → ${convertTwice.status} ${convertTwice.body?.error?.code} (expect 409)`);

    const board = await api('/leads/board', {}, token);
    console.log(`board → open ${board.body?.data?.summary?.open} | pipeline ৳${board.body?.data?.summary?.pipelineValue} | weighted ৳${board.body?.data?.summary?.weightedPipelineValue}`);
    console.log(`  columns: ${(board.body?.data?.columns || []).map((c: any) => `${c.stage}:${c.count}`).join(' ')}`);

    const conversion = await api('/leads/report/conversion', {}, token);
    console.log(`conversion report → leads ${conversion.body?.data?.summary?.totalLeads} | won ${conversion.body?.data?.summary?.won} | lost ${conversion.body?.data?.summary?.lost} | rate ${conversion.body?.data?.summary?.conversionRatePercent}% | avg days to convert ${conversion.body?.data?.summary?.averageDaysToConvert}`);
    console.log(`  by source: ${(conversion.body?.data?.bySource || []).map((s: any) => `${s.source}:${s.leads}/${s.won}won(${s.conversionRatePercent}%)`).join(' ')}`);

    /* ══════════════ MODULE 9 — leave requests ══════════════ */
    console.log('\n── Module 9: leave requests ──');
    const today = new Date();
    const from = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 4 * 86400000).toISOString().slice(0, 10);

    const leave = await api('/leave-requests', {
      method: 'POST',
      body: JSON.stringify({ employeeId: String(employee._id), leaveType: 'CASUAL', fromDate: from, toDate: to, reason: 'Family programme' }),
    }, token);
    const leaveId = id(leave);
    console.log(`leave request → ${leave.status} ${leave.body?.data?.requestNo} | ${leave.body?.data?.days} day(s) | ${leave.body?.data?.status}`);

    const overlap = await api('/leave-requests', {
      method: 'POST',
      body: JSON.stringify({ employeeId: String(employee._id), fromDate: from, toDate: to }),
    }, token);
    console.log(`overlapping request → ${overlap.status} ${overlap.body?.error?.code} (expect 409)`);

    const approve = await api(`/leave-requests/${leaveId}/approve`, { method: 'PUT', body: JSON.stringify({ note: 'Approved by manager' }) }, token);
    console.log(`approve → ${approve.status} | status ${approve.body?.data?.request?.status} | attendance marked: ${approve.body?.data?.attendanceMarkedDays} day(s)`);
    const attendanceRows: any[] = await runWithOrg({ orgId }, async () =>
      Attendance.find({ employeeId: employee._id }).select('date status notes').lean()
    );
    console.log(`  attendance rows: ${attendanceRows.map((a) => `${a.date}:${a.status}`).join(', ')}`);

    const approveAgain = await api(`/leave-requests/${leaveId}/approve`, { method: 'PUT', body: JSON.stringify({}) }, token);
    console.log(`approve twice → ${approveAgain.status} ${approveAgain.body?.error?.code} (expect 409)`);

    const leaveSummary = await api('/leave-requests/summary', {}, token);
    console.log(`leave summary → employees ${leaveSummary.body?.data?.summary?.employees} | total days ${leaveSummary.body?.data?.summary?.totalDays} | avg ${leaveSummary.body?.data?.summary?.averageDaysPerEmployee}`);
    console.log(`  by type: ${JSON.stringify(leaveSummary.body?.data?.summary?.byType)}`);

    /* ══════════════ Reports + exports ══════════════ */
    console.log('\n── New reports ──');
    // A counter sale so the online/offline split has something to compare
    await api('/shifts/open', { method: 'POST', body: JSON.stringify({ openingFloat: 500, terminalId: 'QA-M810-01' }) }, token);
    const sale = await api('/sales/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': `qa-m810-${Date.now()}` },
      body: JSON.stringify({
        pricingTier: 'RETAIL',
        items: [{ variantId: String(product.variants[0]._id), quantity: 3, pricingTier: 'RETAIL' }],
        payments: [{ method: 'CASH', amount: 750 }],
        clientTimestamp: new Date().toISOString(),
      }),
    }, token);
    console.log(`counter sale → ${sale.status}`);

    const ovo = await api('/reports/online-vs-offline', {}, token);
    console.log(`online vs offline → POS ৳${ovo.body?.data?.summary?.posRevenue} (${ovo.body?.data?.summary?.posOrders} orders) | online ৳${ovo.body?.data?.summary?.onlineRevenue} (${ovo.body?.data?.summary?.onlineOrders}) | online share ${ovo.body?.data?.summary?.onlineSharePercent}%`);

    const fulfil = await api('/reports/fulfillment-rate', {}, token);
    console.log(`fulfilment → orders ${fulfil.body?.data?.summary?.orders} | delivered ${fulfil.body?.data?.summary?.delivered} | rate ${fulfil.body?.data?.summary?.fulfillmentRatePercent}% | avg delivery ${fulfil.body?.data?.summary?.averageDeliveryDays}d | COD pending ৳${fulfil.body?.data?.summary?.codPending}`);
    console.log(`  by courier: ${(fulfil.body?.data?.byCourier || []).map((c: any) => `${c.provider}:${c.delivered}/${c.orders}`).join(' ')}`);

    const leadReport = await api('/reports/lead-conversion', {}, token);
    console.log(`lead conversion report → ${leadReport.status} | leads ${leadReport.body?.data?.summary?.totalLeads} | won value ৳${leadReport.body?.data?.summary?.wonValue}`);

    const ticketReport = await api('/reports/ticket-sla', {}, token);
    console.log(`ticket SLA report → ${ticketReport.status} | compliance ${ticketReport.body?.data?.summary?.slaCompliancePercent}% | overdue ${ticketReport.body?.data?.summary?.currentlyOverdue}`);

    const leaveReport = await api('/reports/leave-summary', {}, token);
    console.log(`leave summary report → ${leaveReport.status} | employees ${leaveReport.body?.data?.summary?.employees} | days ${leaveReport.body?.data?.summary?.totalDays}`);

    for (const type of ['online-vs-offline', 'fulfillment-rate', 'lead-conversion', 'ticket-sla', 'leave-summary']) {
      const csv = await fetch(`${BASE}/reports/export/${type}`, { headers: { Authorization: `Bearer ${token}` } });
      const text = await csv.text();
      console.log(`   csv ${type.padEnd(18)} → ${csv.status} | ${text.split('\n').filter((l) => l.trim()).length - 1} row(s)`);
    }
    const pdf = await fetch(`${BASE}/reports/export-pdf/fulfillment-rate`, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`   pdf fulfillment-rate → ${pdf.status} | ${(Buffer.from(await pdf.arrayBuffer()).length / 1024).toFixed(1)} KB`);
    const xlsx = await fetch(`${BASE}/reports/export-excel/lead-conversion`, { headers: { Authorization: `Bearer ${token}` } });
    console.log(`   excel lead-conversion → ${xlsx.status} | ${(Buffer.from(await xlsx.arrayBuffer()).length / 1024).toFixed(1)} KB`);

    const notif = await api('/notifications?limit=10', {}, token);
    const titles = (notif.body?.data?.data || notif.body?.data || []).slice(0, 6).map((n: any) => n.title);
    console.log(`\n   bell: [${titles.join(' | ')}]`);
  } finally {
    if (orgId) {
      const oid = new mongoose.Types.ObjectId(orgId);
      await Promise.all([
        OnlineOrder.deleteMany({ orgId: oid }), SupportTicket.deleteMany({ orgId: oid }),
        Lead.deleteMany({ orgId: oid }), LeaveRequest.deleteMany({ orgId: oid }),
        Attendance.deleteMany({ orgId: oid }), Employee.deleteMany({ orgId: oid }),
        Product.deleteMany({ orgId: oid }), Category.deleteMany({ orgId: oid }),
        Customer.deleteMany({ orgId: oid }), Sale.deleteMany({ orgId: oid }),
        Shift.deleteMany({ orgId: oid }), StockMovement.deleteMany({ orgId: oid }),
        Account.deleteMany({ orgId: oid }), JournalEntry.deleteMany({ orgId: oid }),
        Settings.deleteMany({ orgId: oid }), Role.deleteMany({ orgId: oid }),
        Counter.deleteMany({ _id: new RegExp(`^${orgId}_`) }), User.deleteMany({ username: USERNAME }),
        Notification.deleteMany({ orgId: oid }),
        Organization.deleteOne({ _id: oid }),
      ]);
      console.log('\n✓ throwaway org removed');
    }
    await mongoose.disconnect();
  }
}

run().then(() => process.exit(0)).catch((e) => {
  console.error('PROBE FAILED:', e?.message || e);
  process.exit(1);
});
