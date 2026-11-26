import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, MoreVertical, Edit, Trash2, Power, PowerOff, ChevronLeft, ChevronRight, Loader2, Mail, Phone, 
  UserPlus, BadgeCheck, GraduationCap, School, ShieldAlert, AlertTriangle, Users, MapPin, LogIn, Calendar,
  RefreshCw, X, Bell, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { operatorAPI } from '../../../../utils/api';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';

const labelMap = { 'murid': 'MURID', 'guru': 'GURU', 'kepala_sekolah': 'KEPALA SEKOLAH', 'wakil_sekolah': 'WAKIL KEPALA SEKOLAH', 'operator': 'SUPER ADMIN', 'admin_akademik': 'ADMIN AKADEMIK', 'cashier': 'KASIR', 'pusat_jurusan': 'PUSAT JURUSAN', 'honorer': 'HONORER', 'magang': 'MAGANG' };
const titleCaseLabelMap = { 'murid': 'Murid', 'guru': 'Guru', 'kepala_sekolah': 'Kepala Sekolah', 'wakil_sekolah': 'Wakil Kepala Sekolah', 'operator': 'Super Admin', 'admin_akademik': 'Admin Akademik', 'cashier': 'Kasir', 'pusat_jurusan': 'Pusat Jurusan', 'honorer': 'Honorer', 'magang': 'Magang' };

const notifyUserRecordsChanged = () => {
  const changedAt = String(Date.now());
  try { window.localStorage.setItem('school_users_changed_at', changedAt); } catch (_) { /* Browser storage may be unavailable; same-tab event still refreshes. */ }
  window.dispatchEvent(new CustomEvent('schoolUsersChanged', { detail: { changedAt } }));
};

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

const isExpired = (u) => {
    if (!u || !['honorer', 'magang'].includes((u.position_status || '').toLowerCase()) || !u.contract_end_date) {
        return false;
    }
    const endDate = new Date(u.contract_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    return today > endDate; // Diubah agar hari terakhir tetap dianggap belum expired
};

const getDaysRemaining = (u) => {
    if (!u || !['honorer', 'magang'].includes((u.position_status || '').toLowerCase()) || !u.contract_end_date) {
        return null;
    }
    const endDate = new Date(u.contract_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// Status kepegawaian offboarding (default 'active' untuk data lama).
const employmentActive = (u) => ((u?.employment_status || 'active').toLowerCase() === 'active');

// Aktif di daftar harian: is_active true, kontrak belum expired, dan belum di-offboard.
const isActiveForDailyList = (u) => {
    const active = (u.is_active === true || u.is_active === 1 || String(u.is_active) === '1' || u.is_active === 'true');
    return active && !isExpired(u) && employmentActive(u);
};

const OFFBOARD_REASON_OPTIONS = [
    'Mengundurkan Diri',
    'Pindah Tugas',
    'Purna Tugas / Pensiun',
    'Kontrak / Magang Selesai',
];

const AnimatedLoadingText = () => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(timer);
  }, []);
  return <span className="inline-block w-[18px] text-left">{dots}</span>;
};

