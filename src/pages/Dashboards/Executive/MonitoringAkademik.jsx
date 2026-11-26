import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Clock, Users, PenLine, CalendarCheck, ClipboardList,
  FileSpreadsheet, Printer, Eye, AlertTriangle, Filter, LayoutGrid, TrendingUp,
} from 'lucide-react';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { previewKbmMonitoringPDF } from '../../../utils/kbmMonitoringPdf';

const normalizeSem = (raw) => {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'ganjil' || s === '1' || s === 'satu') return 'Ganjil';
  if (s === 'genap' || s === '2' || s === 'dua') return 'Genap';
  return null;
};

// Kartu KPI house-style: rounded-3xl, gradasi pastel ke putih, watermark ikon pojok.
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

const MonitoringAkademik = ({ stats: parentStats, clock, accessRole }) => {
  const kbm = parentStats?.executive?.kbm_monitoring;
  const classes = useMemo(() => kbm?.classes || [], [kbm]);
  const academicOptions = useMemo(() => kbm?.academic_options || [], [kbm]);
  const sorotan = useMemo(() => kbm?.sorotan || [], [kbm]);
  const guruKehadiran = kbm?.kpis?.guru_kehadiran || { present: 0, total: 0, rate: null, has_log: false };
  const period = kbm?.period || {};

  const [filters, setFilters] = useState({ tahunAjaran: 'all', semester: 'all', kelas: 'all' });
  const [selectedClass, setSelectedClass] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const modalOpen = !!selectedClass;
  useEscapeKey(modalOpen, () => setSelectedClass(null));
  useBodyScrollLock(modalOpen);

  // Set default filter ke periode aktif (dari DB) sekali saat data tiba.
  useEffect(() => {
    if (kbm?.period?.tahun_ajaran) {
      setFilters((f) => (f.tahunAjaran === 'all' && f.semester === 'all'
        ? { ...f, tahunAjaran: kbm.period.tahun_ajaran, semester: kbm.period.semester || 'all' }
        : f));
    }
  }, [kbm?.period?.tahun_ajaran, kbm?.period?.semester]);

  const taOptions = useMemo(() => {
    const set = new Set(academicOptions.map((o) => o.academic_year).filter(Boolean));
    classes.forEach((c) => c.academic_year && set.add(c.academic_year));
    return [...set].sort().reverse();
  }, [academicOptions, classes]);

  const semesterOptions = useMemo(() => {
    const set = new Set();
    academicOptions.forEach((o) => {
      if (filters.tahunAjaran !== 'all' && o.academic_year !== filters.tahunAjaran) return;
      const s = normalizeSem(o.semester);
      if (s) set.add(s);
    });
    classes.forEach((c) => {
      if (filters.tahunAjaran !== 'all' && c.academic_year !== filters.tahunAjaran) return;
      const s = normalizeSem(c.semester);
      if (s) set.add(s);
    });
    return [...set].sort();
  }, [academicOptions, classes, filters.tahunAjaran]);

  const kelasOptions = useMemo(() => {
    const set = new Set();
    classes.forEach((c) => {
      if (filters.tahunAjaran !== 'all' && c.academic_year !== filters.tahunAjaran) return;
      if (c.name) set.add(c.name);
    });
    return [...set].sort();
  }, [classes, filters.tahunAjaran]);

  const filteredClasses = useMemo(() => classes.filter((c) => {
    if (filters.tahunAjaran !== 'all' && c.academic_year !== filters.tahunAjaran) return false;
    if (filters.semester !== 'all') {
      const cs = normalizeSem(c.semester);
      // Kelas tanpa semester (null) tetap ditampilkan agar tidak menyembunyikan data riil.
      if (cs && cs !== filters.semester) return false;
    }
    if (filters.kelas !== 'all' && c.name !== filters.kelas) return false;
    return true;
  }), [classes, filters]);

  // KPI disinkronkan dengan baris tabel yang sedang difilter.
  const kpi = useMemo(() => ({
    totalKelas: filteredClasses.length,
    totalSiswa: filteredClasses.reduce((s, c) => s + (c.active_students || 0), 0),
    jurnalTerisi: filteredClasses.reduce((s, c) => s + (c.journal_count || 0), 0),
    jadwalAktif: filteredClasses.reduce((s, c) => s + (c.schedule_count || 0), 0),
  }), [filteredClasses]);

  const loading = !parentStats;

  const handleExportExcel = () => {
    if (!filteredClasses.length) return;
    const data = filteredClasses.map((c, i) => ({
      No: i + 1,
      Kelas: c.name || '-',
      'Tahun Ajaran': c.academic_year || '-',
      Semester: normalizeSem(c.semester) || '-',
      'Wali Kelas': c.homeroom_teacher || 'Belum ditentukan',
      'Siswa Aktif': c.active_students ?? 0,
      Mapel: c.mapel_count ?? 0,
      Guru: c.guru_count ?? 0,
      'Jadwal Mengajar': c.schedule_count ?? 0,
      'Jurnal KBM Terisi': c.journal_count ?? 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monitoring KBM');
    XLSX.writeFile(wb, `Monitoring_KBM_${(filters.tahunAjaran === 'all' ? 'SemuaTA' : filters.tahunAjaran).replace(/[^\w]+/g, '_')}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewKbmMonitoringPDF({ rows: filteredClasses, period });
      if (res) setPdfPreview(res);
    } catch { /* toast sudah ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat monitoring KBM..." />;

  const clockObj = clock || { time: '', day: '', date: '' };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner (khas Portal Principal, jam WIB live) ── */}
      <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-6 lg:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> {accessRole === 'wakil_sekolah' ? 'Portal Vice Principal Authority' : 'Portal Principal Authority'}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Monitoring KBM &amp; Jurnal Guru</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Audit pelaksanaan kegiatan belajar mengajar, kehadiran pendidik, serta kelengkapan jurnal KBM per kelas.
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

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 stagger-grid">
        <KpiCard label="Total Kelas Aktif" value={kpi.totalKelas} icon={LayoutGrid} accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }} />
        <KpiCard label="Total Siswa Aktif" value={kpi.totalSiswa} sub="Terdaftar & aktif di kelas" icon={Users} accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }} />
        <KpiCard
          label="Kehadiran Guru (Bulan Ini)"
          value={guruKehadiran.has_log ? `${guruKehadiran.present}/${guruKehadiran.total}` : 'Belum ada log'}
          sub={guruKehadiran.has_log && guruKehadiran.rate != null ? `Tingkat hadir ${guruKehadiran.rate}%` : 'Belum ada presensi tercatat'}
          icon={CalendarCheck}
          accent={{ grad: 'from-violet-50/90 via-white to-violet-50/50', border: 'border-violet-200/70', chip: 'bg-violet-100', text: 'text-violet-600' }}
        />
        <KpiCard label="Jurnal KBM Terisi" value={kpi.jurnalTerisi} sub={`Dari ${kpi.jadwalAktif} jadwal mengajar aktif`} icon={PenLine} accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }} />
      </div>

      {/* ── Panel Ringkasan Audit KBM (2 kolom) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kiri: Keaktifan Jurnal & Presensi */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Keaktifan Jurnal &amp; Presensi Guru</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">Perbandingan jurnal KBM terisi terhadap jadwal mengajar aktif.</p>

          {kpi.jadwalAktif === 0 && kpi.jurnalTerisi === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                <PenLine className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada aktivitas KBM</p>
              <p className="text-xs text-slate-500 max-w-xs">Grafik akan muncul setelah jadwal mengajar & jurnal KBM tercatat pada periode ini.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <BarRow label="Jadwal Mengajar Aktif" value={kpi.jadwalAktif} max={Math.max(kpi.jadwalAktif, kpi.jurnalTerisi, 1)} color="bg-slate-400" />
              <BarRow label="Jurnal KBM Terisi" value={kpi.jurnalTerisi} max={Math.max(kpi.jadwalAktif, kpi.jurnalTerisi, 1)} color="bg-amber-500" />
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-600">
                Kehadiran guru bulan ini:{' '}
                <span className="font-black text-slate-900">
                  {guruKehadiran.has_log ? `${guruKehadiran.present} dari ${guruKehadiran.total} guru hadir (${guruKehadiran.rate}%)` : 'belum ada log presensi'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Kanan: Sorotan KBM & Kelas Perlu Perhatian */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <h3 className="text-base font-black text-slate-900">Sorotan KBM &amp; Kelas Perlu Perhatian</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">Kelas/guru yang jurnalnya belum lengkap sebagai bahan evaluasi.</p>

          {sorotan.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                <ClipboardList className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-sm font-black text-emerald-600 uppercase tracking-wider">Semua terkendali</p>
              <p className="text-xs text-slate-500 max-w-xs">Tidak ada kelas dengan jurnal tidak lengkap pada data saat ini.</p>
            </div>
          ) : (
            <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {sorotan.map((s, i) => (
                <li key={`${s.title}-${i}`} className={`rounded-xl border px-4 py-3 ${s.type === 'kehadiran' ? 'border-violet-100 bg-violet-50' : 'border-amber-100 bg-amber-50'}`}>
                  <p className="text-sm font-black text-slate-900">{s.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{s.note}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Filter & Ekspor ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <FilterSelect label="Tahun Ajaran" value={filters.tahunAjaran} onChange={(v) => setFilters((f) => ({ ...f, tahunAjaran: v, semester: 'all', kelas: 'all' }))} options={taOptions} allLabel="Semua Tahun Ajaran" emptyLabel="Belum ada data TA" />
            <FilterSelect label="Semester" value={filters.semester} onChange={(v) => setFilters((f) => ({ ...f, semester: v, kelas: 'all' }))} options={semesterOptions} allLabel="Semua Semester" emptyLabel="Belum ada data" />
            <FilterSelect label="Kelas" value={filters.kelas} onChange={(v) => setFilters((f) => ({ ...f, kelas: v }))} options={kelasOptions} allLabel="Semua Kelas" emptyLabel="Belum ada kelas" />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportExcel}
              disabled={!filteredClasses.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4" /> Ekspor ke Excel (.xlsx)
            </button>
            <button
              onClick={handlePrintPDF}
              disabled={!filteredClasses.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" /> Cetak Laporan KBM (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel Monitoring KBM Per Kelas ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Kelas', 'Wali Kelas', 'Siswa Aktif', 'Mapel & Guru', 'Jurnal KBM', 'Aksi'].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClasses.length > 0 ? (
                filteredClasses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-900">{c.name || '-'}</p>
                      <p className="text-xs text-slate-500">{c.department_name || '-'}{c.grade_level ? ` · ${c.grade_level}` : ''}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {c.homeroom_teacher || <span className="text-slate-400 italic">Belum ditentukan</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-black ${c.active_students > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.active_students}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className="font-black text-slate-900">{c.mapel_count}</span> mapel · <span className="font-black text-slate-900">{c.guru_count}</span> guru
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-black ${c.journal_count > 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'}`}>
                        {c.journal_count} / {c.schedule_count}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedClass(c)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Eye className="h-4 w-4" /> Detail KBM
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <LayoutGrid className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada data kelas</p>
                      <p className="text-xs text-slate-500">Sesuaikan filter tahun ajaran/semester, atau tambahkan kelas lewat Kelola Struktur Akademik.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && selectedClass ? (
        <KbmDetailModal cls={selectedClass} period={period} onClose={() => setSelectedClass(null)} />
      ) : null}

      <RaporPdfPreview state={pdfPreview} onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }} title="Pratinjau Laporan KBM (PDF)" downloadLabel="Unduh Laporan KBM" />
    </div>
  );
};

