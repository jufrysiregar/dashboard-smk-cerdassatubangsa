import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Database,
  User,
  FileText,
  Calendar,
  Clock,
  Info,
  Camera
} from 'lucide-react';
import { operatorAPI } from '../../../utils/api';

export default function DataBackupPage({ user }) {
  const navigate = useNavigate();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [backupMessage, setBackupMessage] = useState('');
  const [backupData, setBackupData] = useState(null);

  useEffect(() => {
    if (!user?._impersonating) {
      navigate('/dashboard');
    }
  }, [user?._impersonating, navigate]);

  const handleSnapshot = async () => {
    setIsBackingUp(true);
    setBackupStatus(null);
    setBackupMessage('');

    try {
      const response = await operatorAPI.backupImpersonatedUserData();
      
      if (response.data?.success || response.success) {
        setBackupStatus('success');
        setBackupMessage(`Snapshot data untuk ${user.name} berhasil disimpan`);
        setBackupData(response.data?.data || response.data || {});
      } else {
        setBackupStatus('error');
        setBackupMessage(response.data?.message || response.message || 'Gagal membuat snapshot data');
      }
    } catch (error) {
      setBackupStatus('error');
      const message = error?.response?.data?.message || error.message || 'Terjadi kesalahan saat membuat snapshot';
      setBackupMessage(message);
    } finally {
      setIsBackingUp(false);
    }
  };

  if (!user?._impersonating) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-amber-100 rounded-2xl">
            <Camera className="w-6 h-6 text-amber-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Pencadangan Data
          </h1>
        </div>
        <p className="text-gray-600 font-medium ml-[52px] text-sm">
          Buat snapshot data pengguna untuk audit trail dan pemulihan
        </p>
      </motion.div>

      {/* User Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6 p-5 bg-white border border-gray-200 rounded-3xl shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-gray-900 mb-3">Data Pengguna</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Nama</p>
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{user.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">ID</p>
                <p className="text-sm font-mono text-gray-600">#{user.id}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Role</p>
                <p className="text-sm font-semibold text-gray-900">{user.roleName || user.accessRole || user.role}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
                <p className="text-sm font-mono text-gray-600 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Big Snapshot Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <button
          onClick={handleSnapshot}
          disabled={isBackingUp}
          className={`w-full p-8 rounded-3xl border-2 border-dashed transition-all relative overflow-hidden group ${
            isBackingUp
              ? 'border-amber-300 bg-amber-50/50 cursor-wait'
              : 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 hover:border-amber-500 hover:shadow-xl'
          }`}
        >
          {isBackingUp ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
              <p className="text-base font-black text-amber-900">Menyimpan Snapshot...</p>
              <p className="text-xs font-bold text-amber-600">Merekam data user, mohon tunggu</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className={`p-4 rounded-2xl transition-all ${isBackingUp ? 'bg-amber-100' : 'bg-amber-100 group-hover:bg-amber-200 group-hover:scale-110'}`}>
                <Camera className="w-8 h-8 text-amber-600" />
              </div>
              <p className="text-lg font-black text-amber-900">Buat Snapshot Sekarang</p>
              <p className="text-xs font-bold text-amber-600 text-center max-w-sm">
                Rekam seluruh data pengguna (profil, nilai, pengaturan) sebagai save point. Data tidak dihapus.
              </p>
            </div>
          )}
        </button>
      </motion.div>

      {/* Status Messages */}
      <AnimatePresence>
        {backupStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-emerald-900">{backupMessage}</p>
              {backupData?.backup_id && (
                <p className="text-xs text-emerald-700 mt-1">
                  Backup ID: <span className="font-mono">{backupData.backup_id}</span>
                </p>
              )}
              <p className="text-xs text-emerald-600 mt-1">
                Snapshot tersimpan di Riwayat Pencadangan (menu Konfigurasi &amp; Keamanan Sistem).
              </p>
            </div>
          </motion.div>
        )}

        {backupStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-900">{backupMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* What Gets Backed Up */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="p-5 bg-white border border-gray-200 rounded-3xl shadow-sm"
      >
        <h3 className="text-base font-black text-gray-900 mb-3 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          Data yang Direkam
        </h3>
        <div className="space-y-2">
          {[
            { icon: User, label: 'Profil Pengguna', desc: 'Nama, email, No. Identitas' },
            { icon: FileText, label: 'Informasi Peran', desc: 'Role, posisi, status' },
            { icon: Calendar, label: 'Data Akademik', desc: 'Kelas, jurusan (untuk siswa/guru)' },
            { icon: Clock, label: 'Timestamp', desc: 'Waktu snapshot dibuat' }
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600 flex-shrink-0">
                <item.icon className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
