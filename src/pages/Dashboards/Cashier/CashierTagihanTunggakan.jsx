import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Clock,
  BadgePercent,
  Ban,
  Banknote,
  CalendarDays,
  ClipboardList,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Pencil,
  Receipt,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { cashierAPI } from '../../../utils/api';

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const formatDate = (value) => (value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-');
const normalizeDigits = (v) => String(v || '').replace(/\D/g, '');
const formatThousands = (v) => { const d = normalizeDigits(v); return d ? new Intl.NumberFormat('id-ID').format(Number(d)) : ''; };
const today = () => new Date().toISOString().slice(0, 10);

const SUBSIDY_LABEL = {
  reguler: 'Reguler', promo_ppdb: 'Promo PPDB', bundle_spp: 'Bundling SPP',
  beasiswa_penuh: 'Beasiswa Penuh', beasiswa_parsial: 'Beasiswa Parsial', subsidi_program: 'Subsidi Program',
};
const subsidyLabel = (v) => SUBSIDY_LABEL[v] || v || 'Reguler';

const STATUS_LABEL = {
  belum_bayar: 'Belum Bayar', proses_verifikasi: 'Diverifikasi', lunas: 'Lunas', ditolak: 'Ditolak', dibatalkan: 'Dibatalkan',
};

const QUICK_PRESETS = [
  { label: 'SPP Bulanan', category: 'SPP', title: 'SPP' },
  { label: 'Uang Pangkal PPDB', category: 'Uang Gedung (Uang Pangkal)', title: 'Uang Pangkal' },
  { label: 'Dana Praktik Lab', category: 'Dana Praktik Lab', title: 'Praktik Laboratorium' },
  { label: 'Biaya PKL XI', category: 'Biaya PKL', title: 'Biaya Praktik Kerja Lapangan' },
  { label: 'Biaya UKK XII', category: 'Biaya UKK', title: 'Biaya Uji Kompetensi Keahlian' },
  { label: 'Seragam & Wearpack', category: 'Seragam Sekolah', title: 'Seragam & Wearpack' },
  { label: 'Kegiatan Khusus', category: 'Ekstrakurikuler Khusus', title: 'Kegiatan Khusus' },
];

const TARGET_TYPES = [
  { value: 'student_ids', label: 'Perorangan', icon: Users },
  { value: 'class_name', label: 'Per Kelas', icon: Layers },
  { value: 'grade_level', label: 'Per Tingkat', icon: GraduationCap },
  { value: 'jurusan', label: 'Per Jurusan', icon: ClipboardList },
  { value: 'excel', label: 'Import Excel', icon: Upload },
];

const KPI_GRAD = {
  blue: 'from-blue-600 to-indigo-600',
  rose: 'from-rose-600 to-pink-600',
  violet: 'from-violet-600 to-purple-600',
  emerald: 'from-emerald-600 to-teal-500',
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
  { id: 'generate', label: 'Generate Tagihan & Paket Cepat', icon: Layers },
  { id: 'list', label: 'Daftar Seluruh Tagihan Siswa', icon: Receipt },
  { id: 'arrears', label: 'Monitoring Tunggakan Siswa', icon: AlertTriangle },
];

const BILLING_STATUS_OPTIONS = ['belum_bayar', 'proses_verifikasi', 'lunas', 'ditolak', 'dibatalkan'];

export default function CashierTagihanTunggakan({ subTab = 'generate', setSubTab, user, goToGroup, clock }) {
  const [kpi, setKpi] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [options, setOptions] = useState({ kelas: [], grades: [], jurusans: [], subsidy_types: [], categories: [] });
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // ── Sub-tab 1: Generate ──
  const [form, setForm] = useState({ title: '', category: 'SPP', amount: '', due_date: today(), subsidy_type: 'reguler', discount_mode: 'percent', discount_value: '', discount_note: '' });
  const [targetType, setTargetType] = useState('class_name');
  const [targetValue, setTargetValue] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [pickedStudent, setPickedStudent] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);

  // ── Sub-tab 2: Daftar tagihan ──
  const [listFilter, setListFilter] = useState({ class_name: '', category: '', subsidy_type: '', status: '', q: '', page: 1, per_page: 20 });
  const [billings, setBillings] = useState([]);
  const [listPagination, setListPagination] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', amount: '', due_date: '', subsidy_type: 'reguler', discount_mode: 'percent', discount_value: '', discount_note: '' });
  const [deleteModal, setDeleteModal] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── Sub-tab 3: Tunggakan ──
  const [arrFilter, setArrFilter] = useState({ class_name: '', sort_by: 'tunggakan DESC', q: '', page: 1 });
  const [arrears, setArrears] = useState(null);
  const [arrPagination, setArrPagination] = useState(null);
  const [arrLoading, setArrLoading] = useState(false);
  const [reminderModal, setReminderModal] = useState(null);
  const [reminderMessage, setReminderMessage] = useState('');

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  // ── KPI + options + auto-sync ──
  const refreshKpi = useCallback(async () => {
    try {
      const res = await cashierAPI.getDashboard();
      const data = res?.data?.data;
      if (data) { setKpi(data.billing_kpi || null); setIdentity(data.identity || null); }
    } catch (error) { console.error(error); }
  }, []);

  useEffect(() => {
    refreshKpi();
    cashierAPI.getBillingOptions().then((res) => setOptions(res.data.data || options)).catch((e) => console.error(e));
    // Sinkron langsung: mount + fokus tab + setelah aksi CRUD. Tanpa polling berkala.
    const onFocus = () => refreshKpi();
    const onVisible = () => { if (!document.hidden) refreshKpi(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [refreshKpi]);

  // ── Sub-tab 1: cari siswa (perorangan) ──
  useEffect(() => {
    if (targetType !== 'student_ids' || studentQuery.trim() === '') { setStudentResults([]); return; }
    const id = window.setTimeout(async () => {
      try { const res = await cashierAPI.searchStudents({ q: studentQuery, per_page: 10 }); setStudentResults(res.data.data || []); }
      catch (e) { console.error(e); }
    }, 320);
    return () => window.clearTimeout(id);
  }, [studentQuery, targetType]);

  const discountAmount = useMemo(() => {
    const base = Number(form.amount || 0);
    const val = Number(form.discount_value || 0);
    if (!base || !val) return 0;
    return form.discount_mode === 'percent' ? Math.round(base * (Math.min(val, 100) / 100)) : Math.min(val, base);
  }, [form]);
  const finalAmount = useMemo(() => Math.max(0, Number(form.amount || 0) - discountAmount), [form, discountAmount]);

  const applyPreset = (p) => setForm((f) => ({ ...f, category: p.category, title: p.title }));

  const generate = async () => {
    if (targetType === 'excel') return runImport();
    if (!form.title.trim()) return notify('Isi judul tagihan.', 'error');
    if (!form.category.trim()) return notify('Pilih/isi kategori biaya.', 'error');
    if (!form.amount || Number(form.amount) <= 0) return notify('Isi tarif dasar.', 'error');
    if (!form.due_date) return notify('Pilih jatuh tempo.', 'error');
    if (targetType === 'student_ids' && !pickedStudent) return notify('Pilih satu siswa.', 'error');
    if (['class_name', 'grade_level', 'jurusan'].includes(targetType) && !targetValue) return notify('Pilih target penerbitan.', 'error');

    setGenerating(true);
    try {
      const fd = new FormData();
      fd.append('input_mode', 'manual');
      fd.append('title', form.title.trim());
      fd.append('category', form.category.trim());
      fd.append('amount', String(Math.round(Number(form.amount))));
      fd.append('due_date', form.due_date);
      fd.append('target_type', targetType);
      fd.append('subsidy_type', form.subsidy_type);
      if (form.discount_note.trim()) fd.append('discount_note', form.discount_note.trim());
      if (discountAmount > 0) fd.append('discount_amount', String(Math.round(discountAmount)));
      if (targetType === 'student_ids') fd.append('student_ids[]', pickedStudent.id);
      else fd.append('target_value', targetValue);

      const res = await cashierAPI.createBillings(fd);
      const data = res.data.data;
      setGenResult({ created: data.created_count, skipped: data.skipped || [], batch: data.batch_code });
      notify(`Berhasil terbit ${data.created_count} tagihan${(data.skipped_count || 0) ? `, dilewati ${data.skipped_count}` : ''}.`);
      await refreshKpi();
    } catch (error) {
      const data = error.response?.data;
      if (data?.data?.skipped) { setGenResult({ created: 0, skipped: data.data.skipped, batch: null }); }
      notify(data?.message || 'Generate tagihan gagal.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const runImport = async () => {
    if (!importFile) return notify('Pilih file .xlsx/.csv terlebih dahulu.', 'error');
    setGenerating(true);
    try {
      const fd = new FormData();
      fd.append('input_mode', 'excel');
      fd.append('file', importFile);
      const res = await cashierAPI.createBillings(fd);
      const data = res.data.data;
      setGenResult({ created: data.created_count, skipped: data.skipped || [], batch: data.batch_code });
      notify(`Import berhasil: ${data.created_count} tagihan dibuat.`);
      await refreshKpi();
    } catch (error) {
      notify(error.response?.data?.message || 'Import gagal.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await cashierAPI.downloadBillingTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = 'cashier-billing-template.csv';
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (e) { notify('Gagal mengunduh template.', 'error'); }
  };

  // ── Sub-tab 2: daftar tagihan ──
  const loadBillings = useCallback(async (filter = listFilter) => {
    setListLoading(true);
    try {
      const params = { page: filter.page, per_page: filter.per_page };
      ['class_name', 'category', 'subsidy_type', 'status', 'q'].forEach((k) => { if (filter[k]) params[k] = filter[k]; });
      const res = await cashierAPI.getBillings(params);
      setBillings(res.data.data || []);
      setListPagination(res.data.pagination || null);
    } catch (e) { console.error(e); notify('Daftar tagihan gagal dimuat.', 'error'); }
    finally { setListLoading(false); }
  }, [listFilter, notify]);

  const openEdit = (b) => {
    setEditModal(b);
    setEditForm({
      title: b.title || '', amount: String(Math.round(Number(b.base_amount || b.amount || 0))), due_date: b.due_date || '',
      subsidy_type: b.subsidy_type || 'reguler',
      discount_mode: (Number(b.discount_amount || 0) > 0 && Number(b.base_amount || 0) > 0 && Math.abs(Number(b.discount_amount) - Number(b.base_amount) * (Number(b.discount_amount) / Number(b.base_amount))) < 1) ? 'rupiah' : 'percent',
      discount_value: String(Math.round(Number(b.discount_amount || 0))), discount_note: b.discount_note || '',
    });
  };

  const submitEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const base = Number(editForm.amount || 0);
      const val = Number(editForm.discount_value || 0);
      const payload = {
        title: editForm.title, due_date: editForm.due_date || undefined, subsidy_type: editForm.subsidy_type,
        discount_note: editForm.discount_note || null,
      };
      if (base > 0) payload.amount = base;
      if (editForm.discount_mode === 'percent') payload.discount_percent = Math.min(val, 100);
      else payload.discount_amount = val;
      await cashierAPI.updateBilling(editModal.id, payload);
      notify('Tagihan diperbarui.');
      setEditModal(null);
      await Promise.all([loadBillings(listFilter), refreshKpi()]);
    } catch (e) { notify(e.response?.data?.message || 'Update gagal.', 'error'); }
    finally { setSaving(false); }
  };

  const submitDelete = async () => {
    if (!deleteModal) return;
    setSaving(true);
    try {
      await cashierAPI.deleteBilling(deleteModal.id);
      notify('Tagihan dihapus.');
      setDeleteModal(null);
      await Promise.all([loadBillings(listFilter), refreshKpi()]);
    } catch (e) { notify(e.response?.data?.message || 'Hapus gagal.', 'error'); }
    finally { setSaving(false); }
  };

  // ── Sub-tab 3: tunggakan ──
  const loadArrears = useCallback(async (filter = arrFilter) => {
    setArrLoading(true);
    try {
      const params = { page: filter.page, sort_by: filter.sort_by };
      if (filter.class_name) params.class_name = filter.class_name;
      if (filter.q) params.q = filter.q;
      const res = await cashierAPI.getArrears(params);
      setArrears(res.data.data);
      setArrPagination(res.data.pagination || null);
    } catch (e) { console.error(e); notify('Data tunggakan gagal dimuat.', 'error'); }
    finally { setArrLoading(false); }
  }, [arrFilter, notify]);

  const exportArrears = async () => {
    try {
      const params = {};
      if (arrFilter.class_name) params.class_name = arrFilter.class_name;
      if (arrFilter.q) params.q = arrFilter.q;
      const res = await cashierAPI.exportArrears(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `rekap-tunggakan-${today()}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      notify('Rekap tunggakan diekspor.');
    } catch (e) { notify('Ekspor gagal.', 'error'); }
  };

  const sendReminder = async () => {
    if (!reminderModal) return;
    if (!reminderMessage.trim()) return notify('Pesan pengingat wajib diisi.', 'error');
    setSaving(true);
    try {
      await cashierAPI.sendArrearReminder({ student_id: reminderModal.id === 'bulk' ? null : reminderModal.id, message: reminderMessage.trim() });
      notify('Pengingat terkirim.');
      setReminderModal(null);
    } catch (e) { notify(e.response?.data?.message || 'Pengingat gagal.', 'error'); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    if (subTab === 'list') loadBillings(listFilter);
    if (subTab === 'arrears') loadArrears(arrFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

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
            <h2 className="text-4xl font-black tracking-tight text-slate-950 xl:text-5xl">Tagihan &amp; Tunggakan Siswa</h2>
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
        <KpiCard grad={KPI_GRAD.blue} icon={Receipt} watermark={ClipboardList} value={formatCurrency(kpi?.total_tagihan_terbit || 0)} label="Total Tagihan Terbit" sub="Akumulasi seluruh tagihan" />
        <KpiCard grad={KPI_GRAD.rose} icon={AlertTriangle} watermark={Wallet} value={formatCurrency(kpi?.total_tunggakan_aktif || 0)} label="Total Tunggakan Aktif" sub="Sisa belum lunas" delay={0.075} />
        <KpiCard grad={KPI_GRAD.violet} icon={BadgePercent} watermark={Banknote} value={formatCurrency(kpi?.total_subsidi_beasiswa || 0)} label="Total Subsidi & Beasiswa" sub="Nilai potongan diberikan" delay={0.15} />
        <KpiCard grad={KPI_GRAD.emerald} icon={ShieldCheck} watermark={CalendarDays} value={`${kpi?.rasio_pelunasan ?? 0}%`} label="Rasio Pelunasan" sub="Terbayar terhadap terbit" delay={0.225} />
      </div>

      {/* SUB-TAB BAR */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {SUB_TABS.map((tab) => {
          const isActive = subTab === tab.id; const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" onClick={() => setSubTab(tab.id)}
              className={`flex flex-1 min-w-max items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${isActive ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {subTab === 'generate' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><Layers className="h-4 w-4 text-blue-600" /><span className="text-xs font-black uppercase tracking-widest text-slate-700">Target Penerbitan</span></div>
            <div className="mb-4 flex flex-wrap gap-2">
              {TARGET_TYPES.map((t) => { const Icon = t.icon; return (
                <button key={t.value} type="button" onClick={() => { setTargetType(t.value); setTargetValue(''); setPickedStudent(null); }}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black uppercase tracking-widest transition ${targetType === t.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  <Icon className="h-4 w-4" />{t.label}
                </button>
              ); })}
            </div>

            {targetType === 'student_ids' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Cari nama / NISN siswa..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
                </div>
                {pickedStudent ? (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm">
                    <span className="font-bold text-emerald-800">{pickedStudent.name} · {pickedStudent.nisn_nip || pickedStudent.school_id}</span>
                    <button type="button" onClick={() => setPickedStudent(null)} className="text-emerald-700 hover:text-emerald-900"><XCircle className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {studentResults.map((s) => (
                      <button key={s.id} type="button" onClick={() => { setPickedStudent(s); setStudentQuery(''); }} className="w-full rounded-lg border border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"><strong>{s.name}</strong> <span className="text-slate-400">· {s.nisn_nip || s.school_id}</span></button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {targetType === 'class_name' && (
              <select value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                <option value="">— Pilih Kelas —</option>
                {options.kelas.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            )}
            {targetType === 'grade_level' && (
              <select value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                <option value="">— Pilih Tingkat —</option>
                {options.grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
            {targetType === 'jurusan' && (
              <select value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                <option value="">— Pilih Jurusan —</option>
                {options.jurusans.map((j) => <option key={j.id} value={j.id}>{j.name} ({j.code})</option>)}
              </select>
            )}
            {targetType === 'excel' && (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"><Download className="h-4 w-4" />Unduh Template</button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                  <Upload className="h-4 w-4" />{importFile ? importFile.name : 'Pilih file .xlsx/.csv'}
                  <input type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            )}
          </div>

          {targetType !== 'excel' && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2"><BadgePercent className="h-4 w-4 text-blue-600" /><span className="text-xs font-black uppercase tracking-widest text-slate-700">Paket Cepat</span></div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PRESETS.map((p) => (
                    <button key={p.label} type="button" onClick={() => applyPreset(p)} className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${form.category === p.category ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{p.label}</button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs font-bold text-slate-600">Judul Tagihan</label><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-600">Kategori</label><input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-600">Tarif Dasar (Rp)</label><input value={formatThousands(form.amount)} onChange={(e) => setForm((f) => ({ ...f, amount: normalizeDigits(e.target.value) }))} placeholder="0" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-600">Jatuh Tempo</label><input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2"><Wallet className="h-4 w-4 text-violet-600" /><span className="text-xs font-black uppercase tracking-widest text-slate-700">Skema Subsidi / Beasiswa / Promo</span></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs font-bold text-slate-600">Jenis Subsidi</label>
                    <select value={form.subsidy_type} onChange={(e) => setForm((f) => ({ ...f, subsidy_type: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500">
                      {(options.subsidy_types.length ? options.subsidy_types : Object.keys(SUBSIDY_LABEL)).map((s) => <option key={s} value={s}>{subsidyLabel(s)}</option>)}
                    </select>
                  </div>
                  <div><label className="mb-1 block text-xs font-bold text-slate-600">Potongan ({form.discount_mode === 'percent' ? '%' : 'Rp'})</label>
                    <div className="flex gap-2">
                      <div className="flex rounded-xl border border-slate-200 p-0.5">
                        <button type="button" onClick={() => setForm((f) => ({ ...f, discount_mode: 'percent', discount_value: '' }))} className={`rounded-lg px-2.5 py-1.5 text-xs font-black ${form.discount_mode === 'percent' ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>%</button>
                        <button type="button" onClick={() => setForm((f) => ({ ...f, discount_mode: 'rupiah', discount_value: '' }))} className={`rounded-lg px-2.5 py-1.5 text-xs font-black ${form.discount_mode === 'rupiah' ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>Rp</button>
                      </div>
                      <input value={form.discount_mode === 'rupiah' ? formatThousands(form.discount_value) : form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: f.discount_mode === 'rupiah' ? normalizeDigits(e.target.value) : e.target.value.replace(/[^\d.]/g, '') }))} placeholder={form.discount_mode === 'percent' ? 'mis. 25' : '0'} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500" />
                    </div>
                  </div>
                  <div className="sm:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-600">Catatan Keringanan</label><input value={form.discount_note} onChange={(e) => setForm((f) => ({ ...f, discount_note: e.target.value }))} placeholder="mis. Gratis gelombang 1 PPDB" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500" /></div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-500">Pratinjau Kalkulasi</p>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Tarif Dasar</span><span className="font-bold text-slate-800">{formatCurrency(form.amount)}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Potongan ({subsidyLabel(form.subsidy_type)})</span><span className="font-bold text-rose-600">- {formatCurrency(discountAmount)}</span></div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm"><span className="font-black text-slate-700">Tagihan Bersih</span><span className="font-black text-slate-900">{formatCurrency(finalAmount)}</span></div>
                  {finalAmount <= 0 && Number(form.amount) > 0 && (
                    <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Tagihan bersih Rp 0 — otomatis berstatus LUNAS / LAYAK saat diterbitkan.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={generate} disabled={generating} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-md hover:opacity-95 disabled:opacity-60">
                  <Layers className="h-4 w-4" />{generating ? 'Menerbitkan…' : 'Generate Tagihan'}
                </button>
              </div>
            </>
          )}

          {targetType === 'excel' && (
            <div className="flex justify-end">
              <button type="button" onClick={runImport} disabled={generating || !importFile} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-md hover:opacity-95 disabled:opacity-60">
                <Upload className="h-4 w-4" />{generating ? 'Mengimpor…' : 'Import Tagihan'}
              </button>
            </div>
          )}

          {genResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-black text-emerald-800">Selesai: {genResult.created} tagihan diterbitkan {genResult.batch ? `· batch ${genResult.batch}` : ''}</p>
              {genResult.skipped.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-amber-700">Dilewati (sudah ada tagihan sejenis): {genResult.skipped.length} siswa</p>
                  <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs text-amber-800">
                    {genResult.skipped.map((s, i) => <li key={i}>• {s.student} — {s.bill_code}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= SUB-TAB 2: DAFTAR TAGIHAN ================= */}
      {subTab === 'list' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Kelas</label>
                <select value={listFilter.class_name} onChange={(e) => setListFilter((f) => ({ ...f, class_name: e.target.value, page: 1 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua Kelas</option>{options.kelas.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Kategori</label>
                <select value={listFilter.category} onChange={(e) => setListFilter((f) => ({ ...f, category: e.target.value, page: 1 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua</option>{options.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Jenis Subsidi</label>
                <select value={listFilter.subsidy_type} onChange={(e) => setListFilter((f) => ({ ...f, subsidy_type: e.target.value, page: 1 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua</option>{options.subsidy_types.map((s) => <option key={s} value={s}>{subsidyLabel(s)}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Status</label>
                <select value={listFilter.status} onChange={(e) => setListFilter((f) => ({ ...f, status: e.target.value, page: 1 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua</option>{BILLING_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Cari</label>
                <input value={listFilter.q} onChange={(e) => setListFilter((f) => ({ ...f, q: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') loadBillings({ ...listFilter, page: 1 }); }} placeholder="Nama / NISN / kode" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => loadBillings({ ...listFilter, page: 1 })} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">Terapkan</button>
              <button type="button" onClick={() => { const r = { class_name: '', category: '', subsidy_type: '', status: '', q: '', page: 1, per_page: 20 }; setListFilter(r); loadBillings(r); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50">Reset</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {listLoading ? <p className="py-10 text-center text-sm text-slate-400">Memuat tagihan…</p> : billings.length === 0 ? (
              <div className="py-12 text-center"><Receipt className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-sm font-bold text-slate-500">Belum ada tagihan untuk filter ini.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 text-left font-bold">Siswa</th>
                    <th className="px-4 py-3 text-left font-bold">Tagihan</th>
                    <th className="px-4 py-3 text-right font-bold">Tarif Dasar</th>
                    <th className="px-4 py-3 text-left font-bold">Subsidi</th>
                    <th className="px-4 py-3 text-right font-bold">Bersih</th>
                    <th className="px-4 py-3 text-right font-bold">Terbayar</th>
                    <th className="px-4 py-3 text-right font-bold">Sisa</th>
                    <th className="px-4 py-3 text-center font-bold">Status</th>
                    <th className="px-4 py-3 text-right font-bold">Aksi</th>
                  </tr></thead>
                  <tbody>
                    {billings.map((b) => {
                      const subsidized = Number(b.discount_amount || 0) > 0;
                      const st = b.status === 'lunas' ? 'text-emerald-700 bg-emerald-50' : b.status === 'belum_bayar' ? 'text-rose-700 bg-rose-50' : b.status === 'proses_verifikasi' ? 'text-amber-700 bg-amber-50' : 'text-slate-500 bg-slate-100';
                      return (
                        <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="px-4 py-3"><p className="font-bold text-slate-800">{b.student?.name || '-'}</p><p className="text-[11px] text-slate-400">{b.student?.nisn_nip || b.student?.school_id || '-'} · {b.student?.class_name || '-'}</p></td>
                          <td className="px-4 py-3 text-slate-700">{b.title}<p className="text-[11px] text-slate-400">{b.bill_code}</p></td>
                          <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(b.base_amount)}</td>
                          <td className="px-4 py-3">
                            {subsidized ? (
                              <span className="inline-flex flex-col gap-0.5">
                                <span className="inline-block w-max rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase text-violet-700">{subsidyLabel(b.subsidy_type)} -{formatCurrency(b.discount_amount)}</span>
                                {b.discount_note && <span className="text-[10px] text-slate-400">{b.discount_note}</span>}
                              </span>
                            ) : <span className="text-[11px] text-slate-400">Reguler</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(b.amount)}</td>
                          <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(b.paid_amount)}</td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(b.remaining_amount)}</td>
                          <td className="px-4 py-3 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${st}`}>{STATUS_LABEL[b.status] || b.status}</span></td>
                          <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                            <button type="button" onClick={() => openEdit(b)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-600 hover:bg-slate-50" title="Edit / Ubah Keringanan"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => setDeleteModal(b)} className="rounded-lg border border-rose-200 px-2 py-1.5 text-rose-600 hover:bg-rose-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {listPagination && listPagination.last_page > 1 && (
              <div className="flex items-center justify-center gap-1 border-t border-slate-100 p-3">
                <button type="button" disabled={listFilter.page <= 1} onClick={() => { const f = { ...listFilter, page: listFilter.page - 1 }; setListFilter(f); loadBillings(f); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Sebelumnya</button>
                <span className="px-3 text-xs text-slate-500">Hal {listFilter.page} / {listPagination.last_page} · {listPagination.total} tagihan</span>
                <button type="button" disabled={listFilter.page >= listPagination.last_page} onClick={() => { const f = { ...listFilter, page: listFilter.page + 1 }; setListFilter(f); loadBillings(f); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Berikutnya</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SUB-TAB 3: MONITORING TUNGGAKAN ================= */}
      {subTab === 'arrears' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <p>Rekap tunggakan ini <strong>tersinkron otomatis read-only</strong> ke dashboard Wali Kelas &amp; Pusat Jurusan — status kelayakan siswa mengikuti data di sini.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Kelas</label>
                <select value={arrFilter.class_name} onChange={(e) => setArrFilter((f) => ({ ...f, class_name: e.target.value, page: 1 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">Semua Kelas</option>{options.kelas.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Urutkan</label>
                <select value={arrFilter.sort_by} onChange={(e) => setArrFilter((f) => ({ ...f, sort_by: e.target.value, page: 1 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="tunggakan DESC">Tunggakan Terbesar</option><option value="tunggakan ASC">Tunggakan Terkecil</option><option value="nama ASC">Nama</option><option value="kelas ASC">Kelas</option>
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Cari</label>
                <input value={arrFilter.q} onChange={(e) => setArrFilter((f) => ({ ...f, q: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') loadArrears({ ...arrFilter, page: 1 }); }} placeholder="Nama / NISN" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => loadArrears({ ...arrFilter, page: 1 })} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">Terapkan</button>
              <button type="button" onClick={exportArrears} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100"><FileSpreadsheet className="h-4 w-4" />Export Rekap (.xlsx)</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total Tunggakan</p>
              <p className="mt-1 text-2xl font-black text-rose-600">{formatCurrency(arrears?.summary?.total_tunggakan || 0)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Siswa Bertunggakan</p>
              <p className="mt-1 text-2xl font-black text-slate-800">{arrears?.summary?.jumlah_siswa || 0} siswa</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {arrLoading ? <p className="py-10 text-center text-sm text-slate-400">Memuat tunggakan…</p> : (arrears?.students?.length || 0) === 0 ? (
              <div className="py-12 text-center"><Users className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-sm font-bold text-slate-500">Tidak ada siswa dengan tunggakan. Semua lunas.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 text-left font-bold">NISN</th><th className="px-4 py-3 text-left font-bold">Nama</th><th className="px-4 py-3 text-left font-bold">Kelas</th>
                    <th className="px-4 py-3 text-right font-bold">Total Tagihan</th><th className="px-4 py-3 text-right font-bold">Terbayar</th><th className="px-4 py-3 text-right font-bold">Tunggakan</th>
                    <th className="px-4 py-3 text-left font-bold">Jatuh Tempo</th><th className="px-4 py-3 text-center font-bold">Aksi</th>
                  </tr></thead>
                  <tbody>
                    {arrears.students.map((s) => (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.nisn}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{s.name}</td>
                        <td className="px-4 py-3 text-slate-600">{s.class_name}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(s.total_tagihan)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(s.total_bayar)}</td>
                        <td className="px-4 py-3 text-right font-black text-rose-600">{formatCurrency(s.tunggakan)}</td>
                        <td className="px-4 py-3 text-slate-600">{s.jatuh_tempo_terdekat ? formatDate(s.jatuh_tempo_terdekat) : '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => { setReminderModal(s); setReminderMessage(`Halo ${s.name}, terdapat tunggakan ${formatCurrency(s.tunggakan)} pada tagihan sekolah. Mohon segera melakukan pembayaran. Terima kasih.`); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-50">Pengingat</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {arrPagination && arrPagination.last_page > 1 && (
              <div className="flex items-center justify-center gap-1 border-t border-slate-100 p-3">
                <button type="button" disabled={arrFilter.page <= 1} onClick={() => { const f = { ...arrFilter, page: arrFilter.page - 1 }; setArrFilter(f); loadArrears(f); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Sebelumnya</button>
                <span className="px-3 text-xs text-slate-500">Hal {arrFilter.page} / {arrPagination.last_page}</span>
                <button type="button" disabled={arrFilter.page >= arrPagination.last_page} onClick={() => { const f = { ...arrFilter, page: arrFilter.page + 1 }; setArrFilter(f); loadArrears(f); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">Berikutnya</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      <AnimatePresence>
        {editModal && (
          <Modal onClose={() => setEditModal(null)} title="Edit / Ubah Keringanan" icon={Pencil} tone="blue">
            <div className="space-y-3 text-sm">
              <p className="text-xs text-slate-500">{editModal.bill_code} · {editModal.student?.name || '-'}</p>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Judul</label><input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-xs font-bold text-slate-600">Tarif Dasar</label><input value={formatThousands(editForm.amount)} onChange={(e) => setEditForm((f) => ({ ...f, amount: normalizeDigits(e.target.value) }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" /></div>
                <div><label className="mb-1 block text-xs font-bold text-slate-600">Jatuh Tempo</label><input type="date" value={editForm.due_date} onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-500" /></div>
              </div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Jenis Subsidi</label>
                <select value={editForm.subsidy_type} onChange={(e) => setEditForm((f) => ({ ...f, subsidy_type: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-violet-500">
                  {(options.subsidy_types.length ? options.subsidy_types : Object.keys(SUBSIDY_LABEL)).map((s) => <option key={s} value={s}>{subsidyLabel(s)}</option>)}
                </select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Potongan ({editForm.discount_mode === 'percent' ? '%' : 'Rp'})</label>
                <div className="flex gap-2">
                  <div className="flex rounded-lg border border-slate-200 p-0.5">
                    <button type="button" onClick={() => setEditForm((f) => ({ ...f, discount_mode: 'percent' }))} className={`rounded px-2.5 py-1.5 text-xs font-black ${editForm.discount_mode === 'percent' ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>%</button>
                    <button type="button" onClick={() => setEditForm((f) => ({ ...f, discount_mode: 'rupiah' }))} className={`rounded px-2.5 py-1.5 text-xs font-black ${editForm.discount_mode === 'rupiah' ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>Rp</button>
                  </div>
                  <input value={editForm.discount_mode === 'rupiah' ? formatThousands(editForm.discount_value) : editForm.discount_value} onChange={(e) => setEditForm((f) => ({ ...f, discount_value: f.discount_mode === 'rupiah' ? normalizeDigits(e.target.value) : e.target.value.replace(/[^\d.]/g, '') }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-violet-500" />
                </div></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-600">Catatan Keringanan</label><input value={editForm.discount_note} onChange={(e) => setEditForm((f) => ({ ...f, discount_note: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-violet-500" /></div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setEditModal(null)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Batal</button>
              <button type="button" onClick={submitEdit} disabled={saving} className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:opacity-95 disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan'}</button>
            </div>
          </Modal>
        )}

        {deleteModal && (
          <Modal onClose={() => setDeleteModal(null)} title="Hapus Tagihan" icon={Trash2} tone="rose">
            <div className="space-y-3 text-sm">
              <p className="text-slate-600">Hapus tagihan <strong>{deleteModal.title}</strong> ({deleteModal.bill_code}) milik <strong>{deleteModal.student?.name || '-'}</strong>?</p>
              {Number(deleteModal.paid_amount) > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Tagihan sudah memiliki pembayaran — backend akan menolak penghapusan demi menjaga jejak transaksi.</p>}
              <p className="text-xs text-slate-400">Tindakan ini permanen dan tidak dapat dibatalkan.</p>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteModal(null)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Batal</button>
              <button type="button" onClick={submitDelete} disabled={saving} className="rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 px-5 py-2.5 text-sm font-black text-white hover:opacity-95 disabled:opacity-60">{saving ? 'Menghapus…' : 'Hapus'}</button>
            </div>
          </Modal>
        )}

        {reminderModal && (
          <Modal onClose={() => setReminderModal(null)} title="Kirim Pengingat" icon={AlertTriangle} tone="amber">
            <div className="space-y-3 text-sm">
              <p className="text-slate-600">Pengingat untuk <strong>{reminderModal.name}</strong> ({reminderModal.class_name}) · tunggakan {formatCurrency(reminderModal.tunggakan)}.</p>
              <textarea rows={4} value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-500" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setReminderModal(null)} className="rounded-xl bg-slate-500 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-600">Batal</button>
              <button type="button" onClick={sendReminder} disabled={saving || !reminderMessage.trim()} className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-black text-white hover:opacity-95 disabled:opacity-60">{saving ? 'Mengirim…' : 'Kirim Pengingat'}</button>
            </div>
          </Modal>
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

function Modal({ onClose, title, icon: Icon, tone = 'blue', children }) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className={`flex items-center justify-between bg-gradient-to-br ${TONE[tone]} px-5 py-4 text-white`}>
          <div className="flex items-center gap-2"><Icon className="h-5 w-5" /><span className="text-sm font-black uppercase tracking-widest">{title}</span></div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/20 p-1.5 hover:bg-white/30"><XCircle className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </div>
  );
}
