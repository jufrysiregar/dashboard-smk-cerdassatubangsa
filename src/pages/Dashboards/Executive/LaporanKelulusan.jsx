import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Clock, Award, FileCheck, Target, GraduationCap,
  FileSpreadsheet, Printer, Eye, Users, Filter, BarChart3, ClipboardList, Percent,
} from 'lucide-react';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { previewNilaiKelulusanPDF } from '../../../utils/nilaiKelulusanPdf';

const normalizeSem = (raw) => {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'ganjil' || s === '1' || s === 'satu') return 'Ganjil';
  if (s === 'genap' || s === '2' || s === 'dua') return 'Genap';
  return null;
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

const LaporanKelulusan = ({ stats: parentStats, clock, accessRole }) => {
  const grad = parentStats?.executive?.graduation_report;
  const classes = useMemo(() => grad?.classes || [], [grad]);
  const academicOptions = useMemo(() => grad?.academic_options || [], [grad]);
  const period = grad?.period || {};

  const [filters, setFilters] = useState({ tahunAjaran: 'all', semester: 'all', kelas: 'all', status: 'all' });
  const [selectedClass, setSelectedClass] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const modalOpen = !!selectedClass;
  useEscapeKey(modalOpen, () => setSelectedClass(null));
  useBodyScrollLock(modalOpen);

  useEffect(() => {
    if (grad?.period?.tahun_ajaran) {
      setFilters((f) => (f.tahunAjaran === 'all' && f.semester === 'all'
        ? { ...f, tahunAjaran: grad.period.tahun_ajaran, semester: grad.period.semester || 'all' }
        : f));
    }
  }, [grad?.period?.tahun_ajaran, grad?.period?.semester]);

  const taOptions = useMemo(() => {
    const set = new Set(academicOptions.map((o) => o.academic_year).filter(Boolean));
    classes.forEach((c) => c.academic_year && set.add(c.academic_year));
    return [...set].sort().reverse();
  }, [academicOptions, classes]);

  const semesterOptions = useMemo(() => {
    const set = new Set();
    academicOptions.forEach((o) => {
      if (filters.tahunAjaran !== 'all' && o.academic_year !== filters.tahunAjaran) return;
      const s = normalizeSem(o.semester); if (s) set.add(s);
    });
    classes.forEach((c) => {
      if (filters.tahunAjaran !== 'all' && c.academic_year !== filters.tahunAjaran) return;
      const s = normalizeSem(c.semester); if (s) set.add(s);
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
      if (cs && cs !== filters.semester) return false;
    }
    if (filters.kelas !== 'all' && c.name !== filters.kelas) return false;
    if (filters.status === 'published' && !(c.published_count > 0)) return false;
    if (filters.status === 'draft' && !((c.active_students - c.published_count) > 0)) return false;
    return true;
  }), [classes, filters]);

  // KPI & visual disinkronkan penuh dengan baris kelas yang terfilter.
  const agg = useMemo(() => {
    const allStudents = filteredClasses.flatMap((c) => c.students || []);
    const withRata = allStudents.filter((s) => s.rata !== null && s.rata !== undefined);
    const kkm = grad?.kpis?.ketuntasan?.kkm || 75;
    const tuntas = withRata.filter((s) => Number(s.rata) >= kkm).length;
    const belum = withRata.length - tuntas;
    const published = allStudents.filter((s) => s.published).length;
    const xii = allStudents.filter((s) => String(s.grade_level || '').toUpperCase() === 'XII');
    const xiiLulus = xii.filter((s) => String(s.keputusan || '').toLowerCase() === 'lulus').length;
    const ranked = allStudents.filter((s) => s.skor !== null && s.skor !== undefined).sort((a, b) => b.skor - a.skor).slice(0, 5);
    const predikat = ['A', 'B', 'C', 'D'].map((g) => ({ label: g, value: allStudents.filter((s) => s.grade_letter === g).length }));
    return {
      rata: withRata.length ? (withRata.reduce((s, x) => s + Number(x.rata), 0) / withRata.length).toFixed(1) : null,
      published,
      totalStudents: allStudents.length,
      tuntas, belum,
      pct: (tuntas + belum) > 0 ? ((tuntas / (tuntas + belum)) * 100).toFixed(1) : null,
      kkm,
      xiiCount: xii.length,
      xiiLulus,
      adaXii: xii.length > 0,
      ranked,
      predikat,
      draft: allStudents.filter((s) => s.has_rapor && !s.published).length,
    };
  }, [filteredClasses, grad]);

  const loading = !parentStats;

  const handleExportExcel = () => {
    if (!filteredClasses.length) return;
    const data = filteredClasses.map((c, i) => ({
      No: i + 1,
      Kelas: c.name || '-',
      'Wali Kelas': c.homeroom_teacher || 'Belum ditentukan',
      'Siswa Aktif': c.active_students ?? 0,
      'Rapor Terbit': `${c.published_count ?? 0}/${c.active_students ?? 0}`,
      'Rata-rata Nilai': c.rata_rata ?? '-',
      'Poin Prestasi': c.poin_prestasi ?? 0,
      'Status Kelulusan': c.status_kelulusan || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai & Kelulusan');
    XLSX.writeFile(wb, `Rekap_Nilai_Kelulusan_${(filters.tahunAjaran === 'all' ? 'SemuaTA' : filters.tahunAjaran).replace(/[^\w]+/g, '_')}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewNilaiKelulusanPDF({ rows: filteredClasses, period });
      if (res) setPdfPreview(res);
    } catch { /* toast ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat rekap nilai & kelulusan..." />;

  const clockObj = clock || { time: '', day: '', date: '' };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner (identik Menu ke-2) ── */}
      <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-6 lg:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> {accessRole === 'wakil_sekolah' ? 'Portal Vice Principal Authority' : 'Portal Principal Authority'}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Rekap Nilai, Rapor &amp; Kelulusan</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Pantau capaian akademik seluruh tingkat, status penerbitan rapor Wali Kelas, akumulasi poin prestasi, serta kelulusan siswa.
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
        <KpiCard label="Rata-Rata Nilai Sekolah" value={agg.rata != null ? agg.rata : 'Belum ada nilai'} sub={agg.rata != null ? `Dari ${agg.totalStudents} siswa aktif` : 'Nilai rapor belum terisi'} icon={Award} accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }} />
        <KpiCard label="Rapor Diterbitkan" value={`${agg.published}/${agg.totalStudents}`} sub="published_at terisi" icon={FileCheck} accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }} />
        <KpiCard label="Ketuntasan KKM" value={agg.pct != null ? `${agg.pct}%` : 'Belum ada nilai'} sub={agg.pct != null ? `${agg.tuntas} tuntas · ${agg.belum} di bawah ${agg.kkm}` : 'Nilai rapor belum terisi'} icon={Percent} accent={{ grad: 'from-violet-50/90 via-white to-violet-50/50', border: 'border-violet-200/70', chip: 'bg-violet-100', text: 'text-violet-600' }} />
        <KpiCard label="Kandidat Kelulusan XII" value={agg.adaXii ? `${agg.xiiLulus}/${agg.xiiCount}` : 'Belum ada kelas XII'} sub={agg.adaXii ? 'Lulus / siswa kelas XII' : 'Tidak ada rombel XII aktif'} icon={GraduationCap} accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }} />
      </div>

      {/* ── Panel Ringkasan Visual 2 Kolom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Distribusi Capaian Nilai &amp; Rapor</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">Status rapor (Published vs Draft) dan sebaran predikat nilai riil.</p>

          {agg.totalStudents === 0 ? (
            <EmptyViz />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="flex flex-col items-center gap-3">
                <Donut segments={[{ label: 'Published', value: agg.published, color: '#10b981' }, { label: 'Draft', value: agg.draft, color: '#94a3b8' }]} />
                <div className="flex gap-4 text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Published {agg.published}</span>
                  <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-full bg-slate-400 inline-block" /> Draft {agg.draft}</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {agg.predikat.map((p) => (
                  <PredikatBar key={p.label} label={p.label} value={p.value} max={Math.max(...agg.predikat.map((x) => x.value), 1)} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Award className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-black text-slate-900">Rekap Peringkat &amp; Prestasi Rapor</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">5 siswa skor akhir tertinggi (rata nilai + poin prestasi wali).</p>

          {agg.ranked.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                <ClipboardList className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada skor rapor</p>
              <p className="text-xs text-slate-500 max-w-xs">Peringkat muncul setelah Wali Kelas menginput nilai &amp; poin prestasi.</p>
            </div>
          ) : (
            <ol className="space-y-2.5">
              {agg.ranked.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-black ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-500 border border-slate-200'}`}>{s.peringkat ?? i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 truncate">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.class_name} · poin prestasi {s.poin}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-slate-900">{s.skor}</p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">skor akhir</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── Filter & Ekspor ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          {/* 4 filter sejajar 1 baris, rata bawah (sejajar tombol Cetak) */}
          <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
            <FilterSelect label="Tahun Ajaran" value={filters.tahunAjaran} onChange={(v) => setFilters((f) => ({ ...f, tahunAjaran: v, semester: 'all', kelas: 'all' }))} options={taOptions} allLabel="Semua Tahun Ajaran" emptyLabel="Belum ada data TA" />
            <FilterSelect label="Semester" value={filters.semester} onChange={(v) => setFilters((f) => ({ ...f, semester: v, kelas: 'all' }))} options={semesterOptions} allLabel="Semua Semester" emptyLabel="Belum ada data" />
            <FilterSelect label="Kelas" value={filters.kelas} onChange={(v) => setFilters((f) => ({ ...f, kelas: v }))} options={kelasOptions} allLabel="Semua Kelas" emptyLabel="Belum ada kelas" />
            <FilterSelect label="Status Rapor" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={['published', 'draft']} allLabel="Semua Status" emptyLabel="Semua Status" labelMap={{ published: 'Published', draft: 'Draft' }} />
          </div>
          {/* 2 tombol bertumpuk di sudut kanan */}
          <div className="flex shrink-0 flex-col items-end gap-3">
            <button onClick={handleExportExcel} disabled={!filteredClasses.length} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <FileSpreadsheet className="h-4 w-4" /> Ekspor Rekap Nilai (.xlsx)
            </button>
            <button onClick={handlePrintPDF} disabled={!filteredClasses.length} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Printer className="h-4 w-4" /> Cetak Laporan Nilai &amp; Kelulusan (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel Rekap Nilai & Kelulusan ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Kelas', 'Wali Kelas', 'Siswa Aktif', 'Rata-rata Nilai', 'Poin Prestasi', 'Status Rapor', 'Kelulusan / Kenaikan', 'Aksi'].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClasses.length > 0 ? (
                filteredClasses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-slate-900">{c.name || '-'}</p>
                      <p className="text-xs text-slate-500">{c.department_name || '-'}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{c.homeroom_teacher || <span className="text-slate-400 italic">Belum ditentukan</span>}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-black ${c.active_students > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{c.active_students}</span>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-900">
                      {c.rata_rata != null ? c.rata_rata : <span className="text-slate-400 italic text-xs">Belum ada nilai</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <span className="font-black text-slate-900">{c.poin_prestasi}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black ${c.published_count > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{c.published_count}/{c.active_students} Published</span>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-600">{c.status_kelulusan}</td>
                    <td className="px-5 py-4">
                      <button onClick={() => setSelectedClass(c)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-colors">
                        <Eye className="h-4 w-4" /> Detail Rapor Kelas
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <GraduationCap className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada data kelas</p>
                      <p className="text-xs text-slate-500">Sesuaikan filter tahun ajaran/semester/status, atau tambahkan kelas &amp; nilai lewat modul resmi.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && selectedClass ? <RaporDetailModal cls={selectedClass} period={period} onClose={() => setSelectedClass(null)} /> : null}

      <RaporPdfPreview state={pdfPreview} onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }} title="Pratinjau Laporan Nilai & Kelulusan (PDF)" downloadLabel="Unduh Laporan" />
    </div>
  );
};

const EmptyViz = () => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
      <BarChart3 className="w-8 h-8 text-slate-400" />
    </div>
    <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada data</p>
    <p className="text-xs text-slate-500 max-w-xs">Grafik muncul setelah rapor &amp; nilai siswa tercatat pada periode ini.</p>
  </div>
);

const PredikatBar = ({ label, value, max }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = { A: 'bg-sky-500', B: 'bg-violet-500', C: 'bg-amber-500', D: 'bg-rose-500' }[label] || 'bg-slate-400';
  return (
    <div className="flex items-center gap-3">
      <span className="w-6 text-sm font-black text-slate-700">{label}</span>
      <div className="h-3 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className={`animate-grow-x h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
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

const RaporDetailModal = ({ cls, period, onClose }) => {
  const students = cls.students || [];
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-amber-500 to-orange-600 px-7 py-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">Detail Rapor Kelas</p>
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
            <MiniStat label="Rapor Terbit" value={`${cls.published_count ?? 0}/${cls.active_students ?? 0}`} />
            <MiniStat label="Rata Nilai" value={cls.rata_rata != null ? cls.rata_rata : '-'} />
            <MiniStat label="Poin Prestasi" value={cls.poin_prestasi ?? 0} />
          </div>

          {students.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-black">Peringkat</th>
                    <th className="px-4 py-3 text-left font-black">Nama Siswa</th>
                    <th className="px-4 py-3 text-center font-black">Rata Nilai</th>
                    <th className="px-4 py-3 text-center font-black">Poin</th>
                    <th className="px-4 py-3 text-center font-black">Skor Akhir</th>
                    <th className="px-4 py-3 text-center font-black">Status Rapor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s, i) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 text-center font-black text-slate-500">{s.peringkat ?? '-'}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {s.name}
                        <span className="block text-[11px] font-semibold text-slate-400">{s.grade_letter ? `Predikat ${s.grade_letter}` : 'Nilai belum lengkap'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">{s.rata != null ? s.rata : <span className="text-slate-400 italic">-</span>}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{s.poin}</td>
                      <td className="px-4 py-3 text-center font-black text-slate-900">{s.skor != null ? s.skor : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-black ${s.published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{s.published ? 'Published' : 'Draft'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Users className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada siswa aktif di kelas ini</p>
              <p className="text-xs text-slate-500">Tambahkan enrollment murid lewat modul KBM untuk melihat rincian rapor.</p>
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

export default LaporanKelulusan;
