import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import CinematicLoading from '../../../components/dashboard/shared/CinematicLoading';

import {
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layout,
  LayoutDashboard,
  Shield,
  Upload,
  Users,
  MessageSquare, 
  ArrowRight,
  TrendingUp,
  Loader2,
  User,
  Image as ImageIcon,
  Sparkles,
  Plus,
  X,
  ExternalLink,
  ChevronRight,
  Layers,
  School,
  HelpCircle,
  Megaphone,
  Inbox
} from 'lucide-react';
import toast from 'react-hot-toast';
import { teacherAPI, tugasAPI, informationCenterAPI, calendarAPI } from '../../../utils/api';
import CalendarTab from '../AdminAkademik/components/Calendar/CalendarTab';
import InformationCenterTab from '../../../components/dashboard/shared/InformationCenterTab';
import TugasEvaluasiTab from './components/TugasEvaluasiTab';
import EPresensiTab from './components/EPresensiTab';
import MateriSoalWorkspace from './components/MateriSoalWorkspace';
// JadwalMengajarTab removed — "Jadwal lengkap" now redirects to attendance tab
import HomeroomTab from './components/HomeroomTab';

const TeacherDashboard = ({ activeTab, onNavigate }) => {
  const handleTabNavigate = (tab) => {
    if (typeof onNavigate === 'function') {
      onNavigate(tab);
    }
    window.dispatchEvent(new CustomEvent('navigateDashboard', { detail: tab }));
  };

  const [kpi, setKpi] = useState(null);
  const [classes, setClasses] = useState([]);
  const [homeroomData, setHomeroomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quickAction, setQuickAction] = useState(null);

  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

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

  useEffect(() => {
    fetchTeacherData();
  }, []);

  // Quick action tertunda (mis. dari tombol Beranda) — disimpan di sessionStorage
  // agar tetap terbaca meski komponen tab di-remount saat pindah tab.
  useEffect(() => {
    const pending = sessionStorage.getItem('teacher_pending_action');
    if (pending) {
      sessionStorage.removeItem('teacher_pending_action');
      setQuickAction(pending);
    }
  }, [activeTab]);

  // Sync summary data when returning to summary tab
  useEffect(() => {
    if (activeTab === 'summary') {
      // Refresh data from the API when returning to the dashboard.
      fetchTeacherData();
    }
  }, [activeTab]);

  const fetchTeacherData = async () => {
    try {
      setLoading(true);

      const promises = [
        teacherAPI.getDashboardKPI(),
        teacherAPI.getClasses(),
      ];

      // Prefetch homeroom data in background if user is homeroom teacher
      if (user?.isHomeroomTeacher) {
        promises.push(teacherAPI.getHomeroom().catch(() => ({ data: null })));
      }

      const results = await Promise.all(promises);
      const [kpiRes, classRes, homeroomRes] = results;

      setKpi(kpiRes.data?.data ?? null);
      setClasses(classRes.data.data || []);
      if (homeroomRes?.data) {
        setHomeroomData(homeroomRes.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !kpi) {
    return <CinematicLoading roleName="Guru" />;
  }

  return (
    <div className={['news', 'materials', 'questions', 'attendance', 'grades', 'calendar_ta', 'homeroom'].includes(activeTab) ? 'animate-fadeIn' : 'space-y-8 pb-20 animate-fadeIn'}>
      {!['news', 'materials', 'questions', 'attendance', 'grades', 'calendar_ta', 'homeroom'].includes(activeTab) && (
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="overflow-hidden rounded-[2rem] border border-green-100 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] p-6 lg:p-8">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
                <GraduationCap className="h-3 w-3" /> Portal Teachers Workspace
              </div>
              {/* Clock WIB */}
              <div className="flex flex-col items-end gap-1 px-4 py-2 rounded-2xl bg-white/80 border border-green-100 shadow-sm shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clock.day},</span>
                  <span className="text-xs font-bold text-slate-500">{clock.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-400" />
                  <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clock.time}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
                </div>
              </div>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {activeTab === 'assignments' ? 'Penilaian & Tugas Harian' : 'Dashboard Utama'}
            </h1>
            <p className="mt-2 text-sm italic leading-7 text-slate-600">
              {activeTab === 'assignments'
                ? 'Pusat kontrol tugas, kuis, pengumpulan siswa, dan nilai harian kelas yang Anda ampu.'
                : '"Mendedikasikan diri untuk mencetak generasi cerdas dan berkarakter. Menanam benih ilmu hari ini untuk memanen masa depan yang lebih cerah."'}
            </p>

          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'summary' && (
          <SummaryTab
            kpi={kpi}
            classes={classes}
            clock={clock}
            user={user}
            onNavigate={handleTabNavigate}
          />
        )}

        {activeTab === 'homeroom' && (
          <div key="homeroom">
            <HomeroomTab
              clock={clock}
              user={user}
              initialData={homeroomData}
              onDataUpdated={setHomeroomData}
            />
          </div>
        )}

        {activeTab === 'assignments' && (
          <motion.div key="assignments" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TugasEvaluasiTab clock={clock} quickAction={quickAction} onQuickActionConsumed={() => setQuickAction(null)} />
          </motion.div>
        )}

        {activeTab === 'calendar_ta' && (
          <motion.div key="calendar_ta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-8 animate-fadeIn">
            {/* Header Badge â€” mirip Admin Akademik */}
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
          </motion.div>
        )}

        {activeTab === 'news' && (
          <motion.div key="news" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <InformationCenterTab />
          </motion.div>
        )}

        {activeTab === 'attendance' && (
          <motion.div key="attendance" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EPresensiTab clock={clock} />
          </motion.div>
        )}

        {activeTab === 'grades' && (
          <motion.div key="grades" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TugasEvaluasiTab clock={clock} initialSection="grades" />
          </motion.div>
        )}

        {(activeTab === 'materials' || activeTab === 'questions') && (
          <motion.div key={`materials-${activeTab}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <MateriSoalWorkspace
              clock={clock}
              initialTab={activeTab === 'questions' ? 'questions' : 'materials'}
              quickAction={quickAction}
              onQuickActionConsumed={() => setQuickAction(null)}
            />
          </motion.div>
        )}

        {/* 'calendar' tab removed — JadwalMengajarTab no longer routed */}
      </AnimatePresence>
    </div>
  );
};

// Dashboard ringkas guru; hero Area Kerja Guru tetap dirender oleh parent.
// KPI & jadwal 100% dari DB (endpoint /teacher/dashboard-kpi + rekaman KBM),
// kartu Kabar Terbaru mengadopsi pola komponen Pusjur (AGENDA / INFORMASI).
const STATUS_BADGE = {
  live: { label: 'Sedang Berlangsung', cls: 'bg-emerald-500 text-white', pulse: true },
  saved: { label: 'Tersimpan', cls: 'bg-sky-100 text-sky-700', pulse: false },
  upcoming: { label: 'Akan Datang', cls: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200', pulse: false },
  outside: { label: 'Di Luar Jam Mengajar', cls: 'bg-slate-100 text-slate-400', pulse: false },
};

const getJakartaTimeStr = () => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date());

const SummaryTab = ({
  kpi,
  classes = [],
  clock,
  user,
  onNavigate,
}) => {
  const [sessions, setSessions] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState('');

  // Modals di Dashboard
  const [previewAnnouncement, setPreviewAnnouncement] = useState(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isUploadMaterialModalOpen, setIsUploadMaterialModalOpen] = useState(false);

  // Kabar Terbaru (pola Pusjur): switcher AGENDA / INFORMASI
  const [kabarTab, setKabarTab] = useState('informasi');
  const [agendaList, setAgendaList] = useState([]);
  const [infos, setInfos] = useState([]);

  // Form State: Buat Tugas Baru
  const [taskForm, setTaskForm] = useState({
    judul: '',
    school_class_id: '',
    subject: '',
    deadline: '',
    bobot: 20,
    deskripsi: '',
  });
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Form State: Upload Materi Baru
  const [materialForm, setMaterialForm] = useState({
    title: '',
    class_name: '',
    subject: '',
    description: '',
    file: null,
  });
  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadTodaySchedule = async () => {
      setScheduleLoading(true);
      setScheduleError('');
      try {
        const now = new Date();
        const dayNames = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
        const hari = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Jakarta' })
          .format(now).toLowerCase();
        const dayMap = { sun: 'minggu', mon: 'senin', tue: 'selasa', wed: 'rabu', thu: 'kamis', fri: 'jumat', sat: 'sabtu' };
        const tanggal = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(now);
        const hariIni = dayMap[hari] || dayNames[now.getDay()];
        // Sumber identik kartu sesi KBM & Presensi: jadwal + rekap presensi + jurnal hari ini.
        const [response, recapRes, jrRes] = await Promise.all([
          teacherAPI.getMySchedule({ hari: hariIni, tanggal }),
          teacherAPI.getAttendanceRecap({ start_date: tanggal, end_date: tanggal }).catch(() => ({ data: { data: [] } })),
          teacherAPI.getJournals({ tanggal, per_page: 100 }).catch(() => ({ data: { data: { data: [] } } })),
        ]);
        const list = response.data?.data || [];
        const jrList = jrRes.data?.data?.data || [];
        const recapRows = (recapRes.data?.data || []).filter((r) => String(r.tanggal).slice(0, 10) === tanggal);

        const rows = list.map((item) => {
          const jamStart = item.jam_mulai ? String(item.jam_mulai).slice(0, 5) : '-';
          const used = recapRows.filter((r) => (
            String(r.jam_ke).slice(0, 5) === jamStart
            && String(r.nama_kelas || '') === String(item.kelas_nama || '')
            && String(r.nama_mapel || '') === String(item.mapel_nama || '')
          ));
          const jurnal = jrList.find((j) => (
            String(j.jam_ke).slice(0, 5) === jamStart
            && Number(j.kelas_id) === Number(item.kelas_id)
            && Number(j.mapel_id) === Number(item.mapel_id)
          ));
          return {
            ...item,
            jamStart,
            saved: used.length > 0 || Boolean(jurnal),
            hadir: used.filter((r) => r.status === 'hadir' || r.status === 'terlambat').length,
            tercatat: used.length,
            materi: jurnal?.materi_pokok || null,
          };
        });
        if (!cancelled) setSessions(rows);
      } catch (error) {
        if (!cancelled) {
          setSessions([]);
          setScheduleError(error.response?.data?.message || 'Jadwal hari ini belum dapat dimuat.');
        }
      } finally {
        if (!cancelled) setScheduleLoading(false);
      }
    };
    loadTodaySchedule();
    return () => { cancelled = true; };
  }, [clock.day, clock.date]);

  // Kabar Terbaru — sumber sah utk role Guru: agenda (academic-calendar/events) +
  // informasi (information-center, publik). Tidak ada endpoint operator di sini.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [evRes, infoRes] = await Promise.all([
        calendarAPI.getEvents().catch(() => null),
        informationCenterAPI.getInfos({ per_page: 5 }).catch(() => null),
      ]);
      if (!alive) return;
      const evRows = evRes?.data?.data ?? evRes?.data ?? [];
      setAgendaList((Array.isArray(evRows) ? evRows : []).map((e) => ({ id: e.id, nama: e.title || e.nama, tanggal: e.event_date || e.tanggal, dibuat: e.created_at })));
      const infoRows = infoRes?.data?.data ?? infoRes?.data ?? [];
      setInfos(Array.isArray(infoRows) ? infoRows : []);
    })();
    return () => { alive = false; };
  }, []);

  const formatAgendaDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Status sesi real-time — logika identik kartu KBM & Presensi (dievaluasi ulang
  // tiap render karena prop clock tick per detik).
  const sessionStatus = (item) => {
    const nowT = getJakartaTimeStr();
    const live = nowT >= String(item.jam_mulai).slice(0, 8) && nowT < String(item.jam_selesai).slice(0, 8);
    const future = nowT < String(item.jam_mulai).slice(0, 8);
    return live ? 'live' : future ? 'upcoming' : item.saved ? 'saved' : 'outside';
  };

  const displayName = user?.name || user?.nama || 'Bapak/Ibu Guru';
  const greeting = (() => {
    const hour = Number(String(clock.time || '0').split(':')[0]);
    if (hour >= 5 && hour < 11) return 'Selamat pagi';
    if (hour >= 11 && hour < 15) return 'Selamat siang';
    if (hour >= 15 && hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  })();

  const formatShortDate = (dateStr) => {
    if (!dateStr) return 'Hari ini';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Hari ini';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const formatAuthorText = (item) => {
    if (!item) return 'Super Admin';
    if (item.author_role && typeof item.author_role === 'string') {
      return item.author_role.replace(/\s*[—–-]\s*/g, ' - ');
    }
    const name = item.author?.name || item.author_name || item.created_by || '';
    const roleRaw = item.author?.access_role || item.author?.role || item.role || '';
    const roleMap = {
      superadmin: 'Super Admin',
      operator: 'Super Admin',
      admin_akademik: 'Admin Akademik',
      guru: 'Guru',
      wakil_sekolah: 'Wakasek',
      kepala_sekolah: 'Kepala Sekolah',
      pusat_jurusan: 'Pusat Jurusan',
      cashier: 'Keuangan',
    };
    const roleFormatted = roleMap[roleRaw.toLowerCase()] || (roleRaw ? roleRaw.toUpperCase() : 'Admin');
    if (name && roleFormatted) {
      return `${name} - ${roleFormatted}`;
    }
    if (name) return name;
    return 'Super Admin';
  };

  const checkHasImage = (item) => {
    if (Array.isArray(item.images) && item.images.length > 0) return true;
    if (item.image_url || item.lampiran_gambar || item.foto) return true;
    if (item.attachment && (item.attachment.is_image || /\.(jpg|jpeg|png|webp|gif)$/i.test(item.attachment.name || item.attachment.url || ''))) return true;
    return false;
  };

  // Badge "baru" pada switcher Kabar Terbaru (pola Pusjur).
  const isSameLocalDay = (dateStr) => {
    if (!dateStr) return false;
    const dt = new Date(dateStr); const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
  };
  const hasNewAgenda = agendaList.length > 0 && isSameLocalDay(agendaList[0].dibuat);
  const hasNewInfo = infos.length > 0 && infos[0].is_read === false;

  const openAnnouncement = (ann) => {
    if (ann.is_read === false) {
      setInfos((prev) => prev.map((it) => (it.id === ann.id ? { ...it, is_read: true } : it)));
      informationCenterAPI.markAsRead(ann.id).then(() => window.dispatchEvent(new Event('info-unread:refresh'))).catch(() => {});
    }
    setPreviewAnnouncement(ann);
  };

  // Submit Handler: Buat Tugas Baru
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.judul.trim()) {
      toast.error('Judul tugas wajib diisi');
      return;
    }
    if (!taskForm.school_class_id) {
      toast.error('Pilih kelas tujuan');
      return;
    }
    setIsSubmittingTask(true);
    try {
      const payload = {
        judul: taskForm.judul.trim(),
        school_class_id: taskForm.school_class_id,
        subject_id: taskForm.subject || null,
        deadline: taskForm.deadline || null,
        bobot: Number(taskForm.bobot) || 20,
        deskripsi: taskForm.deskripsi.trim() || 'Tugas harian mandiri',
      };
      await tugasAPI.create(payload);
      toast.success('Tugas baru berhasil dibuat & dipublikasikan!');
      setIsCreateTaskModalOpen(false);
      setTaskForm({ judul: '', school_class_id: '', subject: '', deadline: '', bobot: 20, deskripsi: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuat tugas');
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Submit Handler: Upload Materi Baru
  const handleUploadMaterial = async (e) => {
    e.preventDefault();
    if (!materialForm.title.trim()) {
      toast.error('Judul materi wajib diisi');
      return;
    }
    if (!materialForm.class_name) {
      toast.error('Pilih kelas tujuan');
      return;
    }
    setIsSubmittingMaterial(true);
    try {
      const formData = new FormData();
      formData.append('title', materialForm.title.trim());
      formData.append('class_name', materialForm.class_name);
      formData.append('subject', materialForm.subject.trim() || 'Materi Umum');
      formData.append('description', materialForm.description.trim() || '-');
      if (materialForm.file) {
        formData.append('file', materialForm.file);
      }
      await teacherAPI.saveMaterial(formData);
      toast.success('Materi pembelajaran berhasil diunggah!');
      setIsUploadMaterialModalOpen(false);
      setMaterialForm({ title: '', class_name: '', subject: '', description: '', file: null });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunggah materi');
    } finally {
      setIsSubmittingMaterial(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Sapaan Guru & Tombol Aksi Cepat (Bersih & Elegan, Tanpa Wadah Hero Tambahan) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">{greeting},</p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mt-1">
            {displayName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Ringkasan jadwal mengajar, materi kelas, dan informasi sekolah hari ini.
          </p>
        </div>

        {/* Tombol Aksi Berwarna Premium */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button 
            type="button" 
            onClick={() => { sessionStorage.setItem('teacher_pending_action', 'create-task'); onNavigate('assignments'); }} 
            className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 px-5 py-3 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-95"
          >
            <Plus className="h-4 w-4 text-white" /> Buat Tugas Baru
          </button>
          <button 
            type="button" 
            onClick={() => { sessionStorage.setItem('teacher_pending_action', 'upload-material'); onNavigate('materials'); }} 
            className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 px-5 py-3 text-xs sm:text-sm font-extrabold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-95"
          >
            <Upload className="h-4 w-4 text-white" /> Upload Materi
          </button>
        </div>
      </div>

      {/* ── 2. 4 Metric Cards Real-Time (semua angka dari /teacher/dashboard-kpi) ─ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Card 1: Kelas & Jadwal Hari Ini */}
        <div 
          onClick={() => onNavigate('attendance')}
          className="group cursor-pointer rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-white via-white to-emerald-50/50 p-5 shadow-sm transition-all hover:border-emerald-300 hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
              Kelas &amp; Jadwal
            </span>
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/30 text-xl font-bold transition-transform group-hover:scale-110">
              🏫
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900">{kpi?.kelas?.sesi_hari_ini ?? 0}</span>
            <span className="text-xs font-bold text-slate-500">Sesi Hari Ini</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 font-medium">{kpi?.kelas?.rombel ?? 0} rombel diampu</p>
        </div>

        {/* Card 2: Tugas Perlu Koreksi */}
        <div 
          onClick={() => onNavigate('assignments')}
          className="group cursor-pointer rounded-2xl border border-rose-100/80 bg-gradient-to-br from-white via-white to-rose-50/50 p-5 shadow-sm transition-all hover:border-rose-300 hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
              Perlu Koreksi
            </span>
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500 via-red-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-rose-500/30 text-xl font-bold transition-transform group-hover:scale-110">
              ✍️
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900">{kpi?.tugas?.perlu_koreksi ?? 0}</span>
            <span className="text-xs font-bold text-slate-500">Tugas</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-rose-600">
            {(kpi?.tugas?.perlu_koreksi ?? 0) > 0 ? 'Pengumpulan menunggu nilai' : 'Tidak ada antrean koreksi'}
          </p>
        </div>

        {/* Card 3: Materi & Bank Soal */}
        <div 
          onClick={() => onNavigate('materials')}
          className="group cursor-pointer rounded-2xl border border-purple-100/80 bg-gradient-to-br from-white via-white to-purple-50/50 p-5 shadow-sm transition-all hover:border-purple-300 hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
              Materi &amp; Bank Soal
            </span>
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 flex items-center justify-center text-white shadow-md shadow-purple-500/30 text-xl font-bold transition-transform group-hover:scale-110">
              📚
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900">{kpi?.materi?.berkas ?? 0}</span>
            <span className="text-xs font-bold text-slate-500">Berkas</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 font-medium">{kpi?.materi?.bank_soal_aktif ?? 0} paket soal aktif</p>
        </div>

        {/* Card 4: Progress Nilai Rapor */}
        <div 
          onClick={() => onNavigate('grades')}
          className="group cursor-pointer rounded-2xl border border-amber-100/80 bg-gradient-to-br from-white via-white to-amber-50/50 p-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
              Progress Rapor
            </span>
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-amber-500/30 text-xl font-bold transition-transform group-hover:scale-110">
              📊
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900">
              {kpi?.rapor?.total_pairs ? `${kpi.rapor.persen ?? 0}%` : '—'}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {kpi?.rapor?.total_pairs ? `${kpi.rapor.saved_pairs}/${kpi.rapor.total_pairs} kelas·mapel` : 'kelas·mapel'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {kpi?.rapor?.total_pairs ? (
              <div className="h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-amber-100">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-700" style={{ width: `${kpi.rapor.persen ?? 0}%` }} />
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-medium">Belum ada penugasan kelas/mapel</p>
            )}
            {kpi?.wali_kelas?.ada && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNavigate('homeroom'); }}
                className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 transition hover:bg-emerald-100"
              >
                Wali: {kpi.wali_kelas.kelas} <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Main Content: 2 Kolom Seimbang — Jadwal (kiri) | Kabar Terbaru (kanan) ── */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* KOLOM KIRI: Jadwal Mengajar Hari Ini (badge status identik KBM & Presensi) */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm self-start">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <Calendar className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-slate-900">Jadwal Mengajar Hari Ini</h3>
                <p className="text-xs text-slate-500">{clock.day || 'Hari ini'} · {clock.date || ''}</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => onNavigate('attendance')} 
              className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-900 transition"
            >
              Jadwal lengkap <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {scheduleLoading ? (
            <div className="px-5 py-10 text-center text-sm font-medium text-slate-400">
              Memuat jadwal hari ini…
            </div>
          ) : scheduleError ? (
            <div className="px-5 py-10 text-center text-sm font-medium text-rose-600">{scheduleError}</div>
          ) : sessions.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-bold text-slate-700">Tidak ada jadwal mengajar hari ini</p>
              <p className="mt-1 text-sm text-slate-500">Jadwal akan muncul di sini sesuai penugasan Anda.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map((item) => {
                const status = sessionStatus(item);
                const badge = STATUS_BADGE[status];
                return (
                  <article
                    key={item.jadwal_id}
                    onClick={() => onNavigate('attendance')}
                    className={`flex cursor-pointer flex-wrap items-center gap-4 px-5 py-4 transition ${status === 'live' ? 'bg-emerald-50/50 border-l-4 border-l-emerald-500' : 'hover:bg-slate-50/60'}`}
                  >
                    <div className="min-w-[112px]">
                      <p className="flex items-center gap-1.5 text-sm font-extrabold tabular-nums text-slate-800">
                        <Clock className="h-4 w-4 text-slate-400" />
                        {String(item.jam_mulai || '').slice(0, 5)}-{String(item.jam_selesai || '').slice(0, 5)}
                      </p>
                      {item.jam_ke && <p className="mt-1 text-xs font-medium text-slate-500">Jam ke-{item.jam_ke}</p>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-900">{item.mapel_nama || 'Mata pelajaran'}</p>
                      <p className="mt-1 text-xs text-slate-500 font-medium">
                        {item.kelas_nama || 'Kelas belum tersedia'}
                        {item.is_substitute_assignment ? ` - Guru Pengganti${item.guru_asli ? ` untuk ${item.guru_asli}` : ''}` : ''}
                      </p>
                      {status === 'saved' && (
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} /> {item.hadir}/{item.jumlah_siswa || item.tercatat} Hadir</span>
                          {item.materi && <span className="max-w-[150px] truncate text-slate-400" title={item.materi}>- {item.materi}</span>}
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${badge.cls}`}>
                      {badge.pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                      {badge.label}
                    </span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* KOLOM KANAN: KABAR TERBARU - adopsi penuh pola komponen Pusjur (endpoint sah utk guru) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm self-start">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md"><Megaphone className="h-5 w-5" /></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Kabar Terbaru</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setKabarTab('agenda')}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${kabarTab === 'agenda' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                Agenda {hasNewAgenda && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
              </button>
              <button type="button" onClick={() => setKabarTab('informasi')}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${kabarTab === 'informasi' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                Informasi {hasNewInfo && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
              </button>
            </div>
          </div>

          {kabarTab === 'agenda' ? (
            <div className="p-5">
              {agendaList.length > 0 ? (
                <div className="space-y-1">
                  {agendaList.map((ag) => (
                    <div key={ag.id} className="flex items-center group">
                      <span className="mr-3 font-black text-amber-500">-</span>
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
            <div className="space-y-3 p-4">
              {infos.length > 0 ? infos.slice(0, 4).map((ann) => {
                const isUnread = ann.is_read === false;
                const excerpt = String(ann.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                const dateLabel = (ann.published_at || ann.created_at) ? new Date(ann.published_at || ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-';
                return (
                  <button key={ann.id} onClick={() => openAnnouncement(ann)}
                    className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${isUnread ? 'border-rose-100 bg-rose-50/30' : 'border-slate-100 bg-white'}`}>
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
                      {excerpt && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{excerpt}</p>}
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <User className="h-3 w-3" /><span>{ann.author?.name || ann.author_name || 'Admin'}</span><span>-</span><span>{dateLabel}</span>
                      </div>
                    </div>
                    <Eye className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:text-blue-600 group-hover:scale-110" />
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

      {/* ── 4. MODAL: Pratinjau Pengumuman (Full Blur Layar via Portal Langsung Tanpa Animasi Blur) ──── */}
      {previewAnnouncement && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={() => setPreviewAnnouncement(null)}
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
                  {previewAnnouncement.category || 'Pengumuman'}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-semibold text-slate-500">
                  {new Date(previewAnnouncement.created_at || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setPreviewAnnouncement(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Isi Pengumuman */}
            <div className="overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <h3 className="text-xl font-black text-slate-900 leading-snug">
                {previewAnnouncement.title || previewAnnouncement.judul}
              </h3>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 pb-2 border-b border-slate-100">
                <User className="h-4 w-4 text-slate-400" />
                <span>Oleh: <strong className="text-slate-800">{formatAuthorText(previewAnnouncement)}</strong></span>
              </div>

              {/* Teks Isi */}
              <div 
                className="text-sm text-slate-700 leading-relaxed space-y-2 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: previewAnnouncement.content || previewAnnouncement.isi || '' }}
              />

              {/* Tampilan Gambar Lampiran */}
              {Array.isArray(previewAnnouncement.images) && previewAnnouncement.images.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-blue-600" /> Lampiran Gambar ({previewAnnouncement.images.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {previewAnnouncement.images.map((img, idx) => {
                      const imgUrl = typeof img === 'string' ? img : (img.url || img.path);
                      return (
                        <div key={idx} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          <img 
                            src={imgUrl.startsWith('http') || imgUrl.startsWith('/') ? imgUrl : `/storage/${imgUrl}`} 
                            alt={`Lampiran ${idx + 1}`}
                            className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300" 
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button 
                type="button" 
                onClick={() => {
                  setPreviewAnnouncement(null);
                  onNavigate('news');
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
              >
                Buka di Pusat Informasi <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button 
                type="button" 
                onClick={() => setPreviewAnnouncement(null)}
                className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-bold text-white hover:bg-slate-900 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 5. MODAL: Buat Tugas Baru (Tetap di Dashboard) ──────────────── */}
      {isCreateTaskModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={() => setIsCreateTaskModalOpen(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-2xl w-screen h-screen overflow-hidden"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 flex flex-col"
          >
            {/* Header Modal */}
            <div className="shrink-0 bg-gradient-to-r from-green-700 to-emerald-600 p-6 text-white flex items-center justify-between">
              <h4 className="font-black uppercase tracking-widest text-sm text-white">Buat Tugas / Kuis Baru</h4>
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-black tracking-wider text-emerald-100">Esc</span>
                <button 
                  type="button" 
                  onClick={() => setIsCreateTaskModalOpen(false)}
                  aria-label="Tutup (Esc)"
                  className="rounded-full p-2 text-white transition-all hover:bg-rose-500 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateTask} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Judul Tugas / Evaluasi <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Contoh: Tugas Harian 1 - Struktur Data"
                  value={taskForm.judul}
                  onChange={(e) => setTaskForm({ ...taskForm, judul: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Kelas Tujuan <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={taskForm.school_class_id}
                    onChange={(e) => setTaskForm({ ...taskForm, school_class_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                  >
                    <option value="">— Pilih Kelas Tujuan —</option>
                    {classes.map((c) => (
                      <option key={c.id || c.name} value={c.id || c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Mata Pelajaran
                  </label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Pemrograman Dasar"
                    value={taskForm.subject}
                    onChange={(e) => setTaskForm({ ...taskForm, subject: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Tenggat Waktu (Deadline)
                  </label>
                  <input 
                    type="datetime-local" 
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Bobot Nilai (%)
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    max="100"
                    value={taskForm.bobot}
                    onChange={(e) => setTaskForm({ ...taskForm, bobot: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Petunjuk &amp; Deskripsi Tugas
                </label>
                <textarea 
                  rows={3}
                  placeholder="Tuliskan petunjuk pengerjaan tugas untuk siswa..."
                  value={taskForm.deskripsi}
                  onChange={(e) => setTaskForm({ ...taskForm, deskripsi: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 resize-none"
                />
              </div>

              {/* Footer Modal Form */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsCreateTaskModalOpen(false)}
                  className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingTask}
                  className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-700 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmittingTask ? 'Menyimpan…' : 'Simpan & Publikasikan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── 6. MODAL: Upload Materi Baru (Tetap di Dashboard) ────────────── */}
      {isUploadMaterialModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={() => setIsUploadMaterialModalOpen(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-2xl w-screen h-screen overflow-hidden"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 flex flex-col"
          >
            {/* Header Modal */}
            <div className="shrink-0 bg-gradient-to-r from-green-700 to-emerald-600 p-6 text-white flex items-center justify-between">
              <h4 className="font-black uppercase tracking-widest text-sm text-white">Upload Materi Baru</h4>
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-black tracking-wider text-emerald-100">Esc</span>
                <button 
                  type="button" 
                  onClick={() => setIsUploadMaterialModalOpen(false)}
                  aria-label="Tutup (Esc)"
                  className="rounded-full p-2 text-white transition-all hover:bg-rose-500 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleUploadMaterial} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={16} className="text-emerald-600" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informasi Materi</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Judul Materi Ajar <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: Modul 1 - Pengenalan Algoritma"
                    value={materialForm.title}
                    onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Kelas Tujuan <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={materialForm.class_name}
                      onChange={(e) => setMaterialForm({ ...materialForm, class_name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                    >
                      <option value="">— Pilih Kelas Tujuan —</option>
                      {classes.map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Mata Pelajaran
                    </label>
                    <input 
                      type="text" 
                      placeholder="Contoh: Pemrograman Dasar"
                      value={materialForm.subject}
                      onChange={(e) => setMaterialForm({ ...materialForm, subject: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Deskripsi / Catatan Materi
                  </label>
                  <textarea 
                    rows={3}
                    placeholder="Tuliskan catatan pendukung mengenai materi yang diunggah..."
                    value={materialForm.description}
                    onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 resize-none"
                  />
                </div>
              </div>

              {/* Upload Area */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Upload size={16} className="text-emerald-600" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload File</span>
                </div>

                <label
                  className="block w-full cursor-pointer group"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); const f = event.dataTransfer.files?.[0]; if (f) setMaterialForm({ ...materialForm, file: f }); }}
                >
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setMaterialForm({ ...materialForm, file: e.target.files[0] || null })}
                  />
                  <div className="rounded-[2rem] border-2 border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-green-50/60 p-8 text-center transition-all group-hover:border-emerald-400 group-hover:shadow-inner">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
                      <Upload size={32} />
                    </div>
                    <p className="text-sm font-black text-slate-700">Drag &amp; drop file atau klik untuk upload</p>
                    <p className="text-xs text-slate-400 mt-2 font-medium">PDF, DOC, PPT, MP4, JPG, PNG</p>
                  </div>
                </label>

                {materialForm.file && (
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-white rounded-xl text-emerald-500 shadow-sm">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-700 truncate max-w-[300px]">{materialForm.file.name}</p>
                        <p className="text-[10px] font-bold text-emerald-600">{(materialForm.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMaterialForm({ ...materialForm, file: null })}
                      className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50"
                      aria-label="Hapus file terpilih"
                    >
                      <X size={16} /> Hapus
                    </button>
                  </div>
                )}
              </div>

              {/* Footer Modal Form */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsUploadMaterialModalOpen(false)}
                  className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingMaterial}
                  className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-700 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmittingMaterial ? 'Mengunggah…' : 'Upload Materi'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TeacherDashboard;
