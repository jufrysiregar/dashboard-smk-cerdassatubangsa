import React, { useState, useEffect } from 'react';
// Force reload comment
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Layout, Users, Shield, Bell, Calendar, Monitor, HelpCircle, Loader2, Clock, LayoutDashboard } from 'lucide-react';
import { operatorAPI, calendarAPI, informationCenterAPI, systemAPI } from '../../../utils/api';
import { getQueryData, isQueryFresh, setQueryData } from '../../../utils/queryCache';
import CinematicLoading from '../../../components/dashboard/shared/CinematicLoading';
import SummaryTab from './components/SummaryTab';
import UsersTab from './UserManagement/UsersTab';
import CalendarTab from '../AdminAkademik/components/Calendar/CalendarTab';
import GlassCard from '../../../components/dashboard/shared/GlassCard';
import UnderDevelopment from '../../../maintaning/UnderDevelopment';
import InformationCenterTab from '../../../components/dashboard/shared/InformationCenterTab';
import SecurityTab from './Security/SecurityTab';
import EmergencyTab from './EmergencyTab';

const getDetailedRole = (u) => {
    if (!u) return '';
    const r = (u.access_role || u.role || u.role_name || '').toLowerCase();
    if (r.includes('akademik')) return 'admin_akademik';
    if (r.includes('cashier') || r.includes('kasir')) return 'cashier';
    if (r.includes('guru')) return 'guru';
    if (r.includes('murid')) return 'murid';
    if (r.includes('kepala') && r.includes('sekolah')) return 'kepala_sekolah';
    if (r.includes('wakil') && r.includes('sekolah')) return 'wakil_sekolah';
    if (r.includes('jurusan')) return 'pusat_jurusan';
    if (r.includes('super') || r.includes('operator')) return 'operator';
    return r;
};

const SUPER_ADMIN_CACHE_KEY = 'dashboard:superadmin';
// Sama dengan interval polling: data lebih muda dari ini dianggap masih segar.
const SUPER_ADMIN_CACHE_TTL = 30000;

