import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layout, FileText, ClipboardList, Bell, MessageSquare,
  Upload, X, CheckCircle, XCircle, Clock,
  Calendar as CalendarIcon, User, Search, Download, Copy,
  Pin, Shield, ArrowRight, Edit2, AlertCircle, Zap, LayoutDashboard
} from 'lucide-react';
import CinematicLoading from '../../../components/dashboard/shared/CinematicLoading';
import { resolvePositionStatus } from '../../../utils/userMeta';
import InformationCenterTab from '../../../components/dashboard/shared/InformationCenterTab';
import CalendarTab from '../AdminAkademik/components/Calendar/CalendarTab';

// Constants for file validation
const MAX_FILES = 3;
const FILE_LIMITS = {
  'image/jpeg': { ext: 'JPG', max: 5 },
  'image/png': { ext: 'PNG', max: 5 },
  'application/pdf': { ext: 'PDF', max: 20 },
  'application/msword': { ext: 'DOC', max: 20 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'DOCX', max: 20 },
  'application/vnd.ms-excel': { ext: 'XLS', max: 20 },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'XLSX', max: 20 },
  'video/mp4': { ext: 'MP4', max: 50 }
};

export default function SpecialStaffDashboard({ user, activeTab, onNavigate }) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [data, setData] = useState({
    dashboard: null,
    reports: [],
    tasks: { new: [], past: [] }
  });

  // Toast state
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [clock, setClock] = useState({ time: '', day: '', date: '' });

  const role = resolvePositionStatus(user);
  const isMagang = role === 'magang';

  // Colors
  const theme = {
    gradient: 'from-[#10b981] to-[#059669]',
    buttonBg: 'bg-[#10b981]',
    buttonHover: 'hover:bg-[#059669]',
    ring: 'focus:ring-[#10b981]/20 focus:border-[#10b981]',
    uploadHover: 'hover:border-[#10b981]',
  };

  const headerTheme = {
    bgClass: 'border-emerald-100 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent),linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)]',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    iconClass: 'text-emerald-500',
    clockBorder: 'border-emerald-100'
  };

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  // Clock effect
  useEffect(() => {
    const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const tick = () => {
      const wib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const hh = String(wib.getHours()).padStart(2, '0');
      const mm = String(wib.getMinutes()).padStart(2, '0');
      const ss = String(wib.getSeconds()).padStart(2, '0');
      setClock({
        time: `${hh}:${mm}:${ss}`,
        day: DAYS_ID[wib.getDay()],
        date: `${wib.getDate()} ${MONTHS_ID[wib.getMonth()]} ${wib.getFullYear()}`,
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial load: fetch semua data sekaligus
  useEffect(() => {
    fetchAllData();
  }, []);

  // Saat tab berubah, fetch tab-specific data tanpa loading global
  useEffect(() => {
    if (initialLoading) return; // Skip saat initial load
    fetchTabData(activeTab);
  }, [activeTab]);

  const fetchAllData = async () => {
    setInitialLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };
      const [dashRes, reportsRes, tasksRes] = await Promise.all([
        fetch('/api/staff-work/dashboard', { headers }).then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/staff-work/reports', { headers }).then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/staff-work/tasks', { headers }).then(r => r.json()).catch(() => ({ success: false })),
      ]);
      setData({
        dashboard: dashRes.success ? dashRes.data : null,
        reports: reportsRes.success ? reportsRes.data : [],
        tasks: tasksRes.success ? tasksRes.data : { new: [], past: [] },
      });
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat data', 'error');
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchTabData = async (tab) => {
    setTabLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };
      const normalizedTab = tab?.replace('staff-', '') || 'summary';

      if (normalizedTab === 'summary' || normalizedTab === 'laporan') {
        const res = await fetch('/api/staff-work/dashboard', { headers });
        const json = await res.json();
        if (json.success) setData(prev => ({ ...prev, dashboard: json.data }));
      }
      if (normalizedTab === 'riwayat' || normalizedTab === 'laporan') {
        const res = await fetch('/api/staff-work/reports', { headers });
        const json = await res.json();
        if (json.success) setData(prev => ({ ...prev, reports: json.data }));
      }
      if (normalizedTab === 'tugas') {
        const res = await fetch('/api/staff-work/tasks', { headers });
        const json = await res.json();
        if (json.success) setData(prev => ({ ...prev, tasks: json.data }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTabLoading(false);
    }
  };

  if (initialLoading) return <CinematicLoading title="Memuat Workspace..." roleName={isMagang ? 'Magang' : 'Honorer'} />;

  // Normalized tab handling
  const currentTab = activeTab?.replace('staff-', '') || 'summary';

  return (
    <div className="space-y-6 pb-24 animate-fadeIn">
      {/* HEADER CARD - Shown for all except 'info' & 'calendar' */}
      {currentTab !== 'info' && currentTab !== 'calendar' && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className={`overflow-hidden rounded-[2.5rem] border shadow-2xl p-8 lg:p-10 ${headerTheme.bgClass}`}>
            <div className="relative flex flex-col md:flex-row justify-between items-start gap-6">
              {/* Kiri: Badge + Judul */}
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest ${headerTheme.badgeClass}`}>
                    <Zap className="w-3 h-3" /> Portal Spesial Staff Authority
                  </div>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                  Area Kerja {isMagang ? 'Magang' : 'Honorer'} Sekolah
                </h1>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Kelola laporan harian, tugas terarah, dan rekam aktivitas terintegrasi.
                </p>
              </div>

              {/* Kanan: Jam seperti role lain */}
              <div className={`flex items-center gap-4 px-5 py-3 rounded-2xl bg-white/80 border shadow-sm shrink-0 ${headerTheme.clockBorder}`}>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clock.day},</span>
                    <span className="text-xs font-bold text-slate-500">{clock.date}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className={`h-4 w-4 ${headerTheme.iconClass}`} />
                    <span className="text-2xl font-black tracking-widest text-slate-700 tabular-nums">{clock.time}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Inline Tab Loading */}
      {tabLoading && (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400 animate-fadeIn">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest">Tunggu sebentar, sedang memuat...</p>
        </div>
      )}

      {/* Tabs Content */}
      {!tabLoading && currentTab === 'summary' && <TabDashboard data={data.dashboard} user={user} isMagang={isMagang} onNavigate={onNavigate} />}
      {!tabLoading && currentTab === 'laporan' && <TabLaporan theme={theme} reports={data.reports} onSuccess={() => { showToast('Laporan berhasil dikirim', 'success'); fetchTabData('laporan'); }} onError={(msg) => showToast(msg, 'error')} />}
      {!tabLoading && currentTab === 'tugas' && <TabTugas tasks={data.tasks} theme={theme} />}
      {currentTab === 'calendar' && (
        <div className="w-full space-y-8 animate-fadeIn">
          <div className="overflow-hidden rounded-[2rem] border border-indigo-100 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(79,70,229,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#eef2ff_100%)] p-6 lg:p-8 shadow-2xl">
            <div className="relative">
              <div className="space-y-2">
                <div className="mb-3 flex items-center gap-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <LayoutDashboard className="w-3 h-3" /> Portal Admin Academic Authority
                  </div>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Kalender &amp; Agenda Pendidikan</h1>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Pusat Kalender Akademik &amp; Penjadwalan Agenda Sekolah.
                </p>
              </div>

              {/* Clock WIB — absolute di kanan, sama seperti Super Admin / Operator */}
              <div className="mt-6 flex flex-col items-end justify-center gap-1 rounded-2xl border border-indigo-100 bg-white/80 px-4 py-2.5 shadow-sm md:absolute md:right-0 md:top-1/2 md:mt-0 md:-translate-y-1/2">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-700">{clock.day},</span>
                  <span className="text-xs font-bold text-slate-500">{clock.date}</span>
                </div>
                <div className="flex items-center gap-2 leading-none">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clock.time}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">WIB</span>
                </div>
              </div>
            </div>
          </div>
          <CalendarTab isPreviewOnly={true} />
        </div>
      )}
      {currentTab === 'info' && <InformationCenterTab />}

      {/* Toast */}
      <AnimatePresence>
        {toast.show && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-xl border-l-4 flex items-center gap-3 bg-white z-50
              ${toast.type === 'success' ? 'border-[#10B981]' : toast.type === 'error' ? 'border-[#EF4444]' : toast.type === 'warning' ? 'border-[#F59E0B]' : 'border-[#3B82F6]'}`}
          >
            <span className={`font-semibold ${toast.type === 'success' ? 'text-[#065F46]' : toast.type === 'error' ? 'text-[#991B1B]' : toast.type === 'warning' ? 'text-[#92400E]' : 'text-[#1E3A8A]'}`}>
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- TAB: DASHBOARD ---
function TabDashboard({ data, user, isMagang, onNavigate }) {
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-32 text-slate-400 animate-fadeIn">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold uppercase tracking-widest">Tunggu sebentar, sedang memuat...</p>
    </div>
  );
  const { stats, pending_tasks, recent_notifications } = data;

  const roleColor = isMagang ? 'teal' : 'blue';
  
  return (
    <div className="space-y-10 animate-fadeIn">
      {/* SECTION HEADER */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
           <div className={`w-10 h-10 rounded-xl bg-${roleColor}-50 flex items-center justify-center text-${roleColor}-600 shadow-inner border border-${roleColor}-100`}>
              <Layout size={20} />
           </div>
           Ringkasan Aktivitas
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* CARD 1: Identitas */}
        <div className="group relative bg-white p-8 rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-transparent rounded-full blur-2xl -mr-10 -mt-10 group-hover:from-indigo-100 transition-colors" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                <User size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Identitas Personal</h3>
              </div>
            </div>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group-hover:bg-indigo-50/30 transition-colors">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Instansi / Magang di</span>
                  <span className="text-base font-bold text-slate-700 capitalize leading-snug">{user.penempatan ? user.penempatan.replace(/_/g, ' ') : '-'}</span>
                </div>
                <div className="flex flex-col p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group-hover:bg-indigo-50/30 transition-colors">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pembimbing</span>
                  <span className="text-base font-bold text-slate-700 leading-snug">{user.pembimbing || '-'}</span>
                </div>
              </div>

              {/* Status Kontrak â€” dipindah dari header */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group-hover:bg-indigo-50/30 transition-colors">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Kontrak</span>
                  {data?.user?.days_left !== null && data?.user?.days_left !== undefined ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-700 leading-none">{data.user.days_left}</span>
                      <span className="text-xs font-bold text-slate-500">Hari Lagi</span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-slate-700">Permanen</span>
                  )}
                </div>
                <div className="flex flex-col p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group-hover:bg-indigo-50/30 transition-colors">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal Kerja Berakhir</span>
                  {data?.user?.contract_end ? (
                    <span className="text-sm font-bold text-slate-700 leading-tight">{data.user.contract_end}</span>
                  ) : (
                    <span className="text-sm font-bold text-slate-700">-</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Statistik Laporan */}
        <div className="group relative bg-white p-8 rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-50 to-transparent rounded-full blur-2xl -mr-10 -mt-10 group-hover:from-emerald-100 transition-colors" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Kinerja Laporan</h3>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-200/50 flex flex-col justify-center items-center">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Disetujui</p>
                 <p className="text-3xl font-black text-slate-700 leading-none">{stats.disetujui}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-200/50 flex flex-col justify-center items-center">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ditolak</p>
                 <p className="text-3xl font-black text-slate-700 leading-none">{stats.ditolak}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-200/50 flex flex-col justify-center items-center">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Menunggu</p>
                 <p className="text-3xl font-black text-slate-700 leading-none">{stats.menunggu}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-200/50 flex flex-col justify-center items-center group-hover:bg-slate-100/50 transition-colors">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Laporan</p>
                 <p className="text-3xl font-black text-slate-700 leading-none">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: Tugas Belum Selesai */}
        <div className="group relative bg-white p-8 rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-50 to-transparent rounded-full blur-2xl -mr-10 -mt-10 group-hover:from-rose-100 transition-colors" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100/60 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-rose-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Daftar Tugas</h3>
                </div>
              </div>
              
              <button 
                onClick={() => onNavigate('tugas')}
                className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition-all duration-300 shadow-sm border border-rose-100 flex items-center justify-center group/btn shrink-0"
                title="Buka Tugas & Arahan"
              >
                 <ArrowRight size={18} className="group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <div className="flex-1">
              <ul className="space-y-3">
                {pending_tasks?.length > 0 ? pending_tasks.map((t, idx) => (
                  <li key={t.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                     <span className="w-6 h-6 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 text-xs font-black shadow-inner">
                        {idx + 1}
                     </span>
                     <div>
                        <p className="text-sm font-bold text-slate-700 line-clamp-1">{t.judul_tugas}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">DL: {t.deadline}</p>
                     </div>
                  </li>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center pt-4 opacity-50">
                     <CheckCircle size={32} className="text-slate-300 mb-2" />
                     <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Tidak ada tugas tertunda.<br/>Kerja bagus!</p>
                  </div>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* CARD 4: Pusat Informasi Shortcut */}
        <div className="group relative bg-white p-8 rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(168,85,247,0.15)] hover:-translate-y-1 transition-all duration-500 overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-50 to-transparent rounded-full blur-2xl -mr-10 -mt-10 group-hover:from-purple-100 transition-colors" />
          
          <div className="relative z-10 flex flex-col h-full">
            {/* Header: Title and Button Aligned */}
            <div className="flex items-center justify-between mb-6 border-b border-slate-100/60 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Pusat Informasi</h3>
                </div>
              </div>
              
              <button 
                onClick={() => onNavigate('info')}
                className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-600 hover:text-white transition-all duration-300 shadow-sm border border-purple-100 flex items-center justify-center group/btn"
                title="Buka Pusat Informasi"
              >
                 <ArrowRight size={18} className="group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            </div>
            
            {/* Body: Feed / Empty State */}
            <div className="flex-1 flex flex-col items-center justify-center pt-2 opacity-50">
               <Bell size={32} className="text-slate-300 mb-3" />
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                  Belum ada siaran baru.<br />Seluruh informasi penting dari otoritas sekolah akan muncul di sini.
               </p>
            </div>
          </div>
        </div>

        {/* Notifikasi Laporan Terbaru (Full Width) */}
        {recent_notifications?.length > 0 && (
          <div className="col-span-1 md:col-span-2 group relative bg-slate-900 p-8 rounded-[2rem] shadow-xl overflow-hidden mt-2">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 opacity-50" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6 border-b border-slate-700 pb-4">
                <div className="w-12 h-12 rounded-[1rem] bg-yellow-500/20 text-yellow-400 flex items-center justify-center border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                  <Bell size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Notifikasi Laporan</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pembaruan Status Verifikasi</p>
                </div>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recent_notifications.map((n, i) => (
                  <li key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                     <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${n.status_verifikasi === 'disetujui' ? 'bg-emerald-400 text-emerald-400' : 'bg-rose-400 text-rose-400'}`} />
                     <div className="flex-1 truncate">
                        <p className="text-sm font-bold text-slate-200 truncate">{n.judul}</p>
                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${n.status_verifikasi === 'disetujui' ? 'text-emerald-400' : 'text-rose-400'}`}>
                           {n.status_verifikasi === 'disetujui' ? 'BERHASIL DISETUJUI' : 'LAPORAN DITOLAK'}
                        </p>
                     </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// --- TAB: LAPORAN HARIAN & RIWAYAT ---
function TabLaporan({ theme, reports, onSuccess, onError }) {
  // --- FORM STATE ---
  const [formData, setFormData] = useState({ 
    tanggal_kegiatan: new Date().toISOString().split('T')[0], 
    judul: '', 
    deskripsi: '' 
  });
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // --- HISTORY STATE ---
  const [filter, setFilter] = useState('Semua Status');
  const [search, setSearch] = useState('');

  // --- FORM HANDLERS ---
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    processFiles(selected);
  };

  const processFiles = (selected) => {
    let validFiles = [...files];
    let errors = [];

    selected.forEach(file => {
      const limit = FILE_LIMITS[file.type];
      if (!limit) {
        const ext = file.name.split('.').pop();
        errors.push(`Format .${ext} tidak didukung.`);
        return;
      }
      if (file.size > limit.max * 1024 * 1024) {
        errors.push(`File ${file.name} terlalu besar (Maks ${limit.max}MB).`);
        return;
      }
      if (validFiles.length >= MAX_FILES) {
        if (!errors.includes('Maksimal 3 file.')) errors.push('Maksimal 3 file.');
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) onError(errors[0]);
    setFiles(validFiles);
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  const removeFile = (idx) => setFiles(files.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.judul || !formData.tanggal_kegiatan) return onError('Judul dan tanggal wajib diisi');
    
    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('tanggal_kegiatan', formData.tanggal_kegiatan);
      data.append('judul', formData.judul);
      data.append('deskripsi', formData.deskripsi);
      files.forEach(f => data.append('files[]', f));

      const res = await fetch('/api/staff-work/reports', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}`, 'Accept': 'application/json' },
        body: data
      });
      const json = await res.json();
      if (json.success) {
        setFormData({ tanggal_kegiatan: new Date().toISOString().split('T')[0], judul: '', deskripsi: '' });
        setFiles([]);
        onSuccess();
      } else {
        onError(json.message || 'Gagal mengirim laporan');
      }
    } catch (err) {
      onError('Terjadi kesalahan jaringan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- HISTORY HANDLERS ---
  const filtered = reports ? reports.filter(r => {
    if (filter !== 'Semua Status' && r.status_verifikasi !== filter.toLowerCase()) return false;
    if (search && !r.judul.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) : [];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'disetujui': 
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Disetujui</span>
          </div>
        );
      case 'ditolak': 
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Ditolak</span>
          </div>
        );
      default: 
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" />
            <span className="text-[10px] font-black uppercase tracking-widest">Menunggu</span>
          </div>
        );
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1600px] mx-auto w-full space-y-8 pb-20">
      
      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* KIRI: FORM */}
        <div className="xl:col-span-5 bg-white/70 backdrop-blur-xl border border-white/40 p-6 lg:p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          
          <div className="relative z-10 mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                 <Edit2 size={20} />
              </div>
              Buat Laporan
            </h2>
            <p className="mt-2 text-xs leading-6 text-slate-600 ml-14">Rekam pencapaian dan aktivitas Anda hari ini.</p>
          </div>

          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 ml-1">Tanggal Kegiatan</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <CalendarIcon size={16} />
                  </div>
                  <input 
                    type="date" 
                    required 
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none transition-all focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-sm text-slate-700`}
                    value={formData.tanggal_kegiatan} 
                    onChange={e => setFormData({ ...formData, tanggal_kegiatan: e.target.value })} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 ml-1">Judul Laporan</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <FileText size={16} />
                  </div>
                  <input 
                    type="text" 
                    required 
                    placeholder="Apa yang Anda kerjakan hari ini?"
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none transition-all focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-sm text-slate-700 placeholder:text-slate-400`}
                    value={formData.judul} 
                    onChange={e => setFormData({ ...formData, judul: e.target.value })} 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-500 ml-1">Deskripsi Kegiatan</label>
              <div className="relative group">
                <textarea 
                  rows="4" 
                  placeholder="Jabarkan rincian pekerjaan, kendala, atau hasil yang dicapai..."
                  className={`w-full p-4 bg-slate-50/50 border border-slate-200 rounded-3xl outline-none transition-all focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-medium text-sm text-slate-700 leading-relaxed placeholder:text-slate-400`}
                  value={formData.deskripsi} 
                  onChange={e => setFormData({ ...formData, deskripsi: e.target.value })}
                ></textarea>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[11px] font-bold text-slate-500 ml-1">Lampiran File (Opsional)</label>
              <div 
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()} 
                className={`relative group bg-slate-50/30 border-2 border-dashed rounded-[2rem] p-6 text-center cursor-pointer transition-all duration-300
                  ${isDragging ? 'border-blue-500 bg-blue-50/50 scale-[0.99]' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/80'}
                `}
              >
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 ${isDragging ? 'bg-blue-500 text-white shadow-xl' : 'bg-white text-slate-400 shadow-sm group-hover:scale-110 group-hover:text-blue-500'}`}>
                    <Upload size={24} />
                  </div>
                  <p className="text-sm font-black text-slate-700 tracking-tight">Tarik & Lepas File</p>

                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                     {[
                       { label: '*.jpg/png', size: '5Mb' },
                       { label: '*.pdf/doc', size: '20Mb' }
                     ].map(limit => (
                       <span key={limit.label} className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-semibold text-slate-500 shadow-sm">
                         {limit.label} : {limit.size}
                       </span>
                     ))}
                  </div>
                </div>
                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.mp4" />
              </div>

              {files.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 mt-3">
                  {files.map((f, i) => (
                    <div key={i} className="flex justify-between items-center bg-white border border-slate-100 p-3 rounded-2xl shadow-sm group/file hover:border-blue-200 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center group-hover/file:bg-blue-50 group-hover/file:text-blue-500 transition-colors">
                           <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{f.name}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeFile(i)} className="w-6 h-6 rounded-md bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all">
                         <X size={14}/>
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            <div className="pt-6 border-t border-slate-100 mt-6 flex gap-3">
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className={`flex-1 py-3.5 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2
                  ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : `bg-gradient-to-r ${theme.gradient} hover:shadow-indigo-200 hover:-translate-y-0.5`}
                `}
              >
                {isSubmitting ? 'Mengirim...' : (
                  <>
                    <span>Kirim Laporan</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* KANAN: RIWAYAT */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          {/* Header & Filter History */}
          <div className="bg-white/80 backdrop-blur-xl border border-slate-100 p-6 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row gap-5 justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                 <ClipboardList size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-950">Riwayat Laporan</h2>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">Total {reports?.length || 0} laporan tercatat</p>
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative group w-32 md:w-40">
                <select 
                  value={filter} 
                  onChange={e=>setFilter(e.target.value)} 
                  className="w-full appearance-none pl-4 pr-8 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-xs text-slate-600 transition-all"
                >
                  <option>Semua Status</option>
                  <option>Disetujui</option>
                  <option>Ditolak</option>
                  <option>Menunggu</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                   <Search size={14} />
                </div>
              </div>
              <div className="relative group flex-1 md:w-56">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                   <Search size={14} />
                </div>
                <input 
                  type="text" 
                  placeholder="Cari..." 
                  value={search} 
                  onChange={e=>setSearch(e.target.value)} 
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-xs text-slate-600 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>
          
          {/* Cards List History */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-max overflow-y-auto pr-2 custom-scrollbar pb-6">
            {filtered.length > 0 ? filtered.map((r, i) => (
              <motion.div 
                key={r.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group bg-white rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500 flex flex-col overflow-hidden self-start"
              >
                {/* Card Header */}
                <div className="p-5 pb-3 flex items-start justify-between gap-3 border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors shadow-inner shrink-0">
                       <CalendarIcon size={16} />
                    </div>
                    <div>
                       <p className="text-[9px] font-bold text-slate-500 leading-none mb-1">Tanggal</p>
                       <p className="text-xs font-bold text-slate-700 leading-none">{r.tanggal_kegiatan}</p>
                    </div>
                  </div>
                  {getStatusBadge(r.status_verifikasi)}
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 tracking-tight leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                       {r.judul}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mt-2 line-clamp-3 leading-relaxed italic">
                       "{r.deskripsi || 'Tidak ada deskripsi'}"
                    </p>
                  </div>

                  {r.lampirans && (() => {
                    const attachmentList = JSON.parse(r.lampirans);
                    if (attachmentList.length === 0) return null;
                    return (
                      <div className="pt-2">
                        <p className="text-[10px] font-bold text-slate-500 mb-2">Lampiran ({attachmentList.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {attachmentList.map((l, idx) => (
                            <a 
                              key={idx} 
                              href={`/storage/${l.path}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[9px] font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-600 transition-all max-w-[120px]"
                            >
                              <Download size={10} className="shrink-0" />
                              <span className="truncate">{l.original_name}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Card Footer: Catatan Pembimbing */}
                {r.catatan_pembimbing && (
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100">
                    <div className="flex items-start gap-2">
                      <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <p className="text-[10px] font-medium text-slate-600 leading-relaxed italic">
                        <span className="font-bold text-slate-400 mr-1 not-italic">Feedback:</span>
                        "{r.catatan_pembimbing}"
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )) : (
              <div className="col-span-full py-16 text-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                <Search className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-black text-sm">Belum Ada Laporan</p>
                <p className="text-slate-400 font-medium text-xs">Laporan yang Anda kirim akan muncul di sini.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}


// --- TAB: TUGAS ---
function TabTugas({ tasks, theme }) {
  if (!tasks) return null;

  const newTaskCount = tasks.new?.length || 0;
  const pastTaskCount = tasks.past?.length || 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      {/* CARD 1: TUGAS AKTIF */}
      <div className="bg-white rounded-[2.5rem] p-8 lg:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm border border-amber-100">
              <MessageSquare size={28} className="animate-bounce" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Daftar Tugas Aktif</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">Instruksi kerja yang perlu Anda prioritaskan</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-50 border border-slate-100">
             <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Tugas Baru:</span>
             <span className="text-xl font-black text-amber-600">{newTaskCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {tasks.new?.length > 0 ? tasks.new.map((t, idx) => (
            <motion.div 
              key={t.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="group relative bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-50 to-transparent rounded-full blur-2xl -mr-10 -mt-10 group-hover:from-amber-100 transition-colors" />
              
              <div className="relative z-10 flex flex-col h-full min-h-[200px]">
                <div className="flex items-start justify-between mb-6">
                   <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200">
                      <Pin size={20} />
                   </div>
                   <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest border border-rose-100">Action Required</span>
                </div>

                <h3 className="text-lg font-black text-slate-800 tracking-tight mb-3 group-hover:text-amber-600 transition-colors line-clamp-2">
                  {t.judul_tugas}
                </h3>
                
                <div className="flex-1 bg-slate-50/50 rounded-2xl p-4 border border-slate-100 group-hover:bg-amber-50/30 transition-colors mb-6">
                   <p className="text-[13px] font-medium text-slate-600 leading-relaxed italic">
                     "{t.deskripsi}"
                   </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                   <div className="flex flex-col">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Deadline</p>
                      <p className="text-[11px] font-black text-rose-500 flex items-center gap-1">
                         <Clock size={10} /> {t.deadline}
                      </p>
                   </div>
                   <button className="p-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                      <ArrowRight size={18} />
                   </button>
                </div>
              </div>
            </motion.div>
          )) : (
            <div className="col-span-full py-20 bg-slate-50/30 rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
               <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-slate-200 mb-4 shadow-sm">
                  <ClipboardList size={40} />
               </div>
               <p className="text-xl font-black text-slate-400 tracking-tight">Belum Ada Tugas Aktif</p>
               <p className="text-sm font-medium text-slate-500 mt-1">Cek riwayat untuk instruksi sebelumnya.</p>
            </div>
          )}
        </div>
      </div>

      {/* CARD 2: RIWAYAT ARAHAN */}
      <div className="bg-white rounded-[2.5rem] p-8 lg:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60">
        <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-100">
            <ClipboardList size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Riwayat Arahan</h2>
            <p className="text-sm font-medium text-slate-500">Arsip instruksi yang telah diselesaikan</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {tasks.past?.length > 0 ? tasks.past.map((t, idx) => (
            <div key={t.id} className="group flex items-center gap-6 p-6 bg-slate-50/30 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-md hover:border-slate-200 transition-all duration-300">
               <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex flex-col items-center justify-center shrink-0 border border-emerald-100/50">
                  <span className="text-[10px] font-black text-emerald-400 leading-none">{t.deadline?.split(' ')[0]}</span>
                  <span className="text-sm font-black text-emerald-600 mt-0.5">{t.deadline?.split(' ')[1]}</span>
               </div>
               <div className="flex-1">
                  <h4 className="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">{t.judul_tugas}</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">"{t.deskripsi}"</p>
               </div>
               <div className="px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                  Success
               </div>
               <button className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-colors shadow-sm">
                  <ArrowRight size={18} />
               </button>
            </div>
          )) : (
            <div className="py-20 text-center bg-slate-50/30 rounded-[3rem] border border-dashed border-slate-200">
               <p className="text-slate-400 font-bold tracking-tight">Tidak ada riwayat arahan.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
