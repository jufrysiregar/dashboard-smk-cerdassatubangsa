import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import CinematicLoading from '../../../components/dashboard/shared/CinematicLoading';

import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  BookMarked,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSearch,
  FileText,
  GraduationCap,
  Library,
  Lock,
  PlayCircle,
  Receipt,
  
  Search,
  Sparkles,
  TimerReset,
  KeyRound,
  LogIn,
  Trophy,
  UploadCloud,
  Wallet,
  X,
  Award,
  Target,
  Zap,
  Clock,
  LayoutDashboard,
  Rocket,
  Flame,
  ExternalLink,
  History,
  Star,
  FileCode,
  FileDown,
  BarChart3,
  ClipboardList,
  Megaphone,
  Inbox,
  Pencil,
  Eye,
  User,
  Image as ImageIcon,
  RefreshCw,
  Paperclip,
} from 'lucide-react';
import { examAPI, examSessionAPI, studentAPI, informationCenterAPI, calendarAPI, schoolAPI } from '../../../utils/api';
import { getQueryData, isQueryFresh, setQueryData } from '../../../utils/queryCache';
import { MessageSquare, ShieldCheck, ArrowRight, Shield, Printer, Copy, Landmark, ChevronDown, TrendingUp, Info } from 'lucide-react';
import { previewKuitansiPDF, previewRekapKeuanganPDF } from '../../../utils/financePdf';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import CalendarTab from '../AdminAkademik/components/Calendar/CalendarTab';
import UnderDevelopment from '../../../maintaning/UnderDevelopment';
import InformationCenterTab from '../../../components/dashboard/shared/InformationCenterTab';
import StudentKbmPresensiTab from './StudentKbmPresensiTab';
import KegiatanKhususTab from './KegiatanKhususTab';
import StudentNilaiRaporTab from './StudentNilaiRaporTab';
import StudentExamRunner from './StudentExamRunner';
import TeacherQuizWorkspaceModal from './TeacherQuizWorkspaceModal';
import TeacherQuizInstructionsModal from './TeacherQuizInstructionsModal';
import AlumniPortal from './AlumniPortal';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import useEscapeKey from '../../../utils/useEscapeKey';

const sessionThemes = [
  {
    key: 'elite-cyan',
    label: 'Elite Cyan',
    gradient: 'from-[#0ea5e9] via-[#0284c7] to-[#0369a1]',
    softGradient: 'from-sky-50 via-cyan-50 to-blue-50',
    accentText: 'text-sky-700',
    accentBg: 'bg-sky-600',
    button: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:shadow-sky-500/20',
  },
  {
    key: 'vibrant-purple',
    label: 'Vibrant Purple',
    gradient: 'from-[#8b5cf6] via-[#7c3aed] to-[#6d28d9]',
    softGradient: 'from-purple-50 via-violet-50 to-indigo-50',
    accentText: 'text-purple-700',
    accentBg: 'bg-purple-600',
    button: 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:shadow-purple-500/20',
  }
];

const pickSessionTheme = () => sessionThemes[0];

const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

const GlassCard = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.4 }}
    className={`rounded-[2.5rem] border border-gray-100 bg-white p-6 shadow-sm shadow-blue-500/5 ${className}`}
  >
    {children}
  </motion.div>
);

const statusLabel = (s) => (s || '-').toUpperCase();
const roleTone = (s) => s === 'lunas' ? 'emerald' : 'amber';

const NeonBadge = ({ tone = 'slate', children }) => {
  const tones = {
    sky: 'bg-sky-500/10 text-sky-600 border-sky-200',
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-200',
    rose: 'bg-rose-500/10 text-rose-600 border-rose-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${tones[tone] || tones.slate}`}>{children}</span>;
};

const STUDENT_CACHE_KEY = 'dashboard:student';
const STUDENT_CACHE_TTL = 60000;

export default function StudentDashboard({ activeTab, user }) {
  // ── Portal Alumni Read-Only (masa tenggang 6 bulan) ───────────────────────
  // Ketika akun ini alumni yang masih punya akses portal, sembunyikan seluruh
  // menu harian (absensi, KBM, CBT, chat) dan tampilkan portal read-only ringkas.
  if (user?.is_alumni_readonly === true) {
    return <AlumniPortal user={user} />;
  }

  const [theme] = useState(() => pickSessionTheme());
  // Snapshot terakhir dipakai agar kembali ke dashboard tidak menampilkan
  // layar loading penuh; penyegaran dilakukan diam-diam di latar belakang.
  const cachedSnapshot = React.useMemo(() => getQueryData(STUDENT_CACHE_KEY), []);
  const [dashboard, setDashboard] = useState(() => cachedSnapshot?.dashboard ?? null);
  const [announcements, setAnnouncements] = useState(() => cachedSnapshot?.announcements ?? []);
  const [loading, setLoading] = useState(() => !cachedSnapshot?.dashboard);
  const [toast, setToast] = useState(null);
  const [clock, setClock] = useState({ time: '', day: '', date: '' });
  const [activeExamSessions, setActiveExamSessions] = useState([]);
  // Sesi ujian yang sedang dibuka di ruang CBT (StudentExamRunner mengurus
  // tata tertib, token, pengerjaan, dan penegakan aturan keamanan dari server).
  const [examRunner, setExamRunner] = useState(null);
  const [examRunnerToken, setExamRunnerToken] = useState('');
  // Sesi kuis/esai GURU (1-pintu token 6 karakter) — ruang pengerjaan terpisah,
  // TIDAK memakai runner ujian resmi Operator.
  const [teacherQuiz, setTeacherQuiz] = useState(null);
  // Layar instruksi guru (10d) tampil SEBELUM ruang pengerjaan dibuka.
  const [pendingTeacherQuiz, setPendingTeacherQuiz] = useState(null);
  const handleStartTeacherQuiz = async (quizArg) => {
    const quiz = quizArg ?? pendingTeacherQuiz;
    if (!quiz) return;
    try {
      const res = await studentAPI.startQuiz(quiz.id);
      const d = res.data?.data ?? {};
      setTeacherQuiz({ ...quiz, ends_at: d.ends_at ?? quiz.ends_at, remaining_seconds: d.remaining_seconds ?? quiz.remaining_seconds, saved_answers: d.saved_answers ?? quiz.saved_answers });
    } catch (err) {
      // Gagal memulai (mis. tenggat lewat) → tutup instruksi, beri tahu.
      setPendingTeacherQuiz(null);
      window.dispatchEvent(new CustomEvent('dashboardToast', { detail: { message: err?.response?.data?.message || 'Gagal memulai sesi.', type: 'error' } }));
      return;
    }
    setPendingTeacherQuiz(null);
  };
  // Titik masuk "Mulai Kerjakan" dari kotak token (identik di Beranda & Tugas & Nilai):
  // sesi resume / sedang dikerjakan → LANGSUNG ruang kerja; sesi baru → modal instruksi dulu.
  const openTeacherQuizEntry = (data) => {
    if (!data) return;
    if (data.resume) handleStartTeacherQuiz(data);
    else setPendingTeacherQuiz(data);
  };
  // Pop-up review ujian pasca-refresh (dipicu sekali dari sessionStorage).
  const [pendingReview, setPendingReview] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pending_exam_review');
      if (raw) {
        sessionStorage.removeItem('pending_exam_review'); // sekali saja, tidak berulang
        const data = JSON.parse(raw);
        if (data && data.exam_session_id) setPendingReview(data);
      }
    } catch { /* abaikan */ }
  }, []);

  const refreshActiveExams = useCallback(async () => {
    try {
      const response = await examSessionAPI.getActiveForStudent();
      setActiveExamSessions(response.data?.data || []);
    } catch (error) {
      setActiveExamSessions([]);
    }
  }, []);

  useEffect(() => {
    refreshActiveExams();
    const interval = window.setInterval(refreshActiveExams, 10000);
    return () => window.clearInterval(interval);
  }, [refreshActiveExams]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

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

  const fetchDashboard = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [dashRes, annRes] = await Promise.all([
        studentAPI.getDashboard(),
        informationCenterAPI.getInfos({ per_page: 5 })
      ]);
      const nextDashboard = dashRes.data.data;
      const nextAnnouncements = annRes.data?.data || [];
      setDashboard(nextDashboard);
      setAnnouncements(nextAnnouncements);
      setQueryData(STUDENT_CACHE_KEY, {
        dashboard: nextDashboard,
        announcements: nextAnnouncements,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasCachedData = Boolean(cachedSnapshot?.dashboard);
    if (hasCachedData && isQueryFresh(STUDENT_CACHE_KEY, STUDENT_CACHE_TTL)) {
      setLoading(false);
      return;
    }
    fetchDashboard({ silent: hasCachedData });
  }, []);

  const d = dashboard;
  const p = d?.profile || {};
  const h = d?.highlights || {};

  const renderContent = () => {
    const tab = activeTab?.replace('role-', '') || 'profile';

    switch (tab) {
      case 'profile': return <TabDashboard d={d} announcements={announcements} onNavigate={(t) => window.dispatchEvent(new CustomEvent('navigateDashboard', { detail: t }))} onStartExam={(session, token) => { setExamRunnerToken(token || ''); setExamRunner(session); }} onOpenTeacherQuiz={openTeacherQuizEntry} />;
      case 'kbm': return <StudentKbmPresensiTab />;
      case 'tasks': return <TasksTab d={d} theme={theme} clock={clock} onSubmitted={() => fetchDashboard({ silent: true })} onRefresh={() => { fetchDashboard({ silent: true }); refreshActiveExams(); }} activeExamSessions={activeExamSessions} onStartExam={(session, token) => { setExamRunnerToken(token || ''); setExamRunner(session); }} onOpenTeacherQuiz={openTeacherQuizEntry} />;
      case 'report': return <StudentNilaiRaporTab />;
      case 'finance': return <FinanceTab d={d} onConfirmed={() => fetchDashboard({ silent: true })} onRefresh={() => fetchDashboard({ silent: true })} />;
      case 'kegiatan': return <KegiatanKhususTab profile={d?.profile} academicPeriod={d?.academic_period} clock={clock} />;
      case 'calendar_ta': return (
        <div className="w-full space-y-8 animate-fadeIn">
          {/* Header Badge â€” mirip Admin Akademik */}
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
      );
      case 'news': return <InformationCenterTab />;
      default: return <TabDashboard d={d} announcements={announcements} onNavigate={(t) => window.dispatchEvent(new CustomEvent('navigateDashboard', { detail: t }))} onStartExam={(session, token) => { setExamRunnerToken(token || ''); setExamRunner(session); }} />;
    }
  };

  if (loading && !dashboard) {
    return <CinematicLoading roleName="Murid" />;
  }

  const currentTab = activeTab?.replace('role-', '') || 'profile';
  const hideHeader = ['kbm', 'tasks', 'report', 'finance', 'kegiatan', 'calendar_ta'].includes(
    currentTab
  );

  return (
    <div className={activeTab?.includes('news') ? 'animate-fadeIn' : 'space-y-10 pb-20 animate-fadeIn'}>
      {/* Dynamic Header Banner */}
      {activeTab !== 'news' && !hideHeader && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[3rem] bg-white p-8 text-slate-900 shadow-xl xl:p-12 border border-blue-100"
        >
          {/* Glow kanan */}
          <div className={`absolute top-0 right-0 w-[45%] h-full bg-gradient-to-l ${theme.gradient} opacity-20 blur-[120px] rounded-full`}></div>
          {/* Glow kiri â€” simetris */}
          <div className={`absolute top-0 left-0 w-[35%] h-full bg-gradient-to-r ${theme.gradient} opacity-10 blur-[100px] rounded-full`}></div>
          
          <div className="relative flex flex-col md:flex-row justify-between gap-6 text-left items-start md:items-center">
            <div className="space-y-3 flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                <GraduationCap className="w-3 h-3" /> Portal Students Authority
              </div>
              
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                  {currentTab === 'profile' ? 'Area Kegiatan Murid' : `Eksplorasi ${currentTab.toUpperCase()}`}
                </h1>
                
                {currentTab === 'profile' && (
                  <p className="text-slate-500 font-medium text-lg max-w-2xl leading-relaxed flex items-center gap-2 mt-2">
                    <Sparkles className="h-5 w-5 text-blue-500" /> {getGreeting()} dan Semangat Belajar, <span className="font-bold text-slate-700">{p.name || user?.name || 'Murid'}</span>!
                  </p>
                )}
              </div>
            </div>

            {/* Clock WIB */}
            <div className="flex flex-col items-end gap-1 px-5 py-3 rounded-2xl bg-slate-50 border border-gray-100 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clock.day},</span>
                <span className="text-xs font-bold text-slate-500">{clock.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" />
                <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clock.time}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Primary Tab Outlet */}
      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: -20 }}
           transition={{ duration: 0.4 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {examRunner && (
          <StudentExamRunner
            key={`runner-${examRunner.id}`}
            session={examRunner}
            initialToken={examRunnerToken}
            onClose={() => { setExamRunner(null); setExamRunnerToken(''); }}
            onSubmitted={() => fetchDashboard({ silent: true })}
          />
        )}
      </AnimatePresence>
      <TeacherQuizInstructionsModal open={!!pendingTeacherQuiz} quiz={pendingTeacherQuiz} onConfirm={handleStartTeacherQuiz} onClose={() => { setPendingTeacherQuiz(null); window.dispatchEvent(new CustomEvent('clearExamToken')); }} />
      <TeacherQuizWorkspaceModal open={!!teacherQuiz} session={teacherQuiz} onClose={() => { setTeacherQuiz(null); window.dispatchEvent(new CustomEvent('clearExamToken')); }} onDone={() => { window.dispatchEvent(new CustomEvent('clearExamToken')); fetchDashboard({ silent: true }); }} />
      <ExamReviewPopup data={pendingReview} onClose={() => setPendingReview(null)} />
    </div>
  );
}

