import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  History,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import GlassCard from '../../../../components/dashboard/shared/GlassCard';
import InfoTooltip from '../../../../components/shared/InfoTooltip';
import LogoutLeftIcon from '../../../../components/shared/LogoutLeftIcon';
import { operatorAPI } from '../../../../utils/api';
import { useCachedQuery } from '../../../../utils/queryCache';

const SECURITY_MANAGED_ROLES = ['operator', 'admin_akademik', 'kepala_sekolah', 'wakil_sekolah', 'cashier'];
const LOGS_PER_PAGE = 10;
const USERS_PER_PAGE = 20;
// Audit log tidak berubah secepat daftar user online, jadi cukup 15 detik
// (sebelumnya 3 detik) agar server dev tidak dibanjiri request.
const AUDIT_LOG_REFRESH_INTERVAL = 15000;
const ONLINE_USERS_REFRESH_INTERVAL = 15000; // 15 detik — silent polling, samai audit log
const ONLINE_USERS_STALE_TIME = 3000;
const AUDIT_LOG_STALE_TIME = 15000;

// Kategori filter riwayat pencadangan (dipakai filter bar + tombol "Hapus Semua").
const BACKUP_HISTORY_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'today', label: 'Hari Ini' },
  { key: '7days', label: '7 Hari Lalu' },
  { key: '1month', label: '1 Bulan Lalu' },
  { key: '6months', label: 'Semester Lalu' },
  { key: 'alumni', label: 'Alumni' },
];

