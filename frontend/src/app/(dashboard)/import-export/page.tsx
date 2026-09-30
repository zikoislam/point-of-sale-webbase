'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ship,
  Plus,
  FileText,
  Receipt,
  Building2,
  BarChart3,
  RefreshCw,
  X,
  Check,
  Trash2,
  Search,
  ArrowRight,
  Anchor,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Tabs } from '../../../components/ui/Tabs';
import { useToast } from '../../../components/ui/Toast';
import { KpiCard } from '../../../components/reports/KpiCard';
import { ReportTable, money } from '../../../components/reports/ReportShell';

type IeTab = 'lc' | 'pi' | 'ci' | 'agents' | 'reports';

const LC_STATUS_TABS = ['', 'DRAFT', 'OPENED', 'SHIPPED', 'RECEIVED', 'RETIRED', 'CANCELLED'];

const statusVariant = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'neutral';
    case 'OPENED':
      return 'info';
    case 'SHIPPED':
      return 'purple';
    case 'RECEIVED':
    case 'ARRIVED':
      return 'warning';
    case 'RETIRED':
    case 'CLEARED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
};

const LC_NEXT: Record<string, string[]> = {
  DRAFT: ['OPENED', 'CANCELLED'],
  OPENED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['RETIRED'],
  RETIRED: [],
  CANCELLED: [],
};

interface LcRow {
  _id: string;
  lcNumber: string;
  lcType: string;
  status: string;
  issuingBank: string;
  bankBranch?: string;
  currency: string;
  exchangeRate: number;
  lcAmount: number;
  lcAmountBdt: number;
  totalCharges: number;
  marginPercent?: number;
  incoterms?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  issueDate: string;
  expiryDate?: string | null;
  latestShipmentDate?: string | null;
  documentsReceived: string[];
  beneficiarySupplierId?: any;
  buyerCustomerId?: any;
  charges?: Array<{ label: string; amount: number }>;
  notes?: string;
}

