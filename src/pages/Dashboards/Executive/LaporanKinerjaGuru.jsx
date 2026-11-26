import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Clock, Users, UserCheck, Award, AlertTriangle,
  FileSpreadsheet, Printer, Eye, Filter, BarChart3, ClipboardList,
  Search, Save, BookOpen, CalendarCheck, PenLine,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { managementAPI } from '../../../utils/api';
import { previewKinerjaTenagaDidikPDF } from '../../../utils/kinerjaTenagaDidikPdf';

const normalizeSem = (raw) => {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'ganjil' || s === '1' || s === 'satu') return 'Ganjil';
  if (s === 'genap' || s === '2' || s === 'dua') return 'Genap';
  return null;
};

// Ambang predikat — identik dengan backend (PKG_MIN_SANGAT_BAIK/BAIK/CUKUP).
const TH = { sangatBaik: 90, baik: 80, cukup: 75 };
const predikatFor = (score) => {
  if (score >= TH.sangatBaik) return 'Sangat Baik';
  if (score >= TH.baik) return 'Baik';
  if (score >= TH.cukup) return 'Cukup';
  return 'Perlu Pembinaan';
};
const PREDIKAT_STYLE = {
  'Sangat Baik': 'bg-emerald-50 text-emerald-700',
  'Baik': 'bg-sky-50 text-sky-700',
  'Cukup': 'bg-amber-50 text-amber-700',
  'Perlu Pembinaan': 'bg-rose-50 text-rose-700',
  'Belum Dinilai': 'bg-slate-100 text-slate-500',
};
const ASPEK = [
  { key: 'discipline_score', label: 'Kedisiplinan & Kehadiran' },
  { key: 'admin_score', label: 'Administrasi & Jurnal KBM' },
  { key: 'teaching_quality_score', label: 'Kualitas Pembelajaran' },
  { key: 'loyalty_score', label: 'Loyalitas & Kolaborasi' },
];

function KpiCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border ${accent.border} bg-gradient-to-br ${accent.grad} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}>
      <div className="relative z-10 flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 ${accent.chip} rounded-2xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${accent.text}`} />
        </div>
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="relative z-10 text-3xl font-black text-slate-900">{value}</p>
      {sub ? <p className="relative z-10 mt-1 text-xs font-semibold text-slate-500">{sub}</p> : null}
      <Icon className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${accent.text} opacity-[0.07]`} />
    </div>
  );
}

const Donut = ({ segments, size = 150, thickness = 20 }) => {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  const r = size / 2 - thickness / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 animate-draw-in">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2f7" strokeWidth={thickness} />
      {total > 0 && segments.filter((s) => s.value > 0).map((s, i) => {
        const len = (s.value / total) * C;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`} />
        );
        offset += len;
        return el;
      })}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="900" fill="#0f172a">{total}</text>
    </svg>
  );
};

