import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, TrendingUp, CalendarCheck, FileCheck2, GraduationCap, Search,
  Send, AlertCircle, RefreshCw, Trophy, Wallet, ChevronDown,
  Eye, Plus, FileSpreadsheet, BarChart3, ShieldAlert, BookOpen,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { teacherAPI } from '../../../../utils/api';
import WaliNoteModal from './WaliNoteModal';
import WaliStudentModal, { StudentAvatar } from './WaliStudentModal';

const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

const CENTERS = {
  ketuntasan: [
    { name: 'Tuntas', value: 'tuntas', color: '#10B981' },
    { name: 'Belum Tuntas', value: 'belum', color: '#F43F5E' },
  ],
  tagihan: [
    { name: 'Lunas', value: 'lunas', color: '#10B981' },
    { name: 'Ada Tunggakan', value: 'tunggakan', color: '#F59E0B' },
  ],
};

/**
 * Portal Khusus Wali Kelas — Single-Page Class Command Center.
 * Hero banner tetap original; seluruh isi di bawahnya dihitung REAL-TIME dari
 * database (KPI, grafik, ledger). Tanpa data dummy: log kosong tampil "-" / 0 jujur.
 * Refresh: on mount + focus/visibilitychange + refetch setelah CRUD (tanpa polling).
 */
