import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { pusatJurusanAPI, adminAkademikAPI, BASE_URL } from '../../../../utils/api';
import { useCachedQuery } from '../../../../utils/queryCache';
import KelolaKbmModal from '../../../../components/kbm/KelolaKbmModal';
import ActivePeriodCard from '../../../../components/dashboard/shared/ActivePeriodCard';
import ConfirmDialog from '../../../../components/dashboard/shared/ConfirmDialog';
import {
  BookOpen, CalendarClock, Plus, Pencil, Trash2, X, Save, Loader2,
  ChevronDown, AlertTriangle, ShieldAlert, FileX, GraduationCap, Users, Cpu,
  Lock, Search, FilePlus2, FileText, Download, ExternalLink, Info,
} from 'lucide-react';

const TINGKAT = ['X', 'XI', 'XII'];
const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

const DOC_TYPES = { cp: 'CP / ATP', atp: 'CP / ATP', silabus: 'Silabus', modul: 'Modul' };
const DOC_BADGE = {
  cp: 'bg-blue-50 text-blue-700 ring-blue-600/20', atp: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  silabus: 'bg-violet-50 text-violet-700 ring-violet-600/20', modul: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};
const emptyDokumen = { title: '', documentType: 'cp', subjectId: '', tingkat: 'X', file: null, notes: '' };

