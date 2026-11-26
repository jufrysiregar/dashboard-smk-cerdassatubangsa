import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Moon,
  Settings,
  Zap,
  AlertTriangle,
  Save,
  CheckCircle2,
  Clock,
  Info,
  Power,
  Trash2,
  Loader2,
  Database,
  Users,
  AlertCircle,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../utils/api';
import { toast } from 'react-hot-toast';
import EmergencyBackupCard from './Components/EmergencyBackupCard';
import AlumniActionCard from './Components/AlumniActionCard';

const EmergencyTab = ({ user, clock }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [savingSleep, setSavingSleep] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [savingCleaning, setSavingCleaning] = useState(false);
  const [currentUserIp, setCurrentUserIp] = useState(null);
  // Lock toggle sampai "Simpan Pengaturan" berhasil dipanggil
  const [savedOnce, setSavedOnce] = useState({
    sleep: false,
    maintenance: false,
    cleaning: false,
  });
  const [settings, setSettings] = useState({
    sleep_server: { active: '0', start: '07:00', end: '16:00', days: [1, 2, 3, 4, 5, 6] },
    maintenance: { active: '0', message: 'Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti.', estimated_end: '', allowed_ips: [] },
    cleaning: { active: '0', message: 'Super Admin sedang membersihkan server. Sistem mungkin sedikit lambat selama beberapa menit. Jika ada lag atau gagal aksi pada button, harap memaklumi.' },
    logs: []
  });

  const [cleaningItems, setCleaningItems] = useState(['cache', 'logs', 'sessions']);
  const [showConfirmMaintenance, setShowConfirmMaintenance] = useState(false);

  // TAHAP 2: Backup & Alumni Management States
  const [backupHistory, setBackupHistory] = useState([]);
  const [backupFilter, setBackupFilter] = useState('all'); // 'today', '7days', '1month', '6months', 'alumni'
  const [backupRoles, setBackupRoles] = useState({
    superadmin: false,
    admin_akademik: false,
    kasir: false,
    guru: false,
    murid: false,
    global: false
  });
  const [backingupRoles, setBackingupRoles] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [showAlumniReminder, setShowAlumniReminder] = useState(null);
  const [alumniReminderDuration, setAlumniReminderDuration] = useState('7_days');

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchSettings(), fetchCurrentIp(), fetchBackupHistory(), fetchAllUsers()]);
      setIsLoading(false);
    };
    init();
  }, []);

  const fetchCurrentIp = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      const ip = data.ip;
      setCurrentUserIp(ip);
      // Tambahkan IP ke whitelist tanpa mengubah field lain sama sekali
      setSettings(prev => {
        const alreadyExists = prev.maintenance.allowed_ips.includes(ip);
        if (alreadyExists) return prev;
        return {
          ...prev,
          maintenance: {
            ...prev.maintenance,
            allowed_ips: [ip, ...prev.maintenance.allowed_ips]
          }
        };
      });
    } catch (error) {
      console.error('Gagal mendeteksi IP:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await api.get('/operator/system/settings');
      if (response.data.success) {
        const data = response.data.data;
        // Selalu enforce Sen-Sab (1-6) untuk days, abaikan nilai dari server
        data.sleep_server = {
          ...data.sleep_server,
          days: [1, 2, 3, 4, 5, 6]
        };
        // Jaga pesan default jika server kembalikan kosong
        if (!data.maintenance?.message) {
          data.maintenance = {
            ...data.maintenance,
            message: 'Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti.'
          };
        }
        if (!data.cleaning?.message) {
          data.cleaning = {
            ...data.cleaning,
            message: 'Super Admin sedang membersihkan server. Sistem mungkin sedikit lambat selama beberapa menit. Jika ada lag atau gagal aksi pada button, harap memaklumi.'
          };
        }
        setSettings(data);

        // Buka lock toggle otomatis setelah data berhasil dimuat dari DB
        setSavedOnce({
          sleep: true,
          maintenance: true,
          cleaning: true,
        });
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Gagal mengambil pengaturan sistem';
      toast.error(msg);
    }
  };

  const fetchBackupHistory = async () => {
    try {
      const response = await api.get('/operator/backup/history');
      if (response.data.success) {
        setBackupHistory(response.data.data || []);
      }
    } catch (error) {
      console.error('Gagal fetch backup history:', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await api.get('/operator/users');
      if (response.data.success || response.data.data) {
        setAllUsers(Array.isArray(response.data.data) ? response.data.data : []);
      }
    } catch (error) {
      console.error('Gagal fetch users:', error);
    }
  };

  const handleSaveSleep = async () => {
    if (!settings.sleep_server.start || !settings.sleep_server.end) {
      toast.error('Jam mulai dan selesai operasional wajib diisi');
      return;
    }
    if (settings.sleep_server.days.length === 0) {
      toast.error('Pilih minimal satu hari operasional');
      return;
    }
    setSavingSleep(true);
    try {
      // Simpan pengaturan TANPA mengubah status active
      await api.post('/operator/system/sleep', {
        ...settings.sleep_server,
        active: settings.sleep_server.active // pertahankan status aktif saat ini
      });
      toast.success('Berhasil simpan pengaturan, silahkan aktifkan toggle');
      setSavedOnce(prev => ({ ...prev, sleep: true }));
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSavingSleep(false);
    }
  };

  const handleToggleSleep = async (val) => {
    const active = val ? '1' : '0';
    setSavingSleep(true);
    try {
      const response = await api.post('/operator/system/sleep', {
        ...settings.sleep_server,
        active
      });
      setSettings(prev => ({ ...prev, sleep_server: { ...prev.sleep_server, active } }));
      if (active === '1' && response.data.countdown) {
        toast.success('Sleep Mode diaktifkan. Countdown 60 detik dikirim ke semua user aktif.');
      } else {
        toast.success('Sleep Server dinonaktifkan');
      }
      window.dispatchEvent(new CustomEvent('systemStatusChanged'));
    } catch (error) {
      console.error('Toggle sleep error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Gagal mengubah status Sleep Server');
    } finally {
      setSavingSleep(false);
    }
  };

  const handleSaveMaintenance = async () => {
    if (!settings.maintenance.estimated_end) {
      toast.error('Estimasi selesai wajib diisi');
      return;
    }
    if (!currentUserIp) {
      toast.error('IP belum terdeteksi, tunggu sebentar');
      return;
    }
    setSavingMaintenance(true);
    try {
      const response = await api.post('/operator/system/maintenance', {
        ...settings.maintenance,
        active: settings.maintenance.active // pertahankan status aktif saat ini
      });
      if (response.data.success) {
        toast.success('Berhasil simpan pengaturan, silahkan aktifkan toggle');
        setSavedOnce(prev => ({ ...prev, maintenance: true }));
      }
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan maintenance');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleSaveCleaning = async () => {
    if (!settings.cleaning.message?.trim()) {
      toast.error('Pesan notifikasi ke user wajib diisi');
      return;
    }
    if (cleaningItems.length === 0) {
      toast.error('Pilih minimal satu item yang akan dibersihkan');
      return;
    }
    setSavingCleaning(true);
    try {
      await api.post('/operator/system/cleaning', {
        active: '0', // simpan pengaturan saja, tidak mengubah status aktif
        items: cleaningItems,
        message: settings.cleaning.message
      });
      toast.success('Berhasil simpan pengaturan, silahkan aktifkan toggle');
      setSavedOnce(prev => ({ ...prev, cleaning: true }));
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan cleaning');
    } finally {
      setSavingCleaning(false);
    }
  };

  const handleDeleteLog = async (id) => {
    try {
      await api.delete(`/operator/system/cleaning-logs/${id}`);
      setSettings(prev => ({
        ...prev,
        logs: prev.logs.filter(log => log.id !== id)
      }));
      toast.success('Riwayat dihapus');
    } catch (error) {
      toast.error('Gagal menghapus riwayat');
    }
  };

  // TAHAP 2: Backup Handler Functions
  const handleBackupRole = async (role) => {
    setBackingupRoles(prev => ({ ...prev, [role]: true }));
    try {
      const response = await api.post('/operator/backup/by-role', { role_target: role });
      if (response.data.success) {
        toast.success(`Backup role ${role} berhasil`);
        setBackupRoles(prev => ({ ...prev, [role]: false }));
        fetchBackupHistory();
      }
    } catch (error) {
      toast.error(`Gagal backup role ${role}`);
    } finally {
      setBackingupRoles(prev => ({ ...prev, [role]: false }));
    }
  };

  const handleDeleteBackup = async (backupId) => {
    try {
      await api.delete(`/operator/backup/${backupId}`);
      toast.success('Backup dihapus');
      setBackupHistory(prev => prev.filter(b => b.id !== backupId));
    } catch (error) {
      toast.error('Gagal menghapus backup');
    }
  };

  const handleRebackup = async (backupId) => {
    try {
      const response = await api.post(`/operator/backup/${backupId}/rebackup`);
      if (response.data.success) {
        toast.success('Backup ulang berhasil');
        fetchBackupHistory();
      }
    } catch (error) {
      toast.error('Gagal backup ulang');
    }
  };

  const handleSetAlumniReminder = async (userId) => {
    if (!showAlumniReminder) return;
    try {
      const response = await api.post('/operator/alumni/set-reminder', {
        user_id: userId,
        message_duration: alumniReminderDuration
      });
      if (response.data.success) {
        toast.success('Reminder masa aktif set berhasil');
        setShowAlumniReminder(null);
        fetchAllUsers();
      }
    } catch (error) {
      toast.error('Gagal set reminder');
    }
  };

  const handleDeleteAsAlumni = async (userId) => {
    if (!confirm('Apakah Anda yakin? Backup otomatis akan dibuat sebelum penghapusan.')) return;
    try {
      const response = await api.post('/operator/alumni/delete-user', { user_id: userId });
      if (response.data.success) {
        toast.success('User berhasil dipindahkan ke alumni');
        fetchAllUsers();
        fetchBackupHistory();
      }
    } catch (error) {
      toast.error('Gagal menghapus user');
    }
  };

  const getFilteredBackupHistory = () => {
    const now = new Date();
    const filterDate = new Date();
    
    switch (backupFilter) {
      case 'today':
        filterDate.setHours(0, 0, 0, 0);
        return backupHistory.filter(b => new Date(b.created_at) >= filterDate);
      case '7days':
        filterDate.setDate(now.getDate() - 7);
        return backupHistory.filter(b => new Date(b.created_at) >= filterDate);
      case '1month':
        filterDate.setMonth(now.getMonth() - 1);
        return backupHistory.filter(b => new Date(b.created_at) >= filterDate);
      case '6months':
        filterDate.setMonth(now.getMonth() - 6);
        return backupHistory.filter(b => new Date(b.created_at) >= filterDate);
      case 'alumni':
        return backupHistory.filter(b => b.backup_type === 'alumni');
      default:
        return backupHistory;
    }
  };

  const handleToggleMaintenance = async (active) => {
    if (active === '1' && !showConfirmMaintenance) {
      setShowConfirmMaintenance(true);
      return;
    }

    setSavingMaintenance(true);
    try {
      const response = await api.post('/operator/system/maintenance', {
        ...settings.maintenance,
        active
      });
      if (response.data.success) {
        setSettings(prev => ({
          ...prev,
          maintenance: { ...prev.maintenance, active }
        }));
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error('Gagal mengubah mode maintenance');
    } finally {
      setSavingMaintenance(false);
      setShowConfirmMaintenance(false);
    }
  };

  const handleTriggerCleaning = async (active) => {
    setSavingCleaning(true);
    try {
      if (active === '1') {
        // Set aktif dulu agar banner muncul di user
        setSettings(prev => ({ ...prev, cleaning: { ...prev.cleaning, active: '1' } }));
      }
      const response = await api.post('/operator/system/cleaning', {
        active,
        items: cleaningItems,
        message: settings.cleaning.message
      });
      if (response.data.success) {
        // Setelah selesai, set kembali ke off dan refresh riwayat
        setSettings(prev => ({
          ...prev,
          cleaning: { ...prev.cleaning, active: response.data.active ?? '0' }
        }));
        toast.success(active === '0'
          ? 'Cleaning selesai!'
          : response.data.message
        );
        fetchSettings(); // refresh riwayat
        // Trigger event agar banner di DashboardPage langsung update tanpa tunggu polling
        window.dispatchEvent(new CustomEvent('systemStatusChanged'));
      }
    } catch (error) {
      toast.error('Gagal menjalankan server cleaning');
      setSettings(prev => ({ ...prev, cleaning: { ...prev.cleaning, active: '0' } }));
    } finally {
      setSavingCleaning(false);
    }
  };

  const toggleDay = (day) => {
    const currentDays = [...settings.sleep_server.days];
    const index = currentDays.indexOf(day);
    if (index > -1) {
      currentDays.splice(index, 1);
    } else {
      currentDays.push(day);
    }
    setSettings(prev => ({
      ...prev,
      sleep_server: { ...prev.sleep_server, days: currentDays.sort() }
    }));
  };

  const [alumniReminderModalOpen, setAlumniReminderModalOpen] = useState(false);
  const [alumniReminderUserId, setAlumniReminderUserId] = useState(null);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#991B1B] to-[#7F1D1D] p-8 text-white shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <ShieldAlert className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Emergency Database System</h1>
                <p className="text-red-100/80">Pusat kendali keamanan dan pemeliharaan server darurat.</p>
              </div>
            </div>
            {/* Clock WIB */}
            {clock && (
              <div className="flex flex-col items-end gap-1 px-4 py-2 rounded-2xl bg-white/20 border border-white/30 shadow-sm shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white uppercase tracking-widest">{clock.day},</span>
                  <span className="text-xs font-bold text-red-100">{clock.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-white" />
                  <span className="text-lg font-black tracking-widest text-white tabular-nums">{clock.time}</span>
                  <span className="text-[10px] font-black text-red-200 uppercase tracking-widest">WIB</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-400/10 rounded-full -ml-24 -mb-24 blur-2xl"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {isLoading ? (
          // SKELETON LOADING STATE
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${i === 3 ? 'lg:col-span-2' : ''}`}>
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-lg animate-pulse" />
                    <div className="w-48 h-6 bg-slate-200 rounded-md animate-pulse" />
                  </div>
                  <div className="w-14 h-7 bg-slate-200 rounded-full animate-pulse" />
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                    <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                  </div>
                  <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                  <div className="h-32 bg-slate-50 rounded-xl animate-pulse" />
                  <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />
                </div>
              </div>
            ))}
          </>
        ) : (
          // ACTUAL CONTENT
          <>
            {/* CARD 1: SLEEP SERVER */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <Moon className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-slate-800 text-lg">Mode Tidur (Sleep Server)</h2>
                </div>
                <Toggle
                  active={settings.sleep_server.active === '1'}
                  onChange={(val) => handleToggleSleep(val)}
                  color="#EF4444"
                  disabled={!savedOnce.sleep || settings.maintenance.active === '1' || settings.cleaning.active === '1'}
                />
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Mulai Operasional</label>
                    <input
                      type="time"
                      value={settings.sleep_server.start}
                      onChange={(e) => setSettings(prev => ({ ...prev, sleep_server: { ...prev.sleep_server, start: e.target.value } }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Selesai Operasional</label>
                    <input
                      type="time"
                      value={settings.sleep_server.end}
                      onChange={(e) => setSettings(prev => ({ ...prev, sleep_server: { ...prev.sleep_server, end: e.target.value } }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-500">Hari Operasional</label>
                  <div className="flex flex-wrap gap-2">
                    {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day, i) => (
                      <button
                        key={i}
                        onClick={() => toggleDay(i + 1)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${settings.sleep_server.days.includes(i + 1)
                            ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm'
                            : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="text-xs text-amber-800 leading-relaxed">
                    <strong>Efek saat AKTIF:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Seluruh user non-Admin <strong>tidak dapat login</strong> ke dashboard</li>
                      <li>Jika Super Admin belum memiliki sesi aktif, semua user tetap diblokir meski dalam jam operasional</li>
                      <li>Server hanya dapat diakses oleh <strong>Master Akun Operator Sekolah (Super Admin)</strong></li>
                      <li><strong>1 menit</strong> sebelum server ditutup, seluruh user aktif menerima notifikasi countdown 59–0 detik di layar mereka</li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={handleSaveSleep}
                  disabled={savingSleep || settings.sleep_server.active === '1' || settings.maintenance.active === '1' || settings.cleaning.active === '1'}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSleep ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Simpan Pengaturan
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            {/* CARD 2: MAINTENANCE MODE */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                    <Settings className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-slate-800 text-lg">Maintenance Mode</h2>
                </div>
                <Toggle
                  active={settings.maintenance.active === '1'}
                  onChange={(val) => handleToggleMaintenance(val ? '1' : '0')}
                  color="#EF4444"
                  disabled={!savedOnce.maintenance || settings.sleep_server.active === '1' || settings.cleaning.active === '1'}
                />
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Estimasi Selesai</label>
                  <input
                    type="datetime-local"
                    value={settings.maintenance.estimated_end}
                    onChange={(e) => setSettings(prev => ({ ...prev, maintenance: { ...prev.maintenance, estimated_end: e.target.value } }))}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-500">IP yang Diizinkan (Whitelist)</label>
                  <div className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-black select-none">
                    {currentUserIp
                      ? `Your IP Address : ${currentUserIp}`
                      : 'Mendeteksi IP Anda...'}
                  </div>
                  <p className="text-xs text-slate-400">IP terdeteksi otomatis dari sesi login Anda dan tidak dapat diubah.</p>
                </div>

                <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex gap-3">
                  <Power className="w-5 h-5 text-red-600 shrink-0" />
                  <p className="text-xs text-red-800 leading-relaxed">
                    <strong>Efek saat AKTIF:</strong> Seluruh user akan logout paksa.
                    Hanya <strong>Master Akun Operator Sekolah (Super Admin)</strong> dengan IP terdaftar yang tetap bisa mengakses sistem.
                  </p>
                </div>

                <button
                  onClick={handleSaveMaintenance}
                  disabled={savingMaintenance || settings.maintenance.active === '1' || settings.sleep_server.active === '1' || settings.cleaning.active === '1'}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingMaintenance ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Simpan Pengaturan
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            {/* CARD 3: SERVER CLEANING */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden lg:col-span-2"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-slate-800 text-lg">Pembersihan Server (Server Cleaning)</h2>
                </div>
                <Toggle
                  active={settings.cleaning.active === '1'}
                  onChange={(val) => handleTriggerCleaning(val ? '1' : '0')}
                  color="#F59E0B"
                  disabled={!savedOnce.cleaning || settings.sleep_server.active === '1' || settings.maintenance.active === '1'}
                />
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-slate-500">Pilih yang akan dibersihkan:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'cache', label: 'Cache sistem' },
                        { id: 'logs', label: 'Log sementara (>30 hari)' },
                        { id: 'temp_files', label: 'File temporary upload gagal' },
                        { id: 'sessions', label: 'Session user expired' }
                      ].map(item => (
                        <label key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cleaningItems.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) setCleaningItems(prev => [...prev, item.id]);
                              else setCleaningItems(prev => prev.filter(i => i !== item.id));
                            }}
                            className="w-5 h-5 rounded border-slate-300 text-yellow-600 focus:ring-yellow-500"
                          />
                          <span className="text-sm text-slate-700">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Notifikasi ke User:</label>
                    <textarea
                      value={settings.cleaning.message}
                      onChange={(e) => setSettings(prev => ({ ...prev, cleaning: { ...prev.cleaning, message: e.target.value } }))}
                      placeholder="Super Admin sedang membersihkan server. Sistem mungkin sedikit lambat selama 5-10 menit."
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all outline-none min-h-[120px] resize-none text-slate-800"
                    />
                  </div>

                  <button
                    onClick={handleSaveCleaning}
                    disabled={savingCleaning || settings.cleaning.active === '1' || settings.sleep_server.active === '1' || settings.maintenance.active === '1'}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingCleaning ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Simpan Pengaturan
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-500">Riwayat Terakhir</label>
                      <Clock className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="space-y-3">
                      {settings.logs.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 italic text-sm">Belum ada riwayat pembersihan</div>
                      ) : (
                        settings.logs.map((log, i) => (
                          <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-slate-700">{log.action}</p>
                              <p className="text-xs text-slate-500">{new Date(log.started_at).toLocaleString('id-ID')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${log.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                  {log.status}
                                </span>
                                <p className="text-xs font-medium text-slate-600 mt-1">{log.size_cleaned_mb} MB</p>
                              </div>
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100 flex gap-3">
                    <Info className="w-5 h-5 text-yellow-600 shrink-0" />
                    <div className="text-xs text-yellow-800 leading-relaxed">
                      <strong>Efek saat AKTIF:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>SEMUA user tetap bisa login</li>
                        <li>User melihat banner notifikasi di dashboard</li>
                        <li>Sistem berjalan lebih ringan setelah selesai</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* TAHAP 2: Emergency Backup & Alumni Management Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <EmergencyBackupCard 
          backupRoles={backupRoles}
          onBackupComplete={() => {}}
          onBackupRefresh={() => fetchBackupHistory()}
        />
        <AlumniActionCard 
          allUsers={allUsers}
          onUserDeleted={(userId) => setAllUsers(prev => prev.filter(u => u.id !== userId))}
          onBackupRefresh={() => Promise.all([fetchBackupHistory(), fetchAllUsers()])}
        />
      </div>

      {/* Confirmation Modal for Maintenance */}
      <AnimatePresence>
        {showConfirmMaintenance && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowConfirmMaintenance(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-red-600 p-6 text-white text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold">PERINGATAN</h3>
              </div>
              <div className="p-8 space-y-6">
                <p className="text-slate-600 text-center font-medium">
                  Anda akan mengaktifkan <strong>MAINTENANCE MODE</strong>.
                </p>
                <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                  <p className="text-sm font-bold text-slate-700">Dampak:</p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm text-slate-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      Semua user tanpa terkecuali (termasuk Admin Akademik, Kepala Sekolah, Magang, dll) akan terlogout paksa
                    </li>
                    <li className="flex items-start gap-2 text-sm text-slate-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      Tidak ada yang bisa login kecuali Anda dari IP yang didaftarkan
                    </li>
                  </ul>
                </div>
                <p className="text-slate-800 text-center font-bold">Apakah Anda yakin?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmMaintenance(false)}
                    className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => handleToggleMaintenance('1')}
                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-200"
                  >
                    Ya, Aktifkan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Toggle = ({ active, onChange, color, disabled = false }) => {
  return (
    <button
      onClick={() => !disabled && onChange(!active)}
      className={`relative w-14 h-7 rounded-full transition-all duration-300 outline-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ backgroundColor: active ? color : '#D1D5DB' }}
    >
      <div
        className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 transform ${active ? 'translate-x-7' : 'translate-x-0'
          }`}
      />
    </button>
  );
};

export default EmergencyTab;
