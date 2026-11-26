import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Clock,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Landmark,
  Layers,
  Loader2,
  Printer,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react';
import { cashierAPI } from '../../../utils/api';

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const formatDate = (value) => (value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-');
const formatWaktu = (value) => (value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '-');
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const KPI_GRAD = {
  emerald: 'from-emerald-600 to-teal-500',
  rose: 'from-rose-600 to-pink-600',
  blue: 'from-blue-600 to-indigo-600',
  violet: 'from-violet-600 to-purple-600',
};

const KpiCard = ({ grad, icon: Icon, watermark: WIcon, value, label, sub, delay = 0 }) => (
  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
    className={`relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 text-left text-white shadow-lg`}>
    <WIcon className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 rotate-12 opacity-15" />
    <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 ring-1 ring-inset ring-white/30 backdrop-blur-sm"><Icon className="h-6 w-6" /></div>
    <p className="relative mt-3 text-[26px] font-black leading-none tracking-tight">{value}</p>
    <p className="relative mt-1.5 text-[11px] font-black uppercase tracking-widest text-white/85">{label}</p>
    {sub && <p className="relative mt-0.5 text-[11px] font-medium text-white/75">{sub}</p>}
  </motion.div>
);

const SUB_TABS = [
  { id: 'buku_kas', label: 'Buku Kas Umum', icon: BookOpen },
  { id: 'rekap', label: 'Rekap per Pos & Rekonsiliasi', icon: Layers },
  { id: 'bulanan', label: 'Laporan Bulanan & Tutup Buku', icon: CalendarDays },
];

const PERIODE_OPTIONS = [
  { value: 'current_date', label: 'Hari Ini' },
  { value: 'current_week', label: 'Minggu Ini' },
  { value: 'current_month', label: 'Bulan Ini' },
  { value: 'current_year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Rentang Kustom' },
];

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const sourceBadge = (source) => {
  const map = {
    cashier: 'bg-blue-50 text-blue-700 ring-blue-200',
    petty_cash: 'bg-amber-50 text-amber-700 ring-amber-200',
    cash_book: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  };
  return map[source] || 'bg-slate-50 text-slate-600 ring-slate-200';
};

export default function CashierLaporanRekapitulasi({ subTab = 'buku_kas', setSubTab, user, goToGroup, clock }) {
  const [identity, setIdentity] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Periode bersama untuk KPI + Buku Kas Umum + Rekap.
  const [finFilter, setFinFilter] = useState({ periode: 'current_month', bulan: thisMonth(), tahun: today().slice(0, 4), date_from: today(), date_to: today() });
  const [finApplied, setFinApplied] = useState({ periode: 'current_month', bulan: thisMonth(), tahun: today().slice(0, 4), date_from: today(), date_to: today() });

  // ── Sub-Tab 1: Buku Kas Umum ──
  const [cb, setCb] = useState([]);
  const [cbRingkas, setCbRingkas] = useState(null);
  const [rekapKategori, setRekapKategori] = useState({ income: [], expense: [] });
  const [cbLoading, setCbLoading] = useState(false);
  const [cbFilter, setCbFilter] = useState({ type: '', category: '', source: '', recorded_by: '', q: '' });
  const [cbTotal, setCbTotal] = useState(0);
  const [petugasOptions, setPetugasOptions] = useState([]);

  // ── Sub-Tab 2: Rekap & Rekonsiliasi ──
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // ── Sub-Tab 3: Laporan Bulanan & Tutup Buku ──
  const [monthly, setMonthly] = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [genForm, setGenForm] = useState({ bulan: String(new Date().getMonth() + 1).padStart(2, '0'), tahun: today().slice(0, 4), format: 'excel' });
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  const buildPeriodParams = useCallback((filter) => {
    const params = { periode: filter.periode, bulan: filter.bulan, tahun: filter.tahun };
    if (filter.periode === 'custom') { params.date_from = filter.date_from; params.date_to = filter.date_to; }
    return params;
  }, []);

  const refreshIdentity = useCallback(async () => {
    try {
      const res = await cashierAPI.getDashboard();
      const data = res?.data?.data;
      if (data) { setIdentity(data.identity || null); }
    } catch (e) { console.error(e); }
  }, []);

  const loadCashBook = useCallback(async (period = finApplied, filter = cbFilter) => {
    setCbLoading(true);
    try {
      const params = { ...buildPeriodParams(period), per_page: 200 };
      if (filter.type) params.type = filter.type;
      if (filter.category) params.category = filter.category;
      if (filter.source) params.source = filter.source;
      if (filter.recorded_by) params.recorded_by = filter.recorded_by;
      if (filter.q) params.q = filter.q;
      const res = await cashierAPI.getCashBook(params);
      const data = res.data.data || {};
      setCb(data.entries || []);
      setCbRingkas(data.ringkasan || null);
      setCbTotal(data.pagination?.total || 0);
      const income = data.pemasukan_per_kategori || [];
      const expense = data.pengeluaran_per_kategori || [];
      const merged = new Map();
      income.forEach((r) => merged.set(r.category, { category: r.category, masuk: Number(r.total || 0), keluar: 0, jumlah: Number(r.jumlah || 0) }));
      expense.forEach((r) => {
        const cur = merged.get(r.category) || { category: r.category, masuk: 0, keluar: 0, jumlah: 0 };
        cur.keluar = Number(r.total || 0);
        cur.jumlah += Number(r.jumlah || 0);
        merged.set(r.category, cur);
      });
      setRekapKategori([...merged.values()].sort((a, b) => (b.masuk + b.keluar) - (a.masuk + a.keluar)));
    } catch (e) { console.error(e); notify('Buku kas umum gagal dimuat.', 'error'); }
    finally { setCbLoading(false); }
  }, [finApplied, cbFilter, buildPeriodParams, notify]);

  const loadReports = useCallback(async (period = finApplied) => {
    setReportLoading(true);
    try {
      const res = await cashierAPI.getReports(buildPeriodParams(period));
      const data = res.data.data || null;
      setReport(data);
      if (data?.per_petugas) setPetugasOptions(data.per_petugas.map((p) => ({ id: p.petugas_id, nama: p.nama })));
    } catch (e) { console.error(e); notify('Rekap & rekonsiliasi gagal dimuat.', 'error'); }
    finally { setReportLoading(false); }
  }, [finApplied, buildPeriodParams, notify]);

  const loadMonthly = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const res = await cashierAPI.getMonthlyReports();
      setMonthly(res.data.data || []);
    } catch (e) { console.error(e); notify('Arsip laporan bulanan gagal dimuat.', 'error'); }
    finally { setMonthlyLoading(false); }
  }, []);

  const loadPreview = useCallback(async (bulan, tahun) => {
    const b = Number(bulan), y = Number(tahun);
    if (!b || !y) { setPreview(null); return; }
    const lastDay = new Date(y, b, 0).getDate();
    const date_from = `${y}-${String(b).padStart(2, '0')}-01`;
    const date_to = `${y}-${String(b).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setPreviewLoading(true);
    try {
      const res = await cashierAPI.getCashBook({ periode: 'custom', date_from, date_to, per_page: 1 });
      const r = res.data.data?.ringkasan || null;
      setPreview(r ? { ...r, date_from, date_to } : null);
    } catch (e) { console.error(e); setPreview(null); }
    finally { setPreviewLoading(false); }
  }, []);

  // Mount: identitas + buku kas (KPI) + petugas options (via reports).
  useEffect(() => {
    refreshIdentity();
    loadCashBook(finApplied, cbFilter);
    loadReports(finApplied);
    // eslint-disable-next-line
  }, []);

  // Polling senyap 18 detik + fokus jendela: refresh tanpa reset state saat gagal.
  useEffect(() => {
    const silentRefresh = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      await refreshIdentity();
      await loadCashBook(finApplied, cbFilter);
      if (subTab === 'rekap') await loadReports(finApplied);
      if (subTab === 'bulanan') await loadMonthly();
    };
    // Sinkron langsung: mount + fokus tab + pindah sub-tab + setelah aksi. Tanpa polling berkala.
    const onFocus = () => silentRefresh();
    const onVisible = () => { if (!document.hidden) silentRefresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisible); if (toastTimer.current) window.clearTimeout(toastTimer.current); };
    // eslint-disable-next-line
  }, [finApplied, cbFilter, subTab]);

  // Muat data saat berpindah sub-tab (agar selalu segar & sesuai konteks tab).
  useEffect(() => {
    if (subTab === 'rekap') loadReports(finApplied);
    if (subTab === 'bulanan') { loadMonthly(); loadPreview(genForm.bulan, genForm.tahun); }
    // eslint-disable-next-line
  }, [subTab]);

  // Segarkan pratinjau tutup buku saat bulan/tahun dipilih.
  useEffect(() => {
    if (subTab !== 'bulanan') return;
    const t = window.setTimeout(() => loadPreview(genForm.bulan, genForm.tahun), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line
  }, [genForm.bulan, genForm.tahun, subTab]);

  const applyPeriod = () => { setFinApplied(finFilter); loadCashBook(finFilter, cbFilter); loadReports(finFilter); };
  const resetPeriod = () => { const r = { periode: 'current_month', bulan: thisMonth(), tahun: today().slice(0, 4), date_from: today(), date_to: today() }; setFinFilter(r); setFinApplied(r); loadCashBook(r, cbFilter); loadReports(r); };
  const applyCbFilter = () => loadCashBook(finApplied, cbFilter);
  const resetCbFilter = () => { const r = { type: '', category: '', source: '', recorded_by: '', q: '' }; setCbFilter(r); loadCashBook(finApplied, r); };

  const exportCashBook = async () => {
    try {
      const params = { ...buildPeriodParams(finApplied) };
      if (cbFilter.type) params.type = cbFilter.type;
      if (cbFilter.category) params.category = cbFilter.category;
      if (cbFilter.source) params.source = cbFilter.source;
      if (cbFilter.recorded_by) params.recorded_by = cbFilter.recorded_by;
      if (cbFilter.q) params.q = cbFilter.q;
      const res = await cashierAPI.exportCashBook(params);
      triggerDownload(res.data, `buku-kas-umum-${today()}.xlsx`);
      notify('Buku kas umum diekspor ke Excel.');
    } catch (e) { console.error(e); notify('Ekspor buku kas gagal.', 'error'); }
  };

  const exportRekap = async () => {
    try {
      const res = await cashierAPI.exportFinancialReport(buildPeriodParams(finApplied));
      triggerDownload(res.data, `rekapitulasi-keuangan-${today()}.xlsx`);
      notify('Rekapitulasi diekspor ke Excel.');
    } catch (e) { console.error(e); notify('Ekspor rekap gagal.', 'error'); }
  };

  const generateMonthly = async (format) => {
    setGenerating(true);
    try {
      const res = await cashierAPI.generateMonthlyReport({ bulan: genForm.bulan, tahun: genForm.tahun, format });
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const name = res.headers?.['x-laporan-nama-file'] || `Laporan_Bulanan_${genForm.tahun}-${genForm.bulan}.${ext}`;
      triggerDownload(res.data, name);
      notify(`Laporan ${format === 'excel' ? 'Excel' : 'PDF'} berhasil dibuat & diarsipkan.`);
      await loadMonthly();
    } catch (e) {
      const msg = (e.response?.data && e.response.data.success === false) ? e.response.data.message : 'Gagal membuat laporan bulanan.';
      notify(msg, 'error');
    } finally { setGenerating(false); }
  };

  const downloadMonthly = async (item) => {
    try {
      const res = await cashierAPI.downloadMonthlyReport(item.id);
      triggerDownload(res.data, item.nama_file);
    } catch (e) { console.error(e); notify('File laporan tidak ditemukan di server.', 'error'); }
  };

  const removeMonthly = async () => {
    if (!deleteTarget) return;
    setGenerating(true);
    try {
      await cashierAPI.deleteMonthlyReport(deleteTarget.id);
      notify('Arsip laporan dihapus.');
      setDeleteTarget(null);
      await loadMonthly();
    } catch (e) { console.error(e); notify('Gagal menghapus arsip.', 'error'); }
    finally { setGenerating(false); }
  };

  // Saldo berjalan dihitung kronologis dari saldo awal periode (data nyata, bukan dummy).
  const journalRows = useMemo(() => {
    const opening = Number(cbRingkas?.saldo_awal || 0);
    const asc = [...cb].sort((a, b) => {
      const da = new Date(a.transaction_date || 0) - new Date(b.transaction_date || 0);
      return da !== 0 ? da : (a.id - b.id);
    });
    let running = opening;
    return asc.map((row) => {
      const amount = Number(row.amount || 0);
      const debit = row.type === 'income' ? amount : 0;
      const kredit = row.type === 'expense' ? amount : 0;
      running += debit - kredit;
      return { ...row, debit, kredit, saldo: running };
    });
  }, [cb, cbRingkas]);

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
            <h2 className="text-4xl font-black tracking-tight text-slate-950 xl:text-5xl">Laporan &amp; Rekapitulasi Keuangan</h2>
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
        <KpiCard grad={KPI_GRAD.emerald} icon={ArrowUpRight} watermark={Banknote} value={formatCurrency(cbRingkas?.total_pemasukan || 0)} label="Total Penerimaan Periode" sub="Jurnal kas disetujui" delay={0} />
        <KpiCard grad={KPI_GRAD.rose} icon={ArrowDownLeft} watermark={Receipt} value={formatCurrency(cbRingkas?.total_pengeluaran || 0)} label="Total Pengeluaran Periode" sub="Jurnal kas disetujui" delay={0.075} />
        <KpiCard grad={KPI_GRAD.blue} icon={ArrowLeftRight} watermark={Scale} value={formatCurrency(cbRingkas?.saldo_periode || 0)} label="Surplus / Defisit Periode" sub="Penerimaan dikurangi pengeluaran" delay={0.15} />
        <KpiCard grad={KPI_GRAD.violet} icon={Wallet} watermark={Landmark} value={formatCurrency(cbRingkas?.saldo_kumulatif || 0)} label="Saldo Kumulatif Kas" sub="Akumulasi seluruh periode" delay={0.225} />
      </div>

      {/* SUB-TAB BAR */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {SUB_TABS.map((tab) => { const isActive = subTab === tab.id; const Icon = tab.icon; return (
          <button key={tab.id} type="button" onClick={() => setSubTab(tab.id)}
            className={`flex flex-1 min-w-max items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${isActive ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Icon className="h-4 w-4" />{tab.label}
          </button>
        ); })}
      </div>

      {/* Filter Periode (bersama, tampil di Sub-Tab 1 & 2) */}
      {(subTab === 'buku_kas' || subTab === 'rekap') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div><label className="mb-1 block text-xs font-bold text-slate-600">Periode</label>
              <select value={finFilter.periode} onChange={(e) => setFinFilter((f) => ({ ...f, periode: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                {PERIODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-600">Bulan / Tahun</label>
              {finFilter.periode === 'current_year' ? (
                <input type="number" value={finFilter.tahun} min="2020" max="2099" onChange={(e) => setFinFilter((f) => ({ ...f, tahun: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              ) : finFilter.periode === 'custom' ? (
                <div className="flex gap-2">
                  <input type="date" value={finFilter.date_from} onChange={(e) => setFinFilter((f) => ({ ...f, date_from: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-500" />
                  <input type="date" value={finFilter.date_to} onChange={(e) => setFinFilter((f) => ({ ...f, date_to: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
              ) : (
                <input type="month" value={finFilter.bulan} disabled={finFilter.periode === 'current_date' || finFilter.periode === 'current_week'} onChange={(e) => setFinFilter((f) => ({ ...f, bulan: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50" />
              )}</div>
            <div className="flex items-end gap-2 md:col-span-2">
              <button type="button" onClick={applyPeriod} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700"><RefreshCw className="h-4 w-4" />Terapkan</button>
              <button type="button" onClick={resetPeriod} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 1: BUKU KAS UMUM */}
      {subTab === 'buku_kas' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Jenis</label>
                <select value={cbFilter.type} onChange={(e) => setCbFilter((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua</option><option value="income">Pemasukan (Debit)</option><option value="expense">Pengeluaran (Kredit)</option>
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Sumber</label>
                <select value={cbFilter.source} onChange={(e) => setCbFilter((f) => ({ ...f, source: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua</option><option value="cashier">Pembayaran Siswa</option><option value="petty_cash">Kas Kecil</option><option value="cash_book">Entri Manual Buku Kas</option>
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Petugas Kasir</label>
                <select value={cbFilter.recorded_by} onChange={(e) => setCbFilter((f) => ({ ...f, recorded_by: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua Petugas</option>
                  {petugasOptions.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Cari Uraian / Kategori</label>
                <input value={cbFilter.q} onChange={(e) => setCbFilter((f) => ({ ...f, q: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') applyCbFilter(); }} placeholder="ketik lalu Enter" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
              <div className="flex items-end gap-2">
                <button type="button" onClick={applyCbFilter} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-black text-white hover:bg-slate-900"><Search className="h-4 w-4" />Terapkan</button>
                <button type="button" onClick={resetCbFilter} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-50">Reset</button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5"><span className="font-black text-slate-700">Saldo Awal:</span><span className="font-black text-slate-500">{formatCurrency(cbRingkas?.saldo_awal || 0)}</span></span>
              <span className="flex items-center gap-1.5"><span className="font-black text-emerald-600">Debit {formatCurrency(cbRingkas?.total_pemasukan || 0)}</span></span>
              <span className="flex items-center gap-1.5"><span className="font-black text-rose-600">Kredit {formatCurrency(cbRingkas?.total_pengeluaran || 0)}</span></span>
              <span className="flex items-center gap-1.5"><span className="font-black text-slate-700">Saldo Akhir:</span><span className="font-black text-blue-600">{formatCurrency((Number(cbRingkas?.saldo_awal || 0) + Number(cbRingkas?.saldo_periode || 0)))}</span></span>
            </div>
            <button type="button" onClick={exportCashBook} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100"><Download className="h-4 w-4" />Export Excel (.xlsx)</button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {cbLoading ? <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Memuat buku kas…</p> : journalRows.length === 0 ? (
              <div className="py-14 text-center"><BookOpen className="mx-auto mb-2 h-9 w-9 text-slate-300" /><p className="text-sm font-bold text-slate-500">Tidak ada jurnal kas pada periode &amp; filter ini.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 text-left font-bold">Tanggal</th><th className="px-4 py-3 text-left font-bold">Referensi</th>
                    <th className="px-4 py-3 text-left font-bold">Kategori &amp; Uraian</th><th className="px-4 py-3 text-left font-bold">Sumber</th>
                    <th className="px-4 py-3 text-left font-bold">Petugas</th><th className="px-4 py-3 text-right font-bold">Debit (Masuk)</th>
                    <th className="px-4 py-3 text-right font-bold">Kredit (Keluar)</th><th className="px-4 py-3 text-right font-bold">Saldo Berjalan</th>
                  </tr></thead>
                  <tbody>
                    {journalRows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(row.transaction_date)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">#{row.id}</td>
                        <td className="px-4 py-3"><p className="font-bold text-slate-800">{row.category || '—'}</p><p className="text-[11px] text-slate-400">{row.description}</p></td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${sourceBadge(row.source)}`}>{row.source_label || 'Jurnal kas'}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{row.petugas || '—'}</td>
                        <td className="px-4 py-3 text-right font-black text-emerald-600">{row.debit ? formatCurrency(row.debit) : '—'}</td>
                        <td className="px-4 py-3 text-right font-black text-rose-600">{row.kredit ? formatCurrency(row.kredit) : '—'}</td>
                        <td className="px-4 py-3 text-right font-black tabular-nums text-slate-700">{formatCurrency(row.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-black text-slate-700">
                    <td className="px-4 py-3" colSpan={5}>Total {journalRows.length} baris jurnal</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(cbRingkas?.total_pemasukan || 0)}</td>
                    <td className="px-4 py-3 text-right text-rose-700">{formatCurrency(cbRingkas?.total_pengeluaran || 0)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatCurrency((Number(cbRingkas?.saldo_awal || 0) + Number(cbRingkas?.saldo_periode || 0)))}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
            {cbTotal > journalRows.length && (
              <p className="border-t border-slate-100 bg-amber-50 px-4 py-2 text-[11px] font-bold text-amber-700">Menampilkan {journalRows.length} dari {cbTotal} baris — persempit periode/filter agar saldo berjalan mencakup seluruh jurnal.</p>
            )}
          </div>
        </div>
      )}


      {/* SUB-TAB 2: REKAP & REKONSILIASI */}
      {subTab === 'rekap' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-black text-slate-700">Rekapitulasi per Pos Biaya &amp; Rekonsiliasi Petugas</p>
            <button type="button" onClick={exportRekap} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100"><Download className="h-4 w-4" />Export Rekap (.xlsx)</button>
          </div>

          {reportLoading && <p className="flex items-center gap-2 px-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Memuat rekap…</p>}

          {/* Rekap per kategori/pos */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600"><Layers className="h-4 w-4" />Rekap Pemasukan &amp; Pengeluaran per Pos</p></div>
            {rekapKategori.length === 0 ? (
              <div className="py-12 text-center"><Layers className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-sm font-bold text-slate-500">Belum ada pos transaksi pada periode ini.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 text-left font-bold">Pos / Kategori</th><th className="px-4 py-3 text-right font-bold">Debit (Masuk)</th>
                    <th className="px-4 py-3 text-right font-bold">Kredit (Keluar)</th><th className="px-4 py-3 text-right font-bold">Net</th><th className="px-4 py-3 text-center font-bold">Entri</th>
                  </tr></thead>
                  <tbody>
                    {rekapKategori.map((r) => { const net = r.masuk - r.keluar; return (
                      <tr key={r.category} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-bold text-slate-800">{r.category || 'Tanpa Kategori'}</td>
                        <td className="px-4 py-3 text-right font-black text-emerald-600">{r.masuk ? formatCurrency(r.masuk) : '—'}</td>
                        <td className="px-4 py-3 text-right font-black text-rose-600">{r.keluar ? formatCurrency(r.keluar) : '—'}</td>
                        <td className={`px-4 py-3 text-right font-black ${net >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>{formatCurrency(net)}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{r.jumlah}</td>
                      </tr>
                    ); })}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50 font-black text-slate-700">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(cbRingkas?.total_pemasukan || 0)}</td>
                    <td className="px-4 py-3 text-right text-rose-700">{formatCurrency(cbRingkas?.total_pengeluaran || 0)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(cbRingkas?.saldo_periode || 0)}</td>
                    <td className="px-4 py-3 text-center text-slate-400">—</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Rekonsiliasi per petugas */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600"><Scale className="h-4 w-4" />Rekonsiliasi Setoran per Petugas Kasir (Tutup Loket)</p></div>
            {(!report?.per_petugas || report.per_petugas.length === 0) ? (
              <div className="py-12 text-center"><ShieldCheck className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-sm font-bold text-slate-500">Belum ada setoran tercatat pada periode ini.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 text-left font-bold">Petugas</th><th className="px-4 py-3 text-center font-bold">Transaksi</th>
                    <th className="px-4 py-3 text-right font-bold">Tunai Fisik</th><th className="px-4 py-3 text-right font-bold">Non-Tunai (QRIS/Transfer)</th>
                    <th className="px-4 py-3 text-right font-bold">Total Pemasukan</th><th className="px-4 py-3 text-right font-bold">Pengeluaran</th>
                  </tr></thead>
                  <tbody>
                    {report.per_petugas.map((p) => (
                      <tr key={p.petugas_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-bold text-slate-800">{p.nama}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{p.jumlah_transaksi}</td>
                        <td className="px-4 py-3 text-right font-black text-emerald-600">{formatCurrency(p.pemasukan_tunai || 0)}</td>
                        <td className="px-4 py-3 text-right font-black text-blue-600">{formatCurrency(p.pemasukan_non_tunai || 0)}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-700">{formatCurrency(p.pemasukan || 0)}</td>
                        <td className="px-4 py-3 text-right font-black text-rose-600">{p.pengeluaran ? formatCurrency(p.pengeluaran) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50 font-black text-slate-700">
                    <td className="px-4 py-3">Total Loket</td>
                    <td className="px-4 py-3 text-center text-slate-400">{report.per_petugas.reduce((s, p) => s + (p.jumlah_transaksi || 0), 0)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(report.per_petugas.reduce((s, p) => s + (p.pemasukan_tunai || 0), 0))}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(report.per_petugas.reduce((s, p) => s + (p.pemasukan_non_tunai || 0), 0))}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(report.per_petugas.reduce((s, p) => s + (p.pemasukan || 0), 0))}</td>
                    <td className="px-4 py-3 text-right text-rose-700">{formatCurrency(report.per_petugas.reduce((s, p) => s + (p.pengeluaran || 0), 0))}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}


      {/* SUB-TAB 3: LAPORAN BULANAN & TUTUP BUKU */}
      {subTab === 'bulanan' && (
        <div className="space-y-5">
          {/* Form generate + pratinjau tutup buku */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600"><CalendarDays className="h-4 w-4" />Generate Laporan Bulanan</p>
              <p className="mt-1 text-[11px] font-medium text-slate-500">Laporan resmi terbaca Kepala Sekolah: Saldo Awal → Penerimaan → Pengeluaran → Saldo Akhir.</p>
              <div className="mt-4 space-y-3">
                <div><label className="mb-1 block text-xs font-bold text-slate-600">Bulan</label>
                  <select value={genForm.bulan} onChange={(e) => setGenForm((f) => ({ ...f, bulan: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500">
                    {MONTH_NAMES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                  </select></div>
                <div><label className="mb-1 block text-xs font-bold text-slate-600">Tahun</label>
                  <input type="number" value={genForm.tahun} min="2020" max="2099" onChange={(e) => setGenForm((f) => ({ ...f, tahun: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" /></div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" disabled={generating} onClick={() => generateMonthly('excel')} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500 px-4 py-2 text-sm font-black text-white shadow hover:opacity-95 disabled:opacity-50"><FileSpreadsheet className="h-4 w-4" />Generate Excel</button>
                  <button type="button" disabled={generating} onClick={() => generateMonthly('pdf')} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-rose-600 to-pink-600 px-4 py-2 text-sm font-black text-white shadow hover:opacity-95 disabled:opacity-50"><Printer className="h-4 w-4" />Generate / Cetak PDF</button>
                </div>
                {generating && <p className="flex items-center gap-2 text-[11px] font-bold text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Menyusun laporan…</p>}
              </div>
            </div>

            {/* Pratinjau angka nyata periode terpilih */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600"><Scale className="h-4 w-4" />Pratinjau Tutup Buku · {MONTH_NAMES[Number(genForm.bulan) - 1]} {genForm.tahun}</p>
                {previewLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Awal</p><p className="mt-1 text-base font-black text-slate-700">{formatCurrency(preview?.saldo_awal || 0)}</p></div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Total Penerimaan</p><p className="mt-1 text-base font-black text-emerald-700">{formatCurrency(preview?.total_pemasukan || 0)}</p></div>
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Total Pengeluaran</p><p className="mt-1 text-base font-black text-rose-700">{formatCurrency(preview?.total_pengeluaran || 0)}</p></div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Saldo Akhir</p><p className="mt-1 text-base font-black text-blue-700">{formatCurrency((Number(preview?.saldo_awal || 0) + Number(preview?.saldo_periode || 0)))}</p></div>
              </div>
              <p className="mt-3 text-[11px] font-medium text-slate-400">Angka pratinjau dihitung langsung dari jurnal kas nyata untuk bulan terpilih.</p>
            </div>
          </div>

          {/* Arsip laporan bulanan */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600"><FileText className="h-4 w-4" />Arsip Laporan Bulanan</p>
              <button type="button" onClick={loadMonthly} className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500 hover:text-slate-700"><RefreshCw className="h-3.5 w-3.5" />Muat Ulang</button>
            </div>
            {monthlyLoading ? <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Memuat arsip…</p> : monthly.length === 0 ? (
              <div className="py-14 text-center"><FileText className="mx-auto mb-2 h-9 w-9 text-slate-300" /><p className="text-sm font-bold text-slate-500">Belum ada laporan yang diarsipkan. Gunakan form di atas untuk membuat laporan.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 text-left font-bold">Periode</th><th className="px-4 py-3 text-left font-bold">Format</th>
                    <th className="px-4 py-3 text-left font-bold">Nama File</th><th className="px-4 py-3 text-right font-bold">Ukuran</th>
                    <th className="px-4 py-3 text-left font-bold">Dibuat</th><th className="px-4 py-3 text-left font-bold">Oleh</th><th className="px-4 py-3 text-right font-bold">Aksi</th>
                  </tr></thead>
                  <tbody>
                    {monthly.map((m) => (
                      <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-bold text-slate-800">{m.bulan_label}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${m.format === 'excel' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{m.format === 'excel' ? <FileSpreadsheet className="h-3 w-3" /> : <FileText className="h-3 w-3" />}{m.format_label}</span></td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.nama_file}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{m.ukuran || '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{m.tanggal_generate || '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{m.dibuat_oleh || '—'}</td>
                        <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => downloadMonthly(m)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50" title="Unduh"><Download className="h-3.5 w-3.5" />Unduh</button>
                          <button type="button" onClick={() => setDeleteTarget(m)} className="rounded-lg border border-rose-200 px-2 py-1.5 text-rose-600 hover:bg-rose-50" title="Hapus arsip"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Konfirmasi hapus arsip */}
          <AnimatePresence>
            {deleteTarget && (
              <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteTarget(null)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
                  <div className="flex items-center gap-2 text-rose-600"><AlertTriangle className="h-5 w-5" /><p className="text-sm font-black uppercase tracking-widest">Hapus Arsip Laporan?</p></div>
                  <p className="mt-3 text-sm text-slate-600">Arsip <span className="font-bold">{deleteTarget.nama_file}</span> ({deleteTarget.bulan_label}) akan dihapus permanen dari server. Data transaksi tidak ikut terhapus.</p>
                  <div className="mt-5 flex justify-end gap-3">
                    <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50">Batal</button>
                    <button type="button" disabled={generating} onClick={removeMonthly} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50"><Trash2 className="h-4 w-4" />Hapus</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}

function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(new Blob([blob]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
