import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import LogoutLeftIcon from '../components/shared/LogoutLeftIcon';
import {
  User,
  Settings,
  School,
  GraduationCap,
  Users,
  BookOpen,
  DollarSign,
  Monitor,
  UserCheck,
  Menu,
  X,
  Bell,
  Search,
  Inbox,
  Layout,
  ClipboardList,
  MessageCircle,
  MessageSquare,
  Edit,
  CheckCircle,
  FileText,
  Receipt,
  Upload,
  Calendar,
  Globe,
  Clock,
  Plus,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Network,
  Zap,
  CreditCard,
  Wallet,
  BarChart3,
  Sparkles,
  Trophy
} from 'lucide-react';
import CinematicLoading from '../components/dashboard/shared/CinematicLoading';
import ErrorBoundary from '../components/dashboard/shared/ErrorBoundary';
import PromotionSurpriseModal from '../components/dashboard/shared/PromotionSurpriseModal';
import useBodyScrollLock from '../utils/useBodyScrollLock';

const NotificationMessageBody = ({ notification, message, compact = false }) => {
  const data = notification?.data && typeof notification.data === 'object' ? notification.data : notification || {};
  const changedFields = Array.isArray(data.changed_fields) ? data.changed_fields : [];

  if (data.notification_kind !== 'account_profile_updated' || changedFields.length === 0) {
    return <>{String(message || '').replace(/<[^>]*>?/gm, '')}</>;
  }

  return (
    <p className={compact ? 'leading-relaxed' : 'leading-8'}>
      Halo {data.profile_name || 'pengguna'}, profil akun Anda baru saja diperbarui. Data yang diubah adalah{' '}
      {changedFields.map((field, index) => (
        <span key={field}>
          {index > 0 ? ', ' : ''}
          <span className={`mx-0.5 inline-flex translate-y-[-1px] items-center rounded-full border border-blue-200 bg-blue-50 font-bold text-blue-700 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'}`}>
            {field}
          </span>
        </span>
      ))}
      . Silahkan dicek melalui pengaturan atau dashboard profil.
    </p>
  );
};

