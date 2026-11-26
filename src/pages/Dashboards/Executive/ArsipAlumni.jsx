import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Clock, Users, UserPlus, UserMinus, GraduationCap, Layers,
  FileSpreadsheet, Printer, Eye, Filter, BarChart3, ClipboardList, Search,
  ArrowRightLeft, Archive,
} from 'lucide-react';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { previewAlumniMutasiPDF } from '../../../utils/alumniMutasiPdf';
import { alumniAPI } from '../../../utils/api';
import TranscriptPrintModal from '../AdminAkademik/components/Transition/TranscriptPrintModal';

const STATUS_STYLE = {
  mutasi_masuk: 'bg-amber-50 text-amber-700',
  mutasi_keluar: 'bg-rose-50 text-rose-700',
  alumni_lulus: 'bg-emerald-50 text-emerald-700',
};

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

const ArsipAlumni = ({ stats: parentStats, clock, accessRole }) => {
  const archive = parentStats?.executive?.alumni_archive;
  const kpis = archive?.kpis || {};
  const chart = archive?.chart || [];
  const riwayat = useMemo(() => archive?.riwayat || [], [archive]);
  const recent = archive?.recent || [];
  const period = archive?.period || {};

  const angkatanOptions = useMemo(() => {
    const set = new Set((archive?.angkatan_options || []).map(String));
    (archive?.academic_options || []).forEach((o) => o.academic_year && set.add(String(o.academic_year)));
    return [...set].filter(Boolean).sort().reverse();
  }, [archive]);

  const [filters, setFilters] = useState({ kategori: 'all', angkatan: 'all', search: '' });
  const [detailTarget, setDetailTarget] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  // Direktori alumni (riil) — terhubung ke GET /api/alumni.
  const [alumniRows, setAlumniRows] = useState([]);
  const [alumniSearch, setAlumniSearch] = useState('');
  const [printAlumniId, setPrintAlumniId] = useState(null);
  const detailOpen = !!detailTarget;
  useEscapeKey(detailOpen, () => setDetailTarget(null));
  useBodyScrollLock(detailOpen);

  // Load the real alumni directory straight from GET /api/alumni.
  const reloadAlumni = () => {
    const params = {};
    if (alumniSearch.trim()) params.search = alumniSearch.trim();
    alumniAPI.list(params)
      .then(({ data }) => setAlumniRows(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setAlumniRows([]));
  };
  useEffect(() => { reloadAlumni(); }, []); // eslint-disable-line

  const filtered = useMemo(() => riwayat.filter((r) => {
    if (filters.kategori === 'mutasi' && !String(r.status_type).startsWith('mutasi')) return false;
    if (filters.kategori === 'alumni' && r.status_type !== 'alumni_lulus') return false;
    if (filters.angkatan !== 'all' && String(r.angkatan || '') !== String(filters.angkatan)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!((r.name || '').toLowerCase().includes(q) || String(r.nis || '').toLowerCase().includes(q))) return false;
    }
    return true;
  }), [riwayat, filters]);

  const loading = !parentStats;

  const handleExportExcel = () => {
    const data = filtered.map((r, i) => ({
      No: i + 1,
      Nama: r.name || '-',
      'NISN/NIS': r.nis || '-',
      'Kelas Asal': r.kelas_asal || '-',
      Angkatan: r.angkatan || '-',
      Status: r.status_label || '-',
      Tanggal: r.tanggal || '-',
      Keterangan: r.keterangan || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ No: '-', Nama: 'Belum ada data mutasi & alumni' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mutasi & Alumni');
    XLSX.writeFile(wb, `Data_Mutasi_Alumni_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewAlumniMutasiPDF({ rows: filtered, period });
      if (res) setPdfPreview(res);
    } catch { /* toast ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat data mutasi & alumni..." />;

  const clockObj = clock || { time: '', day: '', date: '' };
  const chartTotal = chart.reduce((s, x) => s + (x.value || 0), 0);

  const TABS = [
    { key: 'all', label: 'Semua Arsip' },
    { key: 'mutasi', label: 'Mutasi Siswa' },
    { key: 'alumni', label: 'Alumni / Lulusan' },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner (identik Menu ke-2 s.d. ke-5) ── */}
      <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-6 lg:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> {accessRole === 'wakil_sekolah' ? 'Portal Vice Principal Authority' : 'Portal Principal Authority'}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Data Mutasi &amp; Alumni</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Arsip resmi pergerakan kesiswaan (mutasi masuk/keluar), riwayat kelulusan, serta penelusuran data alumni sekolah.
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
        <KpiCard label="Siswa Aktif Terdaftar" value={String(kpis.siswa_aktif ?? 0)} sub={`${kpis.siswa_enrolled_aktif ?? 0} ter-enroll di kelas`} icon={Users} accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }} />
        <KpiCard label="Mutasi Masuk & Keluar" value={`${kpis.mutasi_masuk ?? 0} / ${kpis.mutasi_keluar ?? 0}`} sub="masuk / keluar-pindah" icon={ArrowRightLeft} accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }} />
        <KpiCard label="Arsip Alumni / Lulusan" value={String(kpis.alumni_lulus ?? 0)} sub="tercatat di arsip alumni" icon={GraduationCap} accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }} />
        <KpiCard label="Angkatan & Kelas Terdata" value={`${kpis.angkatan_lulusan ?? 0} / ${kpis.rombel_aktif ?? 0}`} sub="angkatan lulus / rombel aktif" icon={Layers} accent={{ grad: 'from-violet-50/90 via-white to-violet-50/50', border: 'border-violet-200/70', chip: 'bg-violet-100', text: 'text-violet-600' }} />
      </div>

      {/* ── Panel Ringkasan Visual 2 Kolom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Sebaran Status Kesiswaan &amp; Arsip</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">Siswa aktif vs mutasi vs alumni — riil dari database.</p>
          {chartTotal === 0 ? (
            <EmptyViz text="Belum ada data" note="Sebaran muncul setelah ada siswa/mutasi/alumni tercatat." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="flex flex-col items-center gap-3">
                <Donut segments={chart} />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-bold text-slate-600">
                  {chart.map((c) => (
                    <span key={c.label} className="flex items-center gap-1.5">
                      <i className="w-3 h-3 rounded-full inline-block" style={{ background: c.color }} /> {c.label} {c.value}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5">
                {chart.map((c) => (
                  <StatBar key={c.label} label={c.label} value={c.value} max={Math.max(...chart.map((x) => x.value), 1)} color={c.color} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Archive className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-black text-slate-900">Catatan Mutasi &amp; Kelulusan Terbaru</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">5 perubahan status siswa / alumni terbaru.</p>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                <ClipboardList className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada riwayat</p>
              <p className="text-xs text-slate-500 max-w-xs">Belum ada riwayat mutasi maupun arsip alumni yang tercatat di sistem.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 truncate">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.kelas_asal || '-'}{r.angkatan ? ` · ${r.angkatan}` : ''} · {r.tanggal || '-'}</p>
                  </div>
                  <span className={`shrink-0 inline-flex px-2.5 py-1 rounded-lg text-xs font-black ${STATUS_STYLE[r.status_type] || 'bg-slate-100 text-slate-500'}`}>{r.status_label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Tab + Filter + Ekspor ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setFilters((f) => ({ ...f, kategori: t.key }))}
              className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${filters.kategori === t.key ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
            <FilterSelect label="Angkatan / TA" value={filters.angkatan} onChange={(v) => setFilters((f) => ({ ...f, angkatan: v }))} options={angkatanOptions} allLabel="Semua Angkatan" emptyLabel="Belum ada angkatan" />
            <label className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
              <Search className="h-4 w-4" />
              <input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Cari nama / NISN..." className="bg-transparent outline-none w-44" />
            </label>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <button onClick={handleExportExcel} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-emerald-700 transition-colors">
              <FileSpreadsheet className="h-4 w-4" /> Ekspor Data Mutasi &amp; Alumni (.xlsx)
            </button>
            <button onClick={handlePrintPDF} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-rose-700 transition-colors">
              <Printer className="h-4 w-4" /> Cetak Laporan Mutasi &amp; Alumni (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel Arsip ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Nama & NISN', 'Kelas Asal / Angkatan', 'Jenis Status', 'Tanggal & Keterangan', 'Aksi'].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-slate-900">{r.name || '-'}</p>
                    <p className="text-xs text-slate-500">NISN/NIS: {r.nis || '-'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-slate-800">{r.kelas_asal || '-'}</p>
                    <p className="text-xs text-slate-500">Angkatan: {r.angkatan || '-'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black ${STATUS_STYLE[r.status_type] || 'bg-slate-100 text-slate-500'}`}>
                      {r.status_type === 'mutasi_masuk' ? <UserPlus className="h-3.5 w-3.5" /> : r.status_type === 'mutasi_keluar' ? <UserMinus className="h-3.5 w-3.5" /> : <GraduationCap className="h-3.5 w-3.5" />}
                      {r.status_label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-700">{r.tanggal || '-'}</p>
                    <p className="text-xs text-slate-500">{r.keterangan || '-'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => setDetailTarget(r)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-colors">
                      <Eye className="h-4 w-4" /> Detail Arsip
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <GraduationCap className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada data</p>
                      <p className="text-xs text-slate-500 max-w-sm">Belum ada riwayat mutasi maupun arsip alumni yang tercatat di sistem. Data muncul setelah siswa dimutasi/diluluskan &amp; diarsipkan.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Direktori Alumni (riil: GET /api/alumni) ── */}
      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Direktori Alumni</h3>
          <div className="relative">
            <input value={alumniSearch} onChange={(e) => setAlumniSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && reloadAlumni()}
              placeholder="Cari Nama / NISN…" className="w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-6 py-3">Nama</th><th className="px-6 py-3">NISN</th>
                <th className="px-6 py-3">Jurusan</th><th className="px-6 py-3">Tahun Lulus</th>
                <th className="px-6 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alumniRows.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-xs italic text-slate-400">Belum ada alumni terarsip.</td></tr>
              ) : alumniRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-bold text-slate-800">{r.nama_lengkap}</td>
                  <td className="px-6 py-3 text-slate-600">{r.nisn || '—'}</td>
                  <td className="px-6 py-3 text-slate-600">{r.jurusan_nama || r.jurusan || '—'}</td>
                  <td className="px-6 py-3 text-slate-600">{r.tahun_lulus || '—'}</td>
                  <td className="px-6 py-3">
                    <div className="flex justify-end">
                      <button onClick={() => setPrintAlumniId(r.id)}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-indigo-700 hover:bg-indigo-100">
                        <GraduationCap className="w-3.5 h-3.5" /> Lihat & Cetak Transkrip
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {printAlumniId ? <TranscriptPrintModal alumniId={printAlumniId} onClose={() => setPrintAlumniId(null)} /> : null}

      {detailOpen && detailTarget ? <DetailModal item={detailTarget} onClose={() => setDetailTarget(null)} /> : null}

      <RaporPdfPreview state={pdfPreview} onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }} title="Pratinjau Laporan Mutasi & Alumni (PDF)" downloadLabel="Unduh Laporan" />
    </div>
  );
};

const EmptyViz = ({ text, note }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
      <BarChart3 className="w-8 h-8 text-slate-400" />
    </div>
    <p className="text-sm font-black text-slate-400 uppercase tracking-wider">{text}</p>
    <p className="text-xs text-slate-500 max-w-xs">{note}</p>
  </div>
);

const StatBar = ({ label, value, max, color }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs font-black text-slate-600 truncate">{label}</span>
      <div className="h-3 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className="animate-grow-x h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-6 text-right text-sm font-black text-slate-900">{value}</span>
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, options, allLabel, emptyLabel }) => {
  const disabled = options.length === 0;
  return (
    <label className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
      <Filter className="h-4 w-4" />
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="bg-transparent outline-none max-w-[12rem]">
        <option value="all">{disabled ? emptyLabel : allLabel}</option>
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    </label>
  );
};