const LaporanKinerjaGuru = ({ stats: parentStats, clock, accessRole }) => {
  const section = parentStats?.executive?.teacher_performance;
  const [localSection, setLocalSection] = useState(null);
  const pkg = localSection || section;

  const teachers = useMemo(() => pkg?.teachers || [], [pkg]);
  const academicOptions = useMemo(() => pkg?.academic_options || [], [pkg]);
  const period = pkg?.period || {};

  const [filters, setFilters] = useState({ tahunAjaran: 'all', semester: 'all', status: 'all', search: '' });
  const [valueTarget, setValueTarget] = useState(null);   // modal input/edit
  const [detailTarget, setDetailTarget] = useState(null); // modal read-only
  const [pdfPreview, setPdfPreview] = useState(null);
  const valueOpen = !!valueTarget;
  const detailOpen = !!detailTarget;
  useEscapeKey(valueOpen, () => setValueTarget(null));
  useEscapeKey(detailOpen && !valueOpen, () => setDetailTarget(null));
  useBodyScrollLock(valueOpen || detailOpen);

  useEffect(() => {
    if (pkg?.period?.tahun_ajaran) {
      setFilters((f) => (f.tahunAjaran === 'all' && f.semester === 'all'
        ? { ...f, tahunAjaran: pkg.period.tahun_ajaran, semester: pkg.period.semester || 'all' }
        : f));
    }
  }, [pkg?.period?.tahun_ajaran, pkg?.period?.semester]);

  const reload = async () => {
    try {
      const r = await managementAPI.getStats();
      setLocalSection(r.data?.data?.executive?.teacher_performance || null);
    } catch { /* pertahankan data lama */ }
  };

  const taOptions = useMemo(() => {
    const set = new Set(academicOptions.map((o) => o.academic_year).filter(Boolean));
    teachers.forEach((t) => { if (t.pkg?.tahun_ajaran) set.add(t.pkg.tahun_ajaran); });
    return [...set].sort().reverse();
  }, [academicOptions, teachers]);

  const semesterOptions = useMemo(() => {
    const set = new Set();
    academicOptions.forEach((o) => {
      if (filters.tahunAjaran !== 'all' && o.academic_year !== filters.tahunAjaran) return;
      const s = normalizeSem(o.semester); if (s) set.add(s);
    });
    teachers.forEach((t) => {
      if (filters.tahunAjaran !== 'all' && t.pkg?.tahun_ajaran && t.pkg.tahun_ajaran !== filters.tahunAjaran) return;
      const s = normalizeSem(t.pkg?.semester); if (s) set.add(s);
    });
    return [...set].sort();
  }, [academicOptions, teachers, filters.tahunAjaran]);

  const filtered = useMemo(() => teachers.filter((t) => {
    const hasPkg = !!t.pkg;
    if (filters.status === 'dinilai' && !hasPkg) return false;
    if (filters.status === 'belum' && hasPkg) return false;
    if (filters.tahunAjaran !== 'all' && hasPkg && t.pkg.tahun_ajaran && t.pkg.tahun_ajaran !== filters.tahunAjaran) return false;
    if (filters.semester !== 'all' && hasPkg && t.pkg.semester && normalizeSem(t.pkg.semester) !== filters.semester) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!((t.name || '').toLowerCase().includes(q) || String(t.nip || '').includes(q))) return false;
    }
    return true;
  }), [teachers, filters]);

  // KPI & visual disinkronkan dengan baris terfilter.
  const agg = useMemo(() => {
    const dinilai = filtered.filter((t) => t.pkg);
    const scores = dinilai.map((t) => Number(t.pkg.score) || 0);
    const rata = scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length) : null;
    const rendah = scores.filter((s) => s < TH.cukup).length;
    const belum = filtered.length - dinilai.length;
    const buckets = { 'Sangat Baik': 0, 'Baik': 0, 'Cukup': 0, 'Perlu Pembinaan': 0, 'Belum Dinilai': belum };
    dinilai.forEach((t) => { buckets[t.pkg.predikat] = (buckets[t.pkg.predikat] || 0) + 1; });
    const colors = { 'Sangat Baik': '#10b981', 'Baik': '#0ea5e9', 'Cukup': '#f59e0b', 'Perlu Pembinaan': '#f43f5e', 'Belum Dinilai': '#94a3b8' };
    const chart = Object.entries(buckets).map(([label, value]) => ({ label, value, color: colors[label] }));
    const withJadwal = filtered.filter((t) => (t.beban_ajar?.jadwal_count || 0) > 0);
    const palingAktif = [...filtered].sort((a, b) => (b.jurnal_terisi || 0) - (a.jurnal_terisi || 0)).find((t) => (t.jurnal_terisi || 0) > 0) || null;
    const jurnalNol = withJadwal.filter((t) => (t.jurnal_terisi || 0) === 0).map((t) => ({ name: t.name, jadwal_count: t.beban_ajar.jadwal_count }));
    return {
      total: filtered.length,
      dinilai: dinilai.length,
      rata: rata != null ? rata.toFixed(1) : null,
      perluPembinaan: belum + rendah,
      belum, rendah,
      chart,
      palingAktif: palingAktif ? { name: palingAktif.name, jurnal_terisi: palingAktif.jurnal_terisi, jadwal_count: palingAktif.beban_ajar.jadwal_count } : null,
      jurnalNol,
    };
  }, [filtered]);

  const loading = !parentStats;

  const handleExportExcel = () => {
    if (!filtered.length) return;
    const data = filtered.map((t, i) => ({
      No: i + 1,
      Nama: t.name || '-',
      'NIP/NUPTK': t.nip || '-',
      Peran: t.role_label || '-',
      Mapel: t.beban_ajar?.mapel_count ?? 0,
      Kelas: t.beban_ajar?.kelas_count ?? 0,
      'Jurnal KBM': t.jurnal_terisi ?? 0,
      'Kehadiran (hari)': t.kehadiran_hari ?? 0,
      Skor: t.pkg?.score ?? '-',
      Predikat: t.pkg?.predikat || 'Belum Dinilai',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Kinerja');
    XLSX.writeFile(wb, `Rekap_Kinerja_Tenaga_Didik_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewKinerjaTenagaDidikPDF({ rows: filtered, period });
      if (res) setPdfPreview(res);
    } catch { /* toast ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat evaluasi kinerja tenaga didik..." />;

  const clockObj = clock || { time: '', day: '', date: '' };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner (identik Menu ke-2/3/4) ── */}
      <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-6 lg:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> {accessRole === 'wakil_sekolah' ? 'Portal Vice Principal Authority' : 'Portal Principal Authority'}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Evaluasi Kinerja Tenaga Didik</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Penilaian kinerja pendidik berbasis indikator kedisiplinan, kelengkapan perangkat &amp; jurnal KBM, serta kualitas pembelajaran.
            </p>
          </div>
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

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 stagger-grid">
        <KpiCard label="Total Tenaga Didik" value={String(agg.total)} sub="guru aktif di sekolah" icon={Users} accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }} />
        <KpiCard label="Sudah Dievaluasi" value={`${agg.dinilai}/${agg.total}`} sub="punya nilai PKG periode ini" icon={UserCheck} accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }} />
        <KpiCard label="Rata-Rata Skor Kinerja" value={agg.rata != null ? agg.rata : 'Belum dinilai'} sub={agg.rata != null ? `Dari ${agg.dinilai} guru dinilai` : 'Belum ada PKG tersimpan'} icon={Award} accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }} />
        <KpiCard label="Perlu Pembinaan / Pending" value={String(agg.perluPembinaan)} sub={`${agg.belum} belum · ${agg.rendah} skor < ${TH.cukup}`} icon={AlertTriangle} accent={{ grad: 'from-rose-50/90 via-white to-rose-50/50', border: 'border-rose-200/70', chip: 'bg-rose-100', text: 'text-rose-600' }} />
      </div>

      {/* ── Panel Ringkasan Visual 2 Kolom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Sebaran Predikat Kinerja Tenaga Didik</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">Jumlah guru per predikat (riil, termasuk yang belum dinilai).</p>
          {agg.total === 0 ? (
            <EmptyViz text="Belum ada data guru" note="Sebaran muncul setelah daftar tenaga didik tersedia." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="flex flex-col items-center gap-3">
                <Donut segments={agg.chart} />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-bold text-slate-600">
                  {agg.chart.map((c) => (
                    <span key={c.label} className="flex items-center gap-1.5">
                      <i className="w-3 h-3 rounded-full inline-block" style={{ background: c.color }} /> {c.label} {c.value}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5">
                {agg.chart.map((c) => (
                  <PredikatBar key={c.label} label={c.label} value={c.value} max={Math.max(...agg.chart.map((x) => x.value), 1)} color={c.color} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-black text-slate-900">Indikator Objektif KBM &amp; Keaktifan Guru</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">Pertimbangan riil dari pengisian jurnal KBM &amp; beban jadwal mengajar.</p>

          {agg.total === 0 ? (
            <EmptyViz text="Belum ada data guru" note="Indikator muncul setelah tenaga didik &amp; jadwal tersedia." />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600 mb-1">Guru paling aktif mengisi jurnal</p>
                {agg.palingAktif ? (
                  <p className="text-sm font-black text-slate-900">{agg.palingAktif.name}
                    <span className="block text-xs font-semibold text-slate-500 mt-0.5">{agg.palingAktif.jurnal_terisi} jurnal terisi · {agg.palingAktif.jadwal_count} jadwal mengajar</span>
                  </p>
                ) : (
                  <p className="text-sm font-bold text-slate-500 italic">Belum ada jurnal KBM terisi.</p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Jurnal KBM masih 0 (perlu didorong)</p>
                {agg.jurnalNol.length ? (
                  <ul className="space-y-2">
                    {agg.jurnalNol.map((t) => (
                      <li key={t.name} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                        <span className="text-sm font-bold text-slate-800">{t.name}</span>
                        <span className="text-xs font-black text-rose-600">{t.jadwal_count} jadwal · 0 jurnal</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs font-semibold text-slate-500 italic">Semua guru berjadwal telah mengisi jurnal KBM.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter & Ekspor ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
            <FilterSelect label="Tahun Ajaran" value={filters.tahunAjaran} onChange={(v) => setFilters((f) => ({ ...f, tahunAjaran: v, semester: 'all' }))} options={taOptions} allLabel="Semua Tahun Ajaran" emptyLabel="Belum ada data TA" />
            <FilterSelect label="Semester" value={filters.semester} onChange={(v) => setFilters((f) => ({ ...f, semester: v }))} options={semesterOptions} allLabel="Semua Semester" emptyLabel="Belum ada data" />
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={['dinilai', 'belum']} allLabel="Semua Status" emptyLabel="Semua Status" labelMap={{ dinilai: 'Sudah Dinilai', belum: 'Belum Dinilai' }} />
            <label className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
              <Search className="h-4 w-4" />
              <input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Cari nama / NIP..." className="bg-transparent outline-none w-40" />
            </label>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <button onClick={handleExportExcel} disabled={!filtered.length} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <FileSpreadsheet className="h-4 w-4" /> Ekspor Rekap Kinerja (.xlsx)
            </button>
            <button onClick={handlePrintPDF} disabled={!filtered.length} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Printer className="h-4 w-4" /> Cetak Laporan Evaluasi (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel Evaluasi ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Tenaga Didik', 'Peran & Wali Kelas', 'Beban Ajar & Jurnal KBM', 'Skor & Predikat PKG', 'Aksi'].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-slate-900">{t.name || '-'}</p>
                    <p className="text-xs text-slate-500">NIP/NUPTK: {t.nip || '-'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-slate-800">{t.role_label}</p>
                    <p className="text-xs text-slate-500">{t.position_label}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-700">{t.beban_ajar?.mapel_count ?? 0} mapel · {t.beban_ajar?.kelas_count ?? 0} kelas</p>
                    <p className="text-xs text-slate-500">Jurnal KBM: <span className={`font-black ${(t.jurnal_terisi || 0) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{t.jurnal_terisi ?? 0}</span> terisi</p>
                  </td>
                  <td className="px-5 py-4">
                    {t.pkg ? (
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900">{t.pkg.score}</span>
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black ${PREDIKAT_STYLE[t.pkg.predikat] || 'bg-slate-100 text-slate-500'}`}>{t.pkg.predikat}</span>
                      </div>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-500">Belum Dinilai</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => setValueTarget(t)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-amber-600 hover:text-white transition-colors">
                        <PenLine className="h-3.5 w-3.5" /> {t.pkg ? 'Edit Nilai' : 'Beri Nilai'}
                      </button>
                      <button onClick={() => setDetailTarget(t)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-colors">
                        <Eye className="h-3.5 w-3.5" /> Detail
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada data tenaga didik</p>
                      <p className="text-xs text-slate-500">Sesuaikan filter, atau pastikan akun guru aktif tercatat di sistem.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {valueOpen && valueTarget ? (
        <NilaiModal teacher={valueTarget} period={period} onClose={() => setValueTarget(null)} onSaved={async () => { setValueTarget(null); await reload(); }} />
      ) : null}

      {detailOpen && detailTarget && !valueOpen ? (
        <DetailModal teacher={detailTarget} onClose={() => setDetailTarget(null)} />
      ) : null}

      <RaporPdfPreview state={pdfPreview} onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }} title="Pratinjau Laporan Evaluasi Tenaga Didik (PDF)" downloadLabel="Unduh Laporan" />
    </div>
  );
};

const EmptyViz = ({ text, note }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
      <ClipboardList className="w-8 h-8 text-slate-400" />
    </div>
    <p className="text-sm font-black text-slate-400 uppercase tracking-wider">{text}</p>
    <p className="text-xs text-slate-500 max-w-xs" dangerouslySetInnerHTML={{ __html: note }} />
  </div>
);

const PredikatBar = ({ label, value, max, color }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-xs font-black text-slate-600 truncate">{label}</span>
      <div className="h-3 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className="animate-grow-x h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-6 text-right text-sm font-black text-slate-900">{value}</span>
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, options, allLabel, emptyLabel, labelMap }) => {
  const disabled = options.length === 0 && labelMap == null;
  return (
    <label className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
      <Filter className="h-4 w-4" />
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="bg-transparent outline-none max-w-[12rem]">
        <option value="all">{disabled ? emptyLabel : allLabel}</option>
        {options.map((o) => (<option key={o} value={o}>{labelMap?.[o] || o}</option>))}
      </select>
    </label>
  );
};

const ModalHeader = ({ eyebrow, title, subtitle, onClose }) => (
  <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-amber-500 to-orange-600 px-7 py-6">
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">{eyebrow}</p>
      <h3 className="text-2xl font-black text-white">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-amber-50">{subtitle}</p> : null}
    </div>
    <ModalCloseControl onClose={onClose} tone="onDark" />
  </div>
);

const MiniStat = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
    <p className="text-lg font-black text-slate-900">{value}</p>
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
  </div>
);

// ── Modal Input/Edit Penilaian (4 aspek 0-100 + rata-rata & predikat otomatis) ──
const NilaiModal = ({ teacher, period, onClose, onSaved }) => {
  const init = teacher.pkg || {};
  const [form, setForm] = useState({
    discipline_score: init.discipline_score ?? '',
    admin_score: init.admin_score ?? '',
    teaching_quality_score: init.teaching_quality_score ?? '',
    loyalty_score: init.loyalty_score ?? '',
    notes: init.notes ?? '',
    tahun_ajaran: init.tahun_ajaran || period.tahun_ajaran || '',
    semester: init.semester || period.semester || '',
  });
  const [saving, setSaving] = useState(false);

  const nums = ASPEK.map((a) => {
    const raw = form[a.key];
    if (raw === '' || raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
  });
  const complete = nums.every((n) => n !== null);
  const avg = complete ? Math.round(nums.reduce((s, x) => s + x, 0) / nums.length) : null;
  const predikat = avg != null ? predikatFor(avg) : null;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!complete) { toast.error('Lengkapi keempat indikator (0–100).'); return; }
    try {
      setSaving(true);
      const res = await managementAPI.storeTeacherPerformance({
        teacher_id: teacher.id,
        discipline_score: nums[0],
        admin_score: nums[1],
        teaching_quality_score: nums[2],
        loyalty_score: nums[3],
        notes: form.notes || null,
        tahun_ajaran: form.tahun_ajaran || null,
        semester: form.semester || null,
      });
      toast.success(res?.data?.message || 'Penilaian tersimpan.');
      await onSaved();
    } catch (e) {
      const errs = e?.response?.data?.errors;
      const msg = errs ? Object.values(errs).flat().join(' ') : (e?.response?.data?.message || 'Gagal menyimpan penilaian.');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in max-h-[92vh] flex flex-col">
        <ModalHeader
          eyebrow={teacher.pkg ? 'Edit Penilaian Kinerja' : 'Input Penilaian Kinerja'}
          title={teacher.name || 'Tenaga Didik'}
          subtitle={`${teacher.role_label} · ${teacher.beban_ajar?.mapel_count ?? 0} mapel · ${teacher.jurnal_terisi ?? 0} jurnal KBM`}
          onClose={onClose}
        />
        <div className="px-7 py-6 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <MiniStat label="Beban Jadwal" value={teacher.beban_ajar?.jadwal_count ?? 0} />
            <MiniStat label="Kelas Ajar" value={teacher.beban_ajar?.kelas_count ?? 0} />
            <MiniStat label="Jurnal Terisi" value={teacher.jurnal_terisi ?? 0} />
            <MiniStat label="Kehadiran (hr)" value={teacher.kehadiran_hari ?? 0} />
          </div>

          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Indikator Penilaian (skala 0–100)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {ASPEK.map((a) => (
              <label key={a.key} className="block">
                <span className="text-sm font-bold text-slate-700">{a.label}</span>
                <input
                  type="number" min="0" max="100" value={form[a.key]}
                  onChange={(e) => setField(a.key, e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-amber-400 focus:bg-white transition-colors"
                  placeholder="0–100"
                />
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 mb-5">
            <span className="text-sm font-bold text-amber-700">Rata-rata skor:</span>
            <span className="text-2xl font-black text-amber-700">{avg != null ? avg : '—'}</span>
            {predikat ? <span className={`ml-auto inline-flex px-3 py-1 rounded-lg text-xs font-black ${PREDIKAT_STYLE[predikat]}`}>{predikat}</span> : <span className="ml-auto text-xs font-semibold text-slate-400 italic">isi keempat indikator</span>}
          </div>

          <label className="block mb-5">
            <span className="text-sm font-bold text-slate-700">Catatan Evaluasi Kepala Sekolah</span>
            <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white transition-colors"
              placeholder="Catatan / tindak lanjut (opsional)..." />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Tahun Ajaran</span>
              <input value={form.tahun_ajaran} onChange={(e) => setField('tahun_ajaran', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-amber-400 focus:bg-white transition-colors" placeholder="mis. 2026/2027" />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Semester</span>
              <input value={form.semester} onChange={(e) => setField('semester', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-amber-400 focus:bg-white transition-colors" placeholder="mis. Ganjil" />
            </label>
          </div>

          <button onClick={submit} disabled={saving || !complete}
            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl text-sm font-black hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan Penilaian'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ── Modal Detail (read-only) ──
const DetailModal = ({ teacher, onClose }) => {
  const pkg = teacher.pkg;
  const aspects = pkg ? [
    { label: 'Kedisiplinan & Kehadiran', value: pkg.discipline_score },
    { label: 'Administrasi & Jurnal KBM', value: pkg.admin_score },
    { label: 'Kualitas Pembelajaran', value: pkg.teaching_quality_score },
    { label: 'Loyalitas & Kolaborasi', value: pkg.loyalty_score },
  ] : [];
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in max-h-[92vh] flex flex-col">
        <ModalHeader
          eyebrow="Detail Penilaian Kinerja"
          title={teacher.name || 'Tenaga Didik'}
          subtitle={`${teacher.role_label} · NIP ${teacher.nip || '-'}`}
          onClose={onClose}
        />
        <div className="px-7 py-6 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <MiniStat label="Beban Jadwal" value={teacher.beban_ajar?.jadwal_count ?? 0} />
            <MiniStat label="Kelas Ajar" value={teacher.beban_ajar?.kelas_count ?? 0} />
            <MiniStat label="Jurnal Terisi" value={teacher.jurnal_terisi ?? 0} />
            <MiniStat label="Kehadiran (hr)" value={teacher.kehadiran_hari ?? 0} />
          </div>

          {pkg ? (
            <>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 mb-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Skor Akhir</p>
                  <p className="text-3xl font-black text-slate-900">{pkg.score}</p>
                </div>
                <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-black ${PREDIKAT_STYLE[pkg.predikat] || 'bg-slate-100 text-slate-500'}`}>{pkg.predikat}</span>
              </div>
              <div className="space-y-2 mb-4">
                {aspects.map((a) => (
                  <div key={a.label} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-4 py-2.5">
                    <span className="text-sm font-bold text-slate-700">{a.label}</span>
                    <span className="text-sm font-black text-slate-900">{a.value != null ? a.value : '-'}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500 mb-3">
                Periode: {pkg.tahun_ajaran || '-'}{pkg.semester ? ` / ${pkg.semester}` : ''} · Dinilai {pkg.assessment_date || '-'}
              </div>
              <div className="rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 mb-1">Catatan Kepala Sekolah</p>
                <p className="text-sm text-slate-700">{pkg.notes || <span className="italic text-slate-400">Tidak ada catatan.</span>}</p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CalendarCheck className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada penilaian</p>
              <p className="text-xs text-slate-500 max-w-xs">Gunakan tombol "Beri Nilai" untuk menyimpan Penilaian Kinerja Guru (PKG).</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default LaporanKinerjaGuru;
