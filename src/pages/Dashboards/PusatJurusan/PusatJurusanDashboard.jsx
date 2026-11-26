import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CinematicLoading from '../../../components/dashboard/shared/CinematicLoading';
import { 
  Share2, 
  ChevronRight, 
  Filter, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  BookOpen, 
  Users, 
  Monitor, 
  ClipboardList,
  Edit,
  Layout,
  Plus,
  Package,
  FileText,
  Settings,
  MoreVertical,
  TrendingUp,
  Search,
  Wrench,
  AlertTriangle,
  MinusCircle,
  Check,
  ArrowLeft,
  MessageCircle,
  Globe,
  Trash2,
  Bell,
  Loader2,
  Calendar,
  Shield,
  ArrowRight,
  Download,
  Send,
  MessageSquare,
  BarChart2,
  Trophy,
  Briefcase,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import { pusatJurusanAPI, informationCenterAPI } from '../../../utils/api';
import { setQueryData } from '../../../utils/queryCache';
import CalendarTab from '../AdminAkademik/components/Calendar/CalendarTab';
import InformationCenterTab from '../../../components/dashboard/shared/InformationCenterTab';
import KurikulumJadwalPage from './components/KurikulumJadwalPage';
import TabDashboardJurusan from './components/TabDashboardJurusan';
import TabPklPrestasi from './components/TabPklPrestasi';
import TabNilaiKejuruan from './components/TabNilaiKejuruan';
// Tema hero enterprise SLATE-INDIGO (seragam, tidak lagi warna-warni per jurusan).
const HERO_PANEL_STYLE = 'border-indigo-100 bg-gradient-to-br from-slate-50 via-white to-indigo-100';
const HERO_BADGE_STYLE = 'border-indigo-200 bg-gradient-to-r from-indigo-600 to-blue-600 text-white';

// --- SHARED UI COMPONENTS ---

const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-xl" }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`fixed inset-0 m-auto w-full ${maxWidth} h-fit max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl z-[70] overflow-hidden`}
        >
          <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-900">
              <XCircle className="w-8 h-8" />
            </button>
          </div>
          <div className="p-10 overflow-y-auto max-h-[70vh]">
            {children}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const GlassCard = ({ children, className = '', noPadding = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white/90 backdrop-blur-xl border border-white/40 rounded-[2.5rem] ${noPadding ? '' : 'p-8'} shadow-xl ${className}`}
  >
    {children}
  </motion.div>
);

// --- STATUS BADGE HELPER ---
const getStatusBadge = (status) => {
  if (status === 'Sedang Berlangsung') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (status === 'Selesai') return 'bg-gray-100 text-gray-500 border border-gray-200';
  if (status === 'Belum Dimulai') return 'bg-amber-100 text-amber-700 border border-amber-200';
  return 'bg-rose-100 text-rose-500 border border-rose-200'; // Kosong
};

const getStatusIcon = (status) => {
  if (status === 'Sedang Berlangsung') return 'ðŸŸ¢';
  if (status === 'Selesai') return 'Selesai';
  if (status === 'Belum Dimulai') return 'ðŸŸ¡';
  return 'ðŸ”²';
};

const PusatJurusanDashboard = ({ activeTab, user, onSelectJurusan, onJurusanStateChange }) => {
  const [jurusans, setJurusans] = useState([]);
  const [selectedJurusan, setSelectedJurusan] = useState(null);
  const [loading, setLoading] = useState(false);
  // Selalu mulai true → CinematicLoading (seragam dgn halaman lain) tampil sekali di awal.
  const [initialLoading, setInitialLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [data, setData] = useState({
    subjects: [],
    inventory: [],
    journals: [],
    announcements: [],
    achievements: [],
    internships: []
  });
  const [showModal, setShowModal] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [targetItem, setTargetItem] = useState(null);
  const toastTimerRef = useRef(null);

  // Monitoring KBM tab state
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [monitoringData, setMonitoringData] = useState(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringFilter, setMonitoringFilter] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    kelas_id: ''
  });
  const [jurnalDetailModal, setJurnalDetailModal] = useState(null);

  // --- 4+2 menu normalizer: activeTab (id menu) -> legacyTab (key render) + subTab ---
  const SUBTAB_DEFAULT = { kurikulum_jadwal: 'kurikulum' };
  const [subTab, setSubTab] = useState('');
  useEffect(() => { setSubTab(SUBTAB_DEFAULT[activeTab] || ''); }, [activeTab]);
  const legacyTab = (() => {
    switch (activeTab) {
      case 'dashboard': return 'summary';
      case 'kurikulum_jadwal': return subTab === 'plotting' ? 'plotting' : 'curriculum';
      case 'nilai_kejuruan': return 'praktik';
      case 'pkl_prestasi': return 'pklprestasi';
      case 'calendar_ta': return 'calendar_ta';
      case 'news': return 'news';
      default: return activeTab;
    }
  })();

  // Trigger sidebar state change on mount/init based on selection
  useEffect(() => {
    if (selectedJurusan) {
      try {
        localStorage.setItem('selectedJurusan', JSON.stringify(selectedJurusan));
      } catch (e) {
        // ignore localStorage error
      }
    }
    if (onJurusanStateChange) {
      // Jangan tutup sidebar selagi loading: biar sidebar (main menu) & spinner
      // muncul bareng (2 kolom stabil) seperti role lain, bukan 2 fase animasi.
      onJurusanStateChange(!!selectedJurusan || initialLoading);
    }
  }, [selectedJurusan, initialLoading, onJurusanStateChange]);

  const [clock, setClock] = useState({ time: '', day: '', date: '' });

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

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2800);
  };

  // --- INITIALIZATION ---

  useEffect(() => {
    const init = async () => {
      try {
        const [jurRes, myRes] = await Promise.all([
          pusatJurusanAPI.getJurusans().catch(() => null),
          pusatJurusanAPI.getMyJurusan().catch(() => null),
        ]);
        const list = Array.isArray(jurRes?.data) ? jurRes.data : (jurRes?.data?.data || []);
        setJurusans(list);

        // Sumber otoritatif: jurusan dari DB (my-jurusan), fallback ke snapshot user.
        const myId = Number(myRes?.data?.data?.jurusan_id || 0);
        const snapshotId = Number(user?.jurusan_id || user?.jurusanId || user?.last_jurusan_id || user?.lastJurusanId || 0);
        const resolvedId = myId || snapshotId;
        const assigned = list.find(j => Number(j.id) === resolvedId) || null;

        if (assigned) {
          setSelectedJurusan(assigned);
          try { localStorage.setItem('selectedJurusan', JSON.stringify(assigned)); } catch (e) {}
          // Prefetch ringkasan ke cache SEBELUM loading dilepas → child instan, tanpa spinner kedua.
          try {
            const sum = await pusatJurusanAPI.getDashboardSummary(assigned.id);
            setQueryData(`pusjur:dashsum:${assigned.id}`, sum.data);
          } catch (e) {}
        }
      } catch (err) {
        console.error('Failed to init', err);
      } finally {
        setInitialLoading(false);
      }
    };
    init();
  }, [user]);

  // --- DATA FETCHING ---

  const fetchData = async (tab = legacyTab) => {
    if (!selectedJurusan?.id) return;
    // Hanya set loading true jika belum ada data (first load), bukan saat refresh
    // Ini mencegah data flicker ke "-" atau "0" saat ganti tab
    setLoading(true);

    try {
      // getStats hanya dipanggil jika tab yang relevan (dashboard kini self-fetch + cache)
      if (['curriculum', 'plotting', 'inventory'].includes(tab)) {
        try {
          const statsRes = await pusatJurusanAPI.getStats(selectedJurusan.id);
          // Merge stats - jangan replace dengan null jika gagal
          const newStats = statsRes.data?.stats || statsRes.data;
          if (newStats) setStats(newStats);
        } catch {
          // Stats gagal - pertahankan data lama, tidak perlu toast
        }
      }

      // Lazy load based on tab
      if (tab === 'inventory') {
        const res = await pusatJurusanAPI.getInventory(selectedJurusan.id);
        setData(prev => ({ ...prev, inventory: res.data || [] }));
      } else if (tab === 'monitoring') {
        // Monitoring tab now uses dedicated endpoint via fetchMonitoring()
        // No-op here - fetchMonitoring is called from its own useEffect
      }
    } catch (err) {
      console.error('Fetch error', err);
      // Tidak tampilkan toast - cukup log, data lama tetap ditampilkan
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedJurusan && legacyTab !== 'monitoring') {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJurusan, legacyTab]);

  // --- MONITORING KBM ---

  const fetchMonitoring = async (filter) => {
    if (!selectedJurusan?.id) return;
    const f = filter || monitoringFilter;
    setMonitoringLoading(true);
    try {
      const params = { tanggal: f.tanggal };
      if (f.kelas_id) params.kelas_id = f.kelas_id;
      const res = await pusatJurusanAPI.getMonitoringKBM(selectedJurusan.id, params);
      setMonitoringData(res.data);
    } catch (err) {
      // Jangan tampilkan toast error - cukup tampilkan data kosong di UI
      console.warn('Monitoring fetch failed:', err?.response?.status, err?.response?.data?.message || err?.message);
      setMonitoringData(null);
    } finally {
      setMonitoringLoading(false);
    }
  };

  // Monitoring direlokasi ke Dashboard (summary) + tetap bisa via key 'monitoring'.
  useEffect(() => {
    if (legacyTab === 'monitoring' && selectedJurusan) {
      fetchMonitoring();
    }
    if (legacyTab !== 'monitoring') {
      setShowRiwayat(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyTab, selectedJurusan]);

  // --- RENDER HELPERS ---

  // Satu loading seragam dengan halaman lain: CinematicLoading branded.
  // Data dashboard diprefetch ke cache SELAGI loading ini jalan, jadi child
  // tidak memunculkan spinner kedua.
  if (initialLoading) return <CinematicLoading roleName="Pusat Jurusan" />;

  if (!selectedJurusan) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-xl rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Akses Dashboard Anda Ditolak</h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            Status akun dashboard anda belum memenuhi standar KBM (kegiatan belajar mengajar), silahkan hubungi operator untuk melengkapi profil akun.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200]">
            <div className={`px-8 py-4 rounded-full shadow-2xl border-2 font-black text-sm uppercase tracking-widest ${toast.type === 'success' ? 'bg-emerald-900 border-emerald-400 text-emerald-100' : 'bg-rose-900 border-rose-400 text-rose-100'}`}>
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RENDER CONTENT BY TAB */}
      {legacyTab === 'summary' && (
        <TabDashboardJurusan selectedJurusan={selectedJurusan} />
      )}

      {/* Sub-tab nav untuk menu yang dilebur (tampil di atas konten) */}
      {activeTab === 'kurikulum_jadwal' && (
        <KurikulumJadwalPage selectedJurusan={selectedJurusan} />
      )}

      {legacyTab === 'praktik' && (
        <TabNilaiKejuruan selectedJurusan={selectedJurusan} clock={clock} />
      )}

      {legacyTab === 'pklprestasi' && (
        <TabPklPrestasi selectedJurusan={selectedJurusan} />
      )}

      {activeTab === 'calendar_ta' && (
        <div className="w-full space-y-8 animate-fadeIn">
          {/* Header Badge - mirip Admin Akademik */}
          {/* Header Kalender Akademik — disamakan dengan Super Admin / Operator */}
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

      {activeTab === 'news' && <InformationCenterTab />}
    </div>
  );
};

export default PusatJurusanDashboard;















