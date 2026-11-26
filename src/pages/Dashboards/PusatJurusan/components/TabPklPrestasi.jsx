import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, ClipboardCheck, Award, Trophy, Users, Search, ChevronDown, ChevronRight, Plus,
  X, Loader2, Save, FileText, ShieldCheck, Calendar, Cpu,
  Pencil, Trash2, Download,
} from 'lucide-react';
import { pusatJurusanAPI } from '../../../../utils/api';
import { useCachedQuery } from '../../../../utils/queryCache';
import PklSiklusModal from './PklSiklusModal';
import ConfirmDialog from '../../../../components/dashboard/shared/ConfirmDialog';
import ActivePeriodCard from '../../../../components/dashboard/shared/ActivePeriodCard';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const fmtTgl = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/* ── Kartu KPI gradien + watermark (identik Menu 1–3) ── */
const KpiCard = ({ grad, icon: Icon, watermark: WIcon, value, sub, label }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
    className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
  >
    <WIcon className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 rotate-12 opacity-15 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
    <div className="relative flex items-center gap-4">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-inset ring-white/30 backdrop-blur-sm"><Icon className="h-6 w-6" /></span>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none tracking-tight">{value}</p>
        {sub && <p className="mt-1 truncate text-[11px] font-bold text-white/85">{sub}</p>}
        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/70">{label}</p>
      </div>
    </div>
  </motion.div>
);

