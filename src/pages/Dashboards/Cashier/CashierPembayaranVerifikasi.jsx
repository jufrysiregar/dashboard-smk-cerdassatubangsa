import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Clock,
  BadgeDollarSign,
  Banknote,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Eye,
  PlusCircle,
  Printer,
  QrCode,
  Receipt,
  Search,
  ShieldCheck,
  Smartphone,
  GraduationCap,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { cashierAPI } from '../../../utils/api';

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatDate = (value) => (value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-');

const formatWaktu = (value) => (value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '-');

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const formatThousands = (value) => {
  const digits = normalizeDigits(value);
  return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
};

const METHOD_LABEL = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', beasiswa: 'Beasiswa', adjustment: 'Beasiswa' };
const methodLabel = (value) => METHOD_LABEL[value] || String(value || '-');

const today = () => new Date().toISOString().slice(0, 10);

const KPI_GRAD = {
  blue: 'from-blue-600 to-indigo-600',
  emerald: 'from-emerald-600 to-teal-500',
  violet: 'from-violet-600 to-purple-600',
  amber: 'from-amber-500 to-orange-600',
};

const KpiCard = ({ grad, icon: Icon, watermark: WIcon, value, label, sub, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={`relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 text-left text-white shadow-lg`}
  >
    <WIcon className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 rotate-12 opacity-15" />
    <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 ring-1 ring-inset ring-white/30 backdrop-blur-sm">
      <Icon className="h-6 w-6" />
    </div>
    <p className="relative mt-3 text-[26px] font-black leading-none tracking-tight">{value}</p>
    <p className="relative mt-1.5 text-[11px] font-black uppercase tracking-widest text-white/85">{label}</p>
    {sub && <p className="relative mt-0.5 text-[11px] font-medium text-white/75">{sub}</p>}
  </motion.div>
);

const SUB_TABS = [
  { id: 'payments', label: 'Loket Pembayaran Cepat', icon: CreditCard },
  { id: 'verifications', label: 'Verifikasi Pembayaran Online', icon: ClipboardCheck },
  { id: 'history', label: 'Riwayat & Audit Void', icon: Receipt },
];

const BILLING_CATEGORIES = ['SPP', 'Uang Makan / Catering', 'Antar Jemput (Bus Sekolah)', 'Seragam Sekolah', 'Buku Paket & LKS', 'Biaya Ujian / Sertifikasi', 'Denda Keterlambatan', 'Lainnya'];

export default function CashierPembayaranVerifikasi({ subTab = 'payments', setSubTab, user, goToGroup, initialStudentId, clock }) {
  const [kpi, setKpi] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // ── Sub-tab 1: Loket Pembayaran ──
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [loadingBills, setLoadingBills] = useState(false);
  const [selectedBills, setSelectedBills] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [posForm, setPosForm] = useState({ method: 'cash', cashReceived: '', reference: '', paymentDate: today(), notes: '' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [instantBillOpen, setInstantBillOpen] = useState(false);
  const [instantBill, setInstantBill] = useState({ title: 'SPP', category: 'SPP', amount: '', due_date: today() });

  // ── Sub-tab 2: Verifikasi ──
  const [verifFilter, setVerifFilter] = useState({ status: 'proses_verifikasi', date_from: '', date_to: '', q: '' });
  const [verifList, setVerifList] = useState([]);
  const [verifPage, setVerifPage] = useState(1);
  const [verifPagination, setVerifPagination] = useState(null);
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifDetail, setVerifDetail] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [approveAmount, setApproveAmount] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Sub-tab 3: Riwayat & Void ──
  const [histFilter, setHistFilter] = useState({ date_from: today(), date_to: today(), q: '', payment_method: '', recorded_by: '', page: 1, per_page: 12 });
  const [histData, setHistData] = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histDetail, setHistDetail] = useState(null);
  const [voidModal, setVoidModal] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [staffOptions, setStaffOptions] = useState([]);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // ── KPI + auto-sync (silent, tidak reset state saat error) ──
  const refreshKpi = useCallback(async (silent = true) => {
    if (!silent) setSyncing(true);
    try {
      const res = await cashierAPI.getDashboard();
      const data = res?.data?.data;
      if (data) {
        setKpi(data.payment_kpi || null);
        setIdentity(data.identity || null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (!silent) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    refreshKpi(false);
    // Sinkron langsung: mount + fokus tab + setelah aksi. Tanpa polling berkala.
    const onFocus = () => refreshKpi(true);
    const onVisible = () => { if (!document.hidden) refreshKpi(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [refreshKpi]);

  // ── Sub-tab 1: pencarian siswa (debounce) ──
  useEffect(() => {
    if (query.trim() === '') { setStudents([]); return; }
    const id = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await cashierAPI.searchStudents({ q: query, per_page: 12 });
        setStudents(res.data.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setSearching(false);
      }
    }, 320);
    return () => window.clearTimeout(id);
  }, [query]);

  const loadBills = useCallback(async (studentId) => {
    if (!studentId) { setStudentDetail(null); setSelectedBills([]); setAllocations({}); return; }
    setLoadingBills(true);
    try {
      const res = await cashierAPI.getStudentBilling(studentId);
      setStudentDetail(res.data.data);
      const payable = (res.data.data?.bills || []).filter((b) => ['belum_bayar', 'ditolak'].includes(b.status) && Number(b.remaining_amount) > 0);
      setSelectedBills(payable.map((b) => b.id));
      setAllocations(Object.fromEntries(payable.map((b) => [b.id, String(Math.round(Number(b.remaining_amount)))])));
      setPosForm((c) => ({ ...c, cashReceived: String(payable.reduce((s, b) => s + Number(b.remaining_amount), 0)) }));
    } catch (error) {
      console.error(error);
      notify('Data tagihan siswa gagal dimuat.', 'error');
    } finally {
      setLoadingBills(false);
    }
  }, [notify]);

  // Pre-fill dari aksi "Bayar" di menu lain.
  useEffect(() => {
    if (initialStudentId && initialStudentId !== selectedStudentId && subTab === 'payments') {
      setSelectedStudentId(initialStudentId);
      loadBills(initialStudentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStudentId, subTab]);

  const payableBills = useMemo(() => (studentDetail?.bills || []).filter((b) => ['belum_bayar', 'ditolak'].includes(b.status)), [studentDetail]);
  const selectedRows = useMemo(() => payableBills.filter((b) => selectedBills.includes(b.id)), [payableBills, selectedBills]);
  const payableTotal = useMemo(() => selectedRows.reduce((s, b) => s + Number(b.remaining_amount || 0), 0), [selectedRows]);
  const allocatedTotal = useMemo(() => selectedRows.reduce((s, b) => s + Number(allocations[b.id] || 0), 0), [selectedRows, allocations]);
  const cashReceivedNum = Number(posForm.cashReceived || 0);
  const changeAmount = posForm.method === 'cash' ? cashReceivedNum - allocatedTotal : 0;

  const toggleBill = (id, remaining) => {
    setSelectedBills((cur) => {
      if (cur.includes(id)) {
        setAllocations((a) => { const n = { ...a }; delete n[id]; return n; });
        return cur.filter((x) => x !== id);
      }
      setAllocations((a) => ({ ...a, [id]: String(Math.round(Number(remaining))) }));
      return [...cur, id];
    });
  };

  const resetCheckout = () => {
    setQuery(''); setStudents([]); setSelectedStudentId(null); setStudentDetail(null);
    setSelectedBills([]); setAllocations({});
    setPosForm({ method: 'cash', cashReceived: '', reference: '', paymentDate: today(), notes: '' });
  };

  const buildPosPayload = () => {
    const fd = new FormData();
    fd.append('student_id', selectedStudentId);
    selectedRows.forEach((b) => {
      fd.append('billing_ids[]', b.id);
      fd.append(`allocations[${b.id}]`, String(Math.round(Number(allocations[b.id] || 0))));
    });
    fd.append('payment_method', posForm.method);
    fd.append('payment_date', posForm.paymentDate);
    fd.append('input_mode', 'manual');
    const applied = posForm.method === 'cash' ? cashReceivedNum : allocatedTotal;
    fd.append('cash_received', String(Math.round(applied)));
    if (posForm.reference) fd.append('payment_reference', posForm.reference);
    if (posForm.notes) fd.append('notes', posForm.notes);
    fd.append('send_channels[]', 'print');
    return fd;
  };

  const validateCheckout = () => {
    if (!selectedStudentId) return 'Pilih siswa terlebih dahulu.';
    if (selectedRows.length === 0) return 'Pilih minimal satu tagihan.';
    if (selectedRows.some((b) => Number(allocations[b.id] || 0) <= 0)) return 'Nominal per tagihan harus lebih dari 0.';
    if (allocatedTotal > payableTotal + 0.01) return 'Total alokasi melebihi sisa tagihan.';
    if (posForm.method === 'cash' && cashReceivedNum < allocatedTotal) return 'Uang diterima kurang dari total yang dialokasikan.';
    if ((posForm.method === 'qris' || posForm.method === 'transfer') && !posForm.reference.trim()) return 'Isi referensi/No. bukti untuk ' + methodLabel(posForm.method) + '.';
    return null;
  };

  const submitPayment = async () => {
    const err = validateCheckout();
    if (err) return notify(err, 'error');
    setSubmitting(true);
    try {
      const res = await cashierAPI.createPosPayment(buildPosPayload());
      setConfirmOpen(false);
      setReceiptData(res.data.data);
      notify('Pembayaran berhasil disimpan. Kuitansi siap dicetak.');
      await Promise.all([loadBills(selectedStudentId), refreshKpi(true)]);
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.message || 'Pembayaran gagal diproses.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitInstantBill = async () => {
    if (!selectedStudentId) return notify('Pilih siswa terlebih dahulu.', 'error');
    if (!instantBill.amount || Number(instantBill.amount) <= 0) return notify('Isi jumlah tagihan.', 'error');
    if (!instantBill.due_date) return notify('Pilih jatuh tempo.', 'error');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('input_mode', 'manual');
      fd.append('title', instantBill.title || instantBill.category);
      fd.append('category', instantBill.category);
      fd.append('amount', instantBill.amount);
      fd.append('due_date', instantBill.due_date);
      fd.append('target_type', 'student_ids');
      fd.append('student_ids[]', selectedStudentId);
      await cashierAPI.createBillings(fd);
      setInstantBillOpen(false);
      notify('Tagihan mendadak dibuat, siap dibayar.');
      await loadBills(selectedStudentId);
      await refreshKpi(true);
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.message || 'Tagihan gagal dibuat.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = () => {
    if (!receiptData) return;
    const node = document.getElementById('pv-receipt-print');
    if (!node) return;
    const win = window.open('', '_blank', 'width=760,height=900');
    if (!win) return;
    win.document.write(`<html><head><title>${receiptData.receipt_code}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border-bottom:1px solid #cbd5e1;padding:9px;text-align:left}.r{text-align:right}</style></head><body>${node.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  // ── Sub-tab 2: Verifikasi ──
  const loadVerifications = useCallback(async (filter = verifFilter, page = verifPage) => {
    setVerifLoading(true);
    try {
      const params = { per_page: 10, page };
      if (filter.status && filter.status !== 'semua') params.status = filter.status;
      if (filter.date_from) params.date_from = filter.date_from;
      if (filter.date_to) params.date_to = filter.date_to;
      if (filter.q) params.q = filter.q;
      const res = await cashierAPI.getVerifications(params);
      setVerifList(res.data.data || []);
      setVerifPagination(res.data.pagination || null);
    } catch (error) {
      console.error(error);
      notify('Antrean verifikasi gagal dimuat.', 'error');
    } finally {
      setVerifLoading(false);
    }
  }, [verifFilter, verifPage, notify]);

  useEffect(() => {
    if (subTab === 'verifications') loadVerifications(verifFilter, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  const openApprove = (item) => {
    setApproveModal(item);
    setApproveAmount(String(Math.round(Number(item.amount || 0))));
    setApproveNote('');
  };

  const confirmApprove = async () => {
    if (!approveModal) return;
    const amount = Number(approveAmount || 0);
    if (amount <= 0) return notify('Nominal yang disetujui harus lebih dari 0.', 'error');
    setSubmitting(true);
    try {
      await cashierAPI.approveVerification(approveModal.id, { note: approveNote.trim() || undefined, amount });
      notify('Pembayaran online diverifikasi.');
      setApproveModal(null);
      setVerifDetail(null);
      await loadVerifications(verifFilter, verifPage);
      await refreshKpi(true);
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.message || 'Verifikasi gagal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openReject = (item) => { setRejectModal(item); setRejectReason(''); };

  const confirmReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) return notify('Alasan penolakan wajib diisi.', 'error');
    setSubmitting(true);
    try {
      await cashierAPI.rejectVerification(rejectModal.id, { reason: rejectReason.trim() });
      notify('Bukti pembayaran ditolak. Siswa menerima alasan penolakan.');
      setRejectModal(null);
      setVerifDetail(null);
      await loadVerifications(verifFilter, verifPage);
      await refreshKpi(true);
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.message || 'Penolakan gagal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Sub-tab 3: Riwayat & Void ──
  const loadHistory = useCallback(async (filter = histFilter) => {
    setHistLoading(true);
    try {
      const params = {
        date_from: filter.date_from || undefined,
        date_to: filter.date_to || undefined,
        q: filter.q || undefined,
        payment_method: filter.payment_method || undefined,
        recorded_by: filter.recorded_by || undefined,
        page: filter.page || 1,
        per_page: filter.per_page || 12,
      };
      const res = await cashierAPI.getHistory(params);
      setHistData(res.data.data);
      const petugas = res.data.data?.summary?.petugas || [];
      if (petugas.length) {
        setStaffOptions((prev) => (prev.length ? prev : petugas.map((p) => ({ name: p.nama, count: p.jumlah_transaksi }))));
      }
    } catch (error) {
      console.error(error);
      notify('Riwayat transaksi gagal dimuat.', 'error');
    } finally {
      setHistLoading(false);
    }
  }, [histFilter, notify]);

  useEffect(() => {
    if (subTab === 'history') loadHistory(histFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  const openHistoryReceipt = (tx) => {
    setHistDetail(null);
    setReceiptData({
      receipt_code: tx.receipt_code || tx.transaction_code,
      student: tx.student,
      payment_method: tx.payment_method || tx.channel,
      payment_date: tx.payment_date || tx.transaction_date,
      total_amount: tx.receipt_total || tx.amount,
      cash_received: tx.cash_received,
      change_amount: tx.change_amount,
      recorded_by_name: tx.petugas,
      items: [{ id: tx.id, title: tx.billing?.title || tx.title, bill_code: tx.billing?.bill_code || tx.transaction_code, amount: tx.amount, category: tx.category }],
    });
  };

  const submitVoid = async () => {
    if (!voidModal) return;
    if (!voidReason.trim()) return notify('Alasan void wajib diisi.', 'error');
    setSubmitting(true);
    try {
      await cashierAPI.voidTransaction(voidModal.id, { reason: voidReason.trim() });
      notify('Transaksi dibatalkan (void). Jejak audit tersimpan.');
      setVoidModal(null);
      setVoidReason('');
      await loadHistory(histFilter);
      await refreshKpi(true);
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.message || 'Void gagal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}
            className={`fixed bottom-8 right-8 z-[95] max-w-sm rounded-2xl border px-5 py-4 text-sm font-bold shadow-2xl ${toast.type === 'error' ? 'border-rose-200 bg-white text-rose-700' : 'border-emerald-200 bg-white text-emerald-700'}`}>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] border border-red-100 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fef2f2_100%)] p-6 shadow-xl xl:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-700">
              <GraduationCap className="h-3 w-3" /> Portal Cashier &amp; Finance School Center
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-950 xl:text-5xl">Pembayaran &amp; Verifikasi</h2>
          </div>
          <div className="rounded-2xl border border-red-100 bg-white/80 px-4 py-3 shadow-sm lg:shrink-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-red-500">Periode Aktif</p>
            <p className="mt-1 text-[15px] font-black text-slate-900">T.A. {identity?.tahun_ajaran || '—'}</p>
            <p className="mt-0.5 text-[12px] font-medium text-slate-500">
              Semester {identity?.semester || '—'}{clock?.date ? ` · ${clock.day}, ${clock.date}` : ''}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="tabular-nums">{clock?.time || '00:00:00'}</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">WIB</span>
            </p>
          </div>
        </div>
      </section>

      {/* 4 KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard grad={KPI_GRAD.blue} icon={Receipt} watermark={Receipt} value={(kpi?.transaksi_hari_ini ?? 0)} label="Transaksi Hari Ini" sub="Semua metode (sekolah)" />
        <KpiCard grad={KPI_GRAD.emerald} icon={Banknote} watermark={Wallet} value={formatCurrency(kpi?.penerimaan_tunai || 0)} label="Penerimaan Tunai Laci Kas" sub={`${kpi?.tunai_count ?? 0} transaksi tunai`} delay={0.075} />
        <KpiCard grad={KPI_GRAD.violet} icon={Smartphone} watermark={BadgeDollarSign} value={formatCurrency(kpi?.non_tunai || 0)} label="Non-Tunai QRIS & Transfer" sub={`${kpi?.non_tunai_count ?? 0} transaksi`} delay={0.15} />
        <KpiCard grad={KPI_GRAD.amber} icon={ClipboardCheck} watermark={CheckCircle2} value={(kpi?.antrean_verifikasi ?? 0)} label="Antrean Verifikasi Transfer" sub="Bukti bayar menunggu ACC" delay={0.225} />
      </div>

      {/* SUB-TAB BAR */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {SUB_TABS.map((tab) => {
          const isActive = subTab === tab.id;
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" onClick={() => setSubTab(tab.id)}
              className={`flex flex-1 min-w-max items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${isActive ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* ================= SUB-TAB 1: LOKET PEMBAYARAN ================= */}
      {subTab === 'payments' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-700">Cari Siswa (Nama / NISN)</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ketik nama atau NISN siswa..."
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              {query.trim() !== '' && (
                <button onClick={() => { resetCheckout(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><XCircle className="h-4 w-4" /></button>
              )}
            </div>
            {query.trim() !== '' && (
              <div className="mt-3 space-y-2">
                {searching && <p className="text-xs text-slate-400">Mencari…</p>}
                {!searching && students.length === 0 && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">Murid tidak ditemukan. Periksa nama atau NISN.</p>}
                {!searching && students.map((s) => (
                  <button key={s.id} type="button" onClick={() => { setSelectedStudentId(s.id); loadBills(s.id); }}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selectedStudentId === s.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <span className="text-sm text-slate-800"><strong>{s.name}</strong> <span className="text-slate-400">· {s.nisn_nip || s.school_id || '-'}</span></span>
                    <span className="text-xs font-bold text-slate-500">{s.class_name || '-'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStudentId && studentDetail && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-slate-600" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-700">Tagihan Aktif — {studentDetail.student?.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Sisa total: <strong className="text-slate-800">{formatCurrency(payableBills.reduce((s, b) => s + Number(b.remaining_amount || 0), 0))}</strong></span>
                  <button type="button" onClick={() => setInstantBillOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-blue-700 transition hover:bg-blue-100">
                    <PlusCircle className="h-3.5 w-3.5" /> Tagihan &amp; Bayar Instan
                  </button>
                </div>
              </div>

              {loadingBills ? (
                <p className="py-8 text-center text-sm text-slate-400">Memuat tagihan…</p>
              ) : payableBills.length === 0 ? (
                <p className="py-8 text-center text-sm font-bold text-emerald-600">Tidak ada tagihan aktif. Siswa ini lunas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
                        <th className="px-3 py-2 text-left font-bold">Pilih</th>
                        <th className="px-3 py-2 text-left font-bold">Tagihan</th>
                        <th className="px-3 py-2 text-right font-bold">Sisa</th>
                        <th className="px-3 py-2 text-right font-bold">Nominal Bayar (cicilan)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payableBills.map((b) => {
                        const checked = selectedBills.includes(b.id);
                        const subsidized = Number(b.discount_amount || 0) > 0;
                        return (
                          <tr key={b.id} className={`border-b border-slate-50 ${checked ? 'bg-emerald-50/40' : ''}`}>
                            <td className="px-3 py-3">
                              <button type="button" onClick={() => toggleBill(b.id, b.remaining_amount)}
                                className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>
                                {checked && <CheckCircle2 className="h-3.5 w-3.5" />}
                              </button>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-bold text-slate-800">{b.title}</p>
                              <p className="text-[11px] text-slate-400">{b.bill_code}{subsidized ? ` · subsidi ${methodLabel(b.subsidy_type) || b.subsidy_type} ${formatCurrency(b.discount_amount)}` : ''}</p>
                              {subsidized && b.discount_note && <p className="text-[11px] text-amber-600">{b.discount_note}</p>}
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-rose-600">{formatCurrency(b.remaining_amount)}</td>
                            <td className="px-3 py-3 text-right">
                              <input disabled={!checked} value={checked ? formatThousands(allocations[b.id]) : ''}
                                onChange={(e) => setAllocations((a) => ({ ...a, [b.id]: normalizeDigits(e.target.value) }))}
                                placeholder="0" className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-300" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedStudentId && selectedRows.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-700">Metode &amp; Nominal</span>
              </div>
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[['cash', 'Tunai', Banknote], ['qris', 'QRIS', QrCode], ['transfer', 'Transfer', Wallet]].map(([val, label, Icon]) => (
                  <button key={val} type="button" onClick={() => setPosForm((c) => ({ ...c, method: val }))}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-xs font-black uppercase tracking-widest transition ${posForm.method === val ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    <Icon className="h-5 w-5" />{label}
                  </button>
                ))}
              </div>

              {posForm.method === 'cash' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[180px]">
                      <label className="mb-1 block text-xs font-bold text-slate-600">Uang Diterima</label>
                      <input value={formatThousands(posForm.cashReceived)} onChange={(e) => setPosForm((c) => ({ ...c, cashReceived: normalizeDigits(e.target.value) }))} placeholder="0"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                    </div>
                    <button type="button" onClick={() => setPosForm((c) => ({ ...c, cashReceived: String(Math.round(allocatedTotal)) }))}
                      className="rounded-xl border border-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50">Bayar Pas</button>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                    <span className="text-slate-500">Kembalian</span>
                    <span className={`font-black ${changeAmount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(changeAmount)}</span>
                  </div>
                  {changeAmount < 0 && <p className="text-xs font-bold text-rose-600">Uang diterima kurang dari total yang dialokasikan.</p>}
                </div>
              )}

              {posForm.method === 'qris' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white">
                      <QrCode className="h-12 w-12 text-slate-300" />
                    </div>
                    <div className="text-sm text-slate-600">
                      <p className="font-black uppercase tracking-widest text-slate-700">Scan di Tempat</p>
                      <p className="mt-1 text-xs leading-5">Siswa menunjukkan kode QRIS. Petugas memindai lalu mencatat nomor referensi transaksi di bawah.</p>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">No. Referensi QRIS</label>
                    <input value={posForm.reference} onChange={(e) => setPosForm((c) => ({ ...c, reference: e.target.value }))} placeholder="mis. ID transaksi dari aplikasi bank/merchant"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" />
                  </div>
                </div>
              )}

              {posForm.method === 'transfer' && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600">No. Referensi Transfer</label>
                  <input value={posForm.reference} onChange={(e) => setPosForm((c) => ({ ...c, reference: e.target.value }))} placeholder="mis. 8421-9930 / No. bukti transfer"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
                <div className="flex justify-between sm:block"><span className="text-slate-500">Sisa dipilih</span><p className="font-black text-slate-800">{formatCurrency(payableTotal)}</p></div>
                <div className="flex justify-between sm:block"><span className="text-slate-500">Dialokasikan</span><p className="font-black text-slate-800">{formatCurrency(allocatedTotal)}</p></div>
                <div className="flex justify-between sm:block"><span className="text-slate-500">Metode</span><p className="font-black text-slate-800">{methodLabel(posForm.method)}</p></div>
              </div>
            </div>
          )}

          {selectedStudentId && (
            <div className="flex items-center justify-between">
              <button type="button" onClick={resetCheckout} className="rounded-xl bg-slate-500 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-600">Batal</button>
              <button type="button" onClick={() => { const e = validateCheckout(); if (e) return notify(e, 'error'); setConfirmOpen(true); }} disabled={selectedRows.length === 0}
                className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 px-6 py-3 text-sm font-black text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50">
                Proses Bayar {selectedRows.length > 0 ? `(${formatCurrency(allocatedTotal)})` : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= SUB-TAB 2: VERIFIKASI ONLINE ================= */}
      {subTab === 'verifications' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Status</label>
                <select value={verifFilter.status} onChange={(e) => setVerifFilter((f) => ({ ...f, status: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="proses_verifikasi">Menunggu Verifikasi</option>
                  <option value="lunas">Sudah Diverifikasi</option>
                  <option value="ditolak">Ditolak</option>
                  <option value="semua">Semua</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Dari</label>
                <input type="date" value={verifFilter.date_from} onChange={(e) => setVerifFilter((f) => ({ ...f, date_from: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Sampai</label>
                <input type="date" value={verifFilter.date_to} onChange={(e) => setVerifFilter((f) => ({ ...f, date_to: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">Cari</label>
                <input value={verifFilter.q} onChange={(e) => setVerifFilter((f) => ({ ...f, q: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { setVerifPage(1); loadVerifications(verifFilter, 1); } }} placeholder="NISN / nama" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => { setVerifPage(1); loadVerifications(verifFilter, 1); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">Terapkan</button>
              <button type="button" onClick={() => { const r = { status: 'proses_verifikasi', date_from: '', date_to: '', q: '' }; setVerifFilter(r); setVerifPage(1); loadVerifications(r, 1); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50">Reset</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {verifLoading ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat antrean…</p>
            ) : verifList.length === 0 ? (
              <div className="py-12 text-center">
                <ClipboardCheck className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-bold text-slate-500">Belum ada bukti pembayaran untuk ditampilkan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
                      <th className="px-4 py-3 text-left font-bold">Tanggal</th>
                      <th className="px-4 py-3 text-left font-bold">Siswa</th>
                      <th className="px-4 py-3 text-right font-bold">Jumlah</th>
                      <th className="px-4 py-3 text-left font-bold">Metode</th>
                      <th className="px-4 py-3 text-center font-bold">Status</th>
                      <th className="px-4 py-3 text-right font-bold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifList.map((item) => {
                      const waiting = item.status === 'proses_verifikasi';
                      const dot = waiting ? 'text-amber-600 bg-amber-50' : item.status === 'lunas' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50';
                      return (
                        <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="px-4 py-3 text-slate-600">{formatDate(item.submitted_at)}</td>
                          <td className="px-4 py-3"><p className="font-bold text-slate-800">{item.student?.name || '-'}</p><p className="text-[11px] text-slate-400">{item.student?.nisn_nip || item.student?.school_id || '-'} · {item.student?.class_name || '-'}</p></td>
                          <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(item.amount)}</td>
                          <td className="px-4 py-3 text-slate-600">{methodLabel(item.payment_method)}</td>
                          <td className="px-4 py-3 text-center"><span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${dot}`}>{waiting ? 'Menunggu' : item.status === 'lunas' ? 'Selesai' : 'Ditolak'}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              <button type="button" onClick={() => setVerifDetail(item)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-50">Lihat</button>
                              {waiting && (<>
                                <button type="button" onClick={() => openApprove(item)} className="rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500 px-2.5 py-1.5 text-[11px] font-black text-white hover:opacity-95">Setujui</button>
                                <button type="button" onClick={() => openReject(item)} className="rounded-lg bg-gradient-to-br from-rose-600 to-pink-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:opacity-95">Tolak</button>
                              </>)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {verifPagination && verifPagination.last_page > 1 && (
              <div className="flex items-center justify-center gap-1 border-t border-slate-100 p-3">
                <button type="button" disabled={verifPage <= 1} onClick={() => { const p = verifPage - 1; setVerifPage(p); loadVerifications(verifFilter, p); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Sebelumnya</button>
                <span className="px-3 text-xs text-slate-500">Hal {verifPage} / {verifPagination.last_page}</span>
                <button type="button" disabled={verifPage >= verifPagination.last_page} onClick={() => { const p = verifPage + 1; setVerifPage(p); loadVerifications(verifFilter, p); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Berikutnya</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SUB-TAB 3: RIWAYAT & AUDIT VOID ================= */}
      {subTab === 'history' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Dari</label><input type="date" value={histFilter.date_from} onChange={(e) => setHistFilter((f) => ({ ...f, date_from: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Sampai</label><input type="date" value={histFilter.date_to} onChange={(e) => setHistFilter((f) => ({ ...f, date_to: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Petugas</label>
                <select value={histFilter.recorded_by} onChange={(e) => setHistFilter((f) => ({ ...f, recorded_by: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua Petugas</option>
                  {staffOptions.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Metode</label>
                <select value={histFilter.payment_method} onChange={(e) => setHistFilter((f) => ({ ...f, payment_method: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua</option><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="transfer">Transfer</option><option value="beasiswa">Beasiswa</option>
                </select>
              </div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Cari</label><input value={histFilter.q} onChange={(e) => setHistFilter((f) => ({ ...f, q: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') loadHistory({ ...histFilter, page: 1 }); }} placeholder="NISN / nama / kuitansi" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => loadHistory({ ...histFilter, page: 1 })} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">Terapkan</button>
              <button type="button" onClick={() => { const r = { date_from: today(), date_to: today(), q: '', payment_method: '', recorded_by: '', page: 1, per_page: 12 }; setHistFilter(r); loadHistory(r); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50">Reset</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {histLoading ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat riwayat…</p>
            ) : (histData?.records?.length || 0) === 0 ? (
              <div className="py-12 text-center">
                <Receipt className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-bold text-slate-500">Belum ada transaksi untuk filter ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
                      <th className="px-4 py-3 text-left font-bold">Kuitansi</th>
                      <th className="px-4 py-3 text-left font-bold">Tanggal</th>
                      <th className="px-4 py-3 text-left font-bold">Siswa</th>
                      <th className="px-4 py-3 text-right font-bold">Nominal</th>
                      <th className="px-4 py-3 text-left font-bold">Metode</th>
                      <th className="px-4 py-3 text-left font-bold">Petugas</th>
                      <th className="px-4 py-3 text-center font-bold">Status</th>
                      <th className="px-4 py-3 text-right font-bold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histData.records.map((item) => {
                      const st = item.status === 'approved' ? 'text-emerald-700 bg-emerald-50' : item.status === 'void' ? 'text-slate-500 bg-slate-100' : 'text-rose-700 bg-rose-50';
                      return (
                        <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.receipt_code || item.transaction_code}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(item.transaction_date)}</td>
                          <td className="px-4 py-3"><p className="font-bold text-slate-800">{item.student?.name || '-'}</p><p className="text-[11px] text-slate-400">{item.student?.nisn_nip || item.student?.school_id || '-'}</p></td>
                          <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(item.amount)}</td>
                          <td className="px-4 py-3 text-slate-600">{methodLabel(item.payment_method)}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{item.petugas || '-'}</td>
                          <td className="px-4 py-3 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${st}`}>{item.status}</span></td>
                          <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                            <button type="button" onClick={() => setHistDetail(item)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-50">Detail</button>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {histData?.pagination && histData.pagination.last_page > 1 && (
              <div className="flex items-center justify-center gap-1 border-t border-slate-100 p-3">
                <button type="button" disabled={histFilter.page <= 1} onClick={() => { const f = { ...histFilter, page: histFilter.page - 1 }; setHistFilter(f); loadHistory(f); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Sebelumnya</button>
                <span className="px-3 text-xs text-slate-500">Hal {histFilter.page} / {histData.pagination.last_page}</span>
                <button type="button" disabled={histFilter.page >= histData.pagination.last_page} onClick={() => { const f = { ...histFilter, page: histFilter.page + 1 }; setHistFilter(f); loadHistory(f); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Berikutnya</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      <AnimatePresence>
        {confirmOpen && (
          <ModalShell onClose={() => setConfirmOpen(false)} title="Konfirmasi Pembayaran" icon={AlertTriangle} tone="amber">
            <div className="space-y-2 text-sm text-slate-700">
              <Row label="Siswa" value={`${studentDetail?.student?.name || '-'} (${studentDetail?.student?.class_name || '-'})`} />
              <Row label="Tagihan" value={selectedRows.map((b) => b.title).join(', ')} />
              <Row label="Metode" value={methodLabel(posForm.method)} />
              <Row label="Dibayar" value={formatCurrency(posForm.method === 'cash' ? cashReceivedNum : allocatedTotal)} strong />
              {posForm.method === 'cash' && <Row label="Kembalian" value={formatCurrency(changeAmount)} />}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Batal</button>
              <button type="button" onClick={submitPayment} disabled={submitting} className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-black text-white hover:opacity-95 disabled:opacity-60">{submitting ? 'Memproses…' : 'Ya, Proses'}</button>
            </div>
          </ModalShell>
        )}

        {instantBillOpen && (
          <ModalShell onClose={() => setInstantBillOpen(false)} title="Tagihan & Bayar Instan" icon={PlusCircle} tone="blue">
            <div className="space-y-3 text-sm">
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Jenis / Judul</label><input value={instantBill.title} onChange={(e) => setInstantBill((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Kategori</label>
                <select value={instantBill.category} onChange={(e) => setInstantBill((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500">
                  {BILLING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Jumlah</label><input value={formatThousands(instantBill.amount)} onChange={(e) => setInstantBill((f) => ({ ...f, amount: normalizeDigits(e.target.value) }))} placeholder="0" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Jatuh Tempo</label><input type="date" value={instantBill.due_date} onChange={(e) => setInstantBill((f) => ({ ...f, due_date: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" /></div>
              <p className="text-xs text-slate-500">Tagihan mendadak dibuat untuk siswa terpilih, lalu muncul di daftar untuk langsung dibayar.</p>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setInstantBillOpen(false)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Batal</button>
              <button type="button" onClick={submitInstantBill} disabled={submitting} className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:opacity-95 disabled:opacity-60">{submitting ? 'Menyimpan…' : 'Buat Tagihan'}</button>
            </div>
          </ModalShell>
        )}

        {verifDetail && (
          <ModalShell onClose={() => setVerifDetail(null)} title="Detail Bukti Pembayaran" icon={Receipt} tone="blue" wide>
            <div className="space-y-4 text-sm">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Bukti Transfer / QRIS</p>
                {verifDetail.proof_url ? (/\.(jpg|jpeg|png|webp)$/i.test(verifDetail.proof_name || verifDetail.proof_url)
                  ? <img src={verifDetail.proof_url} alt="Bukti pembayaran" className="mx-auto max-h-80 rounded-lg border border-slate-200 bg-black" />
                  : <a href={verifDetail.proof_url} target="_blank" rel="noreferrer" className="font-bold text-blue-600 underline">Buka file bukti</a>)
                  : <p className="text-slate-400">Tidak ada bukti terunggah.</p>}
              </div>
              <Row label="Siswa" value={`${verifDetail.student?.name || '-'} · ${verifDetail.student?.class_name || '-'}`} />
              <Row label="Jumlah" value={formatCurrency(verifDetail.amount)} strong />
              <Row label="Metode" value={methodLabel(verifDetail.payment_method)} />
              {verifDetail.student_note && <p className="rounded-lg bg-amber-50 p-3 text-xs italic text-amber-800">Catatan siswa: “{verifDetail.student_note}”</p>}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setVerifDetail(null)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Tutup</button>
              {verifDetail.status === 'proses_verifikasi' && (
                <button type="button" onClick={() => openApprove(verifDetail)} className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-black text-white hover:opacity-95">Setujui</button>
              )}
            </div>
          </ModalShell>
        )}

        {approveModal && (
          <ModalShell onClose={() => setApproveModal(null)} title="Setujui Pembayaran" icon={CheckCircle2} tone="emerald">
            <div className="space-y-3 text-sm">
              <Row label="Siswa" value={approveModal.student?.name || '-'} />
              <Row label="Klaim siswa" value={formatCurrency(approveModal.amount)} />
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Nominal disetujui (lunas/parsial)</label>
                <input value={formatThousands(approveAmount)} onChange={(e) => setApproveAmount(normalizeDigits(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-500" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Catatan (opsional)</label>
                <input value={approveNote} onChange={(e) => setApproveNote(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-500" /></div>
              <p className="text-xs text-slate-500">Jika nominal &lt; sisa tagihan, pembayaran dicatat sebagian.</p>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setApproveModal(null)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Batal</button>
              <button type="button" onClick={confirmApprove} disabled={submitting} className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-black text-white hover:opacity-95 disabled:opacity-60">{submitting ? 'Menyimpan…' : 'Setujui'}</button>
            </div>
          </ModalShell>
        )}

        {rejectModal && (
          <ModalShell onClose={() => setRejectModal(null)} title="Tolak Pembayaran" icon={XCircle} tone="rose">
            <div className="space-y-3 text-sm">
              <Row label="Siswa" value={rejectModal.student?.name || '-'} />
              <Row label="Jumlah" value={formatCurrency(rejectModal.amount)} />
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Alasan penolakan (wajib)</label>
                <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="mis. Nominal bukti tidak sesuai tagihan" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-500" /></div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setRejectModal(null)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Batal</button>
              <button type="button" onClick={confirmReject} disabled={submitting || !rejectReason.trim()} className="rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 px-5 py-2.5 text-sm font-black text-white hover:opacity-95 disabled:opacity-60">{submitting ? 'Menyimpan…' : 'Tolak'}</button>
            </div>
          </ModalShell>
        )}

        {histDetail && (
          <ModalShell onClose={() => setHistDetail(null)} title="Detail Transaksi" icon={Receipt} tone="blue">
            <div className="space-y-2 text-sm">
              <Row label="Kuitansi" value={histDetail.receipt_code || histDetail.transaction_code} />
              <Row label="Tanggal" value={formatWaktu(histDetail.transaction_date)} />
              <Row label="Siswa" value={histDetail.student?.name || '-'} />
              <Row label="Nominal" value={formatCurrency(histDetail.amount)} strong />
              <Row label="Metode" value={methodLabel(histDetail.payment_method)} />
              <Row label="Petugas" value={histDetail.petugas || '-'} />
              <Row label="Status" value={histDetail.status} />
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setHistDetail(null)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Tutup</button>
              <button type="button" onClick={() => openHistoryReceipt(histDetail)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700"><Printer className="h-4 w-4" />Cetak Ulang</button>
              {histDetail.status === 'approved' && <button type="button" onClick={() => { setVoidModal(histDetail); setVoidReason(''); }} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 px-5 py-2.5 text-sm font-black text-white hover:opacity-95"><Ban className="h-4 w-4" />Void</button>}
            </div>
          </ModalShell>
        )}

        {voidModal && (
          <ModalShell onClose={() => setVoidModal(null)} title="Void Transaksi" icon={Ban} tone="rose">
            <div className="space-y-3 text-sm">
              <p className="text-slate-500">Pembatalan tidak menghapus data — status jadi <strong>void</strong>, saldo disesuaikan, jejak audit tersimpan.</p>
              <Row label="Kuitansi" value={voidModal.receipt_code || voidModal.transaction_code} />
              <Row label="Nominal" value={formatCurrency(voidModal.amount)} />
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Alasan void (wajib)</label>
                <textarea rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="mis. Salah input nominal" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-500" /></div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setVoidModal(null)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Batal</button>
              <button type="button" onClick={submitVoid} disabled={submitting || !voidReason.trim()} className="rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 px-5 py-2.5 text-sm font-black text-white hover:opacity-95 disabled:opacity-60">{submitting ? 'Memproses…' : 'Konfirmasi Void'}</button>
            </div>
          </ModalShell>
        )}

        {receiptData && (
          <ModalShell onClose={() => setReceiptData(null)} title="Kuitansi Gabungan" icon={Receipt} tone="emerald" wide>
            <div id="pv-receipt-print">
              <h1 className="text-xl font-black text-slate-900">Bukti Pembayaran Resmi</h1>
              <p className="mt-1 text-sm text-slate-500">No. Kuitansi: <strong className="text-slate-800">{receiptData.receipt_code}</strong></p>
              <p className="text-sm text-slate-500">Siswa: {receiptData.student?.name || '-'} / {receiptData.student?.school_id || '-'}</p>
              <p className="text-sm text-slate-500">Tanggal: {formatDate(receiptData.payment_date)} · Metode: {methodLabel(receiptData.payment_method)}</p>
              <table className="mt-4 w-full text-sm">
                <thead><tr className="border-b border-slate-300 text-left text-slate-500"><th className="py-2">Tagihan</th><th className="py-2">Kode</th><th className="py-2 text-right">Nominal</th></tr></thead>
                <tbody>{(receiptData.items || []).map((it) => <tr key={it.id} className="border-b border-slate-100"><td className="py-2">{it.title}</td><td className="py-2 text-slate-500">{it.bill_code}</td><td className="py-2 text-right font-black">{formatCurrency(it.amount)}</td></tr>)}</tbody>
              </table>
              <div className="mt-3 space-y-1 text-sm">
                <p>Total: <span className="font-black">{formatCurrency(receiptData.total_amount)}</span></p>
                {receiptData.payment_method === 'cash' && <p>Diterima: <span className="font-black">{formatCurrency(receiptData.cash_received)}</span> · Kembalian: <span className="font-black">{formatCurrency(receiptData.change_amount)}</span></p>}
                <p>Petugas: <span className="font-black">{receiptData.recorded_by_name || identity?.petugas || user?.name || '-'}</span></p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setReceiptData(null)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Tutup</button>
              <button type="button" onClick={printReceipt} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700"><Printer className="h-4 w-4" />Cetak Kuitansi</button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}

const TONE = {
  blue: 'from-blue-600 to-indigo-600',
  emerald: 'from-emerald-600 to-teal-500',
  amber: 'from-amber-500 to-orange-600',
  rose: 'from-rose-600 to-pink-600',
};

function ModalShell({ onClose, title, icon: Icon, tone = 'blue', wide = false, children }) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
        className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-hidden rounded-3xl bg-white shadow-2xl`} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className={`flex items-center justify-between bg-gradient-to-br ${TONE[tone]} px-5 py-4 text-white`}>
          <div className="flex items-center gap-2"><Icon className="h-5 w-5" /><span className="text-sm font-black uppercase tracking-widest">{title}</span></div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/20 p-1.5 hover:bg-white/30"><XCircle className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </div>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-50 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${strong ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>{value}</span>
    </div>
  );
}