export default function ImportExportPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<IeTab>('lc');

  /* ── letters of credit ─────────────────────────────────────────────────── */
  const [lcStatus, setLcStatus] = useState('');
  const [lcModal, setLcModal] = useState(false);
  const [lcDetail, setLcDetail] = useState<LcRow | null>(null);
  const [lcForm, setLcForm] = useState({
    issuingBank: '',
    bankBranch: '',
    bankRefNo: '',
    currency: 'USD',
    exchangeRate: '120',
    lcAmount: '',
    supplierId: '',
    incoterms: 'CIF',
    portOfLoading: '',
    portOfDischarge: 'Chattogram',
    issueDate: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    latestShipmentDate: '',
    marginPercent: '',
    notes: '',
    charges: [{ label: 'LC opening commission', amount: '' }],
  });

  const { data: lcs, isLoading: lcLoading } = useQuery<any>({
    queryKey: ['lcs', lcStatus],
    queryFn: async () =>
      (await api.get('/import-export/lc', { params: { status: lcStatus || undefined, limit: 100 } })).data as any,
  });

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ['suppliers-for-ie'],
    queryFn: async () => (await api.get('/suppliers?limit=200')).data?.data || [],
  });

  const lcStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.put(`/import-export/lc/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('LC status updated');
      qc.invalidateQueries({ queryKey: ['lcs'] });
      qc.invalidateQueries({ queryKey: ['lc-detail'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not update the LC'),
  });

  const createLcMutation = useMutation({
    mutationFn: async () => {
      const charges = lcForm.charges
        .filter((c) => Number(c.amount) > 0)
        .map((c) => ({ label: c.label, amount: Number(c.amount) }));
      return api.post('/import-export/lc', {
        issuingBank: lcForm.issuingBank,
        bankBranch: lcForm.bankBranch || undefined,
        bankRefNo: lcForm.bankRefNo || undefined,
        currency: lcForm.currency,
        exchangeRate: Number(lcForm.exchangeRate),
        lcAmount: Number(lcForm.lcAmount),
        beneficiarySupplierId: lcForm.supplierId || undefined,
        incoterms: lcForm.incoterms || undefined,
        portOfLoading: lcForm.portOfLoading || undefined,
        portOfDischarge: lcForm.portOfDischarge || undefined,
        issueDate: lcForm.issueDate || undefined,
        expiryDate: lcForm.expiryDate || undefined,
        latestShipmentDate: lcForm.latestShipmentDate || undefined,
        marginPercent: lcForm.marginPercent ? Number(lcForm.marginPercent) : undefined,
        notes: lcForm.notes || undefined,
        charges,
      });
    },
    onSuccess: () => {
      toast.success('Letter of credit created');
      setLcModal(false);
      qc.invalidateQueries({ queryKey: ['lcs'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not create the LC'),
  });

  const { data: lcFull } = useQuery<any>({
    queryKey: ['lc-detail', lcDetail?._id],
    queryFn: async () => (await api.get(`/import-export/lc/${lcDetail!._id}`)).data,
    enabled: !!lcDetail,
  });

  /* ── proforma invoices ─────────────────────────────────────────────────── */
  const [piModal, setPiModal] = useState(false);
  const [piForm, setPiForm] = useState({
    supplierId: '',
    supplierPiNo: '',
    currency: 'USD',
    exchangeRate: '120',
    incoterms: 'FOB',
    portOfLoading: '',
    portOfDischarge: 'Chattogram',
    expectedShipmentDate: '',
    freightCost: '',
    insuranceCost: '',
    notes: '',
    items: [{ description: '', quantity: '1', unit: 'Pcs', unitPrice: '', hsnCode: '' }],
  });

  const { data: pis, isLoading: piLoading } = useQuery<any>({
    queryKey: ['pis'],
    queryFn: async () => (await api.get('/import-export/pi?limit=100')).data as any,
  });

  const createPiMutation = useMutation({
    mutationFn: async () =>
      api.post('/import-export/pi', {
        supplierId: piForm.supplierId,
        supplierPiNo: piForm.supplierPiNo || undefined,
        currency: piForm.currency,
        exchangeRate: Number(piForm.exchangeRate),
        incoterms: piForm.incoterms || undefined,
        portOfLoading: piForm.portOfLoading || undefined,
        portOfDischarge: piForm.portOfDischarge || undefined,
        expectedShipmentDate: piForm.expectedShipmentDate || undefined,
        freightCost: Number(piForm.freightCost) || 0,
        insuranceCost: Number(piForm.insuranceCost) || 0,
        notes: piForm.notes || undefined,
        items: piForm.items.map((i) => ({
          description: i.description,
          hsnCode: i.hsnCode || undefined,
          quantity: Number(i.quantity),
          unit: i.unit,
          unitPrice: Number(i.unitPrice),
        })),
      }),
    onSuccess: () => {
      toast.success('Proforma invoice created');
      setPiModal(false);
      qc.invalidateQueries({ queryKey: ['pis'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not create the PI'),
  });

  const piLinkMutation = useMutation({
    mutationFn: async ({ piId, lcId }: { piId: string; lcId: string }) =>
      api.put(`/import-export/pi/${piId}/link-lc`, { lcId }),
    onSuccess: () => {
      toast.success('PI linked to the LC');
      qc.invalidateQueries({ queryKey: ['pis'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not link the PI'),
  });

  /* ── commercial invoices ───────────────────────────────────────────────── */
  const [ciModal, setCiModal] = useState(false);
  const [ciTarget, setCiTarget] = useState<any | null>(null); // the invoice being cleared
  const [ciForm, setCiForm] = useState({
    supplierId: '',
    supplierCiNo: '',
    lcId: '',
    currency: 'USD',
    exchangeRate: '120',
    allocationBasis: 'VALUE',
    invoiceDate: new Date().toISOString().slice(0, 10),
    freightCostBdt: '',
    insuranceCostBdt: '',
    dutyAmountBdt: '',
    vatAmountBdt: '',
    otherChargesBdt: '',
    cnfChargesBdt: '',
    blNumber: '',
    blDate: '',
    vesselName: '',
    containerNo: '',
    arrivalDate: '',
    notes: '',
    items: [
      { description: '', quantity: '1', unit: 'Pcs', unitPrice: '', hsnCode: '', productId: '', variantId: '' },
    ],
  });
  const [ciProductSearch, setCiProductSearch] = useState('');
  const [ciProducts, setCiProducts] = useState<any[]>([]);
  const [ciVariants, setCiVariants] = useState<Record<number, any[]>>({});
  const [clearForm, setClearForm] = useState({ postStock: true, agentId: '', allocationBasis: 'VALUE' });

  const { data: cis, isLoading: ciLoading } = useQuery<any>({
    queryKey: ['cis'],
    queryFn: async () => (await api.get('/import-export/ci?limit=100')).data as any,
  });

  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ['cnf-agents'],
    queryFn: async () => (await api.get('/import-export/agents')).data || [],
  });

  useEffect(() => {
    const t = setTimeout(async () => {
      if (ciProductSearch.length < 2) {
        setCiProducts([]);
        return;
      }
      try {
        const res = await api.get('/products', { params: { search: ciProductSearch, limit: 8 } });
        setCiProducts((res.data as any)?.data || []);
      } catch {
        setCiProducts([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [ciProductSearch]);

  const createCiMutation = useMutation({
    mutationFn: async () =>
      api.post('/import-export/ci', {
        supplierId: ciForm.supplierId,
        supplierCiNo: ciForm.supplierCiNo || undefined,
        lcId: ciForm.lcId || undefined,
        currency: ciForm.currency,
        exchangeRate: Number(ciForm.exchangeRate),
        allocationBasis: ciForm.allocationBasis,
        invoiceDate: ciForm.invoiceDate || undefined,
        freightCostBdt: Number(ciForm.freightCostBdt) || 0,
        insuranceCostBdt: Number(ciForm.insuranceCostBdt) || 0,
        dutyAmountBdt: Number(ciForm.dutyAmountBdt) || 0,
        vatAmountBdt: Number(ciForm.vatAmountBdt) || 0,
        otherChargesBdt: Number(ciForm.otherChargesBdt) || 0,
        cnfChargesBdt: Number(ciForm.cnfChargesBdt) || 0,
        shipping: {
          blNumber: ciForm.blNumber || undefined,
          blDate: ciForm.blDate || undefined,
          vesselName: ciForm.vesselName || undefined,
          containerNo: ciForm.containerNo || undefined,
          arrivalDate: ciForm.arrivalDate || undefined,
        },
        notes: ciForm.notes || undefined,
        items: ciForm.items.map((i) => ({
          description: i.description,
          hsnCode: i.hsnCode || undefined,
          quantity: Number(i.quantity),
          unit: i.unit,
          unitPrice: Number(i.unitPrice),
          productId: i.productId || undefined,
          variantId: i.variantId || undefined,
        })),
      }),
    onSuccess: () => {
      toast.success('Commercial invoice created');
      setCiModal(false);
      qc.invalidateQueries({ queryKey: ['cis'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not create the CI'),
  });

  const clearMutation = useMutation({
    mutationFn: async (ciId: string) =>
      api.post(`/import-export/ci/${ciId}/clear`, {
        postStock: clearForm.postStock,
        agentId: clearForm.agentId || undefined,
        allocationBasis: clearForm.allocationBasis,
      }),
    onSuccess: (res: any) => {
      const d = res.data;
      toast.success(
        `Landed cost ৳${(d?.landedCost?.totalLandedCost || 0).toFixed(2)} applied${d?.stockPosted ? ' + stock received' : ''}`
      );
      setCiTarget(null);
      qc.invalidateQueries({ queryKey: ['cis'] });
      qc.invalidateQueries({ queryKey: ['landed-cost'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not apply the landed cost'),
  });

  /* ── agents ────────────────────────────────────────────────────────────── */
  const [agentModal, setAgentModal] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: '', agentType: 'CNF_AGENT', contactPerson: '', phone: '', address: '', openingPayable: '' });
  const [ledgerAgent, setLedgerAgent] = useState<any | null>(null);
  const [txnForm, setTxnForm] = useState({ entryType: 'PAYMENT', amount: '', narration: '' });

  const { data: agentLedger } = useQuery<any>({
    queryKey: ['agent-ledger', ledgerAgent?._id],
    queryFn: async () => (await api.get(`/import-export/agents/${ledgerAgent!._id}/ledger`)).data,
    enabled: !!ledgerAgent,
  });

  const createAgentMutation = useMutation({
    mutationFn: async () =>
      api.post('/import-export/agents', {
        name: agentForm.name,
        agentType: agentForm.agentType,
        contactPerson: agentForm.contactPerson || undefined,
        phone: agentForm.phone || undefined,
        address: agentForm.address || undefined,
        openingPayable: Number(agentForm.openingPayable) || 0,
      }),
    onSuccess: () => {
      toast.success('Agent added');
      setAgentModal(false);
      qc.invalidateQueries({ queryKey: ['cnf-agents'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not add the agent'),
  });

  const txnMutation = useMutation({
    mutationFn: async () =>
      api.post(`/import-export/agents/${ledgerAgent._id}/transactions`, {
        entryType: txnForm.entryType,
        amount: Number(txnForm.amount),
        narration: txnForm.narration || undefined,
      }),
    onSuccess: () => {
      toast.success('Transaction recorded');
      setTxnForm({ entryType: 'PAYMENT', amount: '', narration: '' });
      qc.invalidateQueries({ queryKey: ['agent-ledger'] });
      qc.invalidateQueries({ queryKey: ['cnf-agents'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Could not record the transaction'),
  });

  /* ── reports ───────────────────────────────────────────────────────────── */
  const { data: lcReport, isLoading: lcReportLoading } = useQuery<any>({
    queryKey: ['lc-status-report'],
    queryFn: async () => (await api.get('/reports/lc-status')).data,
    enabled: tab === 'reports',
  });
  const { data: landedReport, isLoading: landedLoading } = useQuery<any>({
    queryKey: ['landed-cost'],
    queryFn: async () => (await api.get('/reports/landed-cost')).data,
    enabled: tab === 'reports',
  });

  const lcRows: LcRow[] = lcs?.data || [];
  const piRows: any[] = pis?.data || [];
  const ciRows: any[] = cis?.data || [];

  const ciPreview = useMemo(() => {
    const goods = ciForm.items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);
    const goodsBdt = goods * (Number(ciForm.exchangeRate) || 0);
    const extras =
      (Number(ciForm.freightCostBdt) || 0) +
      (Number(ciForm.insuranceCostBdt) || 0) +
      (Number(ciForm.dutyAmountBdt) || 0) +
      (Number(ciForm.vatAmountBdt) || 0) +
      (Number(ciForm.otherChargesBdt) || 0) +
      (Number(ciForm.cnfChargesBdt) || 0);
    return { goods, goodsBdt, extras, total: goodsBdt + extras };
  }, [ciForm]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <Ship className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Import &amp; Export (LC)</h1>
            <p className="text-xs text-slate-400">
              Letters of credit, proforma &amp; commercial invoices, landed cost and C&amp;F agents
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {tab === 'lc' && (
            <Button size="sm" onClick={() => setLcModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> New LC
            </Button>
          )}
          {tab === 'pi' && (
            <Button size="sm" onClick={() => setPiModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> New PI
            </Button>
          )}
          {tab === 'ci' && (
            <Button size="sm" onClick={() => setCiModal(true)} disabled={suppliers.length === 0}>
              <Plus className="w-4 h-4 mr-1.5" /> New CI
            </Button>
          )}
          {tab === 'agents' && (
            <Button size="sm" onClick={() => setAgentModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> New Agent
            </Button>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'lc', label: 'Letters of Credit', icon: <Ship className="w-3.5 h-3.5" />, count: lcRows.length },
          { key: 'pi', label: 'Proforma Invoices', icon: <FileText className="w-3.5 h-3.5" />, count: piRows.length },
          { key: 'ci', label: 'Commercial Invoices', icon: <Receipt className="w-3.5 h-3.5" />, count: ciRows.length },
          { key: 'agents', label: 'C&F Agents', icon: <Building2 className="w-3.5 h-3.5" />, count: agents.length },
          { key: 'reports', label: 'Reports', icon: <BarChart3 className="w-3.5 h-3.5" /> },
        ]}
        activeTab={tab}
        onChange={(k) => setTab(k as IeTab)}
        variant="pills"
      />

      {/* ── LC tab ─────────────────────────────────────────────────────────── */}
      {tab === 'lc' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-lg p-1">
            {LC_STATUS_TABS.map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setLcStatus(s)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  lcStatus === s ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          <ReportTable
            headers={[
              { label: 'LC No' },
              { label: 'Beneficiary' },
              { label: 'Bank' },
              { label: 'Amount', align: 'right' },
              { label: 'BDT', align: 'right' },
              { label: 'Charges', align: 'right' },
              { label: 'Expiry', align: 'center' },
              { label: 'Status', align: 'center' },
              { label: 'Actions', align: 'right' },
            ]}
            isEmpty={!lcLoading && lcRows.length === 0}
            empty="No letter of credit yet — create one to start an import."
          >
            {lcRows.map((lc) => {
              const expiryDays = lc.expiryDate
                ? Math.ceil((new Date(lc.expiryDate).getTime() - Date.now()) / 86400000)
                : null;
              return (
                <tr key={lc._id} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-4">
                    <button onClick={() => setLcDetail(lc)} className="font-mono text-[11px] text-cyan-400 hover:text-cyan-300">
                      {lc.lcNumber}
                    </button>
                    <span className="block text-[10px] text-slate-500">
                      {lc.lcType}
                      {lc.incoterms ? ` · ${lc.incoterms}` : ''}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-white">{lc.beneficiarySupplierId?.companyName || '—'}</td>
                  <td className="py-2.5 px-4 text-slate-400">
                    {lc.issuingBank}
                    {lc.bankBranch ? <span className="block text-[10px] text-slate-500">{lc.bankBranch}</span> : null}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-200">
                    {lc.currency} {lc.lcAmount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-300">{money(lc.lcAmountBdt)}</td>
                  <td className="py-2.5 px-4 text-right text-amber-400">{money(lc.totalCharges || 0)}</td>
                  <td className="py-2.5 px-4 text-center">
                    {lc.expiryDate ? (
                      <span className={expiryDays !== null && expiryDays <= 15 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                        {expiryDays !== null ? `${expiryDays}d` : '—'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <Badge variant={statusVariant(lc.status) as any}>{lc.status}</Badge>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {(LC_NEXT[lc.status] || []).map((next) => (
                        <button
                          key={next}
                          onClick={() => {
                            if (next === 'CANCELLED' && !confirm(`Cancel ${lc.lcNumber}?`)) return;
                            lcStatusMutation.mutate({ id: lc._id, status: next });
                          }}
                          className={`px-2 py-1 rounded text-[11px] ${
                            next === 'CANCELLED'
                              ? 'text-rose-400 hover:bg-slate-800'
                              : 'text-emerald-400 hover:bg-slate-800'
                          }`}
                        >
                          {next === 'OPENED'
                            ? 'Open'
                            : next === 'SHIPPED'
                            ? 'Ship'
                            : next === 'RECEIVED'
                            ? 'Receive'
                            : next === 'RETIRED'
                            ? 'Retire'
                            : 'Cancel'}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </ReportTable>
        </div>
      )}

      {/* ── PI tab ─────────────────────────────────────────────────────────── */}
      {tab === 'pi' && (
        <ReportTable
          headers={[
            { label: 'PI No' },
            { label: 'Supplier' },
            { label: 'LC' },
            { label: 'Items', align: 'right' },
            { label: 'Total', align: 'right' },
            { label: 'BDT', align: 'right' },
            { label: 'Status', align: 'center' },
            { label: 'Actions', align: 'right' },
          ]}
          isEmpty={!piLoading && piRows.length === 0}
          empty="No proforma invoice yet — add the supplier's PI before opening an LC."
        >
          {piRows.map((pi) => (
            <tr key={pi._id} className="hover:bg-slate-800/40">
              <td className="py-2.5 px-4 font-mono text-[11px] text-white">
                {pi.piNumber}
                {pi.supplierPiNo ? <span className="block text-[10px] text-slate-500">supplier {pi.supplierPiNo}</span> : null}
              </td>
              <td className="py-2.5 px-4 text-white">{pi.supplierId?.companyName || '—'}</td>
              <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{pi.lcId?.lcNumber || '—'}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{pi.items?.length || 0}</td>
              <td className="py-2.5 px-4 text-right text-slate-200">
                {pi.currency} {Number(pi.totalValue).toLocaleString()}
              </td>
              <td className="py-2.5 px-4 text-right text-slate-300">{money(pi.totalValueBdt)}</td>
              <td className="py-2.5 px-4 text-center">
                <Badge variant={statusVariant(pi.status) as any}>{pi.status}</Badge>
              </td>
              <td className="py-2.5 px-4">
                <div className="flex items-center justify-end gap-1.5">
                  {!pi.lcId && lcRows.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={(e) => e.target.value && piLinkMutation.mutate({ piId: pi._id, lcId: e.target.value })}
                      className="px-2 py-1 text-[11px] rounded bg-slate-800 border border-slate-700 text-slate-200"
                    >
                      <option value="">Link to LC…</option>
                      {lcRows
                        .filter((l) => ['DRAFT', 'OPENED'].includes(l.status))
                        .map((l) => (
                          <option key={l._id} value={l._id}>
                            {l.lcNumber}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </ReportTable>
      )}

      {/* ── CI tab ─────────────────────────────────────────────────────────── */}
      {tab === 'ci' && (
        <ReportTable
          headers={[
            { label: 'CI No' },
            { label: 'Supplier' },
            { label: 'LC' },
            { label: 'Goods', align: 'right' },
            { label: 'Landed Cost', align: 'right' },
            { label: 'Per Unit', align: 'right' },
            { label: 'Status', align: 'center' },
            { label: 'Cost', align: 'center' },
            { label: 'Actions', align: 'right' },
          ]}
          isEmpty={!ciLoading && ciRows.length === 0}
          empty="No commercial invoice yet — the CI is what turns an LC into stock."
        >
          {ciRows.map((ci) => (
            <tr key={ci._id} className="hover:bg-slate-800/40">
              <td className="py-2.5 px-4 font-mono text-[11px] text-white">
                {ci.ciNumber}
                <span className="block text-[10px] text-slate-500">
                  {new Date(ci.invoiceDate).toLocaleDateString()}
                </span>
              </td>
              <td className="py-2.5 px-4 text-white">{ci.supplierId?.companyName || '—'}</td>
              <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{ci.lcId?.lcNumber || '—'}</td>
              <td className="py-2.5 px-4 text-right text-slate-300">{money(ci.goodsValueBdt)}</td>
              <td className="py-2.5 px-4 text-right text-cyan-400 font-semibold">{money(ci.landedCostBdt)}</td>
              <td className="py-2.5 px-4 text-right text-slate-400">{money(ci.landedCostPerItem)}</td>
              <td className="py-2.5 px-4 text-center">
                <Badge variant={statusVariant(ci.status) as any}>{ci.status}</Badge>
              </td>
              <td className="py-2.5 px-4 text-center">
                {ci.costApplied ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                    <Check className="w-3 h-3" />
                    {ci.stockPosted ? 'stock in' : 'cost only'}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">pending</span>
                )}
              </td>
              <td className="py-2.5 px-4 text-right">
                {!ci.costApplied && ci.status !== 'CANCELLED' ? (
                  <button
                    onClick={() => {
                      setCiTarget(ci);
                      setClearForm({ postStock: true, agentId: '', allocationBasis: ci.allocationBasis || 'VALUE' });
                    }}
                    className="px-2.5 py-1 rounded text-[11px] bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                  >
                    Clear &amp; apply landed cost
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    {ci.costApplied ? new Date(ci.costAppliedAt).toLocaleDateString() : '—'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </ReportTable>
      )}

      {/* ── Agents tab ─────────────────────────────────────────────────────── */}
      {tab === 'agents' && (
        <ReportTable
          headers={[
            { label: 'Agent' },
            { label: 'Type' },
            { label: 'Contact' },
            { label: 'Payable', align: 'right' },
            { label: 'Status', align: 'center' },
            { label: 'Actions', align: 'right' },
          ]}
          isEmpty={agents.length === 0}
          empty="No C&F agent yet — add one to track clearing charges and payments."
        >
          {agents.map((a) => (
            <tr key={a._id} className="hover:bg-slate-800/40">
              <td className="py-2.5 px-4 text-white font-medium">{a.name}</td>
              <td className="py-2.5 px-4 text-slate-400">{a.agentType.replace(/_/g, ' ')}</td>
              <td className="py-2.5 px-4 text-slate-400">
                {a.contactPerson || '—'}
                {a.phone ? <span className="block text-[10px] text-slate-500">{a.phone}</span> : null}
              </td>
              <td className="py-2.5 px-4 text-right">
                <span className={a.currentPayable > 0 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                  {money(a.currentPayable)}
                </span>
              </td>
              <td className="py-2.5 px-4 text-center">
                <Badge variant={a.isActive ? 'success' : 'neutral'}>{a.isActive ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="py-2.5 px-4 text-right">
                <button
                  onClick={() => setLedgerAgent(a)}
                  className="px-2 py-1 rounded text-[11px] text-cyan-400 hover:bg-slate-800"
                >
                  Ledger →
                </button>
              </td>
            </tr>
          ))}
        </ReportTable>
      )}

      {/* ── Reports tab ────────────────────────────────────────────────────── */}
      {tab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Open LCs" value={String(lcReport?.summary?.openLcs ?? '—')} tone="indigo" />
            <KpiCard label="LC Exposure" value={money(lcReport?.summary?.totalExposureBdt)} tone="amber" />
            <KpiCard label="Expiring Soon" value={String(lcReport?.summary?.expiringSoon ?? '—')} tone="rose" />
            <KpiCard label="LC / Bank Charges" value={money(lcReport?.summary?.totalChargesBdt)} tone="white" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-2">LC status board</h3>
            <ReportTable
              headers={[
                { label: 'LC No' },
                { label: 'Beneficiary' },
                { label: 'Bank' },
                { label: 'Amount BDT', align: 'right' },
                { label: 'Outstanding', align: 'right' },
                { label: 'Shipment In', align: 'right' },
                { label: 'Expiry In', align: 'right' },
                { label: 'Status', align: 'center' },
                { label: 'Alert' },
              ]}
              isEmpty={!lcReportLoading && !(lcReport?.data || []).length}
              empty="No LC to report yet."
            >
              {(lcReport?.data || []).map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-mono text-[11px] text-white">{r.lcNumber}</td>
                  <td className="py-2.5 px-4 text-slate-300">{r.beneficiary}</td>
                  <td className="py-2.5 px-4 text-slate-400">{r.issuingBank}</td>
                  <td className="py-2.5 px-4 text-right text-slate-200">{money(r.lcAmountBdt)}</td>
                  <td className="py-2.5 px-4 text-right text-amber-400">{money(r.outstandingBdt)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-400">
                    {r.shipmentDaysLeft === null ? '—' : `${r.shipmentDaysLeft}d`}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-400">
                    {r.expiryDaysLeft === null ? '—' : `${r.expiryDaysLeft}d`}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <Badge variant={statusVariant(r.status) as any}>{r.status}</Badge>
                  </td>
                  <td className="py-2.5 px-4">
                    {r.alert ? (
                      <Badge variant={r.alert === 'EXPIRING_SOON' ? 'danger' : 'warning'}>{r.alert.replace(/_/g, ' ')}</Badge>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </ReportTable>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Landed cost analysis</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <KpiCard label="Total Landed Cost" value={money(landedReport?.summary?.totalLandedCost)} tone="purple" />
              <KpiCard label="Goods Value" value={money(landedReport?.summary?.totalGoodsCost)} tone="white" />
              <KpiCard label="Freight & Insurance" value={money(landedReport?.summary?.totalFreight)} tone="indigo" />
              <KpiCard label="Duty & VAT" value={money(landedReport?.summary?.totalDuty)} tone="amber" />
            </div>
            <ReportTable
              headers={[
                { label: 'CI No' },
                { label: 'Item' },
                { label: 'Supplier' },
                { label: 'Qty', align: 'right' },
                { label: 'Goods', align: 'right' },
                { label: 'Freight', align: 'right' },
                { label: 'Duty', align: 'right' },
                { label: 'Landed/Unit', align: 'right' },
                { label: 'Selling', align: 'right' },
                { label: 'Margin', align: 'right' },
              ]}
              isEmpty={!landedLoading && !(landedReport?.data || []).length}
              empty="Nothing cleared yet — apply a landed cost on a commercial invoice."
            >
              {(landedReport?.data || []).map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">{r.ciNumber}</td>
                  <td className="py-2.5 px-4 text-white">
                    {r.productName}
                    <span className="block text-[10px] text-slate-500">{r.variantName || r.sku}</span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">{r.supplierName}</td>
                  <td className="py-2.5 px-4 text-right text-slate-300">{r.quantity}</td>
                  <td className="py-2.5 px-4 text-right text-slate-300">{money(r.goodsCostBdt)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-400">{money(r.allocatedFreight)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-400">{money(r.allocatedDuty)}</td>
                  <td className="py-2.5 px-4 text-right text-cyan-400 font-semibold">{money(r.landedUnitCost)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-300">{money(r.sellingPrice)}</td>
                  <td className={`py-2.5 px-4 text-right font-semibold ${(r.marginPercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {r.marginPercent === null ? '—' : `${r.marginPercent}%`}
                  </td>
                </tr>
              ))}
            </ReportTable>
          </div>
        </div>
      )}

      {/* ── Create LC modal ────────────────────────────────────────────────── */}
      <Modal isOpen={lcModal} onClose={() => setLcModal(false)} title="New letter of credit" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Issuing bank *</label>
              <Input value={lcForm.issuingBank} onChange={(e) => setLcForm({ ...lcForm, issuingBank: e.target.value })} placeholder="Islami Bank Bangladesh" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Branch</label>
              <Input value={lcForm.bankBranch} onChange={(e) => setLcForm({ ...lcForm, bankBranch: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Bank reference</label>
              <Input value={lcForm.bankRefNo} onChange={(e) => setLcForm({ ...lcForm, bankRefNo: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Beneficiary (foreign supplier)</label>
              <select
                value={lcForm.supplierId}
                onChange={(e) => setLcForm({ ...lcForm, supplierId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="">Select supplier</option>
                {suppliers.map((s: any) => (
                  <option key={s._id} value={s._id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Currency</label>
              <select
                value={lcForm.currency}
                onChange={(e) => setLcForm({ ...lcForm, currency: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {['USD', 'EUR', 'CNY', 'GBP', 'JPY', 'INR'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Exchange rate (BDT) *</label>
              <Input
                type="number"
                value={lcForm.exchangeRate}
                onChange={(e) => setLcForm({ ...lcForm, exchangeRate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">LC amount ({lcForm.currency}) *</label>
              <Input
                type="number"
                value={lcForm.lcAmount}
                onChange={(e) => setLcForm({ ...lcForm, lcAmount: e.target.value })}
                placeholder="25000"
              />
              {Number(lcForm.lcAmount) > 0 && Number(lcForm.exchangeRate) > 0 && (
                <p className="text-[11px] text-cyan-400 mt-1">
                  ≈ {money(Number(lcForm.lcAmount) * Number(lcForm.exchangeRate))}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-400">Incoterms</label>
              <select
                value={lcForm.incoterms}
                onChange={(e) => setLcForm({ ...lcForm, incoterms: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                {['FOB', 'CIF', 'CFR', 'EXW', 'DAP', 'DDP'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Margin %</label>
              <Input
                type="number"
                value={lcForm.marginPercent}
                onChange={(e) => setLcForm({ ...lcForm, marginPercent: e.target.value })}
                placeholder="10"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Issue date</label>
              <Input type="date" value={lcForm.issueDate} onChange={(e) => setLcForm({ ...lcForm, issueDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Latest shipment date</label>
              <Input
                type="date"
                value={lcForm.latestShipmentDate}
                onChange={(e) => setLcForm({ ...lcForm, latestShipmentDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Expiry date</label>
              <Input type="date" value={lcForm.expiryDate} onChange={(e) => setLcForm({ ...lcForm, expiryDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Port of loading</label>
              <Input value={lcForm.portOfLoading} onChange={(e) => setLcForm({ ...lcForm, portOfLoading: e.target.value })} placeholder="Shanghai" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Port of discharge</label>
              <Input value={lcForm.portOfDischarge} onChange={(e) => setLcForm({ ...lcForm, portOfDischarge: e.target.value })} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Bank / LC charges (BDT)</label>
              <button
                onClick={() => setLcForm({ ...lcForm, charges: [...lcForm.charges, { label: '', amount: '' }] })}
                className="text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                + Add charge
              </button>
            </div>
            <div className="space-y-2 mt-1">
              {lcForm.charges.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={c.label}
                    onChange={(e) => {
                      const next = [...lcForm.charges];
                      next[i] = { ...next[i], label: e.target.value };
                      setLcForm({ ...lcForm, charges: next });
                    }}
                    placeholder="Commission"
                  />
                  <Input
                    type="number"
                    className="w-32"
                    value={c.amount}
                    onChange={(e) => {
                      const next = [...lcForm.charges];
                      next[i] = { ...next[i], amount: e.target.value };
                      setLcForm({ ...lcForm, charges: next });
                    }}
                    placeholder="0"
                  />
                  <button
                    onClick={() => setLcForm({ ...lcForm, charges: lcForm.charges.filter((_, x) => x !== i) })}
                    className="text-slate-500 hover:text-rose-400 px-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">Notes</label>
            <Input value={lcForm.notes} onChange={(e) => setLcForm({ ...lcForm, notes: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setLcModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createLcMutation.mutate()}
              disabled={!lcForm.issuingBank.trim() || !Number(lcForm.lcAmount) || !Number(lcForm.exchangeRate) || createLcMutation.isPending}
            >
              {createLcMutation.isPending ? 'Creating…' : 'Create LC'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── LC detail drawer ──────────────────────────────────────────────── */}
      {lcDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setLcDetail(null)}>
          <div
            className="w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white font-mono">{lcDetail.lcNumber}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lcDetail.issuingBank} · {lcDetail.currency} {lcDetail.lcAmount.toLocaleString()} @ {lcDetail.exchangeRate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(lcDetail.status) as any}>{lcDetail.status}</Badge>
                <button onClick={() => setLcDetail(null)} className="p-1.5 rounded text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ['Amount (BDT)', money(lcDetail.lcAmountBdt)],
                  ['Bank charges', money(lcDetail.totalCharges || 0)],
                  ['Beneficiary', lcDetail.beneficiarySupplierId?.companyName || '—'],
                  ['Incoterms', lcDetail.incoterms || '—'],
                  ['Issue date', new Date(lcDetail.issueDate).toLocaleDateString()],
                  ['Expiry', lcDetail.expiryDate ? new Date(lcDetail.expiryDate).toLocaleDateString() : '—'],
                  ['Latest shipment', lcDetail.latestShipmentDate ? new Date(lcDetail.latestShipmentDate).toLocaleDateString() : '—'],
                  ['Route', `${lcDetail.portOfLoading || '—'} → ${lcDetail.portOfDischarge || '—'}`],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[10px] uppercase text-slate-500">{label}</p>
                    <p className="text-slate-200 mt-1">{value}</p>
                  </div>
                ))}
              </div>

              {lcDetail.charges && lcDetail.charges.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2">Charges</h4>
                  <div className="rounded-lg border border-slate-800 divide-y divide-slate-800">
                    {lcDetail.charges.map((c, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className="text-slate-400">{c.label}</span>
                        <span className="text-slate-200">{money(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-2">Documents received</h4>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(lcDetail.documentsReceived || []).length === 0 ? (
                    <span className="text-[11px] text-slate-500">Nothing recorded yet</span>
                  ) : (
                    lcDetail.documentsReceived.map((d) => (
                      <Badge key={d} variant="success">
                        {d}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Bill of Lading', 'Commercial Invoice', 'Packing List', 'Certificate of Origin', 'Insurance'].map((d) => (
                    <button
                      key={d}
                      onClick={async () => {
                        try {
                          await api.put(`/import-export/lc/${lcDetail._id}/documents`, { document: d });
                          toast.success(`${d} recorded`);
                          qc.invalidateQueries({ queryKey: ['lc-detail'] });
                        } catch (e: any) {
                          toast.error(e?.message || 'Could not record the document');
                        }
                      }}
                      disabled={(lcDetail.documentsReceived || []).includes(d)}
                      className="px-2 py-1 rounded text-[11px] border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40"
                    >
                      + {d}
                    </button>
                  ))}
                </div>
              </div>

              {lcFull && (
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2">
                      Proforma invoices ({(lcFull.proformaInvoices || []).length})
                    </h4>
                    {(lcFull.proformaInvoices || []).map((pi: any) => (
                      <div key={pi._id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-xs mb-1.5">
                        <span className="font-mono text-slate-300">{pi.piNumber}</span>
                        <span className="text-slate-200">{money(pi.totalValueBdt)}</span>
                        <Badge variant={statusVariant(pi.status) as any}>{pi.status}</Badge>
                      </div>
                    ))}
                    {(lcFull.proformaInvoices || []).length === 0 && (
                      <p className="text-[11px] text-slate-500">No PI linked yet</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2">
                      Commercial invoices ({(lcFull.commercialInvoices || []).length})
                    </h4>
                    {(lcFull.commercialInvoices || []).map((ci: any) => (
                      <div key={ci._id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-xs mb-1.5">
                        <span className="font-mono text-slate-300">{ci.ciNumber}</span>
                        <span className="text-cyan-400">{money(ci.landedCostBdt)}</span>
                        <Badge variant={statusVariant(ci.status) as any}>{ci.status}</Badge>
                      </div>
                    ))}
                    {(lcFull.commercialInvoices || []).length === 0 && (
                      <p className="text-[11px] text-slate-500">No commercial invoice yet</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(LC_NEXT[lcDetail.status] || []).map((next) => (
                  <Button
                    key={next}
                    variant={next === 'CANCELLED' ? 'outline' : 'primary'}
                    onClick={() => lcStatusMutation.mutate({ id: lcDetail._id, status: next })}
                    disabled={lcStatusMutation.isPending}
                  >
                    {next === 'CANCELLED' ? 'Cancel LC' : `Move to ${next}`}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create PI modal ───────────────────────────────────────────────── */}
      <Modal isOpen={piModal} onClose={() => setPiModal(false)} title="New proforma invoice" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-400">Supplier *</label>
              <select
                value={piForm.supplierId}
                onChange={(e) => setPiForm({ ...piForm, supplierId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="">Select supplier</option>
                {suppliers.map((s: any) => (
                  <option key={s._id} value={s._id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Supplier PI no.</label>
              <Input value={piForm.supplierPiNo} onChange={(e) => setPiForm({ ...piForm, supplierPiNo: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">Currency</label>
                <select
                  value={piForm.currency}
                  onChange={(e) => setPiForm({ ...piForm, currency: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                >
                  {['USD', 'EUR', 'CNY', 'GBP', 'INR'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Rate</label>
                <Input type="number" value={piForm.exchangeRate} onChange={(e) => setPiForm({ ...piForm, exchangeRate: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Items</label>
              <button
                onClick={() =>
                  setPiForm({
                    ...piForm,
                    items: [...piForm.items, { description: '', quantity: '1', unit: 'Pcs', unitPrice: '', hsnCode: '' }],
                  })
                }
                className="text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                + Add item
              </button>
            </div>
            <div className="space-y-2 mt-1">
              {piForm.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5">
                  <Input
                    className="col-span-5"
                    value={it.description}
                    onChange={(e) => {
                      const next = [...piForm.items];
                      next[i] = { ...next[i], description: e.target.value };
                      setPiForm({ ...piForm, items: next });
                    }}
                    placeholder="Fabric description"
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    value={it.quantity}
                    onChange={(e) => {
                      const next = [...piForm.items];
                      next[i] = { ...next[i], quantity: e.target.value };
                      setPiForm({ ...piForm, items: next });
                    }}
                    placeholder="Qty"
                  />
                  <Input
                    className="col-span-2"
                    value={it.unit}
                    onChange={(e) => {
                      const next = [...piForm.items];
                      next[i] = { ...next[i], unit: e.target.value };
                      setPiForm({ ...piForm, items: next });
                    }}
                    placeholder="Unit"
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    value={it.unitPrice}
                    onChange={(e) => {
                      const next = [...piForm.items];
                      next[i] = { ...next[i], unitPrice: e.target.value };
                      setPiForm({ ...piForm, items: next });
                    }}
                    placeholder="Rate"
                  />
                  <button
                    onClick={() => setPiForm({ ...piForm, items: piForm.items.filter((_, x) => x !== i) })}
                    className="col-span-1 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5 mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Freight ({piForm.currency})</label>
              <Input type="number" value={piForm.freightCost} onChange={(e) => setPiForm({ ...piForm, freightCost: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Insurance ({piForm.currency})</label>
              <Input type="number" value={piForm.insuranceCost} onChange={(e) => setPiForm({ ...piForm, insuranceCost: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Expected shipment</label>
              <Input
                type="date"
                value={piForm.expectedShipmentDate}
                onChange={(e) => setPiForm({ ...piForm, expectedShipmentDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Port of loading</label>
              <Input value={piForm.portOfLoading} onChange={(e) => setPiForm({ ...piForm, portOfLoading: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPiModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createPiMutation.mutate()}
              disabled={
                !piForm.supplierId ||
                piForm.items.some((i) => !i.description.trim() || !Number(i.quantity) || !Number(i.unitPrice)) ||
                createPiMutation.isPending
              }
            >
              {createPiMutation.isPending ? 'Creating…' : 'Create PI'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Create CI modal ───────────────────────────────────────────────── */}
      <Modal isOpen={ciModal} onClose={() => setCiModal(false)} title="New commercial invoice" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="text-xs text-slate-400">Supplier *</label>
              <select
                value={ciForm.supplierId}
                onChange={(e) => setCiForm({ ...ciForm, supplierId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="">Select supplier</option>
                {suppliers.map((s: any) => (
                  <option key={s._id} value={s._id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Link to LC</label>
              <select
                value={ciForm.lcId}
                onChange={(e) => {
                  const lc = lcRows.find((l) => l._id === e.target.value);
                  setCiForm({
                    ...ciForm,
                    lcId: e.target.value,
                    currency: lc?.currency || ciForm.currency,
                    exchangeRate: lc ? String(lc.exchangeRate) : ciForm.exchangeRate,
                  });
                }}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="">No LC</option>
                {lcRows.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.lcNumber} · {l.currency} {l.lcAmount}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Currency</label>
              <Input value={ciForm.currency} onChange={(e) => setCiForm({ ...ciForm, currency: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Rate</label>
              <Input type="number" value={ciForm.exchangeRate} onChange={(e) => setCiForm({ ...ciForm, exchangeRate: e.target.value })} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Items (link a product to update its stock &amp; cost)</label>
              <button
                onClick={() =>
                  setCiForm({
                    ...ciForm,
                    items: [
                      ...ciForm.items,
                      { description: '', quantity: '1', unit: 'Pcs', unitPrice: '', hsnCode: '', productId: '', variantId: '' },
                    ],
                  })
                }
                className="text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                + Add item
              </button>
            </div>
            <div className="space-y-2 mt-1">
              {ciForm.items.map((it, i) => (
                <div key={i} className="rounded-lg border border-slate-800 p-2 space-y-1.5">
                  <div className="grid grid-cols-12 gap-1.5">
                    <Input
                      className="col-span-6"
                      value={it.description}
                      onChange={(e) => {
                        const next = [...ciForm.items];
                        next[i] = { ...next[i], description: e.target.value };
                        setCiForm({ ...ciForm, items: next });
                      }}
                      placeholder="Description on the invoice"
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      value={it.quantity}
                      onChange={(e) => {
                        const next = [...ciForm.items];
                        next[i] = { ...next[i], quantity: e.target.value };
                        setCiForm({ ...ciForm, items: next });
                      }}
                      placeholder="Qty"
                    />
                    <Input
                      className="col-span-2"
                      value={it.unit}
                      onChange={(e) => {
                        const next = [...ciForm.items];
                        next[i] = { ...next[i], unit: e.target.value };
                        setCiForm({ ...ciForm, items: next });
                      }}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      value={it.unitPrice}
                      onChange={(e) => {
                        const next = [...ciForm.items];
                        next[i] = { ...next[i], unitPrice: e.target.value };
                        setCiForm({ ...ciForm, items: next });
                      }}
                      placeholder={`Rate (${ciForm.currency})`}
                    />
                  </div>

                  <div className="grid grid-cols-12 gap-1.5 items-center">
                    <select
                      className="col-span-5 px-2 py-1.5 text-[11px] rounded bg-slate-800 border border-slate-700 text-slate-200"
                      value={it.productId}
                      onChange={async (e) => {
                        const next = [...ciForm.items];
                        next[i] = { ...next[i], productId: e.target.value, variantId: '' };
                        setCiForm({ ...ciForm, items: next });
                        if (e.target.value) {
                          try {
                            const res = await api.get(`/products/${e.target.value}`);
                            setCiVariants((prev) => ({ ...prev, [i]: (res.data as any)?.variants || [] }));
                          } catch {
                            setCiVariants((prev) => ({ ...prev, [i]: [] }));
                          }
                        }
                      }}
                    >
                      <option value="">Not linked to a product</option>
                      {ciProducts.map((p: any) => (
                        <option key={p.id || p._id} value={p.id || p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      className="col-span-4"
                      value={ciProductSearch}
                      onChange={(e) => setCiProductSearch(e.target.value)}
                      placeholder="Search product…"
                    />
                    <select
                      className="col-span-3 px-2 py-1.5 text-[11px] rounded bg-slate-800 border border-slate-700 text-slate-200"
                      value={it.variantId}
                      onChange={(e) => {
                        const next = [...ciForm.items];
                        next[i] = { ...next[i], variantId: e.target.value };
                        setCiForm({ ...ciForm, items: next });
                      }}
                      disabled={!it.productId}
                    >
                      <option value="">Variant</option>
                      {(ciVariants[i] || []).map((v: any) => (
                        <option key={v._id} value={v._id}>
                          {v.attributeName} · {v.sku}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setCiForm({ ...ciForm, items: ciForm.items.filter((_, x) => x !== i) })}
                      className="col-span-0.5 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Charges */}
          <div className="grid grid-cols-3 gap-2">
            {[
              ['freightCostBdt', 'Freight (BDT)'],
              ['insuranceCostBdt', 'Insurance (BDT)'],
              ['dutyAmountBdt', 'Customs duty'],
              ['vatAmountBdt', 'VAT'],
              ['otherChargesBdt', 'Other charges'],
              ['cnfChargesBdt', 'C&F charges'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-[11px] text-slate-400">{label}</label>
                <Input
                  type="number"
                  value={(ciForm as any)[key]}
                  onChange={(e) => setCiForm({ ...ciForm, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-300">
              <span>Goods value</span>
              <span>
                {ciForm.currency} {ciPreview.goods.toLocaleString()} ≈ {money(ciPreview.goodsBdt)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Freight + duty + other + C&amp;F</span>
              <span>{money(ciPreview.extras)}</span>
            </div>
            <div className="flex justify-between font-semibold text-cyan-300 pt-1 border-t border-cyan-500/20">
              <span>Estimated landed cost</span>
              <span>{money(ciPreview.total)}</span>
            </div>
            <p className="text-[10px] text-slate-500">
              The exact per-item landed cost is computed when you clear the shipment.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">B/L number</label>
              <Input value={ciForm.blNumber} onChange={(e) => setCiForm({ ...ciForm, blNumber: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Vessel</label>
              <Input value={ciForm.vesselName} onChange={(e) => setCiForm({ ...ciForm, vesselName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Container no.</label>
              <Input value={ciForm.containerNo} onChange={(e) => setCiForm({ ...ciForm, containerNo: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Arrival date</label>
              <Input type="date" value={ciForm.arrivalDate} onChange={(e) => setCiForm({ ...ciForm, arrivalDate: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCiModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createCiMutation.mutate()}
              disabled={
                !ciForm.supplierId ||
                ciForm.items.some((i) => !i.description.trim() || !Number(i.quantity) || !Number(i.unitPrice)) ||
                createCiMutation.isPending
              }
            >
              {createCiMutation.isPending ? 'Creating…' : 'Create CI'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Clear / apply landed cost modal ───────────────────────────────── */}
      <Modal isOpen={!!ciTarget} onClose={() => setCiTarget(null)} title="Apply landed cost" size="lg">
        {ciTarget && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 p-3 text-xs space-y-1">
              <div className="flex justify-between text-white font-semibold">
                <span>{ciTarget.ciNumber}</span>
                <span>
                  {ciTarget.currency} {Number(ciTarget.goodsValue).toLocaleString()} @ {ciTarget.exchangeRate}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Goods value</span>
                <span>{money(ciTarget.goodsValueBdt)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Freight + insurance</span>
                <span>{money(ciTarget.freightCostBdt + ciTarget.insuranceCostBdt)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Duty + VAT</span>
                <span>{money(ciTarget.dutyAmountBdt + ciTarget.vatAmountBdt)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Other + LC + C&amp;F</span>
                <span>{money(ciTarget.otherChargesBdt + ciTarget.lcChargesBdt + ciTarget.cnfChargesBdt)}</span>
              </div>
              <div className="flex justify-between font-bold text-cyan-300 pt-1 border-t border-slate-800">
                <span>Landed cost</span>
                <span>{money(ciTarget.landedCostBdt)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Allocation basis</label>
                <select
                  value={clearForm.allocationBasis}
                  onChange={(e) => setClearForm({ ...clearForm, allocationBasis: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                >
                  <option value="VALUE">By item value</option>
                  <option value="QUANTITY">By quantity</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Charge C&amp;F to agent</label>
                <select
                  value={clearForm.agentId}
                  onChange={(e) => setClearForm({ ...clearForm, agentId: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                  disabled={!ciTarget.cnfChargesBdt}
                >
                  <option value="">None</option>
                  {agents.map((a: any) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {!ciTarget.cnfChargesBdt && (
                  <p className="text-[10px] text-slate-500 mt-1">No C&amp;F charge on this invoice</p>
                )}
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={clearForm.postStock}
                onChange={(e) => setClearForm({ ...clearForm, postStock: e.target.checked })}
                className="mt-0.5 rounded border-slate-600 bg-slate-800"
              />
              <span>
                Receive the stock into inventory
                <span className="block text-[10px] text-slate-500">
                  Tick this unless the same goods were already received through a purchase order / GRN — otherwise the
                  stock would be counted twice.
                </span>
              </span>
            </label>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-200">
              Item costs will be set to their landed cost (weighted average with the stock already on hand). This can only
              be applied once per invoice.
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCiTarget(null)}>
                Cancel
              </Button>
              <Button onClick={() => clearMutation.mutate(ciTarget._id)} disabled={clearMutation.isPending}>
                {clearMutation.isPending ? 'Applying…' : 'Apply landed cost'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create agent modal ────────────────────────────────────────────── */}
      <Modal isOpen={agentModal} onClose={() => setAgentModal(false)} title="New C&F / freight agent">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400">Agent name *</label>
            <Input value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Type</label>
              <select
                value={agentForm.agentType}
                onChange={(e) => setAgentForm({ ...agentForm, agentType: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="CNF_AGENT">C&amp;F Agent</option>
                <option value="FREIGHT_FORWARDER">Freight Forwarder</option>
                <option value="BOTH">Both</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Contact person</label>
              <Input value={agentForm.contactPerson} onChange={(e) => setAgentForm({ ...agentForm, contactPerson: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Phone</label>
              <Input value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400">Opening payable (BDT)</label>
              <Input
                type="number"
                value={agentForm.openingPayable}
                onChange={(e) => setAgentForm({ ...agentForm, openingPayable: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Address</label>
            <Input value={agentForm.address} onChange={(e) => setAgentForm({ ...agentForm, address: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAgentModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => createAgentMutation.mutate()} disabled={!agentForm.name.trim() || createAgentMutation.isPending}>
              {createAgentMutation.isPending ? 'Saving…' : 'Add agent'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Agent ledger drawer ───────────────────────────────────────────── */}
      {ledgerAgent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setLedgerAgent(null)}>
          <div
            className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{ledgerAgent.name}</h3>
                <p className="text-xs text-slate-400">
                  {ledgerAgent.agentType.replace(/_/g, ' ')} · payable {money(agentLedger?.summary?.outstanding ?? ledgerAgent.currentPayable)}
                </p>
              </div>
              <button onClick={() => setLedgerAgent(null)} className="p-1.5 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Charged" value={money(agentLedger?.summary?.totalCharged)} tone="amber" />
                <KpiCard label="Paid" value={money(agentLedger?.summary?.totalPaid)} tone="emerald" />
                <KpiCard label="Outstanding" value={money(agentLedger?.summary?.outstanding)} tone="rose" />
              </div>

              <div className="rounded-lg border border-slate-800 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-300">Record a transaction</p>
                <div className="flex gap-2">
                  <select
                    value={txnForm.entryType}
                    onChange={(e) => setTxnForm({ ...txnForm, entryType: e.target.value })}
                    className="px-2 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                  >
                    <option value="PAYMENT">Payment</option>
                    <option value="CHARGE">Charge</option>
                  </select>
                  <Input
                    type="number"
                    value={txnForm.amount}
                    onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                    placeholder="Amount"
                  />
                  <Input
                    value={txnForm.narration}
                    onChange={(e) => setTxnForm({ ...txnForm, narration: e.target.value })}
                    placeholder="Narration"
                  />
                  <Button
                    onClick={() => txnMutation.mutate()}
                    disabled={!Number(txnForm.amount) || txnMutation.isPending}
                  >
                    {txnMutation.isPending ? '…' : 'Save'}
                  </Button>
                </div>
              </div>

              <ReportTable
                headers={[
                  { label: 'Date', align: 'center' },
                  { label: 'Type', align: 'center' },
                  { label: 'Narration' },
                  { label: 'Amount', align: 'right' },
                  { label: 'Balance', align: 'right' },
                ]}
                isEmpty={!(agentLedger?.data || []).length}
                empty="No transactions yet."
              >
                {(agentLedger?.data || []).map((e: any) => (
                  <tr key={e._id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-4 text-center text-slate-400">
                      {new Date(e.entryDate).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-4 text-center">
                      <Badge variant={e.entryType === 'CHARGE' ? 'warning' : 'success'}>{e.entryType}</Badge>
                    </td>
                    <td className="py-2 px-4 text-slate-300">{e.narration}</td>
                    <td className="py-2 px-4 text-right text-slate-200">{money(e.amount)}</td>
                    <td className="py-2 px-4 text-right font-semibold text-white">{money(e.balanceAfter)}</td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
