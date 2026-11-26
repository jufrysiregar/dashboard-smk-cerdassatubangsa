import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Clock, LayoutGrid, UserCheck, Users, CalendarCheck,
  FileSpreadsheet, Printer, Eye, Filter, Search,
  CheckCircle2, AlertCircle, Save, ClipboardList, GraduationCap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { managementAPI } from '../../../utils/api';
import { previewPlottingWaliKelasPDF } from '../../../utils/plottingWaliKelasPdf';

// Kartu KPI house-style: rounded-3xl, gradasi pastel→putih, watermark ikon, hover lift.
function KpiCard({ label, value, sub, icon: Icon, accent, highlight }) {
  return (
    <div
      className={`kpi-hover animate-fade-in-up relative overflow-hidden rounded-3xl border ${highlight ? 'border-rose-300' : accent.border} bg-gradient-to-br ${accent.grad} p-6 shadow-sm`}
    >
      <div className="relative z-10 flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 ${accent.chip} rounded-2xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${accent.text}`} />
        </div>
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="relative z-10 text-3xl font-black text-slate-900">{value}</p>
      {sub ? (
        <p className={`relative z-10 mt-1 text-xs font-semibold ${highlight ? 'text-rose-600' : 'text-slate-500'}`}>{sub}</p>
      ) : null}
      <Icon className={`kpi-watermark pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${accent.text} opacity-[0.07]`} />
    </div>
  );
}

const tingkatLabel = (g) => (g ? `Tingkat ${g}` : 'Semua Tingkat');

