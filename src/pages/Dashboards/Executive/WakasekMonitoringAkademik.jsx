import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Clock, CalendarCheck, BookOpen, Layers, Users, Eye, Filter, Search,
  FileSpreadsheet, Printer, ClipboardList, CheckCircle2, AlertCircle, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { previewWakasekMonitoringKbmPDF } from '../../../utils/wakasekMonitoringKbmPdf';

const capitalize = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase() : '-');
const jamTxt = (mulai, selesai) => {
  const a = mulai ? String(mulai).slice(0, 5) : null;
  const b = selesai ? String(selesai).slice(0, 5) : null;
  if (!a && !b) return '-';
  return `${a || '-'} - ${b || '-'}`;
};

// Kartu KPI house-style (identik Menu ke-2): rounded-3xl, gradasi pastel→putih, watermark, hover lift.
function KpiCard({ label, value, sub, icon: Icon, accent, highlight, delay }) {
  return (
    <div
      className={`kpi-hover animate-fade-in-up relative overflow-hidden rounded-3xl border ${highlight ? 'border-rose-300' : accent.border} bg-gradient-to-br ${accent.grad} p-6 shadow-sm`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative z-10 flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 ${accent.chip} rounded-2xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${accent.text}`} />
        </div>
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="relative z-10 text-3xl font-black text-slate-900">{value}</p>
      {sub ? <p className={`relative z-10 mt-1 text-xs font-semibold ${highlight ? 'text-rose-600' : 'text-slate-500'}`}>{sub}</p> : null}
      <Icon className={`kpi-watermark pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${accent.text} opacity-[0.07]`} />
    </div>
  );
}

const WakasekMonitoringAkademik = ({ stats, clock, accessRole, user }) => {
  const section = useMemo(
    () => stats?.executive?.vice_principal?.sections?.wakasek_academics || {},
    [stats],
  );
  const kpis = useMemo(() => section.kpis || {}, [section]);
  const chart = useMemo(() => section.classes_chart || [], [section]);
  const recentJournals = useMemo(() => section.recent_journals || [], [section]);
  const slots = useMemo(() => section.slots || [], [section]);
  const filterOptions = useMemo(() => section.filter_options || {}, [section]);
  const period = useMemo(() => section.period || {}, [section]);

  const [filters, setFilters] = useState({ kelas: 'all', guru: 'all' });
  const [searchText, setSearchText] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

  const modalOpen = !!detailModal;
  useEscapeKey(modalOpen, () => setDetailModal(null));
  useBodyScrollLock(modalOpen);

  const kelasOptions = useMemo(() => filterOptions.classes || [], [filterOptions]);
  const guruOptions = useMemo(() => filterOptions.teachers || [], [filterOptions]);

  const filteredSlots = useMemo(() => slots.filter((s) => {
    if (filters.kelas !== 'all' && String(s.kelas_id) !== String(filters.kelas)) return false;
    if (filters.guru !== 'all' && String(s.guru_id) !== String(filters.guru)) return false;
    if (searchText.trim()) {
      const hay = `${s.mapel_name} ${s.guru_name}`.toLowerCase();
      if (!hay.includes(searchText.toLowerCase())) return false;
    }
    return true;
  }), [slots, filters, searchText]);

  const totalRombel = chart.length;
  const loading = !stats;

  const handleExportExcel = () => {
    if (!filteredSlots.length) { toast.error('Belum ada data untuk diekspor.'); return; }
    const data = filteredSlots.map((s, i) => ({
      No: i + 1,
      'Guru Pengampu': s.guru_name || '-',
      NIP: s.guru_nip || '-',
      'Mata Pelajaran': s.mapel_name || '-',
      Kelas: s.kelas_name || '-',
      Hari: capitalize(s.hari),
      Jam: jamTxt(s.jam_mulai, s.jam_selesai),
      'Jurnal KBM': s.jurnal_count ?? 0,
      'Bahan Ajar': s.perangkat_count ?? 0,
      Status: (s.jurnal_count ?? 0) > 0 ? 'Aktif Mengisi' : 'Belum Ada Jurnal',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monitoring KBM');
    const label = (period.tahun_ajaran || 'Periode').replace(/[^\w]+/g, '_');
    XLSX.writeFile(wb, `Monitoring_KBM_Wakasek_${label}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewWakasekMonitoringKbmPDF({
        rows: filteredSlots,
        period,
        wakilName: user?.name,
        wakilNip: user?.nisn_nip || user?.nip || user?.school_id || null,
      });
      if (res) setPdfPreview(res);
    } catch { /* toast sudah ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat monitoring KBM & perangkat ajar..." />;

  const clockObj = clock || { time: '', day: '', date: '' };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner khusus Wakasek (seragam dgn Menu ke-2) ── */}
      <div className="animate-fade-in-up relative overflow-hidden rounded-[3rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-7 lg:p-9 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> Portal Vice Principal Authority
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Monitoring KBM &amp; Perangkat Ajar</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600 whitespace-nowrap">
              Pantau jadwal pelajaran harian, jurnal mengajar guru, dan bahan ajar.
            </p>
          </div>
          {/* Clock WIB live */}
          <div className="flex flex-col items-end gap-1 px-4 py-2 rounded-2xl bg-white/80 border border-amber-100 shadow-sm shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clockObj.day},</span>
              <span className="text-xs font-bold text-slate-500">{clockObj.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clockObj.time}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Kartu KPI (stagger) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 stagger-grid">
        <KpiCard
          label="Total Jadwal KBM Aktif"
          value={kpis.total_jadwal ?? 0}
          sub="Sesi terjadwal di jadwal_guru"
          icon={CalendarCheck}
          accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }}
        />
        <KpiCard
          label="Realisasi Jurnal Mengajar"
          value={kpis.jurnal_terisi ?? 0}
          sub={kpis.realisasi_pct == null ? 'Belum ada jadwal sebagai acuan' : `${kpis.realisasi_pct}% dari ${kpis.total_jadwal ?? 0} jadwal`}
          icon={BookOpen}
          accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }}
        />
        <KpiCard
          label="Perangkat & Bahan Ajar"
          value={kpis.perangkat_ajar ?? 0}
          sub={(kpis.perangkat_ajar ?? 0) > 0 ? 'Modul/materi terunggah guru' : 'Belum ada modul bahan ajar terunggah'}
          highlight={(kpis.perangkat_ajar ?? 0) === 0}
          icon={Layers}
          accent={{ grad: 'from-violet-50/90 via-white to-violet-50/50', border: 'border-violet-200/70', chip: 'bg-violet-100', text: 'text-violet-600' }}
        />
        <KpiCard
          label="Cakupan Kelas & Guru Aktif"
          value={`${kpis.kelas_log_aktif ?? 0}/${totalRombel}`}
          sub={`${kpis.guru_pengajar ?? 0} guru pengajar aktif`}
          icon={Users}
          accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }}
        />
      </div>

      {/* ── Panel Ringkasan Visual 2 Kolom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Realisasi Jurnal KBM per Rombongan Belajar</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">Perbandingan jurnal terisi terhadap total jadwal mengajar tiap kelas (riil).</p>
          <JurnalChart rows={chart} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-black text-slate-900">Log Jurnal Mengajar Terbaru</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">5 catatan jurnal KBM terakhir yang diisi guru.</p>
          <RecentJournalFeed items={recentJournals} />
        </div>
      </div>

      {/* ── Filter & Ekspor ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <FilterSelect label="Kelas" value={filters.kelas} onChange={(v) => setFilters((f) => ({ ...f, kelas: v }))} options={kelasOptions} allLabel="Semua Kelas" emptyLabel="Belum ada kelas" />
            <FilterSelect label="Guru" value={filters.guru} onChange={(v) => setFilters((f) => ({ ...f, guru: v }))} options={guruOptions} allLabel="Semua Guru" emptyLabel="Belum ada guru pengajar" />
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
              <Search className="h-4 w-4" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Cari mapel / guru"
                className="bg-transparent outline-none max-w-[14rem]"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportExcel}
              disabled={!filteredSlots.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4" /> Ekspor Monitoring KBM (.xlsx)
            </button>
            <button
              onClick={handlePrintPDF}
              disabled={!filteredSlots.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" /> Cetak Laporan Monitoring KBM (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel Monitoring KBM ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Guru Pengampu', 'Mata Pelajaran & Kelas', 'Hari & Jam Jadwal', 'Jurnal KBM', 'Perangkat Ajar', 'Aksi'].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSlots.length > 0 ? filteredSlots.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{s.guru_name || '-'}</p>
                    <p className="text-xs text-slate-500">NIP: {s.guru_nip || '-'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-800">{s.mapel_name || '-'}</p>
                    <span className="mt-1 inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700">{s.kelas_name || '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <p className="font-bold text-slate-800">{capitalize(s.hari)}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{jamTxt(s.jam_mulai, s.jam_selesai)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${s.jurnal_count > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {s.jurnal_count > 0 ? `${s.jurnal_count} jurnal · Aktif Mengisi` : 'Belum Ada Jurnal'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-black ${s.perangkat_count > 0 ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                      {s.perangkat_count} modul
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setDetailModal(s)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      <Eye className="h-4 w-4" /> Detail KBM
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <CalendarCheck className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada jadwal mengajar</p>
                      <p className="text-xs text-slate-500">Sesuaikan filter kelas/guru, atau data jadwal akan muncul saat guru menginput jadwal mengajar.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailModal ? (
        <KbmDetailModal slot={detailModal} onClose={() => setDetailModal(null)} />
      ) : null}

      <RaporPdfPreview
        state={pdfPreview}
        onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
        title="Pratinjau Laporan Monitoring KBM (PDF)"
        downloadLabel="Unduh Laporan"
      />
    </div>
  );
};

/* ── Grafik batang horizontal SVG: jurnal terisi vs total jadwal per kelas ── */
const JurnalChart = ({ rows }) => {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <Activity className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada data kelas</p>
      </div>
    );
  }
  const max = Math.max(...rows.flatMap((r) => [r.schedule_count || 0, r.journal_count || 0]), 1);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-400" /> Total Jadwal</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Jurnal Terisi</span>
      </div>
      {rows.map((r, i) => {
        const sched = r.schedule_count || 0;
        const jurn = r.journal_count || 0;
        return (
          <div key={`${r.name}-${i}`}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-bold text-slate-700">{r.name}</span>
              <span className="text-xs font-black text-slate-500">{jurn} / {sched} jurnal</span>
            </div>
            <svg width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none" className="overflow-visible">
              <rect x="0" y="3" width="100" height="7" rx="1.5" fill="#f1f5f9" />
              <rect
                x="0" y="3" width={(sched / max) * 100} height="7" rx="1.5" fill="#94a3b8"
                className="animate-grow-x" style={{ transformBox: 'fill-box', transformOrigin: 'left center', animationDelay: `${i * 70}ms` }}
              />
              <rect x="0" y="14" width="100" height="7" rx="1.5" fill="#f1f5f9" />
              {jurn > 0 && (
                <rect
                  x="0" y="14" width={(jurn / max) * 100} height="7" rx="1.5" fill="#10b981"
                  className="animate-grow-x" style={{ transformBox: 'fill-box', transformOrigin: 'left center', animationDelay: `${i * 70 + 35}ms` }}
                />
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
};

/* ── Feed jurnal mengajar terbaru ── */
const RecentJournalFeed = ({ items }) => {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <ClipboardList className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada jurnal KBM tercatat</p>
        <p className="text-xs text-slate-500 max-w-xs">Riwayat pengisian jurnal mengajar guru akan muncul di sini secara otomatis.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
      {items.map((j, i) => (
        <li key={j.id ?? i} className="animate-fade-in-up rounded-xl border border-slate-100 bg-slate-50 px-4 py-3" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-900 truncate">{j.guru_name}</p>
            <span className="shrink-0 text-[11px] font-bold text-slate-400">{j.tanggal || '-'}</span>
          </div>
          <p className="mt-1 text-xs font-bold text-indigo-600">{j.mapel_name} · {j.kelas_name}</p>
          {j.materi_pokok ? <p className="mt-1 text-sm text-slate-600 line-clamp-2">{j.materi_pokok}</p> : null}
          {j.catatan ? <p className="mt-1 text-xs text-slate-400 italic">Catatan: {j.catatan}</p> : null}
        </li>
      ))}
    </ul>
  );
};

const FilterSelect = ({ label, value, onChange, options, allLabel, emptyLabel }) => {
  const disabled = options.length === 0;
  return (
    <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
      <Filter className="h-4 w-4" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-transparent outline-none max-w-[12rem]"
      >
        <option value="all">{disabled ? emptyLabel : allLabel}</option>
        {options.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
      </select>
    </label>
  );
};

/* ── Modal Detail KBM (riwayat jurnal + perangkat ajar) ── */
const KbmDetailModal = ({ slot, onClose }) => {
  const journals = slot.journals || [];
  const perangkat = slot.perangkat || [];
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-sky-600 to-indigo-700 px-7 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-100">Detail KBM</p>
            <h3 className="text-xl font-black text-white">{slot.mapel_name} · {slot.kelas_name}</h3>
            <p className="mt-0.5 text-xs text-sky-50">
              {slot.guru_name}{slot.guru_nip ? ` (NIP ${slot.guru_nip})` : ''} · {capitalize(slot.hari)} {jamTxt(slot.jam_mulai, slot.jam_selesai)}
            </p>
          </div>
          <ModalCloseControl onClose={onClose} tone="onDark" />
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <MiniStat label="Jurnal Terisi" value={slot.jurnal_count ?? 0} />
            <MiniStat label="Bahan Ajar" value={slot.perangkat_count ?? 0} />
            <MiniStat label="Status" value={slot.jurnal_count > 0 ? 'Aktif' : 'Belum'} />
          </div>

          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Riwayat Jurnal Mengajar ({journals.length})</p>
          {journals.length ? (
            <ul className="space-y-2 max-h-52 overflow-y-auto pr-1 mb-5">
              {journals.map((j, i) => (
                <li key={j.id ?? i} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800">{j.materi_pokok || 'Tanpa pokok bahasan'}</span>
                    <span className="shrink-0 text-[11px] font-bold text-slate-400">{j.tanggal || '-'}{j.jam_ke ? ` · ${String(j.jam_ke).slice(0, 5)}` : ''}</span>
                  </div>
                  {j.sub_materi ? <p className="mt-1 text-xs text-slate-500">Sub: {j.sub_materi}</p> : null}
                  {j.kegiatan_inti ? <p className="mt-1 text-xs text-slate-500 line-clamp-2">Kegiatan inti: {j.kegiatan_inti}</p> : null}
                  {j.catatan ? <p className="mt-1 text-xs text-slate-400 italic">Catatan: {j.catatan}</p> : null}
                  {(j.siswa_tuntas != null || j.siswa_belum_tuntas != null) && (
                    <p className="mt-1 text-[11px] font-bold text-emerald-600">Tuntas {j.siswa_tuntas ?? 0} · Belum {j.siswa_belum_tuntas ?? 0}{j.persentase != null ? ` · ${j.persentase}%` : ''}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 mb-4 text-center rounded-xl border border-dashed border-slate-200">
              <CheckCircle2 className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada jurnal untuk pengampu ini</p>
            </div>
          )}

          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Perangkat / Bahan Ajar ({perangkat.length})</p>
          {perangkat.length ? (
            <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {perangkat.map((p, i) => (
                <li key={`${p.judul}-${i}`} className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-700">
                  <Layers className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="font-bold">{p.judul}</span>
                  {p.topik ? <span className="text-xs text-slate-500">— {p.topik}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400 italic">
              <AlertCircle className="h-4 w-4" /> Belum ada bahan ajar terunggah untuk mapel & kelas ini.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

const MiniStat = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
    <p className="text-lg font-black text-slate-900">{value}</p>
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
  </div>
);

export default WakasekMonitoringAkademik;