// Waktu relatif berbahasa Indonesia dari timestamp ISO notifikasi (fallback ke string lama).
const formatWaktuId = (notif) => {
  const iso = notif?.timestamp || notif?.created_at;
  const then = iso ? new Date(iso) : null;
  if (!then || Number.isNaN(then.getTime())) return String(notif?.created_at || '');
  const diff = Math.floor((Date.now() - then.getTime()) / 1000);
  if (diff < 45) return 'Baru saja';
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} menit yang lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Kemarin';
  if (days < 7) return `${days} hari yang lalu`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} minggu yang lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} bulan yang lalu`;
  const years = Math.floor(days / 365);
  return `${years} tahun yang lalu`;
};

// Buang emoji/emoticon dari teks tampilan (judul & pesan) tanpa mengubah data.
const stripEmoji = (val) => String(val || '')
  .replace(/\p{Extended_Pictographic}/gu, '')
  .replace(/\uFE0F|\u200D/g, '')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

import logo22 from '../assets/logos/logo22.png';

// Dashboard per-role di-load lazy: bundle awal hanya berisi kerangka dashboard,
// sedangkan library berat milik masing-masing role (recharts, xlsx, jspdf,
// quill, dll.) baru diunduh saat menu tersebut benar-benar dibuka.
const ExecutiveDashboard = lazy(() => import('./Dashboards/Executive/ExecutiveDashboard'));
const SuperAdminDashboard = lazy(() => import('./Dashboards/SuperAdmin/SuperAdminDashboard'));
const AdminAkademikDashboard = lazy(() => import('./Dashboards/AdminAkademik/AdminAkademikDashboard'));
const CashierDashboard = lazy(() => import('./Dashboards/Cashier/CashierDashboard'));
const StudentDashboard = lazy(() => import('./Dashboards/Student/StudentDashboard'));
const TeacherDashboard = lazy(() => import('./Dashboards/Teacher/TeacherDashboard'));
const PusatJurusanDashboard = lazy(() => import('./Dashboards/PusatJurusan/PusatJurusanDashboard'));
const SpecialStaffDashboard = lazy(() => import('./Dashboards/SpecialStaff/SpecialStaffDashboard'));
const SettingsDashboard = lazy(() => import('./Dashboards/Settings/SettingsDashboard'));
const DataBackupPage = lazy(() => import('./Dashboards/DataBackup/DataBackupPage'));
import { authAPI, userAPI, operatorAPI, informationCenterAPI, BASE_URL } from '../utils/api';
import { resetDemoData } from '../mocks/demoSeeder';
import {
  getAccessRoleLabel,
  isSpecialStaffUser,
  resolveAccessRole,
} from '../utils/userMeta';
import { getExecutiveMenuItems } from '../utils/executiveDashboard';

// Tampil sebentar saat chunk dashboard sedang diunduh (React.lazy).
// Sengaja ringan dan berbentuk kerangka agar tidak ada layar kosong.
function DashboardChunkFallback() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-28 rounded-3xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-32 rounded-3xl bg-slate-100" />
        <div className="h-32 rounded-3xl bg-slate-100" />
        <div className="h-32 rounded-3xl bg-slate-100" />
      </div>
      <div className="h-64 rounded-3xl bg-slate-100" />
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Optimasi: Gunakan data dari sessionStorage secara instan jika tersedia
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [activeTab, setActiveTab] = useState('summary');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [isDeletingNotif, setIsDeletingNotif] = useState(false);
  const [isFetchingNotifDetail, setIsFetchingNotifDetail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const toastTimerRef = useRef(null);
  const notifRef = useRef(null);
  const sleepExitStartedRef = useRef(false);

  // Notifikasi pesan tidak lagi dipasang di menu sidebar: penanda hanya ada di
  // pil "Informasi & Pengumuman" dan "Pesan Pribadi" di halaman Pusat Informasi.
  const [cleaningStatus, setCleaningStatus] = useState({ active: false, message: '' });
  const [showCleaningBanner, setShowCleaningBanner] = useState(() => {
    return !localStorage.getItem('cleaning_banner_closed');
  });
  const [showSleepOverlay, setShowSleepOverlay] = useState(false);
  // Peringatan "Sisa Waktu Server Hidup" di header: timestamp (ms) momen server
  // akan redirect ke halaman Sleep. Diisi hanya saat jendela peringatan aktif
  // (<= 7 menit sebelum tutup). Countdown 1 menit terakhir tetap ditangani overlay.
  const [serverLifeEndAt, setServerLifeEndAt] = useState(null);
  const [serverLifeTick, setServerLifeTick] = useState(0);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  // Indikator (red dot) pengumuman belum dibaca untuk menu sidebar murid.
  const [studentInfoUnread, setStudentInfoUnread] = useState(0);

  // TAHAP 3: Impersonate state
  const [isImpersonating, setIsImpersonating] = useState(user?._impersonating || user?.is_impersonating || false);

  // Alumni Reminder (Masa Aktif)
  const [alumniReminder, setAlumniReminder] = useState(null);
  const [showAlumniPopup, setShowAlumniPopup] = useState(false);

  // Update impersonating state whenever user changes
  useEffect(() => {
    setIsImpersonating(user?._impersonating || user?.is_impersonating || false);
  }, [user?._impersonating, user?.is_impersonating]);

  // Alumni Reminder: Check on mount. Popup hanya muncul bila belum ditutup pada sesi login ini
  useEffect(() => {
    if (!user || isImpersonating) return;

    const checkReminder = async () => {
      try {
        const response = await operatorAPI.checkAlumniReminder();
        if (response.data?.has_reminder) {
          const data = response.data.data || {};
          setAlumniReminder(data);
          // is_dismissed di-reset hanya saat login, jadi popup tidak muncul berulang
          setShowAlumniPopup(!data.is_dismissed);
        }
      } catch (error) {
        // Silent fail - don't disrupt user experience
      }
    };

    checkReminder();
  }, [user, isImpersonating]);

  // Kunci scroll halaman selama popup peringatan masa aktif terbuka
  useBodyScrollLock(showAlumniPopup);

  // Ticker 1 detik untuk pil "Sisa Waktu Server Hidup" supaya MM:SS mundur
  // mulus di antara poll sleep-status (5 detik). Berhenti saat jendela habis.
  useEffect(() => {
    if (!serverLifeEndAt) return undefined;
    const id = window.setInterval(() => {
      if (Date.now() >= serverLifeEndAt) {
        setServerLifeEndAt(null);
        return;
      }
      setServerLifeTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [serverLifeEndAt]);

  // Dismiss alumni popup
  const handleDismissAlumniPopup = async () => {
    setShowAlumniPopup(false);
    try {
      await operatorAPI.dismissAlumniReminder();
    } catch (error) {
      // Silent fail
    }
  };

  const accessRole = resolveAccessRole(user);
  const isStudentRole = accessRole === 'murid';

  // Red dot "Pusat Informasi" murid: hitung pengumuman belum dibaca dari DB.
  // Segarkan berkala ringan (60s) dan setiap kali item ditandai sudah dibaca
  // dari dalam Pusat Informasi (event 'info-unread:refresh').
  useEffect(() => {
    if (!user || !isStudentRole) return undefined;

    const fetchUnread = async () => {
      try {
        const res = await informationCenterAPI.getUnreadCount();
        setStudentInfoUnread(Number(res.data?.data?.count) || 0);
      } catch {
        // Endpoint tak tersedia saat backend lama — biarkan dot mati.
      }
    };

    fetchUnread();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchUnread();
    }, 60000);
    window.addEventListener('info-unread:refresh', fetchUnread);
    return () => {
      clearInterval(timer);
      window.removeEventListener('info-unread:refresh', fetchUnread);
    };
  }, [user?.id, isStudentRole]);

  const isExecutive = accessRole === 'kepala_sekolah' || accessRole === 'wakil_sekolah';
  const isSpecialStaff = isSpecialStaffUser(user);
  const isMaster = Number(user?.id) === 9324 || user?._impersonating === true;
  const isSettingsRoute = location.pathname === '/dashboard/settings';
  const userAvatarUrl = user?.avatar ? `/storage/${user.avatar}` : (user?.avatarUrl || user?.avatar_url);
  const isCashierWorkspace = !isSpecialStaff && accessRole === 'cashier';
  const executiveMenuItems = getExecutiveMenuItems(user);
  const operatorMenuItems = [
    { id: 'summary', title: 'Dashboard', icon: School, path: '/dashboard/dashboard' },
    { id: 'users', title: 'Manajemen Pengguna', icon: Users, path: '/dashboard/users' },
    { id: 'security', title: 'Konfigurasi Pengguna', icon: Settings, path: '/dashboard/security' },
    { id: 'emergency_db', title: 'Keamanan Darurat', icon: ShieldAlert, path: '/dashboard/emergency_db' },
    { id: 'calendar_ta', title: 'Kalender Akademik', icon: Calendar, path: '/dashboard/calendar_ta' },
    { id: 'news', title: 'Pusat Informasi', icon: Bell, path: '/dashboard/news' }
  ];
  const adminAkademikMenuItems = [
    { id: 'summary', title: 'Dashboard', icon: School, path: '/dashboard/dashboard' },
    { id: 'manajemen_kbm', title: 'Manajemen KBM', icon: GraduationCap, path: '/dashboard/manajemen-kbm' },
    { id: 'exams', title: 'Manajemen Ujian Sekolah', icon: Globe, path: '/dashboard/exams' },
    { id: 'grades_academic', title: 'Pengolahan Nilai & Rapor', icon: FileText, path: '/dashboard/grades' },
    { id: 'calendar_ta', title: 'Kalender Akademik', icon: Calendar, path: '/dashboard/calendar_ta' },
    { id: 'news', title: 'Pusat Informasi', icon: Bell, path: '/dashboard/news' }
  ];
  const pusatJurusanMenuItems = [
    { id: 'dashboard', title: 'Dashboard', icon: School, path: '/dashboard/dashboard' },
    { id: 'kurikulum_jadwal', title: 'Kurikulum & Jadwal', icon: BookOpen, path: '/dashboard/kurikulum-jadwal' },
    { id: 'pkl_prestasi', title: 'PKL & Prestasi', icon: Network, path: '/dashboard/pkl-prestasi' },
    { id: 'nilai_kejuruan', title: 'Nilai & Kejuruan', icon: FileText, path: '/dashboard/nilai-kejuruan' },
    { id: 'calendar_ta', title: 'Kalender Akademik', icon: Calendar, path: '/dashboard/calendar_ta' },
    { id: 'news', title: 'Pusat Informasi', icon: Bell, path: '/dashboard/news' }
  ];
  const guruMenuItems = [
    { id: 'summary', title: 'Dashboard', icon: School, path: '/dashboard/dashboard' },
    { id: 'attendance', title: 'KBM & Presensi', icon: CheckCircle, path: '/dashboard/attendance' },
    { id: 'materials', title: 'Materi & Soal', icon: Upload, path: '/dashboard/materials' },
    { id: 'assignments', title: 'Tugas & Nilai', icon: ClipboardList, path: '/dashboard/assignments' },
    { id: 'calendar_ta', title: 'Kalender Akademik', icon: Calendar, path: '/dashboard/calendar_ta' },
    { id: 'news', title: 'Pusat Informasi', icon: Bell, path: '/dashboard/news' },
    ...(user?.isHomeroomTeacher ? [{ 
      id: 'homeroom', 
      title: 'Wali Kelas', 
      icon: Sparkles, 
      path: '/dashboard/walikelas-dashboard',
      isSpecialHomeroom: true,
      hasDivider: true
    }] : [])
  ];
  const studentMenuItems = [
    { id: 'profile', title: 'Dashboard', icon: School, path: '/dashboard/dashboard' },
    { id: 'kbm', title: 'KBM & Presensi', icon: BookOpen, path: '/dashboard/learning-activity' },
    { id: 'tasks', title: 'Tugas & Ujian', icon: ClipboardList, path: '/dashboard/exams' },
    { id: 'finance', title: 'Tagihan Pendidikan', icon: Wallet, path: '/dashboard/education-bill' },
    { id: 'kegiatan', title: 'Ekstrakurikuler', icon: Trophy, path: '/dashboard/extracurricular' },
    { id: 'report', title: 'Capaian Belajar', icon: FileText, path: '/dashboard/achievement' },
    { id: 'calendar_ta', title: 'Kalender Akademik', icon: Calendar, path: '/dashboard/calendar_ta' },
    { id: 'news', title: 'Pusat Informasi', icon: Bell, path: '/dashboard/news' }
  ];
  const cashierMenuItems = [
    { id: 'dashboard', title: 'Dashboard', icon: School, path: '/dashboard/dashboard' },
    { id: 'payment_verification', title: 'Pembayaran & Verifikasi', icon: CreditCard, path: '/dashboard/dashboard/payment_verification' },
    { id: 'billing_arrears', title: 'Tagihan & Tunggakan', icon: ClipboardList, path: '/dashboard/dashboard/billing_arrears' },
    { id: 'cash_funds', title: 'Kas Kecil & Dana Sekolah', icon: Wallet, path: '/dashboard/dashboard/cash_funds' },
    { id: 'reports', title: 'Laporan & Rekapitulasi', icon: BarChart3, path: '/dashboard/dashboard/reports' },
    { id: 'calendar_ta', title: 'Kalender Akademik', icon: Calendar, path: '/dashboard/calendar_ta' },
    { id: 'news', title: 'Pusat Informasi', icon: Bell, path: '/dashboard/dashboard/news' }
  ];
  const specialStaffBaseItems = [
    { id: 'staff-summary', title: 'Dashboard Staff Khusus', icon: School, path: '/dashboard/dashboard' },
    { id: 'staff-laporan', title: 'Laporan Kegiatan & Riwayat', icon: FileText, path: '/dashboard/staff/laporan' },
    { id: 'staff-tugas', title: 'Daftar Tugas & Instructions', icon: MessageSquare, path: '/dashboard/staff/tugas' },
    { id: 'staff-calendar', title: 'Kalender Akademik', icon: Calendar, path: '/dashboard/calendar_ta' },
    { id: 'staff-info', title: 'Pusat Informasi', icon: Bell, path: '/dashboard/staff/info' },
  ];
  const roleWorkspaceSource = accessRole === 'operator'
    ? operatorMenuItems
    : accessRole === 'admin_akademik'
      ? adminAkademikMenuItems
      : accessRole === 'guru'
        ? guruMenuItems
        : accessRole === 'pusat_jurusan'
          ? pusatJurusanMenuItems
          : accessRole === 'cashier'
            ? cashierMenuItems
            : accessRole === 'murid'
              ? studentMenuItems
              : isExecutive
                ? [{ id: 'executive', title: 'Dashboard Executive', icon: School, path: '/dashboard/dashboard' }]
                : [];
  const roleWorkspaceItems = roleWorkspaceSource.map((item) => ({
    ...item,
    id: `role-${item.id}`,
    baseId: item.id,
  }));
  const specialStaffMenuSections = [
    {
      label: 'Main Menu',
      items: specialStaffBaseItems,
    }
  ];
  const specialStaffMenuItems = specialStaffMenuSections.flatMap((section) => section.items);
  const routeSyncedMenuItems = isSpecialStaff
    ? []
    : isCashierWorkspace
      ? cashierMenuItems
      : accessRole === 'operator'
        ? operatorMenuItems
        : accessRole === 'admin_akademik'
          ? adminAkademikMenuItems
          : accessRole === 'guru'
            ? guruMenuItems
            : accessRole === 'murid'
              ? studentMenuItems
              : accessRole === 'pusat_jurusan'
                ? pusatJurusanMenuItems
                : isExecutive
                  ? executiveMenuItems
                  : [];
  const usesRouteSyncedWorkspace = routeSyncedMenuItems.length > 0;
  const defaultRouteSyncedPath = routeSyncedMenuItems[0]?.path || '/dashboard';
  const routeSyncedMenuSignature = routeSyncedMenuItems.map((item) => item.path).join('|');

  const fetchNotifications = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/user/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const result = await response.json();
      if (result.success) {
        setNotifications(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  const exitToSleepPage = (sleepData = {}) => {
    if (sleepExitStartedRef.current) return;
    sleepExitStartedRef.current = true;

    const previousData = (() => {
      try { return JSON.parse(sessionStorage.getItem('sleep_data') || '{}'); }
      catch { return {}; }
    })();
    sessionStorage.setItem('sleep_data', JSON.stringify({
      message: sleepData.message || previousData.message || 'Sistem sedang dalam mode tidur. Silakan akses kembali pada jam operasional.',
      wake_at: sleepData.wake_at || previousData.wake_at || null,
    }));

    const activeToken = sessionStorage.getItem('token');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('sleep_countdown_started');
    sessionStorage.setItem('sleep_redirecting', '1');
    navigate('/sleep-mode', { replace: true });
    if (activeToken) authAPI.logoutWithToken(activeToken).catch(() => { });
  };

  const fetchCleaningStatus = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;

      // Semua role ter-autentikasi boleh baca status Cleaning — banner "Informasi
      // Server" harus tampil ke semua user saat toggle ON, kecuali Super Admin 9324
      // (pengecualiannya di render). Endpoint ini hanya mengembalikan flag + pesan.
      const response = await fetch('/api/system/cleaning-status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.status === 401) {
        // A cleaning-status auth error is not proof that the sleep schedule
        // started. Sleep detection is handled by /system/sleep-status.
        return;
      }

      const result = await response.json();

      if (result.active && !cleaningStatus.active) {
        localStorage.removeItem('cleaning_banner_closed');
        setShowCleaningBanner(true);
      }

      setCleaningStatus(result);
    } catch (error) {
      console.error('Failed to fetch cleaning status', error);
    }
  };

  // Poll rapat agar countdown dimulai dekat waktu tutup; durasinya tetap
  // dihitung dari timestamp server supaya refresh tidak mengulang 60 detik.
  const checkSleepStatus = async () => {
    const savedUser = sessionStorage.getItem('user');
    if (!savedUser) return;

    let isExempt = false;
    try {
      const u = JSON.parse(savedUser);
      // Master Operator (9324) & sesi impersonation dikecualikan dari SEMUA efek
      // mode darurat, termasuk notif pil "Sisa Waktu Server Hidup". Aturan sistem:
      // semua user kena efek KECUALI Super Admin.
      const isMasterOperator = Number(u?.id) === 9324;
      isExempt = isMasterOperator || !!u?._impersonating;
    } catch { }

    // Super Admin tidak menarik status & tidak pernah menampilkan pil countdown.
    if (isExempt) {
      setServerLifeEndAt(null);
      return;
    }

    try {
      const res = await fetch('/api/system/sleep-status', { headers: { 'Accept': 'application/json' } });
      const result = await res.json();

      // ── Banner "Informasi Server" (Cleaning) — nitip ke poll 5 detik ini ──
      // Hanya non-9324 yang sampai sini (9324 sudah return sebelum fetch), jadi
      // Super Admin tidak pernah menerima banner Cleaning — konsisten dgn
      // Maintenance/Sleep. Status cleaning ikut dikirim di respons sleep-status.
      const cleaningActive = result.cleaning_active === true || result.cleaning_active === '1';
      const cleaningMessage = result.cleaning_message || '';
      if (cleaningActive && !cleaningStatus.active) {
        localStorage.removeItem('cleaning_banner_closed');
        setShowCleaningBanner(true);
      }
      setCleaningStatus({ active: cleaningActive, message: cleaningMessage });

      // ── Peringatan header "Sisa Waktu Server Hidup" (7 menit terakhir) ──
      // Deadline pil = momen redirect = jam penutupan (start) + 60 dtk grace,
      // sama persis dengan countdown 1 menit overlay. Selagi server masih bangun
      // dan sisa detik sampai tutup <= 360 (=> sisa sampai redirect <= 420 =
      // 07:00), tampilkan hitungan mundur. Menit/detik terus mundur tiap detik.
      const secsUntilClose = Number(result.seconds_until_close);
      if (
        result.active && !result.sleep && !result.maintenance
        && Number.isFinite(secsUntilClose) && secsUntilClose > 0 && secsUntilClose <= 360
      ) {
        setServerLifeEndAt(Date.now() + (secsUntilClose + 60) * 1000);
      } else {
        setServerLifeEndAt(null);
      }

      // Maintenance aktif → langsung force logout tanpa countdown, tanpa overlay
      if (result.maintenance) {
        sessionStorage.removeItem('sleep_countdown_started');
        sessionStorage.removeItem('sleep_data');
        const activeToken = sessionStorage.getItem('token');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        if (activeToken) {
          authAPI.logoutWithToken(activeToken).catch(() => { });
        }
        navigate('/');
        return;
      }

      if (result.active === false) {
        sleepExitStartedRef.current = false;
        sessionStorage.removeItem('sleep_countdown_started');
        sessionStorage.removeItem('sleep_data');
        setShowSleepOverlay(false);
        return;
      }

      // Penutupan dimulai tepat pada jam yang disetel. Timestamp server
      // menjadi sumber countdown sehingga refresh tidak memulai ulang timer.
      if (result.sleep) {
        sessionStorage.setItem('sleep_data', JSON.stringify({
          message: `Server sedang ditutup. Login dapat dilakukan kembali mulai pukul ${result.wake_at ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(result.wake_at)) : result.end} WIB.`,
          wake_at: result.wake_at || null,
        }));

        const secondsRemaining = Number(result.countdown_seconds || 0);
        if (secondsRemaining <= 0) {
          setShowSleepOverlay(false);
          exitToSleepPage({
            message: `Server sedang ditutup. Login dapat dilakukan kembali mulai pukul ${result.wake_at ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(result.wake_at)) : result.end} WIB.`,
            wake_at: result.wake_at,
          });
          return;
        }

        const serverCountdownStart = result.countdown_at ? Date.parse(result.countdown_at) : NaN;
        const anchoredStart = Number.isFinite(serverCountdownStart)
          ? serverCountdownStart
          : Date.now() - ((60 - secondsRemaining) * 1000);
        sessionStorage.setItem('sleep_countdown_started', String(anchoredStart));
        setShowSleepOverlay(true);
      } else {
        sleepExitStartedRef.current = false;
        sessionStorage.removeItem('sleep_countdown_started');
        sessionStorage.removeItem('sleep_data');
        setShowSleepOverlay(false);
      }
    } catch (err) {
      console.error('Sleep status check error:', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    fetchNotifications();

    // Tampilkan notifikasi cleaning jika user baru login saat cleaning aktif
    const cleaningLoginMsg = sessionStorage.getItem('cleaning_login_message');
    if (cleaningLoginMsg) {
      setTimeout(() => {
        showToast(cleaningLoginMsg, 'warning');
      }, 800);
      sessionStorage.removeItem('cleaning_login_message');
    }

    // Polling berkala: lewati saat tab tidak aktif supaya request tidak menumpuk
    // di dev server PHP yang hanya melayani satu request sekaligus.
    const pollIfVisible = (task) => {
      if (typeof document !== 'undefined' && document.hidden) return;
      task();
    };

    // Auto refresh notifications every 2 minutes
    const interval = setInterval(() => pollIfVisible(fetchNotifications), 120000);

    // Snapshot awal cleaning status saat mount. Update berkala sudah ditangani
    // poll 5 detik checkSleepStatus (status cleaning ikut dikirim di sana), jadi
    // tidak ada lagi timer cleaning terpisah.
    fetchCleaningStatus();

    // Cek setiap 5 detik agar awal countdown dekat dengan jam penutupan.
    checkSleepStatus();
    const sleepInterval = setInterval(() => pollIfVisible(checkSleepStatus), 5000);

    // Heartbeat sengaja TIDAK di sini: sudah ditangani satu effect khusus di bawah,
    // supaya tidak ada dua timer yang mengirim request yang sama.


    const handleSystemStatusChange = () => {
      fetchCleaningStatus();
      checkSleepStatus();
    };
    window.addEventListener('systemStatusChanged', handleSystemStatusChange);

    // Refresh bell when a new account is created
    const handleRefreshNotif = () => fetchNotifications();
    window.addEventListener('refreshNotifications', handleRefreshNotif);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearInterval(interval);
      clearInterval(sleepInterval);
      window.clearTimeout(toastTimerRef.current);
      window.removeEventListener('systemStatusChanged', handleSystemStatusChange);
      window.removeEventListener('refreshNotifications', handleRefreshNotif);
    };
  }, []);

  // Effect terpisah untuk navigasi dashboard agar selalu mendapatkan routeSyncedMenuItems terbaru
  useEffect(() => {
    const handleNavigateDashboard = (e) => {
      const targetTab = e.detail;
      if (!targetTab) return;

      // Gunakan routeSyncedMenuItems yang sudah terfilter berdasarkan role user
      const matched = routeSyncedMenuItems.find(item => item.id === targetTab);
      if (matched) {
        setActiveTab(matched.id);
        // PUSH (bukan replace) supaya tombol Back browser kembali ke halaman
        // sebelumnya (mis. Beranda/dashboard), bukan melompat keluar dari dashboard.
        if (location.pathname !== matched.path) {
          navigate(matched.path);
        }
      }
    };

    window.addEventListener('navigateDashboard', handleNavigateDashboard);
    return () => window.removeEventListener('navigateDashboard', handleNavigateDashboard);
  }, [routeSyncedMenuItems, navigate]);

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3500);
  };

  const dismissToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };

  const sendSessionHeartbeat = async () => {
    const token = sessionStorage.getItem('token');

    if (!token) {
      return;
    }

    try {
      await userAPI.sessionHeartbeat();
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data || {};

      if (status === 401 || status === 419 || status === 403) {
        // Hanya tampilkan overlay jika backend secara eksplisit menyatakan sleep_mode.
        // Jika 401 biasa (misal token didelete manual/maintenance), biarkan hydrateUserSession yang handle logout.
        if (data.sleep_mode) {
          if (Number(data.countdown_seconds || 0) > 0) {
            if (data.wake_at) {
              sessionStorage.setItem('sleep_data', JSON.stringify({ message: data.message, wake_at: data.wake_at }));
            }
            setShowSleepOverlay(true);
          } else {
            exitToSleepPage(data);
          }
        }
      } else {
        console.error('Failed to update session heartbeat', error);
      }
    }
  };

  const handleMarkAsRead = async (notif) => {
    const id = notif?.id;

    // Check if it's an announcement to fetch full data
    const isAnnouncement = notif.is_announcement || notif.type === 'announcement' || notif?.data?.type === 'announcement';
    if (isAnnouncement) {
      setIsFetchingNotifDetail(true);
      try {
        const annId = String(id).replace('ANN-', '');
        const response = await fetch(`/api/information-center/${annId}`, {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
            'Accept': 'application/json'
          }
        });
        const result = await response.json();
        if (result.success) {
          setSelectedNotif({ ...notif, ...result.data, fullDetail: true });
        } else {
          setSelectedNotif(notif);
        }
      } catch (error) {
        console.error('Failed to fetch announcement detail', error);
        setSelectedNotif(notif);
      } finally {
        setIsFetchingNotifDetail(false);
      }
    } else {
      setSelectedNotif(notif);
    }

    setShowNotifDropdown(false);

    // Mark as read in background
    if (!notif?.read_at) {
      // Update local state immediately so it doesn't disappear if backend filters read notifications
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));

      try {
        const token = sessionStorage.getItem('token');
        await fetch(`/api/user/notifications/${id}/read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
      } catch (error) {
        console.error('Failed to mark as read', error);
      }
    }
  };

  // Tandai semua dibaca via endpoint read-all yang sudah tersedia (tanpa ubah backend).
  const handleMarkAllRead = async () => {
    if (!notifications.some(n => !n.read_at)) return;
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    try {
      const token = sessionStorage.getItem('token');
      await fetch('/api/user/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const CleaningBanner = () => {
    // Hanya Super Admin 9324 (dan sesi impersonation-nya) yang TIDAK menerima
    // banner Cleaning — konsisten dgn Maintenance/Sleep. Role lain, termasuk
    // admin akademik, guru, murid, kasir, dst, TETAP melihat banner.
    if (!cleaningStatus.active || user?.id === 9324 || isImpersonating) return null;

    return (
      <div className="mb-8 px-5 py-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 shadow-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-bold tracking-tight">
          <span className="uppercase text-[10px] font-black bg-amber-200 px-2 py-0.5 rounded-md mr-2">Informasi Server</span>
          {cleaningStatus.message}
        </p>
      </div>
    );
  };

  const handleDeleteNotification = (id) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteNotification = async () => {
    if (!deleteTargetId) return;

    setIsDeletingNotif(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/user/notifications/${deleteTargetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const result = await response.json();
      if (result.success) {
        showToast('Berhasil dihapus');
        setSelectedNotif(null);
        setShowDeleteConfirm(false);
        setDeleteTargetId(null);
        fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to delete notification', error);
      showToast('Gagal menghapus', 'error');
    } finally {
      setIsDeletingNotif(false);
    }
  };

  const handleClearAllNotifications = async () => {
    if (notifications.length === 0) return;
    setShowClearAllConfirm(true);
  };

  const confirmClearAllNotifications = async () => {
    setIsClearingAll(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/user/notifications/clear-all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const result = await response.json();
      if (result.success) {
        showToast('Seluruh notifikasi telah dibersihkan');
        setShowClearAllConfirm(false);
        fetchNotifications();
      }
    } catch (error) {
      console.error('Failed to clear notifications', error);
      showToast('Gagal membersihkan notifikasi', 'error');
    } finally {
      setIsClearingAll(false);
    }
  };


  useEffect(() => {
    let isMounted = true;

    const hydrateUserSession = async ({ redirectOnFailure = false } = {}) => {
      const userData = sessionStorage.getItem('user');
      const token = sessionStorage.getItem('token');
      const clearSession = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      };

      if (!userData || !token) {
        if (redirectOnFailure) {
          clearSession();
          navigate('/');
        }
        return;
      }

      let parsedUser;

      try {
        parsedUser = JSON.parse(userData);
      } catch (error) {
        console.error('Stored user session is malformed:', error);
        if (redirectOnFailure) {
          clearSession();

          if (isMounted) {
            navigate('/');
          }
        }
        return;
      }

      // Jika sedang dalam sesi impersonation, skip profile refresh
      // agar token impersonation tidak di-invalidate oleh getProfile
      if (parsedUser?._impersonating) {
        if (isMounted) {
          setUser(parsedUser);
        }
        return;
      }

      if (isMounted) {
        setUser(parsedUser);
      }

      try {
        const profileResponse = await userAPI.getProfile();
        const nextProfile = profileResponse.data?.user;

        if (!nextProfile) {
          return;
        }

        const nextUser = {
          ...parsedUser,
          ...nextProfile,
        };

        sessionStorage.setItem('user', JSON.stringify(nextUser));

        if (isMounted) {
          setUser(nextUser);
        }
      } catch (error) {
        const status = error?.response?.status;
        const shouldResetSession = status === 401 || status === 419;

        console.error(
          shouldResetSession ? 'User session expired:' : 'Failed to refresh user session:',
          error,
        );

        if (redirectOnFailure && shouldResetSession) {
          clearSession();

          if (isMounted) {
            navigate('/');
          }
        }
      }
    };

    let lastHydrate = 0;
    const HYDRATE_THROTTLE_MS = 10000; // max sekali per 10 detik

    const refreshVisibleSession = () => {
      const now = Date.now();
      if (now - lastHydrate > HYDRATE_THROTTLE_MS) {
        lastHydrate = now;
        hydrateUserSession();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshVisibleSession();
      }
    };

    lastHydrate = Date.now();
    hydrateUserSession({ redirectOnFailure: true });
    window.addEventListener('focus', refreshVisibleSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', refreshVisibleSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      return;
    }

    // Satu-satunya heartbeat aplikasi. Batas sesi di AuthController adalah 5 menit,
    // jadi 2 menit sudah aman. Sebelumnya ada dua timer + listener `focus` yang
    // membuat request heartbeat terkirim berkali-kali tanpa manfaat.
    const handleVisibleHeartbeat = () => {
      if (document.visibilityState === 'visible') {
        sendSessionHeartbeat();
      }
    };

    sendSessionHeartbeat();

    const heartbeatInterval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      sendSessionHeartbeat();
    }, 2 * 60 * 1000);
    document.addEventListener('visibilitychange', handleVisibleHeartbeat);

    return () => {
      window.clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibleHeartbeat);
    };
  }, [user]);



  useEffect(() => {
    if (!user) {
      return;
    }

    if (isSettingsRoute) {
      setActiveTab('settings');
      return;
    }

    if (isSpecialStaff) {
      const validIds = specialStaffMenuItems.map((item) => item.id);
      setActiveTab((current) => (validIds.includes(current) ? current : 'staff-summary'));
    }
  }, [user, accessRole, isSpecialStaff, isSettingsRoute]);

  const handleLogout = () => {
    // 1. Ambil token yang masih aktif sebelum dihapus dari sessionStorage
    const activeToken = sessionStorage.getItem('token');

    // 2. Langsung bersihkan sesi lokal (optimistic UI logout)
    localStorage.removeItem('activeAcademicCalendar');
    localStorage.removeItem('academicCalendarTitle');
    localStorage.removeItem('calendarPublished');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');

    // 3. Navigasi ke halaman login segera
    navigate('/');

    // 4. Panggil API logout di background dengan membawa token yang diselamatkan
    // (Ini penting agar backend tahu siapa yang logout untuk dicatat di Audit Log)
    if (activeToken) {
      authAPI.logoutWithToken(activeToken).catch((error) => {
        const status = error?.response?.status;
        if (status !== 401 && status !== 419) {
          console.error('Background logout failed:', error);
        }
      });
    }
  };

  const handleResetDemo = () => {
    if (!window.confirm('Reset seluruh data demo ke kondisi awal? Perubahan yang Anda buat akan hilang dan Anda akan keluar ke halaman login.')) return;
    resetDemoData();
    navigate('/');
  };

  useEffect(() => {
    if (!user || !usesRouteSyncedWorkspace) {
      return;
    }

    if (isSettingsRoute) {
      setActiveTab('settings');
      return;
    }

    const matchedItem = routeSyncedMenuItems.find((item) => item.path === location.pathname);

    if (matchedItem) {
      setActiveTab(matchedItem.id);
      return;
    }

    navigate(defaultRouteSyncedPath, { replace: true });
  }, [user, location.pathname, isSettingsRoute, usesRouteSyncedWorkspace, defaultRouteSyncedPath, routeSyncedMenuSignature, navigate]);

  const menuItems = isSpecialStaff ? specialStaffMenuItems : isCashierWorkspace ? cashierMenuItems : accessRole === 'operator' ? operatorMenuItems : accessRole === 'admin_akademik' ? adminAkademikMenuItems : accessRole === 'pusat_jurusan' ? pusatJurusanMenuItems : accessRole === 'guru' ? guruMenuItems : accessRole === 'murid' ? studentMenuItems : isExecutive ? executiveMenuItems : [
    {
      id: 'executive',
      title: 'Dashboard Executive',
      description: 'Monitoring & Oversight Sekolah',
      icon: School,
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-50',
      path: '/dashboard/dashboard',
      roles: ['kepala_sekolah', 'wakil_sekolah']
    },
    {
      id: 'guru',
      title: 'Guru',
      description: 'Data dan manajemen guru',
      icon: GraduationCap,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-50',
      path: '/dashboard/guru',
      roles: ['kepala_sekolah', 'wakil_sekolah', 'operator']
    },
    {
      id: 'magang-honor',
      title: 'Staf Khusus',
      description: 'Manajemen tenaga magang & honorer',
      icon: UserCheck,
      color: 'bg-teal-500',
      hoverColor: 'hover:bg-teal-50',
      path: '/dashboard/magang-honor',
      roles: ['kepala_sekolah', 'wakil_sekolah', 'guru', 'operator', 'honorer', 'magang']
    },
    {
      id: 'pusat-jurusan',
      title: 'Pusat Jurusan',
      description: 'Program dan jurusan sekolah',
      icon: BookOpen,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-50',
      path: '/dashboard/pusat-jurusan',
      roles: ['kepala_sekolah', 'wakil_sekolah', 'pusat_jurusan', 'operator']
    },
    {
      id: 'cashier',
      title: 'Cashier',
      description: 'Keuangan dan pembayaran',
      icon: DollarSign,
      color: 'bg-yellow-500',
      hoverColor: 'hover:bg-yellow-50',
      path: '/dashboard/dashboard',
      roles: ['kepala_sekolah', 'wakil_sekolah', 'cashier', 'operator']
    },
    {
      id: 'operator',
      title: 'Operator',
      description: 'Sistem dan administrasi',
      icon: Monitor,
      color: 'bg-indigo-500',
      hoverColor: 'hover:bg-indigo-50',
      path: '/dashboard/operator',
      roles: ['operator']
    },
    {
      id: 'murid',
      title: 'Murid',
      description: 'Data siswa dan akademik',
      icon: Users,
      color: 'bg-pink-500',
      hoverColor: 'hover:bg-pink-50',
      path: '/dashboard/murid',
      roles: ['kepala_sekolah', 'wakil_sekolah', 'operator', 'guru', 'murid', 'honorer', 'magang']
    }
  ];

  const filteredMenuItems = (accessRole === 'operator' || accessRole === 'admin_akademik' || accessRole === 'guru' || accessRole === 'murid' || accessRole === 'pusat_jurusan' || isCashierWorkspace || isSpecialStaff || isExecutive)
    ? menuItems
    : menuItems.filter(item => item.roles?.includes(accessRole));
  const usesInlineWorkspace = accessRole === 'operator'
    || accessRole === 'admin_akademik'
    || accessRole === 'guru'
    || accessRole === 'murid'
    || accessRole === 'pusat_jurusan'
    || isCashierWorkspace
    || isSpecialStaff;
  const usesManagedSidebarSelection = usesInlineWorkspace || usesRouteSyncedWorkspace;
  const openSettings = () => {
    // Restriction: Pusat Jurusan must select a department first
    const hasJurusan = !!(localStorage.getItem('selectedJurusan') || user?.jurusan_id || user?.jurusanId || user?.last_jurusan_id || user?.lastJurusanId);
    if (accessRole === 'pusat_jurusan' && !hasJurusan) {
      showToast('Anda Dipersilahkan Memilih Jurusan Terkait Sebelum Melakukan Aksi/Akses Lainnya.', 'error');
      return;
    }

    setActiveTab('settings');
    if (location.pathname !== '/dashboard/settings') {
      navigate('/dashboard/settings');
    }
  };
  const handleMenuClick = (item) => {
    // Restriction: Pusat Jurusan must select a department first
    // Only block if it's a Pusat Jurusan specific tab (not summary)
    const isPusatJurusanTab = pusatJurusanMenuItems.some(p => p.id === item.id || p.id === item.baseId);
    const hasSelectedJurusan = !!(localStorage.getItem('selectedJurusan') || user?.jurusan_id || user?.jurusanId || user?.last_jurusan_id || user?.lastJurusanId);

    if (accessRole === 'pusat_jurusan' &&
      isPusatJurusanTab &&
      (item.id !== 'dashboard' && item.baseId !== 'dashboard') &&
      !hasSelectedJurusan) {
      showToast('Anda Dipersilahkan Memilih Jurusan Terkait Sebelum Melakukan Aksi/Akses Lainnya.', 'error');
      return;
    }

    if (isSpecialStaff) {
      setActiveTab(item.id);

      if (location.pathname !== '/dashboard') {
        navigate('/dashboard');
      }

      return;
    }

    if (usesRouteSyncedWorkspace) {
      setActiveTab(item.id);

      if (location.pathname !== item.path) {
        navigate(item.path);
      }

      return;
    }

    navigate(item.path);
  };

  const handleTabNavigation = (targetTab) => {
    const targetId = typeof targetTab === 'string' ? targetTab : targetTab?.id;
    if (!targetId) return;

    if (usesRouteSyncedWorkspace) {
      const matched = routeSyncedMenuItems.find((item) => item.id === targetId);
      if (matched) {
        setActiveTab(matched.id);
        if (location.pathname !== matched.path) {
          navigate(matched.path);
        }
        return;
      }
    }
    setActiveTab(targetId);
  };
  const specialStaffTab = isSpecialStaff && activeTab.startsWith('staff-')
    ? activeTab.replace('staff-', '')
    : null;
  const roleWorkspaceTab = isSpecialStaff && activeTab.startsWith('role-')
    ? activeTab.replace('role-', '')
    : null;

  const renderSpecialStaffWorkspace = () => {
    return (
      <SpecialStaffDashboard
        user={user}
        activeTab={specialStaffTab || 'summary'}
        onNavigate={(tab) => setActiveTab(`staff-${tab}`)}
      />
    );
  };

  if (!user) {
    return (
      <>
        <CinematicLoading roleName="Sistem Sekolah" title="Menyiapkan Sesi Anda" />
        <SleepModeOverlay
          show={showSleepOverlay}
          onFinish={() => exitToSleepPage()}
        />
      </>
    );
  }

  const handleAcknowledgePromotion = async () => {
    try {
      const res = await userAPI.acknowledgePromotion();
      const nextUser = res.data?.user;
      if (nextUser) {
        const merged = { ...user, ...nextUser };
        sessionStorage.setItem('user', JSON.stringify(merged));
        setUser(merged);
      }
    } catch (error) {
      console.error('Gagal menutup pop-up promosi:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 transition-colors duration-700">

      {/* Pop-up kejutan promosi pegawai (sekali tampil) */}
      {user?.pending_promotion_celebration && (
        <PromotionSurpriseModal
          celebration={user.pending_promotion_celebration}
          onAcknowledge={handleAcknowledgePromotion}
        />
      )}

      {/* Impersonation Banner */}
      {(() => {
        const savedUser = sessionStorage.getItem('user');
        if (!savedUser) return null;
        try {
          const u = JSON.parse(savedUser);
          if (!u?._impersonating) return null;
          const expiresAt = u._expires_at ? new Date(u._expires_at) : null;
          const handleStopImpersonation = async () => {
            try {
              await import('../utils/api').then(m => m.operatorAPI.stopImpersonation());
            } catch { }
            const originalToken = sessionStorage.getItem('operator_original_token');
            const originalUser = sessionStorage.getItem('operator_original_user');
            if (originalToken) sessionStorage.setItem('token', originalToken);
            if (originalUser) sessionStorage.setItem('user', originalUser);
            sessionStorage.removeItem('operator_original_token');
            sessionStorage.removeItem('operator_original_user');
            window.location.href = '/dashboard';
          };
          return (
            <div className="fixed top-0 left-0 right-0 z-[99998] bg-indigo-600 text-white px-4 py-2 flex items-center justify-between text-sm shadow-lg">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">IMPERSONATION</span>
                <span className="font-medium">Anda sedang mengakses sebagai <strong>{u.name}</strong> ({u.roleName || u.accessRole || u.role})</span>
              </div>
              <button onClick={handleStopImpersonation} className="px-4 py-1.5 bg-white text-indigo-600 rounded-full text-xs font-black hover:bg-indigo-50 transition-all">
                Kembali ke Akun Saya
              </button>
            </div>
          );
        } catch { return null; }
      })()}

      {/* Sleep Mode Countdown Overlay (Legacy removed, moved to end for consistency) */}
      {/* Top Navigation */}
      <nav className="bg-white/80 border-b border-gray-200 backdrop-blur-md fixed w-full top-0 z-40 transition-all duration-500">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Side */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-transparent overflow-hidden">
                  <img src={logo22} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div className="hidden sm:block text-left">
                  <h1 className="text-lg font-black leading-tight tracking-tight text-gray-900">
                    SMK Cerdas Satu Bangsa
                  </h1>
                </div>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">


              {/* Info masa aktif akun + peringatan "Sisa Waktu Server Hidup",
                  dipisah garis vertikal bila keduanya tampil. */}
              {(() => {
                const showAlumni = !!alumniReminder;
                const remainingMs = serverLifeEndAt ? serverLifeEndAt - Date.now() : 0;
                const showServer = !!serverLifeEndAt && remainingMs > 0 && remainingMs <= 420000;
                if (!showAlumni && !showServer) return null;
                const secs = Math.max(0, Math.ceil(remainingMs / 1000));
                const mm = String(Math.floor(secs / 60)).padStart(2, '0');
                const ss = String(secs % 60).padStart(2, '0');
                return (
                  <div data-server-life-tick={serverLifeTick} className="hidden lg:flex items-center gap-2.5">
                    {showAlumni && (
                      <p className="whitespace-nowrap text-right text-[11px] font-bold leading-tight text-rose-600">
                        Masa Aktif Akun: {alumniReminder.days_left} hari lagi. ({alumniReminder.remind_at_label} berakhir).
                      </p>
                    )}
                    {showAlumni && showServer && (
                      <span className="h-6 w-px bg-slate-300" aria-hidden="true" />
                    )}
                    {showServer && (
                      <p className="flex whitespace-nowrap items-center gap-1.5 text-[11px] font-black leading-tight text-rose-600 tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        Sisa Waktu Server Hidup: {mm}:{ss}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="relative">
                <button
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="p-2.5 rounded-2xl transition-all relative group text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                >
                  <Bell className="w-6 h-6" />
                  {notifications.some(n => !n.read_at) && (
                    <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                  )}
                </button>

                <AnimatePresence>
                  {showNotifDropdown && (
                    <motion.div
                      ref={notifRef}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900">Notifikasi</h3>
                          {notifications.length > 0 && (
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                              {notifications.filter(n => !n.read_at).length} Baru
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="max-h-96 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Inbox className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm italic">Belum ada notifikasi</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {notifications
                              .slice()
                              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                              .map((n) => {
                                const data = n.data || {};
                                const title = stripEmoji(n.title || data.title || 'Notifikasi');
                                const message = stripEmoji(n.text || n.message || data.message || data.text || '');
                                const type = n.type || data.type || 'info';
                                const isUnread = !n.read_at;

                                return (
                                  <div
                                    key={n.id}
                                    onClick={() => handleMarkAsRead(n)}
                                    className={`p-4 transition-all cursor-pointer relative group ${isUnread ? 'bg-blue-100/80 hover:bg-blue-100' : 'hover:bg-slate-50'}`}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-0.5">
                                        <p className="text-sm font-bold leading-snug text-gray-900">
                                          {title}
                                        </p>
                                        {isUnread && (
                                          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                                            BARU
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                                        <NotificationMessageBody notification={n} message={message} compact />
                                      </div>
                                      <div className="flex items-center justify-between mt-2">
                                        <p className="text-[10px] text-gray-400 font-medium">{n.created_at}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-50 bg-gray-50/50 flex justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearAllNotifications();
                            }}
                            className="flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95 group"
                          >
                            <Trash2 className="w-3.5 h-3.5 group-hover:animate-bounce" />
                            Hapus Semua
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-black text-gray-900">{user.name || 'Pengguna'}</p>
                  <div className="flex flex-col items-end gap-1">
                    {isSpecialStaff ? (
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                        {getAccessRoleLabel(user)}
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                        {getAccessRoleLabel(user)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md overflow-hidden">
                  {userAvatarUrl ? (
                    <img src={userAvatarUrl} alt={user.name || 'User'} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside className={`fixed top-16 left-0 h-[calc(100vh-4rem)] border-r transition-all duration-500 z-30 w-64 bg-white border-gray-200 ${sidebarOpen ? 'hidden lg:block' : 'hidden'}`}>

        <div className="p-4 h-full flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar scroll-smooth">
            <div className="pb-2">
              {isSpecialStaff ? (
                <div className="space-y-5">
                  {specialStaffMenuSections.map((section) => (
                    <div key={section.label}>
                      <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                        {section.label}
                      </p>
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleMenuClick(item)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left mb-1.5 group relative ${activeTab === item.id
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'hover:bg-blue-50 text-gray-600'
                            }`}
                        >
                          <item.icon className={`w-5 h-5 transition-all duration-300 ${activeTab === item.id
                            ? 'text-indigo-600'
                            : 'text-gray-400 group-hover:text-blue-600'
                            }`} />
                          <span className={`text-sm font-black tracking-tight ${activeTab === item.id
                            ? 'text-indigo-700'
                            : 'group-hover:text-gray-900'
                            }`}>
                            {item.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <p className="px-4 text-[10px] font-bold uppercase tracking-widest mb-4 text-gray-400">
                    Main Menu
                  </p>
                  {filteredMenuItems.map((item) => (
                    <React.Fragment key={item.id}>
                      {item.hasDivider && (
                        <div className="my-3 border-t border-slate-200/80 pt-3">
                          <div className="px-4 pb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                            <Sparkles size={11} className="text-emerald-500 animate-pulse" />
                            <span>Menu Khusus</span>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => handleMenuClick(item)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left mb-1.5 group relative ${
                          item.isSpecialHomeroom
                            ? (usesManagedSidebarSelection && activeTab === item.id)
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                              : 'bg-emerald-50/70 border border-emerald-200/60 text-emerald-800 hover:bg-emerald-100/70'
                            : (usesManagedSidebarSelection && activeTab === item.id)
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'hover:bg-blue-50 text-gray-600'
                        }`}
                      >
                        <item.icon className={`w-5 h-5 transition-all duration-300 ${
                          item.isSpecialHomeroom
                            ? (usesManagedSidebarSelection && activeTab === item.id)
                              ? 'text-white'
                              : 'text-emerald-600 group-hover:scale-110'
                            : (usesManagedSidebarSelection && activeTab === item.id)
                              ? 'text-indigo-600'
                              : 'text-gray-400 group-hover:text-blue-600'
                        }`} />
                         <span className={`text-sm font-black tracking-tight ${
                           item.isSpecialHomeroom
                             ? (usesManagedSidebarSelection && activeTab === item.id)
                               ? 'text-white'
                               : 'text-emerald-900'
                             : (usesManagedSidebarSelection && activeTab === item.id)
                               ? 'text-indigo-700'
                               : 'group-hover:text-gray-900'
                         }`}>{item.title}</span>
                         {isStudentRole && item.id === 'news' && studentInfoUnread > 0 && (
                           <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                             <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-rose-200" />
                             {studentInfoUnread > 9 ? (
                               <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white">9+</span>
                             ) : (
                               <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white">{studentInfoUnread}</span>
                             )}
                           </span>
                         )}
                       </button>
                    </React.Fragment>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="pt-4 border-t space-y-1 border-gray-100">
            {/* TAHAP 3: Pencadangan Data - Only show when Super Admin impersonates another user */}
            {isImpersonating && (
              <button
                onClick={() => {
                  setActiveTab('data-backup');
                  navigate('/dashboard/data-backup');
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left group ${activeTab === 'data-backup'
                  ? 'bg-amber-50 text-amber-600'
                  : 'hover:bg-amber-50/50'
                  }`}
              >
                <Zap className={`w-5 h-5 transition-colors ${activeTab === 'data-backup'
                  ? 'text-amber-600'
                  : 'text-amber-400 group-hover:text-amber-600'
                  }`} />
                <span className={`text-sm font-black tracking-tight ${activeTab === 'data-backup'
                  ? 'text-amber-700'
                  : 'text-amber-600 group-hover:text-amber-700'
                  }`}>Pencadangan Data</span>
              </button>
            )}

            <button
              onClick={openSettings}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left group ${activeTab === 'settings'
                ? 'bg-blue-50 text-blue-600'
                : 'hover:bg-gray-50'
                }`}
            >
              <Settings className={`w-5 h-5 transition-colors ${activeTab === 'settings'
                ? 'text-blue-600'
                : 'text-gray-400 group-hover:text-blue-500'
                }`} />
              <span className={`text-sm font-black tracking-tight ${activeTab === 'settings'
                ? 'text-blue-700'
                : 'text-gray-600 group-hover:text-gray-900'
                }`}>Pengaturan</span>
            </button>

            <button
              onClick={handleResetDemo}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left group hover:bg-amber-50 text-amber-600"
              title="Kembalikan data demo ke kondisi awal"
            >
              <Trash2 className="w-5 h-5 transition-colors text-amber-400 group-hover:text-amber-600" />
              <span className="text-sm font-black tracking-tight">Reset Data Demo</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left group hover:bg-red-50 text-red-500"
            >
              <LogoutLeftIcon size={20} className="transition-colors text-red-400 group-hover:text-red-600" />
              <span className="text-sm font-black tracking-tight">Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`pt-16 transition-all duration-300 min-h-screen ${sidebarOpen ? 'lg:pl-64' : ''}`}>
        <div className="p-2 sm:px-3 sm:py-2 w-full">
          <CleaningBanner />
          <Suspense fallback={<DashboardChunkFallback />}>
          {activeTab === 'data-backup' ? (
            <DataBackupPage user={user} />
          ) : activeTab === 'settings' ? (
            <SettingsDashboard user={user} onUserUpdate={setUser} />
          ) : isSpecialStaff ? (
            renderSpecialStaffWorkspace()
          ) : accessRole === 'operator' ? (
            <SuperAdminDashboard activeTab={activeTab} setActiveTab={handleTabNavigation} />
          ) : accessRole === 'admin_akademik' ? (
            <AdminAkademikDashboard activeTab={activeTab} setActiveTab={handleTabNavigation} />
          ) : accessRole === 'guru' ? (
            <TeacherDashboard activeTab={activeTab} onNavigate={handleTabNavigation} />
          ) : accessRole === 'murid' ? (
            <StudentDashboard activeTab={activeTab} user={user} />
          ) : accessRole === 'pusat_jurusan' ? (
            <PusatJurusanDashboard activeTab={activeTab} user={user} onSelectJurusan={dismissToast} onJurusanStateChange={(isSelected) => setSidebarOpen(isSelected)} />
          ) : isCashierWorkspace ? (
            <ErrorBoundary>
              <CashierDashboard activeMenu={activeTab} user={user} />
            </ErrorBoundary>
          ) : isExecutive ? (
            <ExecutiveDashboard activeTab={activeTab} user={user} />
          ) : (
            <div className="space-y-8 animate-fadeIn">
              {/* Welcome Section */}
              <div>
                <h2 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
                  Selamat Datang, {user?.name || 'User'}! 👋
                </h2>
                <p className="text-gray-500 font-medium">
                  Manajemen data {getAccessRoleLabel(user)} Anda dalam satu aplikasi terintegrasi.
                </p>
              </div>

              {/* Stats Cards (Simplified for others) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                    <Users className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Status Keanggotaan</p>
                  <p className="text-2xl font-black text-gray-800">Aktif</p>
                </div>
              </div>

              {/* Menu Grid */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900 border-l-4 border-blue-600 pl-4 capitalize">
                    Akses {getAccessRoleLabel(user)}
                  </h3>
                  {searchQuery && (
                    <span className="text-xs text-gray-400 italic">Menampilkan hasil untuk "{searchQuery}"</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredMenuItems.length > 0 ? (
                    filteredMenuItems.map((menu) => {
                      const Icon = menu.icon;
                      return (
                        <motion.button
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          key={menu.id}
                          onClick={() => navigate(menu.path)}
                          className="p-6 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex items-start gap-4 group"
                        >
                          <div className={`p-4 rounded-2xl text-white shadow-lg shadow-gray-200 ${menu.color} group-hover:scale-110 transition-transform`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                              {menu.title}
                            </h4>
                            <p className="text-sm text-gray-500 font-medium leading-relaxed">
                              {menu.description}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })
                  ) : (
                    <div className="col-span-full py-12 text-center bg-gray-100/50 rounded-3xl border-2 border-dashed border-gray-200">
                      <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-bold">Menu tidak ditemukan</p>
                      <button onClick={() => setSearchQuery('')} className="text-blue-600 text-sm font-bold mt-2 hover:underline">Hapus pencarian</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          </Suspense>
        </div>
      </main>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.2, filter: "blur(10px)" }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              transition: {
                type: "spring",
                stiffness: 350,
                damping: 20
              }
            }}
            exit={{
              opacity: 0,
              y: 50,
              scale: 0.2,
              filter: "blur(10px)",
              transition: { duration: 0.4, ease: "circIn" }
            }}
            className="fixed bottom-10 right-10 z-[100] w-max max-w-[90vw]"
          >
            <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-2 backdrop-blur-3xl ${toast.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100'
              : 'bg-amber-950/95 border-amber-600 text-amber-50'
              }`}>
              <div className={`p-1.5 rounded-lg ${toast.type === 'success' ? 'bg-emerald-500/20' : 'bg-amber-600/20'
                }`}>
                {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shadow-lg" /> : <AlertTriangle className="w-5 h-5 shadow-lg text-amber-400" />}
              </div>
              <span className="font-bold tracking-tight text-[11px] sm:text-xs whitespace-nowrap overflow-hidden">
                {toast.message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md"
            onClick={() => !isDeletingNotif && setShowDeleteConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <p className="text-xl font-black text-gray-900 mb-8 mt-2">Hapus notifikasi ini?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeletingNotif}
                  className="flex-1 px-6 py-3 bg-gray-50 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteNotification}
                  disabled={isDeletingNotif}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50"
                >
                  {isDeletingNotif ? '...' : 'Hapus'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Custom Clear All Confirmation Modal */}
      {showClearAllConfirm && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md"
            onClick={() => !isClearingAll && setShowClearAllConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <p className="text-xl font-black text-gray-900 mb-2 mt-2">Bersihkan Notifikasi?</p>
              <p className="text-sm text-gray-500 mb-8 font-medium">Seluruh riwayat notifikasi Anda akan dihapus secara permanen dari sistem.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearAllConfirm(false)}
                  disabled={isClearingAll}
                  className="flex-1 px-6 py-3 bg-gray-50 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={confirmClearAllNotifications}
                  disabled={isClearingAll}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50"
                >
                  {isClearingAll ? '...' : 'Bersihkan'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Notification Detail Modal */}
      <AnimatePresence>
        {selectedNotif && (() => {
          const n = selectedNotif;
          const data = n.data || {};
          const title = n.title || data.title || 'Notifikasi';
          const message = n.text || n.message || data.message || data.text || '';
          const type = n.type || data.type || 'info';
          const iconMap = {
            success: <CheckCircle className="w-6 h-6 text-emerald-500" />,
            warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
            error: <ShieldAlert className="w-6 h-6 text-rose-500" />,
            info: <Info className="w-6 h-6 text-blue-500" />,
            announcement: <Bell className="w-6 h-6 text-indigo-500" />,
          };
          const colorMap = {
            success: 'border-emerald-200 bg-emerald-50',
            warning: 'border-amber-200 bg-amber-50',
            error: 'border-rose-200 bg-rose-50',
            info: 'border-blue-200 bg-blue-50',
            announcement: 'border-indigo-200 bg-indigo-50',
          };
          return (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
                onClick={() => setSelectedNotif(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
              >
                <div className="pointer-events-auto w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                  <div className={`px-8 py-6 flex items-center justify-between border-b ${colorMap[type] || colorMap.info}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${type === 'announcement' ? 'bg-indigo-600 text-white' : 'bg-white'}`}>
                        {iconMap[type] || iconMap.info}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Detail Notifikasi</span>
                        <p className="font-black text-gray-900 text-lg leading-tight truncate max-w-[300px]">{title}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedNotif(null)}
                      className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors text-gray-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="px-8 py-8 overflow-y-auto custom-scrollbar flex-1">
                    {type === 'announcement' ? (
                      <div className="space-y-6">
                        <div
                          className="prose prose-indigo max-w-none text-slate-700 leading-relaxed text-sm"
                          dangerouslySetInnerHTML={{ __html: n.fullDetail ? n.content : message }}
                        />

                        {/* Multiple Images */}
                        {n.images && n.images.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                            {n.images.map((img, i) => (
                              <div key={i} className="aspect-video rounded-3xl overflow-hidden border border-gray-100 bg-gray-50 shadow-sm group">
                                <img src={img.url || img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Attachment */}
                        {n.attachment && (
                          <div className="p-6 rounded-[2rem] bg-indigo-50/50 border border-indigo-100 flex items-center justify-between group hover:bg-indigo-50 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                <FileText size={20} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest mb-0.5">Lampiran Dokumen</span>
                                <span className="text-sm font-bold text-gray-700 truncate max-w-[200px]">{n.attachment.name || 'Dokumen Terlampir'}</span>
                              </div>
                            </div>
                            <a
                              href={n.attachment.url || `${BASE_URL}/storage/${n.attachment.path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            >
                              Buka File
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="px-2 py-4 text-[15px] font-medium leading-relaxed text-slate-600">
                        <NotificationMessageBody notification={n} message={message} />
                      </div>
                    )}
                  </div>

                  <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Waktu Terkirim</span>
                      <span className="text-xs font-bold text-gray-600">{formatWaktuId(n)}</span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleDeleteNotification(n.id)}
                        disabled={isDeletingNotif}
                        className="px-6 py-3 bg-white text-rose-600 border border-rose-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isDeletingNotif ? 'Menghapus...' : 'Hapus Notifikasi'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
      {/* Sleep Mode Countdown Overlay Isolated Component */}
      <SleepModeOverlay
        show={showSleepOverlay && !isMaster}
        onFinish={() => exitToSleepPage()}
      />

      {/* Alumni Reminder Popup (Masa Aktif) - Muncul sekali per login.
          Portal langsung ke body tanpa AnimatePresence, karena AnimatePresence
          membuang portal (bukan React element) sehingga modal tidak tampil. */}
      {showAlumniPopup && alumniReminder && createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={handleDismissAlumniPopup}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-amber-600 p-6 text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Pemberitahuan Masa Aktif</h3>
              </div>
              <div className="p-8 space-y-4">
                <p className="text-slate-600 text-center font-medium leading-relaxed">
                  Masa aktif akun Anda akan berakhir pada <strong className="text-amber-600">{alumniReminder.remind_at_label}</strong>.
                  Akun Anda akan dipindahkan ke Alumni.
                </p>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <p className="text-sm font-bold text-amber-800">
                    Sisa waktu: {alumniReminder.days_left} hari
                  </p>
                </div>
                <button
                  onClick={handleDismissAlumniPopup}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-lg"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>,
          document.body
        )}
    </div>
  );
}

// Komponen Terisolasi agar re-render setiap detik tidak membebani Dashboard utama
const SleepModeOverlay = ({ show, onFinish }) => {
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (!show) {
      setCountdown(null);
      return;
    }

    // Inisialisasi/Restore dari sessionStorage
    const startedAt = sessionStorage.getItem('sleep_countdown_started');
    let initialValue = 60;

    if (startedAt) {
      const elapsed = Math.floor((Date.now() - parseInt(startedAt)) / 1000);
      initialValue = Math.max(0, 60 - elapsed);
    } else {
      sessionStorage.setItem('sleep_countdown_started', Date.now().toString());
    }

    setCountdown(initialValue);
  }, [show]);

  useEffect(() => {
    if (countdown === null || !show) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onFinish();
    }
  }, [countdown, show, onFinish]);

  if (!show || countdown === null || countdown <= 0) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-center border border-gray-100 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-rose-600" />

        <div className="w-24 h-24 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-rose-100">
          <span className="text-5xl font-black text-rose-600 tabular-nums">{countdown}</span>
        </div>

        <h3 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">Sesi Segera Berakhir</h3>
        <p className="text-[14px] font-medium text-gray-500 leading-relaxed mb-6 px-4">
          Server akan ditutup. Kami anggap anda telah menyimpan pekerjaan terakhir anda. Selamat beristirahat.
          <span className="block mt-4 text-[11px] font-black text-gray-400 uppercase tracking-widest italic">
            - Master Akun Operator Sekolah -
          </span>
        </p>
      </motion.div>
    </div>
  );
};
