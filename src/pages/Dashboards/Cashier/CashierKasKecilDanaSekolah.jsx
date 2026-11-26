import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  Download,
  Eye,
  GraduationCap,
  PiggyBank,
  Landmark,
  Paperclip,
  Pencil,
  PlusCircle,
  Receipt,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { cashierAPI } from '../../../utils/api';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const formatDate = (value) => (value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-');
const formatWaktu = (value) => (value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '-');
const normalizeDigits = (v) => String(v || '').replace(/\D/g, '');
const formatThousands = (v) => { const d = normalizeDigits(v); return d ? new Intl.NumberFormat('id-ID').format(Number(d)) : ''; };
const today = () => new Date().toISOString().slice(0, 10);

const KPI_GRAD = {
  emerald: 'from-emerald-600 to-teal-500',
  amber: 'from-amber-500 to-orange-600',
  blue: 'from-blue-600 to-indigo-600',
  rose: 'from-rose-600 to-pink-600',
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
  { id: 'petty', label: 'Kas Kecil Harian', icon: Wallet },
  { id: 'cashbook', label: 'Dana Non-Siswa & Belanja Program', icon: Landmark },
];

// Kategori operasional kas kecil -> mengisi field description.
const OPERATIONAL_PRESETS = ['ATK & Perlengkapan', 'Konsumsi Rapat', 'Kebersihan & Keamanan', 'Transport & Kurir', 'Cetak & Administrasi', 'Perawatan Ringan', 'Lain-lain'];
const DEFAULT_CB_CATEGORIES = { income: ['Dana BOS', 'BOP', 'Unit Produksi / TEFA', 'Hibah / DUDI'], expense: ['Pengadaan Sarana Prasarana', 'Program Sekolah', 'Kegiatan Siswa', 'Perawatan & Pemeliharaan', 'Operasional Sekolah'] };

const TONE = { emerald: 'from-emerald-600 to-teal-500', amber: 'from-amber-500 to-orange-600', blue: 'from-blue-600 to-indigo-600', rose: 'from-rose-600 to-pink-600' };

function Modal({ onClose, title, icon: Icon, tone = 'blue', children }) {
  // Kunci total scroll + ruler/scrollbar halaman belakang saat modal terbuka (konvensi app: kelas modal-open).
  useBodyScrollLock();

  // Tombol keyboard Esc = batalkan aksi (sama seperti klik X).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal ke <body> + z tinggi agar overlay menutupi seluruh viewport, termasuk navbar fixed top-0 (z-40)
  // yang tadinya menyisakan strip putih di sisi atas.
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/70 backdrop-blur-lg" />
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
        className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl overscroll-contain no-scrollbar" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className={`sticky top-0 z-10 flex items-center justify-between bg-gradient-to-br ${TONE[tone]} px-6 py-4 text-white`}>
          <div className="flex items-center gap-2.5"><Icon className="h-6 w-6" /><span className="text-lg font-black uppercase tracking-widest">{title}</span></div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-wide text-white/70">Esc</span>
            <button type="button" onClick={onClose} className="rounded-full p-1 text-white/80 transition-colors hover:text-rose-300 focus:text-rose-300 active:text-rose-400"><XCircle className="h-6 w-6" /></button>
          </div>
        </div>
        <div className="p-6 text-base">{children}</div>
      </motion.div>
    </div>,
    document.body,
  );
}