const WakasekManajemenKelas = ({ stats, clock, accessRole, user, onRefresh }) => {
  const section = useMemo(
    () => stats?.executive?.vice_principal?.sections?.wakasek_class_management || {},
    [stats],
  );
  const classes = useMemo(() => section.classes || [], [section]);
  const teacherCandidates = useMemo(() => section.teacher_candidates || [], [section]);
  const unassignedStudents = useMemo(() => section.unassigned_students || [], [section]);
  const opts = useMemo(() => section.academic_options || {}, [section]);
  const period = useMemo(() => section.period || {}, [section]);

  const [filters, setFilters] = useState({ tahunAjaran: 'all', tingkat: 'all' });
  const [searchText, setSearchText] = useState('');
  const [waliModal, setWaliModal] = useState(null);   // row sedang diatur wali
  const [detailModal, setDetailModal] = useState(null); // row detail
  const [pdfPreview, setPdfPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const modalOpen = !!waliModal || !!detailModal;
  useEscapeKey(modalOpen, () => { setWaliModal(null); setDetailModal(null); });
  useBodyScrollLock(modalOpen);

  const taOptions = useMemo(() => opts.tahun_ajaran || [], [opts]);
  const tingkatOptions = useMemo(() => opts.tingkat || [], [opts]);

  // Set default tahun ajaran ke periode aktif sekali data tiba.
  useEffect(() => {
    if (period.tahun_ajaran && filters.tahunAjaran === 'all') {
      setFilters((f) => (f.tahunAjaran === 'all' ? { ...f, tahunAjaran: period.tahun_ajaran } : f));
    }
  }, [period.tahun_ajaran, filters.tahunAjaran]);

  const filteredClasses = useMemo(() => classes.filter((c) => {
    if (filters.tahunAjaran !== 'all' && (c.academic_year || '') !== filters.tahunAjaran) return false;
    if (filters.tingkat !== 'all' && (c.grade_level || '') !== filters.tingkat) return false;
    if (searchText.trim()) {
      const hay = `${c.name} ${c.department_name || ''} ${c.homeroom_teacher_name || ''}`.toLowerCase();
      if (!hay.includes(searchText.toLowerCase())) return false;
    }
    return true;
  }), [classes, filters, searchText]);

  // KPI disinkronkan dengan baris tabel terfilter.
  const kpi = useMemo(() => {
    const totalRombel = filteredClasses.length;
    const waliTerplot = filteredClasses.filter((c) => c.homeroom_teacher_id != null).length;
    const siswa = filteredClasses.reduce((s, c) => s + (c.active_students || 0), 0);
    const jadwal = filteredClasses.reduce((s, c) => s + (c.schedule_count || 0), 0);
    const avgJadwal = totalRombel > 0 ? Math.round((jadwal / totalRombel) * 10) / 10 : 0;
    return { totalRombel, waliTerplot, tanpaWali: totalRombel - waliTerplot, siswa, avgJadwal, jadwal };
  }, [filteredClasses]);

  const loading = !stats;

  const handleSaveWali = async (teacherId) => {
    if (!waliModal) return;
    try {
      setSaving(true);
      const payload = { class_id: waliModal.id };
      if (teacherId) payload.teacher_id = Number(teacherId);
      const res = await managementAPI.assignHomeroom(payload);
      toast.success(res?.data?.message || 'Wali kelas berhasil diperbarui.');
      setWaliModal(null);
      if (typeof onRefresh === 'function') await onRefresh();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal menyimpan wali kelas. Silakan coba lagi.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (!filteredClasses.length) { toast.error('Belum ada data untuk diekspor.'); return; }
    const data = filteredClasses.map((c, i) => ({
      No: i + 1,
      'Rombongan Belajar': c.name || '-',
      Jurusan: c.department_name || '-',
      Tingkat: c.grade_level || '-',
      'Tahun Ajaran': c.academic_year || '-',
      'Wali Kelas': c.homeroom_teacher_name || 'Belum Ditentukan',
      NIP: c.homeroom_teacher_nip || '-',
      'Siswa Aktif': c.active_students ?? 0,
      Kapasitas: c.capacity ?? '-',
      Mapel: c.mapel_count ?? 0,
      Guru: c.guru_count ?? 0,
      'Jadwal Terplot': c.schedule_count ?? 0,
      'Status Kesiapan': c.ready_for_kbm ? 'Siap KBM' : 'Perlu Plotting',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plotting Wali Kelas');
    const ta = (filters.tahunAjaran === 'all' ? 'SemuaTA' : filters.tahunAjaran).replace(/[^\w]+/g, '_');
    XLSX.writeFile(wb, `Plotting_Wali_Kelas_${ta}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewPlottingWaliKelasPDF({
        rows: filteredClasses,
        period,
        wakilName: user?.name,
        wakilNip: user?.nisn_nip || user?.nip || user?.school_id || null,
      });
      if (res) setPdfPreview(res);
    } catch { /* toast sudah ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat plotting kelas & wali kelas..." />;

  const clockObj = clock || { time: '', day: '', date: '' };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner khusus Wakasek (seragam portal pimpinan) ── */}
      <div className="animate-fade-in-up relative overflow-hidden rounded-[3rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-7 lg:p-9 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> Portal Vice Principal Authority
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Plotting Kelas &amp; Wali Kelas</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600 whitespace-nowrap">
              Kelola rombel aktif, penugasan wali kelas, dan plotting jadwal mengajar.
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
          label="Total Rombongan Belajar"
          value={kpi.totalRombel}
          sub={`${period.tahun_ajaran || 'Semua TA'}${period.semester ? ` · ${period.semester}` : ''}`}
          icon={LayoutGrid}
          accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }}
        />
        <KpiCard
          label="Wali Kelas Terplot"
          value={`${kpi.waliTerplot}/${kpi.totalRombel}`}
          sub={kpi.tanpaWali > 0 ? `${kpi.tanpaWali} rombel belum punya wali kelas` : 'Semua rombel sudah punya wali kelas'}
          highlight={kpi.tanpaWali > 0}
          icon={UserCheck}
          accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }}
        />
        <KpiCard
          label="Total Siswa Terdistribusi"
          value={kpi.siswa}
          sub={unassignedStudents.length > 0 ? `${unassignedStudents.length} siswa belum masuk rombel` : 'Semua siswa aktif sudah masuk rombel'}
          highlight={unassignedStudents.length > 0}
          icon={Users}
          accent={{ grad: 'from-violet-50/90 via-white to-violet-50/50', border: 'border-violet-200/70', chip: 'bg-violet-100', text: 'text-violet-600' }}
        />
        <KpiCard
          label="Kelengkapan Jadwal Kelas"
          value={`${kpi.avgJadwal}`}
          sub={`Rata-rata mapel/jadwal ter-plot per rombel (${kpi.jadwal} total)`}
          icon={CalendarCheck}
          accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }}
        />
      </div>

      {/* ── Panel Ringkasan Visual 2 Kolom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kiri: Distribusi Populasi Siswa per Rombel (SVG bar horizontal) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Distribusi Populasi Siswa per Rombel</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">Jumlah siswa aktif riil (class_students) dibanding kapasitas rombel.</p>
          <PopulationChart rows={filteredClasses} />
        </div>

        {/* Kanan: Status Kesiapan Plotting Kelas (checklist otomatis) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-black text-slate-900">Status Kesiapan Plotting Kelas</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">Cek otomatis: wali kelas, siswa aktif, dan jadwal mengajar terpasang.</p>
          <ReadinessChecklist rows={filteredClasses} />
        </div>
      </div>

      {/* ── Filter & Ekspor ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <FilterSelect label="Tahun Ajaran" value={filters.tahunAjaran} onChange={(v) => setFilters((f) => ({ ...f, tahunAjaran: v }))} options={taOptions} allLabel="Semua Tahun Ajaran" emptyLabel="Belum ada data TA" />
            <FilterSelect label="Tingkat" value={filters.tingkat} onChange={(v) => setFilters((f) => ({ ...f, tingkat: v }))} options={tingkatOptions} allLabel="Semua Tingkat" emptyLabel="Belum ada tingkat" optionLabel={tingkatLabel} />
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
              <Search className="h-4 w-4" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Cari kelas / wali kelas"
                className="bg-transparent outline-none max-w-[14rem]"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportExcel}
              disabled={!filteredClasses.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4" /> Ekspor Data Plotting (.xlsx)
            </button>
            <button
              onClick={handlePrintPDF}
              disabled={!filteredClasses.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" /> Cetak SK / Rekap Plotting (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel Plotting Kelas ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Rombongan Belajar', 'Wali Kelas Saat Ini', 'Jumlah Siswa', 'Plotting Jadwal', 'Status Kesiapan', 'Aksi'].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClasses.length > 0 ? filteredClasses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-slate-900">{c.name || '-'}</p>
                    <p className="text-xs text-slate-500">{c.department_name || '-'}{c.grade_level ? ` · ${c.grade_level}` : ''}</p>
                  </td>
                  <td className="px-6 py-4">
                    {c.homeroom_teacher_name ? (
                      <div>
                        <p className="text-sm font-bold text-slate-800">{c.homeroom_teacher_name}</p>
                        <p className="text-xs text-slate-500">NIP: {c.homeroom_teacher_nip || '-'}</p>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-rose-700">
                        <AlertCircle className="h-3 w-3" /> Belum Ditentukan
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-black ${c.active_students > 0 ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.active_students} Siswa
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <span className="font-black text-slate-900">{c.mapel_count}</span> mapel · <span className="font-black text-slate-900">{c.guru_count}</span> guru
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${c.ready_for_kbm ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.ready_for_kbm ? 'Siap KBM' : 'Perlu Plotting'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setWaliModal(c)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7c3aed] text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Atur Wali Kelas
                      </button>
                      <button
                        onClick={() => setDetailModal(c)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" /> Rincian Kelas
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <LayoutGrid className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada rombongan belajar</p>
                      <p className="text-xs text-slate-500">Sesuaikan filter tahun ajaran/tingkat, atau tambahkan kelas lewat modul Admin Akademik.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {waliModal ? (
        <AssignWaliModal
          cls={waliModal}
          candidates={teacherCandidates}
          saving={saving}
          onClose={() => setWaliModal(null)}
          onSave={handleSaveWali}
        />
      ) : null}

      {detailModal ? (
        <ClassDetailModal cls={detailModal} period={period} onClose={() => setDetailModal(null)} />
      ) : null}

      <RaporPdfPreview
        state={pdfPreview}
        onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
        title="Pratinjau Rekap Plotting Wali Kelas (PDF)"
        downloadLabel="Unduh Rekap"
      />
    </div>
  );
};

/* ── Grafik batang horizontal SVG: siswa riil vs kapasitas ── */
const PopulationChart = ({ rows }) => {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <Users className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada data rombel</p>
      </div>
    );
  }
  const maxScale = Math.max(...rows.map((c) => Math.max(c.capacity || 0, c.active_students || 0)), 1);
  return (
    <div className="space-y-4">
      {rows.map((c, i) => {
        const cap = c.capacity || 0;
        const active = c.active_students || 0;
        const capPct = (cap / maxScale) * 100;
        const activePct = (active / maxScale) * 100;
        return (
          <div key={c.id}>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-bold text-slate-700">{c.name}</span>
              <span className="text-xs font-black text-slate-500">{active} / {cap || '—'} siswa</span>
            </div>
            <svg width="100%" height="16" viewBox="0 0 100 16" preserveAspectRatio="none" className="overflow-visible">
              {/* track kapasitas */}
              <rect x="0" y="2" width={capPct || 100} height="12" rx="2" fill="#e2e8f0" />
              {/* nilai siswa aktif */}
              {active > 0 && (
                <rect
                  x="0" y="2"
                  width={activePct}
                  height="12"
                  rx="2"
                  fill="#6366f1"
                  className="animate-grow-x"
                  style={{ transformBox: 'fill-box', transformOrigin: 'left center', animationDelay: `${i * 90}ms` }}
                />
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
};

/* ── Checklist kesiapan otomatis per kelas ── */
const ReadinessChecklist = ({ rows }) => {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <ClipboardList className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada data kelas</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 max-h-[22rem] overflow-y-auto pr-1">
      {rows.map((c) => {
        const checks = [
          { label: 'Wali kelas ditugaskan', ok: c.homeroom_teacher_id != null },
          { label: 'Minimal 1 siswa aktif', ok: (c.active_students || 0) > 0 },
          { label: 'Jadwal/mapel ter-plot', ok: (c.schedule_count || 0) > 0 },
        ];
        return (
          <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-black text-slate-900">{c.name}</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${c.ready_for_kbm ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {c.ready_for_kbm ? 'Siap KBM' : 'Perlu Plotting'}
              </span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {checks.map((chk) => (
                <li key={chk.label} className="flex items-center gap-1.5 text-xs font-bold">
                  {chk.ok
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    : <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />}
                  <span className={chk.ok ? 'text-slate-600' : 'text-rose-500'}>{chk.label}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, options, allLabel, emptyLabel, optionLabel }) => {
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
        {options.map((o) => (<option key={o} value={o}>{optionLabel ? optionLabel(o) : o}</option>))}
      </select>
    </label>
  );
};

/* ── Modal: Atur / Ganti Wali Kelas (house-style z-[9999]) ── */
const AssignWaliModal = ({ cls, candidates, saving, onClose, onSave }) => {
  const [selected, setSelected] = useState('');
  useEffect(() => { setSelected(cls.homeroom_teacher_id ? String(cls.homeroom_teacher_id) : ''); }, [cls]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-violet-600 to-indigo-700 px-7 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-100">Atur Wali Kelas</p>
            <h3 className="text-xl font-black text-white">{cls.name || 'Kelas'}</h3>
            <p className="mt-0.5 text-xs text-violet-50">Wali saat ini: {cls.homeroom_teacher_name || 'Belum Ditentukan'}</p>
          </div>
          <ModalCloseControl onClose={onClose} tone="onDark" />
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Guru Wali Kelas</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
            >
              <option value="">— Belum ada wali kelas (lepas) —</option>
              {candidates.map((g) => {
                const conflict = g.is_homeroom && String(g.id) !== String(cls.homeroom_teacher_id);
                return (
                  <option key={g.id} value={g.id}>
                    {g.name}{g.nip ? ` (NIP ${g.nip})` : ''} — {conflict ? `Sudah wali di ${g.homeroom_class}` : (g.is_homeroom ? 'Wali kelas ini' : 'Belum jadi wali')}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              Guru yang sudah menjadi wali di rombel lain harus dilepas dulu agar tidak bentrok penugasan ganda.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">Batal</button>
            <button
              onClick={() => onSave(selected || null)}
              disabled={saving || String(selected) === String(cls.homeroom_teacher_id ?? '')}
              className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-black rounded-xl transition-colors bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* ── Modal: Rincian Kelas (siswa + mapel/guru) ── */
const ClassDetailModal = ({ cls, period, onClose }) => {
  const students = cls.students || [];
  const subjects = cls.subjects || [];
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-sky-600 to-indigo-700 px-7 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-100">Rincian Kelas</p>
            <h3 className="text-xl font-black text-white">{cls.name || 'Kelas'}</h3>
            <p className="mt-0.5 text-xs text-sky-50">
              Wali: {cls.homeroom_teacher_name || 'Belum Ditentukan'} · {period.tahun_ajaran || '-'}{period.semester ? ` / ${period.semester}` : ''}
            </p>
          </div>
          <ModalCloseControl onClose={onClose} tone="onDark" />
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <MiniStat label="Siswa Aktif" value={cls.active_students ?? 0} />
            <MiniStat label="Kapasitas" value={cls.capacity ?? '—'} />
            <MiniStat label="Mapel" value={cls.mapel_count ?? 0} />
            <MiniStat label="Guru" value={cls.guru_count ?? 0} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Anggota Kelas ({students.length})</p>
              {students.length ? (
                <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {students.map((s, i) => (
                    <li key={`${s.id}-${i}`} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <span className="text-sm font-bold text-slate-800">{s.name}</span>
                      <span className="text-xs text-slate-500">{s.school_id || '-'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic py-4">Belum ada siswa terdaftar di rombel ini.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Mapel &amp; Guru Pengampu ({subjects.length})</p>
              {subjects.length ? (
                <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {subjects.map((s, i) => (
                    <li key={`${s.subject}-${s.teacher}-${i}`} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <p className="text-sm font-bold text-slate-800">{s.subject}</p>
                      <p className="text-xs text-slate-500">{s.teacher}{s.count > 1 ? ` · ${s.count} sesi` : ''}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic py-4">Belum ada jadwal/mapel ter-plot di kelas ini.</p>
              )}
            </div>
          </div>
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

export default WakasekManajemenKelas;