/* ── Indikator mini siklus 4 tahap ── */
const STAGES = [
  { key: 'penempatan', label: 'Penempatan' },
  { key: 'laporan', label: 'Laporan' },
  { key: 'nilai', label: 'Nilai Final' },
  { key: 'sertifikat', label: 'Sertifikat' },
];
const CycleIndicator = ({ row }) => {
  const done = {
    penempatan: true,
    laporan: !!row.laporan_terverifikasi,
    nilai: row.status_final === 'final',
    sertifikat: !!row.punya_sertifikat,
  };
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex flex-col items-center gap-1" title={s.label}>
            <span className={`h-2.5 w-2.5 rounded-full ${done[s.key] ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          </div>
          {i < STAGES.length - 1 && <span className={`h-0.5 w-4 ${done[STAGES[i + 1].key] ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, desc }) => (
  <div className="py-14 text-center">
    <Icon className="mx-auto mb-3 h-12 w-12 text-slate-200" />
    <p className="text-sm font-black uppercase tracking-wider text-slate-400">{title}</p>
    <p className="mt-1 text-xs font-medium text-slate-400">{desc}</p>
  </div>
);

/* ── Shell modal berheader gradien gelap (tutup hanya via X / Esc, bukan tap luar) ── */
const ModalShell = ({ show, onClose, title, subtitle, icon: Icon, children, wide = false }) => {
  useEffect(() => {
    if (!show) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [show, onClose]);

  if (!show) return null;
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl`}
        >
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 px-6 py-4">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-indigo-500/30 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {Icon && <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Icon className="h-5 w-5 text-indigo-200" /></span>}
                <div>
                  <h3 className="text-lg font-black text-white">{title}</h3>
                  {subtitle && <p className="text-xs font-semibold text-indigo-100/80">{subtitle}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[10px] font-black tracking-widest text-white/70">Esc</span>
                <button onClick={onClose} title="Tutup"
                  className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/10 p-1.5 text-white/80 transition-colors hover:border-rose-400/40 hover:bg-rose-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="max-h-[72vh] overflow-y-auto p-6">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    {children}
  </label>
);
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const ghostSelectCls = 'appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-medium text-slate-600 outline-none transition-colors hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';

const STATUS_PKL = {
  belum: { label: 'Belum', cls: 'bg-slate-100 text-slate-500 ring-slate-400/20' },
  aktif: { label: 'Aktif', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  selesai: { label: 'Selesai', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
};

/* ── Picker murid searchable (mirror Manajemen KBM Admin Akademik) ── */
const studentNisn = (s) => String(s?.nisn || s?.nisn_nip || '').replace(/\D/g, '') || String(s?.nisn || '');

const MuridPicker = ({ options = [], selectedIds = [], onSelect, disabled, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapperRef = useRef(null);
  const selSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
  const matches = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return options
      .filter((s) => !s.sudah_pkl && !selSet.has(String(s.id)))
      .filter((s) => !kw || String(s.name || '').toLowerCase().includes(kw) || studentNisn(s).includes(kw))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'));
  }, [options, q, selSet]);

  useEffect(() => {
    const close = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button type="button" disabled={disabled} onClick={() => setIsOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-2xl border bg-white p-4 text-left text-sm font-bold outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 ${isOpen ? 'border-cyan-500 ring-4 ring-cyan-100' : 'border-slate-200 hover:border-cyan-300'}`}>
        <span className="min-w-0 truncate whitespace-nowrap text-slate-400">— Silahkan pilih murid —</span>
        <ChevronRight className={`ml-3 h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-[80] mt-2 flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 bg-slate-50 p-3">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau NISN 10 digit..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto p-2" role="listbox" aria-label="Daftar murid yang dapat dipilih" style={{ scrollbarWidth: 'thin' }}>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Memuat murid…</div>
            ) : matches.length ? matches.map((s) => (
              <button type="button" key={s.id} onClick={() => { onSelect(s); setIsOpen(false); setQ(''); }}
                className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-800">
                <span>{s.name || 'Tanpa Nama'} <span className="font-semibold text-slate-400">({studentNisn(s) || '-'})</span></span>
              </button>
            )) : <p className="px-3 py-5 text-center text-xs font-semibold text-slate-400">Keyword tidak ditemukan.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Panel "DAFTAR MURID TERDAFTAR" (chip removable + counter) ── */
const DaftarTerdaftar = ({ selected = [], onRemove, emptyText = 'Belum ada murid terdaftar.' }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Daftar Murid Terdaftar</h4>
      <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-black text-white">{selected.length}</span>
    </div>
    {selected.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {selected.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
            <span>{s.name || 'Murid'} <span className="text-slate-400">({studentNisn(s) || '-'})</span></span>
            <button type="button" aria-label={`Keluarkan ${s.name || 'murid'}`} onClick={() => onRemove(s.id)}
              className="rounded-full bg-slate-100 p-1 text-slate-500 transition hover:bg-rose-500 hover:text-white active:bg-rose-600"><X size={13} strokeWidth={2.8} /></button>
          </span>
        ))}
      </div>
    ) : (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-semibold italic text-slate-400">{emptyText}</p>
    )}
  </div>
);

/* ── Picker guru pembimbing searchable (single-select, mirror MuridPicker) ── */
const guruNip = (g) => String(g?.nisn_nip || g?.nip || g?.nisn || '').trim();

const GuruPicker = ({ gurus = [], value, onChange, disabled, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapperRef = useRef(null);
  const selected = useMemo(() => gurus.find((g) => String(g.id) === String(value)), [gurus, value]);
  const matches = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return gurus
      .filter((g) => !kw || String(g.name || '').toLowerCase().includes(kw) || guruNip(g).toLowerCase().includes(kw))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'));
  }, [gurus, q]);

  useEffect(() => {
    const close = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button type="button" disabled={disabled} onClick={() => setIsOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-2xl border bg-white p-4 text-left text-sm font-bold outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 ${isOpen ? 'border-cyan-500 ring-4 ring-cyan-100' : 'border-slate-200 hover:border-cyan-300'}`}>
        <span className={`min-w-0 truncate whitespace-nowrap ${selected ? 'text-slate-700' : 'text-slate-400'}`}>
          {selected ? `${selected.name} (${guruNip(selected) || '-'})` : '— Pilih Guru Pembimbing —'}
        </span>
        <ChevronRight className={`ml-3 h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-[80] mt-2 flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 bg-slate-50 p-3">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau NIP guru..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
          </div>
          <div className="max-h-52 space-y-1 overflow-y-auto p-2" role="listbox" aria-label="Daftar guru pembimbing" style={{ scrollbarWidth: 'thin' }}>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Memuat guru…</div>
            ) : matches.length ? matches.map((g) => (
              <button type="button" key={g.id} onClick={() => { onChange(g.id); setIsOpen(false); setQ(''); }}
                className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-800">
                <span>{g.name || 'Tanpa Nama'} <span className="font-semibold text-slate-400">({guruNip(g) || '-'})</span></span>
              </button>
            )) : <p className="px-3 py-5 text-center text-xs font-semibold text-slate-400">Keyword tidak ditemukan.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default function TabPklPrestasi({ selectedJurusan }) {
  const id = selectedJurusan?.id;
  const [mode, setMode] = useState('pkl'); // 'pkl' | 'prestasi'
  const [siklusId, setSiklusId] = useState(null);

  // ── PKL state ──
  const [filterStatus, setFilterStatus] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [searchPkl, setSearchPkl] = useState('');
  const [penModal, setPenModal] = useState(null); // null | 'tambah' | 'edit'
  const [penForm, setPenForm] = useState(EMPTY_PEN);
  const [penTarget, setPenTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [siswaKelas, setSiswaKelas] = useState([]);
  const [siswaLoading, setSiswaLoading] = useState(false);
  const [penSelected, setPenSelected] = useState([]); // id siswa terpilih (mode tambah)
  const [confirmState, setConfirmState] = useState(null); // { title, message, confirmLabel, loading, onConfirm }

  // ── Prestasi state ──
  const [fTahun, setFTahun] = useState('Semua');
  const [fJenis, setFJenis] = useState('Semua');
  const [searchAch, setSearchAch] = useState('');
  const [achModal, setAchModal] = useState(null);
  const [achForm, setAchForm] = useState(EMPTY_ACH);
  const [achTarget, setAchTarget] = useState(null);

  // ── Data nyata (auto-sync 5s + fokus) ──
  const { data: dsum } = useCachedQuery(id ? `pj:summary:${id}` : null,
    () => pusatJurusanAPI.getDashboardSummary(id).then((r) => r.data), { enabled: !!id });
  const periode = dsum?.periode || {};

  const { data: magang, refetch: refetchMagang } = useCachedQuery(id ? `pj:magang:${id}` : null,
    () => pusatJurusanAPI.getMagangSiswa(id).then((r) => r.data), { enabled: !!id });
  const { data: msum, refetch: refetchMsum } = useCachedQuery(id ? `pj:magsum:${id}` : null,
    () => pusatJurusanAPI.getMagangSummary(id).then((r) => r.data), { enabled: !!id });
  const { data: ach, refetch: refetchAch } = useCachedQuery(id ? `pj:ach:${id}` : null,
    () => pusatJurusanAPI.getAchievements(id).then((r) => r.data), { enabled: !!id });
  const { data: achsum, refetch: refetchAchsum } = useCachedQuery(id ? `pj:achsum:${id}` : null,
    () => pusatJurusanAPI.getAchievementsSummary(id).then((r) => r.data), { enabled: !!id });
  const { data: students } = useCachedQuery(id ? `pj:students:${id}` : null,
    () => pusatJurusanAPI.getStudents(id).then((r) => r.data), { enabled: !!id });
  const { data: gurus } = useCachedQuery(id ? `pj:guru:${id}` : null,
    () => pusatJurusanAPI.getGuruJurusan(id).then((r) => r.data?.data || r.data), { enabled: !!id });
  const { data: kelasOpsi } = useCachedQuery(id ? `pj:kelas:${id}` : null,
    () => pusatJurusanAPI.getPlottingKelas(id).then((r) => r.data?.data || r.data), { enabled: !!id });

  const syncNow = useCallback(() => { refetchMagang(); refetchMsum(); refetchAch(); refetchAchsum(); }, [refetchMagang, refetchMsum, refetchAch, refetchAchsum]);
  useEffect(() => {
    const onVis = () => { if (!document.hidden) syncNow(); };
    window.addEventListener('focus', syncNow);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('focus', syncNow); document.removeEventListener('visibilitychange', onVis); };
  }, [syncNow]);

  const magangList = Array.isArray(magang) ? magang : [];
  const achList = Array.isArray(ach) ? ach : [];
  const kelasList = useMemo(() => [...new Set(magangList.map((m) => m.kelas).filter(Boolean))], [magangList]);

  const filteredMagang = useMemo(() => magangList.filter((m) => {
    if (filterKelas && m.kelas !== filterKelas) return false;
    if (searchPkl) {
      const q = searchPkl.toLowerCase();
      if (!(m.nama_siswa || '').toLowerCase().includes(q) && !(m.tempat_magang || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [magangList, filterKelas, searchPkl]);

  const filteredAch = useMemo(() => achList.filter((a) => {
    if (fTahun !== 'Semua' && String(a.tahun) !== String(fTahun)) return false;
    if (fJenis !== 'Semua' && a.jenis_prestasi !== fJenis) return false;
    if (searchAch) {
      const q = searchAch.toLowerCase();
      if (!(a.nama_prestasi || '').toLowerCase().includes(q) && !(a.siswa?.name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [achList, fTahun, fJenis, searchAch]);

  // ── Aksi PKL ──
  const loadSiswaKelas = useCallback(async (kelasId) => {
    if (!id || !kelasId) { setSiswaKelas([]); return; }
    setSiswaLoading(true);
    try { const r = await pusatJurusanAPI.getSiswaKelasPkl(id, kelasId); setSiswaKelas(r.data?.data || []); }
    catch { setSiswaKelas([]); toast.error('Gagal memuat siswa kelas.'); }
    finally { setSiswaLoading(false); }
  }, [id]);

  // Muat siswa saat kelas dipilih di modal penempatan.
  useEffect(() => {
    if (penModal && penForm.school_class_id) loadSiswaKelas(penForm.school_class_id);
    else if (penModal) setSiswaKelas([]);
  }, [penModal, penForm.school_class_id, loadSiswaKelas]);

  const openTambahPen = () => {
    setPenForm(EMPTY_PEN()); setPenTarget(null); setSiswaKelas([]); setPenSelected([]); setPenModal('tambah');
  };
  const openEditPen = (m) => {
    setPenTarget(m);
    setPenForm({
      siswa_id: m.siswa_id, school_class_id: m.school_class_id || '', guru_pembimbing_id: m.guru_pembimbing_id || '',
      tempat_magang: m.tempat_magang || '', alamat_magang: m.alamat_magang || '', pembimbing: m.pembimbing || '',
      kontak_pembimbing: m.kontak_pembimbing || '', tanggal_mulai: (m.tanggal_mulai || '').slice(0, 10),
      tanggal_selesai: (m.tanggal_selesai || '').slice(0, 10), status: m.status || 'belum',
    });
    setPenSelected([]);
    setPenModal('edit');
  };
  const submitPen = async (e) => {
    e.preventDefault();
    if (penModal === 'tambah' && penSelected.length === 0) { toast.error('Pilih minimal 1 murid.'); return; }
    setSaving(true);
    try {
      if (penModal === 'tambah') {
        const payload = { ...penForm, student_ids: penSelected.map((s) => s.id) };
        delete payload.siswa_id;
        const r = await pusatJurusanAPI.storeMagangSiswa(id, payload);
        toast.success(r.data?.message || `${penSelected.length} penempatan dibuat.`);
      } else {
        await pusatJurusanAPI.updateMagangSiswa(id, penTarget.id, penForm);
        toast.success('Penempatan PKL diperbarui.');
      }
      setPenModal(null); syncNow();
    } catch (err) { toast.error(err?.response?.data?.message || 'Gagal menyimpan penempatan.'); }
    finally { setSaving(false); }
  };
  const hapusPen = (m) => {
    setConfirmState({
      title: 'Hapus Penempatan PKL',
      message: `Yakin ingin menghapus penempatan PKL untuk ${m.nama_siswa} di ${m.tempat_magang || 'tanpa DUDI'}? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Ya, Hapus',
      loading: false,
      onConfirm: async () => {
        setConfirmState((p) => ({ ...p, loading: true }));
        try { await pusatJurusanAPI.deleteMagangSiswa(id, m.id); toast.success('Penempatan dihapus.'); setConfirmState(null); syncNow(); }
        catch { toast.error('Gagal menghapus.'); setConfirmState((p) => ({ ...p, loading: false })); }
      },
    });
  };

  // ── Aksi Prestasi ──
  const openTambahAch = () => { setAchForm(EMPTY_ACH()); setAchTarget(null); setAchModal('tambah'); };
  const openEditAch = (a) => {
    setAchTarget(a);
    setAchForm({ siswa_id: a.siswa_id, jenis_prestasi: a.jenis_prestasi, nama_prestasi: a.nama_prestasi, tingkat: a.tingkat, tahun: a.tahun, deskripsi: a.deskripsi || '', piagam: null });
    setAchModal('edit');
  };
  const submitAch = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      Object.keys(achForm).forEach((k) => { if (achForm[k] !== null && achForm[k] !== undefined && achForm[k] !== '') fd.append(k, achForm[k]); });
      if (achModal === 'tambah') { await pusatJurusanAPI.storeAchievement(id, fd); toast.success('Prestasi dicatat.'); }
      else { await pusatJurusanAPI.updateAchievement(id, achTarget.id, fd); toast.success('Prestasi diperbarui.'); }
      setAchModal(null); syncNow();
    } catch (err) { toast.error(err?.response?.data?.message || 'Gagal menyimpan prestasi.'); }
    finally { setSaving(false); }
  };
  const hapusAch = (a) => {
    setConfirmState({
      title: 'Hapus Prestasi',
      message: `Yakin ingin menghapus prestasi "${a.nama_prestasi}" untuk ${a.siswa?.name || 'siswa ini'}? Data yang dihapus tidak dapat dikembalikan.`,
      confirmLabel: 'Ya, Hapus',
      loading: false,
      onConfirm: async () => {
        setConfirmState((p) => ({ ...p, loading: true }));
        try { await pusatJurusanAPI.deleteAchievement(id, a.id); toast.success('Prestasi dihapus.'); setConfirmState(null); syncNow(); }
        catch { toast.error('Gagal menghapus.'); setConfirmState((p) => ({ ...p, loading: false })); }
      },
    });
  };

  const exportPkl = () => {
    if (!magangList.length) { toast.error('Belum ada data.'); return; }
    const ws = XLSX.utils.json_to_sheet(magangList.map((m, i) => ({
      No: i + 1, 'Nama Siswa': m.nama_siswa, Kelas: m.kelas || '-', 'Tempat Magang': m.tempat_magang || '-',
      'Tanggal Mulai': m.tanggal_mulai || '-', 'Tanggal Selesai': m.tanggal_selesai || '-', Status: m.status,
      'Nilai Akhir': m.nilai_akhir ?? '-', 'Sertifikat': m.punya_sertifikat ? 'Ya' : 'Belum',
    })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'PKL');
    XLSX.writeFile(wb, `pkl-${selectedJurusan?.name || 'jurusan'}.xlsx`);
  };
  const exportAch = () => {
    if (!achList.length) { toast.error('Belum ada data.'); return; }
    const ws = XLSX.utils.json_to_sheet(achList.map((a) => ({
      'Nama Siswa': a.siswa?.name, Kelas: a.siswa?.school_class?.name || a.siswa?.class_name || '-',
      'Jenis': a.jenis_prestasi, 'Prestasi': a.nama_prestasi, Tingkat: a.tingkat, Tahun: a.tahun,
    })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Prestasi');
    XLSX.writeFile(wb, `prestasi-${selectedJurusan?.code || 'jurusan'}.xlsx`);
  };

  const s = msum || { total: 0, aktif: 0, selesai: 0, belum: 0, belum_final: 0, sertifikat_terbit: 0, laporan_pending: 0 };
  const as = achsum || { total: 0, lomba: 0, sertifikasi: 0, juara_kelas: 0, lainnya: 0 };

  return (
    <div className="space-y-6">
      {/* ── HERO (identik Menu 1–3, tanpa tombol/filter) ── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#f5fde7] via-[#f8fdec] to-white p-6 text-slate-900 shadow-sm ring-1 ring-[#eaf8dc] xl:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
              <Cpu className="h-3 w-3" /> Portal Major Department Center
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-950 xl:text-5xl">PKL &amp; Prestasi Kejuruan</h2>
          </div>
          <ActivePeriodCard tahunAjaran={periode.tahun_ajaran} semester={periode.semester} />
        </div>
      </section>

      {/* ── 4 KPI ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard grad="from-blue-600 to-cyan-500" icon={Briefcase} watermark={Briefcase} value={s.aktif} sub={`dari ${s.total} penempatan`} label="Siswa Aktif PKL" />
        <KpiCard grad="from-amber-500 to-orange-600" icon={ClipboardCheck} watermark={ShieldCheck} value={s.belum_final} sub={`${s.laporan_pending} laporan belum diverifikasi`} label="Menunggu Verifikasi & Nilai" />
        <KpiCard grad="from-emerald-600 to-teal-500" icon={Award} watermark={Award} value={s.sertifikat_terbit} sub="siswa bersertifikat" label="Sertifikat PKL Terbit" />
        <KpiCard grad="from-indigo-600 to-violet-600" icon={Trophy} watermark={Trophy} value={as.total || 0} sub={`${as.lomba || 0} lomba · ${as.sertifikasi || 0} sertifikasi`} label="Total Prestasi & Kompetisi" />
      </div>

      {/* ── TOOLBAR: switcher + filter + tombol utama ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {[{ k: 'pkl', label: 'Manajemen Siklus PKL', icon: Briefcase }, { k: 'prestasi', label: 'Rekap Prestasi Kejuruan', icon: Trophy }].map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.k} onClick={() => setMode(t.k)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all ${mode === t.k ? 'bg-white font-bold text-indigo-600 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-700'}`}>
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>
          {mode === 'pkl' ? (
            <button onClick={openTambahPen}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:from-blue-500 hover:to-violet-500 hover:-translate-y-0.5">
              <Plus className="h-4 w-4" /> Plotting Penempatan PKL
            </button>
          ) : (
            <button onClick={openTambahAch}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:brightness-110 hover:-translate-y-0.5">
              <Plus className="h-4 w-4" /> Catat Prestasi Siswa
            </button>
          )}
        </div>

        {/* Baris filter */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          {mode === 'pkl' ? (
            <>
              <div className="relative">
                <ClipboardCheck className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={ghostSelectCls}>
                  <option value="">Status: Semua</option>
                  <option value="belum">Pengajuan / Belum</option>
                  <option value="aktif">Aktif</option>
                  <option value="selesai">Selesai</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="relative">
                <Users className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className={ghostSelectCls}>
                  <option value="">Kelas: Semua</option>
                  {kelasList.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={searchPkl} onChange={(e) => setSearchPkl(e.target.value)} placeholder="Cari nama siswa / perusahaan DUDI…" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-300 hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <button onClick={exportPkl} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Download className="h-3.5 w-3.5" /> Ekspor</button>
            </>
          ) : (
            <>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select value={fTahun} onChange={(e) => setFTahun(e.target.value)} className={ghostSelectCls}>
                  <option value="Semua">Tahun: Semua</option>
                  {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="relative">
                <Trophy className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select value={fJenis} onChange={(e) => setFJenis(e.target.value)} className={ghostSelectCls}>
                  <option value="Semua">Jenis: Semua</option>
                  <option value="lomba">Lomba</option>
                  <option value="sertifikasi">Sertifikasi</option>
                  <option value="juara_kelas">Juara Kelas</option>
                  <option value="lainnya">Lainnya</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={searchAch} onChange={(e) => setSearchAch(e.target.value)} placeholder="Cari prestasi / nama siswa…" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-300 hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <button onClick={exportAch} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Download className="h-3.5 w-3.5" /> Ekspor</button>
            </>
          )}
        </div>
      </div>

      {/* ── TABEL ── */}
      {mode === 'pkl' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Briefcase size={18} className="text-blue-600" />
            <h3 className="text-base font-black text-slate-800">Manajemen Siklus PKL</h3>
            <span className="ml-auto text-xs font-bold text-slate-400">{filteredMagang.length} data</span>
          </div>
          {filteredMagang.length === 0 ? (
            <EmptyState icon={Briefcase} title="Belum ada penempatan PKL" desc="Tombol Plotting Penempatan PKL di atas untuk menambah data. Semua angka berasal dari tabel nyata." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 text-left">Siswa &amp; Kelas</th>
                    <th className="px-4 py-3 text-left">Industri / DUDI &amp; Periode</th>
                    <th className="px-4 py-3 text-left">Guru Pembimbing</th>
                    <th className="px-4 py-3 text-center">Progres Siklus</th>
                    <th className="px-4 py-3 text-center">Nilai Akhir</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMagang.map((m) => {
                    const st = STATUS_PKL[m.status] || { label: m.status, cls: 'bg-slate-100 text-slate-500 ring-slate-400/20' };
                    return (
                      <tr key={m.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{m.nama_siswa}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-400">{m.nisn || '—'}</span>
                            {m.kelas && <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">{m.kelas}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-700">{m.tempat_magang || '—'}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><Calendar className="h-3 w-3" /> {fmtTgl(m.tanggal_mulai)} – {fmtTgl(m.tanggal_selesai)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-600">{m.guru_pembimbing_name || m.pembimbing || '—'}</td>
                        <td className="px-4 py-3"><div className="flex justify-center"><CycleIndicator row={m} /></div></td>
                        <td className="px-4 py-3 text-center"><span className={`text-base font-black tabular-nums ${m.nilai_akhir != null ? 'text-emerald-600' : 'text-slate-300'}`}>{m.nilai_akhir ?? '—'}</span></td>
                        <td className="px-4 py-3 text-center"><span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ring-inset ${st.cls}`}>{st.label}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => setSiklusId(m.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm transition-all hover:brightness-110 active:scale-95"><Award className="h-3.5 w-3.5" /> Kelola Siklus</button>
                            <button onClick={() => openEditPen(m)} title="Edit" className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => hapusPen(m)} title="Hapus" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Trophy size={18} className="text-indigo-600" />
            <h3 className="text-base font-black text-slate-800">Rekap Prestasi Kejuruan</h3>
            <span className="ml-auto text-xs font-bold text-slate-400">{filteredAch.length} data</span>
          </div>
          {filteredAch.length === 0 ? (
            <EmptyState icon={Trophy} title="Belum ada prestasi tercatat" desc="Tombol Catat Prestasi Siswa di atas untuk menambah capaian lomba / sertifikasi." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 text-left">Siswa &amp; Kelas</th>
                    <th className="px-4 py-3 text-left">Prestasi / Kompetisi</th>
                    <th className="px-4 py-3 text-center">Tingkat</th>
                    <th className="px-4 py-3 text-center">Tahun</th>
                    <th className="px-4 py-3 text-center">Bukti Piagam</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAch.map((a) => (
                    <tr key={a.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{a.siswa?.name || '—'}</p>
                        <span className="text-[11px] font-medium text-slate-400">{a.siswa?.school_class?.name || a.siswa?.class_name || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-700">{a.nama_prestasi}</p>
                        <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">{a.jenis_prestasi}</span>
                      </td>
                      <td className="px-4 py-3 text-center"><span className="inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-600/20">{a.tingkat}</span></td>
                      <td className="px-4 py-3 text-center font-bold tabular-nums text-slate-600">{a.tahun}</td>
                      <td className="px-4 py-3 text-center">
                        {a.piagam ? (
                          <a href={`${import.meta.env.VITE_API_URL}/storage/${a.piagam}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100"><FileText className="h-3.5 w-3.5" /> Lihat</a>
                        ) : <span className="text-[11px] font-medium text-slate-300">belum ada</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEditAch(a)} title="Edit" className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => hapusAch(a)} title="Hapus" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}
      <ModalShell show={penModal !== null} onClose={() => setPenModal(null)} wide
        title={penModal === 'tambah' ? 'Plotting Penempatan PKL Murid' : 'Edit Penempatan PKL Murid'}>
        <form onSubmit={submitPen} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pilih Kelas">
              <select value={penForm.school_class_id} onChange={(e) => { setPenForm((p) => ({ ...p, school_class_id: e.target.value, siswa_id: penModal === 'edit' ? p.siswa_id : '' })); setPenSelected([]); }} className={inputCls} required>
                <option value="">— Pilih Kelas —</option>
                {(kelasOpsi || []).filter((k) => String(k.tingkat || '').toUpperCase() === 'XI').map((k) => <option key={k.id} value={k.id}>{k.nama || k.name}</option>)}
              </select>
            </Field>
            {penModal === 'tambah' ? (
              <Field label="Pilih Murid">
                <MuridPicker
                  options={siswaKelas}
                  selectedIds={penSelected.map((s) => s.id)}
                  onSelect={(s) => setPenSelected((prev) => (prev.some((p) => p.id === s.id) ? prev : [...prev, s]))}
                  loading={siswaLoading}
                  disabled={!penForm.school_class_id}
                />
              </Field>
            ) : (
              <Field label="Siswa">
                <select value={penForm.siswa_id} onChange={(e) => setPenForm((p) => ({ ...p, siswa_id: e.target.value }))} className={inputCls + ' disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'} disabled>
                  <option value="">— Pilih Siswa —</option>
                  {(() => {
                    const list = (siswaKelas || []).slice();
                    if (penTarget && !list.some((s) => String(s.id) === String(penTarget.siswa_id))) {
                      list.push({ id: penTarget.siswa_id, name: penTarget.nama_siswa });
                    }
                    return list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>);
                  })()}
                </select>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">Terkunci — edit per murid.</p>
              </Field>
            )}
          </div>

          {penModal === 'tambah' && (
            <DaftarTerdaftar
              selected={penSelected}
              onRemove={(sid) => setPenSelected((prev) => prev.filter((s) => s.id !== sid))}
              emptyText={penForm.school_class_id ? 'Belum ada murid terdaftar.' : 'Pilih kelas terlebih dahulu.'}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Perusahaan">
              <input value={penForm.tempat_magang} onChange={(e) => setPenForm((p) => ({ ...p, tempat_magang: e.target.value }))} className={inputCls} required placeholder="PT / CV / Instansi" />
            </Field>
            <Field label="Guru Pembimbing">
              <GuruPicker
                gurus={gurus || []}
                value={penForm.guru_pembimbing_id}
                onChange={(gid) => setPenForm((p) => ({ ...p, guru_pembimbing_id: gid }))}
              />
            </Field>
          </div>
          <Field label="Alamat Perusahaan">
            <input value={penForm.alamat_magang} onChange={(e) => setPenForm((p) => ({ ...p, alamat_magang: e.target.value }))} className={inputCls} required placeholder="Alamat lengkap" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pembimbing Lapangan">
              <input value={penForm.pembimbing} onChange={(e) => setPenForm((p) => ({ ...p, pembimbing: e.target.value }))} className={inputCls} required placeholder="Nama pembimbing industri" />
            </Field>
            <Field label="Kontak Pembimbing">
              <input value={penForm.kontak_pembimbing} onChange={(e) => setPenForm((p) => ({ ...p, kontak_pembimbing: e.target.value }))} className={inputCls} required placeholder="No. HP" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tanggal Mulai"><input type="date" value={penForm.tanggal_mulai} onChange={(e) => setPenForm((p) => ({ ...p, tanggal_mulai: e.target.value }))} className={inputCls} required /></Field>
            <Field label="Tanggal Selesai"><input type="date" value={penForm.tanggal_selesai} onChange={(e) => setPenForm((p) => ({ ...p, tanggal_selesai: e.target.value }))} className={inputCls} required /></Field>
            <Field label="Status">
              <select value={penForm.status} onChange={(e) => setPenForm((p) => ({ ...p, status: e.target.value }))} className={inputCls} required>
                <option value="belum">Belum / Pengajuan</option>
                <option value="aktif">Aktif</option>
                <option value="selesai">Selesai</option>
              </select>
            </Field>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {penModal === 'tambah' ? `Simpan Penempatan${penSelected.length ? ` (${penSelected.length})` : ''}` : 'Perbarui'}
            </button>
          </div>
        </form>
      </ModalShell>
      <ModalShell show={achModal !== null} onClose={() => setAchModal(null)}
        title={achModal === 'tambah' ? 'Catat Prestasi Siswa' : 'Edit Prestasi Siswa'}
        subtitle="Lomba / kompetisi, sertifikasi keahlian, atau juara kelas." icon={Trophy}>
        <form onSubmit={submitAch} className="space-y-4">
          <Field label="Pilih Siswa Jurusan">
            <select value={achForm.siswa_id} onChange={(e) => setAchForm((p) => ({ ...p, siswa_id: e.target.value }))} className={inputCls} required>
              <option value="">— Pilih Siswa —</option>
              {(students || []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.class_name ? ` (${s.class_name})` : ''}</option>)}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jenis Prestasi">
              <select value={achForm.jenis_prestasi} onChange={(e) => setAchForm((p) => ({ ...p, jenis_prestasi: e.target.value }))} className={inputCls}>
                <option value="lomba">Lomba / Kompetisi</option>
                <option value="sertifikasi">Sertifikasi Keahlian</option>
                <option value="juara_kelas">Juara Kelas</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </Field>
            <Field label="Tingkat">
              <select value={achForm.tingkat} onChange={(e) => setAchForm((p) => ({ ...p, tingkat: e.target.value }))} className={inputCls}>
                <option value="sekolah">Sekolah</option>
                <option value="kecamatan">Kecamatan</option>
                <option value="kabupaten">Kabupaten / Kota</option>
                <option value="provinsi">Provinsi</option>
                <option value="nasional">Nasional</option>
                <option value="internasional">Internasional</option>
              </select>
            </Field>
          </div>
          <Field label="Nama Prestasi">
            <input value={achForm.nama_prestasi} onChange={(e) => setAchForm((p) => ({ ...p, nama_prestasi: e.target.value }))} className={inputCls} required placeholder="Contoh: Juara 1 LKS Web Technologies Nasional" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tahun"><input type="number" min="2000" max="2100" value={achForm.tahun} onChange={(e) => setAchForm((p) => ({ ...p, tahun: e.target.value }))} className={inputCls} required /></Field>
            <Field label="Upload Piagam (opsional)">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setAchForm((p) => ({ ...p, piagam: e.target.files?.[0] || null }))} className={inputCls} />
            </Field>
          </div>
          <Field label="Deskripsi (opsional)">
            <textarea rows={3} value={achForm.deskripsi} onChange={(e) => setAchForm((p) => ({ ...p, deskripsi: e.target.value }))} className={inputCls + ' resize-none'} placeholder="Keterangan tambahan…" />
          </Field>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setAchModal(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:brightness-110 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {achModal === 'tambah' ? 'Simpan Prestasi' : 'Perbarui'}
            </button>
          </div>
        </form>
      </ModalShell>

      <PklSiklusModal jurusanId={id} pklId={siklusId} onClose={() => setSiklusId(null)} onChanged={syncNow} />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}

/* placeholder consts (diisi di bawah) */
function EMPTY_PEN() { return { siswa_id: '', school_class_id: '', guru_pembimbing_id: '', tempat_magang: '', alamat_magang: '', pembimbing: '', kontak_pembimbing: '', tanggal_mulai: '', tanggal_selesai: '', status: 'belum' }; }
function EMPTY_ACH() { return { siswa_id: '', jenis_prestasi: 'lomba', nama_prestasi: '', tingkat: 'sekolah', tahun: String(new Date().getFullYear()), deskripsi: '', piagam: null }; }