// --------------------------------------------------------------------------
// Tab Components
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// TAB: DASHBOARD (Halaman Utama Murid)
// --------------------------------------------------------------------------
const formatAuthorText = (item) => {
  if (!item) return 'Super Admin';
  if (item.author_role && typeof item.author_role === 'string') {
    return item.author_role.replace(/\s*[—–-]\s*/g, ' - ');
  }
  const name = item.author?.name || item.author_name || item.created_by || '';
  const roleRaw = item.author?.access_role || item.author?.role || item.role || '';
  const roleMap = {
    superadmin: 'Super Admin', operator: 'Super Admin',
    admin_akademik: 'Admin Akademik', guru: 'Guru',
    wakil_sekolah: 'Wakasek', kepala_sekolah: 'Kepala Sekolah',
    pusat_jurusan: 'Pusat Jurusan', cashier: 'Keuangan',
  };
  const roleFormatted = roleMap[roleRaw.toLowerCase()] || (roleRaw ? roleRaw : 'Admin');
  if (name && roleFormatted) return name + ' - ' + roleFormatted;
  if (name) return name;
  return 'Super Admin';
};

const checkHasImage = (item) => {
  if (Array.isArray(item.images) && item.images.length > 0) return true;
  if (item.image_url || item.lampiran_gambar || item.foto || item.image_path) return true;
  if (item.attachment && (item.attachment.is_image || /\.(jpg|jpeg|png|webp|gif)$/i.test(item.attachment.name || item.attachment.url || ''))) return true;
  return false;
};

