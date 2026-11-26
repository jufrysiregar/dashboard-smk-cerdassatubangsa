import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Clock, FileText, TrendingUp, Target, AlertTriangle, Eye, Filter, Search,
  FileSpreadsheet, Printer, CheckCircle2, Activity, ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { previewWakasekRekapNilaiPDF } from '../../../utils/wakasekRekapNilaiKkmPdf';

const rekapStatus = (r) => (!r.has_nilai ? 'Belum Ada Nilai' : (r.remedial > 0 ? 'Perlu Remedial' : 'Tuntas KKM'));

const STATUS_TONE = {
  'Tuntas KKM': 'bg-emerald-100 text-emerald-700',
  'Perlu Remedial': 'bg-rose-100 text-rose-700',
  'Belum Ada Nilai': 'bg-slate-100 text-slate-500',
};

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

const WakasekLaporanNilaiKelulusan = ({ stats, clock, accessRole, user }) => {
  const section = useMemo(
    () => stats?.executive?.vice_principal?.sections?.wakasek_graduation || {},
    [stats],
  );
  const kpis = useMemo(() => section.kpis || {}, [section]);
  const rekap = useMemo(() => section.rekap || [], [section]);
  const students = useMemo(() => section.students || [], [section]);
  const chart = useMemo(() => section.chart || [], [section]);
  const remedialList = useMemo(() => section.remedial_list || [], [section]);
  const filterOptions = useMemo(() => section.filter_options || {}, [section]);
  const period = useMemo(() => section.period || {}, [section]);
  const kkmStandar = section.kkm_standar ?? 75;

  const [view, setView] = useState('rekap'); // 'rekap' | 'siswa'
  const [filters, setFilters] = useState({ kelas: 'all', status: 'all' });
  const [searchText, setSearchText] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

  const modalOpen = !!detailModal;
  useEscapeKey(modalOpen, () => setDetailModal(null));
  useBodyScrollLock(modalOpen);

  const kelasOptions = useMemo(() => filterOptions.classes || [], [filterOptions]);

  const filteredRekap = useMemo(() => rekap.filter((r) => {
    if (filters.kelas !== 'all' && String(r.kelas_id) !== String(filters.kelas)) return false;
    if (filters.status !== 'all' && rekapStatus(r) !== filters.status) return false;
    if (searchText.trim()) {
      const hay = `${r.mapel_name} ${r.kelas_name} ${r.guru_name}`.toLowerCase();
      if (!hay.includes(searchText.toLowerCase())) return false;
    }
    return true;
  }), [rekap, filters, searchText]);

  const filteredStudents = useMemo(() => students.filter((s) => {
    if (filters.kelas !== 'all' && String(s.kelas_id) !== String(filters.kelas)) return false;
    if (filters.status === 'Tuntas KKM' && !s.tuntas) return false;
    if (filters.status === 'Perlu Remedial' && s.tuntas) return false;
    if (filters.status === 'Belum Ada Nilai') return false;
    if (searchText.trim()) {
      const hay = `${s.siswa_name} ${s.mapel_name}`.toLowerCase();
      if (!hay.includes(searchText.toLowerCase())) return false;
    }
    return true;
  }), [students, filters, searchText]);

  const loading = !stats;

  const handleExportExcel = () => {
    if (view === 'rekap') {
      if (!filteredRekap.length) { toast.error('Belum ada rekap untuk diekspor.'); return; }
      const data = filteredRekap.map((r, i) => ({
        No: i + 1,
        'Mata Pelajaran': r.mapel_name || '-',
        Rombel: r.kelas_name || '-',
        'Guru Pengampu': r.guru_name || '-',
        NIP: r.guru_nip || '-',
        'Nilai Masuk': r.nilai_masuk ?? 0,
        'Total Siswa': r.total_siswa_rombel ?? 0,
        'Rata-rata': r.average ?? '-',
        KKM: r.kkm ?? kkmStandar,
        Tuntas: r.tuntas ?? 0,
        Remedial: r.remedial ?? 0,
        'Status Rapor': r.status_rapor || '-',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai & KKM');
      const label = (period.tahun_ajaran || 'Periode').replace(/[^\w]+/g, '_');
      XLSX.writeFile(wb, `Rekap_Nilai_KKM_${label}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
    } else {
      if (!filteredStudents.length) { toast.error('Belum ada nilai siswa untuk diekspor.'); return; }
      const data = filteredStudents.map((s, i) => ({
        No: i + 1,
        'Nama Siswa': s.siswa_name || '-',
        'Mata Pelajaran': s.mapel_name || '-',
        Rombel: s.kelas_name || '-',
        Nilai: s.nilai,
        KKM: s.kkm,
        Status: s.tuntas ? 'Tuntas KKM' : 'Perlu Remedial',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daftar Nilai Siswa');
      const label = (period.tahun_ajaran || 'Periode').replace(/[^\w]+/g, '_');
      XLSX.writeFile(wb, `Daftar_Nilai_Siswa_${label}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
    }
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewWakasekRekapNilaiPDF({
        rows: filteredRekap,
        period,
        wakilName: user?.name,
        wakilNip: user?.nisn_nip || user?.nip || user?.school_id || null,
      });
      if (res) setPdfPreview(res);
    } catch { /* toast sudah ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat rekap nilai & ketuntasan KKM..." />;

  const clockObj = clock || { time: '', day: '', date: '' };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner khusus Wakasek (seragam Menu ke-2 s.d. ke-5) ── */}
      <div className="animate-fade-in-up relative overflow-hidden rounded-[3rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-7 lg:p-9 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> Portal Vice Principal Authority
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Rekap Nilai &amp; Ketuntasan KKM</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600 whitespace-nowrap">
              Pantau progres input nilai, ketercapaian KKM, dan kesiapan rapor per rombel.
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
          label="Progres Setoran Nilai Mapel"
          value={`${kpis.progres_pct ?? 0}%`}
          sub={`${kpis.pairs_with_nilai ?? 0}/${kpis.total_pairs ?? 0} mapel-kelas setor nilai`}
          icon={TrendingUp}
          accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }}
        />
        <KpiCard
          label="Rata-Rata Capaian Nilai"
          value={kpis.rata_sekolah == null ? 'Belum ada nilai' : kpis.rata_sekolah}
          sub="Rata-rata akademik seluruh nilai masuk"
          icon={Target}
          accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }}
        />
        <KpiCard
          label="Persentase Ketuntasan KKM"
          value={kpis.ketuntasan_pct == null ? 'Belum ada nilai' : `${kpis.ketuntasan_pct}%`}
          sub={`${kpis.tuntas ?? 0}/${kpis.total_nilai ?? 0} tuntas (KKM ${kkmStandar})`}
          icon={CheckCircle2}
          accent={{ grad: 'from-violet-50/90 via-white to-violet-50/50', border: 'border-violet-200/70', chip: 'bg-violet-100', text: 'text-violet-600' }}
        />
        <KpiCard
          label="Perlu Remedial / Belum Tuntas"
          value={kpis.remedial ?? 0}
          sub="Entri nilai di bawah KKM"
          highlight={(kpis.remedial ?? 0) > 0}
          icon={AlertTriangle}
          accent={{ grad: 'from-amber-50/90 via-white to-rose-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }}
        />
      </div>

      {/* ── Panel Ringkasan Visual 2 Kolom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Capaian Rata-Rata &amp; Ketuntasan per Rombel</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">Rata-rata nilai dan tingkat ketuntasan KKM tiap kelas (riil).</p>
          <RombelChart rows={chart} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-5 w-5 text-rose-600" />
            <h3 className="text-base font-black text-slate-900">Remedial &amp; Status Setoran Nilai</h3>
          </div>
          <p className="text-xs text-slate-500 mb-6">Siswa di bawah KKM atau mapel yang belum menyetor nilai.</p>
          <AttentionPanel remedialList={remedialList} rekap={rekap} />
        </div>
      </div>

      {/* ── Tab Tampilan ── */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setView('rekap')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'rekap' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <FileText className="w-4 h-4" /> Rekap per Mapel &amp; Kelas
        </button>
        <button onClick={() => setView('siswa')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'siswa' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ClipboardList className="w-4 h-4" /> Daftar Nilai Siswa
        </button>
      </div>

      {/* ── Filter & Ekspor ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <FilterSelect
              label="Kelas"
              value={filters.kelas}
              onChange={(v) => setFilters((f) => ({ ...f, kelas: v }))}
              options={kelasOptions}
              allLabel="Semua Kelas"
              emptyLabel="Belum ada kelas"
            />
            <FilterSelect
              label="Status Ketuntasan"
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              options={[{ id: 'Tuntas KKM', name: 'Tuntas KKM' }, { id: 'Perlu Remedial', name: 'Perlu Remedial' }, { id: 'Belum Ada Nilai', name: 'Belum Ada Nilai' }]}
              allLabel="Semua Status"
            />
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
              <Search className="h-4 w-4" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Cari siswa / mapel / guru"
                className="bg-transparent outline-none max-w-[14rem]"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportExcel}
              disabled={view === 'rekap' ? !filteredRekap.length : !filteredStudents.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4" /> Ekspor Rekap Nilai &amp; KKM (.xlsx)
            </button>
            <button
              onClick={handlePrintPDF}
              disabled={!filteredRekap.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4" /> Cetak Laporan Rekap Nilai &amp; KKM (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel ── */}
      {view === 'rekap' ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Mata Pelajaran & Rombel', 'Guru Pengampu', 'Jumlah Nilai Masuk', 'Rata-rata & Ketuntasan KKM', 'Status Rapor', 'Aksi'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRekap.length > 0 ? filteredRekap.map((r, idx) => (
                  <tr key={`${r.mapel_id}-${r.kelas_id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-900">{r.mapel_name || '-'}</p>
                      <span className="mt-1 inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700">{r.kelas_name || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{r.guru_name || '-'}</p>
                      <p className="text-xs text-slate-500">NIP: {r.guru_nip || '-'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className="font-black text-slate-900">{r.nilai_masuk}</span> / {r.total_siswa_rombel} siswa
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <p>Rata-rata: <span className="font-black text-slate-900">{r.average == null ? '—' : r.average}</span></p>
                      <p className="text-xs text-slate-500">
                        {r.tuntas_pct == null ? 'Belum ada nilai' : `Tuntas ${r.tuntas_pct}%`} · {r.remedial} remedial
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${STATUS_TONE[rekapStatus(r)] || 'bg-slate-100 text-slate-600'}`}>
                        {r.status_rapor}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setDetailModal(r)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Eye className="h-4 w-4" /> Rincian Nilai
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                          <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada mapel terjadwal</p>
                        <p className="text-xs text-slate-500">Sesuaikan filter, atau rekap akan muncul saat jadwal mengajar & nilai tersedia.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Nama Siswa', 'Mata Pelajaran', 'Rombel', 'Nilai', 'KKM', 'Status'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length > 0 ? filteredStudents.map((s, idx) => (
                  <tr key={`${s.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{s.siswa_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.mapel_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.kelas_name}</td>
                    <td className="px-6 py-4 text-sm font-black text-slate-900">{s.nilai}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{s.kkm}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${s.tuntas ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {s.tuntas ? 'Tuntas KKM' : 'Perlu Remedial'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                          <ClipboardList className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada nilai yang diinput guru</p>
                        <p className="text-xs text-slate-500">Daftar nilai siswa akan muncul otomatis saat guru menginput nilai.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailModal ? (
        <NilaiDetailModal row={detailModal} students={students} onClose={() => setDetailModal(null)} />
      ) : null}

      <RaporPdfPreview
        state={pdfPreview}
        onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
        title="Pratinjau Laporan Rekap Nilai & Ketuntasan KKM (PDF)"
        downloadLabel="Unduh Laporan"
      />
    </div>
  );
};

/* ── Grafik batang horizontal SVG: rata-rata & ketuntasan per rombel ── */
const RombelChart = ({ rows }) => {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <Activity className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada nilai yang diinput guru</p>
        <p className="text-xs text-slate-500 max-w-xs">Capaian rata-rata & ketuntasan per rombel akan muncul otomatis.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sky-500" /> Rata-rata (/100)</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Ketuntasan KKM (%)</span>
      </div>
      {rows.map((r, i) => {
        const avg = r.average ?? 0;
        const tuntas = r.tuntas_pct ?? 0;
        return (
          <div key={`${r.name}-${i}`}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-bold text-slate-700">{r.name}</span>
              <span className="text-xs font-black text-slate-500">{r.average == null ? '—' : avg} · {r.tuntas_pct == null ? '—' : `${tuntas}%`}</span>
            </div>
            <svg width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none" className="overflow-visible">
              <rect x="0" y="3" width="100" height="7" rx="1.5" fill="#f1f5f9" />
              <rect x="0" y="3" width={Math.min(avg, 100)} height="7" rx="1.5" fill="#0ea5e9" className="animate-grow-x" style={{ transformBox: 'fill-box', transformOrigin: 'left center', animationDelay: `${i * 70}ms` }} />
              <rect x="0" y="14" width="100" height="7" rx="1.5" fill="#f1f5f9" />
              {tuntas > 0 && (
                <rect x="0" y="14" width={Math.min(tuntas, 100)} height="7" rx="1.5" fill="#10b981" className="animate-grow-x" style={{ transformBox: 'fill-box', transformOrigin: 'left center', animationDelay: `${i * 70 + 35}ms` }} />
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
};

/* ── Panel kanan: siswa remedial ATAU mapel belum setor ATAU empty-state ── */
const AttentionPanel = ({ remedialList, rekap }) => {
  if (remedialList.length) {
    return (
      <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {remedialList.map((s, i) => (
          <li key={`${s.id}-${i}`} className="animate-fade-in-up rounded-xl border border-rose-100 bg-rose-50 px-4 py-3" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900 truncate">{s.siswa_name}</p>
              <span className="shrink-0 text-xs font-black text-rose-600">{s.nilai} / KKM {s.kkm}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{s.mapel_name} · {s.kelas_name}</p>
          </li>
        ))}
      </ul>
    );
  }

  const belumSetor = rekap.filter((r) => !r.has_nilai).slice(0, 8);
  if (belumSetor.length) {
    return (
      <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {belumSetor.map((r, i) => (
          <li key={`${r.mapel_id}-${r.kelas_id}-${i}`} className="animate-fade-in-up rounded-xl border border-amber-100 bg-amber-50 px-4 py-3" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900 truncate">{r.mapel_name}</p>
              <span className="shrink-0 text-[11px] font-black uppercase tracking-wider text-amber-700">Menunggu Nilai Guru</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{r.kelas_name} · {r.guru_name}</p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
      </div>
      <p className="text-sm font-black text-emerald-600 uppercase tracking-wider">Belum ada nilai yang diinput guru</p>
      <p className="text-xs text-slate-500 max-w-xs">Perlu remedial & status setoran akan muncul saat data nilai bertambah.</p>
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
        className="bg-transparent outline-none max-w-[14rem]"
      >
        <option value="all">{disabled ? emptyLabel : allLabel}</option>
        {options.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
      </select>
    </label>
  );
};

/* ── Modal Rincian Nilai (daftar siswa + status KKM) ── */
const NilaiDetailModal = ({ row, students, onClose }) => {
  const list = students.filter((s) => String(s.mapel_id) === String(row.mapel_id) && String(s.kelas_id) === String(row.kelas_id));
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-violet-600 to-indigo-700 px-7 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-100">Rincian Nilai</p>
            <h3 className="text-xl font-black text-white">{row.mapel_name}</h3>
            <p className="mt-0.5 text-xs text-violet-50">{row.kelas_name} · {row.guru_name} · KKM {row.kkm}</p>
          </div>
          <ModalCloseControl onClose={onClose} tone="onDark" />
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <MiniStat label="Nilai Masuk" value={`${row.nilai_masuk}/${row.total_siswa_rombel}`} />
            <MiniStat label="Rata-rata" value={row.average == null ? '—' : row.average} />
            <MiniStat label="Tuntas" value={row.tuntas_pct == null ? '—' : `${row.tuntas_pct}%`} />
          </div>

          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Daftar Siswa ({list.length})</p>
          {list.length ? (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {list.map((s, i) => (
                <li key={`${s.id}-${i}`} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                  <span className="text-sm font-bold text-slate-800">{s.siswa_name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">{s.nilai}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-black ${s.tuntas ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {s.tuntas ? 'Tuntas' : 'Remedial'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400 italic rounded-xl border border-dashed border-slate-200 px-4">
              <AlertTriangle className="h-4 w-4" /> Belum ada nilai diinput untuk mapel & rombel ini.
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

export default WakasekLaporanNilaiKelulusan;