const HomeroomTab = ({ clock, user, initialData = null, onDataUpdated }) => {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData && !data);
  const [activeTab, setActiveTab] = useState('nilai'); // 'nilai' | 'kehadiran' | 'bk'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'tunggakan' | 'belum_lengkap'
  const [donutTab, setDonutTab] = useState('ketuntasan');

  const [detailStudentId, setDetailStudentId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [expandedBill, setExpandedBill] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const fetchHomeroomData = useCallback(async (silent = false) => {
    if (!silent && !data && !initialData) setLoading(true);
    try {
      const response = await teacherAPI.getHomeroom();
      setData(response.data);
      if (typeof onDataUpdated === 'function') onDataUpdated(response.data);
    } catch (error) {
      if (error?.response?.status === 404) {
        setData(null);
      } else {
        console.error('Error fetching homeroom:', error);
        toast.error('Gagal memuat data wali kelas');
      }
    } finally {
      setLoading(false);
    }
  }, [data, initialData, onDataUpdated]);

  // Fetch on mount + saat jendela fokus kembali (tanpa auto-polling).
  useEffect(() => {
    if (!data && !initialData) fetchHomeroomData();
  }, [fetchHomeroomData, data, initialData]);

  useEffect(() => {
    const onFocus = () => fetchHomeroomData(true);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchHomeroomData(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchHomeroomData]);

  const students = useMemo(() => data?.students || [], [data?.students]);

  const filteredStudents = useMemo(() => {
    let list = students;
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter((s) => s.name?.toLowerCase().includes(q) || String(s.nisn).toLowerCase().includes(q));
    if (statusFilter === 'tunggakan') list = list.filter((s) => s.tagihan?.total_due > 0);
    if (statusFilter === 'belum_lengkap') list = list.filter((s) => !s.rapor?.lengkap);
    return list;
  }, [students, searchQuery, statusFilter]);

  const handlePublish = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      const res = await teacherAPI.publishHomeroomRapor({});
      const d = res.data;
      if (d.published > 0) {
        toast.success(d.message || `${d.published} rapor dibagikan ke portal siswa.`);
      } else {
        toast(d.message || 'Belum ada rapor yang siap dibagikan.');
      }
      if (d.skipped?.length) {
        toast(`${d.skipped.length} siswa dilewati (catatan/nilai belum lengkap)`, { icon: 'ⓘ' });
      }
      await fetchHomeroomData(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Gagal membagikan rapor.');
    } finally {
      setPublishing(false);
    }
  };

  const exportLedger = () => {
    if (!students.length) {
      toast.error('Tidak ada data siswa untuk diekspor');
      return;
    }
    const subs = data.subjects || [];
    const rows = students.map((s) => {
      const base = {
        'Peringkat': s.peringkat ?? '-',
        'NISN / NIS': s.nisn,
        'Nama Siswa': s.name,
        'L/P': s.gender,
      };
      subs.forEach((sub) => {
        base[sub.name] = s.subject_grades?.[sub.id]?.akhir ?? '-';
      });
      if (data.pkl_enabled) base['PKL / Prakerin'] = s.pkl?.nilai_akhir ?? '-';
      base['Poin Prestasi'] = s.poin ?? 0;
      base['Skor Akhir'] = s.skor_akhir ?? '-';
      base['Hadir'] = s.presensi?.hadir ?? 0;
      base['Sakit'] = s.presensi?.sakit ?? 0;
      base['Izin'] = s.presensi?.izin ?? 0;
      base['Alpha'] = s.presensi?.alpha ?? 0;
      base['Tagihan Kasir'] = s.tagihan?.total_due > 0 ? `Tunggakan ${rupiah(s.tagihan.total_due)}` : s.tagihan?.has_any ? 'Lunas' : 'Belum ada tagihan';
      base['Status Rapor'] = s.rapor?.status === 'final' ? 'Dibagikan' : s.rapor?.lengkap ? 'Lengkap (Draft)' : 'Draft';
      return base;
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Legger ${data.class_info?.name || 'Kelas'}`);
    XLSX.writeFile(workbook, `Legger_Rapor_${data.class_info?.name || 'Wali_Kelas'}.xlsx`);
    toast.success('Ledger kelas berhasil diunduh (.xlsx)');
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-16">
        <div className="h-44 rounded-3xl bg-slate-100" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-72 rounded-3xl bg-slate-100 lg:col-span-2" />
          <div className="h-72 rounded-3xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!data?.class_info) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800">Bukan Wali Kelas Aktif</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Akun Anda saat ini belum ditetapkan sebagai Wali Kelas di kelas manapun oleh Admin Akademik.
        </p>
        <button
          type="button"
          onClick={() => { setLoading(true); fetchHomeroomData(); }}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 active:scale-95 transition shadow-sm"
        >
          <RefreshCw size={13} /> Coba Muat Ulang Data
        </button>
      </div>
    );
  }

  const teacherName = data.homeroom_teacher?.name || user?.name || 'Bapak/Ibu Guru';
  const className = data.class_info.name;
  const kpi = data.kpi || {};
  const publishReady = !!data.publish_summary?.all_ready;
  const canPublish = (data.publish_summary?.can_publish || 0) > 0;
  const catatanFilled = students.filter((s) => s.rapor?.lengkap).length;

  return (
    <div className="space-y-8 pb-20">
      {/* ── 1. Header / Hero Section (Original Classic Style) ──────────────────────── */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#172554] p-8 lg:p-10 text-white shadow-2xl border border-blue-400/20">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl border border-white/10 text-blue-100">
            <GraduationCap size={12} className="text-blue-300" /> Portal Khusus Wali Kelas
          </div>
          <h1 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Halo, {teacherName} — <span className="text-blue-200">Wali Kelas {className}</span>
          </h1>
          <p className="mt-4 text-sm italic text-blue-100/80 max-w-2xl">
            "Mengawal pertumbuhan karakter dan prestasi siswa perwalian menuju masa depan yang gemilang."
          </p>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <GraduationCap size={200} className="text-white" />
        </div>
      </div>

      {/* ── 2. Baris KPI Real-Time ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 — Total Siswa Binaan */}
        <div className="group rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-emerald-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Siswa Binaan</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
              <Users size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800 tabular-nums">{kpi.total_students ?? 0}</span>
            <span className="text-xs font-bold text-slate-400 uppercase">Siswa Aktif</span>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">L: {kpi.l_count ?? 0} · P: {kpi.p_count ?? 0} · Kuota {data.class_info.capacity || '-'}</p>
        </div>

        {/* KPI 2 — Tingkat Kehadiran Kelas */}
        <div className="group rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-blue-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Tingkat Kehadiran</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
              <CalendarCheck size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600 tabular-nums">{kpi.attendance_pct != null ? `${kpi.attendance_pct}%` : '-'}</span>
            <span className="text-xs font-bold text-slate-400 uppercase">Hadir</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700"
              style={{ width: `${Math.min(100, kpi.attendance_pct || 0)}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {kpi.attendance_records > 0
              ? `${kpi.attendance_records} rekaman presensi · Alpa ≥ 3: ${kpi.alpa_ge3_count ?? 0} siswa`
              : 'Belum ada log presensi'}
          </p>
        </div>

        {/* KPI 3 — Rata-Rata Nilai & Prestasi */}
        <div className="group rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-amber-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Rata-Rata Nilai</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800 tabular-nums">{kpi.grade_avg ?? '-'}</span>
            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase ${kpi.grade_avg != null && kpi.grade_avg >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
              {kpi.grade_avg == null ? 'Tanpa Data' : kpi.grade_avg >= 75 ? 'Tuntas' : 'Perlu Dorongan'}
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">
            Gabungan nilai akhir mapel semester aktif{Number(kpi.poin_total) > 0 ? ` · +${kpi.poin_total} poin prestasi` : ''}
          </p>
        </div>

        {/* KPI 4 — Kesiapan Rapor & Administrasi */}
        <div className="group rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-indigo-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Kesiapan Rapor</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
              <FileCheck2 size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800 tabular-nums">{catatanFilled}/{kpi.total_students ?? 0}</span>
            <span className="text-xs font-bold text-slate-400 uppercase">Catatan Terisi</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-700"
              style={{ width: `${(kpi.total_students || 0) > 0 ? Math.min(100, (catatanFilled / kpi.total_students) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">
            Tunggakan Kasir: <span className={kpi.tunggakan_siswa_count > 0 ? 'font-black text-amber-600' : 'font-black text-emerald-600'}>{kpi.tunggakan_siswa_count ?? 0} siswa</span>
          </p>
        </div>
      </div>

      {/* ── 3. Baris Grafik Analitik (Data Riil) ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kiri — Tren Kehadiran & Disiplin */}
        <div className="lg:col-span-2 rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black text-slate-800">Tren Kehadiran &amp; Disiplin Kelas</h3>
              <p className="text-xs text-slate-400 font-medium">Persentase kehadiran harian dari log presensi 30 hari terakhir</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              <BarChart3 size={13} /> {data.attendance_trend?.length || 0} Hari Terekam
            </span>
          </div>
          {(data.attendance_trend || []).length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
              <CalendarCheck size={28} className="text-slate-300" />
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Belum ada log presensi</p>
              <p className="text-[11px] font-medium text-slate-400">Grafik muncul otomatis setelah guru mengabsen kelas ini.</p>
            </div>
          ) : (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.attendance_trend} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="waliAttGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} unit="%" />
                  <RechartsTooltip
                    formatter={(val, name) => [name === 'rate' ? `${val}%` : val, name === 'rate' ? 'Tingkat Kehadiran' : name]}
                    labelFormatter={(lbl) => `Tanggal: ${lbl}`}
                    contentStyle={{ backgroundColor: '#1E293B', borderRadius: 12, color: '#fff', border: 'none', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={3} fill="url(#waliAttGrad)" dot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#059669' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Kanan — Donut dengan 2 Tab Switcher */}
        <div className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-slate-800">Ketuntasan &amp; Administrasi</h3>
            <div className="mt-3 inline-flex w-full gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setDonutTab('ketuntasan')}
                className={`flex-1 rounded-xl px-2 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${donutTab === 'ketuntasan' ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Ketuntasan KKM
              </button>
              <button
                type="button"
                onClick={() => setDonutTab('tagihan')}
                className={`flex-1 rounded-xl px-2 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${donutTab === 'tagihan' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Status Tagihan Kasir
              </button>
            </div>
          </div>

          {(() => {
            const source = donutTab === 'ketuntasan'
              ? { tuntas: data.ketuntasan?.tuntas || 0, belum: data.ketuntasan?.belum || 0 }
              : { lunas: data.tagihan?.lunas || 0, tunggakan: data.tagihan?.tunggakan || 0 };
            const pairs = CENTERS[donutTab].map((c) => ({ ...c, count: Number(source[c.value] || 0) }));
            const total = pairs.reduce((a, p) => a + p.count, 0);
            const pct = donutTab === 'ketuntasan' ? data.ketuntasan?.pct : data.tagihan?.pct_lunas;
            return (
              <>
                {total === 0 ? (
                  <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                    {donutTab === 'ketuntasan'
                      ? <Trophy size={28} className="text-slate-300" />
                      : <Wallet size={28} className="text-slate-300" />}
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                      {donutTab === 'ketuntasan' ? 'Belum ada nilai terinput' : 'Belum ada tagihan kasir'}
                    </p>
                    <p className="text-center text-[11px] font-medium text-slate-400">
                      {donutTab === 'ketuntasan'
                        ? 'Proporsi tuntas muncul setelah guru mapel menginput nilai.'
                        : 'Diagram muncul setelah data tagihan dari modul Kasir tersedia.'}
                    </p>
                  </div>
                ) : (
                  <div className="h-56 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pairs.map((p) => ({ name: p.name, value: p.count }))}
                          innerRadius={58}
                          outerRadius={78}
                          paddingAngle={4}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                        >
                          {pairs.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(val, name) => [`${val} Siswa`, name]}
                          contentStyle={{ backgroundColor: '#1E293B', borderRadius: 12, color: '#fff', border: 'none', fontSize: 12 }}
                        />
                        <Legend verticalAlign="bottom" height={30} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
                      <span className="text-2xl font-black text-slate-800 tabular-nums">{pct != null ? `${pct}%` : '-'}</span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                        {donutTab === 'ketuntasan' ? 'Mencapai KKM' : 'Sudah Lunas'}
                      </span>
                    </div>
                  </div>
                )}
                {donutTab === 'ketuntasan' && (data.ketuntasan?.tanpa_nilai || 0) > 0 && (
                  <p className="mt-1 text-center text-[10px] font-bold text-slate-400">
                    {data.ketuntasan.tanpa_nilai} siswa belum memiliki nilai akhir
                  </p>
                )}
                {donutTab === 'tagihan' && (data.tagihan?.belum_ada_tagihan || 0) > 0 && (
                  <p className="mt-1 text-center text-[10px] font-bold text-slate-400">
                    {data.tagihan.belum_ada_tagihan} siswa belum memiliki tagihan
                  </p>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* ── 4. Pusat Kendali 3 Tab ───────────────────────────────────── */}
      <div className="space-y-5">
        {/* Tab Switcher */}
        <div className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {[
            { id: 'nilai', label: 'Rekap Nilai, Prestasi & Peringkat', icon: TrendingUp },
            { id: 'kehadiran', label: 'Kehadiran & Tagihan Kasir', icon: CalendarCheck },
            { id: 'bk', label: 'BK & Lomba / Prestasi', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                  active
                    ? 'bg-gradient-to-r from-green-500 to-emerald-700 text-white shadow-md shadow-emerald-600/20'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau NISN siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-50 transition"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-50 transition"
          >
            <option value="all">Semua Siswa</option>
            <option value="tunggakan">Tunggakan Kasir</option>
            <option value="belum_lengkap">Catatan Belum Lengkap</option>
          </select>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setNoteModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs font-black text-amber-700 hover:bg-amber-100 active:scale-95 transition"
            >
              <Plus size={14} /> Tambah Catatan BK / Prestasi
            </button>
            <button
              type="button"
              onClick={exportLedger}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" /> Ekspor Ledger (.xlsx)
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!canPublish || publishing}
              title={!canPublish
                ? 'Belum ada siswa dengan catatan wali lengkap + nilai siap/terkunci'
                : publishReady ? 'Seluruh rapor siap — bagikan ke portal siswa' : ''}
              className={`flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-black transition-all ${
                !canPublish || publishing
                  ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                  : `bg-emerald-700 text-white hover:bg-emerald-800 active:scale-95 shadow-md shadow-emerald-600/20 ${publishReady ? 'btn-shimmer' : ''}`
              }`}
            >
              {publishing ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {publishing ? 'Membagikan...' : 'Simpan & Bagikan ke Siswa'}
            </button>
          </div>
        </div>

        {/* Konten Tab */}
        <AnimatePresence mode="wait">
          {/* ══ TAB 1 — REKAP NILAI, POIN PRESTASI & PERINGKAT ══ */}
          {activeTab === 'nilai' && (
            <motion.div key="nilai" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="sticky left-0 z-30 w-[64px] min-w-[64px] px-3 py-3.5 text-center bg-slate-50/95 backdrop-blur">Peringkat</th>
                        <th className="sticky left-[64px] z-30 min-w-[180px] px-3 py-3.5 text-left bg-slate-50/95 backdrop-blur border-r border-slate-200 shadow-[6px_0_8px_-6px_rgba(15,23,42,0.15)]">Profil Siswa</th>
                        {(data.subjects || []).map((sub) => (
                          <th key={sub.id} className="px-2 py-3.5 text-center min-w-[64px]" title={`${sub.name} · KKM ${sub.kkm}`}>
                            {sub.name}
                          </th>
                        ))}
                        {data.pkl_enabled && (
                          <th className="px-2 py-3.5 text-center min-w-[70px] text-teal-600">PKL / Prakerin</th>
                        )}
                        <th className="px-2.5 py-3.5 text-center min-w-[70px] text-amber-600">Poin Prestasi</th>
                        <th className="px-2.5 py-3.5 text-center min-w-[64px] bg-emerald-50 text-emerald-700">Skor Akhir</th>
                        <th className="px-2.5 py-3.5 text-center min-w-[80px]">Tagihan Kasir</th>
                        <th className="px-2.5 py-3.5 text-center min-w-[70px]">Status Rapor</th>
                        <th className="px-3 py-3.5 text-center min-w-[120px]">Kelola &amp; Pratinjau</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={9 + (data.subjects?.length || 0) + (data.pkl_enabled ? 1 : 0)} className="py-12 text-center text-xs font-bold text-slate-400 italic">
                            {students.length === 0 ? 'Belum ada siswa aktif di kelas perwalian Anda.' : 'Tidak ada siswa yang cocok dengan pencarian / filter.'}
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((st) => (
                          <tr key={st.id} className="group cursor-pointer hover:bg-slate-50/70 transition-colors" onClick={() => { setDetailStudentId(st.id); setDetailOpen(true); }}>
                            <td className="sticky left-0 z-20 w-[64px] px-3 py-3 text-center bg-white group-hover:bg-slate-50">
                              {st.peringkat
                                ? <span className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-1.5 text-xs font-black tabular-nums ${st.peringkat === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>#{st.peringkat}</span>
                                : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="sticky left-[64px] z-20 px-3 py-3 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[6px_0_8px_-6px_rgba(15,23,42,0.15)]">
                              <div className="flex items-center gap-2.5">
                                <StudentAvatar avatarPath={st.avatar_path} name={st.name} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-slate-800">{st.name}</p>
                                  <p className="text-[10px] font-mono text-slate-400">{st.nisn} · {st.gender}</p>
                                </div>
                              </div>
                            </td>
                            {(data.subjects || []).map((sub) => {
                              const sc = st.subject_grades?.[sub.id]?.akhir;
                              const kkm = st.subject_grades?.[sub.id]?.kkm ?? sub.kkm;
                              return (
                                <td key={sub.id} className="px-2 py-3 text-center font-bold tabular-nums">
                                  {sc != null
                                    ? <span className={sc >= kkm ? 'text-emerald-700' : 'text-rose-600'}>{sc}</span>
                                    : <span className="text-slate-300">-</span>}
                                </td>
                              );
                            })}
                            {data.pkl_enabled && (
                              <td className="px-2 py-3 text-center font-bold tabular-nums text-teal-700">
                                {st.pkl?.nilai_akhir != null ? st.pkl.nilai_akhir : <span className="text-slate-300">-</span>}
                              </td>
                            )}
                            <td className="px-2.5 py-3 text-center">
                              <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-black tabular-nums ${st.poin > 0 ? 'bg-amber-50 text-amber-700' : 'text-slate-300'}`}>
                                {st.poin > 0 ? `+${st.poin}` : '0'}
                              </span>
                            </td>
                            <td className="px-2.5 py-3 text-center bg-emerald-50/50 font-black text-emerald-700 text-sm tabular-nums">
                              {st.skor_akhir ?? '-'}
                            </td>
                            <td className="px-2.5 py-3 text-center">
                              {!st.tagihan?.has_any
                                ? <span className="text-slate-300">-</span>
                                : st.tagihan.total_due > 0
                                  ? <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-700" title={`Sisa tagihan ${rupiah(st.tagihan.total_due)}`}>Tunggakan</span>
                                  : <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700">Lunas</span>}
                            </td>
                            <td className="px-2.5 py-3 text-center">
                              {st.rapor?.status === 'final'
                                ? <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700">Dibagikan</span>
                                : st.rapor?.lengkap
                                  ? <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-sky-700">Lengkap</span>
                                  : <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-700">Draft</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDetailStudentId(st.id); setDetailOpen(true); }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 active:scale-95 transition"
                              >
                                <Eye size={13} /> Kelola Rapor
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ TAB 2 — KEHADIRAN & RINCIAN TAGIHAN ══ */}
          {activeTab === 'kehadiran' && (
            <motion.div key="kehadiran" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3.5 text-left">Profil Siswa</th>
                        <th className="px-3 py-3.5 text-center text-emerald-600">Hadir</th>
                        <th className="px-3 py-3.5 text-center text-amber-600">Sakit</th>
                        <th className="px-3 py-3.5 text-center text-blue-600">Izin</th>
                        <th className="px-3 py-3.5 text-center text-rose-600">Alpha</th>
                        <th className="px-3 py-3.5 text-center">Persentase</th>
                        <th className="px-3 py-3.5 text-center min-w-[190px]">Koreksi Akhir S / I / A (Rapor)</th>
                        <th className="px-3 py-3.5 text-center min-w-[110px]">Tagihan Kasir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-xs font-bold text-slate-400 italic">
                            {students.length === 0 ? 'Belum ada siswa aktif di kelas perwalian Anda.' : 'Tidak ada siswa yang cocok dengan pencarian / filter.'}
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((st) => {
                          const expanded = expandedBill === st.id;
                          return (
                            <React.Fragment key={st.id}>
                              <tr className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <StudentAvatar avatarPath={st.avatar_path} name={st.name} size="sm" />
                                    <div className="min-w-0">
                                      <p className="truncate font-bold text-slate-800">{st.name}</p>
                                      <p className="text-[10px] font-mono text-slate-400">{st.nisn}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center font-black text-emerald-700 tabular-nums">{st.presensi?.hadir ?? 0}</td>
                                <td className="px-3 py-3 text-center font-black text-amber-700 tabular-nums">{st.presensi?.sakit ?? 0}</td>
                                <td className="px-3 py-3 text-center font-black text-blue-700 tabular-nums">{st.presensi?.izin ?? 0}</td>
                                <td className="px-3 py-3 text-center font-black text-rose-700 tabular-nums">{st.presensi?.alpha ?? 0}</td>
                                <td className="px-3 py-3 text-center font-black text-slate-800 tabular-nums">
                                  {st.presensi?.pct != null ? `${st.presensi.pct}%` : '-'}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {['sakit', 'izin', 'alpha'].map((k) => (
                                      <input
                                        key={k}
                                        type="number"
                                        min="0"
                                        value={st.koreksi?.[k] ?? ''}
                                        placeholder={String(st.presensi?.[k] ?? 0)}
                                        onChange={() => { setDetailStudentId(st.id); setDetailOpen(true); }}
                                        onClick={() => { setDetailStudentId(st.id); setDetailOpen(true); }}
                                        readOnly
                                        title="Klik untuk membuka finalisasi rapor"
                                        className="w-14 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-center text-[11px] font-black text-slate-700 focus:outline-none hover:border-emerald-300 transition"
                                      />
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {st.tagihan?.total_due > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedBill(expanded ? null : st.id)}
                                      className="inline-flex items-center gap-1 text-[11px] font-black text-amber-600 transition-colors hover:text-amber-700"
                                    >
                                      <Wallet size={12} /> {rupiah(st.tagihan.total_due)}
                                      <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  ) : st.tagihan?.has_any ? (
                                    <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700">Lunas</span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-300">Belum ada tagihan</span>
                                  )}
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="bg-slate-50/60">
                                  <td colSpan={8} className="px-6 py-3">
                                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                      Rincian Tagihan — {st.name} (read-only, informasikan langsung ke siswa)
                                    </p>
                                    <div className="space-y-1.5">
                                      {st.tagihan.items.map((it) => (
                                        <div key={it.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3.5 py-2 text-[11px]">
                                          <div className="min-w-0">
                                            <p className="truncate font-bold text-slate-700">{it.title}</p>
                                            <p className="text-[10px] font-semibold text-slate-400">{it.category} · Jatuh tempo {it.due_date}</p>
                                          </div>
                                          <div className="flex shrink-0 items-center gap-3">
                                            <span className="font-black tabular-nums text-slate-800">{rupiah(it.amount)}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                              it.status === 'lunas' ? 'bg-emerald-100 text-emerald-700'
                                                : it.status === 'proses_verifikasi' ? 'bg-sky-100 text-sky-700'
                                                : 'bg-rose-100 text-rose-700'
                                            }`}>
                                              {it.status === 'belum_bayar' ? 'Belum Bayar' : it.status === 'proses_verifikasi' ? 'Diverifikasi' : it.status === 'lunas' ? 'Lunas' : it.status}
                                            </span>
                                            {it.remaining_amount > 0 && (
                                              <span className="text-[10px] font-black text-amber-700 tabular-nums">Sisa {rupiah(it.remaining_amount)}</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="px-1 text-[11px] font-semibold text-slate-400">
                Sumber tagihan mengikuti modul Kasir secara read-only — status &amp; nominal tidak dapat diubah dari portal wali kelas.
              </p>
            </motion.div>
          )}

          {/* ══ TAB 3 — BK & LOMBA / PRESTASI ══ */}
          {activeTab === 'bk' && (
            <motion.div key="bk" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3.5 text-left min-w-[180px]">Profil Siswa</th>
                        <th className="px-3 py-3.5 text-left min-w-[240px]">Riwayat Konseling / Pembinaan</th>
                        <th className="px-3 py-3.5 text-left min-w-[240px]">Penghargaan / Lomba / Kompetisi</th>
                        <th className="px-3 py-3.5 text-center min-w-[60px]">Total Poin</th>
                        <th className="px-3 py-3.5 text-center min-w-[110px]">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-xs font-bold text-slate-400 italic">
                            {students.length === 0 ? 'Belum ada siswa aktif di kelas perwalian Anda.' : 'Tidak ada siswa yang cocok dengan pencarian / filter.'}
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((st) => (
                          <tr key={st.id} className="align-top hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <StudentAvatar avatarPath={st.avatar_path} name={st.name} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-slate-800">{st.name}</p>
                                  <p className="text-[10px] font-mono text-slate-400">{st.nisn}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {(st.bk_ringkas || []).length === 0 ? (
                                <span className="text-[10px] font-bold italic text-slate-300">Belum ada catatan pembinaan</span>
                              ) : (
                                <ul className="space-y-1">
                                  {st.bk_ringkas.map((c) => (
                                    <li key={c.id} className="flex items-start gap-1.5">
                                      <span className={`mt-0.5 inline-block shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ring-1 ${c.kategori === 'pelanggaran' ? 'bg-rose-50 text-rose-700 ring-rose-200' : c.kategori === 'pembinaan' ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-sky-50 text-sky-700 ring-sky-200'}`}>
                                        {c.kategori}
                                      </span>
                                      <span className="line-clamp-2 text-[11px] font-semibold text-slate-600">{c.uraian}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {(st.prestasi_ringkas || []).length === 0 ? (
                                <span className="text-[10px] font-bold italic text-slate-300">Belum ada lomba / penghargaan</span>
                              ) : (
                                <ul className="space-y-1">
                                  {st.prestasi_ringkas.map((p) => (
                                    <li key={p.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                                      <Trophy size={11} className="shrink-0 text-amber-500" />
                                      <span className="truncate">{p.nama_kegiatan}</span>
                                      <span className="shrink-0 text-[9px] font-black text-slate-400">({p.tingkat})</span>
                                      <span className="shrink-0 font-black text-amber-700 tabular-nums">+{p.poin}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-black tabular-nums ${st.poin > 0 ? 'bg-amber-50 text-amber-700' : 'text-slate-300'}`}>
                                {st.poin > 0 ? `+${st.poin}` : '0'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => { setDetailStudentId(st.id); setDetailOpen(true); }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 active:scale-95 transition"
                              >
                                <BookOpen size={13} /> Kelola
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="px-1 text-[11px] font-semibold text-slate-400">
                Poin lomba yang diinput di sini otomatis menambah skor peringkat siswa pada tab Rekap Nilai.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modals ── */}
      <WaliNoteModal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        students={students}
        onSaved={() => fetchHomeroomData(true)}
      />
      <WaliStudentModal
        open={detailOpen}
        studentId={detailStudentId}
        onClose={() => setDetailOpen(false)}
        onChanged={() => fetchHomeroomData(true)}
        classInfo={data.class_info}
        homeroomTeacher={data.homeroom_teacher}
        subjects={data.subjects}
      />
    </div>
  );
};

export default HomeroomTab;