const SuperAdminDashboard = ({ user, activeTab = 'summary', setActiveTab }) => {
  // Snapshot terakhir dipakai agar kembali ke dashboard tidak memunculkan
  // layar loading penuh; data disegarkan di latar belakang.
  const cachedSnapshot = React.useMemo(() => getQueryData(SUPER_ADMIN_CACHE_KEY), []);

  const [loading, setLoading] = useState(() => !cachedSnapshot?.summaryData);
  const [syncing, setSyncing] = useState(false);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const [summaryData, setSummaryData] = useState(() => cachedSnapshot?.summaryData ?? null);
  const [allUsers, setAllUsers] = useState(() => cachedSnapshot?.allUsers ?? []);
  const [kbmMasterData, setKbmMasterData] = useState(() => cachedSnapshot?.kbmMasterData ?? { jurusans: [], kelas: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [announcements, setAnnouncements] = useState(() => cachedSnapshot?.announcements ?? []);
  const [activityLogs, setActivityLogs] = useState(() => cachedSnapshot?.activityLogs ?? []);
  const [onlineUsers, setOnlineUsers] = useState(() => cachedSnapshot?.onlineUsers ?? []);
  const [backups, setBackups] = useState(() => cachedSnapshot?.backups ?? []);
  const [calendarMeta, setCalendarMeta] = useState(() => cachedSnapshot?.calendarMeta ?? null);
  const [calendarEvents, setCalendarEvents] = useState(() => cachedSnapshot?.calendarEvents ?? []);
  const [systemSettings, setSystemSettings] = useState(() => cachedSnapshot?.systemSettings ?? null);

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

  const activeTabRef = React.useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const fetchInitialData = async (isSync = false) => {
    // Avoid double fetching if we already have data and not syncing
    if (!isSync && summaryData) return;

    if (isSync) setSyncing(true);
    else setLoading(true);

    try {
      const [summaryRes, newsRes, logsRes, onlineRes, backupRes, calendarRes, allRes, eventsRes, masterRes, sysRes] = await Promise.all([
        operatorAPI.getStats().catch(() => ({ data: { data: {} } })),
        informationCenterAPI.getAll().catch(() => ({ data: { data: [] } })),
        operatorAPI.getActivityLog().catch(() => ({ data: { data: [] } })),
        operatorAPI.getOnlineUsers().catch(() => ({ data: { data: [] } })),
        operatorAPI.getSecurityBackups().catch(() => ({ data: { data: [] } })),
        calendarAPI.getCalendar().catch(() => ({ data: { data: null } })),
        operatorAPI.getUsers({ per_page: 9999 }).catch(() => ({ data: { data: [] } })),
        calendarAPI.getEvents().catch(() => ({ data: [] })),
        operatorAPI.getMasterData().catch(() => ({ data: { data: { jurusans: [], kelas: [] } } })),
        systemAPI.getSettings().catch(() => ({ data: { data: null } })),
      ]);
      
      setSummaryData(summaryRes.data.data);
      setAnnouncements(newsRes.data.data);
      setActivityLogs(logsRes.data.data || []);
      setOnlineUsers(onlineRes.data.data || []);
      setBackups(backupRes.data.data || []);
      setCalendarMeta(calendarRes.data.data);
      setAllUsers(allRes.data.data || []);
      setCalendarEvents(eventsRes.data.data || eventsRes.data || []);
      setSystemSettings(sysRes.data?.data ?? null);
      const masterData = masterRes.data?.data || {};
      const nextKbmMasterData = {
        jurusans: Array.isArray(masterData.jurusans) ? masterData.jurusans : [],
        kelas: Array.isArray(masterData.kelas) ? masterData.kelas : [],
      };
      setKbmMasterData(nextKbmMasterData);

      setQueryData(SUPER_ADMIN_CACHE_KEY, {
        summaryData: summaryRes.data.data,
        announcements: newsRes.data.data,
        activityLogs: logsRes.data.data || [],
        onlineUsers: onlineRes.data.data || [],
        backups: backupRes.data.data || [],
        calendarMeta: calendarRes.data.data,
        allUsers: allRes.data.data || [],
        calendarEvents: eventsRes.data.data || eventsRes.data || [],
        systemSettings: sysRes.data?.data ?? null,
        kbmMasterData: nextKbmMasterData,
      });

      if (isSync) {
        setSyncTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to fetch Super Admin data', error);
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    // Bila snapshot cache masih segar, tidak perlu request sama sekali.
    if (summaryData && cachedSnapshot?.kbmMasterData && isQueryFresh(SUPER_ADMIN_CACHE_KEY, SUPER_ADMIN_CACHE_TTL)) return;
    // Sudah ada snapshot: segarkan diam-diam tanpa layar loading penuh.
    fetchInitialData(Boolean(summaryData));
  }, []); // Only run once on mount

  // Tambahkan effect ini untuk sinkronisasi otomatis ketika tab berubah
  useEffect(() => {
    if ((activeTab === 'summary' || activeTab === 'users' || activeTab === 'kbm_preview') && !loading) {
      // Lewati bila data masih segar: pindah tab tidak perlu menarik 8 endpoint lagi.
      if (isQueryFresh(SUPER_ADMIN_CACHE_KEY, SUPER_ADMIN_CACHE_TTL)) return;
      fetchInitialData(true);
    }
  }, [activeTab]);

  // Real-time polling untuk monitoring (setiap 30 detik)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      // Jangan menembak server saat tab browser tidak aktif.
      if (typeof document !== 'undefined' && document.hidden) return;
      // Hanya sinkronkan di background jika user sedang melihat tab monitoring atau summary
      if (!syncing && (activeTabRef.current === 'summary' || activeTabRef.current === 'kbm_preview')) {
        fetchInitialData(true);
      }
    }, 30000);
    return () => clearInterval(pollInterval);
  }, [syncing]);

  if (loading && !summaryData) {
    return <CinematicLoading roleName="Operator" />;
  }

  return (
    <div className={activeTab === 'news' ? '' : 'w-full space-y-8 animate-fadeIn'}>
      
      {/* HEADER SECTION WRAPPED IN CARD - Hidden when in News tab */}
      {activeTab !== 'news' && activeTab !== 'emergency_db' && (
        <div className="overflow-hidden rounded-[2rem] border border-indigo-100 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(79,70,229,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#eef2ff_100%)] p-6 lg:p-8 shadow-2xl">
          
          <div className="relative">
            <div className="space-y-2">
              <div className="mb-3 flex items-center gap-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {activeTab === 'calendar_ta' ? (
                    <><LayoutDashboard className="w-3 h-3" /> Portal Admin Academic Authority</>
                  ) : (
                    <><Shield className="w-3 h-3" /> Portal Super Admin Authority</>
                  )}
                </div>
              </div>
              <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                {activeTab === 'calendar_ta'
                  ? 'Kalender & Agenda Pendidikan'
                  : activeTab === 'kbm_preview'
                    ? 'Monitoring KBM Sekolah'
                    : activeTab === 'users'
                      ? 'Manajemen Pengguna & Otoritas'
                      : activeTab === 'security'
                        ? 'Keamanan & Log Aktivitas'
                        : activeTab === 'emergency_db'
                          ? 'Emergency Database System'
                          : 'Dashboard Super Admin'}
              </h1>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {activeTab === 'calendar_ta' 
                  ? 'Pusat Kalender Akademik & Penjadwalan Agenda Sekolah.'
                  : activeTab === 'kbm_preview'
                    ? 'Pantau seluruh data operasional yang dikelola Admin Akademik secara realtime. Super Admin hanya dapat melihat, tidak dapat mengedit.'
                    : activeTab === 'users'
                      ? 'Kelola seluruh data anggota sekolah, registrasi akun baru, manajemen role, dan kontrol akses sistem dalam satu dasbor terpusat.'
                      : activeTab === 'security'
                        ? 'Pantau log aktivitas sistem secara detail, audit keamanan akses, dan kelola integritas data akun seluruh pengguna.'
                        : activeTab === 'emergency_db'
                          ? 'Sistem pemulihan darurat dan integritas database tingkat tinggi (Under Development).'
                        : 'Pusat kendali otoritas, manajemen pengguna, dan pemantauan statistik ekosistem digital sekolah secara real-time.'
                }
              </p>
            </div>

            {/* Clock WIB — absolute di kanan supaya lebar teks & hero tetap seperti sebelumnya */}
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
      )}

      {false && (
        <GlassCard className="border-none bg-[#111827] p-5 text-white shadow-xl">
          <div className="space-y-1 text-sm font-medium leading-relaxed text-slate-200">
            <p>ℹ️ Super Admin hanya dapat melihat data. Tidak ada tombol edit/hapus/tambah.</p>
            <p>Jika menemukan kesalahan, gunakan tombol "Laporkan ke Admin Akademik".</p>
          </div>
        </GlassCard>
      )}

      <AnimatePresence mode="wait">
        <motion.div
           key={activeTab}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -10 }}
           transition={{ duration: 0.3 }}
           className="min-h-[600px]"
        >
          {activeTab === 'summary' && (
            <SummaryTab 
              summaryData={summaryData} 
              allUsers={allUsers}
              activityLogs={activityLogs}
              calendarMeta={calendarMeta}
              calendarEvents={calendarEvents}
              announcements={announcements}
              onlineUsers={onlineUsers}
              backups={backups}
              systemSettings={systemSettings}
              loading={syncing}
              onSync={() => fetchInitialData(true)}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'users' && (
            <UsersTab 
              users={allUsers}
              kbmMasterData={kbmMasterData}
              onSync={() => fetchInitialData(true)} 
              refreshTrigger={syncTrigger}
              isGlobalSyncing={syncing}
              setIsSyncing={setSyncing}
            />
          )}

          {activeTab === 'calendar_ta' && (
            <CalendarTab 
              isPreviewOnly={true}
              events={calendarEvents} 
              loading={syncing}
              onSync={() => fetchInitialData(true)}
              onCreateEvent={async (data) => {
                try {
                  setSyncing(true);
                  await calendarAPI.storeEvent({
                    title: data.title,
                    content: data.description,
                    event_date: data.startDate,
                    type: data.category
                  });
                  toast.success('Agenda berhasil ditambahkan');
                  fetchInitialData(true);
                } catch (err) {
                  toast.error('Gagal menambahkan agenda');
                } finally {
                  setSyncing(false);
                }
              }}
              onDeleteEvent={async (id) => {
                try {
                  setSyncing(true);
                  await calendarAPI.deleteEvent(id);
                  toast.success('Agenda berhasil dihapus');
                  fetchInitialData(true);
                } catch (err) {
                  toast.error('Gagal menghapus agenda');
                } finally {
                  setSyncing(false);
                }
              }}
            />
          )}

          {activeTab === 'news' && (
            <InformationCenterTab user={user} />
          )}

          {activeTab === 'security' && (
            <SecurityTab 
              users={allUsers}
              logs={activityLogs}
              initialOnlineUsers={onlineUsers}
              initialBackups={backups}
              onSync={() => fetchInitialData(true)}
              refreshTrigger={syncTrigger}
            />
          )}

          {activeTab === 'emergency_db' && (
            <EmergencyTab user={user} clock={clock} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SuperAdminDashboard;
