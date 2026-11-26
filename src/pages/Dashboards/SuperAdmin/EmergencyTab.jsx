import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
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
  Search,
  Bell,
  X,
  UserMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../utils/api';
import ScrollableSelect from '../../../components/shared/ScrollableSelect';
import { toast } from 'react-hot-toast';

/**
 * Portal-based tooltip — renders into document.body so it
 * escapes every `overflow:hidden` ancestor.
 */
const InfoTooltip = ({ text }) => {
  const btnRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const show = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    // fixed positioning is viewport-relative — do NOT add scrollY
    setCoords({
      top: rect.bottom + 8,
      left: rect.left,
    });
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={show}
        onFocus={show}
        onMouseLeave={hide}
        onBlur={hide}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/25 text-white text-xs font-black hover:bg-white/40 transition-colors select-none cursor-default"
        tabIndex={-1}
        aria-label="Info"
      >
        i
      </button>

      {visible && createPortal(
        <div
          role="tooltip"
          style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999 }}
          className="w-64 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-medium leading-relaxed text-white shadow-xl pointer-events-none"
        >
          {/* arrow pointing up */}
          <div
            style={{ position: 'absolute', top: -6, left: 10, width: 12, height: 12, background: '#0f172a', transform: 'rotate(45deg)', borderRadius: 2 }}
          />
          {text}
        </div>,
        document.body,
      )}
    </>
  );
};

/**
 * Pilihan jabatan untuk Pencadangan Jabatan.
 * Urutan ini FINAL (jangan diubah):
 * Murid, Guru, Kasir, Magang, Honorer, lalu jabatan struktural lainnya.
 */
