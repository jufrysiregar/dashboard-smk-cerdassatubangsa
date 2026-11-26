import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Filter, 
  FileText, 
  Video, 
  Image as ImageIcon, 
  Download, 
  Eye, 
  Edit3, 
  Trash2, 
  X, 
  Upload, 
  File, 
  AlertCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BookOpen,
  GraduationCap,
  Clock
} from 'lucide-react';
import { teacherAPI } from '../../../../utils/api';
import GlassCard from '../../../../components/dashboard/shared/GlassCard';
import { toast } from 'react-hot-toast';

const MateriAjarTab = ({ clock, quickAction, onQuickActionConsumed, showHero = true }) => {
  const [materials, setMaterials] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0
  });

  const [filter, setFilter] = useState({
    kelas_id: '',
    mapel_id: '',
    judul: '',
    page: 1
  });
  const [titleOptions, setTitleOptions] = useState([]);

  const [options, setOptions] = useState({
    classes: [],
    subjects: []
  });

  const [loading, setLoading] = useState(false);
  const [modalMode, setModalMode] = useState(null); // 'upload', 'edit', 'detail', 'delete'
  const [selectedMateri, setSelectedMateri] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    judul: '',
    kategori: 'Modul Utama',
    kelas_id: '',
    mapel_id: '',
    topik: '',
    deskripsi: '',
    link_video: '',
    notify_students: false
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const descriptionEditorRef = useRef(null);
  const descriptionValueRef = useRef('');
  const getClassSubjects = (classId) => options.classes.find((item) => String(item.id) === String(classId))?.subjects || [];

  useEffect(() => {
    if ((modalMode === 'upload' || modalMode === 'edit') && descriptionEditorRef.current) {
      descriptionEditorRef.current.innerHTML = descriptionValueRef.current || formData.deskripsi || '';
    }
  }, [modalMode, selectedMateri]);

  useEffect(() => {
    if (!modalMode) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const handleEscape = (event) => {
      if (event.key === 'Escape') closeModal();
    };
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [modalMode]);

  useEffect(() => {
    fetchOptions();
    fetchMaterials();
  }, [filter.page]);

  useEffect(() => {
    let cancelled = false;
    setTitleOptions([]);
    if (!filter.kelas_id || !filter.mapel_id) return undefined;

    teacherAPI.getMaterials({ kelas_id: filter.kelas_id, mapel_id: filter.mapel_id, titles_only: true })
      .then((response) => {
        if (!cancelled) setTitleOptions(response.data.data || []);
      })
      .catch(() => {
        if (!cancelled) setTitleOptions([]);
      });

    return () => { cancelled = true; };
  }, [filter.kelas_id, filter.mapel_id]);

  useEffect(() => {
    if (quickAction === 'upload-material') {
      setModalMode('upload');
      onQuickActionConsumed?.();
    }
  }, [quickAction, onQuickActionConsumed]);

  const fetchOptions = async () => {
    try {
      const classRes = await teacherAPI.getClasses();
      const classes = classRes.data.data || [];
      const subjects = classes.flatMap((item) => item.subjects || []);
      setOptions({
        classes,
        subjects: [...new Map(subjects.map((subject) => [String(subject.id), subject])).values()],
      });
    } catch (error) {
      console.error('Failed to fetch options', error);
    }
  };

  const fetchMaterials = async (query = filter) => {
    setLoading(true);
    try {
      const response = await teacherAPI.getMaterials(query);
      setMaterials(response.data.data.data);
      setPagination({
        current_page: response.data.data.current_page,
        last_page: response.data.data.last_page,
        total: response.data.data.total
      });
    } catch (error) {
      toast.error('Gagal memuat materi');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    const nextFilter = { ...filter, page: 1 };
    setFilter(nextFilter);
    fetchMaterials(nextFilter);
  };

  const handleResetFilter = () => {
    setFilter({
      kelas_id: '',
      mapel_id: '',
      judul: '',
      page: 1
    });
    fetchMaterials({ kelas_id: '', mapel_id: '', judul: '', page: 1 });
  };

  const openModal = (mode, materi = null) => {
    setModalMode(mode);
    setSelectedMateri(materi);
    const initialDesc = materi?.deskripsi || '';
    descriptionValueRef.current = initialDesc;
    if (materi) {
      setFormData({
        judul: materi.judul,
        kategori: materi.kategori || 'Modul Utama',
        kelas_id: materi.kelas_id,
        mapel_id: materi.mapel_id,
        topik: materi.topik || '',
        deskripsi: initialDesc,
        link_video: materi.link_video || '',
        notify_students: false
      });
    } else {
      setFormData({
        judul: '',
        kategori: 'Modul Utama',
        kelas_id: '',
        mapel_id: '',
        topik: '',
        deskripsi: '',
        link_video: '',
        notify_students: false
      });
    }
    setSelectedFile(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedMateri(null);
    setSelectedFile(null);
    descriptionValueRef.current = '';
  };

  const acceptSelectedFile = (file) => {
    if (!file) return;

    // Validation
    const isImage = file.type.startsWith('image/');
    const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB vs 50MB

    if (file.size > maxSize) {
      toast.error(`File terlalu besar! Maksimal ${isImage ? '10MB' : '50MB'}`);
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e) => acceptSelectedFile(e.target.files?.[0]);

  const applyDescriptionCommand = (command) => {
    const editor = descriptionEditorRef.current;
    if (!editor) return;

    editor.focus();
    document.execCommand(command, false, null);
    const deskripsi = editor.innerHTML;
    descriptionValueRef.current = deskripsi;
    setFormData((current) => ({ ...current, deskripsi }));
  };

  const handleSave = async () => {
    if (!formData.judul || !formData.kelas_id || !formData.mapel_id) {
      toast.error('Harap lengkapi field wajib');
      return;
    }

    setLoading(true);
    const currentDeskripsi = descriptionEditorRef.current 
      ? descriptionEditorRef.current.innerHTML 
      : (descriptionValueRef.current || formData.deskripsi || '');
    const data = new FormData();
    Object.keys(formData).filter((key) => key !== 'notify_students' && key !== 'deskripsi').forEach(key => data.append(key, formData[key]));
    data.append('deskripsi', currentDeskripsi);
    if (selectedFile) data.append('file', selectedFile);
    if (modalMode === 'upload') data.append('notify_students', formData.notify_students ? '1' : '0');

    try {
      if (modalMode === 'upload') {
        await teacherAPI.saveMaterial(data);
        toast.success('✅ Materi berhasil diupload');
      } else {
        await teacherAPI.updateMaterial(selectedMateri.id, data);
        toast.success('✅ Materi berhasil diperbarui');
      }
      fetchMaterials();
      closeModal();
    } catch (error) {
      toast.error('Gagal menyimpan materi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await teacherAPI.deleteMaterial(selectedMateri.id);
      toast.success('🗑️ Materi berhasil dihapus');
      fetchMaterials();
      closeModal();
    } catch (error) {
      toast.error('Gagal menghapus materi');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (materi) => {
    if (!materi.file_name) return;
    try {
      const response = await teacherAPI.downloadMaterial(materi.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${materi.judul}.${materi.file_type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Gagal mendownload file');
    }
  };

  const getFileTypeLabel = (type) => {
    const t = type?.toLowerCase();
    if (['pdf'].includes(t)) return { label: 'PDF', color: 'bg-[#EF4444] text-white', icon: <FileText size={12} /> };
    if (['doc', 'docx'].includes(t)) return { label: 'WORD', color: 'bg-[#3B82F6] text-white', icon: <File size={12} /> };
    if (['ppt', 'pptx'].includes(t)) return { label: 'PPT', color: 'bg-[#F97316] text-white', icon: <FileSpreadsheet size={12} /> };
    if (['mp4', 'mkv', 'avi'].includes(t)) return { label: 'VIDEO', color: 'bg-[#8B5CF6] text-white', icon: <Video size={12} /> };
    if (['jpg', 'jpeg', 'png'].includes(t)) return { label: 'GAMBAR', color: 'bg-[#10B981] text-white', icon: <ImageIcon size={12} /> };
    return { label: 'FILE', color: 'bg-slate-400 text-white', icon: <File size={12} /> };
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSafeDescriptionHtml = (value) => {
    if (!value || typeof window === 'undefined') return '';
    const parsed = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
    const allowed = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI']);
    parsed.body.querySelectorAll('*').forEach((node) => {
      if (!allowed.has(node.tagName)) {
        node.replaceWith(document.createTextNode(node.textContent || ''));
        return;
      }
      [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    });
    return parsed.body.firstElementChild?.innerHTML || '';
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Header Section */}
      {showHero && <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="overflow-hidden rounded-[2rem] border border-green-100 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
              <GraduationCap className="h-3 w-3" /> Portal Teachers Workspace
            </div>
            {clock && (
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
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Area Kerja Guru</h1>
            <p className="mt-2 text-sm italic leading-7 text-slate-600">
              "Mendedikasikan diri untuk mencetak generasi cerdas dan berkarakter. Menanam benih ilmu hari ini untuk memanen masa depan yang lebih cerah."
            </p>
          </div>
        </div>
      </motion.div>}

      {/* Filter Card */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
      <GlassCard className="overflow-visible border border-green-100/80 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] shadow-[0_18px_50px_-36px_rgba(15,23,42,0.35)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 p-3 text-white shadow-lg shadow-emerald-600/20">
              <Filter size={19} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Temukan materi</h3>
              <p className="mt-0.5 text-sm text-slate-500">Pilih kelas, mata pelajaran, lalu judul materi.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="ml-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-700 text-[11px] text-white shadow-sm">1</span>Kelas</label>
            <select 
              value={filter.kelas_id}
              onChange={(e) => setFilter({...filter, kelas_id: e.target.value, mapel_id: '', judul: '', page: 1})}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all"
            >
              <option value="">Pilih kelas</option>
              {options.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="ml-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-700 text-[11px] text-white shadow-sm">2</span>Mata Pelajaran</label>
            <select 
              value={filter.mapel_id}
              disabled={!filter.kelas_id}
              onChange={(e) => setFilter({...filter, mapel_id: e.target.value, judul: '', page: 1})}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <option value="">
                {!filter.kelas_id
                  ? 'Pilih mata pelajaran'
                  : getClassSubjects(filter.kelas_id).length
                    ? 'Pilih mata pelajaran'
                    : 'Belum ada mata pelajaran di kelas ini'}
              </option>
              {filter.kelas_id && getClassSubjects(filter.kelas_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="ml-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-700 text-[11px] text-white shadow-sm">3</span>Judul Materi</label>
            <select
              value={filter.judul}
              disabled={!filter.kelas_id || !filter.mapel_id}
              onChange={(e) => setFilter({...filter, judul: e.target.value, page: 1})}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 font-bold text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <option value="">Pilih judul materi</option>
              {titleOptions.map((title) => <option key={title} value={title}>{title}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button 
            onClick={handleApplyFilter}
            className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-600/25 active:scale-[0.98]"
          >
            TERAPKAN FILTER
          </button>
          <button 
            onClick={handleResetFilter}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-600 shadow-sm transition duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          >
            RESET
          </button>
        </div>
      </GlassCard>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">Materi yang Diunggah</h2>
          <p className="mt-1 text-sm text-slate-500">File tersimpan pada server sekolah dan bisa diunduh kapan saja.</p>
        </div>
        <button onClick={() => openModal('upload')} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">
          <Plus size={18} /> Upload Materi Baru
        </button>
      </motion.div>

      <GlassCard className="space-y-6">
      <motion.div layout className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full rounded-3xl border border-slate-200 bg-white p-10 text-center font-semibold text-slate-400">Memuat materi...</motion.div>
        ) : materials.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white p-14 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 shadow-md shadow-slate-900/5"><FileText className="h-8 w-8" /></span>
            <p className="mt-4 font-black text-slate-800">Belum ada materi ajar</p>
            <p className="mt-1 text-sm text-slate-500">Unggah materi pertama untuk kelas yang Anda ampu.</p>
          </motion.div>
        ) : materials.map((m, index) => {
          const fileInfo = getFileTypeLabel(m.file_type);
          return (
            <motion.article key={m.id} layout initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.32, delay: index * 0.055 }} whileHover={{ y: -5 }} className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_32px_-26px_rgba(15,23,42,0.35)] transition duration-300 hover:border-emerald-200 hover:shadow-[0_22px_45px_-28px_rgba(16,185,129,0.28)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-400 opacity-70 transition-opacity group-hover:opacity-100" />
              <div className="flex items-start gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm transition duration-300 group-hover:scale-105 ${fileInfo.color}`}>{fileInfo.icon}</div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 font-bold text-slate-900">{m.judul}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black ${fileInfo.color}`}>{fileInfo.label}</span>
                    <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{m.kategori || 'Modul Utama'}</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <p className="text-slate-600"><span className="font-semibold text-slate-400">Kelas:</span> {m.class?.name || '-'}</p>
                <p className="text-slate-600"><span className="font-semibold text-slate-400">Mapel:</span> {m.subject?.name || '-'}</p>
                <p className="flex items-center justify-between text-xs text-slate-400"><span>{m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'}</span><span>{formatSize(m.file_size)}</span></p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => handleDownload(m)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-700 px-3 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/15 transition hover:brightness-105"><Download size={15} /> Unduh</button>
                <button onClick={() => openModal('detail', m)} className="rounded-lg border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50" title="Pratinjau"><Eye size={16} /></button>
                <button onClick={() => openModal('edit', m)} className="rounded-lg border border-slate-200 p-2.5 text-amber-600 transition hover:bg-amber-50" title="Edit"><Edit3 size={16} /></button>
                <button onClick={() => openModal('delete', m)} className="rounded-lg border border-slate-200 p-2.5 text-rose-600 transition hover:bg-rose-50" title="Hapus"><Trash2 size={16} /></button>
              </div>
            </motion.article>
          );
        })}
      </motion.div>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-end gap-2">
          <p className="text-sm font-bold text-slate-400">
            Menampilkan <span className="text-slate-700">{materials.length}</span> dari <span className="text-slate-700">{pagination.total}</span> materi
          </p>
          <div className="flex items-center gap-1.5">
            <button
              aria-label="Halaman sebelumnya"
              disabled={!pagination.total || pagination.current_page <= 1}
              onClick={() => setFilter({...filter, page: pagination.current_page - 1})}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Halaman berikutnya"
              disabled={!pagination.total || pagination.current_page >= pagination.last_page}
              onClick={() => setFilter({...filter, page: pagination.current_page + 1})}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
      </GlassCard>

      {/* Upload/Edit Modal */}
      {(modalMode === 'upload' || modalMode === 'edit') && (
        createPortal(
        <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/65 p-4 backdrop-blur-md animate-fadeIn overscroll-none">
          <motion.div initial={{ scale: 0.96, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[2.5rem] bg-white shadow-2xl">
            <div className="p-6 bg-gradient-to-r from-green-700 to-emerald-600 text-white flex items-center justify-between flex-shrink-0">
              <h4 className="font-black uppercase tracking-widest text-sm">
                {modalMode === 'upload' ? 'UPLOAD MATERI BARU' : 'EDIT MATERI AJAR'}
              </h4>
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-black tracking-wider text-emerald-100">Esc</span>
                <button type="button" onClick={closeModal} aria-label="Tutup (Esc)" className="rounded-full p-2.5 text-white transition-all hover:bg-rose-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-6 sm:p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={16} className="text-emerald-600" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">INFORMASI MATERI</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Judul Materi <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Contoh: Pengenalan Logika Pemrograman"
                      value={formData.judul}
                      onChange={(e) => setFormData({...formData, judul: e.target.value})}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Kategori Materi <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.kategori}
                      onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                    >
                      <option value="Modul Utama">Modul Utama</option>
                      <option value="LKPD">LKPD</option>
                      <option value="Video">Video</option>
                      <option value="Referensi">Referensi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Kelas Tujuan <span className="text-red-500">*</span>
                    </label>
                    <select 
                      value={formData.kelas_id}
                      onChange={(e) => setFormData({...formData, kelas_id: e.target.value, mapel_id: ''})}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                    >
                      <option value="">— Pilih Kelas Tujuan —</option>
                      {options.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Mata Pelajaran <span className="text-red-500">*</span>
                    </label>
                    <select 
                      value={formData.mapel_id}
                      disabled={!formData.kelas_id}
                      onChange={(e) => setFormData({...formData, mapel_id: e.target.value})}
                      className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 ${!formData.kelas_id ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                    >
                      <option value="">
                        {!formData.kelas_id
                          ? '— Pilih Kelas Terlebih Dahulu —'
                          : getClassSubjects(formData.kelas_id).length
                            ? '— Pilih Mata Pelajaran —'
                            : 'Belum ada mata pelajaran di kelas ini'}
                      </option>
                      {getClassSubjects(formData.kelas_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Topik / Bab</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: Bab 1 - Pendahuluan"
                      value={formData.topik}
                      onChange={(e) => setFormData({...formData, topik: e.target.value})}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Link Video (Opsional)</label>
                    <input 
                      type="text" 
                      placeholder="YouTube / GDrive Link"
                      value={formData.link_video}
                      onChange={(e) => setFormData({...formData, link_video: e.target.value})}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Deskripsi</label>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-50">
                      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100/70 px-3 py-2">
                        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyDescriptionCommand('bold')} className="h-8 min-w-8 rounded-lg border border-slate-200 bg-white px-2 text-sm font-black text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700" aria-label="Tebalkan teks">B</button>
                        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyDescriptionCommand('insertUnorderedList')} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700">• Daftar</button>
                        <span className="ml-auto text-[10px] font-semibold text-slate-400">Format sederhana</span>
                      </div>
                      <div
                        ref={descriptionEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(event) => {
                          const html = event.currentTarget?.innerHTML ?? '';
                          descriptionValueRef.current = html;
                        }}
                        onBlur={(event) => {
                          const html = event.currentTarget?.innerHTML ?? '';
                          descriptionValueRef.current = html;
                          setFormData((current) => ({ ...current, deskripsi: html }));
                        }}
                        data-placeholder="Jelaskan isi materi secara singkat..."
                        className="min-h-[120px] px-3.5 py-2.5 text-sm font-normal leading-6 text-slate-800 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Upload size={16} className="text-emerald-600" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UPLOAD FILE</span>
                </div>
                
                <label
                  className="block w-full cursor-pointer group"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); acceptSelectedFile(event.dataTransfer.files?.[0]); }}
                >
                  <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />
                  <div className="rounded-[2rem] border-2 border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-green-50/60 p-8 text-center transition-all group-hover:border-emerald-400 group-hover:shadow-inner">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
                      <Upload size={32} />
                    </div>
                    <p className="text-sm font-black text-slate-700">Drag & drop file atau klik untuk upload</p>
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      PDF, DOC, PPT, MP4, JPG, PNG (Maks. 50MB)
                    </p>
                  </div>
                </label>

                <AnimatePresence mode="wait">
                {selectedFile && (
                  <motion.div key={selectedFile.name} initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl text-emerald-500 shadow-sm">
                        <File size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-700 truncate max-w-[300px]">{selectedFile.name}</p>
                        <p className="text-[10px] font-bold text-emerald-600">{formatSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSelectedFile(null)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50" aria-label="Hapus file terpilih">
                      <X size={16} /> Hapus
                    </button>
                  </motion.div>
                )}
                </AnimatePresence>

                {modalMode === 'edit' && !selectedFile && selectedMateri?.file_name && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm">
                        <File size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-500 italic">File saat ini: {selectedMateri.file_name}</p>
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-0.5">⚠️ MENGGANTI FILE AKAN MENGHAPUS FILE LAMA</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {modalMode === 'upload' && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 transition hover:bg-emerald-50">
                  <input type="checkbox" checked={Boolean(formData.notify_students)} onChange={(event) => setFormData({...formData, notify_students: event.target.checked})} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">Kirim notifikasi ke dashboard siswa</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">Siswa di kelas yang dipilih akan menerima pemberitahuan materi baru.</span>
                  </span>
                </label>
              )}

              <div className="flex-shrink-0 border-t border-slate-100 pt-4">
                <button 
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-8 py-4 font-black text-white shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-600/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'MENYIMPAN...' : modalMode === 'upload' ? 'UPLOAD MATERI' : 'SIMPAN PERUBAHAN'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
        )
      )}

      {/* Detail Modal */}
      {modalMode === 'detail' && selectedMateri && createPortal(
        <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/65 p-4 backdrop-blur-md animate-fadeIn">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-green-700 to-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye size={20} />
                <h4 className="font-black uppercase tracking-widest text-sm">DETAIL MATERI AJAR</h4>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-emerald-600" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">INFORMASI</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-slate-800">{selectedMateri.judul}</h3>
                  <p className="text-sm font-bold text-slate-400">{selectedMateri.topik || 'Tanpa Topik'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelas</p>
                    <p className="text-sm font-black text-slate-700 mt-1">{selectedMateri.class?.name}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mapel</p>
                    <p className="text-sm font-black text-slate-700 mt-1">{selectedMateri.subject?.name}</p>
                  </div>
                </div>
                <div className="text-sm font-medium leading-relaxed text-slate-600 bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
                  {selectedMateri.deskripsi ? <div dangerouslySetInnerHTML={{ __html: getSafeDescriptionHtml(selectedMateri.deskripsi) }} /> : 'Tidak ada deskripsi.'}
                </div>
              </div>

              {selectedMateri.file_name && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <File size={16} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FILE MATERI</span>
                  </div>
                  <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-700 truncate max-w-[300px]">{selectedMateri.file_name}</p>
                      <p className="text-xs font-bold text-emerald-600 uppercase mt-0.5">
                        {selectedMateri.file_type} • {formatSize(selectedMateri.file_size)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDownload(selectedMateri)} className="p-3 bg-white text-emerald-500 rounded-2xl hover:bg-emerald-50 shadow-sm transition-all">
                        <Download size={20} />
                      </button>
                      <button className="p-3 bg-white text-blue-500 rounded-2xl hover:bg-blue-50 shadow-sm transition-all">
                        <Eye size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {selectedMateri.link_video && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ExternalLink size={16} className="text-indigo-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LINK VIDEO</span>
                  </div>
                  <a href={selectedMateri.link_video} target="_blank" rel="noopener noreferrer" className="block p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-sm font-bold text-indigo-600 truncate hover:bg-indigo-50 transition-all flex items-center gap-3">
                    <Video size={18} /> {selectedMateri.link_video}
                  </a>
                </div>
              )}

              <button onClick={closeModal} className="w-full py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all">
                TUTUP
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Delete Modal */}
      {modalMode === 'delete' && selectedMateri && createPortal(
        <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/65 p-4 backdrop-blur-md animate-fadeIn">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 text-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500 mb-6">
              <Trash2 size={40} />
            </div>
            <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">HAPUS MATERI AJAR?</h4>
            <p className="mt-4 text-slate-500 font-medium">Anda yakin ingin menghapus materi ini? File akan dihapus permanen dari server.</p>
            
            <div className="mt-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left space-y-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">DETAIL MATERI:</p>
              <p className="text-sm font-black text-slate-700">{selectedMateri.judul}</p>
              <p className="text-xs font-bold text-slate-500">{selectedMateri.class?.name} • {selectedMateri.subject?.name}</p>
              {selectedMateri.file_name && <p className="text-[10px] font-bold text-rose-500 italic">File: {selectedMateri.file_name} ({formatSize(selectedMateri.file_size)})</p>}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-10">
              <button onClick={closeModal} className="py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all">
                BATAL
              </button>
              <button 
                onClick={handleDelete}
                disabled={loading}
                className="py-4 bg-[#EF4444] text-white font-black rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
              >
                {loading ? 'MENGHAPUS...' : 'YA, HAPUS'}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MateriAjarTab;
