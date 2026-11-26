import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { studentAPI } from '../../../utils/api';
import { getQueryData, setQueryData } from '../../../utils/queryCache';
import useEscapeKey from '../../../utils/useEscapeKey';
import {
  previewRaporPDF, previewAnnualPDF, previewTranscriptPDF, semesterLabel, predikatHuruf,
} from '../../../utils/raporPdf';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import {
  GraduationCap, Clock, FileDown, FileText, ClipboardList, Award, CalendarCheck, CalendarDays,
  ShieldCheck, AlertTriangle, Eye, X, ChevronDown, Trophy, TrendingUp, BookOpen, CheckCircle2,
} from 'lucide-react';

// Nilai kosong (null/'' ) ditampilkan KOSONG / '—', bukan angka dummy.
const blank = (v) => (v === null || v === undefined || v === '' ? '' : v);
const dashOr = (v, alt = '—') => (v === null || v === undefined || v === '' ? alt : v);

const PREDIKAT_TONE = {
  A: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  B: 'bg-sky-50 text-sky-700 border-sky-200',
  C: 'bg-amber-50 text-amber-700 border-amber-200',
  D: 'bg-rose-50 text-rose-700 border-rose-200',
};
const predikatTone = (huruf) => PREDIKAT_TONE[huruf] || 'bg-slate-100 text-slate-500 border-slate-200';

const KKM_TONE = {
  Tuntas: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Belum Tuntas': 'bg-rose-50 text-rose-700 border-rose-200',
  'Belum Ada Nilai': 'bg-slate-100 text-slate-400 border-slate-200',
};

const TABS = [
  { id: 'rapor', label: 'Rapor Semester', icon: GraduationCap },
  { id: 'tahunan', label: 'Rekap Studi 1 Tahun', icon: CalendarDays },
  { id: 'transkrip', label: 'Transkrip Nilai', icon: BookOpen },
];

// Kunci cache in-memory (bertahan saat pindah menu, kehapus saat F5 → fresh).
const raporCacheKey = (params) => (params && (params.tahun_ajaran || params.semester))
  ? `student:rapor:${params.tahun_ajaran || ''}:${params.semester || ''}`
  : 'student:rapor:default';
const annualCacheKey = (ta) => `student:rapor:annual:${ta || ''}`;
const transcriptCacheKey = 'student:rapor:transcript';

