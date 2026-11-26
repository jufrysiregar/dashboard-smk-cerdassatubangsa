import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Plus, FileText, X, FileEdit, Trash2, Eye,
    BookOpen, Save, CheckCircle, AlertCircle,
    Clock, ChevronLeft, ChevronRight,
    BookMarked, Award, RefreshCw,
    Target, Zap, Upload, Check, KeyRound, Copy
} from 'lucide-react';
import { tugasAPI, teacherAPI, BASE_URL } from '../../../../utils/api';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';
import TugasDetailUnifiedModal from './TugasDetailUnifiedModal';

// ─── Toast helper ───────────────────────────────────────────────────────────
const notify = (message, type = 'success') =>
    window.dispatchEvent(new CustomEvent('dashboardToast', { detail: { message, type } }));

// ─── Motion variants ─────────────────────────────────────────────────────────
const modalVariants = {
    initial: { scale: 0.96, opacity: 0, y: 10 },
    animate: { scale: 1, opacity: 1, y: 0, transition: { type: 'spring', stiffness: 340, damping: 28 } },
    exit:    { scale: 0.96, opacity: 0, y: 10, transition: { duration: 0.15 } },
};

// Full screen backdrop with dark tone & strong maximum blur, completely removing scrollbar/ruler
const backdropClass = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-4 overflow-y-auto w-full h-full modal-backdrop-clean no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

// ─── Waktu: API mengirim UTC (…Z) → konversi ke jam dinding Asia/Jakarta untuk
// input datetime-local (YYYY-MM-DDTHH:mm). Mencegah field Edit tampil 7 jam meleset.
const toWibInput = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false }).slice(0, 16).replace(' ', 'T');
};

// ─── Format File Size ───────────────────────────────────────────────────────
const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// ─── Reusable UI atoms ───────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
    const styles = {
        'Aktif':         'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
        'Selesai':       'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
        'Perlu Koreksi': 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    };
    const dots = {
        'Aktif':         'bg-emerald-500',
        'Selesai':       'bg-slate-400',
        'Perlu Koreksi': 'bg-amber-500',
    };
    const cls = styles[status] ?? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200';
    const dot = dots[status]   ?? 'bg-blue-500';
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {status ?? '—'}
        </span>
    );
};

const ProgressMini = ({ value, total }) => {
    const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
    const color = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-blue-500' : 'bg-amber-400';
    return (
        <div className="flex items-center gap-2 min-w-[110px]">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-500 tabular-nums whitespace-nowrap">{value}/{total}</span>
        </div>
    );
};

const SkeletonRow = () => (
    <tr className="animate-pulse border-b border-slate-50">
        {[...Array(8)].map((_, i) => (
            <td key={i} className="px-4 py-3.5">
                <div className="h-3.5 bg-slate-100 rounded-lg" style={{ width: `${60 + i * 7}%` }} />
            </td>
        ))}
    </tr>
);

const SectionLabel = ({ children }) => (
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{children}</p>
);

const InputField = ({ label, required, children }) => (
    <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {children}
    </div>
);