const DetailModal = ({ item, onClose }) => {
  const fields = [
    { label: 'Nama Lengkap', value: item.name || '-' },
    { label: 'NISN / NIS', value: item.nis || '-' },
    { label: 'Kelas Asal', value: item.kelas_asal || '-' },
    { label: 'Angkatan', value: item.angkatan || '-' },
    { label: 'Jenis Status', value: item.status_label || '-' },
    { label: 'Tanggal', value: item.tanggal || '-' },
    { label: 'Asal', value: item.asal || '-' },
    { label: 'Tujuan', value: item.tujuan || '-' },
    { label: 'E-mail', value: item.email || '-' },
  ];
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-amber-500 to-orange-600 px-7 py-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">Detail Arsip</p>
            <h3 className="text-2xl font-black text-white">{item.name || 'Siswa'}</h3>
            <p className="mt-1 text-sm text-amber-50">{item.status_label} · {item.tanggal || '-'}</p>
          </div>
          <ModalCloseControl onClose={onClose} tone="onDark" />
        </div>
        <div className="px-7 py-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {fields.map((f) => (
              <div key={f.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{f.label}</p>
                <p className="text-sm font-bold text-slate-900 break-words">{f.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 mb-1">Catatan Mutasi / Kelulusan</p>
            <p className="text-sm text-slate-700">{item.keterangan || <span className="italic text-slate-400">Tidak ada keterangan.</span>}</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ArsipAlumni;