const BarRow = ({ label, value, max, color }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="font-bold text-slate-600">{label}</span>
        <span className="font-black text-slate-900">{value}</span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`animate-grow-x h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
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
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    </label>
  );
};

const KbmDetailModal = ({ cls, period, onClose }) => {
  const details = cls.subjects_detail || [];
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-amber-500 to-orange-600 px-7 py-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">Detail KBM</p>
            <h3 className="text-2xl font-black text-white">{cls.name || 'Kelas'}</h3>
            <p className="mt-1 text-sm text-amber-50">
              Wali: {cls.homeroom_teacher || 'Belum ditentukan'} · {period.tahun_ajaran || '-'}{period.semester ? ` / ${period.semester}` : ''}
            </p>
          </div>
          <ModalCloseControl onClose={onClose} tone="onDark" />
        </div>

        <div className="px-7 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <MiniStat label="Siswa Aktif" value={cls.active_students ?? 0} />
            <MiniStat label="Mapel" value={cls.mapel_count ?? 0} />
            <MiniStat label="Guru" value={cls.guru_count ?? 0} />
            <MiniStat label="Jurnal / Jadwal" value={`${cls.journal_count ?? 0}/${cls.schedule_count ?? 0}`} />
          </div>

          {details.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-black">Mata Pelajaran</th>
                    <th className="px-4 py-3 text-left font-black">Guru Pengampu</th>
                    <th className="px-4 py-3 text-center font-black">Jurnal</th>
                    <th className="px-4 py-3 text-center font-black">Presensi Guru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {details.map((d, i) => (
                    <tr key={`${d.subject}-${d.teacher}-${i}`}>
                      <td className="px-4 py-3 font-bold text-slate-900">{d.subject}</td>
                      <td className="px-4 py-3 text-slate-600">{d.teacher}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-black ${d.journal_count > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{d.journal_count}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-black bg-slate-100 text-slate-500">{d.presence_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <ClipboardList className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada mapel ter-plotting</p>
              <p className="text-xs text-slate-500">Jadwal mengajar untuk kelas ini belum tersedia di periode terpilih.</p>
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

export default MonitoringAkademik;