// Modal dikirim ke document.body lewat portal. Tanpa portal, `fixed inset-0`
// terkurung oleh ancestor ber-backdrop-blur/transform (GlassCard) sehingga
// blur-nya hanya menutup sebagian layar.
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, type = 'danger' }) => createPortal(
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-2xl"
        >
          <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${
            type === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <AlertTriangle size={32} />
          </div>
          <h3 className="mb-3 text-2xl font-black text-slate-900">{title}</h3>
          <p className="mb-8 font-medium leading-relaxed text-slate-500">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-2xl bg-slate-100 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-200"
            >
              Batal
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-white transition-transform active:scale-95 ${
                type === 'danger' ? 'bg-rose-600 shadow-lg shadow-rose-200' : 'bg-slate-900'
              }`}
            >
              Ya, Lanjutkan
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>,
  document.body,
);

const PasswordResultModal = ({ result, onClose }) => createPortal(
  <AnimatePresence>
    {result && (
      <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-2xl"
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ShieldCheck size={32} />
          </div>
          <h3 className="text-2xl font-black text-slate-900">Password Sementara Dibuat</h3>
          <p className="mt-3 font-medium leading-relaxed text-slate-500">
            Akun <span className="font-black text-slate-800">{result.userName}</span> sekarang memakai password sementara berikut.
          </p>

          <div className="mt-8 space-y-4 rounded-[2rem] border border-emerald-100 bg-emerald-50/60 p-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">ID Akun</p>
              <p className="mt-2 text-sm font-black text-slate-800">{result.schoolId}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Password Sementara</p>
              <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm">
                <code className="flex-1 overflow-x-auto text-sm font-black text-slate-900">{result.temporaryPassword}</code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.temporaryPassword);
                      toast.success('Password sementara berhasil disalin.');
                    } catch (error) {
                      toast.error('Gagal menyalin password sementara.');
                    }
                  }}
                  className="rounded-xl border border-slate-200 p-3 text-slate-500 transition-colors hover:border-emerald-500 hover:text-emerald-600"
                  title="Salin password"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-slate-900 px-6 py-4 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>,
  document.body,
);

const formatRoleLabel = (user) => {
  // Tampilkan label resmi role saja (role_name dari backend = ACCESS_ROLE_OPTIONS).
  // Jangan tempelkan token access_role mentah berbahasa Inggris (mis. "cashier")
  // karena backend tidak mengirim access_role_name, sehingga guard `includes`
  // gagal dan label jadi dobel ("Kasir - cashier").
  return user.role_name
    || String(user.access_role || user.role || '-')
      .toLowerCase()
      .replaceAll('_', ' ');
};

const formatDateTime = (value) => {
  if (!value) return 'Belum tercatat';

  try {
    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return value;
  }
};

// Warna label jabatan di kolom "Pengguna dan Jabatan".
// Setiap jabatan beda warna, tanpa pink/ungu dan tanpa hitam/abu gelap.
const ROLE_TEXT_TONES = {
  murid: 'text-sky-600',
  guru: 'text-emerald-600',
  cashier: 'text-amber-600',
  magang: 'text-orange-600',
  honorer: 'text-lime-600',
  pusat_jurusan: 'text-cyan-600',
  kepala_sekolah: 'text-blue-700',
  wakil_sekolah: 'text-teal-600',
  operator: 'text-red-600',
  admin_akademik: 'text-red-600',
};

// Magang/Honorer berbagi access_role 'magang_honor', jadi dibedakan lewat position_status.
const resolveRoleTone = (account) => {
  const positionStatus = String(account?.position_status || '').toLowerCase();
  const key = positionStatus === 'magang' || positionStatus === 'honorer'
    ? positionStatus
    : (account?.access_role || account?.role);

  return ROLE_TEXT_TONES[key] || 'text-slate-500';
};

// Lama sesi berjalan, dihitung dari AWAL LOGIN (token.created_at) — BUKAN dari
// last_used_at. Heartbeat menyentuh last_used_at tiap ~15 detik, jadi kalau pakai
// last_used_at label-nya akan membeku di "baru saja". created_at stabil → durasi
// bertambah benar.
const formatLoginDuration = (sinceIso) => {
  if (!sinceIso) return 'Sesi aktif';
  const t = new Date(sinceIso).getTime();
  if (Number.isNaN(t)) return 'Sesi aktif';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'Baru login';
  const m = Math.floor(s / 60);
  if (m < 60) return `Login ${m} menit`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return remM > 0 ? `Login ${h} jam ${remM} mnt` : `Login ${h} jam`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH > 0 ? `Login ${d} hari ${remH} jam` : `Login ${d} hari`;
};

const downloadBlob = (name, blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const resolveLogTone = (log) => {
  const type = String(log.type || '').toLowerCase();
  const text = String(log.action || '').toLowerCase();

  if (type === 'auth' || text.includes('password') || text.includes('session')) {
    return 'rose';
  }

  if (type === 'security' || text.includes('backup') || text.includes('lockdown')) {
    return 'amber';
  }

  return 'indigo';
};

const sortAuditLogs = (items = []) => [...items].sort((left, right) => {
  const leftTime = new Date(left.created_at || 0).getTime();
  const rightTime = new Date(right.created_at || 0).getTime();
  return rightTime - leftTime;
});

const SecurityTab = ({ 
  users = [], 
  logs = [], 
  initialOnlineUsers = [], 
  initialBackups = [], 
  onSync, 
  refreshTrigger = 0 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [backupTarget, setBackupTarget] = useState('production');
  // Online users & audit log diambil lewat cache bersama (utils/queryCache.js).
  // Hasilnya bertahan walau tab ini di-unmount, jadi pindah menu lalu kembali
  // tidak memicu request baru selama datanya masih segar.

  const {
    data: onlineUsersRaw,
    loading: loadingOnlineUsers,
    isFetching: fetchingOnlineUsers,
    refetch: refetchOnlineUsers,
    setData: setOnlineUsers,
  } = useCachedQuery(
    'security:online-users',
    async () => (await operatorAPI.getOnlineUsers()).data.data || [],
    {
      ttl: ONLINE_USERS_STALE_TIME,
      // Auto-refresh SILENT tiap 15 detik (samai audit log): login/logout tercermin
      // otomatis tanpa klik Refresh, tanpa spinner/kedip & tanpa reset pencarian/scroll.
      refreshInterval: ONLINE_USERS_REFRESH_INTERVAL,
      silentPolling: true,
      initialData: initialOnlineUsers.length > 0 ? initialOnlineUsers : undefined,
    },
  );

  // Urutan murni dari backend (terbaru di atas). Tidak ada heuristik lokal
  // "first seen" lagi supaya urutan 100% mencerminkan aktivitas asli DB.
  const onlineUsers = useMemo(() => onlineUsersRaw || [], [onlineUsersRaw]);

  const {
    data: auditLogsRaw,
    loading: loadingAuditLogs,
    refetch: refetchAuditLogs,
    setData: setAuditLogs,
  } = useCachedQuery(
    'security:audit-logs',
    async () => sortAuditLogs((await operatorAPI.getActivityLog()).data.data || []),
    {
      ttl: AUDIT_LOG_STALE_TIME,
      refreshInterval: AUDIT_LOG_REFRESH_INTERVAL,
      initialData: logs.length > 0 ? sortAuditLogs(logs) : undefined,
    },
  );
  const auditLogs = auditLogsRaw || [];
  const [backups, setBackups] = useState(initialBackups);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupFilter, setBackupFilter] = useState('all');
  const [busyKey, setBusyKey] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });
  const [passwordResult, setPasswordResult] = useState(null);
  const logContainerRef = useRef(null);

  const visibleUsers = onlineUsers
    .filter((user) => {
      const keyword = searchTerm.trim().toLowerCase();
      if (!keyword) return true;

      return [
        user.name,
        user.email,
        user.school_id,
        user.role_name,
        user.access_role,
      ].some((value) => String(value || '').toLowerCase().includes(keyword));
    })
    .sort((left, right) => {
      // Urut patokan sama dengan yang ditampilkan (durasi sejak login):
      // session_started_at (created_at) paling muda = login terbaru di atas.
      const leftTime = new Date(left.session_started_at || left.last_active_at || left.updated_at || 0).getTime();
      const rightTime = new Date(right.session_started_at || right.last_active_at || right.updated_at || 0).getTime();
      return rightTime - leftTime;
    });
  // Paginasi daftar user online: 20 per halaman
  const totalUserPages = Math.max(1, Math.ceil(visibleUsers.length / USERS_PER_PAGE));
  const currentUserPage = Math.min(userPage, totalUserPages);
  const pagedUsers = visibleUsers.slice(
    (currentUserPage - 1) * USERS_PER_PAGE,
    currentUserPage * USERS_PER_PAGE,
  );

  const totalLogPages = Math.max(1, Math.ceil(auditLogs.length / LOGS_PER_PAGE));
  const currentLogPage = Math.min(logPage, totalLogPages);
  const pagedAuditLogs = auditLogs.slice(
    (currentLogPage - 1) * LOGS_PER_PAGE,
    currentLogPage * LOGS_PER_PAGE,
  );
  const visibleLogStart = auditLogs.length === 0 ? 0 : ((currentLogPage - 1) * LOGS_PER_PAGE) + 1;
  const visibleLogEnd = Math.min(currentLogPage * LOGS_PER_PAGE, auditLogs.length);

  // Refresh manual untuk tombol "Sinkronkan data user online".
  // `refetch*` memakai cache, jadi request yang masih berjalan akan digabung
  // (tidak ada request dobel dengan polling).
  const refreshOnlineUsers = () => refetchOnlineUsers().catch((error) => {
    toast.error(error.response?.data?.message || 'User yang sedang online gagal dimuat.');
  });

  const loadBackups = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoadingBackups(true);
      const response = await operatorAPI.getSecurityBackups();
      setBackups(response.data.data || []);
    } catch (error) {
      if (!silent) toast.error(error.response?.data?.message || 'Riwayat backup gagal dimuat.');
    } finally {
      if (!silent) setLoadingBackups(false);
    }
  };



  useEffect(() => {
    // Setiap kata kunci pencarian berubah, kembali ke halaman pertama
    setUserPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setBackups(initialBackups);
  }, [initialBackups]);

  useEffect(() => {
    // Audit log dari induk ikut disimpan ke cache agar bisa dipakai ulang.
    if (logs.length > 0) {
      setAuditLogs(sortAuditLogs(logs));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  const initialMount = useRef(true);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    if (refreshTrigger > 0) {
      refetchOnlineUsers().catch(() => {});
      refetchAuditLogs().catch(() => {});
      loadBackupHistory({ silent: true });
    }
  }, [refreshTrigger]);

  useEffect(() => {
    setLogPage((previous) => Math.min(previous, totalLogPages));
  }, [totalLogPages]);

  useEffect(() => {
    if (!logContainerRef.current) {
      return;
    }

    logContainerRef.current.scrollTop = 0;
  }, [currentLogPage, auditLogs.length]);

  const openConfirm = (title, message, onConfirm, type = 'danger') => {
    setConfirmState({ isOpen: true, title, message, onConfirm, type });
  };

  const handleResetPassword = (targetUser) => {
    openConfirm(
      'Reset Password?',
      `Sistem akan membuat password sementara baru untuk ${targetUser.name}. Seluruh sesi aktif akun ini juga akan dicabut.`,
      async () => {
        try {
          setBusyKey(`reset-${targetUser.id}`);
          const response = await operatorAPI.resetSecurityAdminPassword(targetUser.id);
          const payload = response.data?.data || {};
          setPasswordResult({
            userName: payload.userName || targetUser.name,
            schoolId: targetUser.school_id,
            temporaryPassword: payload.temporaryPassword || '',
          });
          toast.success(response.data?.message || 'Password sementara berhasil dibuat.');
          await Promise.all([refetchOnlineUsers().catch(() => {}), refetchAuditLogs().catch(() => {}), onSync?.()]);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Reset password gagal diproses.');
        } finally {
          setBusyKey('');
        }
      },
      'warning',
    );
  };

  const handleSuspendAccess = (targetUser) => {
    openConfirm(
      'Suspend Akses?',
      `Akun ${targetUser.name} akan dinonaktifkan dan seluruh sesi aktifnya dicabut. Lanjutkan proses suspend?`,
      async () => {
        try {
          setBusyKey(`suspend-${targetUser.id}`);
          const response = await operatorAPI.suspendSecurityAdminAccess(targetUser.id);
          toast.success(response.data?.message || 'Akses admin berhasil dinonaktifkan.');
          await Promise.all([refetchOnlineUsers().catch(() => {}), refetchAuditLogs().catch(() => {}), onSync?.()]);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Suspend akses gagal diproses.');
        } finally {
          setBusyKey('');
        }
      },
      'danger',
    );
  };

  const handleCreateBackup = async () => {
    try {
      setIsBackingUp(true);
      const response = await operatorAPI.createSecurityBackup({ target: backupTarget });
      toast.success(response.data?.message || 'Backup berhasil dibuat.');
      await Promise.all([loadBackups({ silent: true }), refetchAuditLogs().catch(() => {}), onSync?.()]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Backup gagal dibuat.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDownloadBackup = async (backup) => {
    try {
      setBusyKey(`download-${backup.id}`);
      const response = await operatorAPI.downloadSecurityBackup(backup.fileName);
      const fileName = backup.fileName || `backup-${backup.id}.json`;
      downloadBlob(fileName, response.data);
      toast.success(`Backup ${fileName} berhasil diunduh.`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Download backup gagal.');
    } finally {
      setBusyKey('');
    }
  };

  const handleDeleteBackup = (backup) => {
    openConfirm(
      'Hapus Backup?',
      `Snapshot ${backup.targetLabel} tanggal ${backup.createdAtLabel} akan dihapus secara permanen. Lanjutkan?`,
      async () => {
        try {
          setBusyKey(`delete-${backup.id}`);
          const response = await operatorAPI.deleteSecurityBackup(backup.fileName);
          toast.success(response.data?.message || 'Backup berhasil dihapus.');
          await Promise.all([loadBackups({ silent: true }), refetchAuditLogs().catch(() => {}), onSync?.()]);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Gagal menghapus backup.');
        } finally {
          setBusyKey('');
        }
      },
      'danger'
    );
  };

  const handleLogoutUser = (account) => {
    openConfirm(
      'Keluarkan User?',
      `User ${account.name} akan dikeluarkan paksa dari seluruh perangkat dan sesi aktif. Lanjutkan?`,
      async () => {
        // Optimistic UI Update: Langsung hapus dari list agar terasa 'instan'
        const previousUsers = [...onlineUsers];
        setOnlineUsers((prev) => (prev || []).filter((u) => u.id !== account.id));
        
        try {
          setBusyKey(`logout-${account.id}`);
          const response = await operatorAPI.logoutSecurityAdmin(account.id);
          toast.success(response.data?.message || 'User berhasil dikeluarkan.');
          // Refresh segera setelah kick
          await refetchOnlineUsers().catch(() => {});
          await Promise.all([refetchAuditLogs().catch(() => {}), onSync?.()]);
        } catch (error) {
          // Revert jika gagal
          setOnlineUsers(previousUsers);
          toast.error(error.response?.data?.message || 'Gagal mengeluarkan user.');
        } finally {
          setBusyKey('');
        }
      },
      'danger'
    );
  };

  const handleClearAuditLogs = () => {
    openConfirm(
      'Hapus Semua Audit Log?',
      'Tindakan ini sangat berbahaya. Seluruh riwayat aktivitas (audit log) sistem akan dihapus secara permanen dan tidak dapat dipulihkan. Lanjutkan?',
      async () => {
        try {
          const response = await operatorAPI.clearActivityLog();
          toast.success(response.data?.message || 'Audit log berhasil dihapus.');
          await Promise.all([refetchAuditLogs().catch(() => {}), onSync?.()]);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Gagal menghapus audit log.');
        }
      },
      'danger'
    );
  };

  // State untuk riwayat pencadangan
  const [backupHistoryFilter, setBackupHistoryFilter] = useState('all');
  const [backupHistory, setBackupHistory] = useState([]);
  const [loadingBackupHistory, setLoadingBackupHistory] = useState(false);
  const [busyHistoryKey, setBusyHistoryKey] = useState('');

  // Fungsi untuk memuat riwayat pencadangan
  const loadBackupHistory = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoadingBackupHistory(true);
      const response = await operatorAPI.getBackupHistory();
      setBackupHistory(response.data.data || []);
    } catch (error) {
      if (!silent) toast.error(error.response?.data?.message || 'Riwayat pencadangan gagal dimuat.');
    } finally {
      if (!silent) setLoadingBackupHistory(false);
    }
  };

  // Load backup history pada mount
  useEffect(() => {
    loadBackupHistory();
  }, []);

  // Handler hapus riwayat backup
  const handleDeleteBackupHistory = (record) => {
    openConfirm(
      'Hapus Riwayat?',
      `Riwayat backup untuk ${record.user_name} akan dihapus permanen. Lanjutkan?`,
      async () => {
        try {
          setBusyHistoryKey(`delete-${record.id}`);
          await operatorAPI.deleteBackupRecord(record.id);
          toast.success('Riwayat backup berhasil dihapus.');
          await loadBackupHistory({ silent: true });
          await refetchAuditLogs().catch(() => {});
        } catch (error) {
          toast.error(error.response?.data?.message || 'Gagal menghapus riwayat.');
        } finally {
          setBusyHistoryKey('');
        }
      },
      'danger'
    );
  };

  // Handler hapus semua riwayat pada kategori yang sedang aktif (kategori "Semua" dimatikan)
  const handleDeleteAllBackupHistory = () => {
    if (backupHistoryFilter === 'all') return;

    const filterLabel = BACKUP_HISTORY_FILTERS.find((item) => item.key === backupHistoryFilter)?.label
      || backupHistoryFilter;

    openConfirm(
      'Hapus Semua Riwayat?',
      `Seluruh riwayat backup kategori "${filterLabel}" (${filteredBackupHistory.length} data) akan dihapus permanen. Lanjutkan?`,
      async () => {
        try {
          setBusyHistoryKey('delete-all');
          const response = await operatorAPI.deleteBackupHistoryBulk(backupHistoryFilter);
          toast.success(response.data?.message || 'Riwayat backup berhasil dihapus.');
          await loadBackupHistory({ silent: true });
          await refetchAuditLogs().catch(() => {});
        } catch (error) {
          toast.error(error.response?.data?.message || 'Gagal menghapus riwayat.');
        } finally {
          setBusyHistoryKey('');
        }
      },
      'danger'
    );
  };

  // Handler restore data user dari snapshot
  const handleRestoreBackup = (record) => {
    openConfirm(
      'Restore Data User?',
      `Data ${record.user_name || 'user'} akan dipulihkan ke kondisi snapshot tanggal ${record.created_at_label || 'tersebut'}. Data user saat ini akan ditimpa. Lanjutkan?`,
      async () => {
        try {
          setBusyHistoryKey(`restore-${record.id}`);
          const response = await operatorAPI.restoreBackup(record.id);
          toast.success(response.data?.message || 'Data user berhasil dipulihkan dari snapshot.');
          await loadBackupHistory({ silent: true });
          await refetchAuditLogs().catch(() => {});
        } catch (error) {
          toast.error(error.response?.data?.message || 'Gagal memulihkan data.');
        } finally {
          setBusyHistoryKey('');
        }
      },
      'warning',
    );
  };

  // Handler ekspor riwayat backup (PDF/Excel - download data payload as JSON)
  const handleExportBackupHistory = async (record) => {
    try {
      setBusyHistoryKey(`export-${record.id}`);
      // Export sebagai file JSON (bisa dikonversi ke PDF/Excel di kemudian hari)
      const dataStr = JSON.stringify({
        id: record.id,
        user: record.user_name,
        role: record.user_role,
        school_id: record.user_school_id,
        type: record.backup_type,
        created_at: record.created_at,
      }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-${record.user_name || record.id}-${record.created_at?.split('T')[0] || 'export'}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Riwayat berhasil diekspor.');
    } catch (error) {
      toast.error('Gagal mengekspor riwayat.');
    } finally {
      setBusyHistoryKey('');
    }
  };

  // Filter riwayat berdasarkan filter yang dipilih
  const getFilteredBackupHistory = () => {
    const now = new Date();
    const cutoff = new Date();
    
    switch (backupHistoryFilter) {
      case 'today':
        cutoff.setHours(0, 0, 0, 0);
        break;
      case '7days':
        cutoff.setDate(now.getDate() - 7);
        break;
      case '1month':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case '6months':
        cutoff.setMonth(now.getMonth() - 6);
        break;
      case 'alumni':
        return backupHistory.filter(b => b.backup_type === 'alumni');
      default:
        return backupHistory;
    }
    
    return backupHistoryFilter === 'all' 
      ? backupHistory 
      : backupHistory.filter(b => new Date(b.created_at) >= cutoff);
  };

  const filteredBackupHistory = getFilteredBackupHistory();

  return (
    <div className="space-y-8 animate-fadeIn pb-24">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="space-y-8 xl:col-span-8">
          <GlassCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-6 border-b border-slate-50 bg-slate-50/20 py-6 pl-2 pr-1">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-slate-900 p-3 text-white shadow-lg shadow-slate-200">
                  <UserCog size={22} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight text-slate-900">Otoritas Pengguna</h3>
                    <InfoTooltip
                      text={
                        <>
                          <p><span className="font-black">Reset</span> — buat password sementara baru untuk akun ini.</p>
                          <p className="mt-2"><span className="font-black">Suspend</span> — nonaktifkan akun sementara, user tidak bisa login sampai dibuka kembali.</p>
                          <p className="mt-2"><span className="font-black">Kick</span> — paksa logout sesi yang sedang aktif sekarang juga.</p>
                        </>
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => refreshOnlineUsers()}
                  disabled={fetchingOnlineUsers}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition-all hover:border-slate-900 hover:text-slate-900 disabled:opacity-50"
                  title="Sinkronkan data user online"
                >
                  <RefreshCw size={16} className={fetchingOnlineUsers ? 'animate-spin' : ''} />
                </button>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Cari user online..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-bold outline-none transition-colors focus:border-slate-900"
                  />
                </div>
                {/* Navigasi halaman: 20 user per halaman */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setUserPage((previous) => Math.max(previous - 1, 1))}
                    disabled={currentUserPage === 1}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors enabled:hover:border-slate-900 enabled:hover:text-slate-900 disabled:border-slate-100 disabled:text-slate-300"
                    title="Halaman sebelumnya"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserPage((previous) => Math.min(previous + 1, totalUserPages))}
                    disabled={currentUserPage >= totalUserPages}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors enabled:hover:border-slate-900 enabled:hover:text-slate-900 disabled:border-slate-100 disabled:text-slate-300"
                    title="Halaman berikutnya"
                  >
                    <ChevronRight size={16} />
                  </button>
                  {/* Jumlah halaman di samping tombol > */}
                  <span className="pl-1 text-[11px] font-black text-slate-400">
                    {currentUserPage}/{totalUserPages}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto text-left">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="border-b border-slate-100 px-4 py-5 text-center text-xs font-black text-slate-900">Pengguna dan Jabatan</th>
                    <th className="border-b border-slate-100 px-4 py-5 text-center text-xs font-black text-slate-900 whitespace-nowrap">Sesi Saat Ini</th>
                    <th className="border-b border-slate-100 px-4 py-5 text-center text-xs font-black text-slate-900 whitespace-nowrap">Tindakan Lanjutan</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingOnlineUsers && onlineUsers.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-8 py-16 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          <span className="text-sm font-bold">Memuat user yang sedang online...</span>
                        </div>
                      </td>
                    </tr>
                  ) : visibleUsers.length > 0 ? pagedUsers.map((account, index) => {
                    const isBusy = busyKey === `reset-${account.id}` || busyKey === `suspend-${account.id}`;
                    const supportsSecurityActions = true; // Enabled for all users as requested
                    const resetDisabled = Boolean(account.is_current_user) || !supportsSecurityActions || isBusy;
                    const suspendDisabled = Boolean(account.is_current_user) || !supportsSecurityActions || !account.is_active || isBusy;

                    return (
                      <tr key={account.id} className={`${index % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'} transition-colors hover:bg-slate-50`}>
                        <td className="border-r border-slate-100 px-4 py-5">
                          <div className="flex flex-col">
                            {/* Baris 1: nama + role satu baris (ruler). Baris 2: email / school_id. */}
                            <p className="whitespace-nowrap text-sm font-black text-slate-900">
                              {account.name}
                              <span className={`text-xs font-bold ${resolveRoleTone(account)}`}> ({formatRoleLabel(account)})</span>
                            </p>
                            <p className="mt-0.5 whitespace-nowrap text-xs font-bold text-slate-500">
                              {account.email || '—'}
                              <span className="px-1 text-slate-300">/</span>
                              <span className="font-mono">{account.school_id || '-'}</span>
                            </p>
                          </div>
                        </td>
                        <td className="border-r border-slate-100 px-4 py-5">
                          {/* Satu baris: dot status | lama aktivitas | (jumlah sesi) */}
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 animate-dot-ripple" />
                            <span className="text-xs font-black text-slate-800">
                              {formatLoginDuration(account.session_started_at)}
                            </span>
                            <span className="text-xs font-black text-slate-400">
                              ({account.active_session_count || 1})
                            </span>
                            {account.is_current_user && (
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                                Perangkat Ini
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          {supportsSecurityActions ? (
                            <div className="flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleResetPassword(account)}
                                disabled={resetDisabled}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-amber-300 bg-amber-300 px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-red-600 transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                                title={account.is_current_user ? 'Akun aktif Anda sendiri tidak dapat direset dari panel ini.' : 'Reset Password'}
                              >
                                {busyKey === `reset-${account.id}` ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSuspendAccess(account)}
                                disabled={suspendDisabled}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-slate-200 px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-red-600 transition-all hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                                title={account.is_current_user ? 'Akun aktif Anda sendiri tidak dapat disuspend.' : 'Suspend Akses'}
                              >
                                {busyKey === `suspend-${account.id}` ? <Loader2 size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
                                Suspend
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLogoutUser(account)}
                                disabled={Boolean(account.is_current_user) || isBusy}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-blue-500 bg-blue-400 px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-red-600 transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                title={account.is_current_user ? 'Akun aktif Anda sendiri tidak dapat dikick.' : 'Keluarkan User'}
                              >
                                {busyKey === `logout-${account.id}` ? <Loader2 size={15} className="animate-spin" /> : <LogoutLeftIcon size={15} />}
                                Kick
                              </button>
                            </div>
                          ) : (
                            <div className="text-center">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sedang Online</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="3" className="px-8 py-20 text-center text-slate-400">
                        <p className="font-bold italic">Belum ada user online yang cocok atau sesi aktifnya sudah berhenti.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* RIWAYAT PENCADANGAN - In Left Column (compact) */}
          <GlassCard className="overflow-hidden p-0">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/30 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-500 p-2 text-white shadow-lg shadow-indigo-100">
                  <ArchiveRestore size={18} />
                </div>
                <div className="flex items-center gap-2 text-left">
                  <h3 className="text-base font-black tracking-tight text-slate-900">Riwayat Pencadangan Pengguna</h3>
                  <InfoTooltip
                    text={
                      <>
                        <p>Daftar snapshot data user yang sudah tersimpan. Tiap baris punya 3 aksi: <span className="font-black">Ekspor</span> (unduh ringkasan), <span className="font-black">Restore</span> (kembalikan data dari snapshot), <span className="font-black">Hapus</span> (buang riwayat).</p>
                        <p className="mt-2">Jenis: <span className="font-black">Global</span> (semua user), <span className="font-black">Role</span> (per jabatan), <span className="font-black">Alumni</span> (dibuat sebelum akun dihapus permanen).</p>
                      </>
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadBackupHistory()}
                disabled={loadingBackupHistory}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-slate-900 hover:text-slate-900 disabled:opacity-50"
                title="Refresh riwayat"
              >
                <RefreshCw size={14} className={loadingBackupHistory ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Filter bar - horizontal scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 px-4 py-2.5 scrollbar-thin">
              {BACKUP_HISTORY_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setBackupHistoryFilter(f.key)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-all ${
                    backupHistoryFilter === f.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <div className="ml-auto shrink-0 pl-2 text-[9px] font-bold text-slate-400">
                {filteredBackupHistory.length} riwayat
              </div>
            </div>

            {/* List vertikal (card per record) */}
            <div className="max-h-[420px] overflow-y-auto">
              {loadingBackupHistory ? (
                <div className="flex items-center justify-center gap-3 py-10 text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-xs font-bold">Memuat riwayat...</span>
                </div>
              ) : filteredBackupHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <ArchiveRestore size={28} className="mb-2 text-slate-200" />
                  <p className="text-xs font-bold italic">Tidak ada riwayat pada periode ini.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filteredBackupHistory.map((record) => {
                    const dt = record.created_at ? new Date(record.created_at) : null;
                    const tglStr = dt ? dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                    const jamStr = dt ? dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';
                    const typeLabel = record.backup_type === 'global' ? 'Global' : record.backup_type === 'role' ? `Role: ${record.role_target || '-'}` : record.backup_type === 'alumni' ? 'Alumni' : 'User';
                    const typeClass = record.backup_type === 'global' ? 'bg-purple-50 text-purple-600 ring-1 ring-purple-500/10'
                      : record.backup_type === 'role' ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/10'
                      : record.backup_type === 'alumni' ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-500/10'
                      : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10';
                    return (
                      <div key={record.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50/50">
                        {/* Konten: Nama & Role di atas, ID & Waktu di bawah */}
                        <div className="min-w-0 flex-1">
                          {/* Baris 1: Nama + Role badge */}
                          <div className="flex items-center gap-2">
                            <p className="truncate text-xs font-black text-slate-800">{record.user_name || '—'}</p>
                            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${typeClass}`}>
                              {typeLabel}
                            </span>
                          </div>
                          {/* Baris 2: Role + ID */}
                          <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-400">
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-blue-600 ring-1 ring-blue-500/10">
                              {record.user_role || '—'}
                            </span>
                            <span className="font-mono text-slate-400">{record.user_school_id || `#${record.user_id}`}</span>
                          </div>
                          {/* Baris 3: Waktu */}
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold text-slate-400">
                            <Clock size={10} className="shrink-0" />
                            <span>{tglStr}</span>
                            <span className="font-mono">{jamStr}</span>
                          </div>
                        </div>
                        {/* Aksi: ikon saja dengan tooltip */}
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleExportBackupHistory(record)}
                            disabled={busyHistoryKey === `export-${record.id}` || busyHistoryKey === `delete-${record.id}` || busyHistoryKey === `restore-${record.id}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-all hover:bg-blue-500 hover:text-white disabled:opacity-40"
                            title="Ekspor (PDF/Excel)"
                          >
                            {busyHistoryKey === `export-${record.id}` ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestoreBackup(record)}
                            disabled={busyHistoryKey === `export-${record.id}` || busyHistoryKey === `delete-${record.id}` || busyHistoryKey === `restore-${record.id}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-all hover:bg-emerald-500 hover:text-white disabled:opacity-40"
                            title="Restore (Pulihkan data dari snapshot)"
                          >
                            {busyHistoryKey === `restore-${record.id}` ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBackupHistory(record)}
                            disabled={busyHistoryKey === `export-${record.id}` || busyHistoryKey === `delete-${record.id}` || busyHistoryKey === `restore-${record.id}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-all hover:bg-rose-500 hover:text-white disabled:opacity-40"
                            title="Hapus Riwayat"
                          >
                            {busyHistoryKey === `delete-${record.id}` ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer: hapus semua riwayat pada kategori aktif (kategori "Semua" dimatikan) */}
            <div className="flex items-center justify-center border-t border-slate-100 bg-slate-50/30 px-4 py-3">
              <button
                type="button"
                onClick={handleDeleteAllBackupHistory}
                disabled={
                  backupHistoryFilter === 'all'
                  || filteredBackupHistory.length === 0
                  || busyHistoryKey === 'delete-all'
                }
                className="flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-black text-rose-600 transition-colors enabled:hover:border-rose-500 enabled:hover:bg-rose-500 enabled:hover:text-white disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
                title={
                  backupHistoryFilter === 'all'
                    ? 'Pilih kategori selain "Semua" untuk mengaktifkan tombol ini'
                    : 'Hapus seluruh riwayat pada kategori ini'
                }
              >
                {busyHistoryKey === 'delete-all'
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Trash2 size={12} />}
                Hapus Semua
              </button>
            </div>
          </GlassCard>
        </div>

        <div className="xl:col-span-4">
          <GlassCard className="flex flex-col overflow-hidden border-slate-200/60 p-0 shadow-amber-900/5">
            <div className="sticky top-0 z-10 border-b border-slate-50 bg-white py-6 pl-2 pr-5">
              <div className="flex items-center justify-start gap-3">
                <div className="shrink-0 rounded-2xl bg-amber-500 p-2.5 text-white shadow-lg shadow-amber-100">
                  <Clock size={20} />
                </div>
                <div className="flex items-center gap-2 text-left">
                  <h3 className="text-base font-black leading-snug tracking-tight text-slate-900">Audit Log Aktivitas Pengguna</h3>
                  <InfoTooltip
                    text={
                      <>
                        <p>Jejak aktivitas user: login/logout, ganti password, kelola akun, pencadangan &amp; restore, sampai impersonation.</p>
                        <p className="mt-2">Realtime tiap <span className="font-black">3 detik</span>, 10 log per halaman dari maks 200 log terbaru. <span className="font-black">Hapus Semua</span> mengosongkan seluruh log secara permanen.</p>
                      </>
                    }
                  />
                </div>
              </div>
            </div>

            <div ref={logContainerRef} className="max-h-[640px] overflow-y-auto p-8">
              {loadingAuditLogs && auditLogs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="mb-4 h-8 w-8 animate-spin text-slate-200" />
                  <p className="text-sm font-bold italic">Memuat audit log terbaru...</p>
                </div>
              ) : pagedAuditLogs.length > 0 ? (
                <div className="space-y-5">
                  {pagedAuditLogs.map((log) => {
                    const tone = resolveLogTone(log);
                    const toneClass = tone === 'rose'
                      ? 'bg-rose-100 text-rose-600'
                      : tone === 'amber'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-indigo-100 text-indigo-600';

                    return (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={log.id || `${log.action}-${log.created_at}`}
                        className="group flex items-start gap-4"
                      >
                        <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
                          <ShieldCheck size={16} />
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                              {log.user_name || log.admin_name || 'System'}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                              {log.user_role || log.type || 'system'}
                            </span>
                          </div>
                          <p className="text-xs font-bold leading-relaxed text-slate-700">{log.description || log.action}</p>
                          <p className="mt-2 text-[10px] font-bold text-slate-400">
                            {log.time_human || formatDateTime(log.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center py-20 text-slate-400">
                  <History className="mb-4 h-12 w-12 text-slate-200" />
                  <p className="text-sm font-bold italic">Belum ada aktivitas tercatat.</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/50 p-6">
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Menampilkan {visibleLogStart}-{visibleLogEnd} dari {auditLogs.length} log terbaru
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                  Audit log diperbarui otomatis tiap 3 detik
                </p>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest">
                <button
                  type="button"
                  onClick={() => setLogPage((previous) => Math.max(previous - 1, 1))}
                  disabled={currentLogPage === 1}
                  className="text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Prev
                </button>
                <span className="text-slate-300">
                  {currentLogPage}/{totalLogPages}
                </span>
                <button
                  type="button"
                  onClick={() => setLogPage((previous) => Math.min(previous + 1, totalLogPages))}
                  disabled={currentLogPage === totalLogPages || auditLogs.length === 0}
                  className="text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Next
                </button>
                <div className="mx-2 h-4 w-px bg-slate-200"></div>
                <button
                  type="button"
                  onClick={handleClearAuditLogs}
                  disabled={auditLogs.length === 0}
                  className="whitespace-nowrap text-rose-400 transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:text-slate-300"
                  title="Hapus semua log secara permanen"
                >
                  Hapus Semua
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        onClose={() => setConfirmState((previous) => ({ ...previous, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
      />

      <PasswordResultModal
        result={passwordResult}
        onClose={() => setPasswordResult(null)}
      />
    </div>
  );
};

export default SecurityTab;
