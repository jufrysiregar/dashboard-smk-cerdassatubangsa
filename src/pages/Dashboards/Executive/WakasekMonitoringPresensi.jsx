import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Clock, Users, UserCheck, CalendarCheck, AlertTriangle, Eye, Filter, Search,
  FileSpreadsheet, Printer, CheckCircle2, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { previewWakasekPresensiGtkPDF } from '../../../utils/wakasekPresensiGtkPdf';

const tanggalPendek = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_TONE = {
  Hadir: 'bg-emerald-100 text-emerald-700',
  Izin: 'bg-amber-100 text-amber-700',
  Sakit: 'bg-blue-100 text-blue-700',
  Alpha: 'bg-rose-100 text-rose-700',
  'Belum Presensi': 'bg-slate-100 text-slate-500',
};

// Kartu KPI house-style (identik Menu ke-2 s.d. ke-4).
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

const WakasekMonitoringPresensi = ({ stats, clock, accessRole, user }) => {
  const section = useMemo(
    () => stats?.executive?.vice_principal?.sections?.wakasek_attendance || {},
    [stats],
  );
  const kpis = useMemo(() => section.kpis || {}, [section]);
  const gtk = useMemo(() => section.gtk || [], [section]);
  const chart = useMemo(() => section.chart || [], [section]);
  const recentLogs = useMemo(() => section.recent_logs || [], [section]);
  const period = useMemo(() => section.period || {}, [section]);
  const today = section.today || '';

  const [filters, setFilters] = useState({ kelompok: 'all', status: 'all' });
  const [searchText, setSearchText] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

  const modalOpen = !!detailModal;
  useEscapeKey(modalOpen, () => setDetailModal(null));
  useBodyScrollLock(modalOpen);

  const filteredGtk = useMemo(() => gtk.filter((g) => {
    if (filters.kelompok !== 'all' && g.kelompok !== filters.kelompok) return false;
    if (filters.status === 'sudah' && g.today_status === 'Belum Presensi') return false;
    if (filters.status === 'belum' && g.today_status !== 'Belum Presensi') return false;
    if (searchText.trim()) {
      const hay = `${g.name} ${g.nip || ''}`.toLowerCase();
      if (!hay.includes(searchText.toLowerCase())) return false;
    }
    return true;
  }), [gtk, filters, searchText]);

  const loading = !stats;

  const handleExportExcel = () => {
    if (!filteredGtk.length) { toast.error('Belum ada data GTK untuk diekspor.'); return; }
    const data = filteredGtk.map((g, i) => ({
      No: i + 1,
      'Nama GTK': g.name || '-',
      'NIP/NUPTK': g.nip || '-',
      'Jabatan & Peran': g.role_label || '-',
      Kelompok: g.kelompok === 'guru' ? 'Tenaga Didik (Guru)' : 'Tenaga Kependidikan',
      'Status Hari Ini': g.today_status || '-',
      'Check-in Hari Ini': g.today_check_in || '-',
      'Hadir Bulan Ini': g.days_hadir_month ?? 0,
      'Aktivitas Terakhir': g.last_activity_date ? `${tanggalPendek(g.last_activity_date)}${g.last_activity_time ? ` ${g.last_activity_time}` : ''}` : '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presensi GTK');
    const label = (today || 'Rekap').replace(/[^\w]+/g, '_');
    XLSX.writeFile(wb, `Presensi_GTK_${label}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewWakasekPresensiGtkPDF({
        rows: filteredGtk,
        period,
        today,
        wakilName: user?.name,
        wakilNip: user?.nisn_nip || user?.nip || user?.school_id || null,
      });
      if (res) setPdfPreview(res);
    } catch { /* toast sudah ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat presensi & disiplin GTK..." />;

  const clockObj = clock || { time: '', day: '', date: '' };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner khusus Wakasek (seragam Menu ke-2 s.d. ke-4) ── */}
      <div className="animate-fade-in-up relative overflow-hidden rounded-[3rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-7 lg:p-9 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> Portal Vice Principal Authority
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Presensi &amp; Disiplin Tenaga Didik</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600 whitespace-nowrap">
              Pantau kehadiran harian GTK, ketepatan waktu presensi, dan kedisiplinan.
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
          label="Total GTK Aktif"
          value={kpis.total_gtk ?? 0}
          sub={`${kpis.guru_count ?? 0} guru · ${kpis.tendik_count ?? 0} tendik`}
          icon={Users}
          accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }}
        />
        <KpiCard
          label="Hadir Hari Ini"
          value={`${kpis.hadir_hari_ini ?? 0}/${kpis.total_gtk ?? 0}`}
          sub="Check-in tercatat hari ini"
          icon={UserCheck}
          accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }}
        />
        <KpiCard
          label="Log Presensi Bulan Ini"
          value={kpis.log_bulan_ini ?? 0}
          sub="Catatan kehadiran terekam"
          icon={CalendarCheck}
          accent={{ grad: 'from-violet-50/90 via-white to-violet-50/50', border: 'border-violet-200/70', chip: 'bg-violet-100', text: 'text-violet-600' }}
        />
        <KpiCard
          label="Belum Presensi / Konfirmasi"
          value={kpis.belum_konfirmasi ?? 0}
          sub="Belum log hari ini / izin-sakit"
          highlight={(kpis.belum_konfirmasi ?? 0) > 0}
          icon={AlertTriangle}
          accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }}
        />
      </div>

      {/* ── Panel Ringkasan Visual 2 Kolom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Rekap Kehadiran GTK Bulan Berjalan</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">Jumlah hari kehadiran tercatat tiap GTK aktif (urut paling rajin).</p>
          <AttendanceChart rows={chart} totalLog={kpis.log_bulan_ini ?? 0} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-black text-slate-900">Log Aktivitas Presensi GTK Terbaru</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">5 catatan presensi/check-in terakhir dari sistem.</p>
          <RecentLogFeed items={recentLogs} />
        </div>
      </div>

      {/* ── Filter & Ekspor ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
            <FilterSelect
              label="Kelompok GTK"
              value={filters.kelompok}
              onChange={(v) => setFilters((f) => ({ ...f, kelompok: v }))}
              options={[{ id: 'guru', name: 'Tenaga Didik (Guru)' }, { id: 'tendik', name: 'Tenaga Kependidikan (Staf)' }]}
              allLabel="Semua GTK"
            />
            <FilterSelect
              label="Status Hari Ini"
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              options={[{ id: 'sudah', name: 'Sudah Presensi' }, { id: 'belum', name: 'Belum Presensi' }]}
              allLabel="Semua Status"
            />
            <label className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
              <Search className="h-4 w-4" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Cari nama / NIP"
                className="bg-transparent outline-none max-w-[14rem]"
              />
            </label>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <button
              onClick={handleExportExcel}
              disabled={!filteredGtk.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4" /> Ekspor Rekap Presensi GTK (.xlsx)
            </button>
            <button
              onClick={handlePrintPDF}
              disabled={!filteredGtk.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" /> Cetak Laporan Presensi &amp; Disiplin Tenaga Didik (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel Rekap Presensi GTK ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Nama GTK & NIP', 'Jabatan & Peran', 'Status Hari Ini', 'Kehadiran Bulan Ini', 'Aktivitas Terakhir', 'Aksi'].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGtk.length > 0 ? filteredGtk.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-slate-900">{g.name}</p>
                    <p className="text-xs text-slate-500">NIP/NUPTK: {g.nip || '-'}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{g.role_label || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${STATUS_TONE[g.today_status] || 'bg-slate-100 text-slate-600'}`}>
                      {g.today_status === 'Hadir' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      {g.today_status}{g.today_check_in ? ` · ${g.today_check_in}` : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-black ${g.days_hadir_month > 0 ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                      {g.days_hadir_month} hari
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {g.last_activity_date ? (
                      <span>{tanggalPendek(g.last_activity_date)}{g.last_activity_time ? ` · ${g.last_activity_time}` : ''}</span>
                    ) : (
                      <span className="text-slate-400 italic">Belum ada</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setDetailModal(g)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      <Eye className="h-4 w-4" /> Riwayat Presensi
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Tidak ada GTK yang cocok</p>
                      <p className="text-xs text-slate-500">Sesuaikan filter kelompok/status atau kata kunci pencarian.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailModal ? (
        <GtkRiwayatModal gtk={detailModal} onClose={() => setDetailModal(null)} />
      ) : null}

      <RaporPdfPreview
        state={pdfPreview}
        onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
        title="Pratinjau Laporan Presensi & Disiplin GTK (PDF)"
        downloadLabel="Unduh Laporan"
      />
    </div>
  );
};

/* ── Grafik batang horizontal SVG: hari hadir per GTK ── */
const AttendanceChart = ({ rows, totalLog }) => {
  const withDays = (rows || []).filter((r) => (r.days || 0) > 0).slice(0, 10);
  if (!totalLog || withDays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <Activity className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada log presensi bulan ini</p>
        <p className="text-xs text-slate-500 max-w-xs">Rekap kehadiran GTK akan muncul otomatis saat presensi/check-in tercatat.</p>
      </div>
    );
  }
  const max = Math.max(...withDays.map((r) => r.days), 1);
  return (
    <div className="space-y-4">
      {withDays.map((r, i) => (
        <div key={`${r.name}-${i}`}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-bold text-slate-700 truncate">{r.name}</span>
            <span className="text-xs font-black text-slate-500 shrink-0">{r.days} hari</span>
          </div>
          <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none" className="overflow-visible">
            <rect x="0" y="2" width="100" height="12" rx="2" fill="#f1f5f9" />
            <rect
              x="0" y="2" width={(r.days / max) * 100} height="12" rx="2" fill="#6366f1"
              className="animate-grow-x" style={{ transformBox: 'fill-box', transformOrigin: 'left center', animationDelay: `${i * 80}ms` }}
            />
          </svg>
        </div>
      ))}
    </div>
  );
};

/* ── Feed log presensi terbaru ── */
const RecentLogFeed = ({ items }) => {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <CalendarCheck className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada log presensi hari ini</p>
        <p className="text-xs text-slate-500 max-w-xs">Catatan check-in GTK akan tampil di sini secara otomatis.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
      {items.map((l, i) => (
        <li key={l.id ?? i} className="animate-fade-in-up rounded-xl border border-slate-100 bg-slate-50 px-4 py-3" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-900 truncate">{l.name}</p>
            <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_TONE[l.status] || 'bg-slate-100 text-slate-600'}`}>{l.status}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{l.jabatan} · {tanggalPendek(l.work_date)}</p>
          <p className="text-xs text-slate-500">
            Masuk {l.check_in || '—'} · Pulang {l.check_out || '—'}
            {l.notes ? ` · ${l.notes}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
};

const FilterSelect = ({ label, value, onChange, options, allLabel }) => (
  <label className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
    <Filter className="h-4 w-4" />
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent outline-none max-w-[14rem]">
      <option value="all">{allLabel}</option>
      {options.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
    </select>
  </label>
);

/* ── Modal Riwayat Presensi GTK (z-[9999]) ── */
const GtkRiwayatModal = ({ gtk, onClose }) => {
  const logs = gtk.logs || [];
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-sky-600 to-indigo-700 px-7 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-100">Riwayat Presensi</p>
            <h3 className="text-xl font-black text-white">{gtk.name}</h3>
            <p className="mt-0.5 text-xs text-sky-50">{gtk.role_label} · NIP {gtk.nip || '-'}</p>
          </div>
          <ModalCloseControl onClose={onClose} tone="onDark" />
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <MiniStat label="Hadir Bulan Ini" value={`${gtk.days_hadir_month ?? 0} h`} />
            <MiniStat label="Status Hari Ini" value={gtk.today_status} />
            <MiniStat label="Kelompok" value={gtk.kelompok === 'guru' ? 'Guru' : 'Staf'} />
          </div>

          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Log Kehadiran Harian ({logs.length})</p>
          {logs.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-black">Tanggal</th>
                    <th className="px-4 py-3 text-center font-black">Masuk</th>
                    <th className="px-4 py-3 text-center font-black">Pulang</th>
                    <th className="px-4 py-3 text-center font-black">Status</th>
                    <th className="px-4 py-3 text-left font-black">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((l, i) => (
                    <tr key={`${l.date}-${i}`}>
                      <td className="px-4 py-3 font-bold text-slate-800">{tanggalPendek(l.date)}</td>
                      <td className="px-4 py-3 text-center text-slate-600 tabular-nums">{l.check_in || '—'}</td>
                      <td className="px-4 py-3 text-center text-slate-600 tabular-nums">{l.check_out || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-black ${STATUS_TONE[l.status] || 'bg-slate-100 text-slate-600'}`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{l.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400 italic rounded-xl border border-dashed border-slate-200 px-4">
              <CalendarCheck className="h-4 w-4" /> Belum ada riwayat kehadiran tercatat untuk GTK ini pada bulan berjalan.
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
    <p className="text-base font-black text-slate-900">{value}</p>
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
  </div>
);

export default WakasekMonitoringPresensi;
