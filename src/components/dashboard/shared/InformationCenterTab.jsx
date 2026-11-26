import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Filter, Pencil, Trash2, Archive, Bell, MessageSquare, 
  ShieldCheck, Megaphone, Info, Inbox, Paperclip, Image as ImageIcon,
  CheckCircle, AlertCircle, RefreshCw, Sparkles, Target, ArrowRight,
  RotateCcw, X, Eye, ChevronsLeft, ChevronsRight, ArrowUpRight, ArrowDownLeft,
  MoveUpRight, MoveDownLeft, Check, Download
} from 'lucide-react';
import { informationCenterAPI, pesanUserAPI, BASE_URL } from '../../../utils/api';
import { getQueryData, isQueryFresh, setQueryData } from '../../../utils/queryCache';
import GlassCard from './GlassCard';
import PesanChatBalloon from './PesanChatBalloon';
import ScrollableSelect from '../../shared/ScrollableSelect';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { toast } from 'react-hot-toast';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { resolveAccessRole, getAccessRoleLabel } from '../../../utils/userMeta';

const INFO_CACHE_TTL = 60000;

// ID user untuk kunci cache: prop diutamakan, lalu sesi login.
const readCachedUserId = () => {
  try {
    return JSON.parse(sessionStorage.getItem('user') || 'null')?.id || 'guest';
  } catch {
    return 'guest';
  }
};

const initialsOf = (name) => {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?';
};

const CATEGORY_COLORS = {
  'Pengumuman': 'bg-emerald-500',
  'Berita': 'bg-blue-500',
  'Peringatan': 'bg-red-500',
  'Sosialisasi': 'bg-amber-500',
  'Lainnya': 'bg-gray-500'
};

const CATEGORY_ICONS = {
  'Pengumuman': Megaphone,
  'Berita': MessageSquare,
  'Peringatan': ShieldCheck,
  'Sosialisasi': Bell,
  'Lainnya': Info
};

// Urutan role mengikuti "Posisi Jabatan" di Manajemen Pengguna
// (Murid, Guru, Kasir, lalu jabatan struktural), dengan Honorer/Magang
// diletakkan setelah Kasir seperti urutan pencadangan jabatan.
const TARGET_ROLES = [
  'Murid',
  'Guru',
  'Kasir',
  'Magang',
  'Honorer',
  'Pusat Jurusan',
  'Kepala Sekolah',
  'Wakil Kepala Sekolah',
  'Super Admin',
  'Admin Akademik'
];

// Opsi untuk ScrollableSelect di form Tulis Pesan.
const PESAN_ROLE_OPTIONS = TARGET_ROLES.map((role) => ({ value: role, label: role }));

const ROLE_SLUG_MAP = {
  'Guru': 'guru',
  'Murid': 'murid',
  'Kepala Sekolah': 'kepala_sekolah',
  'Wakil Kepala Sekolah': 'wakil_sekolah',
  'Pusat Jurusan': 'pusat_jurusan',
  'Kasir': 'cashier',
  'Honorer': 'honorer',
  'Magang': 'magang',
  'Super Admin': 'operator',
  'Admin Akademik': 'admin_akademik'
};

const initialFormState = {
  id: null,
  title: '',
  category: 'Pengumuman',
  target_roles: [],
  target_user_id: '',
  is_private: false,
  content: '',
  images: [],
  attachment: null
};

const MOTIVATION_QUOTES = [
  "Masa depan tidak datang begitu saja, ia sedang kalian bangun melalui setiap lembar buku yang kalian baca hari ini. Teruslah melangkah, karena cahaya kesuksesan hanya akan mengikuti mereka yang tidak pernah berhenti berusaha.",
  "Dunia menantikan karya-karya hebat yang lahir dari tangan kalian. Jangan takut berbuat salah, karena dari kesalahanlah kalian belajar cara menjadi luar biasa. Semangat belajar, Sang Juara!",
  "Di tangan kalianlah fajar peradaban akan terbit. Didiklah dirimu dengan disiplin, hiasilah hatimu dengan mimpi, dan taklukkanlah dunia dengan ilmu.",
  "Kesuksesan bukan milik mereka yang paling pintar, tapi milik mereka yang paling berani bangkit setiap kali terjatuh. Jangan takut pada kegagalan, karena itu adalah guru terbaik yang sedang menempa mental juaramu.",
  "Setiap dari kalian adalah permata dengan kilau yang berbeda. Tidak perlu menjadi orang lain untuk terlihat bersinar; cukup asah bakatmu dengan tekun, maka dunia akan melihat betapa berharganya dirimu.",
  "Ilmu adalah satu-satunya harta yang tidak akan pernah habis meski terus dibagikan. Kejarlah ia dengan rasa lapar, simpanlah ia dengan kerendahan hati, dan gunakanlah ia untuk menerangi jalan hidupmu dan orang lain.",
  "Di setiap sudut sekolah ini, tersimpan doa-doa kami untuk keberhasilan kalian. Kalian bukan sekadar angka di buku absen; kalian adalah kebanggaan dan harapan yang selalu kami jaga pertumbuhannya."
];