// Sakelar ON/OFF (house-style) utk pengaturan sesi kuis guru.
const FlagToggle = ({ checked, onChange, label, hint }) => (
    <button type="button" onClick={() => onChange(!checked)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
        <span>
            <span className="block text-sm font-bold text-slate-700">{label}</span>
            {hint && <span className="block text-xs text-slate-400">{hint}</span>}
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
    </button>
);

// Kartu radio pemilih format soal manual.
// Kartu pilihan format soal — minimalis: radio bulat + label saja (tanpa ikon/deskripsi).
const FormatRadio = ({ active, onClick, label }) => (
    <button type="button" onClick={onClick}
        className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all ${active ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-emerald-600' : 'border-slate-300'}`}>
            {active && <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />}
        </span>
        <span className="text-sm font-bold text-slate-800">{label}</span>
    </button>
);

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50';

// Deteksi format paket Bank Soal. Esai (PDF) HANYA jika question_format === 'esai' ATAU
// punya file_soal_pdf non-kosong TANPA butir soal. Selain itu — termasuk paket lama dengan
// question_format null/kosong yang berisi butir soal — dikenali tegas sebagai Pilihan Ganda (CBT).
const isEsaiPackage = (pkg) => {
    if (!pkg) return false;
    if (String(pkg.question_format) === 'esai') return true;
    const hasPdf = !!(pkg.file_soal_pdf && String(pkg.file_soal_pdf).trim());
    const soals = Number(pkg.soals_count ?? pkg.jumlah_soal ?? pkg.questions_count ?? 0);
    return hasPdf && soals === 0;
};

// ─── Stat Card ──────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, gradient, ring }) => (
    <div className={`relative overflow-hidden rounded-2xl ${gradient} p-4 shadow-sm ${ring}`}>
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">{label}</p>
                <p className="mt-1 text-3xl font-black text-white tabular-nums">{value}</p>
            </div>
            <div className="rounded-xl bg-white/20 p-2.5">
                <Icon size={20} className="text-white" />
            </div>
        </div>
        <div className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-white/10" />
    </div>
);

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function TugasNilaiAdminTab({ user, quickAction, onQuickActionConsumed }) {
    // ── List state ────────────────────────────────────────────────────────
    const [tugas,        setTugas]        = useState([]);
    const [kelasData,    setKelasData]    = useState([]);
    const [mapelData,    setMapelData]    = useState([]);
    const [bankPackages, setBankPackages] = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [pagination,   setPagination]   = useState({ current: 1, total: 0, lastPage: 1 });
    const [filters,      setFilters]      = useState({
        school_class_id: 'all', subject_id: 'all', status: 'Semua', search: '',
    });

    // ── Modal flags ───────────────────────────────────────────────────────
    const [isCreateOpen,      setIsCreateOpen]      = useState(false);
    const [isEditOpen,        setIsEditOpen]        = useState(false);
    const [isDeleteOpen,      setIsDeleteOpen]      = useState(false);
    const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);

    // ── Mode pembuatan: 'bank_soal' | 'manual' ───────────────────────────
    const [createMode, setCreateMode] = useState('bank_soal');
    const [packageSearch, setPackageSearch] = useState('');
    // ── Modul Kuis Guru: format manual (cbt_docx | esai_pdf) ──
    const [manualFormat, setManualFormat] = useState('cbt_docx');

    // ── Drag & Drop state ─────────────────────────────────────────────────
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    // ── Selection & modal terpadu (Detail+Pantau+Nilai) ───────────────────
    const [selectedTugas,  setSelectedTugas]  = useState(null);
    const [unifiedTask,    setUnifiedTask]    = useState(null);

    // ── Form state ────────────────────────────────────────────────────────
    const emptyForm = {
        judul: '', school_class_id: '', subject_id: '', deadline: '',
        starts_at: '', duration_minutes: '', bobot: 20, deskripsi: '',
        lampiran: null, paket_soal_id: '',
        docx_file: null, pdf_file: null,
        acak_soal: false, tampilkan_nilai: true, izinkan_ketik: true, izinkan_upload_foto: true,
        token_akses: '',
    };
    const [formData,   setFormData]   = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [deleting,   setDeleting]   = useState(false);
    const [generatingToken, setGeneratingToken] = useState(false);
    const [regeneratingEditToken, setRegeneratingEditToken] = useState(false);

    // ── Lock background scroll & ruler navigation when any modal is open ─
    const hasOpenModal = isCreateOpen || isEditOpen || isDeleteOpen || isPickerModalOpen || !!unifiedTask;
    useBodyScrollLock(hasOpenModal);

    // Handle Quick Action trigger
    useEffect(() => {
        if (quickAction === 'create-task') {
            setFormData(emptyForm);
            setCreateMode('bank_soal');
            setIsCreateOpen(true);
            onQuickActionConsumed?.();
        }
    }, [quickAction, onQuickActionConsumed]);

    // ── Filtered Subject List for Form (prevents placeholder bug) ─────────
    const formAvailableSubjects = useMemo(() => {
        if (formData.school_class_id) {
            const selectedClass = kelasData.find(k => String(k.id) === String(formData.school_class_id));
            if (selectedClass?.subjects && selectedClass.subjects.length > 0) {
                return selectedClass.subjects;
            }
        }
        return mapelData;
    }, [formData.school_class_id, kelasData, mapelData]);

    // ── Selected Bank Package Object ─────────────────────────────────────
    const selectedPackageObj = useMemo(() => {
        if (!formData.paket_soal_id) return null;
        return bankPackages.find(p => String(p.id) === String(formData.paket_soal_id)) || null;
    }, [formData.paket_soal_id, bankPackages]);

    // Format paket Bank Soal terpilih → menentukan sakelar pengaturan & payload (pakai helper robust).
    const bankPackageIsEsai = useMemo(() => isEsaiPackage(selectedPackageObj), [selectedPackageObj]);

    // ── Filtered Bank Packages for Picker Modal ──────────────────────────
    // HANYA paket riil milik guru ini (sumbernya /teacher/question-bank sudah
    // difilter created_by) yang COCOK dengan Kelas & Mapel terpilih di form.
    const filteredBankPackages = useMemo(() => {
        const kelasId = formData.school_class_id ? String(formData.school_class_id) : '';
        const mapelNama = String(
            (mapelData.find(m => String(m.id) === String(formData.subject_id))?.name
                || mapelData.find(m => String(m.id) === String(formData.subject_id))?.nama_mapel
                || ''),
        ).trim().toLowerCase();
        const q = packageSearch.trim().toLowerCase();
        return bankPackages.filter(p => {
            if (kelasId && String(p.school_class_id ?? '') !== kelasId) return false;
            if (mapelNama && String(p.subject || p.mapel || '').trim().toLowerCase() !== mapelNama) return false;
            if (!q) return true;
            return (
                (p.judul || p.title || '').toLowerCase().includes(q) ||
                (p.subject || p.mapel || '').toLowerCase().includes(q) ||
                (p.class_name || p.kelas || '').toLowerCase().includes(q)
            );
        });
    }, [bankPackages, packageSearch, formData.school_class_id, formData.subject_id, mapelData]);

    // ── Stats ─────────────────────────────────────────────────────────────
    // Status baris dihitung backend dari data nyata (deadline + pengumpulan
    // belum dinilai) via display_status — KPI ikut naik/turun setelah koreksi disimpan.
    const stats = {
        total:        tugas.length,
        aktif:        tugas.filter(t => (t.display_status || t.status) === 'Aktif').length,
        selesai:      tugas.filter(t => (t.display_status || t.status) === 'Selesai').length,
        perluKoreksi: tugas.filter(t => (t.display_status || t.status) === 'Perlu Koreksi').length,
    };

    // ════════════════════════════════════════════════════════════════════════
    // Data fetching
    // ════════════════════════════════════════════════════════════════════════
    const fetchFilters = useCallback(async () => {
        try {
            const [filterRes, pkgRes] = await Promise.all([
                tugasAPI.getFilters(),
                teacherAPI.getQuestionBank(),
            ]);
            const fd = filterRes.data?.data ?? filterRes.data ?? {};
            setKelasData(fd.kelas ?? fd.classes ?? []);
            setMapelData(fd.mapel ?? fd.subjects ?? []);
            setBankPackages(pkgRes.data?.data ?? pkgRes.data ?? []);
        } catch (err) {
            console.error('fetchFilters', err);
        }
    }, []);

    const fetchTugas = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = { page };
            if (filters.school_class_id !== 'all') params.school_class_id = filters.school_class_id;
            if (filters.subject_id      !== 'all') params.subject_id      = filters.subject_id;
            if (filters.status          !== 'Semua') params.status         = filters.status;
            if (filters.search)                      params.search          = filters.search;

            const res  = await tugasAPI.getAll(params);
            const data = res.data?.data ?? res.data ?? {};
            if (Array.isArray(data)) {
                setTugas(data);
                setPagination({ current: 1, total: data.length, lastPage: 1 });
            } else {
                setTugas(data.data ?? []);
                setPagination({
                    current:  data.current_page ?? 1,
                    total:    data.total        ?? 0,
                    lastPage: data.last_page    ?? 1,
                });
            }
        } catch (err) {
            console.error('fetchTugas', err);
            notify('Gagal memuat data tugas', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { fetchFilters(); }, [fetchFilters]);

    useEffect(() => {
        const t = setTimeout(() => fetchTugas(1), filters.search ? 400 : 0);
        return () => clearTimeout(t);
    }, [filters, fetchTugas]);

    // ── Esc key: tutup modal yang sedang aktif ──────────────────────────────
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key !== 'Escape') return;
            if (isCreateOpen) { setIsCreateOpen(false); return; }
            if (isPickerModalOpen) { setIsPickerModalOpen(false); return; }
            if (isEditOpen) { setIsEditOpen(false); return; }
            if (isDeleteOpen) { setIsDeleteOpen(false); return; }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isCreateOpen, isPickerModalOpen, isEditOpen, isDeleteOpen]);

    // ════════════════════════════════════════════════════════════════════════
    // Form & Drag-Drop helpers
    // ════════════════════════════════════════════════════════════════════════
    const handleFormChange = e => {
        const { name, value, files } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: files ? files[0] : value };
            if (name === 'school_class_id') {
                next.subject_id = '';
            }
            return next;
        });
    };

    const handleFileSelect = (file) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            notify('Ukuran file maksimal adalah 10 MB', 'error');
            return;
        }
        setFormData(prev => ({ ...prev, lampiran: file }));
    };

    const buildFD = data => {
        const fd = new FormData();
        Object.entries(data).forEach(([k, v]) => {
            // Boolean dikirim eksplisit '1'/'0' agar PHP $request->boolean() tidak salah
            // menafsirkan (string "false" pernah bikin toggle tersimpan true).
            if (typeof v === 'boolean') { fd.append(k, v ? '1' : '0'); return; }
            if (v !== null && v !== undefined && v !== '') fd.append(k, v);
        });
        return fd;
    };

    // ════════════════════════════════════════════════════════════════════════
    // CRUD handlers
    // ════════════════════════════════════════════════════════════════════════
    const openCreate = () => { 
        setFormData(emptyForm); 
        setCreateMode('bank_soal');
        setIsCreateOpen(true); 
    };

    // Tombol Generate Token aktif hanya bila SEMUA kolom wajib manual (Judul, Kelas,
    // Mapel, Deadline, File .docx/.pdf) sudah terisi — sesuai spesifikasi.
    const manualRequiredComplete = useMemo(() => {
        const base = formData.judul && formData.school_class_id && formData.subject_id && formData.deadline && formData.starts_at && (formData.duration_minutes !== '' && formData.duration_minutes != null);
        if (!base) return false;
        return manualFormat === 'cbt_docx' ? !!formData.docx_file : !!formData.pdf_file;
    }, [formData.judul, formData.school_class_id, formData.subject_id, formData.deadline, formData.starts_at, formData.duration_minutes, formData.docx_file, formData.pdf_file, manualFormat]);

    // Untuk tab Sumber Bank Soal: wajib = paket + judul + kelas + mapel + deadline + mulai + durasi.
    const bankRequiredComplete = !!(formData.paket_soal_id && formData.judul && formData.school_class_id && formData.subject_id && formData.deadline && formData.starts_at && (formData.duration_minutes !== '' && formData.duration_minutes != null));

    const handleGenerateToken = async () => {
        if (generatingToken) return;
        setGeneratingToken(true);
        try {
            const res = await tugasAPI.previewToken();
            const token = res.data?.data?.token_akses ?? '';
            setFormData(p => ({ ...p, token_akses: token }));
            notify('Token akses 6 karakter dibuat.', 'success');
        } catch (err) {
            notify(err.response?.data?.message ?? 'Gagal membuat token.', 'error');
        } finally {
            setGeneratingToken(false);
        }
    };

    const copyFormToken = async () => {
        if (!formData.token_akses) return;
        try { await navigator.clipboard.writeText(formData.token_akses); notify('Token disalin.', 'success'); }
        catch { notify('Salin manual: ' + formData.token_akses, 'error'); }
    };

    // Validasi klien REAKTIF: durasi pengerjaan tidak boleh melebihi rentang mulai–tenggat (mirror operator).
    // Nilai dihitung ulang tiap waktu/durasi berubah → error tampil langsung di bawah kolom Durasi.
    const windowError = useMemo(() => {
        if (!formData.starts_at || !formData.deadline || formData.duration_minutes === '' || formData.duration_minutes == null) return null;
        const startMs = new Date(formData.starts_at).getTime();
        const endMs = new Date(formData.deadline).getTime();
        if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
        const windowMin = Math.round((endMs - startMs) / 60000);
        const dur = Number(formData.duration_minutes);
        if (windowMin < 0) return 'Tenggat waktu harus setelah waktu mulai tugas.';
        if (dur > windowMin) return `Durasi pengerjaan (${dur} menit) melebihi rentang waktu mulai–tenggat (${windowMin} menit). Sesuaikan jam mulai/berakhir atau durasinya.`;
        return null;
    }, [formData.starts_at, formData.deadline, formData.duration_minutes]);

    const handleCreate = async e => {
        e.preventDefault();
        // Validasi klien utk mode manual (sesuai aturan backend Fase 2).
        if (createMode === 'manual') {
            if (manualFormat === 'cbt_docx' && !formData.docx_file) { notify('Unggah file .docx soal CBT terlebih dahulu.', 'error'); return; }
            if (manualFormat === 'esai_pdf' && !formData.pdf_file) { notify('Unggah file .pdf lembar soal terlebih dahulu.', 'error'); return; }
            if (manualFormat === 'esai_pdf' && !formData.izinkan_ketik && !formData.izinkan_upload_foto) { notify('Aktifkan minimal salah satu: ketik teks atau upload foto.', 'error'); return; }
        }
        if (windowError) { notify(windowError, 'error'); return; }
        setSubmitting(true);
        try {
            const payload = { ...formData };
            payload.mode_soal = createMode === 'bank_soal' ? 'bank_soal' : manualFormat;
            if (createMode === 'bank_soal' && !payload.deskripsi) {
                payload.deskripsi = `Kuis online dari Bank Soal: ${payload.judul}`;
            }
            await tugasAPI.create(buildFD(payload));
            notify('Tugas / Kuis berhasil dipublikasikan! 🎉');
            setIsCreateOpen(false);
            fetchTugas(1);
        } catch (err) {
            notify(err.response?.data?.message ?? 'Gagal membuat tugas', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const openEdit = t => {
        setSelectedTugas(t);
        setFormData({
            judul:            t.judul ?? t.title ?? '',
            school_class_id:  t.school_class_id ?? '',
            subject_id:       t.subject_id ?? '',
            deadline:         toWibInput(t.deadline_at || t.deadline),
            starts_at:        toWibInput(t.starts_at),
            duration_minutes: t.duration_minutes ?? '',
            bobot:            t.bobot ?? 20,
            deskripsi:        t.deskripsi ?? t.description ?? '',
            lampiran:         null,
            paket_soal_id:    t.paket_soal_id ?? '',
            docx_file:        null,
            pdf_file:         null,
            acak_soal:        !!t.acak_soal,
            tampilkan_nilai:  !!t.tampilkan_nilai,
            izinkan_ketik:    !!t.izinkan_ketik,
            izinkan_upload_foto: !!t.izinkan_upload_foto,
        });
        setIsEditOpen(true);
    };

    const handleRegenerateEditToken = async () => {
        if (!selectedTugas?.id) return;
        setRegeneratingEditToken(true);
        try {
            const res = await tugasAPI.regenerateToken(selectedTugas.id);
            const newToken = res.data?.data?.token_akses ?? '';
            setSelectedTugas(prev => ({ ...prev, token_akses: newToken }));
            notify('Token akses baru dibuat.', 'success');
            fetchTugas(pagination.current);
        } catch (err) {
            notify(err.response?.data?.message ?? 'Gagal membuat token baru.', 'error');
        } finally {
            setRegeneratingEditToken(false);
        }
    };

    const copyEditToken = async () => {
        if (!selectedTugas?.token_akses) return;
        try { await navigator.clipboard.writeText(selectedTugas.token_akses); notify('Token disalin.', 'success'); }
        catch { notify('Salin manual: ' + selectedTugas.token_akses, 'error'); }
    };

    const handleEdit = async e => {
        e.preventDefault();
        if (windowError) { notify(windowError, 'error'); return; }
        setSubmitting(true);
        try {
            const fd = buildFD(formData); 
            fd.append('_method', 'PUT');
            await tugasAPI.update(selectedTugas.id, fd);
            notify('Tugas berhasil diperbarui!');
            setIsEditOpen(false);
            fetchTugas(pagination.current);
        } catch (err) { 
            notify(err.response?.data?.message ?? 'Gagal memperbarui tugas', 'error'); 
        } finally { 
            setSubmitting(false); 
        }
    };

    const openDelete = t => { setSelectedTugas(t); setIsDeleteOpen(true); };
    const handleDelete = async () => {
        setDeleting(true);
        try {
            await tugasAPI.delete(selectedTugas.id);
            notify('Tugas berhasil dihapus.');
            setIsDeleteOpen(false);
            fetchTugas(pagination.current);
        } catch (err) { 
            notify(err.response?.data?.message ?? 'Gagal menghapus tugas', 'error'); 
        } finally { 
            setDeleting(false); 
        }
    };

    // Ikon Mata → satu modal terpadu (Detail + Pantau + Penilaian). Data di-fetch sendiri
    // oleh TugasDetailUnifiedModal via monitor(id); tidak lagi pakai modal Koreksi/Monitor
    // terpisah.
    const openDetail = t => setUnifiedTask(t);

    // Selecting a package from Bank Soal popup
    const handleSelectPackageFromModal = pkg => {
        const pkgTitle = pkg.judul ?? pkg.title ?? '';
        const pkgSubjectName = (pkg.subject ?? pkg.mapel ?? '').toLowerCase();

        // Match subject from mapelData
        const matchedSubject = mapelData.find(m => 
            (m.nama_mapel ?? m.name ?? m.nama ?? '').toLowerCase() === pkgSubjectName
        );

        setFormData(prev => ({
            ...prev,
            judul:         pkgTitle,
            paket_soal_id: pkg.id,
            subject_id:    matchedSubject ? matchedSubject.id : prev.subject_id,
        }));
        setIsPickerModalOpen(false);
        notify(`Paket soal "${pkgTitle}" berhasil terhubung! ✅`);
    };

    // ════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════
    return (
        <div className="space-y-5 p-6 lg:p-8">

            {/* ── Stats Row ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Tugas"   value={stats.total}        icon={FileText}      gradient="bg-gradient-to-br from-green-600 to-emerald-700"  ring="shadow-emerald-100" />
                <StatCard label="Aktif"          value={stats.aktif}        icon={Zap}           gradient="bg-gradient-to-br from-emerald-500 to-teal-600"    ring="shadow-emerald-100" />
                <StatCard label="Selesai"        value={stats.selesai}      icon={CheckCircle}   gradient="bg-gradient-to-br from-slate-500 to-slate-700"     ring="shadow-slate-100" />
                <StatCard label="Perlu Koreksi"  value={stats.perluKoreksi} icon={Award}         gradient="bg-gradient-to-br from-amber-400 to-orange-500"    ring="shadow-amber-100" />
            </div>

            {/* ── Filter Bar ───────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="relative min-w-[200px] flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Cari tugas..." value={filters.search}
                        onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm transition focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
                </div>

                {[
                    { key: 'school_class_id', label: 'Semua Kelas', options: kelasData.map(k => ({ value: k.id, label: k.nama_kelas ?? k.name ?? k.nama })) },
                    { key: 'subject_id',      label: 'Semua Mapel', options: mapelData.map(m => ({ value: m.id, label: m.nama_mapel ?? m.name ?? m.nama })) },
                    { key: 'status',          label: 'Semua Status', options: ['Aktif', 'Selesai', 'Perlu Koreksi'].map(s => ({ value: s, label: s })) },
                ].map(({ key, label, options }) => (
                    <select key={key} value={filters[key]}
                        onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition">
                        <option value={key === 'status' ? 'Semua' : 'all'}>{label}</option>
                        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                ))}

                <button onClick={() => fetchTugas(1)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 transition">
                    <RefreshCw size={14} />
                </button>

                <button onClick={openCreate}
                    className="ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 text-sm font-black text-white shadow-md shadow-emerald-600/25 hover:from-green-600 hover:to-emerald-700 active:scale-95 transition-all">
                    <Plus size={16} />
                    Buat Tugas / Kuis Baru
                </button>
            </div>

            {/* ── Table ────────────────────────────────────────────────── */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                {['No', 'Judul Tugas', 'Kelas', 'Mapel', 'Deadline', 'Progress', 'Status', 'Aksi'].map(h => (
                                    <th key={h} className="px-4 py-3.5 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                            ) : tugas.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-14 text-center">
                                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                                            <FileText size={24} className="text-slate-400" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-500">Belum ada tugas</p>
                                        <p className="text-xs text-slate-400 mt-1">Klik "Buat Tugas / Kuis Baru" untuk memulai</p>
                                    </td>
                                </tr>
                            ) : tugas.map((t, idx) => {
                                const no          = (pagination.current - 1) * 10 + idx + 1;
                                const terkumpul   = t.terkumpul   ?? t.submissions_count ?? 0;
                                const totalRow    = t.total_siswa ?? t.student_count      ?? 0;
                                const judul       = t.judul ?? t.title ?? '—';
                                const kelas       = t.kelas?.nama_kelas ?? t.school_class?.name ?? t.kelas_nama ?? t.kelas?.name ?? '—';
                                const mapel       = t.mapel?.nama_mapel ?? t.subject?.name ?? t.mapel_nama ?? t.mapel?.name ?? '—';
                                const deadline    = t.deadline_at
                                    ? new Date(t.deadline_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                    : t.deadline
                                        ? new Date(t.deadline).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : '—';

                                return (
                                    <motion.tr key={t.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="group hover:bg-emerald-50/30 transition-colors">
                                        <td className="px-4 py-3.5 text-xs font-bold text-slate-400">{no}</td>
                                        <td className="px-4 py-3.5 max-w-[200px]">
                                            <p className="font-semibold text-slate-800 truncate" title={judul}>{judul}</p>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{kelas}</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-slate-500">{mapel}</td>
                                        <td className="px-4 py-3.5">
                                            <span className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                                                <Clock size={11} className="text-slate-400" />
                                                {deadline}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <ProgressMini value={terkumpul} total={totalRow} />
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <StatusPill status={t.display_status || t.status} />
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openDetail(t)} title="Detail, Pantau & Nilai"
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors">
                                                    <Eye size={14} />
                                                </button>
                                                <button onClick={() => openEdit(t)} title="Edit"
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-amber-100 hover:text-amber-600 transition-colors">
                                                    <FileEdit size={14} />
                                                </button>
                                                <button onClick={() => openDelete(t)} title="Hapus"
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.lastPage > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                        <p className="text-xs text-slate-400">
                            Halaman <strong className="text-slate-700">{pagination.current}</strong> dari <strong className="text-slate-700">{pagination.lastPage}</strong>
                            {' · '}{pagination.total} tugas
                        </p>
                        <div className="flex gap-1.5">
                            <button onClick={() => fetchTugas(pagination.current - 1)} disabled={pagination.current === 1}
                                className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                <ChevronLeft size={13} /> Prev
                            </button>
                            <button onClick={() => fetchTugas(pagination.current + 1)} disabled={pagination.current === pagination.lastPage}
                                className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                Next <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ════════════════════════════════════════════════════════════
                MODALS (Full-screen Blur Backdrop & Scroll-Locked via Portal)
            ════════════════════════════════════════════════════════════ */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>

                {/* ── MODAL 1: BUAT TUGAS / KUIS BARU (2 MODES SWITCHER) ── */}
                {isCreateOpen && (
                    <div className={backdropClass}>
                        <motion.div {...modalVariants} onClick={e => e.stopPropagation()}
                            className="my-auto w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">

                            <div className="shrink-0 bg-gradient-to-r from-green-700 to-emerald-600 p-6 text-white flex items-center justify-between">
                                <h4 className="font-black uppercase tracking-widest text-sm text-white">
                                    Buat Tugas / Kuis Baru
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-black tracking-wider text-emerald-100">Esc</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateOpen(false)}
                                        aria-label="Tutup (Esc)"
                                        className="rounded-full p-2 text-white transition-all hover:bg-rose-500 hover:text-white"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="shrink-0 bg-white">
                                {/* ── 2 Mode Tab Switcher at the Top ── */}
                                <div className="px-6 pt-4 pb-2">
                                    <div className="flex rounded-2xl bg-slate-100 p-1.5 border border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCreateMode('bank_soal');
                                                // Reset file lampiran when switching to bank soal
                                                setFormData(p => ({ ...p, lampiran: null }));
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${
                                                createMode === 'bank_soal'
                                                    ? 'bg-white text-emerald-700 shadow-md shadow-emerald-100'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            <BookMarked size={16} />
                                            Sumber Bank Soal
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCreateMode('manual');
                                                // Reset paket_soal_id when switching to manual
                                                setFormData(p => ({ ...p, paket_soal_id: '' }));
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${
                                                createMode === 'manual'
                                                    ? 'bg-white text-emerald-700 shadow-md shadow-emerald-100'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            <FileText size={16} />
                                            Buat Soal Manual
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <form id="createTaskForm" onSubmit={handleCreate} className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-3 space-y-5">

                                {/* ──────────────────────────────────────────────────────────
                                    MODE 1: TARIK DARI BANK SOAL (KUIS / EVALUASI)
                                ────────────────────────────────────────────────────────── */}
                                {createMode === 'bank_soal' && (
                                    <div className="space-y-4">
                                        {/* Bank Soal Trigger / Selected Card */}
                                        {!formData.paket_soal_id ? (
                                            <div
                                                onClick={() => {
                                                    setPackageSearch('');
                                                    setIsPickerModalOpen(true);
                                                }}
                                                className="group cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center transition-all hover:border-emerald-500 hover:bg-emerald-50/40 active:scale-[0.99] flex flex-col items-center justify-center gap-2"
                                            >
                                                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 mb-1 group-hover:scale-105 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                                    <BookMarked size={20} />
                                                </div>
                                                <p className="text-xs font-bold text-slate-700 group-hover:text-emerald-800 transition-colors">
                                                    Pilih Paket dari Bank Soal
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                                        <CheckCircle size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded-full">
                                                                Paket Terhubung
                                                            </span>
                                                            <p className="truncate text-sm font-black text-slate-800">
                                                                {selectedPackageObj?.judul ?? selectedPackageObj?.title ?? formData.judul}
                                                            </p>
                                                        </div>
                                                        <p className="text-xs text-slate-600 mt-0.5">
                                                            Mapel: <strong>{selectedPackageObj?.subject ?? selectedPackageObj?.mapel ?? '—'}</strong>
                                                            {' · '}{selectedPackageObj?.soals_count ?? selectedPackageObj?.jumlah_soal ?? 0} Butir Soal
                                                            {' · '}{selectedPackageObj?.class_name ?? selectedPackageObj?.kelas ?? 'Semua Kelas'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsPickerModalOpen(true)}
                                                    className="shrink-0 ml-3 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-sm"
                                                >
                                                    Ganti Paket
                                                </button>
                                            </div>
                                        )}

                                        {/* Auto-filled Judul Tugas */}
                                        <InputField label="Judul Kuis / Penugasan" required>
                                            <input
                                                type="text"
                                                name="judul"
                                                value={formData.judul}
                                                onChange={handleFormChange}
                                                required
                                                placeholder={formData.paket_soal_id ? "Judul otomatis dari paket soal..." : "Pilih paket soal terlebih dahulu"}
                                                className={inputCls}
                                            />
                                        </InputField>

                                        {/* Kelas & Mapel (Auto-matched) */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <InputField label="Kelas Tujuan" required>
                                                <select
                                                    name="school_class_id"
                                                    value={formData.school_class_id}
                                                    onChange={handleFormChange}
                                                    required
                                                    className={inputCls}
                                                >
                                                    <option value="">— Pilih Kelas Tujuan —</option>
                                                    {kelasData.map(k => (
                                                        <option key={k.id} value={k.id}>{k.nama_kelas ?? k.name ?? k.nama}</option>
                                                    ))}
                                                </select>
                                            </InputField>
                                            <InputField label="Mata Pelajaran" required>
                                                <select
                                                    name="subject_id"
                                                    value={formData.subject_id}
                                                    onChange={handleFormChange}
                                                    disabled={!formData.school_class_id}
                                                    required
                                                    className={`${inputCls} ${!formData.school_class_id ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                                                >
                                                    <option value="">
                                                        {!formData.school_class_id ? '— Pilih Kelas Terlebih Dahulu —' : '— Pilih Mata Pelajaran —'}
                                                    </option>
                                                    {formAvailableSubjects.map(m => (
                                                        <option key={m.id} value={m.id}>{m.nama_mapel ?? m.name ?? m.nama}</option>
                                                    ))}
                                                </select>
                                            </InputField>
                                        </div>

                                        {/* Waktu Mulai & Tenggat Waktu */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <InputField label="Waktu Mulai" required>
                                                <input
                                                    type="datetime-local"
                                                    name="starts_at"
                                                    value={formData.starts_at}
                                                    onChange={handleFormChange}
                                                    required
                                                    className={inputCls}
                                                />
                                            </InputField>
                                            <InputField label="Tenggat Waktu (Deadline)" required>
                                                <input
                                                    type="datetime-local"
                                                    name="deadline"
                                                    value={formData.deadline}
                                                    onChange={handleFormChange}
                                                    required
                                                    className={inputCls}
                                                />
                                            </InputField>
                                        </div>

                                        {/* Durasi & Bobot */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <InputField label="Durasi Pengerjaan (menit)" required>
                                                <input
                                                    type="number"
                                                    name="duration_minutes"
                                                    value={formData.duration_minutes}
                                                    onChange={handleFormChange}
                                                    min={1}
                                                    required
                                                    placeholder="Contoh: 60"
                                                    className={inputCls}
                                                />
                                                {windowError && <p className="mt-1 text-xs font-bold text-rose-600">{windowError}</p>}
                                            </InputField>
                                            <InputField label="Bobot Nilai (%)">
                                                <input
                                                    type="number"
                                                    name="bobot"
                                                    value={formData.bobot}
                                                    onChange={handleFormChange}
                                                    min={0}
                                                    max={100}
                                                    className={inputCls}
                                                />
                                            </InputField>
                                        </div>

                                        {/* Pengaturan dinamis sesuai format paket Bank Soal terpilih */}
                                        {selectedPackageObj && (bankPackageIsEsai ? (
                                            <div className="space-y-2.5">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                    <FlagToggle checked={formData.izinkan_ketik} onChange={(v) => setFormData(p => ({ ...p, izinkan_ketik: v }))} label="Izinkan Jawaban Ketik Teks" />
                                                    <FlagToggle checked={formData.izinkan_upload_foto} onChange={(v) => setFormData(p => ({ ...p, izinkan_upload_foto: v }))} label="Izinkan Upload File Jawaban" hint="Murid dapat mengunggah PDF, Word (.doc/.docx), atau Foto (.jpg/.jpeg) maks. 10 MB" />
                                                </div>
                                                {!formData.izinkan_ketik && !formData.izinkan_upload_foto && (
                                                    <p className="text-xs font-bold text-rose-600">Minimal salah satu metode jawaban harus aktif.</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                <FlagToggle checked={formData.acak_soal} onChange={(v) => setFormData(p => ({ ...p, acak_soal: v }))} label="Acak Urutan Soal" hint="Urutan soal berbeda tiap murid" />
                                                <FlagToggle checked={formData.tampilkan_nilai} onChange={(v) => setFormData(p => ({ ...p, tampilkan_nilai: v }))} label="Tampilkan Nilai & Peringkat ke Murid" hint="Skor + trofi muncul setelah selesai" />
                                            </div>
                                        ))}

                                        <InputField label="Deskripsi &amp; Instruksi Tugas">
                                            <textarea name="deskripsi" value={formData.deskripsi} onChange={handleFormChange} rows={3}
                                                placeholder="Instruksi/pesan untuk murid (tampil di layar instruksi sebelum mengerjakan)." className={inputCls + ' resize-none'} />
                                        </InputField>

                                        {/* ── Token Akses Kuis (6 Karakter) — tab Sumber Bank Soal ── */}
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white"><KeyRound size={15} /></span>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800">Token Akses Kuis</p>
                                                    <p className="text-[11px] text-slate-500">6 karakter huruf kapital &amp; angka. Murid memasukkannya di menu <strong>Masuk Ruang Ujian</strong>.</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={formData.token_akses}
                                                    onChange={e => setFormData(p => ({ ...p, token_akses: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) }))}
                                                    maxLength={6}
                                                    placeholder="Kosongkan → otomatis saat simpan"
                                                    className="w-40 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-center text-lg font-black uppercase tracking-[0.25em] text-slate-800 placeholder:text-[11px] placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                                                />
                                                <button type="button" onClick={handleGenerateToken} disabled={!bankRequiredComplete || generatingToken || !!windowError}
                                                    title={bankRequiredComplete ? 'Buat kode 6 karakter unik' : 'Lengkapi paket, judul, kelas, mapel & tenggat terlebih dahulu'}
                                                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-200 hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 transition-all">
                                                    {generatingToken ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />} Generate Token
                                                </button>
                                                {formData.token_akses && (
                                                    <button type="button" onClick={copyFormToken}
                                                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                                                        <Copy size={14} /> Salin
                                                    </button>
                                                )}
                                            </div>
                                            {!bankRequiredComplete && (
                                                <p className="text-[11px] font-semibold text-amber-600">Pilih paket &amp; isi Judul, Kelas, Mapel, Tenggat untuk mengaktifkan Generate Token.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ──────────────────────────────────────────────────────────
                                    MODE 2: BUAT SOAL MANUAL — pilih format (CBT .docx / Esai .pdf)
                                ────────────────────────────────────────────────────────── */}
                                {createMode === 'manual' && (
                                    <div className="space-y-4">
                                        <SectionLabel>Pilih Format Soal</SectionLabel>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <FormatRadio
                                                active={manualFormat === 'cbt_docx'}
                                                onClick={() => { setManualFormat('cbt_docx'); setFormData(p => ({ ...p, docx_file: null, pdf_file: null })); }}
                                                label="Tugas Pilihan Ganda (CBT Test)"
                                            />
                                            <FormatRadio
                                                active={manualFormat === 'esai_pdf'}
                                                onClick={() => { setManualFormat('esai_pdf'); setFormData(p => ({ ...p, docx_file: null, pdf_file: null })); }}
                                                label="Tugas Esai"
                                            />
                                        </div>

                                        <InputField label="Judul Kuis / Tugas" required>
                                            <input type="text" name="judul" value={formData.judul} onChange={handleFormChange} required
                                                placeholder="Contoh: Kuis CBT Bab 4" className={inputCls} />
                                        </InputField>

                                        <div className="grid grid-cols-2 gap-3">
                                            <InputField label="Kelas Tujuan" required>
                                                <select name="school_class_id" value={formData.school_class_id} onChange={handleFormChange} required className={inputCls}>
                                                    <option value="">— Pilih Kelas Tujuan —</option>
                                                    {kelasData.map(k => (<option key={k.id} value={k.id}>{k.nama_kelas ?? k.name ?? k.nama}</option>))}
                                                </select>
                                            </InputField>
                                            <InputField label="Mata Pelajaran" required>
                                                <select name="subject_id" value={formData.subject_id} onChange={handleFormChange} disabled={!formData.school_class_id} required
                                                    className={`${inputCls} ${!formData.school_class_id ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}>
                                                    <option value="">{!formData.school_class_id ? '— Pilih Kelas Terlebih Dahulu —' : '— Pilih Mata Pelajaran —'}</option>
                                                    {formAvailableSubjects.map(m => (<option key={m.id} value={m.id}>{m.nama_mapel ?? m.name ?? m.nama}</option>))}
                                                </select>
                                            </InputField>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <InputField label="Waktu Mulai" required>
                                                <input type="datetime-local" name="starts_at" value={formData.starts_at} onChange={handleFormChange} required className={inputCls} />
                                            </InputField>
                                            <InputField label="Tenggat Waktu (Deadline)" required>
                                                <input type="datetime-local" name="deadline" value={formData.deadline} onChange={handleFormChange} required className={inputCls} />
                                            </InputField>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <InputField label="Durasi Pengerjaan (menit)" required>
                                                <input type="number" name="duration_minutes" value={formData.duration_minutes} onChange={handleFormChange} min={1} required placeholder="Contoh: 30" className={inputCls} />
                                                {windowError && <p className="mt-1 text-xs font-bold text-rose-600">{windowError}</p>}
                                            </InputField>
                                            <InputField label="Bobot Nilai (%)">
                                                <input type="number" name="bobot" value={formData.bobot} onChange={handleFormChange} min={0} max={100} className={inputCls} />
                                            </InputField>
                                        </div>

                                        {/* Upload file soal sesuai format */}
                                        {(() => {
                                            const isDocx = manualFormat === 'cbt_docx';
                                            const fileField = isDocx ? 'docx_file' : 'pdf_file';
                                            const picked = formData[fileField];
                                            return (
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                                        {isDocx ? 'File Soal Pilihan Ganda (.docx)' : 'Lembar Soal (.pdf)'} <span className="text-red-500">*</span>
                                                    </label>
                                                    <input ref={fileInputRef} type="file" name={fileField} accept={isDocx ? '.docx' : '.pdf'} className="hidden" onChange={handleFormChange} />
                                                    {!picked ? (
                                                        <div onClick={() => fileInputRef.current?.click()}
                                                            className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center transition-all hover:border-emerald-500 hover:bg-emerald-50/40">
                                                            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 mb-2"><Upload size={20} /></div>
                                                            <p className="text-xs font-bold text-slate-700">Klik untuk pilih file <span className="font-normal text-slate-500">{isDocx ? '.docx' : '.pdf'}</span></p>
                                                            <p className="text-[11px] text-slate-400 mt-1">{isDocx ? 'Format soal: nomor + opsi A–E + "Kunci: X". Maks. 20MB.' : 'PDF lembar soal esai. Maks. 20MB.'}</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-sm">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><FileText size={18} /></div>
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-xs font-bold text-slate-900" title={picked.name}>{picked.name}</p>
                                                                    <p className="text-[11px] text-slate-500 mt-0.5">{formatFileSize(picked.size)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                                                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">Ganti</button>
                                                                <button type="button" onClick={() => setFormData(p => ({ ...p, [fileField]: null }))} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Hapus File"><Trash2 size={15} /></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Sakelar sesuai format */}
                                        {manualFormat === 'cbt_docx' ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                <FlagToggle checked={formData.acak_soal} onChange={(v) => setFormData(p => ({ ...p, acak_soal: v }))} label="Acak Urutan Soal" hint="Urutan soal berbeda tiap murid" />
                                                <FlagToggle checked={formData.tampilkan_nilai} onChange={(v) => setFormData(p => ({ ...p, tampilkan_nilai: v }))} label="Tampilkan Nilai & Peringkat ke Murid" hint="Skor + trofi muncul setelah selesai" />
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                    <FlagToggle checked={formData.izinkan_ketik} onChange={(v) => setFormData(p => ({ ...p, izinkan_ketik: v }))} label="Izinkan Jawaban Ketik Teks" />
                                                    <FlagToggle checked={formData.izinkan_upload_foto} onChange={(v) => setFormData(p => ({ ...p, izinkan_upload_foto: v }))} label="Izinkan Upload File Jawaban" hint="Murid dapat mengunggah PDF, Word (.doc/.docx), atau Foto (.jpg/.jpeg) maks. 10 MB" />
                                                </div>
                                                {!formData.izinkan_ketik && !formData.izinkan_upload_foto && (
                                                    <p className="text-xs font-bold text-rose-600">Minimal salah satu metode jawaban harus aktif.</p>
                                                )}
                                            </div>
                                        )}

                                        <InputField label="Deskripsi &amp; Instruksi Tugas">
                                            <textarea name="deskripsi" value={formData.deskripsi} onChange={handleFormChange} rows={3}
                                                placeholder="Instruksi/pesan untuk murid (tampil di layar instruksi sebelum mengerjakan)." className={inputCls + ' resize-none'} />
                                        </InputField>

                                        {/* ── Token Akses Kuis (6 Karakter) — muncul khusus mode manual ── */}
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white"><KeyRound size={15} /></span>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800">Token Akses Kuis</p>
                                                    <p className="text-[11px] text-slate-500">6 karakter huruf kapital &amp; angka. Murid memasukkannya di menu <strong>Masuk Ruang Ujian</strong>.</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={formData.token_akses}
                                                    onChange={e => setFormData(p => ({ ...p, token_akses: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) }))}
                                                    maxLength={6}
                                                    placeholder="Kosongkan → otomatis saat terbit"
                                                    className="w-40 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-center text-lg font-black uppercase tracking-[0.25em] text-slate-800 placeholder:text-[11px] placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                                                />
                                                <button type="button" onClick={handleGenerateToken} disabled={!manualRequiredComplete || generatingToken || !!windowError}
                                                    title={manualRequiredComplete ? 'Buat kode 6 karakter unik' : 'Lengkapi semua kolom wajib (*) terlebih dahulu'}
                                                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-200 hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 transition-all">
                                                    {generatingToken ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />} Generate Token
                                                </button>
                                                {formData.token_akses && (
                                                    <button type="button" onClick={copyFormToken}
                                                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                                                        <Copy size={14} /> Salin
                                                    </button>
                                                )}
                                            </div>
                                            {!manualRequiredComplete && (
                                                <p className="text-[11px] font-semibold text-amber-600">Isi Judul, Kelas, Mapel, Tenggat &amp; file soal untuk mengaktifkan Generate Token.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                            </form>

                            {/* Modal Footer — bar bawah TETAP (di luar area scroll, konten tak bisa nembus) */}
                            <div className="shrink-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    form="createTaskForm"
                                    disabled={submitting || (createMode === 'bank_soal' && !formData.paket_soal_id) || (createMode === 'manual' && manualFormat === 'cbt_docx' && !formData.docx_file) || (createMode === 'manual' && manualFormat === 'esai_pdf' && (!formData.pdf_file || (!formData.izinkan_ketik && !formData.izinkan_upload_foto))) || !!windowError}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-200 hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all"
                                >
                                    {submitting ? (
                                        <><RefreshCw size={14} className="animate-spin" /> Mempublikasikan...</>
                                    ) : (
                                        'Simpan'
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* ── MODAL POP-UP TERPISAH: DAFTAR PAKET SOAL (BANK SOAL) ─ */}
                {isPickerModalOpen && (
                    <div className={backdropClass}>
                        <motion.div {...modalVariants} onClick={e => e.stopPropagation()}
                            className="my-auto w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">

                            <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                                        <BookMarked size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black text-slate-900">Pilih Paket Bank Soal</h4>
                                        <p className="text-xs text-slate-400">Pilih salah satu paket soal yang ingin dijadikan kuis harian</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsPickerModalOpen(false)}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Search bar in picker */}
                            <div className="shrink-0 p-4 border-b border-slate-100 bg-slate-50/50">
                                <div className="relative">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Cari judul paket soal atau mapel..."
                                        value={packageSearch}
                                        onChange={e => setPackageSearch(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition"
                                    />
                                </div>
                            </div>

                            {/* List of packages */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
                                {filteredBankPackages.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400">
                                        <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-xs font-semibold text-slate-600">Tidak ada paket untuk kombinasi ini</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Hanya paket milik Anda sendiri yang cocok Kelas &amp; Mapel terpilih yang tampil. Buat paketnya dulu di menu Bank Soal.</p>
                                    </div>
                                ) : (
                                    filteredBankPackages.map(pkg => {
                                        const isSelected = String(formData.paket_soal_id) === String(pkg.id);
                                        return (
                                            <div
                                                key={pkg.id}
                                                className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
                                                    isSelected 
                                                        ? 'border-emerald-500 bg-emerald-50/70 shadow-sm' 
                                                        : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50/60'
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1 pr-3">
                                                    <p className="truncate text-sm font-black text-slate-800">
                                                        {pkg.judul ?? pkg.title}
                                                        <span className="ml-1 font-black text-slate-400">{isEsaiPackage(pkg) ? '— [Esai]' : '— [Pilihan Ganda]'}</span>
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${pkg.question_format === 'esai' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                                                            {isEsaiPackage(pkg) ? 'Esai PDF' : 'Pilihan Ganda'}
                                                        </span>
                                                        <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                                            {pkg.mapel ?? pkg.subject ?? 'Mapel'}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {pkg.kelas ?? pkg.school_class?.name ?? pkg.class_name ?? 'Semua Kelas'}
                                                        </span>
                                                        {!isEsaiPackage(pkg) && (
                                                            <>
                                                                <span className="text-xs text-slate-400">·</span>
                                                                <span className="text-xs font-bold text-emerald-600">
                                                                    {pkg.soals_count ?? pkg.jumlah_soal ?? pkg.questions_count ?? 0} Butir Soal
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectPackageFromModal(pkg)}
                                                    className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition active:scale-95 ${
                                                        isSelected
                                                            ? 'bg-emerald-500 text-white shadow-sm'
                                                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-100'
                                                    }`}
                                                >
                                                    {isSelected ? <><Check size={13} /> Terpilih</> : 'Gunakan Paket Ini'}
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="border-t border-slate-100 px-6 py-3 bg-slate-50/60 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsPickerModalOpen(false)}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                                >
                                    Tutup
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* ── MODAL 2: EDIT TUGAS ────────────────────────────── */}
                {isEditOpen && selectedTugas && (
                    <div className={backdropClass}>
                        <motion.div {...modalVariants} onClick={e => e.stopPropagation()}
                            className="my-auto w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">

                            <div className="shrink-0 bg-gradient-to-r from-green-700 to-emerald-600 p-6 text-white flex items-center justify-between">
                                <h4 className="font-black uppercase tracking-widest text-sm text-white">
                                    Edit Tugas
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-black tracking-wider text-emerald-100">Esc</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditOpen(false)}
                                        aria-label="Tutup (Esc)"
                                        className="rounded-full p-2 text-white transition-all hover:bg-rose-500 hover:text-white"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            <form id="editTaskForm" onSubmit={handleEdit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                                {(() => {
                                    const isQuiz = ['cbt_docx', 'esai_pdf'].includes(selectedTugas?.mode_soal);
                                    const isEssay = selectedTugas?.mode_soal === 'esai_pdf';
                                    const lockedClass = (selectedTugas?.terkumpul ?? 0) > 0;
                                    return (
                                        <>
                                            {isQuiz && (
                                                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><FileText size={18} /></span>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-800">{isEssay ? 'Esai (Lembar PDF)' : 'Pilihan Ganda (CBT)'}</p>
                                                        <p className="text-[11px] text-slate-500">Format &amp; file soal tidak dapat diubah — buat kuis baru untuk menggantinya.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {lockedClass && (
                                                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                                    <span>Sudah ada <strong>{selectedTugas.terkumpul}</strong> siswa mengumpulkan. Kelas &amp; Mata Pelajaran terkunci demi konsistensi data.</span>
                                                </div>
                                            )}

                                            <InputField label="Judul Tugas" required>
                                                <input type="text" name="judul" value={formData.judul} onChange={handleFormChange} required className={inputCls} />
                                            </InputField>

                                            <div className="grid grid-cols-2 gap-3">
                                                <InputField label="Kelas Tujuan" required>
                                                    <select name="school_class_id" value={formData.school_class_id} onChange={handleFormChange} required disabled className={inputCls + ' opacity-60'}>
                                                        <option value="">— Pilih Kelas —</option>
                                                        {kelasData.map(k => <option key={k.id} value={k.id}>{k.nama_kelas ?? k.name ?? k.nama}</option>)}
                                                    </select>
                                                </InputField>
                                                <InputField label="Mata Pelajaran" required>
                                                    <select name="subject_id" value={formData.subject_id} onChange={handleFormChange} required disabled className={inputCls + ' opacity-60'}>
                                                        <option value="">— Pilih Mapel —</option>
                                                        {formAvailableSubjects.map(m => <option key={m.id} value={m.id}>{m.nama_mapel ?? m.name ?? m.nama}</option>)}
                                                    </select>
                                                </InputField>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <InputField label="Waktu Mulai" required>
                                                    <input type="datetime-local" name="starts_at" value={formData.starts_at} onChange={handleFormChange} required className={inputCls} />
                                                </InputField>
                                                <InputField label="Tenggat Waktu (Deadline)" required>
                                                    <input type="datetime-local" name="deadline" value={formData.deadline} onChange={handleFormChange} required className={inputCls} />
                                                </InputField>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <InputField label="Durasi Pengerjaan (menit)" required>
                                                    <input type="number" name="duration_minutes" value={formData.duration_minutes} onChange={handleFormChange} min={1} required placeholder="Contoh: 30" className={inputCls} />
                                                {windowError && <p className="mt-1 text-xs font-bold text-rose-600">{windowError}</p>}
                                                </InputField>
                                                <InputField label="Bobot Nilai (%)">
                                                    <input type="number" name="bobot" value={formData.bobot} onChange={handleFormChange} min={0} max={100} className={inputCls} />
                                                </InputField>
                                            </div>

                                            {isQuiz && (isEssay ? (
                                                <div className="space-y-2.5">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                        <FlagToggle checked={formData.izinkan_ketik} onChange={(v) => setFormData(p => ({ ...p, izinkan_ketik: v }))} label="Izinkan Jawaban Ketik Teks" />
                                                        <FlagToggle checked={formData.izinkan_upload_foto} onChange={(v) => setFormData(p => ({ ...p, izinkan_upload_foto: v }))} label="Izinkan Upload File Jawaban" hint="Murid dapat mengunggah PDF, Word (.doc/.docx), atau Foto (.jpg/.jpeg) maks. 10 MB" />
                                                    </div>
                                                    {!formData.izinkan_ketik && !formData.izinkan_upload_foto && (
                                                        <p className="text-xs font-bold text-rose-600">Minimal salah satu metode jawaban harus aktif.</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                    <FlagToggle checked={formData.acak_soal} onChange={(v) => setFormData(p => ({ ...p, acak_soal: v }))} label="Acak Urutan Soal" hint="Urutan soal berbeda tiap murid" />
                                                    <FlagToggle checked={formData.tampilkan_nilai} onChange={(v) => setFormData(p => ({ ...p, tampilkan_nilai: v }))} label="Tampilkan Nilai & Peringkat ke Murid" hint="Skor + trofi muncul setelah selesai" />
                                                </div>
                                            ))}

                                            <InputField label="Deskripsi Tugas">
                                                <textarea name="deskripsi" value={formData.deskripsi} onChange={handleFormChange} rows={3} className={inputCls + ' resize-none'} />
                                            </InputField>

                                            {isQuiz && (
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white"><KeyRound size={15} /></span>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-800">Token Akses Kuis</p>
                                                            <p className="text-[11px] text-slate-500">Murid memasukkannya di menu Masuk Ruang Ujian.</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="w-40 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-center text-lg font-black uppercase tracking-[0.25em] text-slate-800">{selectedTugas.token_akses || '—'}</span>
                                                        {selectedTugas.token_akses && (
                                                            <button type="button" onClick={copyEditToken} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                                                                <Copy size={14} /> Salin
                                                            </button>
                                                        )}
                                                        <button type="button" onClick={handleRegenerateEditToken} disabled={regeneratingEditToken}
                                                            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-200 hover:opacity-95 active:scale-95 disabled:opacity-50 transition-all">
                                                            {regeneratingEditToken ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />} Generate Ulang Token
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {isQuiz && (() => {
                                                const locked = (selectedTugas?.terkumpul ?? 0) > 0;
                                                const field = isEssay ? 'pdf_file' : 'docx_file';
                                                const newFile = formData[field];
                                                const accept = isEssay ? '.pdf' : '.docx';
                                                return (
                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white"><FileText size={15} /></span>
                                                            <p className="text-sm font-black text-slate-800">File Soal ({isEssay ? '.pdf' : '.docx'})</p>
                                                        </div>
                                                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                            <span className="text-xs font-semibold text-slate-600">
                                                                {isEssay
                                                                    ? (selectedTugas.file_soal_pdf ? 'Lembar soal (.pdf) tersimpan' : 'Belum ada file PDF tersimpan')
                                                                    : 'Soal (.docx) tersimpan & sudah di-parse jadi butir soal'}
                                                            </span>
                                                            {isEssay && selectedTugas.file_soal_pdf && (
                                                                <a href={`${BASE_URL}/storage/${selectedTugas.file_soal_pdf}`} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-bold text-emerald-700 hover:underline">Lihat</a>
                                                            )}
                                                        </div>
                                                        {locked ? (
                                                            <p className="text-[11px] font-bold text-amber-600">Sudah ada pengumpulan siswa — file soal terkunci, tidak dapat diperbarui.</p>
                                                        ) : (
                                                            <>
                                                                <input
                                                                    type="file" accept={accept}
                                                                    onChange={(e) => setFormData(p => ({ ...p, [field]: e.target.files?.[0] || null }))}
                                                                    className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-700 hover:file:bg-emerald-200"
                                                                />
                                                                {newFile ? (
                                                                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                                                                        <span className="truncate text-xs font-bold text-slate-700">{newFile.name} · {formatFileSize(newFile.size)}</span>
                                                                        <button type="button" onClick={() => setFormData(p => ({ ...p, [field]: null }))} className="shrink-0 text-xs font-bold text-rose-600 hover:underline">Hapus</button>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-[11px] text-slate-400">Kosongkan untuk mempertahankan soal yang ada. Hanya file {accept} yang diterima.</p>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    );
                                })()}
                            </form>

                            {/* Modal Footer — bar bawah TETAP (di luar area scroll) */}
                            <div className="shrink-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsEditOpen(false)}
                                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">
                                    Batal
                                </button>
                                <button type="submit" form="editTaskForm" disabled={submitting || !!windowError}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-200 hover:from-green-600 hover:to-emerald-700 active:scale-95 transition">
                                    {submitting ? <><RefreshCw size={14} className="animate-spin" /> Menyimpan...</> : 'Simpan'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* ── MODAL 5: HAPUS TUGAS ────────────────────────────── */}
                {isDeleteOpen && selectedTugas && (
                    <div className={backdropClass}>
                        <motion.div {...modalVariants} onClick={e => e.stopPropagation()}
                            className="my-auto w-full max-w-sm rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
                            <div className="p-7 text-center space-y-4">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-200">
                                    <Trash2 size={28} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Hapus Tugas?</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Anda akan menghapus tugas <strong className="text-slate-700">"{selectedTugas.judul ?? selectedTugas.title}"</strong> secara permanen.
                                    </p>
                                </div>
                                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-left text-xs text-red-600">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                    Semua pengumpulan &amp; nilai siswa yang terkait akan ikut terhapus dan tidak dapat dipulihkan.
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setIsDeleteOpen(false)}
                                        className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                        Batal
                                    </button>
                                    <button onClick={handleDelete} disabled={deleting}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 py-2.5 text-sm font-black text-white shadow-md shadow-red-200 hover:opacity-90 disabled:opacity-60 active:scale-95 transition-all">
                                        {deleting ? <><RefreshCw size={14} className="animate-spin" /> Menghapus...</> : 'Ya, Hapus'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                </AnimatePresence>,
                document.body
            )}

            {/* Modal terpadu Detail + Pantau + Penilaian (pintu ikon Mata) */}
            <TugasDetailUnifiedModal open={!!unifiedTask} task={unifiedTask} onClose={() => setUnifiedTask(null)} onGraded={() => fetchTugas(pagination.current)} />
        </div>
    );
}
