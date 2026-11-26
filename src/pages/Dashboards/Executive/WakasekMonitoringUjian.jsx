import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Clock, ClipboardList, Activity, Layers, Users, Eye, Filter, Search,
  FileSpreadsheet, Printer, CheckCircle2, AlertCircle, CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { previewWakasekMonitoringUjianPDF } from '../../../utils/wakasekMonitoringUjianPdf';

const capitalize = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase() : '-');
const tanggalUjian = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_TONE = {
  Aktif: 'bg-emerald-100 text-emerald-700',
  Terjadwal: 'bg-sky-100 text-sky-700',
  Draft: 'bg-amber-100 text-amber-700',
  Selesai: 'bg-slate-200 text-slate-600',
};

// Kartu KPI house-style (identik Menu ke-2 & ke-3).
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

const WakasekMonitoringUjian = ({ stats, clock, accessRole, user }) => {
  const section = useMemo(
    () => stats?.executive?.vice_principal?.sections?.wakasek_exams || {},
    [stats],
  );
  const kpis = useMemo(() => section.kpis || {}, [section]);
  const breakdown = useMemo(() => section.status_breakdown || [], [section]);
  const exams = useMemo(() => section.exams || [], [section]);
  const recentActivity = useMemo(() => section.recent_activity || [], [section]);
  const filterOptions = useMemo(() => section.filter_options || {}, [section]);
  const period = useMemo(() => section.period || {}, [section]);

  const [filters, setFilters] = useState({ kelas: 'all', status: 'all' });
  const [searchText, setSearchText] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

  const modalOpen = !!detailModal;
  useEscapeKey(modalOpen, () => setDetailModal(null));
  useBodyScrollLock(modalOpen);

  const kelasOptions = useMemo(() => filterOptions.classes || [], [filterOptions]);
  const statusOptions = useMemo(() => filterOptions.statuses || ['Aktif', 'Draft', 'Selesai'], [filterOptions]);

  const filteredExams = useMemo(() => exams.filter((e) => {
    if (filters.kelas !== 'all' && String(e.kelas_id) !== String(filters.kelas)) return false;
    if (filters.status !== 'all' && e.status !== filters.status) return false;
    if (searchText.trim()) {
      const hay = `${e.title} ${e.subject} ${e.guru_name}`.toLowerCase();
      if (!hay.includes(searchText.toLowerCase())) return false;
    }
    return true;
  }), [exams, filters, searchText]);

  const loading = !stats;

  const handleExportExcel = () => {
    if (!filteredExams.length) { toast.error('Belum ada paket ujian untuk diekspor.'); return; }
    const data = filteredExams.map((e, i) => ({
      No: i + 1,
      'Paket Ujian': e.title || '-',
      Jenis: e.type || '-',
      Mapel: e.subject || '-',
      'Guru Pembuat': e.guru_name || '-',
      NIP: e.guru_nip || '-',
      Kelas: e.kelas_name || '-',
      Mulai: tanggalUjian(e.start_at),
      Selesai: tanggalUjian(e.deadline_at),
      Durasi: e.duration_minutes ? `${e.duration_minutes} mnt` : '-',
      'Butir Soal': e.question_count ?? 0,
      'Peserta Selesai': `${e.participants_done ?? 0}/${e.participants_total ?? 0}`,
      Status: e.status || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monitoring Ujian CBT');
    const label = (period.tahun_ajaran || 'Periode').replace(/[^\w]+/g, '_');
    XLSX.writeFile(wb, `Monitoring_Ujian_CBT_${label}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewWakasekMonitoringUjianPDF({
        rows: filteredExams,
        period,
        wakilName: user?.name,
        wakilNip: user?.nisn_nip || user?.nip || user?.school_id || null,
      });
      if (res) setPdfPreview(res);
    } catch { /* toast sudah ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat monitoring ujian CBT..." />;

  const clockObj = clock || { time: '', day: '', date: '' };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner khusus Wakasek (seragam dgn Menu ke-2 & ke-3) ── */}
      <div className="animate-fade-in-up relative overflow-hidden rounded-[3rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-7 lg:p-9 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> Portal Vice Principal Authority
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Monitoring Ujian CBT</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600 whitespace-nowrap">
              Pantau kesiapan bank soal, jadwal ujian CBT, dan partisipasi peserta didik.
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
          label="Total Paket Ujian CBT"
          value={kpis.total_paket ?? 0}
          sub="Terdaftar di paket_soals"
          icon={ClipboardList}
          accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }}
        />
        <KpiCard
          label="Ujian Aktif & Terjadwal"
          value={kpis.aktif ?? 0}
          sub={`${kpis.terjadwal ?? 0} paket terjadwal`}
          icon={CalendarClock}
          accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }}
        />
        <KpiCard
          label="Kesiapan Bank Soal"
          value={kpis.soal_terverifikasi ?? 0}
          sub={`${kpis.total_soal ?? 0} butir soal total`}
          highlight={(kpis.total_soal ?? 0) === 0}
          icon={Layers}
          accent={{ grad: 'from-violet-50/90 via-white to-violet-50/50', border: 'border-violet-200/70', chip: 'bg-violet-100', text: 'text-violet-600' }}
        />
        <KpiCard
          label="Partisipasi & Selesai Ujian"
          value={kpis.peserta_selesai ?? 0}
          sub="Pengerjaan siswa tercatat selesai"
          icon={Users}
          accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }}
        />
      </div>

      {/* ── Panel Ringkasan Visual 2 Kolom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Sebaran Paket Ujian per Status</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">Komposisi ujian (Aktif / Terjadwal-Draft / Selesai) riil dari database.</p>
          <StatusBreakdownChart rows={breakdown} total={kpis.total_paket ?? 0} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-black text-slate-900">Kesiapan Ujian & Aktivitas Peserta</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">Ujian terdekat & aktivitas pengerjaan terbaru (riil).</p>
          <ActivityPanel exams={exams} recentActivity={recentActivity} />
        </div>
      </div>

      {/* ── Filter & Ekspor ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <FilterSelect label="Kelas" value={filters.kelas} onChange={(v) => setFilters((f) => ({ ...f, kelas: v }))} options={kelasOptions} allLabel="Semua Kelas" emptyLabel="Belum ada kelas" />
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={statusOptions.map((s) => ({ id: s, name: s }))} allLabel="Semua Status" emptyLabel="Belum ada status" />
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
              <Search className="h-4 w-4" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Cari judul / mapel / guru"
                className="bg-transparent outline-none max-w-[14rem]"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportExcel}
              disabled={!filteredExams.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4" /> Ekspor Monitoring Ujian (.xlsx)
            </button>
            <button
              onClick={handlePrintPDF}
              disabled={!filteredExams.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" /> Cetak Laporan Kesiapan &amp; CBT (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel Monitoring Ujian ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Paket Ujian & Mapel', 'Guru Pembuat Soal', 'Target Kelas & Jadwal', 'Butir Soal & Partisipasi', 'Status Ujian', 'Aksi'].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExams.length > 0 ? filteredExams.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-slate-900">{e.title || '-'}</p>
                    <p className="text-xs text-slate-500">{capitalize(e.type) || 'Ujian'} · {e.subject || 'Tanpa Mapel'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-800">{e.guru_name || 'Guru'}</p>
                    <p className="text-xs text-slate-500">NIP: {e.guru_nip || '-'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700">{e.kelas_name || '-'}</span>
                    <p className="mt-1 text-xs text-slate-500">{tanggalUjian(e.start_at)}{e.duration_minutes ? ` · ${e.duration_minutes} mnt` : ''}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <p><span className="font-black text-slate-900">{e.question_count ?? 0}</span> butir soal</p>
                    <p className="text-xs text-slate-500">{e.participants_done ?? 0}/{e.participants_total ?? 0} peserta selesai</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${STATUS_TONE[e.status] || 'bg-slate-100 text-slate-600'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setDetailModal(e)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      <Eye className="h-4 w-4" /> Detail Ujian
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <ClipboardList className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada paket ujian CBT</p>
                      <p className="text-xs text-slate-500">Sesuaikan filter kelas/status, atau data akan muncul setelah Admin Akademik membuat paket ujian.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailModal ? (
        <ExamDetailModal exam={detailModal} onClose={() => setDetailModal(null)} />
      ) : null}

      <RaporPdfPreview
        state={pdfPreview}
        onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
        title="Pratinjau Laporan Monitoring Ujian CBT (PDF)"
        downloadLabel="Unduh Laporan"
      />
    </div>
  );
};

/* ── Grafik batang horizontal SVG: sebaran status ujian ── */
const StatusBreakdownChart = ({ rows, total }) => {
  if (!total) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <ClipboardList className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada paket ujian CBT</p>
        <p className="text-xs text-slate-500 max-w-xs">Sebaran status akan muncul otomatis saat Admin Akademik membuat paket ujian.</p>
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.value || 0), 1);
  const colors = ['#10b981', '#f59e0b', '#64748b'];
  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-bold text-slate-700">{r.label}</span>
            <span className="text-xs font-black text-slate-500">{r.value} paket</span>
          </div>
          <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none" className="overflow-visible">
            <rect x="0" y="2" width="100" height="12" rx="2" fill="#f1f5f9" />
            {r.value > 0 && (
              <rect
                x="0" y="2" width={(r.value / max) * 100} height="12" rx="2" fill={colors[i % colors.length]}
                className="animate-grow-x" style={{ transformBox: 'fill-box', transformOrigin: 'left center', animationDelay: `${i * 90}ms` }}
              />
            )}
          </svg>
        </div>
      ))}
    </div>
  );
};

/* ── Panel kanan: aktivitas peserta terbaru ATAU ujian terdekat ATAU empty-state ── */
const ActivityPanel = ({ exams, recentActivity }) => {
  if (recentActivity.length) {
    return (
      <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {recentActivity.map((a, i) => (
          <li key={a.id ?? i} className="animate-fade-in-up rounded-xl border border-slate-100 bg-slate-50 px-4 py-3" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900 truncate">{a.student_name}</p>
              <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${a.done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {a.done ? 'Selesai' : 'Berlangsung'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{a.exam_title || 'Ujian'}{a.submitted_at ? ` · ${tanggalUjian(a.submitted_at)}` : ''}</p>
          </li>
        ))}
      </ul>
    );
  }

  const upcoming = exams.filter((e) => e.status !== 'Selesai').slice(0, 5);
  if (upcoming.length) {
    return (
      <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {upcoming.map((e, i) => (
          <li key={e.id ?? i} className="animate-fade-in-up rounded-xl border border-slate-100 bg-slate-50 px-4 py-3" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900 truncate">{e.title || 'Ujian'}</p>
              <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_TONE[e.status] || 'bg-slate-100 text-slate-600'}`}>{e.status}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{e.kelas_name || '-'} · {tanggalUjian(e.start_at)} · {e.question_count ?? 0} soal</p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
        <CalendarClock className="w-8 h-8 text-slate-400" />
      </div>
      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada paket ujian CBT yang dijadwalkan di sistem</p>
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
        {options.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
      </select>
    </label>
  );
};

/* ── Modal Detail Ujian (z-[9999]) ── */
const ExamDetailModal = ({ exam, onClose }) => {
  const participants = exam.participants || [];
  const sessions = exam.sessions || [];
  const rasio = exam.participants_total > 0 ? Math.round(((exam.participants_done || 0) / exam.participants_total) * 100) : 0;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-violet-600 to-indigo-700 px-7 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-100">Detail Ujian CBT</p>
            <h3 className="text-xl font-black text-white">{exam.title || 'Paket Ujian'}</h3>
            <p className="mt-0.5 text-xs text-violet-50">{capitalize(exam.type) || 'Ujian'} · {exam.subject || 'Tanpa Mapel'} · {exam.kelas_name || '-'}</p>
          </div>
          <ModalCloseControl onClose={onClose} tone="onDark" />
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <MiniStat label="Butir Soal" value={exam.question_count ?? 0} />
            <MiniStat label="Durasi" value={exam.duration_minutes ? `${exam.duration_minutes}m` : '-'} />
            <MiniStat label="Peserta Selesai" value={`${exam.participants_done ?? 0}/${exam.participants_total ?? 0}`} />
            <MiniStat label="Partisipasi" value={`${rasio}%`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 rounded-xl bg-slate-50 border border-slate-100 px-4 py-4 mb-5 text-sm">
            <Config label="Status" value={<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black uppercase ${STATUS_TONE[exam.status] || 'bg-slate-100 text-slate-600'}`}>{exam.status}</span>} />
            <Config label="Guru Pembuat" value={`${exam.guru_name || 'Guru'}${exam.guru_nip ? ` (NIP ${exam.guru_nip})` : ''}`} />
            <Config label="Mulai" value={tanggalUjian(exam.start_at)} />
            <Config label="Batas Akhir" value={tanggalUjian(exam.deadline_at)} />
            <Config label="Publikasi" value={exam.is_active ? 'Aktif' : 'Belum dipublikasikan'} />
            <Config label="Jumlah Sesi" value={sessions.length} />
          </div>

          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Progres Pengerjaan Peserta ({participants.length})</p>
          {participants.length ? (
            <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {participants.map((p, i) => (
                <li key={p.id ?? i} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                  <span className="text-sm font-bold text-slate-800">{p.student_name}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${p.done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.done ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    {p.done ? 'Selesai' : 'Belum selesai'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400 italic rounded-xl border border-dashed border-slate-200 px-4">
              <AlertCircle className="h-4 w-4" /> Belum ada peserta yang tercatat mengerjakan paket ujian ini.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

const Config = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
    <span className="text-sm font-bold text-slate-800 text-right">{value}</span>
  </div>
);

const MiniStat = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
    <p className="text-lg font-black text-slate-900">{value}</p>
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
  </div>
);

export default WakasekMonitoringUjian;