const InformationCenterTab = ({ user: propUser = null }) => {
  const [user, setUser] = useState(propUser);
  const [isAdmin, setIsAdmin] = useState(false);
  // Cache feed Pusat Informasi: kunjungan berikutnya tampil instan tanpa skeleton.
  const infoCacheKey = React.useMemo(
    () => `info-center:${propUser?.id || readCachedUserId()}`,
    [],
  );
  const cachedInfo = getQueryData(infoCacheKey);
  const [infos, setInfos] = useState(() => cachedInfo?.infos ?? []);
  const [drafts, setDrafts] = useState(() => cachedInfo?.drafts ?? []);
  const [allManageData, setAllManageData] = useState(() => cachedInfo?.allManageData ?? []); // State baru untuk menyimpan semua data
  const [loading, setLoading] = useState(() => !cachedInfo?.infos);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [pesanRole, setPesanRole] = useState(''); // State baru untuk filter role di Pesan Pribadi
  const [pesanSearchQuery, setPesanSearchQuery] = useState(''); // State baru untuk search nama di Pesan Pribadi
  
  // Tabs
  const [activeMainTab, setActiveMainTab] = useState('pengumuman'); // pengumuman, pesan
  const [isWritingPesan, setIsWritingPesan] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [pesanLoading, setPesanLoading] = useState(false);
  const [pesanForm, setPesanForm] = useState({ penerima_id: '', isi: '', lampiran: null });
  const [pesanUnreadCount, setPesanUnreadCount] = useState(0);
  const isStudentMessaging = resolveAccessRole(user) === 'murid';
  const pesanRoleOptions = PESAN_ROLE_OPTIONS.map((option) => ({
    ...option,
    disabled: isStudentMessaging && !['Guru', 'Murid'].includes(option.value),
  }));
  const [chatBalloon, setChatBalloon] = useState({ open: false, contact: null });
  const [attachmentViewer, setAttachmentViewer] = useState(null);
  
  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('Semua');
  const [filterRole, setFilterRole] = useState('Semua');
  const [sortBy, setSortBy] = useState('Terbaru');
  const [showArchived, setShowArchived] = useState(false);
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, filterRole, sortBy, showArchived]);
  const [confirmModal, setConfirmModal] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    onConfirm: null, 
    type: 'danger' 
  });

  // Form State

  const [form, setForm] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0); 
  const [previewData, setPreviewData] = useState(null); // State untuk modal preview detail
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % MOTIVATION_QUOTES.length);
    }, 15000);
    return () => clearInterval(interval);
  }, []);
  
  const handleResetForm = () => {
    setForm(initialFormState);
    setFormKey(prev => prev + 1);
  };
  
  const imageInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const pesanAttachmentRef = useRef(null);

  // Deriving role helpers
  const currentRole = user ? resolveAccessRole(user) : '';
  const isHonorerMagang = user?.position_status === 'honorer' || user?.position_status === 'magang' || currentRole === 'honorer' || currentRole === 'magang' || currentRole === 'magang_honor';
  const isMurid = currentRole === 'murid' || currentRole === 'siswa';
  // Dot pada pil "Informasi & Pengumuman": informasi yang belum pernah dibuka.
  const infoUnreadCount = infos.filter(item => item.is_read === false && item.author_id !== user?.id).length;

  // Helper untuk mapping role label secara konsisten
  const mapItemRoles = (item) => {
    const reverseRoleMap = {
      'operator': 'Super Admin',
      'admin_akademik': 'Admin Akademik',
      'guru': 'Guru',
      'murid': 'Murid',
      'siswa': 'Murid',
      'kepala_sekolah': 'Kepala Sekolah',
      'wakil_sekolah': 'Wakil Kepala Sekolah',
      'pusat_jurusan': 'Pusat Jurusan',
      'cashier': 'Kasir',
      'magang': 'Magang',
      'honorer': 'Honorer',
      'magang_honor': 'Honorer/Magang',
      'semua': 'Semua Role'
    };

    let rawRoles = [];
    try {
      rawRoles = Array.isArray(item.target_roles) 
        ? item.target_roles 
        : (typeof item.target_roles === 'string' ? JSON.parse(item.target_roles || '[]') : []);
    } catch (e) {
      console.warn('Failed to parse target_roles for item', item.id, e);
      rawRoles = [];
    }
    
    let displayAuthor = reverseRoleMap[item.author_role] || item.author_role || 'Super Admin';
    // Normalisasi label author agar lebih konsisten (Operator -> Super Admin)
    if (displayAuthor.toLowerCase().includes('operator')) displayAuthor = 'Super Admin';

    return {
      ...item,
      display_roles: rawRoles.map(r => reverseRoleMap[r] || r).join(', '),
      display_author_role: displayAuthor,
      images: item.images || (item.image_path ? [`${BASE_URL}/storage/${item.image_path}`] : []),
      attachment: item.attachment || (item.attachment_path ? { 
        name: item.attachment_name || 'Lampiran', 
        url: `${BASE_URL}/storage/${item.attachment_path}` 
      } : null)
    };
  };

  const fetchData = async (silent = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    // Skeleton hanya untuk pemuatan pertama; refresh manual cukup memutar ikon.
    if (!silent) setLoading(true);
    
    try {
      const role = resolveAccessRole(user);
      const isHonorerMagang = user.position_status === 'honorer' || user.position_status === 'magang' || role === 'honorer' || role === 'magang' || role === 'magang_honor';
      const isAdminUser = ['operator', 'admin_akademik', 'guru', 'cashier', 'kepala_sekolah', 'wakil_sekolah', 'pusat_jurusan'].includes(role) && !isHonorerMagang;
      
      const promises = [informationCenterAPI.getAll().catch(err => {
        console.error('Failed to fetch information feed', err);
        return { error: true, data: { success: false } };
      })];

      if (isAdminUser) {
        promises.push(informationCenterAPI.getManageInfos().catch(err => {
          console.error('Failed to fetch manage information', err);
          return { error: true, data: { success: false } };
        }));
      }

      const [feedRes, manageRes] = await Promise.all(promises);

      let nextInfos = null;
      let nextManageData = null;

      if (feedRes.data?.success) {
        nextInfos = feedRes.data.data.map(item => mapItemRoles(item));
        setInfos(nextInfos);
      }

      if (isAdminUser && manageRes?.data?.success) {
        const rawData = manageRes.data.data;
        nextManageData = rawData;
        setAllManageData(rawData);
        setDrafts(rawData.filter(i => i.status === 'draft'));
      }

      const previousSnapshot = getQueryData(infoCacheKey);
      setQueryData(infoCacheKey, {
        infos: nextInfos ?? previousSnapshot?.infos ?? [],
        allManageData: nextManageData ?? previousSnapshot?.allManageData ?? [],
        drafts: nextManageData
          ? nextManageData.filter(i => i.status === 'draft')
          : (previousSnapshot?.drafts ?? []),
      });
      
      if (!silent) toast.success('Informasi berhasil diperbarui!');
    } catch (error) {
      console.error('Failed to fetch information center data', error);
      if (!silent) toast.error('Gagal memperbarui data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTargets = async () => {
    try {
      const res = await pesanUserAPI.searchUsers();
      if (res.data?.success) setAvailableUsers(res.data.data);
    } catch (err) {
      console.error('Failed to fetch searchable users', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTargets();
    }
  }, [user]);

  // Refresh recipients while composing so class and teaching assignments changed
  // from another LAN client are reflected without reloading the dashboard.
  useEffect(() => {
    if (!isWritingPesan) return undefined;
    fetchTargets();
    const timer = setInterval(fetchTargets, 10000);
    return () => clearInterval(timer);
  }, [isWritingPesan, user?.id]);


  useEffect(() => {
    if (propUser) {
      setUser(propUser);
    } else {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const parsedUser = JSON.parse(userStr);
        setUser(parsedUser);
      }
    }
  }, [propUser]);

  useEffect(() => {
    if (user) {
      const role = resolveAccessRole(user);
      const isHonorerMagang = user.position_status === 'honorer' || user.position_status === 'magang' || role === 'honorer' || role === 'magang' || role === 'magang_honor';
      setIsAdmin(['operator', 'admin_akademik', 'guru', 'cashier', 'kepala_sekolah', 'wakil_sekolah', 'pusat_jurusan'].includes(role) && !isHonorerMagang);

      // Cache masih segar: tampilkan langsung tanpa menyentuh server.
      const snapshot = getQueryData(infoCacheKey);
      if (snapshot?.infos && isQueryFresh(infoCacheKey, INFO_CACHE_TTL)) {
        setLoading(false);
        return;
      }

      fetchData(Boolean(snapshot?.infos));
    } else {
      // Jika setelah check session tetap tidak ada user, matikan loading
      const timer = setTimeout(() => {
        if (!sessionStorage.getItem('user')) setLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    if (activeMainTab === 'pesan') {
      fetchPesan();
    }
  }, [activeMainTab]);

  const fetchPesan = async (silent = false) => {
    if (!silent) setPesanLoading(true);
    try {
      const res = await pesanUserAPI.getConversations();
      if (res.data?.success) {
        setConversations(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
      if (!silent) toast.error('Gagal memuat pesan');
    } finally {
      if (!silent) setPesanLoading(false);
    }
  };

  // Daftar percakapan ikut disegarkan berkala selama halaman Pesan Pribadi terbuka,
  // supaya pesan baru langsung tampil tanpa perlu pindah tab.
  useEffect(() => {
    if (activeMainTab !== 'pesan') return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        fetchPesan(true);
        refreshPesanUnread();
      }
    };
    const timer = setInterval(tick, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [activeMainTab]);

  const handleSendPesan = async (e) => {
    e.preventDefault();
    if (!pesanForm.penerima_id || !pesanForm.isi.trim()) {
      toast.error('Mohon pilih penerima dan isi pesan');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('penerima_id', pesanForm.penerima_id);
      formData.append('isi', pesanForm.isi);
      if (pesanForm.lampiran) {
        formData.append('lampiran', pesanForm.lampiran);
      }

      const res = await pesanUserAPI.send(formData);

      if (res.data?.success) {
        toast.success('Pesan terkirim!');
        setIsWritingPesan(false);
        setPesanForm({ penerima_id: '', isi: '', lampiran: null });
        setPesanSearchQuery('');
        fetchPesan();
      } else {
        toast.error(res.data?.message || 'Gagal mengirim pesan');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan sistem');
    }
  };

  // Jumlah pesan belum dibaca: sumber dot pada pil "Pesan Pribadi".
  const refreshPesanUnread = async () => {
    try {
      const res = await pesanUserAPI.getUnreadCount();
      setPesanUnreadCount(Number(res.data?.data?.count) || 0);
    } catch (err) {}
  };

  useEffect(() => {
    if (user) refreshPesanUnread();
  }, [user?.id]);

  // Dot pada kedua pil ikut disegarkan berkala — badge di menu sidebar sudah dihapus,
  // jadi penanda notifikasi sepenuhnya hidup di dalam pil.
  useEffect(() => {
    if (!user) return undefined;
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      refreshPesanUnread();
      fetchData(true);
    };
    const timer = setInterval(tick, 20000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user?.id]);

  // Balon pesan tidak boleh ikut terbawa ke tab lain.
  useEffect(() => {
    if (activeMainTab !== 'pesan' && chatBalloon.open) {
      setChatBalloon({ open: false, contact: null });
    }
  }, [activeMainTab, chatBalloon.open]);

  // Setelah balon memuat percakapan, pesan masuk dari lawan bicara sudah dibaca di server.
  const handleBalloonLoaded = () => {
    const contactId = chatBalloon.contact?.id;
    if (contactId) {
      setConversations(prev => prev.map(c => (
        Number(c.user_id) === Number(contactId) ? { ...c, unread_count: 0 } : c
      )));
    }
    refreshPesanUnread();
    window.dispatchEvent(new Event('pesan-unread:refresh'));
  };

  // Balasan dari balon chat: segarkan daftar pesan tanpa mengedipkan loading.
const handleBalloonReplied = () => {
    fetchPesan(true);
    refreshPesanUnread();
    window.dispatchEvent(new Event('pesan-unread:refresh'));
  };

  // Klik baris percakapan: buka balon chat berisi seluruh riwayat dengan user itu.
  const openChatBalloon = (thread) => {
    setChatBalloon({
      open: true,
      contact: {
        id: Number(thread.user_id),
        name: thread.name,
        role: thread.role,
        access_role: thread.access_role,
        position_status: thread.position_status,
        avatar_path: thread.avatar_path,
      },
    });
  };

  // Ikon hapus: "hapus untuk saya" — hanya menyembunyikan percakapan di sisi sendiri.
  const handleDeleteConversation = (thread) => {
    setConfirmModal({
      show: true,
      type: 'danger',
      title: 'Hapus percakapan ini?',
      message: `Percakapan dengan ${thread.name} akan dihapus dari daftar Anda saja. Lawan bicara tetap menyimpan riwayatnya, dan percakapan ini muncul kembali jika ada pesan baru.`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        try {
          await pesanUserAPI.deleteConversation(thread.user_id);
          setConversations(prev => prev.filter(c => Number(c.user_id) !== Number(thread.user_id)));
          setChatBalloon(prev => Number(prev.contact?.id) === Number(thread.user_id) ? { open: false, contact: null } : prev);
          window.dispatchEvent(new Event('pesan-unread:refresh'));
          refreshPesanUnread();
          toast.success('Percakapan dihapus.');
        } catch (err) {
          toast.error(err.response?.data?.message || 'Percakapan gagal dihapus.');
        }
      },
    });
  };

  // Lampiran (gambar/PDF) dibuka di layar pratinjau ber-blur, bukan href tab baru.
  const openAttachmentViewer = ({ url, name }) => {
    if (!url) return;
    const isPdf = /\.pdf($|\?)/i.test(url) || /pdf/i.test(name || '');
    setAttachmentViewer({ url, name: name || 'Lampiran', isPdf });
  };

  // Klik informasi: tandai sudah dibaca supaya dot "Informasi & Pengumuman" hilang.
  const handleOpenInfo = (info) => {
    setPreviewData(info);
    if (!info.is_read && info.author_id !== user?.id) {
      setInfos(prev => prev.map(item => item.id === info.id ? { ...item, is_read: true } : item));
      informationCenterAPI.markAsRead(info.id).then(() => {
        // Beri tahu sidebar dashboard (red dot Pusat Informasi) untuk menyegarkan hitungan.
        window.dispatchEvent(new Event('info-unread:refresh'));
      }).catch(() => {});
    }
  };


  const handleRoleToggle = (role) => {
    if (role === 'Semua Role') {
      if (form.target_roles.length === TARGET_ROLES.length) {
        setForm({ ...form, target_roles: [], is_private: false });
      } else {
        setForm({ ...form, target_roles: [...TARGET_ROLES], is_private: false });
      }
      return;
    }

    const currentRoles = form.target_roles || [];
    let newRoles;
    if (currentRoles.includes(role)) {
      newRoles = currentRoles.filter(r => r !== role);
    } else {
      newRoles = [...currentRoles, role];
    }
    setForm({ ...form, target_roles: newRoles, is_private: false });
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (form.images.length + files.length > 5) {
      toast.error('Maksimal 5 gambar diperbolehkan');
      return;
    }
    const validFiles = files.filter(file => {
      const isTypeValid = file.type === 'image/jpeg' || file.type === 'image/png';
      return file.size <= 2 * 1024 * 1024 && isTypeValid;
    });
    
    if (validFiles.length < files.length) {
      toast.error('Beberapa gambar ditolak (Hanya PNG/JPG, Maks 2MB)');
    }
    setForm({ ...form, images: [...form.images, ...validFiles] });
  };

  const handleAttachmentUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      const isValidExt = file.name.match(/\.(pdf|doc|docx|xls|xlsx)$/i);
      
      if (!validTypes.includes(file.type) && !isValidExt) {
        toast.error('Format lampiran harus PDF, DOCS, atau XLSX');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Lampiran maksimal 5MB');
        return;
      }
      setForm({ ...form, attachment: file });
    }
  };

  const removeImage = (index) => {
    const newImages = [...form.images];
    newImages.splice(index, 1);
    setForm({ ...form, images: newImages });
  };

  const handleSubmit = (status, manualData = null) => {
    const dataToValidate = manualData || form;
    
    // Validasi data yang lebih aman
    const title = dataToValidate?.title || '';
    const content = dataToValidate?.content || '';
    const isPrivate = dataToValidate?.is_private || false;
    const targetUserId = dataToValidate?.target_user_id;
    const roles = Array.isArray(dataToValidate?.target_roles) 
      ? dataToValidate.target_roles 
      : [];

    if (!title.trim() || !content.trim()) {
      toast.error('Judul dan Isi Informasi wajib diisi!');
      return;
    }
    
    if (!isPrivate && roles.length === 0) {
      toast.error('Pilih minimal satu target role untuk publik, atau gunakan mode private.');
      return;
    }
    
    if (isPrivate && !targetUserId) {
      toast.error('Pilih target user untuk mode private.');
      return;
    }

    if (status === 'published') {
      setConfirmModal({
        show: true,
        title: 'Publikasikan Informasi',
        message: 'Apakah Anda yakin ingin mempublikasikan informasi ini?',
        type: 'primary',
        onConfirm: () => executeSubmit(status, manualData)
      });
      return;
    }
    executeSubmit(status, manualData);
  };

  const executeSubmit = async (status, manualData = null) => {
    const dataToSubmit = manualData || form;
    setIsSubmitting(true);
    setConfirmModal(prev => ({ ...prev, show: false }));

    try {
      const formData = new FormData();
      formData.append('title', dataToSubmit.title || '');
      formData.append('category', dataToSubmit.category || 'Pengumuman');
      formData.append('content', dataToSubmit.content || '');
      formData.append('status', status);
      
      const roles = Array.isArray(dataToSubmit.target_roles) ? dataToSubmit.target_roles : [];
      roles.forEach(role => {
        formData.append('target_roles[]', role);
      });

      if (dataToSubmit.images && Array.isArray(dataToSubmit.images)) {
        dataToSubmit.images.forEach((img, i) => {
          if (img instanceof File) formData.append('images[]', img); // Gunakan images[] lebih standar
        });
      }

      if (dataToSubmit.attachment instanceof File) {
        formData.append('attachment', dataToSubmit.attachment);
      }

      const res = await (dataToSubmit.id 
        ? informationCenterAPI.updateInfo(dataToSubmit.id, formData)
        : informationCenterAPI.storeInfo(formData));

      if (res.data?.success) {
        toast.success(status === 'draft' ? 'Informasi disimpan sebagai draft' : 'Informasi berhasil dipublikasikan');
        
        const updatedItem = res.data.data;

        // 1. Update Master Data
        setAllManageData(prev => {
          const exists = prev.find(i => i.id === updatedItem.id);
          if (exists) {
            return prev.map(item => item.id === updatedItem.id ? updatedItem : item);
          }
          return [updatedItem, ...prev];
        });

        // 2. Update Feed Utama (Infos) secara direct
        if (updatedItem.status === 'published' && !showArchived) {
          setInfos(prev => {
            const exists = prev.find(i => i.id === updatedItem.id);
            if (exists) {
              return prev.map(item => item.id === updatedItem.id ? updatedItem : item);
            }
            return [updatedItem, ...prev];
          });
        } else if (updatedItem.status === 'archived' || (updatedItem.status === 'published' && showArchived)) {
            // Jika diarsipkan, hapus dari feed utama
            setInfos(prev => prev.filter(i => i.id !== updatedItem.id));
        }

        // 3. Update Drafts secara direct
        if (updatedItem.status === 'draft') {
          setDrafts(prev => {
            const exists = prev.find(i => i.id === updatedItem.id);
            if (exists) {
              return prev.map(item => item.id === updatedItem.id ? updatedItem : item);
            }
            return [updatedItem, ...prev];
          });
        } else {
          // Jika sudah dipublish, buang dari list draft
          setDrafts(prev => prev.filter(item => item.id !== updatedItem.id));
        }

        handleResetForm();
      } else {
        throw new Error(res.data?.message || 'Gagal menyimpan');
      }
    } catch (error) {
      console.error('Error submitting information', error);
      
      if (error.response?.status === 404) {
        toast.error('Informasi ini sudah tidak tersedia di server. Menyinkronkan data...');
        fetchData(); // Ambil data terbaru dari server
      } else {
        const msg = error.response?.data?.message || 'Gagal menyimpan informasi.';
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (info) => {
    // Mapping kebalikan: dari slug backend ke label frontend agar checkbox tercentang
    const reverseRoleMap = {
      'operator': 'Super Admin',
      'admin_akademik': 'Admin Akademik',
      'guru': 'Guru',
      'murid': 'Murid',
      'siswa': 'Murid',
      'kepala_sekolah': 'Kepala Sekolah',
      'wakil_sekolah': 'Wakil Kepala Sekolah',
      'pusat_jurusan': 'Pusat Jurusan',
      'cashier': 'Kasir',
      'magang': 'Magang',
      'honorer': 'Honorer',
      'magang_honor': 'Honorer/Magang',
      'semua': 'Semua Role'
    };

    const rawRoles = Array.isArray(info.target_roles) 
      ? info.target_roles 
      : JSON.parse(info.target_roles || '[]');
    
    const mappedRoles = rawRoles.map(r => reverseRoleMap[r] || r);

    setForm({
      id: info.id,
      title: info.title,
      category: info.category || 'Pengumuman',
      target_roles: mappedRoles,
      target_user_id: info.target_user_id || '',
      is_private: !!info.target_user_id,
      content: info.content,
      images: [], 
      attachment: info.attachment_path ? { name: 'Lampiran Tersimpan', path: info.attachment_path } : null
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setConfirmModal({
      show: true,
      title: 'Batalkan Perubahan',
      message: 'Apakah Anda yakin ingin membatalkan pengeditan dan mengosongkan formulir?',
      type: 'danger',
      onConfirm: () => {
        handleResetForm();
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Hapus Informasi',
      message: 'Apakah Anda yakin ingin menghapus informasi ini secara permanen? Tindakan ini tidak dapat dibatalkan.',
      type: 'danger',
      onConfirm: async () => {
        try {
          setConfirmModal({ ...confirmModal, show: false });
          
          // Optimistic update - langsung hapus dari semua state
          setAllManageData(prev => prev.filter(item => item.id !== id));
          setDrafts(prev => prev.filter(item => item.id !== id));
          setInfos(prev => prev.filter(item => item.id !== id));

          await informationCenterAPI.deleteInfo(id);
          toast.success('Informasi berhasil dihapus');
          fetchData(true); // Sinkronisasi latar belakang
        } catch (error) {
          console.error('Failed to delete information', error);
          toast.error('Gagal menghapus informasi');
          fetchData(); // Revert dengan reload penuh
        }
      }
    });
  };

  const handleArchive = async (id) => {
    try {
      // Optimistic update for both states
      setAllManageData(prev => {
        const exists = prev.find(item => item.id === id);
        if (exists) {
          return prev.map(item => item.id === id ? { ...item, status: String(item.status).toLowerCase() === 'archived' ? 'published' : 'archived' } : item);
        }
        
        // Jika tidak ada di manage data (mungkin baru dari feed), tambahkan secara manual
        const fromFeed = infos.find(item => item.id === id);
        if (fromFeed) {
          return [{ ...fromFeed, status: 'archived' }, ...prev];
        }
        return prev;
      });
      
      // Jika sedang mengarsipkan (bukan melihat arsip), hapus dari feed yang terlihat
      if (!showArchived) {
        setInfos(prev => prev.filter(item => item.id !== id));
      }
      
      await informationCenterAPI.archiveInfo(id);
      toast.success(showArchived ? 'Informasi dipulihkan' : 'Informasi diarsipkan');
      fetchData(true); // Sinkronisasi latar belakang
    } catch (error) {
      console.error('Failed to archive/restore information', error);
      toast.error('Gagal memproses arsip');
      fetchData(); // Revert dengan reload penuh
    }
  };

  // Gunakan allManageData khusus untuk Arsip, atau infos (public feed) untuk tampilan normal
  const baseInfos = showArchived 
    ? allManageData
        .filter(i => i.status === 'archived')
        .map(i => mapItemRoles(i))
    : infos;

  const filteredInfos = baseInfos
    .filter(info => filterCategory === 'Semua' || info.category === filterCategory)
    .filter(info => {
      // Jika lihat arsip, jangan filter role lagi agar admin bisa lihat semua yang diarsip
      if (showArchived || filterRole === 'Semua') return true;
      const roles = Array.isArray(info.target_roles) ? info.target_roles : JSON.parse(info.target_roles || '[]');
      return roles.includes(filterRole);
    })
    .filter(info => info.title?.toLowerCase().includes(searchQuery.toLowerCase()) || info.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const dateA = new Date(a.created_at || Date.now());
      const dateB = new Date(b.created_at || Date.now());
      return sortBy === 'Terbaru' ? dateB - dateA : dateA - dateB;
    });

  const modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };

  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link', 'script'
  ];

  // Selama salah satu pop up terbuka, halaman di belakangnya tidak boleh ikut ter-scroll.
  useBodyScrollLock(
    isWritingPesan || !!attachmentViewer || chatBalloon.open || !!previewData || confirmModal.show
  );

  return (
    <div className="w-full animate-fadeIn">
      {/* Custom Styles untuk ReactQuill agar memiliki garis hitam tegas di bawah toolbar */}
      <style>{`
        .custom-quill .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 2px solid black;
          border-radius: 12px 12px 0 0;
          background-color: #f8fafc;
          padding: 12px;
        }
        .custom-quill .ql-container.ql-snow {
          border: none;
          border-radius: 0 0 12px 12px;
          min-height: 300px;
          font-family: inherit;
        }
        .custom-quill .ql-editor {
          min-height: 300px;
          font-size: 0.875rem;
        }
      `}</style>
      
      {/* Header Pusat Informasi */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-400 rounded-3xl p-8 mb-8 shadow-2xl relative overflow-hidden text-white flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Pusat Informasi</h1>
            <p className="text-blue-100 font-medium text-sm mt-1 max-w-xl leading-relaxed">
              {isAdmin 
                ? "Kelola pengumuman, berita, dan informasi penting untuk seluruh civitas sekolah."
                : "Dapatkan pengumuman terbaru, berita kegiatan, dan informasi penting lainnya langsung dari sekolah."}
            </p>
          </div>
        </div>

        <button 
          onClick={() => fetchData()}
          disabled={loading}
          className="relative z-[20] flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white backdrop-blur-md border border-white/40 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white hover:text-blue-900 transition-all duration-300 hover:scale-105 active:scale-95 shadow-2xl group disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
          Perbaharui Informasi
        </button>
      </div>
      
      {/* Sub Tabs */}
      <div className="flex items-center gap-4 mb-6 overflow-x-auto custom-scrollbar pb-2 px-2">
        <button 
          onClick={() => setActiveMainTab('pengumuman')}
          className={`relative flex-shrink-0 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
            activeMainTab === 'pengumuman' 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
            : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-blue-600 border border-gray-200'
          }`}
        >
          Informasi & Pengumuman
          {infoUnreadCount > 0 && (
            <span
              className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse"
              aria-label="Ada informasi baru"
            />
          )}
        </button>
        <button 
          onClick={() => setActiveMainTab('pesan')}
          className={`relative flex-shrink-0 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
            activeMainTab === 'pesan' 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
            : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-blue-600 border border-gray-200'
          }`}
        >
          Pesan Pribadi
          {pesanUnreadCount > 0 && (
            <span
              className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse"
              aria-label="Ada pesan baru"
            />
          )}
        </button>
      </div>

      {activeMainTab === 'pengumuman' && (
      <div className="bg-white rounded-[2.5rem] p-8 lg:p-12 shadow-xl border border-gray-100 min-h-[800px] flex flex-col">
        {/* White Wrapper for Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        
        {/* KOLOM KIRI: FORM & DRAFT (Hanya untuk Admin) */}
        {isAdmin && (
          <div className="lg:col-span-4 space-y-6">
            <div key={formKey} className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-3xl p-6 shadow-sm relative">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-black/10">
                <div className="flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-blue-600" /> 
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                    {form.id ? 'Edit Informasi' : 'Buat Informasi Baru'}
                  </h3>
                </div>
                
                {form.id && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleResetForm();
                    }}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 rounded-full text-rose-500 transition-all shadow-sm active:scale-95"
                    title="Batalkan Edit"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Judul Informasi *</label>
                  <input 
                    type="text" 
                    value={form.title}
                    onChange={(e) => setForm({...form, title: e.target.value})}
                    maxLength={100}
                    placeholder="Masukkan judul (maks 100 karakter)"
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Kategori *</label>
                  <select 
                    value={form.category}
                    onChange={(e) => setForm({...form, category: e.target.value})}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  >
                    <option value="Pengumuman">Pengumuman</option>
                    <option value="Berita">Berita</option>
                    <option value="Peringatan">Peringatan</option>
                    <option value="Sosialisasi">Sosialisasi</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Target Penerima (Role) *</label>
                  <div className="flex flex-col bg-white p-4 rounded-xl border border-gray-300 max-h-60 overflow-y-auto custom-scrollbar">
                    <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 rounded-lg transition-colors group">
                      <input 
                        type="checkbox" 
                        checked={form.target_roles.length === TARGET_ROLES.length}
                        onChange={() => handleRoleToggle('Semua Role')}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-black text-gray-800 whitespace-nowrap">Semua Role</span>
                    </label>
                    {TARGET_ROLES.map(role => (
                      <label key={role} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 rounded-lg transition-colors group">
                        <input 
                          type="checkbox" 
                          checked={form.target_roles.includes(role)}
                          onChange={() => handleRoleToggle(role)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Isi Informasi *</label>
                  <div className="w-full bg-white border border-gray-300 rounded-xl transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 overflow-hidden">
                    <ReactQuill 
                      theme="snow"
                      value={form.content}
                      onChange={(content) => setForm({...form, content})}
                      modules={modules}
                      formats={formats}
                      placeholder="Tulis detail informasi di sini..."
                      className="custom-quill"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Gambar (Max 5)</label>
                    <input type="file" multiple accept="image/png, image/jpeg" className="hidden" ref={imageInputRef} onChange={handleImageUpload} />
                    <button 
                      onClick={() => imageInputRef.current.click()}
                      className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <ImageIcon className="w-4 h-4" /> Upload
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">Lampiran</label>
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" ref={attachmentInputRef} onChange={handleAttachmentUpload} />
                    <button 
                      onClick={() => attachmentInputRef.current.click()}
                      className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Paperclip className="w-4 h-4" /> Upload
                    </button>
                  </div>
                </div>

                {/* Previews */}
                {(form.images.length > 0 || form.attachment) && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    {form.images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {form.images.map((img, i) => (
                          <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-300 bg-white">
                            {img instanceof File ? (
                              <img src={URL.createObjectURL(img)} alt={`Upload ${i}`} className="w-full h-full object-cover" />
                            ) : (
                              <img src={img.url || img} alt={`Gambar ${i}`} className="w-full h-full object-cover" />
                            )}
                            <button onClick={() => removeImage(i)} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {form.attachment && (
                      <div className="flex items-center justify-between bg-white p-2 border border-gray-300 rounded-lg">
                        <span className="text-xs truncate font-medium text-gray-600 max-w-[80%]">
                          {form.attachment instanceof File ? form.attachment.name : (form.attachment.name || 'Lampiran Tersimpan')}
                        </span>
                        <button onClick={() => setForm({...form, attachment: null})} className="text-red-500 hover:text-red-700">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button 
                    onClick={() => handleSubmit('draft')}
                    disabled={isSubmitting}
                    className="flex-1 bg-[#6B7280] hover:bg-gray-600 text-white rounded-xl py-3 text-sm font-bold shadow-md transition-colors disabled:opacity-50"
                  >
                    Simpan ke Draft
                  </button>
                  <button 
                    onClick={() => handleSubmit('published')}
                    disabled={isSubmitting}
                    className="flex-1 bg-[#10B981] hover:bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold shadow-md transition-colors disabled:opacity-50"
                  >
                    Publikasikan
                  </button>
                </div>

              </div>
            </div>

            {/* AREA DRAFT (Selalu Muncul untuk Admin) */}
            <div className="bg-gray-50/50 border border-gray-200 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-black text-gray-900 mb-6 pb-4 border-b border-black/10 flex items-center gap-2 uppercase tracking-tight">
                <Sparkles className="w-5 h-5 text-amber-500" /> Draft Informasi
              </h3>
              
              {drafts.length === 0 ? (
                <div className="py-10 text-center">
                   <p className="text-xs font-black text-gray-300 uppercase tracking-widest">Draft belum ada</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {drafts.map(draft => (
                    <div key={draft.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:border-blue-200 transition-all group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2.5 truncate">
                          {(() => {
                            const Icon = CATEGORY_ICONS[draft.category] || Info;
                            return <Icon className="w-4 h-4 text-gray-400" />;
                          })()}
                          <h4 className="font-black text-[13px] text-gray-800 truncate">{draft.title}</h4>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mb-4 flex items-center gap-1.5">
                        <Target className="w-3 h-3" />
                        Target: <span className="text-gray-600">{Array.isArray(draft.target_roles) ? draft.target_roles.join(', ') : JSON.parse(draft.target_roles || '[]').join(', ')}</span>
                      </p>
                      <div className="flex gap-2 border-t border-gray-50 pt-4">
                        <button 
                          onClick={() => handleEdit(draft)} 
                          className="flex-1 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition-all"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleSubmit('published', draft)} 
                          className="flex-1 bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-emerald-600 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition-all"
                        >
                          Publish
                        </button>
                        <button 
                          onClick={() => handleDelete(draft.id)} 
                          className="flex-1 bg-gray-50 hover:bg-rose-50 text-gray-600 hover:text-rose-600 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition-all"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className="lg:col-span-4 space-y-6">
            {isMurid && (
              <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                 <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                 <Sparkles className="w-10 h-10 text-blue-200 mb-6" />
                 <h3 className="text-xl font-black mb-1 text-white uppercase tracking-tighter">
                   Motivasi Untuk Anda :
                 </h3>
                 <div className="min-h-[180px] flex items-start pt-2">
                   <AnimatePresence mode="wait">
                      <motion.p 
                        key={quoteIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.8, ease: "circOut" }}
                        className="text-blue-50 text-[15px] font-bold leading-relaxed italic"
                      >
                        "{MOTIVATION_QUOTES[quoteIndex]}"
                      </motion.p>
                   </AnimatePresence>
                 </div>
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" /> Navigasi Cepat
              </h4>
              <div className="space-y-3">
                {['Pengumuman', 'Berita', 'Peringatan'].map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-blue-50 hover:text-blue-600 transition-all group"
                  >
                    <span className="text-sm font-bold text-gray-600 group-hover:text-blue-600">{cat}</span>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KOLOM KANAN: PREVIEW PUBLIKASI */}
        <div className="lg:col-span-8">
          {/* Fitur Tambahan: Filter & Search */}
          {/* Filter Toolbar - Linear Redesign */}
          {/* Filter Toolbar - Full Width Capsule Design */}
          <div className="flex items-center mb-10 w-full">
            <div className="flex items-center justify-between p-1.5 bg-gray-50/50 border border-gray-200 rounded-full w-full">
              <div className="flex items-center gap-2">
                {/* Category Select */}
                <div className="relative">
                  <select 
                    value={filterCategory} 
                    onChange={(e) => setFilterCategory(e.target.value)} 
                    className="w-[135px] bg-white border-2 border-gray-200 focus:border-blue-500 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-wider text-gray-700 outline-none cursor-pointer hover:bg-gray-50 focus:ring-4 focus:ring-blue-50 transition-all appearance-none"
                  >
                    <option value="Semua">Kategori</option>
                    <option value="Pengumuman">Pengumuman</option>
                    <option value="Berita">Berita</option>
                    <option value="Peringatan">Peringatan</option>
                    <option value="Sosialisasi">Sosialisasi</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                  <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                </div>

                {/* Target Select */}
                <div className="relative">
                  <select 
                    value={filterRole} 
                    onChange={(e) => setFilterRole(e.target.value)} 
                    className="w-[185px] bg-white border-2 border-gray-200 focus:border-blue-500 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-wider text-gray-700 outline-none cursor-pointer hover:bg-gray-50 focus:ring-4 focus:ring-blue-50 transition-all appearance-none"
                  >
                    <option value="Semua">Target</option>
                    {TARGET_ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <Target className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                </div>

                {/* Sort Toggle - Icon Only */}
                <button 
                  onClick={() => setSortBy(prev => prev === 'Terbaru' ? 'Terlama' : 'Terbaru')}
                  className="flex items-center justify-center p-2 hover:bg-gray-100/50 rounded-lg transition-all active:scale-90"
                  title={sortBy === 'Terbaru' ? "Urutkan Terlama" : "Urutkan Terbaru"}
                >
                  {sortBy === 'Terbaru' ? <MoveUpRight className="w-5 h-5 text-blue-600 stroke-[2.5]" /> : <MoveDownLeft className="w-5 h-5 text-emerald-600 stroke-[2.5]" />}
                </button>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-[400px] ml-2">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="text"
                    placeholder="Cari sesuatu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-full text-[11px] font-bold text-gray-800 placeholder:text-gray-400 outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                  />
                </div>

                {isAdmin && (
                  <button 
                    onClick={() => setShowArchived(!showArchived)}
                    className={`h-9 flex items-center gap-2 px-6 rounded-full font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap ${
                      showArchived 
                      ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                      : 'bg-slate-900 text-white hover:bg-black'
                    }`}
                  >
                    <Archive className="w-3 h-3" />
                    {showArchived ? 'Kembali' : 'Lihat Arsip'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Daftar Informasi */}
          {loading && infos.length === 0 ? (
            <div className="space-y-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-[#FFFFFF] rounded-[1.5rem] p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-24 h-6 bg-gray-200 rounded-full animate-pulse" />
                    <div className="w-32 h-4 bg-gray-200 rounded-full animate-pulse" />
                  </div>
                  <div className="w-3/4 h-6 bg-gray-200 rounded-lg animate-pulse mb-3" />
                  <div className="w-full h-4 bg-gray-200 rounded-lg animate-pulse mb-6" />
                  <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                    <div className="w-24 h-10 bg-gray-200 rounded-lg animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredInfos.length > 0 ? (
            <>
              <div className="space-y-6">
                {filteredInfos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(info => (
                  <div key={info.id} className="bg-[#FFFFFF] rounded-[1.5rem] p-6 shadow-sm hover:shadow-md border border-gray-100 transition-all relative group">
                    
                    {/* Tombol Admin: Hanya untuk Pembuat Informasi atau Super Admin */}
                    {(user?.access_role === 'operator' || (isAdmin && info.author_id === user?.id)) && (
                      <div className="absolute top-4 right-4 flex gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(info)} 
                          className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-md" 
                          title="Edit Informasi"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        
                        <button 
                          onClick={() => handleArchive(info.id)} 
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${
                            info.status === 'archived' 
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' 
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-600 hover:text-white'
                          }`} 
                          title={info.status === 'archived' ? "Pulihkan Informasi" : "Arsipkan Informasi"}
                        >
                          {info.status === 'archived' ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
  
                        <button 
                          onClick={() => handleDelete(info.id)} 
                          className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-md" 
                          title="Hapus Informasi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
  
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-widest ${CATEGORY_COLORS[info.category] || CATEGORY_COLORS['Lainnya']}`}>
                        {info.category}
                      </span>
                    </div>
                    
                    <h2 className="text-xl font-black text-gray-900 mb-2">{info.title}</h2>
                    <div 
                      className="text-sm text-gray-600 leading-relaxed mb-4 prose prose-sm max-w-none prose-a:text-blue-600"
                      dangerouslySetInnerHTML={{ __html: info.content }}
                    />
                    
                    <div className="flex flex-wrap items-end justify-between gap-4 mt-6 pt-4 border-t border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Metadata Informasi</span>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                          {(() => {
                            const d = new Date(info.created_at || Date.now());
                            const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', ':') + ' WIB';
                            const roleLabel = info.target_user_id 
                              ? `Pesan Private: ${info.target_user_name || 'User'}` 
                              : (info.author_id === user?.id ? `Target: ${info.display_roles || 'Semua'}` : (info.display_author_role || 'Sistem'));
                            return `${dateStr} . ${timeStr} . ${roleLabel}`;
                          })()}
                        </span>
                      </div>
  
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleOpenInfo(info)}
                          className="flex items-center justify-center w-9 h-9 bg-gray-900 text-white rounded-xl hover:bg-blue-600 transition-all shadow-sm group"
                          title="Preview Informasi"
                        >
                          <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </button>

                        {info.images && info.images.length > 0 && (
                          <button 
                            onClick={() => handleOpenInfo(info)}
                            className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm" 
                            title="Terdapat Lampiran Gambar (Klik untuk Preview)"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                        )}
                        
                        {info.attachment && (
                          <button
                            onClick={() => openAttachmentViewer({ url: info.attachment?.url || info.attachment_url, name: info.attachment?.name || info.attachment_name })}
                            className="flex items-center justify-center w-9 h-9 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            title="Lihat Lampiran"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Simple Premium Pagination << | >> */}
              {filteredInfos.length > itemsPerPage && (
                <div className="flex items-center justify-center mt-12 gap-8 border-t border-gray-100 pt-8">
                  <button 
                    onClick={() => {
                      setCurrentPage(prev => Math.max(1, prev - 1));
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    disabled={currentPage === 1}
                    className="p-2 text-blue-600 hover:text-blue-800 disabled:text-gray-200 transition-all active:scale-90 group"
                    title="Halaman Sebelumnya"
                  >
                    <ChevronsLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
                  </button>
                  
                  <div className="w-px h-8 bg-gray-100" />
                  
                  <button 
                    onClick={() => {
                      setCurrentPage(prev => prev + 1);
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    disabled={currentPage * itemsPerPage >= filteredInfos.length}
                    className="p-2 text-blue-600 hover:text-blue-800 disabled:text-gray-200 transition-all active:scale-90 group"
                  >
                    <ChevronsRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center">
              <Info className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-black text-gray-900 mb-2">Belum ada informasi</h3>
              <p className="text-gray-500 font-medium">Saat ini belum ada pengumuman yang ditujukan untuk Anda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
    )}
    {activeMainTab === 'pesan' && (
      <div className="bg-white rounded-[2.5rem] p-8 lg:p-12 shadow-xl border border-gray-100 min-h-[600px] flex flex-col">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 border-b border-gray-100 pb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Pesan Pribadi</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            {/* Minimalist Compose Icon with Blue Hover & Jumping Text */}
            <div className="flex flex-col items-center group relative cursor-pointer" onClick={() => setIsWritingPesan(true)}>
              <motion.button 
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                className={`flex items-center justify-center transition-all duration-300 ${isWritingPesan ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'}`}
              >
                <div className="relative">
                  <Inbox className="w-8 h-8" />
                  <Pencil className={`w-4 h-4 absolute -top-1 -right-1 bg-white p-0.5 rounded-full shadow-sm transition-colors ${isWritingPesan ? 'text-blue-700' : 'group-hover:text-blue-700'}`} />
                </div>
              </motion.button>
              
              <div className="mt-2 flex justify-center">
                <motion.span 
                  animate={{ 
                    y: [0, -4, 0],
                  }}
                  transition={{ 
                    duration: 0.6, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className={`text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${isWritingPesan ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'}`}
                >
                  Tulis Pesan
                </motion.span>
              </div>
            </div>
          </div>
        </div>

        {isWritingPesan && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWritingPesan(false)}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            />
            {/* Kartu pop up: header & footer tetap, hanya area isi yang bisa di-scroll.
                overflow-hidden mencegah scrollbar menonjol keluar sudut kartu. */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_60px_-15px_rgba(15,23,42,0.18)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-indigo-500/20 bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-500 px-7 pb-5 pt-7 sm:px-9">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white shadow-md ring-4 ring-white/20 backdrop-blur-sm">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight">Tulis Pesan Baru</h3>
                  <p className="mt-0.5 text-xs font-medium text-indigo-100">Pilih role penerima, lalu tulis pesan Anda.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWritingPesan(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/20 text-white transition hover:border-rose-500 hover:bg-rose-500 hover:text-white active:bg-rose-600 active:scale-95"
                title="Batalkan"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSendPesan} className="flex min-h-0 flex-1 flex-col">
              {/* Area isi yang bisa di-scroll: scrollbar bawaan disembunyikan agar
                  tidak ada batang yang menonjol keluar sudut kartu. */}
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-6 sm:p-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Row 1: Role & User Selection (Sejajar) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2 ml-1">1. Pilih Role <span className="text-rose-500">*</span></label>
                  <ScrollableSelect
                    value={pesanRole}
                    onChange={(role) => {
                      setPesanRole(role);
                      setPesanForm(prev => ({ ...prev, penerima_id: '' })); // Reset penerima jika role berubah
                      setPesanSearchQuery('');
                    }}
                    options={pesanRoleOptions}
                    placeholder="-- Pilih Role --"
                  />
                </div>

                <div className="relative">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2 ml-1">2. Cari Nama User <span className="text-rose-500">*</span></label>
                  <div className={`relative transition-all ${!pesanRole ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="relative group">
                      <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${pesanForm.penerima_id ? 'text-blue-500' : 'text-gray-300'}`} />
                      <input 
                        type="text"
                        placeholder={pesanRole ? `Cari nama ${pesanRole}...` : "Pilih role dulu..."}
                        value={pesanSearchQuery}
                        onChange={(e) => setPesanSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-12 py-3.5 text-[13px] font-bold text-gray-700 placeholder:font-semibold placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                      />
                    </div>

                    {/* Search Results Dropdown */}
                    {pesanSearchQuery && !pesanForm.penerima_id && (() => {
                      const targetSlug = ROLE_SLUG_MAP[pesanRole];
                      const filteredResults = availableUsers.filter(u => {
                        const userRole = (u.role || '').toLowerCase();
                        const userStatus = (u.position_status || '').toLowerCase();
                        
                        // Jika user adalah honorer atau magang (berdasarkan status kolom ke-3), 
                        // maka dia HANYA boleh muncul di kategori Honorer/Magang, bukan di kategori role kerjanya (Guru, dsb).
                        // Fallback: cek juga jika role slug-nya adalah magang_honor
                        const isSpecialStatus = userStatus === 'honorer' || userStatus === 'magang' || userRole === 'magang_honor';
                        
                        let matchesRole = false;
                        if (!pesanRole) {
                          matchesRole = true;
                        } else if (isSpecialStatus) {
                          // Jika user honorer/magang, dia hanya match jika target selection sesuai statusnya
                          // Gunakan userStatus jika ada, jika tidak fallback ke 'honorer' (karena magang_honor default ke honorer)
                          const effectiveStatus = userStatus || (userRole === 'magang_honor' ? 'honorer' : '');
                          matchesRole = effectiveStatus === targetSlug;
                        } else {
                          // Jika user tetap (bukan honorer/magang), dia match berdasarkan role kerjanya
                          matchesRole = userRole === targetSlug;
                        }
                        const matchesSearch = u.name.toLowerCase().includes(pesanSearchQuery.toLowerCase());
                        return matchesRole && matchesSearch;
                      });

                      return (
                        <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
                          {filteredResults.length > 0 ? (
                            filteredResults.map(u => (
                              <div 
                                key={u.id}
                                onClick={() => {
                                  setPesanForm({...pesanForm, penerima_id: u.id});
                                  setPesanSearchQuery(u.name);
                                }}
                                className="px-6 py-4 hover:bg-blue-50 cursor-pointer flex items-center justify-between group"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-700 group-hover:text-blue-700">{u.name}</span>
                                  <span className="text-[10px] font-black uppercase text-gray-300">
                                    {u.role === 'magang_honor' ? 'Honorer/Magang' : (Object.keys(ROLE_SLUG_MAP).find(key => ROLE_SLUG_MAP[key] === u.role) || u.role)}
                                  </span>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-gray-200 group-hover:text-blue-400" />
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center text-gray-400 text-xs font-bold uppercase italic">User tidak ditemukan</div>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Clear Selection */}
                    {pesanForm.penerima_id && (
                      <button 
                        type="button"
                        onClick={() => {
                          setPesanForm({...pesanForm, penerima_id: ''});
                          setPesanSearchQuery('');
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Content */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2 ml-1">3. Isi Pesan <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <textarea 
                    rows="6"
                    value={pesanForm.isi}
                    onChange={(e) => setPesanForm({...pesanForm, isi: e.target.value})}
                    placeholder="Ketikkan isi pesan Anda secara lengkap di sini..."
                    className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/60 px-5 py-4 text-sm font-medium leading-relaxed text-gray-700 placeholder:font-normal placeholder:text-slate-400 outline-none transition-all hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 resize-none"
                  />
                  
                  {/* Floating Upload Button */}
                  <div className="absolute right-4 bottom-4 flex items-center gap-2">
                    <input 
                      type="file" 
                      ref={pesanAttachmentRef}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
                          if (!validTypes.includes(file.type)) {
                            toast.error('Hanya file PDF dan JPG yang diperbolehkan');
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error('Maksimal ukuran file adalah 5MB');
                            return;
                          }
                          setPesanForm({ ...pesanForm, lampiran: file });
                        }
                      }}
                      className="hidden" 
                      accept=".pdf,.jpg,.jpeg"
                    />
                    
                    {pesanForm.lampiran && (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }} 
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 flex items-center gap-2 max-w-[150px]"
                      >
                        <span className="text-[10px] font-bold text-blue-600 truncate">{pesanForm.lampiran.name}</span>
                        <button 
                          type="button"
                          onClick={() => setPesanForm({ ...pesanForm, lampiran: null })}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    )}

                    <button 
                      type="button"
                      onClick={() => pesanAttachmentRef.current.click()}
                      className={`p-2 rounded-xl transition-all hover:bg-slate-100 ${pesanForm.lampiran ? 'text-indigo-600 scale-110' : 'text-slate-400 hover:text-indigo-600 active:scale-95'}`}
                      title="Unggah Lampiran (PDF/JPG, Max 5MB)"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              </div>

              {/* Action Buttons: hanya Kirim, tanpa pratinjau */}
              <div className="flex shrink-0 items-center justify-end border-t border-slate-200 bg-slate-200/70 px-6 py-4 sm:px-7">
                <button 
                  type="submit"
                  className="w-full sm:w-auto flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-7 py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-indigo-600/20 transition-all hover:from-indigo-700 hover:to-blue-700 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Kirim
                </button>
              </div>
            </form>
            </motion.div>
          </div>
        )}

        <div className="flex-1">
            {pesanLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {conversations.length > 0 ? (
                  conversations.map(thread => {
                    const isUnread = Number(thread.unread_count) > 0;
                    return (
                      <motion.div
                        key={thread.user_id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => openChatBalloon(thread)}
                        className={`group cursor-pointer rounded-2xl border bg-white p-5 sm:p-6 transition-all hover:-translate-y-0.5 hover:shadow-md ${isUnread ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200/80 hover:border-indigo-200'}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-[13px] font-black text-blue-700">
                            {thread.avatar_path ? (
                              <img src={`${BASE_URL}/storage/${thread.avatar_path}`} alt={thread.name || 'Foto profil'} className="h-full w-full object-cover" />
                            ) : (
                              initialsOf(thread.name)
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="truncate text-[14px] font-black text-gray-900">{thread.name || 'Pengguna'}</p>
                              <span className="shrink-0 text-[10.5px] font-bold text-gray-400">
                                {thread.last_at ? new Date(String(thread.last_at).replace(' ', 'T')).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{getAccessRoleLabel(thread)}</p>
                            <div className="mt-1.5 flex items-center justify-between gap-3">
                              <p className={`min-w-0 truncate text-[13px] ${isUnread ? 'font-black text-gray-900' : 'font-medium text-gray-500'}`}>
                                {thread.last_from_me && <span className="font-bold text-gray-400">Anda: </span>}
                                {thread.last_attachment_name && <Paperclip className="mr-1 inline h-3 w-3 text-gray-400" />}
                                {thread.last_message || thread.last_attachment_name || 'Lampiran'}
                              </p>
                              <div className="flex shrink-0 items-center gap-2">
                                {isUnread && (
                                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">
                                    {thread.unread_count}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteConversation(thread); }}
                                  className="rounded-xl border border-rose-100 bg-rose-50 p-2 text-rose-500 transition-all hover:bg-rose-100"
                                  title="Hapus percakapan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="py-20 text-center">
                    <Inbox className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-gray-900">Belum ada percakapan</h3>
                    <p className="text-gray-500 font-medium">Mulai percakapan baru lewat tombol Tulis Pesan.</p>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    )}

    {/* Custom Confirmation Modal */}
    <AnimatePresence>
      {confirmModal.show && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmModal({ ...confirmModal, show: false })}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
          >
            <div className={`absolute top-0 left-0 w-full h-2 ${confirmModal.type === 'danger' ? 'bg-rose-500' : 'bg-blue-500'}`} />
            
            <div className="flex flex-col items-center text-center">
              <div className={`p-4 rounded-2xl mb-6 ${confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                {confirmModal.type === 'danger' ? <Trash2 className="w-8 h-8" /> : <Megaphone className="w-8 h-8" />}
              </div>
              
              <h3 className="text-2xl font-black text-gray-900 mb-3">{confirmModal.title}</h3>
              <p className="text-gray-500 font-medium leading-relaxed mb-8">
                {confirmModal.message}
              </p>
              
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                  className="flex-1 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black uppercase tracking-widest text-xs rounded-2xl transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 px-6 py-4 font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-lg ${
                    confirmModal.type === 'danger' 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                  }`}
                >
                  Yakin
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Modal Preview Detail */}
    <AnimatePresence>
      {previewData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewData(null)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex items-center justify-between mb-8">
                <span className={`px-4 py-1.5 rounded-full text-xs font-black text-white uppercase tracking-widest ${CATEGORY_COLORS[previewData.category] || CATEGORY_COLORS['Lainnya']}`}>
                  {previewData.category}
                </span>
                <button onClick={() => setPreviewData(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <h2 className="text-4xl font-black text-gray-900 mb-6 leading-tight">{previewData.title}</h2>
              
              <div className="prose prose-blue max-w-none mb-10 text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: previewData.content }} />

              {previewData.images && previewData.images.length > 0 && (
                <div className="mb-10">
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" /> Galeri Foto
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {previewData.images.map((img, i) => {
                      const src = img.url || img;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => openAttachmentViewer({ url: src, name: `Foto ${i + 1}` })}
                          className="aspect-square rounded-2xl overflow-hidden border border-gray-100 shadow-sm group"
                          title="Lihat foto"
                        >
                          <img src={src} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {previewData.attachment && (
                <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                      <Paperclip className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">File Lampiran</p>
                      <p className="text-sm font-bold text-blue-900">{previewData.attachment_name || 'Lampiran Informasi'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => openAttachmentViewer({ url: previewData.attachment?.url || previewData.attachment_url, name: previewData.attachment_name })}
                    className="px-6 py-3 bg-white text-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                  >
                    Lihat File
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                {(() => {
                  const d = new Date(previewData.created_at);
                  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', ':') + ' WIB';
                  return `${d.toLocaleDateString('id-ID')} . ${timeStr} . ${previewData.display_author_role}`;
                })()}
              </span>
              <div className="flex gap-4">
                <button onClick={() => setPreviewData(null)} className="px-8 py-3 bg-gray-100 text-gray-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all">
                  Tutup
                </button>
                {(user?.access_role === 'operator' || (isAdmin && previewData.author_id === user?.id)) && (
                  <button 
                    onClick={() => {
                      handleDelete(previewData.id);
                      setPreviewData(null);
                    }} 
                    className="px-8 py-3 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Balon pesan: hanya aktif di halaman Pesan Pribadi, dibuka lewat klik baris percakapan. */}
    <PesanChatBalloon
      open={activeMainTab === 'pesan' && chatBalloon.open}
      contact={chatBalloon.contact}
      onClose={() => setChatBalloon({ open: false, contact: null })}
      onOpenAttachment={openAttachmentViewer}
      onLoaded={handleBalloonLoaded}
      onReplied={handleBalloonReplied}
    />

    {/* Pratinjau lampiran (gambar/PDF): latar konten dibuat blur, bukan href tab baru. */}
    <AnimatePresence>
      {attachmentViewer && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAttachmentViewer(null)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  {attachmentViewer.isPdf ? <Paperclip className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Pratinjau Lampiran</p>
                  <p className="truncate text-sm font-black text-gray-900">{attachmentViewer.name}</p>
                </div>
              </div>
              <button
                onClick={() => setAttachmentViewer(null)}
                className="rounded-xl p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
                title="Tutup pratinjau"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto bg-gray-50 p-4 sm:p-6 custom-scrollbar">
              {attachmentViewer.isPdf ? (
                <iframe
                  src={attachmentViewer.url}
                  title={attachmentViewer.name}
                  className="h-[68vh] w-full rounded-2xl border border-gray-200 bg-white"
                />
              ) : (
                <img
                  src={attachmentViewer.url}
                  alt={attachmentViewer.name}
                  className="mx-auto max-h-[68vh] w-auto rounded-2xl border border-gray-200 bg-white object-contain"
                />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </div>
);
};

export default InformationCenterTab;