const ROLE_OPTIONS = [
  { value: 'murid',           label: 'Murid' },
  { value: 'guru',            label: 'Guru' },
  { value: 'cashier',         label: 'Kasir' },
  { value: 'magang',          label: 'Magang' },
  { value: 'honorer',         label: 'Honorer' },
  { value: 'pusat_jurusan',   label: 'Pusat Jurusan' },
  { value: 'kepala_sekolah',  label: 'Kepala Sekolah' },
  { value: 'wakil_sekolah',   label: 'Wakil Kepala Sekolah' },
  { value: 'operator',        label: 'Super Admin - Operator' },
  { value: 'admin_akademik',  label: 'Admin Akademik - Operator' },
];

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
  const [globalBackupActive, setGlobalBackupActive] = useState(false);
  const [globalBackupRunning, setGlobalBackupRunning] = useState(false);
  const [roleBackupActive, setRoleBackupActive] = useState(false);
  const [roleBackupRunning, setRoleBackupRunning] = useState(false);
  const [selectedBackupRole, setSelectedBackupRole] = useState('');
  const [alumniBackupActive, setAlumniBackupActive] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [alumniReminderDuration, setAlumniReminderDuration] = useState('7_days');
  const [alumniSearchQuery, setAlumniSearchQuery] = useState('');
  const [alumniSearchExecuted, setAlumniSearchExecuted] = useState(false);
  const [alumniSearchResults, setAlumniSearchResults] = useState([]);
  const [alumniSearchLoading, setAlumniSearchLoading] = useState(false);
  const alumniListRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchSettings(), fetchCurrentIp(), fetchAllUsers()]);
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
        // Pulihkan hari yang tersimpan. Server mengirim `days` sebagai array
        // STRING (hasil explode), sedangkan UI membandingkan dengan angka —
        // makanya dikonversi ke number di sini. Kalau kosong/rusak, fallback
        // ke default Sen-Sab (1-6).
        const savedDays = Array.isArray(data.sleep_server?.days)
          ? data.sleep_server.days.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 7)
          : [];
        data.sleep_server = {
          ...data.sleep_server,
          days: savedDays.length > 0 ? savedDays : [1, 2, 3, 4, 5, 6]
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

  const fetchAllUsers = async () => {
    try {
      const response = await api.get('/operator/users', { params: { per_page: 999 } });
      if (response.data.success || response.data.data) {
        setAllUsers(Array.isArray(response.data.data) ? response.data.data : []);
      }
    } catch (error) {
      console.error('Gagal fetch users:', error);
    }
  };

  const handleSaveSleep = async () => {
    if (!settings.sleep_server.start || !settings.sleep_server.end) {
      toast.error('Jam mulai penutupan dan jam buka kembali wajib diisi');
      return;
    }
    if (settings.sleep_server.days.length === 0) {
      toast.error('Pilih minimal satu hari mulai penutupan');
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
        toast.success('Sleep Mode aktif. Pengguna aktif akan keluar dalam 60 detik.');
      } else if (active === '1') {
        toast.success('Sleep Mode aktif. Countdown dimulai pada jam penutupan yang diatur.');
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
  const handleGlobalBackup = async () => {
    setGlobalBackupRunning(true);
    try {
      const response = await api.post('/operator/backup/global');
      if (response.data.success) {
        toast.success(response.data.message || 'Backup global berhasil');
        setGlobalBackupActive(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal backup global');
      setGlobalBackupActive(false);
    } finally {
      setGlobalBackupRunning(false);
    }
  };

  const handleRoleBackup = async () => {
    setRoleBackupRunning(true);
    try {
      const response = await api.post('/operator/backup/by-role', { role_target: selectedBackupRole });
      if (response.data.success) {
        toast.success(response.data.message || `Backup role ${selectedBackupRole} berhasil`);
        setRoleBackupActive(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || `Gagal backup role`);
      setRoleBackupActive(false);
    } finally {
      setRoleBackupRunning(false);
    }
  };

  const handleSetAlumniReminder = async (userId) => {
    if (!alumniReminderUserId || alumniReminderSaving) return;
    setAlumniReminderSaving(true);
    try {
      const response = await api.post('/operator/alumni/set-reminder', {
        user_id: alumniReminderUserId,
        message_duration: alumniReminderDuration
      });
      if (response.data.success) {
        toast.success('Reminder masa aktif set berhasil');
        // Tutup modal lebih dulu supaya UI tidak terasa menggantung,
        // refresh daftar user berjalan di belakang.
        setAlumniReminderModalOpen(false);
        setAlumniReminderUserId(null);
        fetchAllUsers();
      }
    } catch (error) {
      toast.error('Gagal set reminder');
    } finally {
      setAlumniReminderSaving(false);
    }
  };

  const closeDeleteModal = () => {
    if (deleteProcessing) return;
    setDeleteTarget(null);
  };

  const handleConfirmDeleteAsAlumni = async () => {
    if (!deleteTarget || deleteProcessing) return;
    const userId = deleteTarget.id;
    setDeleteProcessing(true);
    try {
      const response = await api.post('/operator/backup/alumni', { user_id: userId });
      if (response.data.success) {
        toast.success(response.data.message || 'User berhasil dipindahkan ke alumni (dihapus permanen)');
        // Hapus dari hasil pencarian alumni
        setAlumniSearchResults(prev => prev.filter(u => u.id !== userId));
        setDeleteTarget(null);
        fetchAllUsers();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal menghapus user');
    } finally {
      setDeleteProcessing(false);
    }
  };

  // Cari murid di database berdasarkan Kode Unik atau Nama (hanya saat tombol Cari diklik)
  const handleAlumniSearch = async () => {
    const query = alumniSearchQuery.trim();
    if (!query) {
      toast.error('Masukkan Kode Unik atau Nama untuk mencari');
      return;
    }
    setAlumniSearchLoading(true);
    setAlumniSearchExecuted(true);
    try {
      // Query ke database: filter role=murid + search by school_id/name
      const response = await api.get('/operator/users', {
        params: { search: query, role: 'murid', per_page: 999 }
      });
      const data = response.data?.data || [];
      setAlumniSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Gagal mencari murid');
      setAlumniSearchResults([]);
    } finally {
      setAlumniSearchLoading(false);
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
  const [alumniReminderSaving, setAlumniReminderSaving] = useState(false);

  // Pengaturan pengingat kedaluwarsa portal alumni (global toggle + milestone
  // H-30/H-7/H-3) — terhubung ke endpoint OperatorController.
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderRunning, setReminderRunning] = useState(false);

  useEffect(() => {
    api.get('/operator/alumni/reminder-settings')
      .then(({ data }) => {
        const enabled = Boolean(data?.data?.alumni_reminder_enabled);
        setReminderEnabled(enabled);
        // Toggle utama "Pencadangan Alumni" kini jadi satu-satunya sakelar dan
        // mencerminkan setelan pengingat yang tersimpan di server saat halaman dibuka.
        setAlumniBackupActive(enabled);
      })
      .catch(() => {});
  }, []);

  const saveReminderEnabled = async (value) => {
    setReminderSaving(true);
    try {
      await api.put('/operator/alumni/reminder-settings', { alumni_reminder_enabled: value });
      setReminderEnabled(value);
      toast.success(value ? 'Pengingat kedaluwarsa portal alumni diaktifkan.' : 'Pengingat dinonaktifkan.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan pengaturan pengingat.');
    } finally {
      setReminderSaving(false);
    }
  };

  const runAlumniReminders = async ({ silent = false } = {}) => {
    setReminderRunning(true);
    try {
      const { data } = await api.post('/operator/alumni/run-reminders');
      const notified = data?.data?.notified ?? 0;
      if (!silent) {
        toast.success(notified ? `Pengecekan selesai — ${notified} pengingat terkirim.` : 'Pengecekan pengingat selesai (tidak ada yang baru).');
      }
    } catch (err) {
      if (!silent) toast.error(err?.response?.data?.message || 'Gagal menjalankan pengecekan pengingat.');
    } finally {
      setReminderRunning(false);
    }
  };

  // Konfirmasi hapus & pindahkan ke alumni (pengganti window.confirm)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteProcessing, setDeleteProcessing] = useState(false);

  // Kunci scroll halaman selama modal terbuka
  useBodyScrollLock(alumniReminderModalOpen || !!deleteTarget);

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
                    <label className="text-sm font-medium text-slate-500">Mulai Penutupan Server</label>
                    <input
                      type="time"
                      value={settings.sleep_server.start}
                      onChange={(e) => setSettings(prev => ({ ...prev, sleep_server: { ...prev.sleep_server, start: e.target.value } }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Server Dibuka Kembali</label>
                    <input
                      type="time"
                      value={settings.sleep_server.end}
                      onChange={(e) => setSettings(prev => ({ ...prev, sleep_server: { ...prev.sleep_server, end: e.target.value } }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
                    />
                  </div>
                </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-500">Hari Mulai Penutupan</label>
                    <div className={`flex flex-wrap gap-2 ${settings.sleep_server.active === '1' ? 'opacity-60' : ''}`}>
                      {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day, i) => (
                        <button
                          key={i}
                          onClick={() => toggleDay(i + 1)}
                          disabled={settings.sleep_server.active === '1'}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${settings.sleep_server.days.includes(i + 1)
                              ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm'
                              : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
                            } ${settings.sleep_server.active === '1' ? 'cursor-not-allowed' : ''}`}
                          title={settings.sleep_server.active === '1' ? 'Matikan toggle Sleep dulu untuk mengubah hari' : undefined}
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
                      <li>Seluruh user non-Admin <strong>tidak dapat login</strong>; server hanya dapat diakses oleh <strong>Master Akun Operator Sekolah (Super Admin)</strong></li>
                      <li>Pengguna aktif diperingati pil <strong>"Sisa Waktu Server Hidup"</strong> di header pada <strong>7 menit terakhir</strong>, lalu hitungan mundur <strong>60 detik</strong> sebelum diarahkan ke halaman Sleep Mode</li>
                      <li>Countdown dimulai tepat pada jam penutupan; login dibuka kembali <strong>satu menit</strong> setelah jam buka yang diatur</li>
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
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col"
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

              <div className="p-6 flex flex-1 flex-col">
                <div className="space-y-6">
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
                </div>

                <button
                  onClick={handleSaveMaintenance}
                  disabled={savingMaintenance || settings.maintenance.active === '1' || settings.sleep_server.active === '1' || settings.cleaning.active === '1'}
                  className="mt-auto w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* TAHAP 4: PUSAT CADANGAN & PEMULIHAN DATA - Split 2 Kolom */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden lg:col-span-2"
            >
              {/* Card header — pakai pola standar card lain: header putih, border slate, ikon biru */}
              <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                <Database className="w-5 h-5 text-blue-500 shrink-0" />
                <h2 className="font-black text-slate-900 text-lg">Darurat &amp; Pencadangan Sistem</h2>
              </div>

              {/* Split 2 kolom */}
              <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">

                {/* ── KOLOM KIRI: Global + Per Role ── */}
                <div className="p-6 space-y-5">

                  {/* Fitur 1: Cadangkan Global — header bar charcoal */}
                  <div className="rounded-xl border-2 border-slate-700 overflow-hidden">
                    <div className="flex items-center justify-between bg-slate-700 px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-bold text-white text-base">Pencadangan Global</p>
                        <InfoTooltip text="Rekam seluruh user termasuk Super Admin. Hasilnya tampil per-user di Riwayat Pencadangan." />
                      </div>
                      <button
                        onClick={() => { if (!globalBackupActive) { setGlobalBackupActive(true); handleGlobalBackup(); } }}
                        disabled={globalBackupRunning}
                        className={`ml-3 shrink-0 w-12 h-6 rounded-full transition-all relative ${globalBackupActive || globalBackupRunning ? 'bg-red-500' : 'bg-gray-300 hover:bg-gray-400'} ${globalBackupRunning ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md absolute top-1 transition-all ${globalBackupActive || globalBackupRunning ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    {globalBackupRunning && (
                      <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                        <span className="text-sm font-bold text-slate-700">Memproses backup global...</span>
                      </div>
                    )}
                  </div>

                  {/* Fitur 2: Pencadangan Per Jabatan — header bar navy */}
                  <div className="rounded-xl border-2 border-blue-900 overflow-hidden">
                    <div className="flex items-center justify-between bg-blue-900 px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-bold text-white text-base">Pencadangan Jabatan</p>
                        <InfoTooltip text="Rekam semua user dengan jabatan yang dipilih. Pilih jabatan dari dropdown lalu aktifkan toggle." />
                      </div>
                      <button
                        onClick={() => {
                          if (!selectedBackupRole) { toast.error('Pilih jabatan terlebih dahulu'); return; }
                          if (!roleBackupActive) { setRoleBackupActive(true); handleRoleBackup(); }
                        }}
                        disabled={roleBackupRunning || !selectedBackupRole}
                        className={`ml-3 shrink-0 w-12 h-6 rounded-full transition-all relative ${roleBackupActive || roleBackupRunning ? 'bg-red-500' : 'bg-gray-300 hover:bg-gray-400'} ${roleBackupRunning || !selectedBackupRole ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md absolute top-1 transition-all ${roleBackupActive || roleBackupRunning ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    {/* Dropdown jabatan — pakai ScrollableSelect yang sama dengan form Tambah Akun */}
                    <div className="border-t border-slate-200 bg-white px-4 py-3">
                      <div className={roleBackupRunning ? 'pointer-events-none opacity-50' : ''}>
                        <ScrollableSelect
                          value={selectedBackupRole}
                          onChange={setSelectedBackupRole}
                          options={ROLE_OPTIONS}
                          placeholder="— Silahkan pilih jabatan —"
                        />
                      </div>
                    </div>
                    {roleBackupRunning && (
                      <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-800" />
                        <span className="text-sm font-bold text-blue-900">Memproses backup role...</span>
                      </div>
                    )}
                  </div>


                </div>

                {/* ── KOLOM KANAN: Pencadangan Alumni ── */}
                <div className="p-6 flex flex-col gap-3">

                  {/* Header kolom kanan — bar hijau cyan (teal) */}
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-teal-700 px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-bold text-white text-base">Pencadangan Alumni</p>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-800">Khusus Murid</span>
                      {/* Info tooltip */}
                      <InfoTooltip text="Cari murid → klik lonceng untuk mengatur masa aktif portal, atau tong sampah untuk mencadangkan & menonaktifkan login. Saat toggle ON, pengingat otomatis (H-30/H-7/H-3) berjalan di latar belakang. Arsip nilai & transkrip alumni tetap tersimpan permanen." />
                    </div>
                    {/* Toggle alumni section — satu-satunya sakelar: membuka panel
                        pencadangan sekaligus menyalakan pengingat otomatis (H-30/H-7/H-3). */}
                    <button
                      onClick={() => {
                        const newActive = !alumniBackupActive;
                        setAlumniBackupActive(newActive);
                        if (!newActive) {
                          setAlumniSearchQuery('');
                          setAlumniSearchExecuted(false);
                          setAlumniSearchResults([]);
                        }
                        saveReminderEnabled(newActive);
                        // Saat dinyalakan, jalankan pengecekan pengingat otomatis di
                        // latar belakang (tanpa tombol manual di UI).
                        if (newActive) runAlumniReminders({ silent: true });
                      }}
                      className={`ml-3 shrink-0 w-12 h-6 rounded-full transition-all relative ${alumniBackupActive ? 'bg-red-500' : 'bg-gray-300 hover:bg-gray-400'} cursor-pointer`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md absolute top-1 transition-all ${alumniBackupActive ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className={`flex items-center gap-2 transition-opacity ${!alumniBackupActive ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={alumniSearchQuery}
                        onChange={(e) => setAlumniSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAlumniSearch(); }}
                        placeholder="Kode Unik atau Nama murid..."
                        className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-base font-normal text-black placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none"
                      />
                      {(alumniSearchQuery || alumniSearchExecuted) && (
                        <button
                          onClick={() => {
                            setAlumniSearchQuery('');
                            setAlumniSearchExecuted(false);
                            setAlumniSearchResults([]);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-teal-200 hover:text-teal-700 transition-colors"
                          title="Batalkan pencarian"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={handleAlumniSearch}
                      disabled={alumniSearchLoading}
                      className="shrink-0 px-3.5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-black transition-all shadow-sm disabled:opacity-50"
                    >
                      {alumniSearchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cari'}
                    </button>
                  </div>

                  {/* Hasil pencarian — kotak fixed height + ruler scrollbar */}
                  <div className={`transition-opacity ${!alumniBackupActive ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div
                      ref={alumniListRef}
                      className="h-[200px] overflow-y-auto rounded-xl border border-teal-100 bg-teal-50/30 scroll-smooth scrollbar-ruler"
                    >
                      {!alumniBackupActive ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                          <UserMinus className="w-8 h-8 mb-2 text-slate-300" />
                          <p className="text-sm font-bold text-center px-4">Aktifkan toggle untuk mencari murid</p>
                        </div>
                      ) : !alumniSearchExecuted ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                          <Search className="w-6 h-6 mb-2 text-slate-300" />
                          <p className="text-sm font-bold text-center px-4">Ketik Kode Unik atau Nama, lalu klik "Cari"</p>
                        </div>
                      ) : alumniSearchLoading ? (
                        <div className="flex items-center justify-center h-full gap-2 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-bold">Mencari...</span>
                        </div>
                      ) : alumniSearchResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                          <p className="text-sm font-bold italic">Tidak ditemukan murid dengan kata kunci tersebut.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-teal-100">
                          {alumniSearchResults.map((u) => (
                            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/70 transition-colors">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-black text-slate-900 leading-tight">{u.name}</p>
                                  <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-700 ring-1 ring-teal-500/10 shrink-0">
                                    {u.school_id || `#${u.id}`}
                                  </span>
                                </div>
                                <p className="mt-0.5 truncate text-xs text-slate-400 leading-tight">{u.email || '—'}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  onClick={() => { setAlumniReminderUserId(u.id); setAlumniReminderModalOpen(true); }}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500 border border-amber-200 transition-all hover:bg-amber-500 hover:text-white"
                                  title="Ingatkan User"
                                >
                                  <Bell size={15} />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(u)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 border border-rose-200 transition-all hover:bg-rose-500 hover:text-white"
                                  title="Hapus & Pindahkan ke Alumni"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>{/* end grid */}
            </motion.div>

            {/* CARD 3: SERVER CLEANING */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
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

      {/* Alumni Reminder Modal — portal ke body. JANGAN dibungkus AnimatePresence:
          AnimatePresence hanya merender React element, portal akan dibuang
          sehingga modal tidak tampil padahal scroll sudah dikunci. */}
      {alumniReminderModalOpen && createPortal(
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setAlumniReminderModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-amber-600 p-6 text-white">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-center">Set Masa Aktif User</h3>
              </div>
              <div className="p-8 space-y-6">
                <p className="text-slate-600 text-center font-medium">
                  Pilih durasi masa aktif user sebelum penghapusan sebagai alumni.
                </p>
                <div className="space-y-3">
                  {[
                    { value: '3_days', label: '3 Hari' },
                    { value: '7_days', label: '7 Hari' },
                    { value: '1_month', label: '1 Bulan' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setAlumniReminderDuration(option.value)}
                      disabled={alumniReminderSaving}
                      className={`w-full p-3 rounded-xl border-2 font-bold transition-all text-left disabled:cursor-not-allowed disabled:opacity-60 ${
                        alumniReminderDuration === option.value
                          ? 'bg-amber-100 border-amber-500 text-amber-900'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAlumniReminderModalOpen(false)}
                    disabled={alumniReminderSaving}
                    className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      handleSetAlumniReminder(alumniReminderUserId);
                    }}
                    disabled={alumniReminderSaving}
                    className="flex flex-1 items-center justify-center gap-2 py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-200 disabled:cursor-wait disabled:opacity-80"
                  >
                    {alumniReminderSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      'Terapkan'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {/* Konfirmasi Hapus & Pindahkan ke Alumni — tap di mana saja untuk menutup */}
      {deleteTarget && createPortal(
        <div
          onClick={closeDeleteModal}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="bg-rose-600 p-6 text-center text-white">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-black">Hapus Akun &amp; Pindahkan ke Alumni?</h3>
              <p className="mt-1 text-xs font-semibold text-rose-100">
                {deleteTarget.name} · {deleteTarget.school_id || `#${deleteTarget.id}`}
              </p>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-sm font-bold text-slate-700">Yang akan terjadi:</p>
              <ul className="space-y-2 text-[11px] font-medium leading-relaxed text-slate-600">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  Snapshot lengkap data user (nilai, rapor, prestasi, kehadiran) dibuat otomatis.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  Data dicatat ke arsip Alumni dengan alasan “Dihapus oleh Super Admin”.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  Reminder masa aktif akun (jika ada) ikut dihapus.
                </li>
                <li className="flex gap-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                  Akun dihapus permanen dari daftar pengguna dan tidak bisa login lagi.
                </li>
                <li className="flex gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  Masih bisa dikembalikan lewat Riwayat Backup (restore) bila snapshot tersedia.
                </li>
              </ul>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={closeDeleteModal}
                  disabled={deleteProcessing}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmDeleteAsAlumni}
                  disabled={deleteProcessing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 font-bold text-white shadow-lg shadow-rose-200 transition-all hover:bg-rose-700 disabled:cursor-wait disabled:opacity-80"
                >
                  {deleteProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menghapus...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Hapus
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
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