const StudentNilaiRaporTab = () => {
  // Snapshot cache: bertahan walau komponen di-unmount (pindah menu) → render
  // instan tanpa "Memuat rapor..." lagi. Data baru tetap ditarik diam-diam tiap masuk.
  const cachedRapor = useMemo(() => getQueryData('student:rapor:default'), []);

  const [data, setData] = useState(() => cachedRapor ?? null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => !cachedRapor);
  const [updatedAt, setUpdatedAt] = useState('');
  const [ta, setTa] = useState(() => cachedRapor?.student?.tahun_ajaran || '');
  const [sem, setSem] = useState(() => cachedRapor?.student?.semester || '');
  const [detail, setDetail] = useState(null);
  useEscapeKey(!!detail, () => setDetail(null));
  const [printing, setPrinting] = useState(null); // 'rapor' | 'tahunan' | 'transkrip' | null
  const [preview, setPreview] = useState(null); // { url, filename }
  const [previewMeta, setPreviewMeta] = useState({ title: 'Pratinjau Rapor PDF', downloadLabel: 'Unduh Rapor PDF' });

  const [activeTab, setActiveTab] = useState('rapor');
  const [annual, setAnnual] = useState(null);
  const [annualTa, setAnnualTa] = useState('');
  const [annualLoading, setAnnualLoading] = useState(false);
  const [annualErr, setAnnualErr] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [transLoading, setTransLoading] = useState(false);
  const [transErr, setTransErr] = useState('');

  // Jam WIB berjalan (sinkron bentuk hero dengan Tugas & Ujian).
  const [clock, setClock] = useState({ time: '', day: '', date: '' });
  useEffect(() => {
    const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const tick = () => {
      const wib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const hh = String(wib.getHours()).padStart(2, '0');
      const mm = String(wib.getMinutes()).padStart(2, '0');
      const ss = String(wib.getSeconds()).padStart(2, '0');
      setClock({ time: `${hh}.${mm}.${ss}`, day: DAYS_ID[wib.getDay()], date: `${wib.getDate()} ${MONTHS_ID[wib.getMonth()]} ${wib.getFullYear()}` });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const closePreview = () => {
    setPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  };
  const openPreview = (p, title, downloadLabel) => {
    setPreview(p);
    setPreviewMeta({ title, downloadLabel });
  };

  // Cache-first: tampilkan data dari cache seketika (tanpa loading), lalu
  // tarik data terbaru di latar belakang (silent) → data baru langsung kedapatan.
  const load = useCallback(async (params, syncPeriod) => {
    const key = raporCacheKey(params);
    const cached = getQueryData(key);
    if (cached !== undefined) {
      setData(cached);
      setLoading(false);
      if (syncPeriod) { setTa(cached.student?.tahun_ajaran || ''); setSem(cached.student?.semester || ''); }
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const r = await studentAPI.getRapor(params);
      const d = r.data.data;
      setQueryData(key, d);
      setData(d);
      setUpdatedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB');
      if (syncPeriod) {
        setTa(d.student?.tahun_ajaran || '');
        setSem(d.student?.semester || '');
      }
    } catch {
      setError('Data rapor gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(undefined, true); }, [load]);

  // Kunci scroll halaman saat modal Detail terbuka.
  useEffect(() => {
    if (!detail) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detail]);


  const loadAnnual = useCallback(async (taVal) => {
    const key = annualCacheKey(taVal);
    const cached = getQueryData(key);
    if (cached !== undefined) { setAnnual(cached); setAnnualTa(taVal); }
    else { setAnnualLoading(true); }
    setAnnualErr('');
    try {
      const r = await studentAPI.getRaporAnnual({ tahun_ajaran: taVal });
      setQueryData(key, r.data.data);
      setAnnual(r.data.data);
      setAnnualTa(taVal);
    } catch {
      setAnnualErr('Rekap tahunan gagal dimuat.');
    } finally {
      setAnnualLoading(false);
    }
  }, []);

  const loadTranscript = useCallback(async () => {
    const cached = getQueryData(transcriptCacheKey);
    if (cached !== undefined) setTranscript(cached);
    else setTransLoading(true);
    setTransErr('');
    try {
      const r = await studentAPI.getRaporTranscript();
      setQueryData(transcriptCacheKey, r.data.data);
      setTranscript(r.data.data);
    } catch {
      setTransErr('Transkrip gagal dimuat.');
    } finally {
      setTransLoading(false);
    }
  }, []);

  // Muat rekap tahunan saat tab aktif (sekali per tahun ajaran; tetap jalan walau ta kosong).
  useEffect(() => {
    if (activeTab !== 'tahunan') return;
    if (annualLoading) return;
    if (annual === null || (ta && annualTa !== ta)) loadAnnual(ta);
  }, [activeTab, ta, annual, annualTa, annualLoading, loadAnnual]);

  // Muat transkrip sekali saat tab aktif.
  useEffect(() => {
    if (activeTab === 'transkrip' && !transcript && !transLoading) loadTranscript();
  }, [activeTab, transcript, transLoading, loadTranscript]);

  const applyFilters = (nextTa, nextSem) => {
    setTa(nextTa);
    setSem(nextSem);
    load({ tahun_ajaran: nextTa, semester: nextSem }, false);
  };

  if (error) {
    return <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-600"><AlertTriangle size={16} /> {error}</div>;
  }
  if (!data) {
    return <div className="p-8 text-center text-sm font-bold text-slate-400">Memuat rapor...</div>;
  }

  const s = data.student;
  const subjects = data.subjects || [];
  const att = data.attendance || {};
  const gradeRows = subjects.map((sub) => ({ sub, g: s.subject_grades?.[sub.id] || {} }));
  const isFinal = s.rapor_status === 'final';
  const isPublished = !!s.rapor_published;

  const options = data.periode_options || [];
  const taList = Array.from(new Set(options.map((o) => o.tahun_ajaran)));
  const semList = Array.from(new Set(options.filter((o) => o.tahun_ajaran === ta).map((o) => o.semester)));
  const semesterChoices = semList.length ? semList : ['ganjil', 'genap'];

  // ── Aksi cetak PDF ──
  const raporPdfParams = () => {
    const kor = s.koreksi || {};
    return {
      student: s,
      subjects: data.subjects,
      classInfo: data.class_info,
      homeroomTeacher: data.homeroom_teacher,
      kepalaSekolah: data.kepala_sekolah,
      draft: !isPublished,
      report: {
        poinPrestasi: Number(s.poin_prestasi || 0),
        skorAkhir: s.skor_akhir ?? null,
        peringkat: s.peringkat ?? null,
        jumlahSiswa: s.peringkat_dari ?? null,
        ketidakhadiran: {
          sakit: kor.sakit ?? att.sakit ?? 0,
          izin: kor.izin ?? att.izin ?? 0,
          alpha: kor.alpha ?? att.alpha ?? 0,
        },
        prestasiList: s.prestasi_rows || [],
        pkl: s.pkl || null,
      },
    };
  };

  const handleRaporPDF = async () => {
    setPrinting('rapor');
    try {
      const p = await previewRaporPDF(raporPdfParams());
      if (p) openPreview(p, 'Pratinjau Rapor Semester', 'Unduh Rapor PDF');
    } catch { /* toast ditangani util */ } finally { setPrinting(null); }
  };

  const handleAnnualPDF = async () => {
    setPrinting('tahunan');
    try {
      let a = annual;
      if (!a || annualTa !== ta) {
        const r = await studentAPI.getRaporAnnual({ tahun_ajaran: ta });
        a = r.data.data;
        setAnnual(a);
        setAnnualTa(ta);
      }
      const p = await previewAnnualPDF({
        student: s, classInfo: data.class_info, homeroomTeacher: data.homeroom_teacher, kepalaSekolah: data.kepala_sekolah, annual: a, draft: !isPublished,
      });
      if (p) openPreview(p, 'Pratinjau Rekap 1 Tahun', 'Unduh Rekap 1 Tahun PDF');
    } catch { /* toast ditangani util */ } finally { setPrinting(null); }
  };

  const handleTranscriptPDF = async () => {
    setPrinting('transkrip');
    try {
      let t = transcript;
      if (!t) {
        const r = await studentAPI.getRaporTranscript();
        t = r.data.data;
        setTranscript(t);
      }
      const p = await previewTranscriptPDF({
        student: s, classInfo: data.class_info, kepalaSekolah: data.kepala_sekolah, transcript: t,
      });
      if (p) openPreview(p, 'Pratinjau Transkrip Nilai', 'Unduh Transkrip PDF');
    } catch { /* toast ditangani util */ } finally { setPrinting(null); }
  };

  return (
    <div className="space-y-6">
      {/* HERO — bentuk disamakan dengan Tugas & Ujian (glow, badge kecil, jam WIB live) */}
      <div className="relative overflow-hidden rounded-[3rem] border border-blue-100 bg-white p-8 text-slate-900 shadow-xl xl:p-12">
        <div className="absolute right-0 top-0 h-full w-[45%] rounded-full bg-gradient-to-l from-[#0ea5e9] via-[#0284c7] to-[#0369a1] opacity-20 blur-[120px]"></div>
        <div className="absolute left-0 top-0 h-full w-[35%] rounded-full bg-gradient-to-r from-[#0ea5e9] via-[#0284c7] to-[#0369a1] opacity-10 blur-[100px]"></div>
        <div className="relative flex flex-col items-start justify-between gap-6 text-left md:flex-row md:items-center">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
              <GraduationCap className="h-3 w-3" /> Portal Students Authority
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Nilai &amp; Hasil Belajar</h1>
            <p className="mt-2 max-w-3xl text-base font-normal text-slate-500">
              Pantau rapor, nilai per mata pelajaran, dan cetak dokumen resmi dalam satu tempat.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 rounded-2xl border border-gray-100 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-widest text-slate-700">{clock?.day},</span>
              <span className="text-xs font-bold text-slate-500">{clock?.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-lg font-black tabular-nums tracking-widest text-slate-700">{clock?.time}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">WIB</span>
            </div>
          </div>
        </div>
      </div>

      {/* ACTION BAR: filter periode + 3 tombol cetak PDF */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Tahun Ajaran</span>
            <div className="relative">
              <select value={ta} onChange={(e) => applyFilters(e.target.value, sem)} className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                {taList.length ? taList.map((t) => <option key={t} value={t}>{t}</option>) : <option value={ta}>{ta || '-'}</option>}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Semester</span>
            <div className="relative">
              <select value={sem} onChange={(e) => applyFilters(ta, e.target.value)} className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-bold capitalize text-slate-700 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                {semesterChoices.map((sm) => <option key={sm} value={sm}>{semesterLabel(sm)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleRaporPDF} disabled={printing !== null} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-50">
            <FileDown size={15} /> {printing === 'rapor' ? 'Menyiapkan...' : 'Unduh Rapor Semester (PDF)'}
          </button>
          <button onClick={handleAnnualPDF} disabled={printing !== null} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50">
            <FileText size={15} /> {printing === 'tahunan' ? 'Menyiapkan...' : 'Cetak Rekap 1 Tahun (PDF)'}
          </button>
          <button onClick={handleTranscriptPDF} disabled={printing !== null} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50">
            <ClipboardList size={15} /> {printing === 'transkrip' ? 'Menyiapkan...' : 'Cetak Transkrip Nilai (PDF)'}
          </button>
        </div>
      </div>

      {/* 4 KPI CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Rata-Rata Nilai"
          value={s.grade_avg != null ? s.grade_avg : '—'}
          sub={s.grade_avg != null ? `Predikat ${predikatHuruf(s.grade_avg)}` : 'Belum ada nilai'}
          theme={{
            card: 'from-indigo-50/90 via-white to-sky-50/50 border-indigo-200/70',
            glow: 'bg-indigo-200/50',
            watermark: 'text-indigo-500 opacity-[0.07]',
            iconBox: 'from-indigo-100 to-indigo-50 text-indigo-700',
          }} />
        <KpiCard icon={Award} label="Poin Prestasi Wali"
          value={Number(s.poin_prestasi || 0)}
          sub="Total poin prestasi semester aktif"
          theme={{
            card: 'from-amber-50/90 via-white to-yellow-50/50 border-amber-200/70',
            glow: 'bg-amber-200/50',
            watermark: 'text-amber-500 opacity-[0.07]',
            iconBox: 'from-amber-100 to-amber-50 text-amber-700',
          }} />
        <KpiCard icon={Trophy} label="Peringkat Kelas"
          value={isPublished ? (s.peringkat ? `#${s.peringkat}` : '—') : '—'}
          sub={isPublished ? (s.peringkat ? `dari ${s.peringkat_dari || '-'} Siswa` : 'Belum terbentuk') : 'Menunggu publikasi wali kelas'}
          theme={{
            card: 'from-sky-50/90 via-white to-blue-50/50 border-sky-200/70',
            glow: 'bg-sky-200/50',
            watermark: 'text-sky-500 opacity-[0.07]',
            iconBox: 'from-sky-100 to-sky-50 text-sky-700',
          }} />
        <KpiCard icon={CalendarCheck} label="Kehadiran Semester"
          value={att.total > 0 ? `${att.percentage}%` : '—'}
          sub={att.total > 0 ? `H ${att.hadir} · S ${att.sakit} · I ${att.izin} · A ${att.alpha}` : 'Belum ada data presensi'}
          theme={{
            card: 'from-emerald-50/90 via-white to-teal-50/50 border-emerald-200/70',
            glow: 'bg-emerald-200/50',
            watermark: 'text-emerald-500 opacity-[0.07]',
            iconBox: 'from-emerald-100 to-emerald-50 text-emerald-700',
          }} />
      </div>

      {/* BANNER NOTIFIKASI INTEGRITAS NILAI */}
      {!isPublished ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-black uppercase tracking-wide">Perhatian — Nilai Sementara</p>
            <p className="mt-1 font-semibold leading-relaxed">
              Nilai yang ditampilkan merupakan rekap berjalan dari guru mata pelajaran dan dapat berubah sewaktu-waktu hingga proses verifikasi, input prestasi, dan keputusan akhir oleh Wali Kelas selesai.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-black uppercase tracking-wide">Nilai Terverifikasi</p>
            <p className="mt-1 font-semibold leading-relaxed">
              Rapor telah resmi dipublikasikan oleh wali kelas{data.student.published_at ? ` pada ${new Date(data.student.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.
            </p>
          </div>
        </div>
      )}

      {/* TAB NAVIGASI */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${activeTab === t.id ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'}`}>
              <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.id === 'rapor' ? 'Rapor' : t.id === 'tahunan' ? '1 Tahun' : 'Transkrip'}</span>
            </button>
          );
        })}
      </div>

      {/* KONTEN TAB */}
      <div key={`${activeTab}-${ta}-${sem}`} className={`space-y-6 ${loading ? 'opacity-60' : ''} animate-fadeIn`}>
        {activeTab === 'rapor' && (
          <TabRapor s={s} gradeRows={gradeRows} att={att} isPublished={isPublished} setDetail={setDetail} />
        )}
        {activeTab === 'tahunan' && (
          <TabTahunan annual={annual} loading={annualLoading} err={annualErr} ta={ta} onRetry={() => loadAnnual(ta)} classInfo={data.class_info} />
        )}
        {activeTab === 'transkrip' && (
          <TabTranskrip transcript={transcript} loading={transLoading} err={transErr} onRetry={loadTranscript} />
        )}
      </div>

      {/* MODAL DETAIL NILAI */}
      {detail && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="animate-fadeIn flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between bg-teal-500 px-6 py-5 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Rincian Nilai</p>
                <h3 className="mt-1 text-lg font-black text-white">{detail.sub.name || detail.sub.code}</h3>
                <p className="mt-0.5 text-xs font-bold text-white/80">Guru pengampu: {blank(detail.g.guru) || 'Belum ditetapkan'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="select-none text-[11px] font-bold text-white/70">Esc</span>
                <button onClick={() => setDetail(null)} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-rose-400 active:text-rose-500"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KomponenNilai label="Tugas" value={detail.g.tugas} />
                <KomponenNilai label="UTS" value={detail.g.uts} />
                <KomponenNilai label="UAS" value={detail.g.uas} />
                <KomponenNilai label="Praktek" value={detail.g.praktek} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nilai Akhir · KKM {blank(detail.g.kkm) || '-'}</p>
                  <p className="text-xl font-black text-slate-900">{dashOr(detail.g.akhir)}</p>
                </div>
                {detail.g.akhir != null && (() => { const h = predikatHuruf(Number(detail.g.akhir)); return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-black uppercase ${predikatTone(h)}`}>{h}</span>; })()}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catatan / Capaian Kompetensi Guru</p>
                {blank(detail.g.catatan_guru) ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">{detail.g.catatan_guru}</p>
                ) : (
                  <p className="mt-1 text-sm italic text-slate-300">Belum ada catatan dari guru pengampu.</p>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <RaporPdfPreview state={preview} onClose={closePreview} title={previewMeta.title} downloadLabel={previewMeta.downloadLabel} />
    </div>
  );
};

// ── TAB 1: RAPOR SEMESTER ──────────────────────────────────────
function TabRapor({ s, gradeRows, att, isPublished, setDetail }) {
  const kor = s.koreksi || {};
  const isGenap = String(s.semester || '').toLowerCase() === 'genap';
  const kkmStatus = (g) => {
    const akhir = g.akhir != null ? Number(g.akhir) : null;
    if (akhir === null) return 'Belum Ada Nilai';
    const kkm = g.kkm != null ? Number(g.kkm) : null;
    if (kkm === null) return 'Tuntas';
    return akhir >= kkm ? 'Tuntas' : 'Belum Tuntas';
  };
  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <GraduationCap size={18} className="text-indigo-600" />
          <h3 className="text-base font-black text-slate-800">Nilai Mata Pelajaran {isPublished ? '' : '(Berjalan)'}</h3>
        </div>
        {gradeRows.length === 0 ? (
          <p className="p-8 text-center text-sm font-bold text-slate-400">Belum ada nilai mata pelajaran pada periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="w-10 px-3 py-3 text-center">No</th>
                  <th className="px-3 py-3 text-left">Mata Pelajaran</th>
                  <th className="px-3 py-3 text-left">Guru Pengampu</th>
                  <th className="px-3 py-3 text-center">Tugas/Formatif</th>
                  <th className="px-3 py-3 text-center">Nilai Ujian</th>
                  <th className="px-3 py-3 text-center">Nilai Akhir</th>
                  <th className="px-3 py-3 text-center">Predikat</th>
                  <th className="px-3 py-3 text-center">Status KKM</th>
                  <th className="px-3 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {gradeRows.map(({ sub, g }, i) => {
                  const akhir = g.akhir != null ? Number(g.akhir) : null;
                  const huruf = akhir === null ? '' : predikatHuruf(akhir);
                  const tugas = g.tugas ?? g.harian;
                  const ujian = (g.uts == null && g.uas == null) ? null : `UTS ${g.uts ?? '-'} · UAS ${g.uas ?? '-'}`;
                  const status = kkmStatus(g);
                  return (
                    <tr key={sub.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3 py-3 text-center font-bold text-slate-400">{i + 1}</td>
                      <td className="px-3 py-3 font-bold text-slate-800">{sub.name || sub.code}</td>
                      <td className="px-3 py-3 text-slate-600">{blank(g.guru) || '—'}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-slate-600">{dashOr(tugas)}</td>
                      <td className="px-3 py-3 text-center text-xs font-bold tabular-nums text-slate-500">{ujian ?? '—'}</td>
                      <td className="px-3 py-3 text-center font-black tabular-nums text-slate-800">{dashOr(akhir)}</td>
                      <td className="px-3 py-3 text-center">{huruf ? <span className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${predikatTone(huruf)}`}>{huruf}</span> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 text-center"><span className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${KKM_TONE[status]}`}>{status}</span></td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => setDetail({ sub, g })} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600">
                          <Eye size={13} /> Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel ringkasan */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* (a) Poin prestasi + skor/peringkat */}
        <Panel title="Prestasi & Skor Akhir" icon={Award}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatBox label="Poin Prestasi" value={`+${Number(s.poin_prestasi || 0)}`} tone="text-amber-600" />
            <StatBox label="Skor Akhir" value={dashOr(s.skor_akhir)} tone="text-slate-800" />
            <StatBox label="Peringkat" value={isPublished ? (s.peringkat ? `#${s.peringkat}` : '—') : '—'} tone={isPublished ? 'text-violet-600' : 'text-slate-400'} />
          </div>
          <p className="mt-2 text-[11px] font-bold text-slate-400">
            {isPublished ? `dari ${s.peringkat_dari || '-'} siswa` : 'Peringkat muncul setelah rapor dipublikasikan wali kelas.'}
          </p>
          {(s.prestasi_rows || []).length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {s.prestasi_rows.map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-bold text-slate-700">{p.nama_kegiatan} <span className="font-medium text-slate-400">({p.tingkat})</span></span>
                  <span className="shrink-0 font-black text-amber-600">+{p.poin}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs italic text-slate-300">Belum ada poin prestasi tercatat semester ini.</p>
          )}
        </Panel>

        {/* (b) Ketidakhadiran */}
        <Panel title="Rekap Ketidakhadiran" icon={CalendarCheck}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-1 text-left">Keterangan</th>
                <th className="py-1 text-center">Presensi</th>
                <th className="py-1 text-center">Koreksi Wali</th>
                <th className="py-1 text-center">Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { key: 'sakit', label: 'Sakit' },
                { key: 'izin', label: 'Izin' },
                { key: 'alpha', label: 'Alpa' },
              ].map((r) => (
                <tr key={r.key}>
                  <td className="py-2 font-bold text-slate-700">{r.label}</td>
                  <td className="py-2 text-center tabular-nums text-slate-500">{att[r.key] ?? 0}</td>
                  <td className="py-2 text-center tabular-nums text-slate-500">{kor[r.key] != null ? kor[r.key] : '—'}</td>
                  <td className="py-2 text-center font-black tabular-nums text-slate-800">{(kor[r.key] != null ? kor[r.key] : (att[r.key] ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] font-bold text-slate-400">Persentase kehadiran: {att.total > 0 ? `${att.percentage}%` : '—'} ({att.hadir ?? 0}/{att.total ?? 0} hadir)</p>
        </Panel>

        {/* (c) Catatan wali + keputusan (genap) */}
        <Panel title="Catatan Wali Kelas" icon={ShieldCheck}>
          {blank(s.catatan_wali_kelas) ? (
            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">{s.catatan_wali_kelas}</p>
          ) : (
            <p className="text-sm italic text-slate-300">Belum ada catatan dari wali kelas.</p>
          )}
          {isGenap && (
            <div className={`mt-4 rounded-xl border px-4 py-3 ${s.keputusan ? 'border-indigo-200 bg-indigo-50' : 'border-dashed border-slate-200 bg-slate-50'}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Keputusan Akhir Semester Genap</p>
              <p className="mt-1 text-sm font-black text-slate-800">{keputusanLabel(s.keputusan)}</p>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

// ── TAB 2: REKAP STUDI 1 TAHUN ─────────────────────────────────
function TabTahunan({ annual, loading, err, ta, onRetry, classInfo }) {
  if (err) return <ErrorBox msg={err} onRetry={onRetry} />;
  if (loading && !annual) return <LoadingBox />;
  if (!annual) return <LoadingBox />;
  const rows = annual.rows || [];
  const a = annual.attendance || {};
  const naik = annual.kenaikan || {};
  const naikLabel = naik.status
    ? (naik.status === 'naik' ? `Naik ke Tingkat Berikutnya` : naik.status === 'tidak_naik' ? 'Tidak Naik' : naik.status === 'lulus' ? 'Lulus' : naik.status === 'tidak_lulus' ? 'Tidak Lulus' : String(naik.status))
    : 'Belum ditetapkan';
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard icon={TrendingUp} tint="bg-indigo-50 text-indigo-700" label="Rata-Rata Tahunan" value={dashOr(annual.yearly_average)} sub={ta || '-'} />
        <KpiCard icon={CalendarCheck} tint="bg-emerald-50 text-emerald-700" label="Kehadiran 1 Tahun" value={a.total > 0 ? `${a.percentage}%` : '—'} sub={`H ${a.hadir ?? 0} · S ${a.sakit ?? 0} · I ${a.izin ?? 0} · A ${a.alpha ?? 0}`} />
        <KpiCard icon={CheckCircle2} tint="bg-sky-50 text-sky-700" label="Mata Pelajaran" value={rows.length} sub="terdata tahun ini" />
        <KpiCard icon={ShieldCheck} tint={naik.published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} label="Kenaikan Tingkat" value={naikLabel} sub={naik.published ? 'Terverifikasi' : 'Menunggu publikasi'} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <CalendarDays size={18} className="text-indigo-600" />
          <h3 className="text-base font-black text-slate-800">Komparasi Nilai per Mata Pelajaran · {ta || '-'}</h3>
        </div>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm font-bold text-slate-400">Belum ada nilai pada tahun ajaran ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3 text-left">Mata Pelajaran</th>
                  <th className="px-3 py-3 text-center">Nilai Semester Ganjil</th>
                  <th className="px-3 py-3 text-center">Nilai Semester Genap</th>
                  <th className="px-3 py-3 text-center">Rata-Rata 1 Tahun</th>
                  <th className="px-3 py-3 text-center">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.subject_id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-3 py-3 font-bold text-slate-800">{r.subject_name}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-slate-600">{dashOr(r.ganjil)}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-slate-600">{dashOr(r.genap)}</td>
                    <td className="px-3 py-3 text-center font-black tabular-nums text-slate-800">{dashOr(r.rata)}</td>
                    <td className="px-3 py-3 text-center"><span className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${r.keterangan === 'Tuntas' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : r.keterangan === 'Belum Tuntas' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{r.keterangan}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ── TAB 3: TRANSKRIP NILAI ─────────────────────────────────────
function TabTranskrip({ transcript, loading, err, onRetry }) {
  if (err) return <ErrorBox msg={err} onRetry={onRetry} />;
  if ((loading && !transcript) || !transcript) return <LoadingBox />;
  const groups = transcript.groups || [];
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <KpiCard icon={BookOpen} tint="bg-indigo-50 text-indigo-700" label="Total Mata Pelajaran" value={transcript.total_mapel ?? 0} sub="sepanjang masa studi" />
        <KpiCard icon={TrendingUp} tint="bg-emerald-50 text-emerald-700" label="Rata-Rata Kumulatif" value={dashOr(transcript.cumulative_average)} sub={`${transcript.total_entries ?? 0} nilai terinput`} />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-sm font-black uppercase tracking-wider text-slate-400">Belum ada riwayat nilai</p>
          <p className="mt-1 text-xs font-medium text-slate-400">Transkrip akan terisi seiring nilai per semester diinput guru.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((grp, gi) => (
            <div key={gi} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
                <CalendarDays size={16} className="text-indigo-600" />
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">
                  {grp.tahun_ajaran} · Semester {String(grp.semester || '').toLowerCase() === 'genap' ? 'Genap' : 'Ganjil'}{grp.level ? ` · Tingkat ${grp.level}` : ''}
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="w-10 px-3 py-2 text-center">No</th>
                      <th className="px-3 py-2 text-left">Mata Pelajaran</th>
                      <th className="px-3 py-2 text-center">Nilai Akhir</th>
                      <th className="px-3 py-2 text-center">Predikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grp.rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                        <td className="px-3 py-2 text-center font-bold text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 font-bold text-slate-800">{r.subject_name}</td>
                        <td className="px-3 py-2 text-center font-black tabular-nums text-slate-800">{dashOr(r.akhir)}</td>
                        <td className="px-3 py-2 text-center"><span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${predikatTone(predikatHuruf(r.akhir))}`}>{predikatHuruf(r.akhir)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Helper komponen kecil ──────────────────────────────────────
const KEPUTUSAN_LABEL = { naik: 'Naik Kelas', tidak_naik: 'Tidak Naik Kelas', lulus: 'Lulus', tidak_lulus: 'Tidak Lulus' };
const keputusanLabel = (k) => (k ? (KEPUTUSAN_LABEL[k] || String(k)) : 'Belum ditetapkan');

function KpiCard({ icon: Icon, tint, label, value, sub, theme }) {
  const shown = value === '' || value == null ? '—' : value;

  // Varian berdimensi (gradasi pastel + watermark) — dipakai 4 KPI utama, seragam dgn halaman Keuangan.
  if (theme) {
    return (
      <div className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${theme.card}`}>
        <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl ${theme.glow}`} />
        <Icon className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${theme.watermark}`} strokeWidth={1.5} />
        <div className="relative flex items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ring-1 ring-white/60 ${theme.iconBox}`}>
            <Icon size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
            <p className="truncate text-2xl font-black leading-tight text-slate-900">{shown}</p>
          </div>
        </div>
        {sub && <p className="relative mt-2 text-[11px] font-bold text-slate-500">{sub}</p>}
      </div>
    );
  }

  // Varian putih polos (default) — dipakai tab Rekap 1 Tahun & Transkrip, gak diubah.
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tint}`}><Icon size={22} /></div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="truncate text-2xl font-black leading-tight text-slate-900">{shown}</p>
        <p className="text-[11px] font-bold text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-indigo-600"><Icon size={16} /></span>
        <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function StatBox({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
      <p className={`truncate text-lg font-black tabular-nums ${tone}`}>{value}</p>
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}

function KomponenNilai({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-800">{blank(value) === '' ? '—' : value}</p>
    </div>
  );
}

function LoadingBox() {
  return <div className="p-8 text-center text-sm font-bold text-slate-400">Memuat data...</div>;
}
function ErrorBox({ msg, onRetry }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-600">
      <AlertTriangle size={16} /> {msg}
      {onRetry && <button onClick={onRetry} className="ml-auto underline">Coba lagi</button>}
    </div>
  );
}

export default StudentNilaiRaporTab;