export default function CashierKasKecilDanaSekolah({ subTab = 'petty', setSubTab, user, clock }) {
  const [kpi, setKpi] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // ── Kas Kecil ──
  const [petty, setPetty] = useState([]);
  const [pettyBalance, setPettyBalance] = useState(0);
  const [pettyPage, setPettyPage] = useState(1);
  const [pettyPagination, setPettyPagination] = useState(null);
  const [pettyLoading, setPettyLoading] = useState(false);
  const [pettyFilter, setPettyFilter] = useState({ type: '', date_from: '', date_to: '', q: '' });
  const [pettyModal, setPettyModal] = useState(null); // 'income' | 'expense' | {edit}
  const [pettyForm, setPettyForm] = useState({ description: '', amount: '', transaction_date: today(), notes: '', file: null });
  const [pettyDelete, setPettyDelete] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);

  // ── Buku Kas (Dana Non-Siswa & Belanja Program) ──
  const [cb, setCb] = useState([]);
  const [cbRingkas, setCbRingkas] = useState(null);
  const [cbCategories, setCbCategories] = useState(DEFAULT_CB_CATEGORIES);
  const [cbPage, setCbPage] = useState(1);
  const [cbPagination, setCbPagination] = useState(null);
  const [cbLoading, setCbLoading] = useState(false);
  const [cbFilter, setCbFilter] = useState({ type: '', category: '', q: '' });
  const [cbModal, setCbModal] = useState(null); // 'income' | 'expense' | {edit}
  const [cbForm, setCbForm] = useState({ category: '', description: '', amount: '', transaction_date: today(), notes: '' });
  const [cbDelete, setCbDelete] = useState(null);

  const [saving, setSaving] = useState(false);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  const refreshKpi = useCallback(async () => {
    try {
      const res = await cashierAPI.getDashboard();
      const data = res?.data?.data;
      if (data) { setKpi(data.cash_funds_kpi || null); setIdentity(data.identity || null); }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    refreshKpi();
    // Sinkron bersifat langsung: saat mount, saat tab difokuskan/kembali terlihat, dan setelah setiap aksi
    // (lihat pemanggilan refreshKpi/loadX pada CRUD). Tidak ada polling berkala.
    const onFocus = () => refreshKpi();
    const onVisible = () => { if (!document.hidden) refreshKpi(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisible); if (toastTimer.current) window.clearTimeout(toastTimer.current); };
  }, [refreshKpi]);

  // ── Kas Kecil loader + CRUD ──
  const loadPetty = useCallback(async (filter = pettyFilter, page = pettyPage) => {
    setPettyLoading(true);
    try {
      const params = { page, per_page: 10 };
      if (filter.type) params.type = filter.type;
      if (filter.date_from) params.date_from = filter.date_from;
      if (filter.date_to) params.date_to = filter.date_to;
      if (filter.q) params.q = filter.q;
      const res = await cashierAPI.getPettyCash(params);
      setPetty(res.data.data?.transactions || []);
      setPettyBalance(res.data.data?.balance ?? 0);
      setPettyPagination(res.data.pagination || null);
    } catch (e) { console.error(e); notify('Data kas kecil gagal dimuat.', 'error'); }
    finally { setPettyLoading(false); }
  }, [pettyFilter, pettyPage, notify]);

  useEffect(() => { if (subTab === 'petty') loadPetty(pettyFilter, 1); /* eslint-disable-next-line */ }, [subTab]);

  const openPetty = (mode) => { setPettyForm({ description: '', amount: '', transaction_date: today(), notes: '', file: null }); setPettyModal(mode); };
  const openPettyEdit = (item) => { setPettyForm({ description: item.description, amount: String(Math.round(Number(item.amount))), transaction_date: item.transaction_date, notes: item.notes || '', file: null }); setPettyModal({ ...item }); };

  const submitPetty = async () => {
    const editing = pettyModal && typeof pettyModal === 'object';
    if (!pettyForm.description.trim()) return notify('Kategori/keterangan wajib diisi.', 'error');
    if (!pettyForm.amount || Number(pettyForm.amount) <= 0) return notify('Nominal harus lebih dari 0.', 'error');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('description', pettyForm.description.trim());
      fd.append('amount', String(Math.round(Number(pettyForm.amount))));
      fd.append('transaction_date', pettyForm.transaction_date);
      fd.append('notes', pettyForm.notes.trim() || '');
      if (!editing) fd.append('type', pettyModal === 'income' ? 'income' : 'expense');
      if (pettyForm.file) fd.append('file', pettyForm.file);
      if (editing) await cashierAPI.updatePettyCash(pettyModal.id, fd);
      else await cashierAPI.createPettyCash(fd);
      notify(editing ? 'Mutasi kas kecil diperbarui.' : 'Mutasi kas kecil tersimpan & tercatat di jurnal.');
      setPettyModal(null);
      await Promise.all([loadPetty(pettyFilter, pettyPage), refreshKpi()]);
    } catch (e) { notify(e.response?.data?.message || 'Gagal menyimpan mutasi.', 'error'); }
    finally { setSaving(false); }
  };

  const deletePetty = async () => {
    if (!pettyDelete) return;
    setSaving(true);
    try {
      await cashierAPI.deletePettyCash(pettyDelete.id);
      notify('Mutasi kas kecil dihapus & jurnal disesuaikan.');
      setPettyDelete(null);
      await Promise.all([loadPetty(pettyFilter, pettyPage), refreshKpi()]);
    } catch (e) { notify(e.response?.data?.message || 'Gagal menghapus.', 'error'); }
    finally { setSaving(false); }
  };

  const exportPetty = async () => {
    try {
      const res = await cashierAPI.exportPettyCash({});
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `kas-kecil-${today()}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      notify('Kas kecil diekspor.');
    } catch (e) { notify('Ekspor gagal.', 'error'); }
  };

  // ── Buku Kas loader + CRUD ──
  const loadCashBook = useCallback(async (filter = cbFilter, page = cbPage) => {
    setCbLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (filter.type) params.type = filter.type;
      if (filter.category) params.category = filter.category;
      if (filter.q) params.q = filter.q;
      const res = await cashierAPI.getCashBook(params);
      const d = res.data.data;
      setCb(d.entries || []);
      setCbRingkas(d.ringkasan || null);
      if (d.kategori_pilihan) setCbCategories({ income: d.kategori_pilihan.pemasukan_non_siswa || [], expense: d.kategori_pilihan.pengeluaran_program || [] });
      setCbPagination(res.data.pagination || null);
    } catch (e) { console.error(e); notify('Buku kas umum gagal dimuat.', 'error'); }
    finally { setCbLoading(false); }
  }, [cbFilter, cbPage, notify]);

  useEffect(() => { if (subTab === 'cashbook') loadCashBook(cbFilter, 1); /* eslint-disable-next-line */ }, [subTab]);

  const openCb = (mode) => { setCbForm({ category: (mode === 'income' ? cbCategories.income[0] : cbCategories.expense[0]) || '', description: '', amount: '', transaction_date: today(), notes: '' }); setCbModal(mode); };
  const openCbEdit = (entry) => { setCbForm({ category: entry.category, description: entry.description, amount: String(Math.round(Number(entry.amount))), transaction_date: entry.transaction_date, notes: '' }); setCbModal({ ...entry }); };

  const submitCb = async () => {
    const editing = cbModal && typeof cbModal === 'object';
    const type = editing ? cbModal.type : cbModal;
    if (!cbForm.category.trim()) return notify('Kategori wajib dipilih.', 'error');
    if (!cbForm.description.trim()) return notify('Uraian wajib diisi.', 'error');
    if (!cbForm.amount || Number(cbForm.amount) <= 0) return notify('Nominal harus lebih dari 0.', 'error');
    setSaving(true);
    try {
      const payload = { type, category: cbForm.category.trim(), description: cbForm.description.trim(), amount: Number(cbForm.amount), transaction_date: cbForm.transaction_date, notes: cbForm.notes.trim() || undefined };
      if (editing) await cashierAPI.updateCashBookEntry(cbModal.id, payload);
      else await cashierAPI.createCashBookEntry(payload);
      notify(editing ? 'Entri buku kas diperbarui.' : 'Entri buku kas tersimpan.');
      setCbModal(null);
      await Promise.all([loadCashBook(cbFilter, cbPage), refreshKpi()]);
    } catch (e) { notify(e.response?.data?.message || 'Gagal menyimpan entri.', 'error'); }
    finally { setSaving(false); }
  };

  const deleteCb = async () => {
    if (!cbDelete) return;
    setSaving(true);
    try {
      await cashierAPI.deleteCashBookEntry(cbDelete.id);
      notify('Entri buku kas dihapus.');
      setCbDelete(null);
      await Promise.all([loadCashBook(cbFilter, cbPage), refreshKpi()]);
    } catch (e) { notify(e.response?.data?.message || 'Gagal menghapus (mungkin entri turunan).', 'error'); }
    finally { setSaving(false); }
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
            <h2 className="text-4xl font-black tracking-tight text-slate-950 xl:text-5xl">Kas Kecil &amp; Dana Sekolah</h2>
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
        <KpiCard grad={KPI_GRAD.emerald} icon={Wallet} watermark={Banknote} value={formatCurrency(kpi?.saldo_kas_kecil || 0)} label="Saldo Kas Kecil Aktif" sub="Akumulasi seluruh mutasi" />
        <KpiCard grad={KPI_GRAD.amber} icon={ArrowDownLeft} watermark={Receipt} value={formatCurrency(kpi?.pengeluaran_kas_kecil_bulan || 0)} label="Pengeluaran Kas Kecil Bulan Ini" sub="Bulan berjalan" delay={0.075} />
        <KpiCard grad={KPI_GRAD.blue} icon={PiggyBank} watermark={Building2} value={formatCurrency(kpi?.penerimaan_dana_non_siswa || 0)} label="Penerimaan Dana Non-Siswa" sub="BOS/BOP/TEFA/Hibah" delay={0.15} />
        <KpiCard grad={KPI_GRAD.rose} icon={ArrowUpRight} watermark={GraduationCap} value={formatCurrency(kpi?.belanja_program || 0)} label="Belanja Program & Pengadaan" sub="Bulan berjalan" delay={0.225} />
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

      {/* SUB-TAB 1: KAS KECIL */}
      {subTab === 'petty' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4 text-emerald-600" /><span className="font-black text-slate-700">Saldo:</span><span className="font-black text-emerald-600">{formatCurrency(pettyBalance)}</span></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openPetty('income')} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 px-4 py-2 text-sm font-black text-white shadow hover:opacity-95"><PlusCircle className="h-4 w-4" />Isi Saldo (Top-Up)</button>
              <button type="button" onClick={() => openPetty('expense')} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2 text-sm font-black text-white shadow hover:opacity-95"><ArrowDownLeft className="h-4 w-4" />Catat Pengeluaran</button>
              <button type="button" onClick={exportPetty} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"><Download className="h-4 w-4" />Export</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Jenis</label>
                <select value={pettyFilter.type} onChange={(e) => setPettyFilter((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500">
                  <option value="">Semua</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option>
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Dari</label><input type="date" value={pettyFilter.date_from} onChange={(e) => setPettyFilter((f) => ({ ...f, date_from: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Sampai</label><input type="date" value={pettyFilter.date_to} onChange={(e) => setPettyFilter((f) => ({ ...f, date_to: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Cari</label><input value={pettyFilter.q} onChange={(e) => setPettyFilter((f) => ({ ...f, q: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { setPettyPage(1); loadPetty(pettyFilter, 1); } }} placeholder="keterangan / kode" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500" /></div>
            </div>
            <div className="mt-3 flex gap-3">
              <button type="button" onClick={() => { setPettyPage(1); loadPetty(pettyFilter, 1); }} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700">Terapkan</button>
              <button type="button" onClick={() => { const r = { type: '', date_from: '', date_to: '', q: '' }; setPettyFilter(r); setPettyPage(1); loadPetty(r, 1); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50">Reset</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {pettyLoading ? <p className="py-10 text-center text-sm text-slate-400">Memuat…</p> : petty.length === 0 ? (
              <div className="py-12 text-center"><Wallet className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-sm font-bold text-slate-500">Belum ada data transaksi untuk ditampilkan.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 text-left font-bold">Tanggal</th><th className="px-4 py-3 text-left font-bold">Kode</th><th className="px-4 py-3 text-left font-bold">Kategori / Keterangan</th>
                    <th className="px-4 py-3 text-right font-bold">Jumlah</th><th className="px-4 py-3 text-right font-bold">Saldo</th><th className="px-4 py-3 text-left font-bold">Petugas</th>
                    <th className="px-4 py-3 text-center font-bold">Bukti</th><th className="px-4 py-3 text-right font-bold">Aksi</th>
                  </tr></thead>
                  <tbody>
                    {petty.map((it) => (
                      <tr key={it.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-slate-600">{formatDate(it.transaction_date)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{it.transaction_code}</td>
                        <td className="px-4 py-3"><p className="font-bold text-slate-800">{it.description}</p>{it.notes && <p className="text-[11px] text-slate-400">{it.notes}</p>}</td>
                        <td className={`px-4 py-3 text-right font-black ${it.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{it.type === 'income' ? '+' : '-'} {formatCurrency(it.amount)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(it.balance_after)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{it.petugas || '-'}</td>
                        <td className="px-4 py-3 text-center">{it.proof_url ? <button type="button" onClick={() => setProofPreview(it)} className="text-blue-600 hover:text-blue-800"><Eye className="mx-auto h-4 w-4" /></button> : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => openPettyEdit(it)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-600 hover:bg-slate-50" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => setPettyDelete(it)} className="rounded-lg border border-rose-200 px-2 py-1.5 text-rose-600 hover:bg-rose-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pettyPagination && pettyPagination.last_page > 1 && (
              <div className="flex items-center justify-center gap-1 border-t border-slate-100 p-3">
                <button type="button" disabled={pettyPage <= 1} onClick={() => { const p = pettyPage - 1; setPettyPage(p); loadPetty(pettyFilter, p); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Sebelumnya</button>
                <span className="px-3 text-xs text-slate-500">Hal {pettyPage} / {pettyPagination.last_page}</span>
                <button type="button" disabled={pettyPage >= pettyPagination.last_page} onClick={() => { const p = pettyPage + 1; setPettyPage(p); loadPetty(pettyFilter, p); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Berikutnya</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BUKU KAS */}
      {subTab === 'cashbook' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5"><ArrowUpRight className="h-4 w-4 text-emerald-600" /><span className="text-slate-500">Masuk:</span><span className="font-black text-emerald-600">{formatCurrency(cbRingkas?.total_pemasukan || 0)}</span></span>
              <span className="flex items-center gap-1.5"><ArrowDownLeft className="h-4 w-4 text-rose-600" /><span className="text-slate-500">Keluar:</span><span className="font-black text-rose-600">{formatCurrency(cbRingkas?.total_pengeluaran || 0)}</span></span>
              <span className="flex items-center gap-1.5"><Landmark className="h-4 w-4 text-blue-600" /><span className="text-slate-500">Saldo kumulatif:</span><span className="font-black text-slate-800">{formatCurrency(cbRingkas?.saldo_kumulatif || 0)}</span></span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => openCb('income')} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-2 text-sm font-black text-white shadow hover:opacity-95"><PlusCircle className="h-4 w-4" />Catat Dana Masuk</button>
              <button type="button" onClick={() => openCb('expense')} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 px-4 py-2 text-sm font-black text-white shadow hover:opacity-95"><ArrowDownLeft className="h-4 w-4" />Catat Belanja Program</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Tipe</label>
                <select value={cbFilter.type} onChange={(e) => setCbFilter((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua</option><option value="income">Masuk</option><option value="expense">Keluar</option>
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Kategori</label>
                <select value={cbFilter.category} onChange={(e) => setCbFilter((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua</option>{[...cbCategories.income, ...cbCategories.expense].map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div className="sm:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-600">Cari</label><input value={cbFilter.q} onChange={(e) => setCbFilter((f) => ({ ...f, q: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { setCbPage(1); loadCashBook(cbFilter, 1); } }} placeholder="uraian / kategori" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
            </div>
            <div className="mt-3 flex gap-3">
              <button type="button" onClick={() => { setCbPage(1); loadCashBook(cbFilter, 1); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">Terapkan</button>
              <button type="button" onClick={() => { const r = { type: '', category: '', q: '' }; setCbFilter(r); setCbPage(1); loadCashBook(r, 1); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50">Reset</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {cbLoading ? <p className="py-10 text-center text-sm text-slate-400">Memuat…</p> : cb.length === 0 ? (
              <div className="py-12 text-center"><Landmark className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-sm font-bold text-slate-500">Belum ada data transaksi untuk ditampilkan.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 text-left font-bold">Tanggal</th><th className="px-4 py-3 text-left font-bold">Uraian</th><th className="px-4 py-3 text-left font-bold">Kategori</th>
                    <th className="px-4 py-3 text-right font-bold">Jumlah</th><th className="px-4 py-3 text-left font-bold">Sumber</th><th className="px-4 py-3 text-left font-bold">Petugas</th><th className="px-4 py-3 text-right font-bold">Aksi</th>
                  </tr></thead>
                  <tbody>
                    {cb.map((e) => (
                      <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-slate-600">{formatDate(e.transaction_date)}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{e.description}</td>
                        <td className="px-4 py-3 text-slate-600">{e.category}</td>
                        <td className={`px-4 py-3 text-right font-black ${e.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{e.type === 'income' ? '+' : '-'} {formatCurrency(e.amount)}</td>
                        <td className="px-4 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${e.editable ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{e.source_label || e.source || 'Jurnal'}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{e.petugas || '-'}</td>
                        <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                          {e.editable ? (<>
                            <button type="button" onClick={() => openCbEdit(e)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-600 hover:bg-slate-50" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => setCbDelete(e)} className="rounded-lg border border-rose-200 px-2 py-1.5 text-rose-600 hover:bg-rose-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>
                          </>) : <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Read-only</span>}
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {cbPagination && cbPagination.last_page > 1 && (
              <div className="flex items-center justify-center gap-1 border-t border-slate-100 p-3">
                <button type="button" disabled={cbPage <= 1} onClick={() => { const p = cbPage - 1; setCbPage(p); loadCashBook(cbFilter, p); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Sebelumnya</button>
                <span className="px-3 text-xs text-slate-500">Hal {cbPage} / {cbPagination.last_page}</span>
                <button type="button" disabled={cbPage >= cbPagination.last_page} onClick={() => { const p = cbPage + 1; setCbPage(p); loadCashBook(cbFilter, p); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Berikutnya</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {pettyModal && (
          <Modal onClose={() => setPettyModal(null)} title={pettyModal === 'income' ? 'Isi Saldo Kas Kecil' : pettyModal === 'expense' ? 'Catat Pengeluaran Kas Kecil' : 'Edit Mutasi Kas Kecil'} icon={Wallet} tone="emerald">
            <div className="space-y-4 text-[15px]">
              <div><label className="mb-1.5 block text-sm font-bold text-slate-600">Kategori Operasional</label>
                <div className="mb-2.5 flex flex-wrap gap-2">{OPERATIONAL_PRESETS.map((p) => <button key={p} type="button" onClick={() => setPettyForm((f) => ({ ...f, description: p }))} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${pettyForm.description === p ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{p}</button>)}</div>
                <input value={pettyForm.description} onChange={(e) => setPettyForm((f) => ({ ...f, description: e.target.value }))} placeholder="Kategori / keterangan singkat" className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-emerald-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-sm font-bold text-slate-600">Nominal (Rp)</label><input value={formatThousands(pettyForm.amount)} onChange={(e) => setPettyForm((f) => ({ ...f, amount: normalizeDigits(e.target.value) }))} placeholder="0" className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-emerald-500" /></div>
                <div><label className="mb-1.5 block text-sm font-bold text-slate-600">Tanggal</label><input type="date" value={pettyForm.transaction_date} onChange={(e) => setPettyForm((f) => ({ ...f, transaction_date: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-emerald-500" /></div>
              </div>
              <div><label className="mb-1.5 block text-sm font-bold text-slate-600">Keterangan</label><input value={pettyForm.notes} onChange={(e) => setPettyForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-emerald-500" /></div>
              <div><label className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-600"><Paperclip className="h-4 w-4" />Bukti Nota (opsional)</label>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className={`min-w-0 flex-1 truncate text-sm ${pettyForm.file ? 'font-bold text-emerald-700' : 'text-slate-400'}`}>{pettyForm.file ? pettyForm.file.name : 'Belum ada file dipilih'}</span>
                  <label htmlFor="buktiNotaInput" className="shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-200">Pilih berkas</label>
                  <input id="buktiNotaInput" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setPettyForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} className="hidden" />
                </div>
              </div>
            </div>
            <div className="mt-6">
              <button type="button" onClick={submitPetty} disabled={saving} className="flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 px-6 py-3 text-[15px] font-black text-white shadow-sm hover:opacity-95 disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan'}</button>
            </div>
          </Modal>
        )}

        {pettyDelete && (
          <Modal onClose={() => setPettyDelete(null)} title="Hapus Mutasi Kas Kecil" icon={Trash2} tone="rose">
            <div className="space-y-2 text-[15px]">
              <p className="text-slate-600">Hapus mutasi <strong>{pettyDelete.transaction_code}</strong> ({pettyDelete.description}) sebesar {formatCurrency(pettyDelete.amount)}?</p>
              <p className="text-sm text-slate-400">Saldo ledger & jurnal kas akan dihitung ulang otomatis.</p>
            </div>
            <div className="mt-6">
              <button type="button" onClick={deletePetty} disabled={saving} className="flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 px-6 py-3 text-[15px] font-black text-white shadow-sm hover:opacity-95 disabled:opacity-60">{saving ? 'Menghapus…' : 'Hapus'}</button>
            </div>
          </Modal>
        )}

        {cbModal && (
          <Modal onClose={() => setCbModal(null)} title={cbModal === 'income' ? 'Catat Dana Masuk Non-Siswa' : cbModal === 'expense' ? 'Catat Belanja Program / Pengadaan' : 'Edit Entri Buku Kas'} icon={Landmark} tone="emerald">
            <div className="space-y-4 text-[15px]">
              <div><label className="mb-1.5 block text-sm font-bold text-slate-600">Kategori</label>
                <select value={cbForm.category} onChange={(e) => setCbForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-blue-500">
                  <option value="">— Pilih Kategori —</option>
                  {(cbModal === 'expense' || (cbModal && typeof cbModal === 'object' && cbModal.type === 'expense') ? cbCategories.expense : cbCategories.income).map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="mb-1.5 block text-sm font-bold text-slate-600">Uraian</label><input value={cbForm.description} onChange={(e) => setCbForm((f) => ({ ...f, description: e.target.value }))} placeholder="mis. Pencairan BOS tahap 2" className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block text-sm font-bold text-slate-600">Nominal (Rp)</label><input value={formatThousands(cbForm.amount)} onChange={(e) => setCbForm((f) => ({ ...f, amount: normalizeDigits(e.target.value) }))} placeholder="0" className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-blue-500" /></div>
                <div><label className="mb-1.5 block text-sm font-bold text-slate-600">Tanggal</label><input type="date" value={cbForm.transaction_date} onChange={(e) => setCbForm((f) => ({ ...f, transaction_date: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-blue-500" /></div>
              </div>
              <div><label className="mb-1.5 block text-sm font-bold text-slate-600">Catatan (opsional)</label><input value={cbForm.notes} onChange={(e) => setCbForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-[15px] outline-none focus:border-blue-500" /></div>
            </div>
            <div className="mt-6">
              <button type="button" onClick={submitCb} disabled={saving} className="flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 px-6 py-3 text-[15px] font-black text-white shadow-sm hover:opacity-95 disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan'}</button>
            </div>
          </Modal>
        )}

        {cbDelete && (
          <Modal onClose={() => setCbDelete(null)} title="Hapus Entri Buku Kas" icon={Trash2} tone="rose">
            <div className="space-y-2 text-[15px]">
              <p className="text-slate-600">Hapus entri <strong>{cbDelete.description}</strong> ({cbDelete.category}) sebesar {formatCurrency(cbDelete.amount)}?</p>
              <p className="text-sm text-slate-400">Hanya entri manual yang bisa dihapus; entri turunan dilindungi.</p>
            </div>
            <div className="mt-6">
              <button type="button" onClick={deleteCb} disabled={saving} className="flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 px-6 py-3 text-[15px] font-black text-white shadow-sm hover:opacity-95 disabled:opacity-60">{saving ? 'Menghapus…' : 'Hapus'}</button>
            </div>
          </Modal>
        )}

        {proofPreview && (
          <Modal onClose={() => setProofPreview(null)} title="Bukti Nota" icon={Paperclip} tone="blue">
            <div className="text-center">
              {/\.(jpg|jpeg|png|webp)$/i.test(proofPreview.proof_name || proofPreview.proof_url || '')
                ? <img src={proofPreview.proof_url} alt="Bukti nota" className="mx-auto max-h-80 rounded-lg border border-slate-200" />
                : <a href={proofPreview.proof_url} target="_blank" rel="noreferrer" className="font-bold text-blue-600 underline">Buka file bukti</a>}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