const UsersTab = ({ 
  users: initialUsers = [],
  kbmMasterData = {},
  onSync,
  refreshTrigger,
  isGlobalSyncing,
  setIsSyncing
}) => {
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [users, setUsers] = useState(initialUsers);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    // Selalu sinkronkan dari parent (tanpa syarat length > 0)
    setUsers(initialUsers);
  }, [initialUsers]);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccountBanner, setNewAccountBanner] = useState(null); // { name, school_id }
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Tab pemisahan daftar harian vs arsip pegawai nonaktif.
  const [viewTab, setViewTab] = useState('aktif'); // 'aktif' | 'arsip'

  // Modal offboarding pegawai.
  const [userToOffboard, setUserToOffboard] = useState(null);
  const [offboardDate, setOffboardDate] = useState('');
  const [offboardReason, setOffboardReason] = useState('');
  const [offboardRetired, setOffboardRetired] = useState(false);
  const [isOffboarding, setIsOffboarding] = useState(false);
  const [userToReactivate, setUserToReactivate] = useState(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const fileInputRef = useRef(null);

  // Kunci scroll halaman selama dialog konfirmasi terbuka
  useBodyScrollLock(!!userToDelete || isClearAllModalOpen || !!userToOffboard || !!userToReactivate);

  const userStats = React.useMemo(() => {
    const murid = users.filter(u => getDetailedRole(u) === 'murid');
    const guru = users.filter(u => getDetailedRole(u) === 'guru');
    const staff = users.filter(u => {
        const role = getDetailedRole(u);
        return role !== 'murid' && role !== 'guru' && role !== 'operator';
    });
    
    const terplot = murid.filter(u => u.class_name && u.class_name !== '-' && u.class_name !== '').length;
    
    // Akun aktif harian: is_active true, kontrak belum expired, dan belum di-offboard.
    const active = users.filter(isActiveForDailyList).length;
    
    return {
      total: users.length,
      active: active,
      inactive: users.length - active,
      murid: murid.length,
      guru: guru.length,
      staff: staff.length,
      terplot: terplot,
      belumTerplot: murid.length - terplot
    };
  }, [users]);
  
  const itemsPerPage = 20; // Menampilkan 20 user per halaman sesuai permintaan

  const fetchUsers = async () => {
    setIsFetching(true);
    try {
      // Ambil SEMUA user â€” paginasi dilakukan secara client-side (slice)
      const response = await operatorAPI.getUsers({
        search: searchTerm,
        per_page: 9999
      });
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Gagal mengambil data pengguna');
    } finally {
      setIsFetching(false);
    }
  };

  // Menghapus fetching internal yang menyebabkan double load dan blank screen
  // karena data sudah disediakan oleh parent SuperAdminDashboard
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchUsers();
    }
  }, [refreshTrigger]);

  // Auto-reload removed to prevent screen flashing and infinite loading loops. Data freshness is managed by the parent via sync button or refreshTrigger.

  useEffect(() => {
    if (setIsSyncing) {
      setIsSyncing(isFetching || isUploading);
    }
  }, [isFetching, isUploading, setIsSyncing]);

  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Pilih file excel terlebih dahulu');
      return;
    }
    try {
      setIsUploading(true);
      if (setIsSyncing) setIsSyncing(true);
      const formData = new FormData();
      formData.append('excel_file', selectedFile);
      const response = await operatorAPI.importAcademicMembers(formData);
      toast.success(response.data?.message || 'Registrasi massal berhasil dilakukan!');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Reset ke halaman 1
      setCurrentPage(1);
      
      // Sinkronkan data ke dashboard induk â€” ini yang memicu re-render seluruh data
      if (onSync) onSync();
      
      // Ambil juga data terbaru secara lokal
      await fetchUsers();
      
    } catch (error) {
       console.error('Import error:', error);
       const errorMsg = error.response?.data?.message || error.response?.data?.errors?.excel_file?.[0] || 'Terjadi kesalahan saat import data.';
       toast.error(errorMsg);
    } finally {
      setIsUploading(false);
      if (setIsSyncing) setIsSyncing(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await operatorAPI.exportMembersExcel();
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database-anggota-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Ekspor Excel berhasil diunduh.');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Gagal mengekspor data anggota.');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleStatus = async (user) => {
    const currentStatus = String(user.is_active) !== '0' && user.is_active !== false;
    const newStatus = currentStatus ? 0 : 1;
    
    // Optimistic Update: Langsung ubah di layar tanpa loading
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: newStatus } : u));
    setActiveMenuId(null);

    try {
      const response = await operatorAPI.toggleUserStatus(user.id);
      const updatedUser = response.data?.data;
      
      if (updatedUser) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: updatedUser.is_active } : u));
      }
      
      toast.success(`Status akun berhasil diperbarui.`);
      if (onSync) onSync(); 
      notifyUserRecordsChanged();
    } catch (e) { 
      toast.error('Gagal mengubah status'); 
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: currentStatus } : u));
    }
  };

  const openOffboardModal = (user) => {
    setActiveMenuId(null);
    setUserToOffboard(user);
    setOffboardDate(new Date().toISOString().slice(0, 10)); // default: hari ini
    setOffboardReason('');
    setOffboardRetired(false);
  };

  const confirmOffboard = async () => {
    if (!userToOffboard) return;
    const targetId = userToOffboard.id;
    setIsOffboarding(true);
    try {
      const response = await operatorAPI.offboardUser(targetId, {
        offboard_effective_date: offboardDate || undefined,
        offboard_reason: offboardReason || undefined,
        retired: offboardRetired,
      });
      toast.success(response.data?.message || 'Akses pegawai berhasil dicabut.');
      setUserToOffboard(null);
      await fetchUsers();
      if (onSync) onSync();
      notifyUserRecordsChanged();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal menonaktifkan pegawai.');
    } finally {
      setIsOffboarding(false);
    }
  };

  const confirmReactivate = async () => {
    if (!userToReactivate) return;
    const targetId = userToReactivate.id;
    setIsReactivating(true);
    try {
      const response = await operatorAPI.reactivateUser(targetId);
      toast.success(response.data?.message || 'Akun pegawai berhasil diaktifkan kembali.');
      setUserToReactivate(null);
      await fetchUsers();
      if (onSync) onSync();
      notifyUserRecordsChanged();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal mengaktifkan kembali akun.');
    } finally {
      setIsReactivating(false);
    }
  };

  const handleImpersonate = async (targetUser) => {
    setIsImpersonating(true);
    setActiveMenuId(null);
    try {
      const response = await operatorAPI.impersonateUser(targetUser.id);
      if (response.data.success) {
        // Simpan token asli operator sebelum diganti
        const originalToken = sessionStorage.getItem('token');
        const originalUser = sessionStorage.getItem('user');
        sessionStorage.setItem('operator_original_token', originalToken);
        sessionStorage.setItem('operator_original_user', originalUser);
        // Set token dan user impersonation
        sessionStorage.setItem('token', response.data.impersonation_token);
        sessionStorage.setItem('user', JSON.stringify({ ...response.data.target_user, _impersonating: true, _expires_at: response.data.expires_at }));
        toast.success(`Masuk sebagai ${targetUser.name}`);
        // Reload halaman agar dashboard menyesuaikan role target
        window.location.href = '/dashboard';
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal memulai sesi impersonation');
    } finally {
      setIsImpersonating(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    const targetId = userToDelete.id;
    const targetUser = users.find(u => u.id === targetId);

    // Optimistic UI Update untuk Delete
    setUsers(prev => prev.filter(u => u.id !== targetId));
    setUserToDelete(null);

    try {
      await operatorAPI.deleteUser(targetId);
      await fetchUsers();
      toast.success(`Akun berhasil dihapus.`);
      if (onSync) await onSync(); // Parent/dashboard lain membaca ulang data sumber dari API.
      notifyUserRecordsChanged();
    } catch (e) { 
      toast.error('Gagal menghapus akun'); 
      if (targetUser) setUsers(prev => [...prev, targetUser]);
    }
  };

  const handleClearAllUsers = async () => {
    try {
      setIsClearingAll(true);
      const response = await operatorAPI.deleteAllUsers();
      toast.success(response.data?.message || 'Seluruh data pengguna berhasil dihapus sampai bersih.');
      
      // Reset state local
      setUsers(prev => prev.filter(u => u.is_current_user));
      
      // Fetch ulang untuk sinkronisasi total
      await fetchUsers();
      if (onSync) onSync();
    } catch (error) {
      console.error('Clear all users error:', error);
      toast.error(error.response?.data?.message || 'Gagal menghapus seluruh data pengguna.');
    } finally {
      setIsClearingAll(false);
      setIsClearAllModalOpen(false);
    }
  };

  const getFilteredAndSortedUsers = () => {
    const order = ['murid', 'guru', 'kepala_sekolah', 'wakil_sekolah', 'cashier', 'operator', 'admin_akademik', 'pusat_jurusan'];
    const getDetailedRoleInternal = (u) => getDetailedRole(u);

    let result = [...users];

    // Daftar harian hanya menampilkan pegawai/murid yang masih aktif bertugas.
    result = result.filter(isActiveForDailyList);

    // Client-side instant filtering
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(u => 
        (u.name || '').toLowerCase().includes(s) || 
        (u.email || '').toLowerCase().includes(s) ||
        (u.school_id || '').toLowerCase().includes(s) ||
        (u.access_role || u.role || '').toLowerCase().includes(s) ||
        (u.position_status || '').toLowerCase().includes(s)
      );
    }

    const sorted = result.sort((a, b) => {
        const statusA = (a.position_status || '').toLowerCase();
        const statusB = (b.position_status || '').toLowerCase();
        
        const getStatusRank = (s) => (s === 'honorer' ? 8 : (s === 'magang' ? 9 : 0));
        const rankA = getStatusRank(statusA);
        const rankB = getStatusRank(statusB);

        if (rankA !== rankB) return rankA - rankB;

        const detA = getDetailedRole(a); const detB = getDetailedRole(b);
        const indexA = order.indexOf(detA); const finalIndexA = indexA === -1 ? 99 : indexA;
        const indexBIdx = order.indexOf(detB); const finalIndexB = indexBIdx === -1 ? 99 : indexBIdx;
        
        if (finalIndexA !== finalIndexB) return finalIndexA - finalIndexB;
        return (a.name || '').localeCompare(b.name || '');
    });
    
    return sorted;
  };

  const getPaginatedUsers = () => {
    const filtered = getFilteredAndSortedUsers();
    return filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  };

  // Arsip: seluruh akun yang TIDAK lagi aktif harian (offboarded / nonaktif / expired / pending).
  const getArchiveUsers = () => {
    let result = users.filter((u) => !isActiveForDailyList(u));
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter((u) =>
        (u.name || '').toLowerCase().includes(s) ||
        (u.email || '').toLowerCase().includes(s) ||
        (u.school_id || '').toLowerCase().includes(s) ||
        (u.access_role || u.role || '').toLowerCase().includes(s)
      );
    }
    return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  };

  const Pagination = () => {
    const filtered = getFilteredAndSortedUsers();
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (totalPages <= 1) return null;

    // Tampilkan 5 angka berurutan + ellipsis di ujung
    const getPageNumbers = () => {
      if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      // Hitung start: 5 angka berurutan berpusat di currentPage
      let start = Math.max(1, currentPage - 2);
      let end = start + 4;
      if (end > totalPages) {
        end = totalPages;
        start = Math.max(1, end - 4);
      }
      const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      const result = [];
      if (start > 1) result.push('...');
      result.push(...pages);
      if (end < totalPages) result.push('...');
      return result;
    };

    return (
      <div className="mt-4 flex justify-end items-center gap-0.5 pt-3 border-t border-slate-100">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {getPageNumbers().map((pageNumber, index) => {
          if (pageNumber === '...') {
            return <span key={`dot-${index}`} className="px-1 text-slate-300 text-xs select-none">…</span>;
          }
          return (
            <button
              key={pageNumber}
              onClick={() => setCurrentPage(pageNumber)}
              className={`min-w-[24px] h-6 px-1 text-xs font-semibold transition-all ${
                currentPage === pageNumber
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {pageNumber}
            </button>
          );
        })}

        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const isAnyLoading = isGlobalSyncing || (isFetching && users.length === 0);

  return (
    <div className="w-full h-full pb-20 space-y-6 animate-fadeIn" onClick={() => setActiveMenuId(null)}>

      {/* Banner notifikasi akun baru */}
      {newAccountBanner && (
        <div className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-emerald-900">Akun berhasil dibuat!</p>
            <p className="mt-0.5 text-xs font-bold text-emerald-700">
              <span className="font-black">{newAccountBanner.name}</span>
              {newAccountBanner.school_id ? ` (${newAccountBanner.school_id})` : ''} sudah terdaftar.
              Notifikasi untuk segera reset password telah dikirim ke lonceng akun tersebut.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNewAccountBanner(null)}
            className="shrink-0 rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
            title="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* 1. UPLOAD SECTION */}
      <div className="bg-white rounded-[2.5rem] shadow-sm px-10 py-7 flex flex-col xl:flex-row justify-between items-center gap-6 w-full border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="space-y-1">
            <h2 className="text-[18px] font-black text-slate-800 tracking-tight">Registrasi Massal Anggota</h2>
            <p className="text-slate-500 text-[12px] font-medium italic">Gunakan file Excel (*.xlsx) untuk mengunggah banyak data pengguna sekaligus.</p>
          </div>
          <div className="flex items-center gap-4 w-full xl:w-auto">
             <div className="flex w-full sm:w-[500px] rounded-full border border-blue-50 h-[48px] bg-blue-50/20 shadow-inner">
                 <div className="flex-1 flex items-center px-6 overflow-hidden">
                    <span className="text-[12px] text-slate-400 italic truncate tracking-tight">{selectedFile ? selectedFile.name : 'unggah file dalam bentuk *.xlsx'}</span>
                    <input type="file" className="hidden" ref={fileInputRef} accept=".xlsx" onChange={handleFileChange} />
                 </div>
                 <button onClick={() => fileInputRef.current?.click()} className="h-full px-7 bg-blue-50 hover:bg-blue-600 hover:text-white active:bg-blue-800 text-blue-600 font-black text-[10px] uppercase tracking-widest transition-all rounded-r-full">CHOOSE FILE</button>
             </div>
             <button onClick={handleImport} disabled={!selectedFile || isUploading} className={`h-[48px] px-10 rounded-full font-black text-[11px] uppercase tracking-widest shadow-xl transition-all duration-500 whitespace-nowrap ${selectedFile || isUploading ? "bg-gradient-to-r from-emerald-800 via-emerald-600 to-emerald-800 text-white shadow-emerald-200/50 hover:scale-105 active:scale-95 btn-shimmer" : "bg-slate-100 text-slate-400"}`}>
                {isUploading ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>IMPORT FILE</span>
                  </div>
                ) : 'IMPORT FILE'}
             </button>
          </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10 min-h-0 flex flex-col">
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Database Anggota Sekolah</h2>
            <p className="text-slate-500 font-medium text-sm">Kelola informasi murid, guru, dan staf secara terpadu. Gunakan fitur pencarian untuk menemukan data spesifik.</p>
          </div>

          {/* STATS BOXES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
             {/* Box 1: Total Anggota */}
             <div className="bg-blue-50/20 border border-blue-200 rounded-[2.5rem] p-7 flex items-center gap-6 group hover:bg-white hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-100/50 transition-all duration-500">
                <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform duration-500">
                   <Users className="w-8 h-8" />
                </div>
                <div className="flex-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Status Anggota</p>
                   <div className="flex items-center gap-6">
                      <div className="flex flex-col">
                         <h3 className="text-2xl font-black text-blue-600 leading-none">{userStats.active}</h3>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Aktif</span>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="flex flex-col">
                         <h3 className="text-2xl font-black text-slate-400 leading-none">{userStats.inactive}</h3>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 whitespace-nowrap">Off / Exp</span>
                      </div>
                      <div className="flex-1 text-right">
                         <h3 className="text-sm font-black text-slate-900 leading-none tracking-tight">{userStats.total}</h3>
                         <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Total</span>
                      </div>
                   </div>
                </div>
             </div>

             {/* Box 2: Komposisi Anggota */}
             <div className="bg-emerald-50/20 border border-emerald-200 rounded-[2.5rem] p-7 flex items-center gap-6 group hover:bg-white hover:border-emerald-300 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all duration-500">
                <div className="w-16 h-16 bg-emerald-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform duration-500">
                   <GraduationCap className="w-8 h-8" />
                </div>
                <div className="flex-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Komposisi Anggota</p>
                   <div className="flex items-center gap-5">
                      <div className="flex flex-col">
                         <h3 className="text-xl font-black text-emerald-600 leading-none">{userStats.murid}</h3>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Murid</span>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="flex flex-col">
                         <h3 className="text-xl font-black text-emerald-600 leading-none">{userStats.guru}</h3>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Guru</span>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="flex flex-col">
                         <h3 className="text-xl font-black text-emerald-600 leading-none">{userStats.staff}</h3>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Staff</span>
                      </div>
                   </div>
                </div>
             </div>

             {/* Box 3: Plotting Kelas */}
             <div className="bg-amber-50/20 border border-amber-200 rounded-[2.5rem] p-7 flex items-center gap-6 group hover:bg-white hover:border-amber-300 hover:shadow-2xl hover:shadow-amber-100/50 transition-all duration-500">
                <div className="w-16 h-16 bg-amber-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-amber-100 group-hover:scale-110 transition-transform duration-500">
                   <School className="w-8 h-8" />
                </div>
                <div className="flex-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Plotting Kelas</p>
                   <div className="flex items-center gap-6">
                      <div className="flex flex-col">
                         <h3 className="text-2xl font-black text-emerald-600 leading-none">{userStats.terplot}</h3>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Sudah</span>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="flex flex-col">
                         <h3 className="text-2xl font-black text-rose-600 leading-none">{userStats.belumTerplot}</h3>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Belum</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 mb-8 items-center">
              <div className="flex-1 w-full h-11 flex items-center gap-2 rounded-xl bg-white border border-slate-200/90 shadow-xs px-3 transition-all duration-200 focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-amber-500/15 focus-within:shadow-sm">
                <span className="shrink-0 flex items-center justify-center p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input type="text" placeholder="cari nama user atau role user..." className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-bold text-slate-700 placeholder-slate-400/60 placeholder:italic font-sans" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                    title="Bersihkan pencarian"
                    aria-label="Bersihkan pencarian"
                    className="shrink-0 flex items-center justify-center rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fetchUsers()}
                  disabled={isFetching}
                  title="Refresh Data User"
                  aria-label="Refresh Data User"
                  className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center border transition-all duration-200 active:scale-95 focus:outline-none focus:ring-4 focus:ring-violet-500/25 ${isFetching
                    ? 'bg-gradient-to-br from-violet-600 to-purple-600 text-white border-violet-600 shadow-md shadow-violet-500/30'
                    : 'bg-gradient-to-br from-violet-50 to-purple-100/90 text-violet-600 border-violet-200/90 shadow-xs hover:from-violet-600 hover:to-purple-600 hover:text-white hover:border-violet-600 hover:shadow-md hover:shadow-violet-500/30 hover:-translate-y-0.5'}`}
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
                 <button onClick={handleExport} disabled={isExporting} className="h-11 px-4 rounded-xl text-xs font-semibold tracking-wide inline-flex items-center gap-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] shrink-0 bg-white text-emerald-700 border border-emerald-200/90 shadow-xs hover:bg-emerald-50/80 hover:border-emerald-300 hover:shadow-sm disabled:opacity-60">
                   <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">{isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}</span> EKSPOR DATA
                 </button>
                 <button onClick={() => setIsClearAllModalOpen(true)} className="group h-11 px-4 rounded-xl text-xs font-semibold tracking-wide inline-flex items-center gap-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] shrink-0 bg-white text-rose-600 border border-rose-200/90 shadow-xs hover:bg-rose-600 hover:text-white hover:border-rose-600 hover:shadow-md hover:shadow-rose-500/20">
                  <Trash2 className="w-4 h-4 transition-colors group-hover:text-white" /> HAPUS SEMUA
                </button>
                <button onClick={() => { setUserToEdit(null); setIsAddModalOpen(true); }} className="h-11 px-4 rounded-xl text-xs font-semibold tracking-wide inline-flex items-center gap-2 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-blue-500/50 ring-1 ring-inset ring-white/20 shadow-md shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-blue-600/30">
                  <UserPlus className="w-4 h-4" /> TAMBAH ANGGOTA
                </button>
             </div>
          </div>

          {/* TAB PEMISAH: Pengguna Aktif vs Arsip Pegawai Nonaktif */}
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100">
            {[
              { id: 'aktif', label: 'Pengguna Aktif', count: userStats.active },
              { id: 'arsip', label: 'Arsip Pegawai Nonaktif', count: getArchiveUsers().length },
            ].map((t) => {
              const on = viewTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setViewTab(t.id); setCurrentPage(1); }}
                  className={`relative inline-flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                    on ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${on ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
                  {on && <span className="absolute left-0 -bottom-px h-0.5 w-full rounded-full bg-blue-600" />}
                </button>
              );
            })}
          </div>

          {viewTab === 'aktif' ? (
          <>
          <div className="flex-1 relative min-h-[400px]">
             {isAnyLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-md z-10 animate-fadeIn rounded-[2.5rem] border border-slate-100 shadow-sm">
                   <Loader2 className="w-12 h-12 text-black animate-spin mb-5" />
                   <p className="text-black font-black text-[13px] uppercase tracking-widest flex items-center">
                      SEDANG MEMUAT USER<AnimatedLoadingText />
                   </p>
                </div>
             ) : (
                 <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 content-start">
                   {getPaginatedUsers().map((user) => {
                     const userIsExpired = isExpired(user);
                     const isActive = (user.is_active === true || user.is_active === 1 || String(user.is_active) === '1' || user.is_active === 'true') && !userIsExpired;
                     const detRole = getDetailedRole(user);
                     const status = (user.position_status || '').toLowerCase();
                     const toneMap = { 'murid': 'blue', 'guru': 'emerald', 'kepala_sekolah': 'amber', 'wakil_sekolah': 'orange', 'operator': 'superadmin_special', 'admin_akademik': 'superadmin_special', 'cashier': 'rose', 'pusat_jurusan': 'teal' };
                     
                     let tone = 'slate';
                     if (!isActive) {
                        tone = 'slate';
                     } else if (status === 'honorer') {
                        tone = 'honorer_special';
                     } else if (status === 'magang') {
                        tone = 'magang_special';
                     } else {
                        tone = toneMap[detRole] || 'slate';
                     }

                     const styleMap = {
                        blue: { border: "border-blue-200", bg: "bg-gradient-to-br from-blue-100/90 via-white to-white", badgeBg: "bg-blue-500", badgeText: "text-white", icon: "text-blue-500", shadow: "hover:shadow-blue-200/50" },
                        emerald: { border: "border-emerald-200", bg: "bg-gradient-to-br from-emerald-100/90 via-white to-white", badgeBg: "bg-emerald-500", badgeText: "text-white", icon: "text-emerald-500", shadow: "hover:shadow-emerald-200/50" },
                        amber: { border: "border-amber-200", bg: "bg-gradient-to-br from-amber-100/90 via-white to-white", badgeBg: "bg-amber-500", badgeText: "text-white", icon: "text-amber-500", shadow: "hover:shadow-amber-200/50" },
                        orange: { border: "border-orange-200", bg: "bg-gradient-to-br from-orange-100/90 via-white to-white", badgeBg: "bg-orange-500", badgeText: "text-white", icon: "text-orange-500", shadow: "hover:shadow-orange-200/50" },
                        indigo: { border: "border-indigo-200", bg: "bg-gradient-to-br from-indigo-100/90 via-white to-white", badgeBg: "bg-indigo-500", badgeText: "text-white", icon: "text-indigo-500", shadow: "hover:shadow-indigo-200/50" },
                        cyan: { border: "border-cyan-200", bg: "bg-gradient-to-br from-cyan-100/90 via-white to-white", badgeBg: "bg-cyan-500", badgeText: "text-white", icon: "text-cyan-500", shadow: "hover:shadow-cyan-200/50" },
                        rose: { border: "border-rose-200", bg: "bg-gradient-to-br from-rose-100/90 via-white to-white", badgeBg: "bg-rose-500", badgeText: "text-white", icon: "text-rose-500", shadow: "hover:shadow-rose-200/50" },
                        teal: { border: "border-teal-200", bg: "bg-gradient-to-br from-teal-100/90 via-white to-white", badgeBg: "bg-teal-500", badgeText: "text-white", icon: "text-teal-500", shadow: "hover:shadow-teal-200/50" },
                        honorer_special: { border: "border-lime-200", bg: "bg-gradient-to-br from-lime-100/90 via-white to-white", badgeBg: "bg-lime-600", badgeText: "text-white", icon: "text-lime-600", shadow: "hover:shadow-lime-200/50" },
                        magang_special: { border: "border-purple-200", bg: "bg-gradient-to-br from-purple-100/90 via-white to-white", badgeBg: "bg-purple-600", badgeText: "text-white", icon: "text-purple-600", shadow: "hover:shadow-purple-200/50" },
                        superadmin_special: { border: "border-slate-800", bg: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900", badgeBg: "bg-amber-400", badgeText: "text-slate-900", icon: "text-amber-400", shadow: "hover:shadow-slate-900/50" },
                        slate: { border: "border-slate-300", bg: "bg-[#f8fafc]", badgeBg: "bg-slate-500", badgeText: "text-white", icon: "text-slate-400", shadow: "hover:shadow-slate-200/50" }
                      };
                     const theme = styleMap[tone] || styleMap.slate;
                     const isDarkTheme = tone === 'superadmin_special';

                     const titleColor = isDarkTheme && isActive ? "text-white" : isActive ? "text-[#0f172a]" : "text-slate-500";
                     const infoBg = isDarkTheme && isActive ? "bg-slate-800/80 border-amber-500/30 shadow-[0_2px_10px_-4px_rgba(251,191,36,0.1)]" : isDarkTheme && !isActive ? "bg-slate-800 border-slate-700 shadow-none" : isActive ? "bg-white border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.04)]" : "bg-slate-50 border-slate-200 shadow-none";
                     const infoTextColor = isDarkTheme && isActive ? "text-slate-200" : isDarkTheme && !isActive ? "text-slate-500" : isActive ? "text-[#0f172a]" : "text-slate-400";

                      const isHonorer = status === 'honorer';
                      const isMagang = status === 'magang';

                      const displayTag = isHonorer ? 'HONORER' : (isMagang ? 'MAGANG' : (labelMap[detRole] || "USER"));

                      // Baris bawah kartu: status kepegawaian SPESIFIK (TETAP /
                      // HONORER / MAGANG) + masa berlaku kontrak untuk honorer/magang.
                      const statusLabel = isHonorer ? 'HONORER' : (isMagang ? 'MAGANG' : 'TETAP');
                      let box3Text = statusLabel;
                      if (isHonorer || isMagang) {
                        const start = String(user.magang?.tanggal_mulai || user.honorer?.kontrak_mulai || user.joined_at || '').substring(0, 10);
                        const end = String(user.magang?.tanggal_selesai || user.honorer?.kontrak_selesai || user.contract_end_date || '').substring(0, 10);
                        if (start || end) box3Text = `${statusLabel} · ${start || '?'} s/d ${end || '?'}`;
                      }

                                           return (
                        <div key={user.id} className={`group relative rounded-[2.5rem] border-2 p-5 pt-4 transition-all duration-500 overflow-hidden flex flex-col hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] ${theme.shadow} ${!isActive && !isDarkTheme ? "opacity-[0.85] bg-slate-100 border-slate-200" : `${theme.bg} ${theme.border}`} w-full`}>
                          
                          {/* Top Action & Status Row */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                             <div className={`flex flex-wrap gap-1.5 flex-1 ${detRole === 'wakil_sekolah' ? 'flex-col items-start' : 'items-center'}`}>
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm shrink-0 whitespace-nowrap ${theme.badgeBg} ${theme.badgeText}`}>
                                   {displayTag}
                                </span>
                                {userIsExpired && <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm shrink-0 whitespace-nowrap bg-rose-500 text-white">EXPIRED</span>}
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-sm transition-all duration-300 ${isActive ? (isDarkTheme ? "bg-emerald-400/10 border-emerald-400/20" : "bg-emerald-50 border-emerald-100") : (isDarkTheme ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100")}`}>
                                   <div className="relative flex items-center justify-center w-1.5 h-1.5">
                                      {isActive && <div className={`absolute w-full h-full rounded-full animate-ping opacity-40 ${isDarkTheme ? 'bg-emerald-400' : 'bg-emerald-500'}`} />}
                                      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? (isDarkTheme ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]") : "bg-slate-400"}`} />
                                   </div>
                                   <span className={`text-[8px] font-black uppercase tracking-widest ${isActive && isDarkTheme ? "text-emerald-400" : isActive ? "text-emerald-700" : "text-slate-500"}`}>{isActive ? "AKTIF" : "OFF"}</span>
                                </div>
                             </div>
                             <div className="relative shrink-0">
                                <button type="button" onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === user.id ? null : user.id); }} className={`w-[28px] h-[28px] flex items-center justify-center -mr-1 mt-0.5 border-[1.5px] shadow-sm rounded-[0.5rem] transition-all active:scale-95 ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-[#0f172a] hover:bg-slate-50'}`}><MoreVertical className="w-4 h-4" strokeWidth={3} /></button>
                                {activeMenuId === user.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} />
                                    <div className="absolute right-0 top-10 w-48 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-100 py-1.5 z-50 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                                      <button type="button" onClick={() => { if (isActive && detRole !== 'murid') { openOffboardModal(user); } else { setActiveMenuId(null); toggleStatus(user); } }} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 text-[10px] font-black uppercase text-slate-600 border-b border-slate-50/50">
                                        {isActive ? <PowerOff className="w-3.5 h-3.5 text-[#0f172a]" /> : <Power className="w-3.5 h-3.5 text-emerald-500" />}
                                        {isActive ? (detRole !== 'murid' ? "Nonaktifkan (Offboard)" : "Nonaktifkan") : "Aktifkan"}
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => { setActiveMenuId(null); setUserToEdit(user); setIsEditModalOpen(true); }} 
                                        className="w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-black uppercase border-b border-slate-50/50 transition-colors text-slate-600 hover:bg-slate-50"
                                      >
                                        <Edit className="w-3.5 h-3.5 text-blue-500" />
                                        Edit User
                                      </button>

                                      <button type="button" onClick={() => { setActiveMenuId(null); setUserToDelete(user); }} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-rose-50 text-[10px] font-black uppercase text-rose-600">
                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                        Hapus Akun
                                      </button>
                                      {getDetailedRole(user) !== 'operator' && !user.is_current_user && (
                                        <button type="button" onClick={() => handleImpersonate(user)} disabled={isImpersonating} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-indigo-50 text-[10px] font-black uppercase text-indigo-600 border-t border-slate-50/50">
                                          <LogIn className="w-3.5 h-3.5 text-indigo-500" />
                                          Akses sebagai User
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                             </div>
                          </div>

                          {/* Contract Warning Row */}
                          {(() => {
                             const dLeft = getDaysRemaining(user);
                             if (dLeft !== null && dLeft >= 0 && dLeft <= 7 && !userIsExpired) {
                                const isUrgent = dLeft <= 3;
                                return (
                                   <div className="-mt-1.5 mb-1.5 animate-fadeIn">
                                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm ${isDarkTheme ? 'bg-amber-400/10 border-amber-400/50' : 'bg-white/60 border-amber-400 shadow-amber-100/50'}`}>
                                         <div className="relative flex items-center justify-center w-1.5 h-1.5">
                                            {isUrgent && <div className={`absolute w-full h-full rounded-full animate-ping opacity-70 ${isDarkTheme ? 'bg-amber-400' : 'bg-amber-500'}`} />}
                                            <div className={`w-1.5 h-1.5 rounded-full ${isDarkTheme ? 'bg-amber-400' : 'bg-amber-500'} shadow-[0_0_5px_rgba(245,158,11,0.6)]`} />
                                         </div>
                                         <span className={`text-[8px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-amber-400' : 'text-amber-600'}`}>
                                            KONTRAK AKAN BERAKHIR
                                         </span>
                                      </div>
                                   </div>
                                );
                             }
                             return null;
                          })()}

                          {/* Dynamic Name Header */}
                          <div className="mb-4 mt-1">
                              <h3 className={`font-black tracking-tight leading-[1.2] transition-all duration-300 ${titleColor} text-[13px]`}>
                                 {user.name}
                              </h3>

                           </div>
                          
                          {/* Info Stack - Layout Fixes */}
                          <div className="flex flex-col items-stretch space-y-2 w-full">
                             <div className={`flex items-center justify-start gap-3 px-3.5 py-2.5 rounded-xl border transition-all group-hover:scale-[1.02] ${infoBg}`}>
                                <Mail className={`w-4 h-4 mt-0.5 shrink-0 self-start ${theme.icon}`} />
                                <span className={`text-[12px] font-bold break-all leading-snug ${infoTextColor}`}>{user.email || "-"}</span>
                             </div>
                             <div className={`flex items-center justify-start gap-3 px-3.5 py-2.5 rounded-xl border transition-all group-hover:scale-[1.02] ${infoBg}`}>
                                <Phone className={`w-4 h-4 shrink-0 ${theme.icon}`} />
                                <span className={`text-[12px] font-bold leading-none ${infoTextColor}`}>{user.phone || "-"}</span>
                             </div>
                             <div className={`flex items-center justify-start gap-3 px-3.5 py-2.5 rounded-xl border transition-all group-hover:scale-[1.02] ${infoBg}`}>
                                {detRole === "murid" ? <School className={`w-4 h-4 shrink-0 ${theme.icon}`}/> : <BadgeCheck className={`w-4 h-4 shrink-0 ${theme.icon}`} />}
                                <span className={`text-[11px] font-black uppercase tracking-tight leading-none ${infoTextColor}`}>{detRole === "murid" ? (user.class_name || "-") : box3Text}</span>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
             )}
          </div>
            <Pagination />
          </>
          ) : (
          <div className="flex-1 relative min-h-[400px]">
            {getArchiveUsers().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Belum ada pegawai nonaktif</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">Arsip akan terisi otomatis saat ada pegawai yang di-offboard atau dinonaktifkan.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Nama</th>
                      <th className="px-5 py-3">Jabatan / Role Terakhir</th>
                      <th className="px-5 py-3">Tgl. Efektif Berhenti</th>
                      <th className="px-5 py-3">Alasan Keluar</th>
                      <th className="px-5 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {getArchiveUsers().map((u) => {
                      const detRole = getDetailedRole(u);
                      const isOffboarded = u.is_offboarded || (!employmentActive(u));
                      const effDate = u.offboard_effective_date
                        ? new Date(u.offboard_effective_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                        : null;
                      const statusText = isOffboarded
                        ? ((u.employment_status || '').toLowerCase() === 'retired' ? 'Purna Tugas' : 'Keluar / Dinonaktifkan')
                        : (isExpired(u) ? 'Kontrak Berakhir' : 'Nonaktif / Pending');
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4">
                            <div className="text-[13px] font-black text-slate-800">{u.name}</div>
                            <div className="text-[11px] text-slate-400 font-medium">{u.school_id || u.email || '-'}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-600">
                              {titleCaseLabelMap[detRole] || u.role_name || detRole || 'USER'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[12px] font-bold text-slate-600">
                            {effDate || <span className="text-slate-400">-</span>}
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-[12px] font-bold text-slate-700">{u.offboard_reason || statusText}</div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{statusText}</div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setUserToReactivate(u)}
                              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-md hover:opacity-95 active:scale-95 transition-all"
                            >
                              <Power className="w-3.5 h-3.5" /> Aktifkan Kembali
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
      </div>
      <AddUserModal 
        isOpen={isAddModalOpen} 
        userToEdit={null} 
        allUsers={users}
        kbmMasterData={kbmMasterData}
        onClose={() => { setIsAddModalOpen(false); setUserToEdit(null); }} 
        onSuccess={async (createdUser) => {
          await fetchUsers();
          if (onSync) await onSync();
          notifyUserRecordsChanged();
          // Banner notifikasi di halaman
          if (createdUser?.name) {
            setNewAccountBanner({ name: createdUser.name, school_id: createdUser.school_id });
            setTimeout(() => setNewAccountBanner(null), 8000);
          }
          // Trigger refresh lonceng di header
          window.dispatchEvent(new CustomEvent('refreshNotifications'));
        }} 
      />
      <EditUserModal 
        isOpen={isEditModalOpen} 
        userToEdit={userToEdit} 
        allUsers={users}
        kbmMasterData={kbmMasterData}
        onClose={() => { setIsEditModalOpen(false); setUserToEdit(null); }} 
        onSuccess={async () => {
          // Gunakan respons daftar terbaru dari backend supaya edit tidak hanya
          // mengubah tampilan lokal dan perubahan role langsung tercermin.
          await fetchUsers();
          if (onSync) await onSync();
          notifyUserRecordsChanged();
        }} 
      />


      {/* Futuristic Delete Confirmation Dialog */}
      {userToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-md transition-all duration-500" />
          
          <div className="relative w-full max-w-[480px] bg-white rounded-[2.5rem] shadow-[0_25px_80px_-15px_rgba(0,0,0,0.4)] border-2 border-rose-200 overflow-hidden animate-slideUp">
            {/* Red Accent Strip (Top) */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-rose-300 to-rose-600 shadow-[0_2px_10px_rgba(244,63,94,0.4)]" />
            
            <div className="p-8 pt-10">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0 shadow-sm border border-rose-100/50">
                  <Trash2 className="w-7 h-7 text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[20px] font-black text-[#0f172a] leading-tight mb-2">
                    Hapus Akun, <span className="text-rose-600 truncate">{userToDelete.name.split(',')[0]}</span>.?
                  </h3>
                  <p className="text-[13px] text-[#0f172a] font-medium leading-relaxed">
                    Data akan terhapus secara <span className="text-rose-600 font-bold">permanen</span> di dalam sistem database dan tidak dapat dipulihkan kembali.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Bottom Right */}
              <div className="flex items-center justify-end gap-3 mt-10">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="px-8 py-3.5 font-black text-[12px] uppercase tracking-[0.2em] text-[#64748b] hover:text-[#0f172a] transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className="px-8 py-3 rounded-xl bg-rose-600 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center min-w-[120px]"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Konfirmasi Offboarding Pegawai */}
      {userToOffboard && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-md" onClick={() => !isOffboarding && setUserToOffboard(null)} />
          <div className="relative w-full max-w-[520px] bg-white rounded-[2.5rem] shadow-[0_25px_80px_-15px_rgba(0,0,0,0.4)] border-2 border-amber-200 overflow-hidden animate-slideUp">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-600" />
            <div className="p-8 pt-10">
              <div className="flex items-start gap-5 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                  <PowerOff className="w-7 h-7 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[19px] font-black text-[#0f172a] leading-tight mb-1.5">
                    Nonaktifkan <span className="text-amber-600 truncate">{userToOffboard.name.split(',')[0]}</span>
                  </h3>
                  <p className="text-[12.5px] text-slate-500 font-medium leading-relaxed">
                    Akses login pegawai akan <span className="text-amber-600 font-bold">langsung dicabut (force logout)</span> pada tanggal efektif, akun dipindahkan ke tab <span className="font-bold">Arsip Pegawai Nonaktif</span>, dan seluruh riwayat nilai/jurnal/transaksi tetap aman.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tanggal Efektif Berhenti</span>
                  <input
                    type="date"
                    value={offboardDate}
                    onChange={(e) => setOffboardDate(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
                  />
                  <span className="mt-1.5 block text-[11px] text-slate-400 font-medium">Default hari ini. Tanggal masa depan → akses dicabut otomatis saat tanggal tercapai.</span>
                </label>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Alasan Keluar</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {OFFBOARD_REASON_OPTIONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setOffboardReason(r)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${offboardReason === r ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={offboardReason}
                    onChange={(e) => setOffboardReason(e.target.value)}
                    placeholder="atau tulis alasan bebas..."
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={offboardRetired} onChange={(e) => setOffboardRetired(e.target.checked)} className="w-4 h-4 rounded accent-amber-600" />
                  <span className="text-[12px] font-bold text-slate-600">Tandai sebagai Purna Tugas / Pensiun (retired)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 mt-9">
                <button onClick={() => setUserToOffboard(null)} disabled={isOffboarding} className="px-7 py-3 font-black text-[12px] uppercase tracking-[0.2em] text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50">Batal</button>
                <button onClick={confirmOffboard} disabled={isOffboarding} className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:opacity-95 transition-all active:scale-95 flex items-center justify-center min-w-[140px] disabled:opacity-60">
                  {isOffboarding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cabut Akses'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Konfirmasi Aktifkan Kembali */}
      {userToReactivate && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-md" onClick={() => !isReactivating && setUserToReactivate(null)} />
          <div className="relative w-full max-w-[460px] bg-white rounded-[2.5rem] shadow-[0_25px_80px_-15px_rgba(0,0,0,0.4)] border-2 border-emerald-200 overflow-hidden animate-slideUp">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-300 to-emerald-600" />
            <div className="p-8 pt-10">
              <div className="flex items-start gap-5 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Power className="w-7 h-7 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[19px] font-black text-[#0f172a] leading-tight mb-1.5">Aktifkan Kembali?</h3>
                  <p className="text-[12.5px] text-slate-500 font-medium leading-relaxed">
                    Akun <span className="font-bold text-slate-700">{userToReactivate.name}</span> akan kembali aktif bertugas dan muncul di daftar harian.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setUserToReactivate(null)} disabled={isReactivating} className="px-7 py-3 font-black text-[12px] uppercase tracking-[0.2em] text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50">Batal</button>
                <button onClick={confirmReactivate} disabled={isReactivating} className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:opacity-95 transition-all active:scale-95 flex items-center justify-center min-w-[140px] disabled:opacity-60">
                  {isReactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aktifkan'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Futuristic Clear All Users Confirmation Dialog */}
      {isClearAllModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-xl transition-all duration-500" />
          
          <div className="relative w-full max-w-[520px] bg-white rounded-[3rem] shadow-[0_25px_100px_-15px_rgba(0,0,0,0.5)] border-4 border-rose-500/20 overflow-hidden animate-slideUp">
            {/* Critical Alert Header */}
            <div className="bg-rose-600 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-xl">
                  <ShieldAlert className="w-9 h-9 text-white" />
                </div>
                <div>
                  <h3 className="text-[22px] font-black uppercase tracking-tight leading-none mb-2">Tindakan Destruktif</h3>
                  <p className="text-white/80 text-[11px] font-bold uppercase tracking-widest">Penghapusan Seluruh Basis Data Pengguna</p>
                </div>
              </div>
            </div>
            
            <div className="p-10">
              <div className="space-y-6">
                <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100">
                  <p className="text-[14px] text-slate-700 font-bold leading-relaxed">
                    Anda akan menghapus <span className="text-rose-600 font-black underline underline-offset-4">SELURUH</span> data pengguna di dalam sistem manajemen.
                  </p>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
                      Tindakan ini bersifat <span className="text-rose-600 font-black">PERMANEN</span>. Seluruh profil, dokumen digital, dan riwayat terkait pengguna akan hilang secara fisik dari server database.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                   <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">AKUN ANDA ({users.find(u => u.is_current_user)?.name || 'Admin'}) AKAN TETAP AMAN</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 mt-12">
                <button
                  onClick={() => setIsClearAllModalOpen(false)}
                  disabled={isClearingAll}
                  className="px-10 py-4 font-black text-[12px] uppercase tracking-[0.2em] text-[#64748b] hover:text-[#0f172a] transition-colors disabled:opacity-50"
                >
                  Batalkan
                </button>
                <button
                  onClick={handleClearAllUsers}
                  disabled={isClearingAll}
                  className="px-12 py-4 rounded-2xl bg-rose-600 text-white text-[12px] font-black uppercase tracking-[0.2em] hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center min-w-[180px] shadow-xl shadow-rose-200 group"
                >
                  {isClearingAll ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>PROSES...</span>
                    </div>
                  ) : (
                    <span className="group-hover:translate-x-1 transition-transform">BERSIHKAN SEKARANG</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default UsersTab;