const initials = (name) => (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/* ── Mini Stat Card (gradien halus + watermark ikon transparan) ── */
const MiniStat = ({ grad, icon: Icon, watermark: WIcon, value, label }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
    className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
  >
    <WIcon className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 rotate-12 opacity-15 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
    <div className="relative flex items-center gap-4">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-inset ring-white/30 backdrop-blur-sm"><Icon className="h-6 w-6" /></span>
      <div>
        <p className="text-3xl font-black leading-none tracking-tight">{value}</p>
        <p className="mt-1.5 text-[11px] font-black uppercase tracking-widest text-white/80">{label}</p>
      </div>
    </div>
  </motion.div>
);

/* ── Kartu jadwal per baris (5 info utama + aksi) ── */
const JadwalRow = ({ r, onEdit, onDelete }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
    className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${r.can_edit ? 'border-indigo-100' : 'border-slate-200 bg-slate-50/60'}`}
  >
    {/* 1. Mapel + badge kelompok */}
    <div className="min-w-[180px] flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-slate-900">{r.mapel_nama || '—'}</span>
        {r.can_edit ? (
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-600/20">Kelompok C</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500 ring-1 ring-inset ring-slate-500/20"><Lock className="h-3 w-3" /> Kelompok {String(r.kelompok || 'A/B').toUpperCase()} · Terkunci</span>
        )}
      </div>
      {/* 2. Kelas */}
      <span className="mt-1.5 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">{r.kelas_nama || '—'}</span>
    </div>

    {/* 3. Guru */}
    <div className="flex items-center gap-2">
      {r.guru_avatar ? (
        <img src={`${BASE_URL}/storage/${r.guru_avatar}`} alt={r.guru_nama || 'Guru'} loading="lazy" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
      ) : (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-black text-white">{initials(r.guru_nama)}</span>
      )}
      <span className="text-sm font-semibold text-slate-600">{r.guru_nama || <span className="font-normal text-slate-300">Belum ada</span>}</span>
    </div>

    {/* 4. Hari & jam */}
    <div className="text-right">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{(r.hari || '—').toUpperCase()}</p>
      <p className="tabular-nums text-sm font-bold text-slate-700">{r.jam_mulai ? `${String(r.jam_mulai).slice(0, 5)} – ${String(r.jam_selesai).slice(0, 5)}` : '—'}</p>
    </div>

    {/* 5. Kode belajar */}
    <div className="flex items-center gap-1.5">
      {r.kode_belajar && (
        <code className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-indigo-700">{r.kode_belajar}</code>
      )}
      {/* Aksi (khusus Kelompok C) */}
      {r.can_edit ? (
        <span className="ml-1 flex items-center gap-1">
          <button onClick={() => onEdit(r)} title="Edit jadwal" className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => onDelete(r.id)} title="Hapus jadwal" className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </span>
      ) : <span className="ml-1 text-xs text-slate-300">—</span>}
    </div>
  </motion.div>
);

const KurikulumJadwalPage = ({ selectedJurusan }) => {
  const [segTab, setSegTab] = useState('plotting');
  const [tingkat, setTingkat] = useState(''); // '' = Semua Tingkat
  const [q, setQ] = useState('');

  // Mapel C (dipakai autocomplete mapel di modal KelolaKbmModal)
  const [mapel, setMapel] = useState([]);

  // Dokumen kurikulum — silent polling 5 detik (terisolasi per jurusan).
  const [dokumenModal, setDokumenModal] = useState(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [docTingkat, setDocTingkat] = useState('');
  const [qDoc, setQDoc] = useState('');

  const [kelasId, setKelasId] = useState(null);
  const [kbmModalOpen, setKbmModalOpen] = useState(false);
  const [kbmEditData, setKbmEditData] = useState(null);
  const [err, setErr] = useState('');
  const [confirmState, setConfirmState] = useState(null);

  const id = selectedJurusan?.id;

  useEffect(() => {
    if (!dokumenModal) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [dokumenModal]);

  /* ── Data (semua via cache; KPI & tabel murni dari DB, tanpa dummy) ── */

  // Periode + identitas jurusan — berbagi cache dengan Dashboard (tanpa polling ganda).
  const { data: dsum } = useCachedQuery(
    `pusjur:dashsum:${id || 'none'}`,
    () => pusatJurusanAPI.getDashboardSummary(id).then((r) => r.data),
    { ttl: 60000, enabled: !!id },
  );
  const periode = dsum?.periode || {};

  // Daftar kelas milik jurusan (pill tabs) — dari DB.
  const { data: kelasData } = useCachedQuery(
    `pusjur:plotting-kelas:${id || 'none'}`,
    () => pusatJurusanAPI.getPlottingKelas(id).then((r) => r.data),
    { ttl: 60000, enabled: !!id },
  );
  const kelasList = kelasData?.data || [];

  // Daftar mapel produktif jurusan (semua tingkat) utk dropdown "Mata Pelajaran" di modal dokumen — murni DB.
  const { data: mapelSemuaData } = useCachedQuery(
    `pusjur:subjects-all:${id || 'none'}`,
    () => pusatJurusanAPI.getSubjects(id, '').then((r) => (Array.isArray(r.data) ? r.data : (r.data?.data || []))),
    { ttl: 60000, enabled: !!id },
  );
  const mapelSemua = useMemo(() => (Array.isArray(mapelSemuaData) ? mapelSemuaData : []), [mapelSemuaData]);

  // Seluruh jadwal (A/B/C) semua kelas jurusan — auto-sync saat tab fokus, bukan polling.
  // Filter Tingkat/Kelas/Pencarian diterapkan di sisi klien (default: Semua Tingkat & Semua Kelas).
  const {
    data: plotData, error: plotError, refetch: refetchPlot,
  } = useCachedQuery(
    `pusjur:jadwal-jurusan:${id || 'none'}`,
    () => pusatJurusanAPI.getPlottingJadwalJurusan(id).then((r) => r.data),
    { ttl: 30000, enabled: !!id },
  );
  const plotRows = useMemo(() => {
    const rows = plotData?.data;
    return Array.isArray(rows) ? rows : [];
  }, [plotData]);

  // Real-time sync: tarik ulang saat jendela/tab kembali fokus
  // (mis. Admin Akademik mengubah jadwal A/B di sesi lain).
  useEffect(() => {
    if (!id) return undefined;
    const onVis = () => { if (!document.hidden) refetchPlot(); };
    window.addEventListener('focus', refetchPlot);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('focus', refetchPlot); document.removeEventListener('visibilitychange', onVis); };
  }, [refetchPlot, id]);

  const loadMapel = useCallback(async () => {
    if (!id) return;
    try {
      const r = await pusatJurusanAPI.getSubjects(id, tingkat);
      setMapel(Array.isArray(r.data) ? r.data : (r.data?.data || []));
    } catch { /* autocomplete mapel C tidak kritikal */ }
  }, [id, tingkat]);

  useEffect(() => { loadMapel(); }, [loadMapel]);

  // Dokumen kurikulum — auto-sync saat tab fokus (terisolasi per jurusan).
  const {
    data: docsData, refetch: refetchDocs,
  } = useCachedQuery(
    `pusjur:docs-jurusan:${id || 'none'}`,
    () => pusatJurusanAPI.getCurriculumDocuments(id).then((r) => r.data),
    { ttl: 30000, enabled: !!id },
  );
  const docs = useMemo(() => (Array.isArray(docsData?.data) ? docsData.data : []), [docsData]);
  const loadingDocs = !docsData;

  // Auto-sync dokumen saat jendela/tab kembali fokus (pengganti polling agresif).
  useEffect(() => {
    if (!id) return undefined;
    const onVis = () => { if (!document.hidden) refetchDocs(); };
    window.addEventListener('focus', refetchDocs);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('focus', refetchDocs); document.removeEventListener('visibilitychange', onVis); };
  }, [refetchDocs, id]);

  // Kelas untuk dropdown Pilih Kelas — terfilter mengikuti Pilih Tingkat (murni dari DB).
  const kelasByTingkat = useMemo(
    () => (tingkat ? kelasList.filter((k) => String(k.tingkat || '').toUpperCase() === tingkat) : kelasList),
    [kelasList, tingkat],
  );
  // Filter Kelas terkunci sampai Tingkat dipilih. Saat Tingkat dikosongkan,
  // reset pilihan kelas ke "Semua Kelas". Saat ganti tingkat, reset kelas terpilih
  // bila tidak lagi berada pada tingkat yang dipilih.
  useEffect(() => {
    if (!tingkat) { setKelasId(null); return; }
    setKelasId((prev) => (prev && kelasByTingkat.some((k) => k.id === prev) ? prev : null));
  }, [kelasByTingkat, tingkat]);

  /* ── Aksi ── */

  const openKbm = (row) => { setErr(''); setKbmEditData(row ? { ...row } : null); setKbmModalOpen(true); };

  /* ── Dokumen Kurikulum ── */
  const openAddDokumen = () => setDokumenModal({ form: { ...emptyDokumen } });

  const submitDokumen = async (e) => {
    e.preventDefault();
    const f = dokumenModal.form;
    if (!f.title.trim() || !f.file) { setErr('Judul dan file dokumen wajib diisi.'); return; }
    setSavingDoc(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('title', f.title.trim());
      fd.append('document_type', f.documentType);
      if (f.subjectId) fd.append('subject_id', f.subjectId);
      if (f.tingkat) fd.append('grade_level', f.tingkat);
      if (f.notes) fd.append('notes', f.notes);
      fd.append('file', f.file);
      await pusatJurusanAPI.uploadCurriculumDocument(id, fd);
      setDokumenModal(null);
      await refetchDocs();
    } catch (e2) { setErr(e2?.response?.data?.message || 'Gagal mengunggah dokumen.'); }
    finally { setSavingDoc(false); }
  };

  const removeDoc = (doc) => {
    setConfirmState({
      title: 'Hapus Dokumen',
      message: `Hapus dokumen "${doc.title}"? File dan datanya akan dihapus permanen.`,
      confirmLabel: 'Ya, Hapus',
      onConfirm: async () => {
        setConfirmState((p) => ({ ...p, loading: true }));
        try { await pusatJurusanAPI.deleteCurriculumDocument(id, doc.id); setConfirmState(null); await refetchDocs(); }
        catch (e2) { setConfirmState((p) => ({ ...p, loading: false, message: e2?.response?.data?.message || 'Gagal menghapus dokumen.' })); }
      },
    });
  };

  const removePlot = (jadwalId) => {
    setConfirmState({
      title: 'Hapus Jadwal',
      message: 'Hapus jadwal ini dari kelas? Jam mengajar guru akan ikut terlepas dari kelas tersebut.',
      confirmLabel: 'Ya, Hapus',
      onConfirm: async () => {
        setConfirmState((p) => ({ ...p, loading: true }));
        try { await adminAkademikAPI.deleteJadwalGuru(jadwalId); setConfirmState(null); await refetchPlot(); }
        catch (e2) { setConfirmState((p) => ({ ...p, loading: false, message: e2?.response?.data?.message || 'Gagal menghapus jadwal.' })); }
      },
    });
  };

  const onKbmSuccess = async () => {
    await refetchPlot();
    loadMapel();
  };

  /* ── Derived: KPI agregat seluruh kelas jurusan + filter tampilan (murni DB) ── */

  const rowsC = plotRows.filter((r) => String(r.kelompok).toUpperCase() === 'C');
  const rowsAB = plotRows.filter((r) => String(r.kelompok).toUpperCase() !== 'C');
  const guruC = new Set(rowsC.map((r) => r.guru_id).filter(Boolean)).size;

  // Baris yang tampil di Tab 1: terfilter berjenjang Tingkat → Kelas → pencarian.
  const ql = q.trim().toLowerCase();
  const filteredRows = plotRows.filter((r) => {
    if (tingkat && String(r.tingkat || '').toUpperCase() !== tingkat) return false;
    if (kelasId && Number(r.kelas_id) !== Number(kelasId)) return false;
    if (!ql) return true;
    return [r.mapel_nama, r.guru_nama, r.hari, r.kode_belajar, r.kelas_nama].some((v) => String(v || '').toLowerCase().includes(ql));
  });
  const groupedHari = HARI
    .map((h) => ({ hari: h, rows: filteredRows.filter((r) => String(r.hari).toLowerCase() === h) }))
    .filter((g) => g.rows.length > 0);

  // Filter dokumen kurikulum (Tab 2): tingkat + pencarian judul/jenis/deskripsi.
  const qDocL = qDoc.trim().toLowerCase();
  const filteredDocs = docs.filter((d) => {
    if (docTingkat && String(d.grade_level || '') !== docTingkat) return false;
    if (!qDocL) return true;
    return [d.title, d.curriculum_name, d.notes, DOC_TYPES[d.document_type], d.document_type]
      .some((v) => String(v || '').toLowerCase().includes(qDocL));
  });

  const ghostSelectCls = "appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-600 outline-none transition-colors hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";
  const ctaGradCls = "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-500 hover:to-violet-500 hover:shadow-indigo-500/40";
  const modalSelectCls = "w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-3 pl-3 pr-9 text-sm font-semibold text-slate-700 outline-none transition-colors hover:bg-slate-100 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/30";
  const modalInputCls = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-300 hover:bg-slate-100 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/30";

  return (
    <div className="space-y-6">
      {/* ── HERO (bersih: tanpa tombol & filter) ── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#f5fde7] via-[#f8fdec] to-white p-6 text-slate-900 shadow-sm ring-1 ring-[#eaf8dc] xl:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
              <Cpu className="h-3 w-3" /> Portal Major Department Center
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-950 xl:text-5xl">Kurikulum &amp; Jadwal Produktif</h2>
          </div>
          <ActivePeriodCard tahunAjaran={periode.tahun_ajaran} semester={periode.semester} />
        </div>
      </section>

      {/* ── 4 MINI STAT CARD (agregat seluruh kelas jurusan, murni DB) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat grad="from-blue-600 to-indigo-600" icon={CalendarClock} watermark={BookOpen} value={rowsC.length} label="Jadwal Produktif (C)" />
        <MiniStat grad="from-slate-700 to-slate-800" icon={Lock} watermark={ShieldAlert} value={rowsAB.length} label="Jadwal Umum Terkunci (A/B)" />
        <MiniStat grad="from-emerald-600 to-teal-500" icon={Users} watermark={GraduationCap} value={guruC} label="Guru Produktif Terlibat" />
        <MiniStat grad="from-amber-500 to-orange-600" icon={FileText} watermark={FilePlus2} value={docs.length} label="Dokumen Kurikulum" />
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 ring-1 ring-inset ring-red-600/10"><AlertTriangle size={16} /> {err}</div>
      )}

      {/* ── TOOLBAR: seg tabs + (plotting: pill kelas + search) + CTA gradien ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {[{ key: 'plotting', label: 'Jadwal & Plotting KBM', icon: CalendarClock }, { key: 'kompetensi', label: 'Kurikulum Belajar', icon: BookOpen }].map((t) => (
              <button key={t.key} onClick={() => setSegTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all ${segTab === t.key ? 'bg-white font-semibold text-blue-600 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-700'}`}>
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          {segTab === 'plotting' ? (
            <button onClick={() => openKbm(null)} className={ctaGradCls + ' ml-auto'}>
              <Plus className="h-4 w-4" /> Tambah Mapel Produktif
            </button>
          ) : (
            <button onClick={openAddDokumen} className={ctaGradCls + ' ml-auto'}>
              <Plus className="h-4 w-4" /> Tambah Dokumen Kurikulum
            </button>
          )}
        </div>

        {segTab === 'plotting' && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            {/* Filter berjenjang 1: Pilih Tingkat */}
            <div className="relative">
              <GraduationCap className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select value={tingkat} onChange={(e) => setTingkat(e.target.value)} className={ghostSelectCls + ' pl-9'}>
                <option value="">Semua Tingkat</option>
                {TINGKAT.map((t) => <option key={t} value={t}>Tingkat {t}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            {/* Filter berjenjang 2: Pilih Kelas — terkunci sampai Tingkat dipilih (dari DB) */}
            <div className="relative">
              <BookOpen className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={kelasId ?? ''}
                onChange={(e) => setKelasId(e.target.value ? Number(e.target.value) : null)}
                className={ghostSelectCls + ' pl-9 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'}
                disabled={!tingkat || kelasByTingkat.length === 0}
                title={!tingkat ? 'Pilih Tingkat terlebih dahulu' : (kelasByTingkat.length === 0 ? 'Belum ada kelas di tingkat ini' : undefined)}
              >
                <option value="">Semua Kelas</option>
                {kelasByTingkat.map((k) => <option key={k.id} value={k.id}>{k.nama || k.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            {/* Filter 3: Kolom pencarian */}
            <div className="relative ml-auto w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari mapel, guru, hari, kode…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
              {q && <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
        )}

        {segTab === 'kompetensi' && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <div className="relative">
              <GraduationCap className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select value={docTingkat} onChange={(e) => setDocTingkat(e.target.value)} className={ghostSelectCls + ' pl-9'}>
                <option value="">Semua Tingkat</option>
                {TINGKAT.map((t) => <option key={t} value={t}>Tingkat {t}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="relative ml-auto w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={qDoc} onChange={(e) => setQDoc(e.target.value)} placeholder="Cari judul, jenis kurikulum, deskripsi…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
              {qDoc && <button onClick={() => setQDoc('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
        )}
      </div>

      {/* ── KONTEN ── */}
      {segTab === 'kompetensi' ? (
        <div className="space-y-6">
          {/* SECTION: Dokumen Kurikulum (curriculum_documents — murni DB) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-indigo-900 text-white"><FileText className="h-5 w-5" /></span>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Dokumen Kurikulum Belajar</h3>
                <p className="text-xs font-medium text-slate-400">CP/ATP · Silabus · Struktur Kurikulum · Modul — terisolasi per jurusan</p>
              </div>
              <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-500">{filteredDocs.length} dokumen</span>
            </div>
            {loadingDocs ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Memuat dokumen...</div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileX className="h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-500">Belum ada dokumen kurikulum untuk jurusan ini</p>
                <p className="mt-1 text-xs text-slate-400">Dokumen akan muncul setelah diunggah lewat tombol "Tambah Dokumen Kurikulum".</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileX className="h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-500">Tidak ada dokumen yang cocok dengan filter/pencarian</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDocs.map((d) => (
                  <div key={d.id} className="flex flex-col rounded-xl border border-slate-200 p-4 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ring-inset ${DOC_BADGE[d.document_type] || DOC_BADGE.silabus}`}>{DOC_TYPES[d.document_type] || d.document_type}</span>
                      {d.grade_level && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">Tingkat {d.grade_level}</span>}
                    </div>
                    <h4 className="mt-2 text-sm font-bold leading-snug text-slate-900">{d.title}</h4>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                      {d.curriculum_name || '—'}{d.academic_year ? ` · ${d.academic_year}` : ''}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {d.file_size ? `${(d.file_size / 1048576).toFixed(2)} MB` : '—'} · {d.uploader?.name || '—'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Diunggah {d.created_at ? new Date(d.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    </p>
                    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                      <a href={d.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100"><ExternalLink className="h-3.5 w-3.5" /> Lihat</a>
                      <a href={d.file_url} download className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"><Download className="h-3.5 w-3.5" /> Unduh</a>
                      <button onClick={() => removeDoc(d)} className="ml-auto rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus dokumen"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
           </section>
         </div>
      ) : (
        <div className="space-y-5">
          {plotError && !plotRows.length ? (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600"><AlertTriangle size={16} /> Gagal memuat jadwal jurusan.</div>
          ) : plotRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center">
              <FileX className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">Belum ada jadwal untuk jurusan ini</p>
              <p className="mt-1 text-xs text-slate-400">Jadwal akan muncul otomatis setelah ditambahkan ke database.</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center">
              <FileX className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">{(q || tingkat || kelasId) ? 'Tidak ada jadwal yang cocok dengan filter/pencarian' : 'Belum ada jadwal untuk jurusan ini'}</p>
            </div>
          ) : (
            groupedHari.map(({ hari, rows }) => (
              <div key={hari} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-indigo-900 text-[10px] font-black uppercase tracking-widest text-white">{hari.slice(0, 3)}</span>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-700">{hari}</h4>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-500">{rows.length} jadwal</span>
                </div>
                <div className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {rows.map((r) => (
                      <JadwalRow key={r.id} r={r} onEdit={openKbm} onDelete={removePlot} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MODAL DOKUMEN KURIKULUM ── */}
      {dokumenModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setDokumenModal(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <form onSubmit={submitDokumen}>
              <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-4">
                <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-indigo-500/30 blur-2xl" />
                <div className="relative flex items-center justify-between">
                  <h3 className="text-xl font-black tracking-tight text-white">Tambah Dokumen Kurikulum</h3>
                  <button type="button" onClick={() => setDokumenModal(null)} className="rounded-xl p-2 text-indigo-200 transition-colors hover:bg-white/10 hover:text-white"><X size={18} /></button>
                </div>
              </div>
              <div className="max-h-[72vh] overflow-y-auto p-6">
                <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  {/* Section header */}
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Info className="h-4 w-4 text-violet-600" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Upload Dokumen Kurikulum</h4>
                  </div>

                  {/* Baris 1: Mata Pelajaran + Jurusan (terkunci ke akun) */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Mata Pelajaran</label>
                      <div className="relative">
                        <select value={dokumenModal.form.subjectId} onChange={(e) => setDokumenModal((p) => ({ ...p, form: { ...p.form, subjectId: e.target.value } }))} className={modalSelectCls}>
                          <option value="">— Pilih Mapel —</option>
                          {mapelSemua.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Jurusan</label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input readOnly value={dsum?.jurusan?.name || selectedJurusan?.name || '—'} title="Terkunci ke jurusan akun Anda" className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 py-3 pl-9 pr-3 text-sm font-semibold text-slate-500 outline-none" />
                      </div>
                      <p className="ml-1 text-[10px] font-medium text-slate-400">Terkunci otomatis ke jurusan akun Anda.</p>
                    </div>
                  </div>

                  {/* Baris 2: Tipe Dokumen + Tingkat */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipe Dokumen</label>
                      <div className="relative">
                        <select value={dokumenModal.form.documentType} onChange={(e) => setDokumenModal((p) => ({ ...p, form: { ...p.form, documentType: e.target.value } }))} className={modalSelectCls}>
                          <option value="cp">Capaian Pembelajaran (CP)</option>
                          <option value="atp">Alur Tujuan Pembelajaran (ATP)</option>
                          <option value="silabus">Silabus</option>
                          <option value="modul">Modul Ajar</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Tingkat</label>
                      <div className="relative">
                        <select value={dokumenModal.form.tingkat} onChange={(e) => setDokumenModal((p) => ({ ...p, form: { ...p.form, tingkat: e.target.value } }))} className={modalSelectCls}>
                          {TINGKAT.map((t) => <option key={t} value={t}>Tingkat {t}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Baris 3: Judul Dokumen (wajib) */}
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Judul Dokumen <span className="text-red-500">*</span></label>
                    <input required value={dokumenModal.form.title} onChange={(e) => setDokumenModal((p) => ({ ...p, form: { ...p.form, title: e.target.value } }))} placeholder="Cth: CP Matematika Kelas X TKJ" className={modalInputCls} />
                  </div>

                  {/* Area upload file */}
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">File <span className="font-normal normal-case text-slate-300">.pdf / .doc / .docx — maks. 10 MB</span></label>
                    <label className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition-colors ${dokumenModal.form.file ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50' : 'border-indigo-300 bg-indigo-50/40 hover:border-indigo-400 hover:bg-indigo-50/70'}`}>
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm"><FileText className="h-6 w-6" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800">{dokumenModal.form.file ? dokumenModal.form.file.name : 'Pilih dokumen kurikulum'}</span>
                        <span className="block text-xs font-medium text-slate-400">PDF, DOC, atau DOCX · maksimum 10 MB</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-violet-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-violet-600">{dokumenModal.form.file ? 'Ganti' : 'Pilih File'}</span>
                      <input type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={(e) => setDokumenModal((p) => ({ ...p, form: { ...p.form, file: e.target.files?.[0] || null } }))} />
                    </label>
                    {dokumenModal.form.file && <p className="ml-1 text-xs font-semibold text-emerald-600">{dokumenModal.form.file.name} · {(dokumenModal.form.file.size / 1048576).toFixed(2)} MB</p>}
                  </div>

                  {/* Catatan */}
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Catatan <span className="font-normal normal-case text-slate-300">(opsional)</span></label>
                    <textarea rows={3} value={dokumenModal.form.notes} onChange={(e) => setDokumenModal((p) => ({ ...p, form: { ...p.form, notes: e.target.value } }))} placeholder="Catatan tambahan (opsional)" className={modalInputCls} />
                  </div>
                </div>
              </div>
              <div className="flex justify-center border-t border-slate-200 bg-slate-50 px-6 py-5">
                <button type="submit" disabled={savingDoc} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-8 py-4 text-base font-black text-white shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 hover:from-blue-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60">
                  {savingDoc && <Loader2 className="h-5 w-5 animate-spin" />} Simpan Kurikulum
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      , document.body)}

      {/* ── MODAL JADWAL KBM (komponen shared) ── */}
      <KelolaKbmModal
        isOpen={kbmModalOpen}
        onClose={() => setKbmModalOpen(false)}
        onSuccess={onKbmSuccess}
        userRole="pusat_jurusan"
        userJurusanId={id}
        defaultClassId=""
        editData={kbmEditData}
        kelasList={kelasList}
        mapelList={mapel}
        existingRows={plotRows}
      />

      {/* ── KONFIRMASI HAPUS IN-APP (blur layar, bukan dialog browser) ── */}
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
};

export default KurikulumJadwalPage;