function TabDashboard({ d, announcements = [], onNavigate, onStartExam, onOpenTeacherQuiz }) {
  const [localAnnouncements, setLocalAnnouncements] = useState(announcements);
  // Detail pengumuman dibuka sebagai popup di halaman ini (tanpa pindah halaman).
  const [previewAnn, setPreviewAnn] = useState(null);

  // Pintasan "Masuk Ruang Ujian" dibuka sebagai popup token langsung di Beranda (tanpa pindah menu).
  const [tokenModal, setTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenChecking, setTokenChecking] = useState(false);
  const [tokenResult, setTokenResult] = useState(null);
  const tokenInputRef = useRef(null);

  // Sinkronkan feed pengumuman terbaru (dengan status baca) dari parent.
  useEffect(() => { setLocalAnnouncements(announcements); }, [announcements]);

  // Kunci scroll halaman selama popup pengumuman / edit profil terbuka.
  useEffect(() => {
    if (!previewAnn) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [previewAnn]);

  // Popup token ujian: Esc menutup, scroll halaman dikunci selama terbuka, fokus otomatis ke input.
  useEscapeKey(tokenModal, () => setTokenModal(false));
  useEffect(() => {
    if (!tokenModal) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => tokenInputRef.current?.focus(), 60);
    return () => { document.body.style.overflow = prev; window.clearTimeout(t); };
  }, [tokenModal]);

  const resetTokenModal = () => { setTokenModal(false); setTokenInput(''); setTokenResult(null); };

  // Bersihkan banner token saat modal instruksi/ruang ujian ditutup atau sesi selesai
  // (identik dengan tab Tugas & Nilai) — tidak ada sisa "Mulai Kerjakan" menggantung.
  useEffect(() => {
    const clear = () => { setTokenInput(''); setTokenResult(null); };
    window.addEventListener('clearExamToken', clear);
    return () => window.removeEventListener('clearExamToken', clear);
  }, []);

  const checkToken = async (event) => {
    event?.preventDefault?.();
    const code = tokenInput.replace(/\s/g, '').toUpperCase();
    if (code.length !== 8 && code.length !== 6) { setTokenResult({ status: 'invalid', message: 'Token harus 8 karakter (resmi) atau 6 karakter (kuis guru).', data: null }); return; }
    setTokenChecking(true); setTokenResult(null);
    try {
      const res = await examSessionAPI.checkStudentToken({ token: code });
      setTokenResult(res.data);
    } catch (err) {
      const p = err?.response?.data;
      setTokenResult({ status: p?.status || 'invalid', message: p?.message || 'Gagal memeriksa token. Periksa koneksi lalu coba lagi.', data: p?.data ?? null });
    } finally { setTokenChecking(false); }
  };

  const startFromToken = () => {
    if (tokenResult?.status === 'ready' && tokenResult?.data) {
      if (tokenResult.data.mode === 'teacher_quiz') { onOpenTeacherQuiz?.(tokenResult.data); }
      else { onStartExam?.(tokenResult.data, tokenResult.data.exam_code); }
      resetTokenModal();
    }
  };

  // ── KABAR TERBARU (tab Agenda / Informasi) ──
  const [kabarTab, setKabarTab] = useState('informasi');
  const [agendaList, setAgendaList] = useState([]);

  // Ambil agenda dari sumber Kalender Akademik (calendarAPI.getEvents).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await calendarAPI.getEvents();
        const rows = res?.data?.data ?? res?.data ?? [];
        if (!alive) return;
        // Pertahankan urutan server (agenda terbaru / id desc dari Admin Akademik).
        const list = (Array.isArray(rows) ? rows : [])
          .map((e) => ({ id: e.id, nama: e.title, tanggal: e.event_date, dibuat: e.created_at }));
        setAgendaList(list);
      } catch { /* diem:Beranda tetap jalan tanpa agenda */ }
    })();
    return () => { alive = false; };
  }, []);

  // Bandingkan tanggal kalender lokal (dipakai untuk dot Agenda berbasis rentang harian).
  const isSameLocalDay = (dateStr) => {
    if (!dateStr) return false;
    const dt = new Date(dateStr);
    const now = new Date();
    return dt.getFullYear() === now.getFullYear()
      && dt.getMonth() === now.getMonth()
      && dt.getDate() === now.getDate();
  };

  // Dot "Agenda": aktif terus selama agenda terbaru dibuat HARI INI; besok otomatis mati.
  // Tidak hilang saat pindah tab (murni berbasis rentang harian).
  const hasNewAgenda = agendaList.length > 0 && isSameLocalDay(agendaList[0].dibuat);
  // Dot "Informasi": mati begitu informasi TERBARU dibuka (ikon mata/detail menandai dibaca),
  // bukan saat pindah tab.
  const hasNewInfo = localAnnouncements.length > 0 && localAnnouncements[0].is_read === false;
  const selectKabarTab = (tab) => setKabarTab(tab);

  const p = d?.profile || {};
  const grades = d?.report?.grades || [];
  const attendance = d?.attendance?.monthly || [];
  const todaySessions = d?.schedule?.today?.sessions || [];
  const pendingTasks = [...(d?.evaluations?.upload_tasks || [])]
    .filter(t => t.status === 'belum_dikumpulkan' && t.deadline_at && new Date(t.deadline_at) >= new Date())
    .sort((a, b) => new Date(a.deadline_at) - new Date(b.deadline_at))
    .slice(0, 5);
  const unreadAnnouncements = localAnnouncements.filter((a) => a.is_read === false);
  const pendingBills = d?.billing?.summary?.pending_count || 0;

  // Klik kartu/ikon mata pengumuman: buka detail popup di layar ini.
  // Kalau belum dibaca, tandai dibaca di DB (red dot langsung hilang).
  const openAnnouncement = (ann) => {
    if (ann.is_read === false) {
      setLocalAnnouncements((prev) => prev.map((item) => item.id === ann.id ? { ...item, is_read: true } : item));
      informationCenterAPI.markAsRead(ann.id).then(() => {
        window.dispatchEvent(new Event('info-unread:refresh'));
      }).catch(() => {});
    }
    setPreviewAnn(ann);
  };

  // Kehadiran bulan ini
  const thisMonth = attendance.length > 0 ? attendance[attendance.length - 1] : null;
  const totalHadir = thisMonth?.present ?? 0;
  const totalIzin = thisMonth?.permission ?? 0;
  const totalSakit = thisMonth?.sick ?? 0;
  const totalAlpha = thisMonth?.absent ?? 0;
  const totalHari = totalHadir + totalIzin + totalSakit + totalAlpha || 1;

  const daysUntil = (dateStr) => {
    const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const gradeColor = (g) => {
    if (g === 'A') return 'emerald';
    if (g === 'B') return 'sky';
    if (g === 'C') return 'amber';
    if (g) return 'rose';
    return 'slate';
  };

  const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const now = new Date();
  const bulanIni = `${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="space-y-6 pb-10">

      {/* BARIS 1: KARTU SAPAAN & PROFIL SINGKAT */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative max-w-2xl rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
      >
        {/* Shimmer "rim glow": cahaya radial bernapas + border bercahaya berputar + bintang sudut kanan */}
        <span className="id-glow" aria-hidden="true" />
        <span className="id-ring" aria-hidden="true" />
        <span className="absolute right-3 top-3 z-20 select-none text-2xl animate-pulse-slow" role="img" aria-label="bintang">⭐</span>

        {/* Foto murid (kiri, tinggi mengikuti teks) + Identitas (4 baris) */}
        <div className="relative z-10 flex items-stretch gap-5">
          <div className="flex shrink-0">
            {p.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={p.name || 'Foto murid'}
                className="h-full w-24 rounded-2xl border border-blue-100 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-full w-24 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-xl font-black text-blue-600">
                {p.avatar_initials || 'MS'}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
              IDENTITAS MURID :
            </h2>
            <div className="mt-1 space-y-1 text-sm leading-snug text-slate-600">
              <p><span className="font-bold text-slate-500">Nama / NISN : </span>{p.name || '-'} / {p.nisn || '-'}</p>
              <p><span className="font-bold text-slate-500">Jenis Kelamin / TTL : </span>{p.gender || '-'} / {p.ttl || '-'}</p>
              <p><span className="font-bold text-slate-500">Jurusan / Kelas : </span>{p.jurusan || p.major || '-'} / {p.class_name || p.kelas || '-'}</p>
              <p><span className="font-bold text-slate-500">Wali Kelas : </span>{p.homeroom_teacher || p.wali_kelas || '-'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* QUICK ALERT: chip ringkas yang butuh perhatian (semua data real) */}
      {(unreadAnnouncements.length > 0 || pendingBills > 0 || pendingTasks.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {unreadAnnouncements.length > 0 && (
            <button
              onClick={() => onNavigate?.('news')}
              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50 to-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-rose-600">{unreadAnnouncements.length} Pengumuman Baru</p>
                <p className="truncate text-[11px] font-bold text-slate-500">Ada informasi sekolah yang belum dibaca</p>
              </div>
              <BellRing className="ml-auto h-4 w-4 shrink-0 text-rose-300 transition-transform group-hover:scale-110" />
            </button>
          )}
          {pendingBills > 0 && (
            <button
              onClick={() => onNavigate?.('finance')}
              className="group flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <Receipt className="h-5 w-5 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-amber-600">{pendingBills} Tagihan Aktif</p>
                <p className="truncate text-[11px] font-bold text-slate-500">
                  {formatCurrency(d?.billing?.summary?.total_due || 0)} menunggu pembayaran
                </p>
              </div>
            </button>
          )}
          {pendingTasks.length > 0 && (
            <button
              onClick={() => onNavigate?.('tasks')}
              className="group flex items-center gap-3 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <TimerReset className="h-5 w-5 shrink-0 text-sky-500" />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-sky-600">{pendingTasks.length} Tugas Belum Dikumpulkan</p>
                <p className="truncate text-[11px] font-bold text-slate-500">
                  Terdekat: {pendingTasks[0]?.title || '-'} ({new Date(pendingTasks[0]?.deadline_at).toLocaleDateString('id-ID')})
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* KARTU PINTASAN: Masuk Ruang Ujian (Token) — popup token langsung di Beranda */}
      <button
        onClick={() => setTokenModal(true)}
        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-white shadow-md shadow-slate-900/25"><KeyRound className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black uppercase leading-tight tracking-tight text-slate-900">Punya Token Ujian? Masuk Ruang Ujian</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Masukkan token 8 karakter untuk ujian resmi (Simulasi, UTS, UAS, Praktik, USP, Remedial).</p>
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[11px] font-black uppercase tracking-wider text-orange-600 shadow-sm ring-1 ring-orange-200 transition-all group-hover:bg-orange-500 group-hover:text-white group-active:bg-orange-600 sm:inline-flex">
          <LogIn className="h-4 w-4" /> Buka
        </span>
      </button>

      {/* POPUP TOKEN UJIAN (langsung di Beranda) */}
      {tokenModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md" onMouseDown={(e) => { if (e.target === e.currentTarget) resetTokenModal(); }}>
          <div className="animate-fadeIn flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between bg-indigo-600 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white"><KeyRound className="h-5 w-5" /></span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Masuk Ruang Ujian</p>
                  <h3 className="mt-1 text-lg font-black text-white">Punya Token Ujian?</h3>
                  <p className="mt-0.5 text-xs font-bold text-white/80">Masukkan token 8 karakter dari pengawas.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="select-none text-[11px] font-bold text-white/70">Esc</span>
                <button onClick={resetTokenModal} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-rose-400 active:text-rose-500"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <form onSubmit={checkToken} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  ref={tokenInputRef}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8))}
                  maxLength={8}
                  placeholder="Contoh: YB-20OZB"
                  aria-label="Kode token ujian"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-center text-xl font-black uppercase tracking-[0.35em] text-slate-800 outline-none transition-all hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 sm:max-w-[240px]"
                />
                <button type="submit" disabled={tokenChecking || (tokenInput.length !== 8 && tokenInput.length !== 6)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-600/20 transition-all hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">
                  <LogIn className="h-4 w-4" /> {tokenChecking ? 'Memeriksa…' : 'Cek & Masuk'}
                </button>
              </form>

              {tokenResult && (
                <div>
                  {tokenResult.status === 'ready' && tokenResult.data ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                      <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Token Valid — Siap Mengerjakan</p>
                      <h3 className="mt-1 text-lg font-black uppercase leading-tight tracking-tight text-slate-900">{tokenResult.data.nama || 'Ujian'}</h3>
                      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                        <p className="text-slate-600"><span className="font-black text-slate-800">Mata Pelajaran:</span> {tokenResult.data.mapel || '-'}</p>
                        <p className="text-slate-600"><span className="font-black text-slate-800">Jenis:</span> {tokenResult.data.mode === 'teacher_quiz' ? (tokenResult.data.mode_soal === 'esai_pdf' ? 'Esai (Lembar PDF)' : 'Kuis CBT Pilihan Ganda') : (tokenResult.data.jenis || 'Ujian')}</p>
                        <p className="text-slate-600"><span className="font-black text-slate-800">Durasi:</span> {tokenResult.data.duration_minutes ? `${tokenResult.data.duration_minutes} Menit` : '-'}</p>
                        <p className="text-slate-600"><span className="font-black text-slate-800">Kelas:</span> {tokenResult.data.target || '-'}</p>
                      </div>
                      {tokenResult.data.resume ? <p className="mt-2 text-xs font-bold text-amber-700">Anda memiliki sesi yang belum selesai, melanjutkan dengan timer yang tersisa.</p> : null}
                      <button type="button" onClick={startFromToken} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 transition-all hover:brightness-105 active:scale-95 sm:w-auto">
                        <PlayCircle className="h-4 w-4" /> {tokenResult.data.mode === 'teacher_quiz' ? 'Masuk Ruang Pengerjaan' : 'Mulai Kerjakan Ujian'}
                      </button>
                    </div>
                  ) : tokenResult.status === 'waiting' ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                      <div className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">Ruang Tunggu</p>
                          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{tokenResult.message}</p>
                          <p className="mt-1 text-xs text-slate-500">Silakan kembali pada jam tersebut atau tetap di halaman ini sampai ujian dibuka.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-rose-700">
                            {tokenResult.status === 'submitted' ? 'Sudah Dikerjakan'
                              : tokenResult.status === 'locked' ? 'Sesi Terkunci'
                              : tokenResult.status === 'expired' ? 'Sesi Berakhir'
                              : tokenResult.status === 'wrong_class' ? 'Kelas Tidak Sesuai'
                              : 'Token Ditolak'}
                          </p>
                          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{tokenResult.message}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* BARIS 2: 4 KARTU STATUS AKADEMIK */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Rata-rata Nilai',
            value: d?.report?.summary?.average != null ? `${d.report.summary.average}` : '-',
            // Predikat huruf (A/B/C/D) hanya muncul bila ada minimal 1 nilai riil;
            // selain itu tampilkan keterangan jujur "Belum ada nilai".
            sub: d?.report?.summary?.has_grades
              ? (d.report.summary.grade ? `Predikat ${d.report.summary.grade}` : 'Nilai akhir semester')
              : 'Belum ada nilai',
            icon: BarChart3,
            tint: 'bg-sky-50 border-sky-100',
            mark: 'text-sky-500/10',
            nav: 'report',
          },
          {
            label: 'Kehadiran',
            value: (d?.attendance?.summary?.weekly_percentage ?? null) !== null ? `${d.attendance.summary.weekly_percentage}%` : '-',
            sub: (d?.attendance?.summary?.weekly_total ?? 0) > 0 ? 'Minggu ini' : 'Belum ada presensi minggu ini',
            icon: CheckCircle2,
            tint: 'bg-emerald-50 border-emerald-100',
            mark: 'text-emerald-500/10',
            nav: 'kbm',
          },
          {
            label: 'Tugas Selesai',
            value: d?.evaluations?.summary ? `${d.evaluations.summary.completed}/${d.evaluations.summary.total}` : '-',
            sub: d?.evaluations?.summary ? `${d.evaluations.summary.percentage || 0}% tuntas` : 'Terkumpul & dinilai',
            icon: ClipboardList,
            tint: 'bg-amber-50 border-amber-100',
            mark: 'text-amber-500/10',
            nav: 'tasks',
          },
          {
            label: 'Peringkat Kelas',
            // Peringkat riil (rata-rata nilai + poin prestasi wali kelas) hanya valid
            // setelah rapor semester aktif DIPUBLIKASIKAN wali kelas (published_at != null).
            value: (d?.report?.summary?.rapor_published && d?.report?.summary?.rank != null) ? `#${d.report.summary.rank}` : '-',
            sub: (d?.report?.summary?.rapor_published && d?.report?.summary?.rank != null)
              ? `dari ${d.report.summary.total_students || '-'} siswa`
              : 'Menunggu publikasi rapor',
            icon: Trophy,
            tint: 'bg-violet-50 border-violet-100',
            mark: 'text-violet-500/10',
            nav: 'report',
          },
        ].map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className={`group relative flex flex-col items-center overflow-hidden rounded-2xl border p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${card.tint}`}
          >
            {/* Ikon watermark tipis di belakang tulisan */}
            <card.icon className={`pointer-events-none absolute -bottom-5 -right-4 h-28 w-28 ${card.mark} transition-transform duration-500 group-hover:scale-110`} />
            {/* Baris 1: judul (dibesarkan) */}
            <p className="relative text-base font-black uppercase tracking-wide text-slate-800">{card.label}</p>
            {/* Baris 2: nilai (tengah) */}
            <p className="relative mt-2 text-3xl font-black leading-none text-slate-900">{card.value}</p>
            {/* Baris 3: sub-label (tengah) */}
            <p className="relative mt-1.5 text-[11px] font-bold text-slate-400">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* BARIS 3: JADWAL PELAJARAN HARI INI */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><CalendarDays className="h-5 w-5" /></div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              Jadwal Pelajaran Hari Ini
            </h3>
          </div>
          <button
            onClick={() => onNavigate?.('kbm')}
            className="group inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-blue-600 active:text-blue-700"
          >
            Lihat Jadwal Lengkap
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
        <div className="p-4">
          {todaySessions.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Jam ke', 'Waktu', 'Mata Pelajaran', 'Guru Pengampu', 'Ruang'].map(col => (
                    <th key={col} className="pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 pr-6">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {todaySessions.slice(0, 5).map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-black text-slate-700 text-sm pr-6">{i + 1}</td>
                    <td className="py-3 font-bold text-slate-600 text-sm pr-6">{s.time}</td>
                    <td className="py-3 font-black text-slate-800 text-sm pr-6">{s.subject}</td>
                    <td className="py-3 font-bold text-slate-600 text-sm pr-6">{s.teacher || '-'}</td>
                    <td className="py-3 font-bold text-slate-500 text-sm">{s.room || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm font-bold text-slate-400 italic">
              Tidak ada jadwal hari ini. Selamat beristirahat!
            </p>
          )}
        </div>
      </div>

      {/* BARIS 4: REKAP NILAI (Preview) */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 p-2 text-sky-600"><BarChart3 className="h-5 w-5" /></div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              Rekap Nilai Semester
            </h3>
          </div>
          <button
            onClick={() => onNavigate?.('report')}
            className="group inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-blue-600 active:text-blue-700"
          >
            Lihat Seluruh Nilai
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
        <div className="p-4">
          {grades.length > 0 ? (
            <>
              <table className="w-full text-left">
                <thead>
                <tr className="border-b border-slate-100">
                  {['Mata Pelajaran', 'Nilai Harian', 'UTS', 'UAS', 'Akhir', 'Grade'].map((col, ci) => (
                    <th key={col} className={`pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 pr-4 ${ci === 0 ? 'text-left' : 'text-center'}`}>{col}</th>
                  ))}
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {grades.map((g, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-black text-slate-700 text-sm pr-4">{g.subject}</td>
                      <td className="py-3 font-bold text-slate-600 text-sm pr-4 text-center">{g.daily ?? '-'}</td>
                      <td className="py-3 font-bold text-slate-600 text-sm pr-4 text-center">{g.uts ?? '-'}</td>
                      <td className="py-3 font-bold text-slate-600 text-sm pr-4 text-center">{g.uas ?? '-'}</td>
                      <td className="py-3 font-black text-slate-900 text-sm pr-4 text-center">{g.average ?? '-'}</td>
                      <td className="py-3 text-center">
                        <NeonBadge tone={gradeColor(g.grade || g.status)}>{g.grade || g.status || '-'}</NeonBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="py-6 text-center text-sm font-bold text-slate-300 uppercase tracking-widest">Belum ada data nilai</p>
          )}
        </div>
      </div>

      {/* BARIS 5: TUGAS YANG BELUM DIKERJAKAN */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600"><ClipboardList className="h-5 w-5" /></div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              Tugas Yang Belum Dikerjakan
            </h3>
          </div>
          <button
            onClick={() => onNavigate?.('tasks')}
            className="group inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-blue-600 active:text-blue-700"
          >
            Lihat Semua Tugas
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
        <div className="p-4">
          {pendingTasks.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Mata Pelajaran', 'Judul Tugas', 'Deadline', 'Status', 'Aksi'].map(col => (
                    <th key={col} className="pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 pr-4">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pendingTasks.map((task, i) => {
                  const hari = daysUntil(task.deadline_at);
                  return (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-black text-slate-700 text-sm pr-4">{task.subject || '-'}</td>
                      <td className="py-3 font-bold text-slate-600 text-sm pr-4 max-w-[160px] truncate">{task.title}</td>
                      <td className="py-3 font-bold text-slate-600 text-sm pr-4">
                        {new Date(task.deadline_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${hari <= 2 ? 'bg-orange-100 text-[#F97316]' : 'bg-amber-100 text-amber-700'}`}>
                           H-{hari}
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => onNavigate?.('tasks')}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-amber-500/25 hover:brightness-105 active:scale-95 transition-all"
                        >
                          Kerjakan
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">Semua tugas sudah dikerjakan!</p>
            </div>
          )}
        </div>
      </div>

      {/* BARIS 6+7: KEHADIRAN & PENGUMUMAN - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Kolom Kiri: Rekap Kehadiran */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              Rekap Kehadiran · {bulanIni}
            </h3>
          </div>
          <button
            onClick={() => onNavigate?.('kbm')}
            className="group inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-blue-600 active:text-blue-700"
          >
            Lihat Detail Kehadiran
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
        <div className="p-6">
          {totalHari <= 1 && totalHadir === 0 && totalIzin === 0 && totalSakit === 0 && totalAlpha === 0 ? (
            <div className="py-6 text-center">
              <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">Belum ada data presensi pada {bulanIni}.</p>
              <p className="mt-1 text-xs font-medium text-slate-300">Rekap muncul setelah guru mengisi presensi.</p>
            </div>
          ) : (() => {
            const rows = [
              { abbr: 'H', label: 'Hadir', val: totalHadir, stroke: '#10B981', dot: 'bg-emerald-500', text: 'text-emerald-600' },
              { abbr: 'S', label: 'Sakit', val: totalSakit, stroke: '#FBBF24', dot: 'bg-amber-400', text: 'text-amber-600' },
              { abbr: 'I', label: 'Izin', val: totalIzin, stroke: '#0EA5E9', dot: 'bg-sky-500', text: 'text-sky-600' },
              { abbr: 'A', label: 'Alpha', val: totalAlpha, stroke: '#F43F5E', dot: 'bg-rose-500', text: 'text-rose-600' },
            ];
            const total = totalHadir + totalSakit + totalIzin + totalAlpha;
            const R = 42;
            const C = 2 * Math.PI * R;
            const pctHadir = total > 0 ? Math.round((totalHadir / total) * 100) : 0;
            let offsetAcc = 0;
            return (
              <div className="flex flex-col items-center gap-3 py-2">
                {/* Donut besar di tengah */}
                <div className="relative h-40 w-40 shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r={R} fill="none" stroke="#F1F5F9" strokeWidth="11" />
                    {total > 0 && rows.map((r) => {
                      if (!r.val) return null;
                      const frac = r.val / total;
                      const dash = frac * C;
                      const seg = (
                        <circle
                          key={r.abbr}
                          cx="50" cy="50" r={R}
                          fill="none"
                          stroke={r.stroke}
                          strokeWidth="11"
                          strokeDasharray={`${dash} ${C - dash}`}
                          strokeDashoffset={-offsetAcc}
                        />
                      );
                      offsetAcc += dash;
                      return seg;
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-slate-900 leading-none">{pctHadir}%</span>
                    <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Hadir</span>
                    <span className="mt-0.5 text-[9px] font-bold text-slate-300">{total} hari</span>
                  </div>
                </div>
                {/* Keterangan di bawah: warna = porsi di lingkaran */}
                <div className="flex items-stretch justify-center gap-5">
                  {rows.map((r) => (
                    <div key={r.abbr} className="flex flex-col items-center gap-0.5">
                      <span className={`text-xl font-black leading-none ${r.text}`}>{r.val}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
        </div>

        {/* Kolom Kanan: Kabar Terbaru (Agenda / Informasi) */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Header + tab */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-2 text-rose-600"><Megaphone className="h-5 w-5" /></div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Kabar Terbaru</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => selectKabarTab('agenda')}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${kabarTab === 'agenda' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Agenda
                {hasNewAgenda && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
              </button>
              <button
                type="button"
                onClick={() => selectKabarTab('informasi')}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${kabarTab === 'informasi' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Informasi
                {hasNewInfo && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
              </button>
            </div>
          </div>

          {/* Konten */}
          {kabarTab === 'agenda' ? (
            <div className="p-5">
              {agendaList.length > 0 ? (
                <div className="space-y-1">
                  {agendaList.map((ag) => (
                    <div key={ag.id} className="flex items-center group">
                      <span className="mr-3 font-black text-amber-500">•</span>
                      <div className="flex flex-grow items-center justify-between border-b border-slate-100 py-3 pr-1">
                        <p className="text-sm font-bold tracking-wide text-slate-700">
                          {ag.nama}
                          <span className="ml-3 font-medium text-slate-400">
                            {ag.tanggal ? new Date(ag.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                  <p className="text-sm font-bold text-slate-400">Belum ada agenda</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {localAnnouncements.length > 0 ? localAnnouncements.slice(0, 2).map((ann) => {
                const isUnread = ann.is_read === false;
                const excerpt = String(ann.content || '')
                  .replace(/<[^>]*>/g, ' ')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                const dateLabel = (ann.published_at || ann.created_at)
                  ? new Date(ann.published_at || ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                  : '-';
                return (
                  <button
                    key={ann.id}
                    onClick={() => openAnnouncement(ann)}
                    className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${isUnread ? 'border-rose-100 bg-rose-50/30' : 'border-slate-100 bg-white'}`}
                  >
                    {isUnread ? (
                      <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                      </span>
                    ) : (
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-200" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`truncate text-sm font-black transition-colors group-hover:text-blue-600 ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>{ann.title}</p>
                        {isUnread && <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">Baru</span>}
                      </div>
                      {excerpt && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{excerpt}</p>
                      )}
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <User className="h-3 w-3" />
                        <span className="font-bold tracking-wide text-slate-600">{formatAuthorText(ann)}</span>
                        <span>·</span>
                        <span>{dateLabel}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Eye className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:text-blue-600 group-hover:scale-110" />
                      {checkHasImage(ann) && (
                        <span className="inline-flex animate-pulse items-center justify-center p-1 text-blue-500 pointer-events-none select-none" title="Terdapat Lampiran Gambar">
                          <ImageIcon className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              }) : (
                <div className="py-6 text-center">
                  <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                  <p className="text-sm font-bold text-slate-400">Belum ada informasi</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETAIL PENGUMUMAN — dibuka di tempat, tanpa pindah halaman.
          Diportal ke document.body karena root dashboard ber-animasi transform
          (animate-fadeIn) yang membuat overlay fixed tidak menutupi viewport. */}
      {previewAnn && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => e.target === e.currentTarget && setPreviewAnn(null)}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md w-screen h-screen overflow-hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                  {previewAnn.category || 'Pengumuman'}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-semibold text-slate-500">
                  {(previewAnn.published_at || previewAnn.created_at)
                    ? new Date(previewAnn.published_at || previewAnn.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '-'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAnn(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Isi Pengumuman */}
            <div className="overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <h3 className="text-xl font-black text-slate-900 leading-snug">
                {previewAnn.title}
              </h3>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 pb-2 border-b border-slate-100">
                <User className="h-4 w-4 text-slate-400" />
                <span>Oleh: <strong className="text-slate-800">{formatAuthorText(previewAnn)}</strong></span>
              </div>

              {/* Teks Isi */}
              <div
                className="text-sm text-slate-700 leading-relaxed space-y-2 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewAnn.content || '<p class=\"text-slate-400 italic\">Pengumuman ini tidak memiliki isi.</p>' }}
              />

              {/* Lampiran Gambar */}
              {((Array.isArray(previewAnn.images) && previewAnn.images.length > 0) || previewAnn.image_url || previewAnn.image_path) && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-blue-600" /> Lampiran Gambar
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Array.isArray(previewAnn.images) && previewAnn.images.length > 0 ? (
                      previewAnn.images.map((img, i) => {
                        const imgUrl = typeof img === 'string' ? img : (img.url || img.path || '');
                        return (
                          <a key={i} href={imgUrl} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 block">
                            <img src={imgUrl} alt={'Lampiran ' + (i + 1)} className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300" />
                          </a>
                        );
                      })
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 col-span-full">
                        <img
                          src={previewAnn.image_url || ('http://localhost:8000/storage/' + previewAnn.image_path)}
                          alt="Lampiran"
                          className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lampiran Dokumen */}
              {previewAnn.attachment && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                        <FileDown className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-blue-600/60 uppercase tracking-widest block">Lampiran Dokumen</span>
                        <span className="text-sm font-bold text-slate-700">{previewAnn.attachment.name || 'Dokumen Terlampir'}</span>
                      </div>
                    </div>
                    <a
                      href={previewAnn.attachment.url || previewAnn.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                    >
                      Buka File
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                onClick={() => { setPreviewAnn(null); onNavigate?.('news'); }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
              >
                Buka di Pusat Informasi <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewAnn(null)}
                className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-bold text-white hover:bg-slate-900 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL EDIT PROFIL dihapus permanen: identitas murid kini read-only. */}
    </div>
  );
}

// ── Meta status & filter untuk tab Tugas & Ujian Murid ──
const TASK_STATUS_META = {
  belum_dikumpulkan: { label: 'Belum Dikerjakan', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  dikumpul: { label: 'Sedang Berlangsung', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  dinilai: { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  terlambat: { label: 'Terlambat', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};
const TASK_DONE_STATUSES = ['dikumpul', 'dinilai', 'terlambat'];
const TASK_FILTERS = [
  { key: 'semua', label: 'Semua' },
  { key: 'tugas', label: 'Tugas Harian' },
  { key: 'ujian', label: 'Ujian CBT' },
  { key: 'selesai', label: 'Selesai' },
];

function TasksTab({ d, theme, onSubmitted, onRefresh, activeExamSessions = [], onStartExam, clock, onOpenTeacherQuiz }) {
  const tasks = d?.evaluations?.upload_tasks || [];
  const exams = activeExamSessions || [];
  const [filter, setFilter] = useState('semua');
  const [mapelFilter, setMapelFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [answer, setAnswer] = useState('');
  const [quizAnswers, setQuizAnswers] = useState({});
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  // ── Panel "Masuk Ruang Ujian (Input Token)" ──
  const [tokenInput, setTokenInput] = useState('');
  const [tokenChecking, setTokenChecking] = useState(false);
  const [tokenResult, setTokenResult] = useState(null); // { status, message, data }
  const tokenInputRef = useRef(null);

  // Fokus ke input token saat diminta (dari kartu pintasan Beranda).
  useEffect(() => {
    const focus = () => {
      if (tokenInputRef.current) {
        tokenInputRef.current.focus();
        tokenInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    window.addEventListener('focusExamToken', focus);
    return () => window.removeEventListener('focusExamToken', focus);
  }, []);

  // Bersihkan banner token saat modal instruksi/ruang ujian ditutup atau sesi selesai,
  // supaya tidak ada sisa notifikasi "Mulai Kerjakan" / tombol menggantung.
  useEffect(() => {
    const clear = () => { setTokenInput(''); setTokenResult(null); };
    window.addEventListener('clearExamToken', clear);
    return () => window.removeEventListener('clearExamToken', clear);
  }, []);

  const checkToken = async (event) => {
    event?.preventDefault?.();
    const code = tokenInput.replace(/\s/g, '').toUpperCase();
    if (code.length !== 8 && code.length !== 6) {
      setTokenResult({ status: 'invalid', message: 'Token harus 8 karakter (ujian resmi) atau 6 karakter (kuis guru).', data: null });
      return;
    }
    setTokenChecking(true);
    setTokenResult(null);
    try {
      const res = await examSessionAPI.checkStudentToken({ token: code });
      setTokenResult(res.data);
    } catch (err) {
      // 422 (mis. "sudah menyelesaikan") tetap membawa status granular di body → pakai agar
      // banner "Sudah Dikerjakan" tetap tampil, bukan fallback generik.
      const payload = err?.response?.data;
      setTokenResult({
        status: payload?.status || 'invalid',
        message: payload?.message || 'Gagal memeriksa token. Periksa koneksi lalu coba lagi.',
        data: payload?.data ?? null,
      });
    } finally {
      setTokenChecking(false);
    }
  };

  const startFromToken = () => {
    if (tokenResult?.status === 'ready' && tokenResult?.data) {
      if (tokenResult.data.mode === 'teacher_quiz') onOpenTeacherQuiz?.(tokenResult.data);
      else onStartExam?.(tokenResult.data, tokenResult.data.exam_code);
      // Bersihkan seketika saat memicu buka modal: kosongkan kolom token + tutup banner
      // hijau "Mulai Kerjakan"; tombol "Cek & Masuk" kembali nonaktif (input 0 karakter).
      setTokenInput('');
      setTokenResult(null);
    }
  };

  // Daftar mapel kelas siswa (union jadwal + tugas + ujian) — sumber nyata, bukan karangan.
  const mapelOptions = (() => {
    const set = new Set();
    (d?.schedule?.days || []).forEach((day) => (day.classes || []).forEach((c) => c.subject && set.add(c.subject)));
    tasks.forEach((t) => t.subject && set.add(t.subject));
    exams.forEach((e) => e.mapel && set.add(e.mapel));
    return Array.from(set).sort();
  })();

  const openDetail = (task) => {
    // Sesi kuis guru CBT/Esai hanya boleh lewat 1-pintu token (menjaga rule: nilai/poin
    // guru TIDAK menimpa rapor). Arahkan murid ke kotak token.
    if (['cbt_docx', 'esai_pdf'].includes(task.mode_soal)) {
      window.dispatchEvent(new Event('focusExamToken'));
      window.dispatchEvent(new CustomEvent('dashboardToast', { detail: { message: 'Gunakan token 6 karakter di kotak "Masuk Ruang Ujian" untuk mengerjakan sesi ini.', type: 'info' } }));
      return;
    }
    setActiveTask(task); setAnswer(task.my_answer || ''); setQuizAnswers({}); setFile(null); setFeedback('');
  };

  const doRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    onRefresh?.();
    window.setTimeout(() => setRefreshing(false), 700);
  };


  const submit = async (event) => {
    event.preventDefault();
    if (!activeTask) return;
    const payload = new FormData();
    const isQuiz = Array.isArray(activeTask.questions) && activeTask.questions.length > 0;
    if (isQuiz) Object.entries(quizAnswers).forEach(([questionId, choice]) => payload.append(`answers[${questionId}]`, choice));
    else if (answer.trim()) payload.append('jawaban', answer.trim());
    if (file) payload.append('lampiran', file);
    setSaving(true);
    setFeedback('');
    try {
      await studentAPI.submitTask(activeTask.id, payload);
      setActiveTask(null);
      setAnswer('');
      setQuizAnswers({});
      setFile(null);
      onSubmitted?.();
      window.dispatchEvent(new CustomEvent('dashboardToast', { detail: { message: 'Tugas berhasil dikumpulkan.', type: 'success' } }));
    } catch (error) {
      setFeedback(error.response?.data?.message || 'Tugas gagal dikumpulkan.');
    } finally {
      setSaving(false);
    }
  };

  const pendingTasks = tasks.filter((t) => t.status === 'belum_dikumpulkan');
  const doneTasks = tasks.filter((t) => TASK_DONE_STATUSES.includes(t.status));
  // Filter mapel diterapkan ke daftar yang ditampilkan (KPI di atas tetap menyeluruh).
  const tasksByMapel = tasks.filter((t) => mapelFilter === 'all' || t.subject === mapelFilter);
  const examsByMapel = exams.filter((e) => mapelFilter === 'all' || e.mapel === mapelFilter);
  const showExams = filter === 'semua' || filter === 'ujian';
  const showTasks = filter === 'semua' || filter === 'tugas' || filter === 'selesai';
  const visibleTasks = filter === 'selesai' ? tasksByMapel.filter((t) => TASK_DONE_STATUSES.includes(t.status)) : tasksByMapel;
  const isEmpty = (!showExams || examsByMapel.length === 0) && (!showTasks || visibleTasks.length === 0);

  // Esc menutup modal detail tugas (kecuali sedang mengirim).
  useEscapeKey(!!activeTask, () => { if (!saving) setActiveTask(null); });

  return (
    <div className="space-y-5">
      {/* HERO — gaya sama dengan KBM & Presensi + jam real-time */}
      <div className="relative overflow-hidden rounded-[3rem] border border-blue-100 bg-white p-8 text-slate-900 shadow-xl xl:p-12">
        <div className="absolute right-0 top-0 h-full w-[45%] rounded-full bg-gradient-to-l from-[#0ea5e9] via-[#0284c7] to-[#0369a1] opacity-20 blur-[120px]"></div>
        <div className="absolute left-0 top-0 h-full w-[35%] rounded-full bg-gradient-to-r from-[#0ea5e9] via-[#0284c7] to-[#0369a1] opacity-10 blur-[100px]"></div>
        <div className="relative flex flex-col items-start justify-between gap-6 text-left md:flex-row md:items-center">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
              <GraduationCap className="h-3 w-3" /> Portal Students Authority
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Tugas &amp; Ujian</h1>
            <p className="mt-2 max-w-2xl text-base font-normal leading-relaxed text-slate-500">
              Kumpulkan tugas harian dan ikuti ujian CBT resmi dalam satu tempat untuk Murid.
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

      {/* PANEL MASUK RUANG UJIAN (INPUT TOKEN) — paling atas, di atas daftar tugas/kuis/ujian */}
      <div className="relative max-w-lg overflow-hidden rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
        <div className="absolute right-0 top-0 h-full w-[38%] rounded-full bg-gradient-to-l from-indigo-500 via-blue-600 to-sky-500 opacity-10 blur-[90px]"></div>
        <div className="relative">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/25"><KeyRound className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-black uppercase leading-tight tracking-tight text-slate-900">Masuk Ruang Ujian (Input Token)</h2>
              <p className="text-xs font-medium text-slate-500">Masukkan token 8 karakter untuk ujian resmi, atau <strong>6 karakter</strong> untuk kuis/esai guru.<br />(Ujian resmi: Simulasi, UTS, UAS, Praktik, USP, Remedial).</p>
            </div>
          </div>
          <form onSubmit={checkToken} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={tokenInputRef}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8))}
              maxLength={8}
              placeholder="Contoh: YB-20OZB"
              aria-label="Kode token ujian"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-center text-xl font-black uppercase tracking-[0.35em] text-slate-800 outline-none transition-all hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 sm:max-w-[240px]"
            />
            <button
              type="submit"
              disabled={tokenChecking || (tokenInput.length !== 8 && tokenInput.length !== 6)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-600/20 transition-all hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" /> {tokenChecking ? 'Memeriksa…' : 'Cek & Masuk Ujian'}
            </button>
          </form>

          {tokenResult && (
            <div className="mt-4">
              {tokenResult.status === 'ready' && tokenResult.data ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Token Valid — Siap Mengerjakan</p>
                  <h3 className="mt-1 text-lg font-black uppercase leading-tight tracking-tight text-slate-900">{tokenResult.data.nama || 'Ujian'}</h3>
                  <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    <p className="text-slate-600"><span className="font-black text-slate-800">Mata Pelajaran:</span> {tokenResult.data.mapel || '-'}</p>
                    <p className="text-slate-600"><span className="font-black text-slate-800">Jenis:</span> {tokenResult.data.mode === 'teacher_quiz' ? (tokenResult.data.mode_soal === 'esai_pdf' ? 'Esai (Lembar PDF)' : 'Kuis CBT Pilihan Ganda') : (tokenResult.data.jenis || 'Ujian')}</p>
                    <p className="text-slate-600"><span className="font-black text-slate-800">Durasi:</span> {tokenResult.data.duration_minutes ? `${tokenResult.data.duration_minutes} Menit` : '-'}</p>
                    <p className="text-slate-600"><span className="font-black text-slate-800">Kelas:</span> {tokenResult.data.target || '-'}</p>
                  </div>
                  {tokenResult.data.resume ? (
                    <p className="mt-2 text-xs font-bold text-amber-700">Anda memiliki sesi yang belum selesai, melanjutkan dengan timer yang tersisa.</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={startFromToken}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 transition-all hover:brightness-105 active:scale-95 sm:w-auto"
                  >
                    <PlayCircle className="h-4 w-4" /> {tokenResult.data.mode === 'teacher_quiz' ? 'Masuk Ruang Pengerjaan' : 'Mulai Kerjakan Ujian'}
                  </button>
                </div>
              ) : tokenResult.status === 'waiting' ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">Ruang Tunggu</p>
                      <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{tokenResult.message}</p>
                      <p className="mt-1 text-xs text-slate-500">Silakan kembali pada jam tersebut atau tetap di halaman ini sampai ujian dibuka.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-rose-700">
                        {tokenResult.status === 'submitted' ? 'Sudah Dikerjakan'
                          : tokenResult.status === 'locked' ? 'Sesi Terkunci'
                          : tokenResult.status === 'expired' ? 'Sesi Berakhir'
                          : tokenResult.status === 'wrong_class' ? 'Kelas Tidak Sesuai'
                          : 'Token Ditolak'}
                      </p>
                      <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{tokenResult.message}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4 KARTU METRIK (data real) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Tugas Tertunda', value: pendingTasks.length, icon: ClipboardList, tint: 'bg-amber-50 border-amber-100', mark: 'text-amber-500/10' },
          { label: 'Ujian Aktif', value: exams.length, icon: PlayCircle, tint: 'bg-orange-50 border-orange-100', mark: 'text-orange-500/10' },
          { label: 'Tugas Selesai', value: doneTasks.length, icon: CheckCircle2, tint: 'bg-emerald-50 border-emerald-100', mark: 'text-emerald-500/10' },
          { label: 'Total Poin Keaktifan', value: (tasks.find((t) => t.total_poin != null)?.total_poin ?? 0), icon: Award, tint: 'bg-violet-50 border-violet-100', mark: 'text-violet-500/10' },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.35 }}
            className={`group relative flex items-center gap-4 overflow-hidden rounded-xl border p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${m.tint}`}>
            <m.icon className={`pointer-events-none absolute -bottom-4 -right-3 h-24 w-24 ${m.mark} transition-transform duration-500 group-hover:scale-110`} />
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
              <m.icon className="h-6 w-6 text-slate-700" />
            </div>
            <div>
              <p className="text-3xl font-black leading-none text-slate-900">{m.value}</p>
              <p className="mt-1 text-[11px] font-black uppercase tracking-widest text-slate-500">{m.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* FILTER: pill status + dropdown mapel + tombol segarkan */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TASK_FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all ${filter === f.key ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-600'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={mapelFilter} onChange={(e) => setMapelFilter(e.target.value)} className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600 outline-none focus:border-sky-400">
            <option value="all">Semua Mata Pelajaran</option>
            {mapelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button type="button" onClick={doRefresh} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600 transition-all hover:border-violet-300 hover:text-violet-600 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>
      </div>

      {/* KONTEN TERFILTER */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {showExams && examsByMapel.map((session, i) => (
          <motion.div key={`exam-${session.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }}
            className="flex h-full flex-col rounded-xl border border-amber-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{session.mapel || 'Ujian'}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700"><PlayCircle className="h-3 w-3" /> CBT / Ujian Resmi</span>
            </div>
            <h4 className="text-lg font-black uppercase leading-tight tracking-tight text-slate-900">{session.nama}</h4>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{session.target || 'Semua kelas'}</p>
            <div className="mt-3 flex-1">
              {session.end_time && (
                <p className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-orange-700">
                  <Clock className="h-3.5 w-3.5" /> Berakhir {new Date(session.end_time).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <button onClick={() => onStartExam?.(session)} className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-amber-500/25 transition-all hover:brightness-105 active:scale-95">Mulai Ujian</button>
            </div>
          </motion.div>
        ))}

        {showTasks && visibleTasks.map((task, i) => {
          const st = TASK_STATUS_META[task.status] || TASK_STATUS_META.belum_dikumpulkan;
          const isDone = TASK_DONE_STATUSES.includes(task.status);
          return (
            <motion.div key={task.id} onClick={() => openDetail(task)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }}
              className="flex h-full cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700">{task.subject || 'Tugas'}</span>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${st.cls}`}>{st.label}</span>
              </div>
              <h4 className="text-lg font-black uppercase leading-tight tracking-tight text-slate-900">{task.title}</h4>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{task.class_name}</p>
              <div className="mt-3 flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Instruksi</p>
                <p className="mt-1 line-clamp-3 text-xs font-medium leading-relaxed text-slate-600">{task.description || 'Kumpulkan jawaban sebelum tenggat.'}</p>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-500">
                <Clock className="h-3.5 w-3.5" /> {task.deadline_at ? new Date(task.deadline_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Tanpa tenggat'}
              </div>
              <div className="mt-auto pt-4">
                {isDone ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {task.status === 'dinilai' && <span className="text-xs font-bold text-emerald-700">Nilai: {task.score ?? '-'}</span>}
                    {task.tampilkan_nilai && task.trophy_tier && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700 ring-1 ring-amber-200">
                        <span>{{ gold: '🏆', silver: '🥈', bronze: '🥉', certificate: '🎖️' }[task.trophy_tier] || '🎖️'}</span>
                        {task.rank != null ? `Peringkat ${task.rank}` : 'Selesai'}
                      </span>
                    )}
                    {task.poin_diperoleh > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase text-violet-700 ring-1 ring-violet-200"><Award className="h-3 w-3" /> +{task.poin_diperoleh} Poin</span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Terkirim</span>
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); openDetail(task); }} className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition-all hover:from-sky-600 hover:to-blue-700 active:scale-95">{['cbt_docx', 'esai_pdf'].includes(task.mode_soal) ? 'Masuk via Token' : (task.questions?.length ? 'Mulai Kuis' : 'Kumpulkan')}</button>
                )}
              </div>
            </motion.div>
          );
        })}

        {isEmpty && (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <BadgeCheck className="mx-auto mb-4 h-16 w-16 text-slate-300" />
            <p className="text-xl font-black text-slate-700">Belum ada yang ditampilkan</p>
            <p className="mt-2 text-sm text-slate-500">Tugas dan ujian resmi dari guru untuk Murid akan muncul di sini.</p>
          </div>
        )}
      </div>
      {activeTask && createPortal(
        <AnimatePresence>
          <motion.div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setActiveTask(null); }}>
            <motion.form onSubmit={submit} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              {/* Header gradien + Esc/X */}
              <div className="relative overflow-hidden bg-gradient-to-r from-[#0ea5e9] via-[#0284c7] to-[#0369a1] px-6 py-5 text-white">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">{activeTask.subject || 'Tugas'}</p>
                <h3 className="mt-1 text-xl font-black leading-tight">{activeTask.title}</h3>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-white/85">
                  <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {activeTask.teacher || 'Guru'}</span>
                  {activeTask.class_name && <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> {activeTask.class_name}</span>}
                </p>
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <span className="select-none text-[13px] font-bold text-white/70">Esc</span>
                  <button type="button" onClick={() => !saving && setActiveTask(null)} aria-label="Tutup" className="text-white/80 transition-colors hover:text-rose-200"><X className="h-5 w-5" /></button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {/* Tenggat + badge */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-600"><Clock className="h-3.5 w-3.5" /> Tenggat: {activeTask.deadline_at ? new Date(activeTask.deadline_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Tanpa tenggat'}</span>
                  {activeTask.deadline_at && new Date(activeTask.deadline_at) < new Date()
                    ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-rose-600 ring-1 ring-rose-200"><AlertTriangle className="h-3.5 w-3.5" /> Terlambat</span>
                    : <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-600 ring-1 ring-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" /> Tepat Waktu</span>}
                  {activeTask.duration_minutes ? <span className="text-[11px] font-bold text-slate-400">Durasi {activeTask.duration_minutes} menit</span> : null}
                </div>

                {/* Deskripsi */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Instruksi / Deskripsi</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{activeTask.description || 'Kumpulkan jawaban sebelum tenggat.'}</p>
                </div>

                {/* Lampiran soal dari guru */}
                {activeTask.teacher_attachment_url && (
                  <a href={activeTask.teacher_attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Paperclip className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lampiran Soal dari Guru</p><p className="truncate text-sm font-bold text-slate-700">{activeTask.teacher_attachment_name || 'Berkas'}</p></div>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white"><Download className="h-3.5 w-3.5" /> Unduh</span>
                  </a>
                )}

                {/* Skor + catatan guru bila sudah dinilai */}
                {activeTask.status === 'dinilai' && (
                  <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Skor Nilai</p>
                      <p className="text-3xl font-black text-emerald-700">{activeTask.score ?? '-'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catatan Evaluasi Guru</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{activeTask.feedback || 'Tidak ada catatan tambahan dari guru.'}</p>
                    </div>
                  </div>
                )}

                {/* Riwayat pengumpulan sendiri */}
                {activeTask.status !== 'belum_dikumpulkan' && (
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Terkumpul {activeTask.submitted_at ? new Date(activeTask.submitted_at).toLocaleString('id-ID') : ''}{activeTask.attachment_name ? ` · ${activeTask.attachment_name}` : ''}</p>
                )}

                {/* Form (hanya bila belum dinilai) */}
                {activeTask.status !== 'dinilai' && (activeTask.questions?.length ? (
                  <div className="space-y-3">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">Jawab semua soal berikut</p>
                    {activeTask.questions.map((question, index) => (
                      <fieldset key={question.id} className="rounded-2xl border border-slate-200 p-4">
                        <legend className="px-1 text-sm font-extrabold text-slate-800">Soal {question.number || index + 1}</legend>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{question.text}</p>
                        {question.image_url && <img src={question.image_url} alt="Ilustrasi soal" className="mt-3 max-h-64 rounded-xl object-contain" />}
                        <div className="mt-3 space-y-2">{Object.entries(question.options || {}).map(([key, value]) => (
                          <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${quizAnswers[question.id] === key ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input required type="radio" name={`question-${question.id}`} value={key} checked={quizAnswers[question.id] === key} onChange={() => setQuizAnswers((c) => ({ ...c, [question.id]: key }))} className="mt-0.5 accent-emerald-600" />
                            <span><b>{key}.</b> {value}</span>
                          </label>
                        ))}</div>
                      </fieldset>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">Jawaban / Catatan Siswa
                      <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-400" placeholder="Tuliskan jawaban atau catatan untuk guru" />
                    </label>
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Berkas Jawaban (PDF, Word, atau gambar)</span>
                      <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-emerald-300">
                        <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => { const f = event.target.files?.[0] || null; if (f && f.size > 10 * 1024 * 1024) { window.dispatchEvent(new CustomEvent('dashboardToast', { detail: { message: `Ukuran file melebihi 10 MB (${(f.size / 1048576).toFixed(1)} MB).`, type: 'error' } })); event.target.value = ''; return; } setFile(f); }} className="hidden" />
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700"><UploadCloud className="h-3.5 w-3.5" /> Pilih berkas</span>
                        <span className="truncate text-xs font-bold text-slate-500">{file ? file.name : 'Belum ada file dipilih'}</span>
                      </label>
                    </div>
                  </div>
                ))}

                {feedback && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{feedback}</p>}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button type="button" onClick={() => !saving && setActiveTask(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Tutup</button>
                {activeTask.status !== 'dinilai' && (
                  <button type="submit" disabled={saving || (activeTask.questions?.length ? Object.keys(quizAnswers).length !== activeTask.questions.length : (!answer.trim() && !file))} className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-500/25 disabled:opacity-50">{saving ? 'Mengirim…' : activeTask.questions?.length ? 'Kirim Jawaban Kuis' : 'Kirim Tugas'}</button>
                )}
              </div>
            </motion.form>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

const BILLING_STATUS = {
  belum_bayar: { label: 'Belum Bayar', tone: 'amber' },
  proses_verifikasi: { label: 'Menunggu Verifikasi', tone: 'sky' },
  lunas: { label: 'Lunas', tone: 'emerald' },
  ditolak: { label: 'Ditolak', tone: 'rose' },
  dibatalkan: { label: 'Dibatalkan', tone: 'slate' },
};

function FinanceTab({ d, onConfirmed, onRefresh }) {
  const items = d?.billing?.items || [];
  const summary = d?.billing?.summary || {};
  const profile = d?.profile || {};

  const [school, setSchool] = useState(null);
  const [filter, setFilter] = useState('semua');
  const [jenis, setJenis] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState(null); // modal bayar / unggah bukti
  const [detail, setDetail] = useState(null); // modal detail & kuitansi
  const [form, setForm] = useState({ amount: '', payment_date: '', note: '', file: null });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewMeta, setPreviewMeta] = useState({ title: 'Pratinjau PDF', downloadLabel: 'Unduh PDF' });
  const [clock, setClock] = useState({ time: '', day: '', date: '' });

  // Jam WIB berjalan (identik hero Tugas & Ujian).
  useEffect(() => {
    const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const tick = () => {
      const wib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const pad = (n) => String(n).padStart(2, '0');
      setClock({ time: `${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())}`, day: DAYS_ID[wib.getDay()], date: `${wib.getDate()} ${MONTHS_ID[wib.getMonth()]} ${wib.getFullYear()}` });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Profil sekolah + rekening dari DB (null → empty-state jujur).
  useEffect(() => {
    let alive = true;
    schoolAPI.getProfile().then((r) => { if (alive) setSchool(r.data?.data || {}); }).catch(() => { if (alive) setSchool({}); });
    return () => { alive = false; };
  }, []);

  // Kunci scroll + Esc utk modal.
  useEffect(() => {
    if (!target && !detail && !preview) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [target, detail, preview]);
  useEscapeKey(!!target && !busy, () => setTarget(null));
  useEscapeKey(!!detail, () => setDetail(null));

  const categories = Array.from(new Set(items.map((it) => it.category).filter(Boolean))).sort();

  const buckets = (() => {
    const paid = items.reduce((a, it) => a + (Number(it.paid_amount) || 0), 0);
    const verify = items.filter((it) => it.status === 'proses_verifikasi').reduce((a, it) => a + (Number(it.remaining_amount) || 0), 0);
    const unpaid = items.filter((it) => ['belum_bayar', 'ditolak', 'dibatalkan'].includes(it.status)).reduce((a, it) => a + (Number(it.remaining_amount) || 0), 0);
    return { paid, verify, unpaid, total: paid + verify + unpaid };
  })();

  const filtered = items.filter((it) => {
    if (filter === 'belum' && it.status !== 'belum_bayar') return false;
    if (filter === 'verifikasi' && it.status !== 'proses_verifikasi') return false;
    if (filter === 'lunas' && it.status !== 'lunas') return false;
    if (jenis !== 'all' && it.category !== jenis) return false;
    return true;
  });

  const toastMsg = (message, type = 'success') => window.dispatchEvent(new CustomEvent('dashboardToast', { detail: { message, type } }));

  const openPay = (item) => {
    setMsg('');
    const sisa = Math.round(Number(item.remaining_amount) || Number(item.amount) || 0);
    setForm({ amount: sisa ? String(sisa) : '', payment_date: new Date().toISOString().slice(0, 10), note: '', file: null });
    setTarget(item);
  };

  const submitPay = async (event) => {
    event.preventDefault();
    if (!form.file) { setMsg('Bukti transfer wajib dilampirkan.'); return; }
    setBusy(true); setMsg('');
    const fd = new FormData();
    fd.append('bill_code', target.bill_code);
    fd.append('bill_label', target.title || target.bill_code);
    fd.append('amount', form.amount || '0');
    fd.append('payment_date', form.payment_date);
    fd.append('catatan', form.note || '');
    fd.append('file', form.file);
    try {
      await studentAPI.confirmPayment(fd);
      setTarget(null);
      onConfirmed?.();
      toastMsg('Bukti pembayaran terkirim, menunggu verifikasi kasir.');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Konfirmasi gagal dikirim. Periksa kembali berkas dan data.');
    } finally {
      setBusy(false);
    }
  };

  const doRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    onRefresh?.();
    window.setTimeout(() => setRefreshing(false), 700);
  };

  const downloadKuitansi = async (item) => {
    try {
      const p = await previewKuitansiPDF({ student: profile, item, school: school || {} });
      if (p) { setPreview(p); setPreviewMeta({ title: 'Pratinjau Kuitansi', downloadLabel: 'Unduh Kuitansi PDF' }); }
    } catch { /* toast ditangani util */ }
  };

  const cetakRekap = async () => {
    try {
      const p = await previewRekapKeuanganPDF({ student: profile, items, summary, school: school || {} });
      if (p) { setPreview(p); setPreviewMeta({ title: 'Pratinjau Rekap Keuangan', downloadLabel: 'Unduh Rekap PDF' }); }
    } catch { /* toast ditangani util */ }
  };

  const copyRekening = () => {
    const acc = school?.finance_account_number;
    if (!acc) return;
    navigator.clipboard?.writeText(String(acc)).then(() => toastMsg('Nomor rekening disalin.')).catch(() => toastMsg('Gagal menyalin.', 'error'));
  };

  const hasRekening = !!(school && (school.finance_account_number || school.finance_bank_name));
  const channels = (school?.finance_payment_channels || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);

  const isOverdue = (it) => it.due_date && it.status !== 'lunas' && new Date(it.due_date) < new Date();

  return (
    <div className="space-y-6">
      {/* HERO — identik Tugas & Ujian */}
      <div className="relative overflow-hidden rounded-[3rem] border border-blue-100 bg-white p-8 text-slate-900 shadow-xl xl:p-12">
        <div className="absolute right-0 top-0 h-full w-[45%] rounded-full bg-gradient-to-l from-[#0ea5e9] via-[#0284c7] to-[#0369a1] opacity-20 blur-[120px]"></div>
        <div className="absolute left-0 top-0 h-full w-[35%] rounded-full bg-gradient-to-r from-[#0ea5e9] via-[#0284c7] to-[#0369a1] opacity-10 blur-[100px]"></div>
        <div className="relative flex flex-col items-start justify-between gap-6 text-left md:flex-row md:items-center">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
              <GraduationCap className="h-3 w-3" /> Portal Students Authority
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Keuangan &amp; Administrasi</h1>
            <p className="mt-2 max-w-3xl text-base font-normal text-slate-500">
              Pantau tagihan, unggah bukti bayar, dan unduh kuitansi resmi.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 rounded-2xl border border-gray-100 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-widest text-slate-700">{clock.day},</span>
              <span className="text-xs font-bold text-slate-500">{clock.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-lg font-black tabular-nums tracking-widest text-slate-700">{clock.time}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">WIB</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 KPI CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceKpi icon={Wallet} label="Tagihan Aktif"
          value={`${summary.pending_count || 0}`} sub={`${formatCurrency(summary.pending_amount || 0)} menunggu pembayaran`}
          theme={{
            card: 'from-amber-50/90 via-white to-orange-50/50 border-amber-200/70',
            glow: 'bg-amber-200/50',
            watermark: 'text-amber-500 opacity-[0.07]',
            iconBox: 'from-amber-100 to-amber-50 text-amber-700',
            pill: 'border-amber-200 bg-amber-50/80 text-amber-700',
            pillDot: 'bg-amber-500',
            pillText: 'Belum Bayar',
          }} />
        <FinanceKpi icon={TimerReset} label="Menunggu Verifikasi"
          value={`${summary.verification_count || 0}`} sub={`${formatCurrency(summary.verification_amount || 0)} dalam proses`}
          theme={{
            card: 'from-sky-50/90 via-white to-blue-50/50 border-sky-200/70',
            glow: 'bg-sky-200/50',
            watermark: 'text-sky-500 opacity-[0.07]',
            iconBox: 'from-sky-100 to-sky-50 text-sky-700',
            pill: 'border-sky-200 bg-sky-50/80 text-sky-700',
            pillDot: 'bg-sky-500',
            pillText: 'Diproses',
          }} />
        <FinanceKpi icon={Receipt} label="Sudah Lunas"
          value={`${summary.lunas_count || 0}`} sub={`${formatCurrency(summary.paid_total || 0)} terbayar`}
          theme={{
            card: 'from-emerald-50/90 via-white to-teal-50/50 border-emerald-200/70',
            glow: 'bg-emerald-200/50',
            watermark: 'text-emerald-500 opacity-[0.07]',
            iconBox: 'from-emerald-100 to-emerald-50 text-emerald-700',
            pill: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
            pillDot: 'bg-emerald-500',
            pillText: 'Selesai',
          }} />
        <FinanceKpi icon={TrendingUp} label="Progres Pelunasan"
          value={`${summary.progress_percentage || 0}%`} progress={summary.progress_percentage || 0} sub="dari total tagihan"
          theme={{
            card: 'from-blue-50/90 via-white to-indigo-50/50 border-indigo-200/70',
            glow: 'bg-indigo-200/50',
            watermark: 'text-indigo-500 opacity-[0.07]',
            iconBox: 'from-indigo-100 to-indigo-50 text-indigo-700',
            bar: 'from-sky-500 to-indigo-600',
            pill: 'border-indigo-200 bg-indigo-50/80 text-indigo-700',
            pillDot: 'bg-indigo-500',
            pillText: 'Akumulasi',
          }} />
      </div>

      {/* GRAFIK + REKENING */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700"><BarChart3 className="h-4 w-4 text-sky-600" /> Ringkasan Keuangan</h3>
          {buckets.total > 0 ? (
            <DonutChart total={buckets.total} segments={[
              { key: 'lunas', label: 'Lunas', value: buckets.paid, color: '#10B981' },
              { key: 'verify', label: 'Menunggu Verifikasi', value: buckets.verify, color: '#0EA5E9' },
              { key: 'unpaid', label: 'Belum Bayar', value: buckets.unpaid, color: '#F59E0B' },
            ]} />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 rounded-2xl bg-slate-50 p-4 text-slate-300"><BarChart3 className="h-8 w-8" /></div>
              <p className="text-sm font-black text-slate-500">Belum ada tagihan</p>
              <p className="mt-1 text-xs font-medium text-slate-400">Grafik muncul saat ada tagihan terdaftar untuk Anda.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700"><Landmark className="h-4 w-4 text-indigo-600" /> Kanal &amp; Rekening Pembayaran</h3>
          {hasRekening ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bank / Kanal</p>
                <p className="text-sm font-black text-slate-800">{school.finance_bank_name || '-'}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Nomor Rekening</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-lg font-black tabular-nums text-slate-900">{school.finance_account_number || '-'}</p>
                  {school.finance_account_number && (
                    <button type="button" onClick={copyRekening} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 transition hover:border-blue-300 hover:text-blue-600">
                      <Copy className="h-3.5 w-3.5" /> Salin
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Atas Nama</p>
                <p className="text-sm font-bold text-slate-700">{school.finance_account_holder || '-'}</p>
              </div>
              {channels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {channels.map((c, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700">{c}</span>)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-500">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
              <p>Belum ada informasi rekening/kanal pembayaran yang dikonfigurasi sekolah. Silakan hubungi bagian keuangan untuk detail pembayaran.</p>
            </div>
          )}
        </div>
      </div>

      {/* TOOLBAR + DAFTAR TAGIHAN */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap gap-2">
            {[{ id: 'semua', label: 'Semua' }, { id: 'belum', label: 'Belum Bayar' }, { id: 'verifikasi', label: 'Menunggu Verifikasi' }, { id: 'lunas', label: 'Lunas' }].map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                className={`rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all ${filter === f.id ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-600'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="appearance-none rounded-full border border-slate-200 bg-white py-1.5 pl-4 pr-9 text-[11px] font-black uppercase tracking-wider text-slate-600 outline-none focus:border-sky-400">
                <option value="all">Semua Jenis Tagihan</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
            <button type="button" onClick={doRefresh} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600 transition hover:border-violet-300 hover:text-violet-600 disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Segarkan
            </button>
            <button type="button" onClick={cetakRekap} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md hover:brightness-110 active:scale-95">
              <Printer className="h-3.5 w-3.5" /> Cetak Rekap Keuangan (PDF)
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {filtered.length === 0 ? (
            <div className="py-14 text-center">
              <BadgeCheck className="mx-auto mb-3 h-12 w-12 text-slate-200" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-400">{items.length === 0 ? 'Tidak ada tagihan' : 'Tidak ada tagihan pada filter ini'}</p>
            </div>
          ) : filtered.map((item, i) => {
            const st = BILLING_STATUS[item.status] || { label: item.status || '-', tone: 'slate' };
            return (
              <div key={item.bill_code || i} className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition-all hover:bg-white hover:shadow-md lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm"><Wallet className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black uppercase tracking-tight text-slate-800">{item.title}</p>
                      {isOverdue(item) && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-600 ring-1 ring-rose-200"><AlertTriangle className="h-2.5 w-2.5" /> Lewat Jatuh Tempo</span>}
                    </div>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{item.category || 'Administrasi'} · {item.bill_code}</p>
                    {item.due_date && <p className="mt-1 text-[11px] font-bold text-slate-500">Jatuh tempo: {item.due_date}</p>}
                    {item.status === 'ditolak' && item.rejection_reason && <p className="mt-1 text-[11px] font-bold text-rose-600">Alasan: {item.rejection_reason}</p>}
                    {item.proof_name && <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500"><FileText className="h-3.5 w-3.5" /> {item.proof_name}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="text-base font-black text-slate-900">{formatCurrency(item.amount)}</p>
                  <NeonBadge tone={st.tone}>{st.label}</NeonBadge>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 lg:w-52">
                  {item.can_upload_confirmation ? (
                    <button onClick={() => openPay(item)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition hover:brightness-105 active:scale-95">
                      Bayar / Unggah Bukti
                    </button>
                  ) : (
                    <button onClick={() => setDetail(item)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition hover:brightness-105 active:scale-95">
                      Detail &amp; Kuitansi PDF
                    </button>
                  )}
                  <button onClick={() => setDetail(item)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 transition hover:text-blue-600">
                    Lihat Detail
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL BAYAR / UNGGAH BUKTI */}
      {target && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setTarget(null); }}>
          <form onSubmit={submitPay} className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="relative overflow-hidden bg-gradient-to-r from-[#0ea5e9] via-[#0284c7] to-[#0369a1] px-6 py-5 text-white">
              <p className="text-[11px] font-black uppercase tracking-widest text-white/70">Pembayaran</p>
              <h3 className="mt-1 text-xl font-black leading-tight">{target.title}</h3>
              <p className="mt-1 text-xs font-bold text-white/85">{target.bill_code} · Sisa {formatCurrency(target.remaining_amount ?? target.amount)}</p>
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <span className="select-none text-[13px] font-bold text-white/70">Esc</span>
                <button type="button" onClick={() => !busy && setTarget(null)} aria-label="Tutup" className="text-white/80 transition-colors hover:text-rose-200"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Nominal (Rp)
                <input type="number" min="0" step="1" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </label>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Tanggal Transfer
                <input type="date" value={form.payment_date} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </label>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Catatan (opsional)
                <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} placeholder="Contoh: transfer dari rekening orang tua" className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </label>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Bukti Transfer (jpg/png/webp/pdf)</span>
                <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-blue-300">
                  <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} className="hidden" />
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-blue-700"><UploadCloud className="h-3.5 w-3.5" /> Pilih berkas</span>
                  <span className="truncate text-xs font-bold text-slate-500">{form.file ? form.file.name : 'Belum ada file dipilih'}</span>
                </label>
              </div>
              {msg && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{msg}</p>}
            </div>
            <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" onClick={() => !busy && setTarget(null)} disabled={busy} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-100 disabled:opacity-50">Batal</button>
              <button type="submit" disabled={busy || !form.payment_date} className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Mengirim…' : 'Kirim Konfirmasi'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODAL DETAIL & KUITANSI */}
      {detail && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="relative overflow-hidden bg-gradient-to-r from-[#0ea5e9] via-[#0284c7] to-[#0369a1] px-6 py-5 text-white">
              <p className="text-[11px] font-black uppercase tracking-widest text-white/70">Detail Transaksi</p>
              <h3 className="mt-1 text-xl font-black leading-tight">{detail.title}</h3>
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <span className="select-none text-[13px] font-bold text-white/70">Esc</span>
                <button type="button" onClick={() => setDetail(null)} aria-label="Tutup" className="text-white/80 transition-colors hover:text-rose-200"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-6 text-sm">
              {[
                ['Kode Tagihan', detail.bill_code],
                ['Nomor Transaksi', detail.transaction_no],
                ['Kategori', detail.category || 'Administrasi'],
                ['Nominal', formatCurrency(detail.amount)],
                ['Terbayar', formatCurrency(detail.paid_amount)],
                ['Sisa', formatCurrency(detail.remaining_amount)],
                ['Jatuh Tempo', detail.due_date || '-'],
                ['Tanggal Bayar', detail.payment_date || '-'],
                ['Status', (BILLING_STATUS[detail.status] || { label: detail.status }).label],
                ['Kasir Verifikator', detail.verified_by_name || '-'],
              ].map(([l, v]) => (
                <div key={l} className="flex items-start justify-between gap-3 border-b border-slate-50 py-2">
                  <span className="font-black uppercase tracking-wider text-slate-400">{l}</span>
                  <span className="text-right font-bold text-slate-700">{v || '-'}</span>
                </div>
              ))}
              {detail.status === 'ditolak' && detail.rejection_reason && (
                <p className="mt-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">Alasan penolakan: {detail.rejection_reason}</p>
              )}
              {detail.student_note && (
                <p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><span className="font-black uppercase tracking-wider text-slate-400">Catatan Anda:</span> {detail.student_note}</p>
              )}
              {detail.proof_url && (
                <a href={detail.proof_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:underline"><FileText className="h-4 w-4" /> Lihat bukti transfer</a>
              )}
            </div>
            <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" onClick={() => setDetail(null)} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-100">Tutup</button>
              <button type="button" onClick={() => downloadKuitansi(detail)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-md hover:brightness-110 active:scale-95">
                <FileDown className="h-4 w-4" /> Unduh Kuitansi (PDF)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <RaporPdfPreview state={preview} onClose={() => { setPreview((p) => { if (p?.url) URL.revokeObjectURL(p.url); return null; }); }} title={previewMeta.title} downloadLabel={previewMeta.downloadLabel} />
    </div>
  );
}

function FinanceKpi({ icon: Icon, label, value, sub, progress, theme }) {
  return (
    <div className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${theme.card}`}>
      {/* glow halus di pojok */}
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl ${theme.glow}`} />
      {/* watermark ikon besar */}
      <Icon className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${theme.watermark}`} strokeWidth={1.5} />

      <div className="relative flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ring-1 ring-white/60 ${theme.iconBox}`}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="text-2xl font-black leading-tight text-slate-900">{value}</p>
        </div>
      </div>

      {progress != null && (
        <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-white/70 ring-1 ring-slate-200/60">
          <div className={`h-full rounded-full bg-gradient-to-r transition-all ${theme.bar}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}

      {sub && <p className="relative mt-2 text-[11px] font-bold text-slate-500">{sub}</p>}

      {theme.pillText && (
        <span className={`relative mt-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${theme.pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${theme.pillDot}`} />
          {theme.pillText}
        </span>
      )}
    </div>
  );
}

function DonutChart({ total, segments }) {
  const R = 42, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#F1F5F9" strokeWidth="12" />
          {total > 0 && segments.map((s) => {
            if (!s.value) return null;
            const dash = (s.value / total) * C;
            const seg = <circle key={s.key} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc} />;
            acc += dash;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-slate-900">{formatCurrency(total)}</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Total Tagihan</span>
        </div>
      </div>
      <div className="w-full space-y-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-2 font-bold text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}</span>
            <span className="font-black tabular-nums text-slate-700">{formatCurrency(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pop-up Review Ujian (gaya GoFood/ShopeeFood) ──────────────────────────
// Muncul sekali setelah murid menekan `Refresh` di layar akhir ujian. Tidak memaksa:
// bisa ditutup via ikon X atau tap di luar kotak. Setelah dikirim → tampilan sukses
// lalu menutup sendiri (~2,5 detik).
const STAR_LABELS = { 1: 'Kurang', 2: 'Cukup', 3: 'Baik', 4: 'Sangat Baik', 5: 'Luar Biasa' };

function ExamReviewPopup({ data, onClose }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const closeTimer = useRef(null);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  if (!data) return null;

  const active = hover || rating;
  const examName = data.exam_title || data.subject_name || 'Ujian';

  const handleClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    onClose?.();
  };

  const handleSend = async () => {
    if (rating < 1 || sending) return;
    setSending(true);
    setError('');
    try {
      await studentAPI.submitExamReview({
        exam_session_id: data.exam_session_id,
        rating,
        feedback: feedback.trim() ? feedback.trim() : null,
      });
      setSubmitted(true);
      closeTimer.current = setTimeout(() => onClose?.(), 2500);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal mengirim review. Coba lagi.');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button type="button" onClick={handleClose} aria-label="Tutup" className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"><X size={18} /></button>

        {!submitted ? (
          <div className="px-7 pb-7 pt-8">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500"><Star className="h-7 w-7 fill-current" /></div>
            <h3 className="text-center text-lg font-black text-slate-900">Bagaimana pengalaman ujian Anda?</h3>
            <p className="mt-1 text-center text-sm font-semibold text-slate-500">{examName}</p>

            <div className="mt-6 flex items-center justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  aria-label={`${n} bintang`}
                  className="p-0.5 transition-transform active:scale-90"
                >
                  <Star className={`h-9 w-9 transition-colors ${n <= active ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-slate-300'}`} />
                </button>
              ))}
            </div>
            <p className="mt-2 h-5 text-center text-sm font-black text-amber-600">{active ? `${active} · ${STAR_LABELS[active]}` : 'Pilih rating'}</p>

            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Masukan Anda (saran / kendala teknis selama ujian, opsional)"
              className="mt-3 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
            />
            {error && <p className="mt-2 text-sm font-bold text-rose-600">{error}</p>}

            <button
              type="button"
              onClick={handleSend}
              disabled={rating < 1 || sending}
              className="mt-4 w-full rounded-2xl bg-amber-500 px-6 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-amber-500/25 transition hover:bg-amber-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? 'Mengirim…' : 'Kirim'}
            </button>
          </div>
        ) : (
          <div className="px-7 py-12 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <h3 className="text-lg font-black text-slate-900">Terima kasih atas masukan Anda.</h3>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
