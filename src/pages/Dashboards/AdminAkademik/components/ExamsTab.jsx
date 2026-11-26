import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, FileSpreadsheet, Printer, Users,
  RotateCcw, ChevronRight, Eye, Image as ImageIcon, Settings,
  UploadCloud, FileText, Clock3, ShieldCheck, Check, Loader2, Search, Monitor, Star, MessageSquare,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { examAPI, examSessionAPI, operatorAPI } from '../../../../utils/api';
import StudentExamRunner from '../../Student/StudentExamRunner';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import useEscapeKey from '../../../../utils/useEscapeKey';


// ── TAB CONFIGURATION ──────────────────────────────────────────────────────────
const EXAM_TABS = [
  { id: 'simulasi',  label: 'Simulasi',            color: '#10B981', bgLight: '#f0fdf4', shadow: 'rgba(16,185,129,0.35)' },
  { id: 'uts',       label: 'UTS',                 color: '#10B981', bgLight: '#f0fdf4', shadow: 'rgba(16,185,129,0.35)' },
  { id: 'uas',       label: 'UAS',                 color: '#10B981', bgLight: '#f0fdf4', shadow: 'rgba(16,185,129,0.35)' },
  { id: 'praktek',   label: 'Ujian Praktek',       color: '#10B981', bgLight: '#f0fdf4', shadow: 'rgba(16,185,129,0.35)' },
  { id: 'usp',       label: 'Ujian Satuan Pendidikan', color: '#10B981', bgLight: '#f0fdf4', shadow: 'rgba(16,185,129,0.35)' },
  { id: 'remedial',  label: 'Susulan / Remedial',  color: '#10B981', bgLight: '#f0fdf4', shadow: 'rgba(16,185,129,0.35)' },
  { id: 'monitor',   label: 'Monitor Peserta',      color: '#4F46E5', bgLight: '#eef2ff', shadow: 'rgba(79,70,229,0.35)' },
  { id: 'pengaturan',label: 'Pengaturan Sesi',         color: '#1F2937', bgLight: '#f8fafc', shadow: 'rgba(31,41,55,0.35)'  },
];

const INITIAL_SESSIONS = { simulasi: [], uts: [], uas: [], praktek: [], usp: [], remedial: [] };

// ── Pengaturan Ujian (konfigurasi nyata, tersimpan ke system_settings) ──
const Switch = ({ on, onChange }) => (
  <button type="button" onClick={() => onChange(!on)} aria-pressed={on}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const EXAM_SETTING_ROWS = [
  { key: 'idle', icon: Clock3, title: 'Batas Waktu Inaktif (Auto-Logout)', desc: 'Peserta tidak melakukan aksi (klik/ganti soal) hingga melewati batas waktu → sistem menyimpan jawaban terakhir lalu keluar otomatis.', enabled: 'idle_enabled', num: 'idle_minutes', numLabel: 'Menit', min: 1, max: 120 },
  { key: 'tab', icon: Eye, title: 'Deteksi Pindah Tab (Anti-Cheat)', desc: 'Pindah tab/jendela dicatat sebagai potensi kecurangan dengan batas toleransi tertentu.', enabled: 'tabdetect_enabled', num: 'tab_tolerance', numLabel: 'Maksimal pindah tab', min: 0, max: 20 },
  { key: 'manual', icon: ShieldCheck, title: 'Kunci Akses Keluar Manual', desc: 'Wajib persetujuan Admin ("Izinkan Masuk Kembali") bila peserta keluar saat ujian sedang berlangsung.', enabled: 'manual_reentry_enabled' },
  { key: 'offline', icon: UploadCloud, title: 'Mode Toleransi Koneksi Putus', desc: 'Simpan jawaban sementara di penyimpanan lokal browser, otomatis tersinkron kembali ke server saat koneksi daring pulih.', enabled: 'offline_local_enabled' },
  { key: 'recovery', icon: RotateCcw, title: 'Pemulihan Sesi & Gangguan Perangkat', desc: 'Pemulihan otomatis posisi soal terakhir dan sisa waktu dari server saat perangkat peserta bermasalah (ngelag/crash).', enabled: 'session_recovery_enabled' },
];

const INITIAL_FORM = {
  paketSoalId: '', target: '', targetClassIds: [], tingkat: '', mapel: '', mulai: '', selesai: '', durasi: '',
  show_score: true, shuffle_questions: true, subject: '', title: '', question_format: 'pilihan_ganda', exam_code: '',
};

const toLocalDateTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const normalizeExamSession = (session) => ({
  ...session,
  id: String(session.id),
  status: session.status === 'active' ? 'berlangsung' : session.status === 'completed' ? 'selesai' : 'draft',
  type: session.exam_type || session.type,
  tanggal: session.tanggal || (session.start_time ? session.start_time.slice(0, 10) : ''),
  waktuMulai: session.waktuMulai || (session.start_time ? session.start_time.slice(11, 16) : ''),
  waktuSelesai: session.end_time ? session.end_time.slice(11, 16) : '',
  durasi: session.duration_minutes || session.durasi,
  target: session.target || session.school_class?.name || '',
  nama: session.nama || session.package?.title || 'Sesi Ujian',
  mapel: session.mapel || session.package?.subject || '-',
});

const mapPackageQuestions = (questions = []) => questions.map((question, index) => ({
  no: question.nomor_urut || index + 1,
  teks: question.pertanyaan || question.teks || '',
  kunci: question.kunci_jawaban || question.kunci || '-',
  pilihan: {
    A: question.opsi?.find((option) => option.key === 'A')?.label || question.opsi_a || '-',
    B: question.opsi?.find((option) => option.key === 'B')?.label || question.opsi_b || '-',
    C: question.opsi?.find((option) => option.key === 'C')?.label || question.opsi_c || '-',
    D: question.opsi?.find((option) => option.key === 'D')?.label || question.opsi_d || '-',
    E: question.opsi?.find((option) => option.key === 'E')?.label || question.opsi_e || '-',
  },
  gambar: question.image_url || question.gambar || null,
  pilihan_gambar: question.pilihan_gambar || {},
}));

// ── DATA HELPERS ───────────────────────────────────────────────────────────────

// ── HELPER ─────────────────────────────────────────────────────────────────────
const getStatusBadge = (status) => ({
  draft:        { label: 'Draft',               bg: '#F1F5F9', text: '#64748B', pulse: false },
  berlangsung:  { label: 'Sedang Berlangsung',  bg: '#DCFCE7', text: '#15803D', pulse: true  },
  selesai:      { label: 'Selesai',             bg: '#1E293B', text: '#FFFFFF', pulse: false },
  berhenti:     { label: 'Berhenti',            bg: '#FEE2E2', text: '#B91C1C', pulse: false },
})[status] || { label: 'Draft', bg: '#F1F5F9', text: '#64748B', pulse: false };

const getGradeStyle = (grade) => ({
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-blue-100   text-blue-700',
  C: 'bg-amber-100  text-amber-700',
  D: 'bg-red-100    text-red-600',
})[grade] || 'bg-slate-100 text-slate-600';

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const getSessionQuestions = (session = {}) => {
  const questions = Array.isArray(session.questions) ? session.questions : [];

  return questions.map((question, index) => ({
    no: Number(question.no) || index + 1,
    teks: question.teks || question.text || 'Teks soal kosong',
    kunci: question.kunci || question.answer || 'A',
    pilihan: question.pilihan || question.options || { A: '-', B: '-', C: '-', D: '-' },
    pilihan_gambar: question.pilihan_gambar || {},
    gambar: question.image_url || question.gambar || question.image || null,
  }));
};

// ── FORM INPUT COMPONENT ───────────────────────────────────────────────────────
const FI = ({ label, ...props }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input
      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all"
      {...props}
    />
  </div>
);

const SearchableSelect = ({ label, options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const selectedLabel = options.find(o => String(o.value) === String(value))?.label || '';

  return (
    <div className="space-y-2 relative" ref={wrapperRef}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <div 
        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm cursor-pointer transition-all flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedLabel ? 'text-slate-800' : 'text-slate-400'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronRight size={16} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-3 border-b border-slate-100">
              <input 
                autoFocus
                type="text" 
                className="w-full p-3 bg-slate-50 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Cari..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-52 overflow-y-auto p-2">
              {filtered.length > 0 ? filtered.map(opt => (
                <div 
                  key={opt.value}
                  aria-disabled={opt.disabled ? 'true' : undefined}
                  className={`p-3 rounded-xl text-sm font-medium transition-colors ${opt.disabled ? 'cursor-not-allowed bg-slate-50 text-slate-300' : `cursor-pointer ${String(value) === String(opt.value) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}`}
                  onClick={() => { if (opt.disabled) return; onChange(opt.value); setIsOpen(false); setSearch(''); }}
                >
                  {opt.label}
                </div>
              )) : (
                <div className="p-4 text-center text-slate-400 text-sm">Tidak ditemukan</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const ExamsTab = ({ questionBank = [], studentsList = [], loading, onSync }) => {

  const [activeExamTab, setActiveExamTab] = useState('simulasi');
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Pengaturan Ujian (tab gerigi) — konfigurasi nyata dari system_settings.
  const [examSettings, setExamSettings] = useState(null);
  const [examSettingsLoading, setExamSettingsLoading] = useState(false);
  const [examSettingsSaving, setExamSettingsSaving] = useState(false);

  const loadExamSettings = useCallback(async () => {
    setExamSettingsLoading(true);
    try {
      const { data } = await operatorAPI.getExamSettings();
      setExamSettings(data?.data || null);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Gagal memuat pengaturan ujian.');
    } finally {
      setExamSettingsLoading(false);
    }
  }, []);

  const saveExamSettings = async () => {
    if (!examSettings) return;
    setExamSettingsSaving(true);
    try {
      const payload = {
        idle_enabled: !!examSettings.idle_enabled,
        idle_minutes: Number(examSettings.idle_minutes) || 0,
        tabdetect_enabled: !!examSettings.tabdetect_enabled,
        tab_tolerance: Number(examSettings.tab_tolerance) || 0,
        manual_reentry_enabled: !!examSettings.manual_reentry_enabled,
        offline_local_enabled: !!examSettings.offline_local_enabled,
        session_recovery_enabled: !!examSettings.session_recovery_enabled,
      };
      const { data } = await operatorAPI.saveExamSettings(payload);
      toast.success(data?.message || 'Pengaturan ujian tersimpan.');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Gagal menyimpan pengaturan ujian.');
    } finally {
      setExamSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (activeExamTab === 'pengaturan' && !examSettings && !examSettingsLoading) loadExamSettings();
  }, [activeExamTab, examSettings, examSettingsLoading, loadExamSettings]);
  const [savingSession, setSavingSession] = useState(false);

  const refreshSessions = async (quiet = false) => {
    if (!quiet) setSessionsLoading(true);
    try {
      const response = await examSessionAPI.getAll();
      const grouped = { ...INITIAL_SESSIONS };
      (response.data?.data || []).map(normalizeExamSession).forEach((session) => {
        const key = grouped[session.type] ? session.type : null;
        if (!key) return;
        grouped[key] = [...grouped[key], session];
      });
      setSessions(grouped);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal memuat sesi ujian dari server.');
    } finally {
      if (!quiet) setSessionsLoading(false);
    }
  };

  useEffect(() => {
    refreshSessions();
    const timer = window.setInterval(() => refreshSessions(true), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // modal states
  const [createModal,  setCreateModal]  = useState(false);
  const [editingItem,  setEditingItem]  = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { type:'start'|'stop', session }
  const [monitorModal, setMonitorModal] = useState(null);
  const [soalModal,    setSoalModal]    = useState(null);
  const [deleteConfirm,setDeleteConfirm]= useState(null);
  const [previewModal, setPreviewModal] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);
  const [sourceMode, setSourceMode] = useState('bank');
  const [classLevel, setClassLevel] = useState('');
  const [docxFile, setDocxFile] = useState(null);
  const [docxPreviewLoading, setDocxPreviewLoading] = useState(false);

  const [targetOptions, setTargetOptions] = useState([]);

  // Kelas ujian diambil dari master akademik server agar tersimpan memakai school_class_id.
  const refreshClassOptions = async () => {
    try {
      const response = await operatorAPI.getMasterData();
      const classes = response.data?.data?.kelas || [];
      setTargetOptions(classes.map((kelas) => ({
        value: String(kelas.id),
        label: `Kelas: ${kelas.nama}`,
        name: kelas.nama,
      })));
    } catch (err) {
      console.error('Gagal memuat kelas dari master data server', err);
    }
  };

  // Refresh when the selected exam category changes.
  useEffect(() => { refreshClassOptions(); }, [activeExamTab]);

  const [uploadedSoal, setUploadedSoal] = useState([]);
  const [docxPreviewError, setDocxPreviewError] = useState('');

  const activeTab       = EXAM_TABS.find(t => t.id === activeExamTab);
  const currentSessions = sessions[activeExamTab] || [];
  const sessionQuestions = soalModal ? getSessionQuestions(soalModal) : [];
  const previewQuestions = uploadedSoal;
  const filteredClassOptions = classLevel
    ? targetOptions.filter((item) => String(item.name || item.label).trim().split(/\s+/)[0].toUpperCase() === classLevel)
    : targetOptions;

  // Tombol Generate Token aktif hanya setelah semua syarat sesi terisi.
  const canGenerateToken = Boolean(
    (classLevel || (form.targetClassIds || []).length > 0) &&
    (sourceMode === 'bank'
      ? (form.paketSoalId && (form.mapel || '').trim())
      : (docxFile && (form.subject || '').trim())) &&
    (form.mulai || '').trim() &&
    (form.selesai || '').trim() &&
    Number(form.durasi) > 0
  );

  // Token sesi ujian: 2 huruf + '-' + 5 karakter alfanumerik (total 8), contoh "YB-20OZB".
  const makeExamToken = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const alnum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const pick = (source) => source[Math.floor(Math.random() * source.length)];
    const prefix = Array.from({ length: 2 }, () => pick(letters)).join('');
    const suffix = Array.from({ length: 5 }, () => pick(alnum)).join('');
    return `${prefix}-${suffix}`;
  };

  const toggleTargetClass = (value) => {
    setForm((current) => {
      const list = current.targetClassIds || [];
      const exists = list.some((id) => String(id) === String(value));
      return {
        ...current,
        targetClassIds: exists
          ? list.filter((id) => String(id) !== String(value))
          : [...list, String(value)],
      };
    });
  };

  // ── CRUD ──
  const openCreate = (item = null) => {
    refreshClassOptions(); // Always refresh before opening modal
    setEditingItem(item);
    const prefillTargetIds = item
      ? (Array.isArray(item.target_class_ids) && item.target_class_ids.length
          ? item.target_class_ids.map((id) => String(id))
          : (item.school_class_id ? [String(item.school_class_id)] : []))
      : [];
    setForm(item ? {
      paketSoalId: String(item.paket_soal_id || ''),
      target: String(item.school_class_id || ''),
      targetClassIds: prefillTargetIds,
      tingkat: item.tingkat || '',
      mapel: item.mapel || '',
      mulai: toLocalDateTimeInput(item.start_time),
      selesai: toLocalDateTimeInput(item.end_time),
      durasi: item.durasi || '',
      show_score: Boolean(item.show_score),
      shuffle_questions: item.shuffle_questions ?? true,
      exam_code: item.exam_code || '',
      subject: item.mapel || '',
      title: item.nama || '',
      question_format: item.package?.question_format || 'pilihan_ganda',
    } : INITIAL_FORM);
    setUploadedSoal(item ? getSessionQuestions(item) : []);
    setSourceMode('bank');
    setDocxFile(null);
    setDocxPreviewError('');
    setClassLevel(item?.tingkat || '');
    if (item?.paket_soal_id) {
      examAPI.getPaketSoal(item.paket_soal_id).then((response) => {
        const questions = response.data?.data?.questions || response.data?.data?.soals || [];
        setUploadedSoal(mapPackageQuestions(questions));
      }).catch(() => setUploadedSoal([]));
    }
    setCreateModal(true);
  };

  const selectPackage = async (packageId) => {
    const selected = questionBank.find((item) => String(item.id) === String(packageId));
    setForm((current) => ({ ...current, paketSoalId: packageId, mapel: selected?.subject || '' }));
    setUploadedSoal([]);
    if (!packageId) return;
    try {
      const response = await examAPI.getPaketSoal(packageId);
      const questions = response.data?.data?.questions || response.data?.data?.soals || [];
      setUploadedSoal(mapPackageQuestions(questions));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal memuat soal dari paket yang dipilih.');
    }
  };

  const handleDocxFile = async (file) => {
    setDocxFile(file || null);
    setUploadedSoal([]);
    setDocxPreviewError('');
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setDocxFile(null);
      setDocxPreviewError('Ukuran file melebihi 20 MB. Perkecil dokumen (kompres gambar) lalu unggah kembali.');
      toast.error('Ukuran file Word melebihi 20 MB.');
      return;
    }
    const payload = new FormData();
    payload.append('docx_file', file);
    setDocxPreviewLoading(true);
    try {
      const response = await examAPI.previewDocx(payload);
      const questions = response.data?.data?.questions || [];
      const detectedSubject = response.data?.data?.subject;
      setUploadedSoal(questions);
      if (detectedSubject) {
        setForm((current) => ({ ...current, subject: detectedSubject }));
        toast.success(`${questions.length} soal terbaca · Mata pelajaran terisi otomatis: ${detectedSubject}`);
      } else {
        toast.success(`${questions.length} soal berhasil dibaca dari dokumen Word.`);
      }
    } catch (error) {
      const message = error.response?.data?.message || error.response?.data?.errors?.docx_file?.[0] || 'Dokumen Word gagal dibaca.';
      setDocxPreviewError(message);
      toast.error(message);
    } finally {
      setDocxPreviewLoading(false);
    }
  };

  const closeCreate = () => {
    setCreateModal(false);
    setEditingItem(null);
    setForm(INITIAL_FORM);
    setUploadedSoal([]);
    setDocxFile(null);
    setDocxPreviewError('');
    setClassLevel('');
  };

  // Pintasan Esc keyboard utk menutup modal Buat/Edit Sesi (satu-satunya cara batal, selain klik X).
  useEscapeKey(createModal, closeCreate);

  const handleSave = async () => {
    if (sourceMode === 'bank' && !form.paketSoalId) { toast.error('Pilih paket soal terlebih dahulu.'); return; }
    if (sourceMode === 'docx' && !docxFile) { toast.error('Unggah dokumen soal Word terlebih dahulu.'); return; }
    if (sourceMode === 'docx' && (docxPreviewError || uploadedSoal.length === 0)) { toast.error('Pastikan dokumen Word berhasil diparsing dan berisi soal valid.'); return; }
    const targetIds = (form.targetClassIds || []).map((id) => Number(id)).filter((n) => Number.isFinite(n));
    if (!classLevel && targetIds.length === 0) { toast.error('Pilih tingkat atau minimal satu kelas target.'); return; }
    if (!form.mulai || !form.selesai || !form.durasi || Number(form.durasi) < 1) { toast.error('Waktu mulai, waktu berakhir, dan durasi wajib diisi.'); return; }
    if (sourceMode === 'docx' && !form.subject.trim()) { toast.error('Mata pelajaran wajib diisi untuk paket Word.'); return; }

    const start = new Date(form.mulai);
    const end = new Date(form.selesai);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) { toast.error('Format waktu mulai/berakhir tidak valid.'); return; }
    if (end.getTime() <= start.getTime()) { toast.error('Waktu berakhir harus lebih besar dari waktu mulai.'); return; }
    const formatLocalDateTime = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;

    const payload = {
      paket_soal_id: Number(form.paketSoalId),
      school_class_id: targetIds[0] ?? null,
      tingkat: classLevel || null,
      target_class_ids: targetIds,
      exam_type: activeExamTab,
      start_time: formatLocalDateTime(start),
      end_time: formatLocalDateTime(end),
      duration_minutes: form.durasi ? Number(form.durasi) : undefined,
      show_score: Boolean(form.show_score),
      shuffle_questions: Boolean(form.shuffle_questions),
      exam_code: (form.exam_code || '').trim().toUpperCase(),
      // Create → langsung 'active'. Edit → JANGAN kirim status (backend menurunkan dari
      // jendela waktu start/end), supaya memperpanjang Waktu Berakhir otomatis mengaktifkan
      // kembali sesi dan status tidak lagi "nyangkut" berhenti.
      ...(editingItem ? {} : { status: 'active' }),
    };

    setSavingSession(true);
    try {
      if (sourceMode === 'docx' && !editingItem) {
        const docxPayload = new FormData();
        Object.entries({
          school_class_id: payload.school_class_id ?? '',
          exam_type: payload.exam_type,
          start_time: payload.start_time,
          end_time: payload.end_time,
          duration_minutes: payload.duration_minutes,
          show_score: payload.show_score ? '1' : '0',
          shuffle_questions: payload.shuffle_questions ? '1' : '0',
          subject: form.subject.trim(),
          title: form.title.trim(),
          question_format: form.question_format,
          exam_code: payload.exam_code,
          tingkat: payload.tingkat ?? '',
        }).forEach(([key, value]) => docxPayload.append(key, String(value)));
        targetIds.forEach((id) => docxPayload.append('target_class_ids[]', String(id)));
        docxPayload.append('docx_file', docxFile);
        await examSessionAPI.createFromDocx(docxPayload);
        if (onSync) await onSync();
      } else if (editingItem) await examSessionAPI.update(editingItem.id, payload);
      else await examSessionAPI.create(payload);
      await refreshSessions(true);
      closeCreate();
      setPreviewModal(false);
      toast.success(editingItem ? 'Sesi berhasil diperbarui!' : 'Sesi ujian aktif berhasil disimpan ke database.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Sesi ujian gagal disimpan ke database.');
    } finally {
      setSavingSession(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await examSessionAPI.remove(id);
      await refreshSessions(true);
      toast.success('Sesi dihapus total — attempt, nilai murid, dan paket (bila tak dipakai sesi lain) ikut dibersihkan.', { duration: 4000 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Sesi gagal dihapus dari database.');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleStart = async (session) => {
    try {
      await examSessionAPI.update(session.id, {
        paket_soal_id: session.paket_soal_id,
        school_class_id: session.school_class_id,
        tingkat: session.tingkat || null,
        target_class_ids: Array.isArray(session.target_class_ids) ? session.target_class_ids : [],
        exam_type: session.exam_type || session.type,
        start_time: session.start_time,
        end_time: session.end_time,
        duration_minutes: session.durasi,
        show_score: Boolean(session.show_score),
        status: 'active',
      });
      await refreshSessions(true);
      toast.success('Ujian aktif di server dan tersedia untuk kelas yang dituju.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal mengaktifkan sesi ujian.');
    } finally { setConfirmModal(null); }
  };

  const handleStop = async (session) => {
    try {
      await examSessionAPI.update(session.id, {
        paket_soal_id: session.paket_soal_id,
        school_class_id: session.school_class_id,
        tingkat: session.tingkat || null,
        target_class_ids: Array.isArray(session.target_class_ids) ? session.target_class_ids : [],
        exam_type: session.exam_type || session.type,
        start_time: session.start_time,
        end_time: session.end_time,
        duration_minutes: session.durasi,
        show_score: Boolean(session.show_score),
        status: 'completed',
      });
      await refreshSessions(true);
      toast.success('Sesi ujian telah diselesaikan di server.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal menyelesaikan sesi ujian.');
    } finally { setConfirmModal(null); }
  };

  const handleGenerateToken = async (session) => {
    try {
      await examSessionAPI.generateToken(session.id);
      await refreshSessions(true);
      toast.success('Token ujian berhasil dibuat.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal membuat token ujian.');
    }
  };

  // ── EXPORT ──
  const handleCetakLembar = (session) => {
    const questions = getSessionQuestions(session);
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Popup browser diblokir. Izinkan pop-up untuk mencetak.');
      return;
    }
    const html = `<html><head><title>Lembar Soal - ${session.nama}</title>
      <style>body{font-family:Arial;padding:40px;color:#1e293b}h1{font-size:20px;margin-bottom:4px}p{font-size:13px;color:#64748b;margin-bottom:30px}
      .soal{margin-bottom:20px;padding:16px;border:1px solid #e2e8f0;border-radius:8px}
      .soal-no{font-weight:900;font-size:13px;margin-bottom:8px}.soal-teks{font-size:13px;margin-bottom:12px}
      .pilihan{font-size:12px;margin:4px 0;padding-left:16px}
      @media print{.btn{display:none}}</style></head>
      <body>
      <h1>LEMBAR SOAL – ${session.nama.toUpperCase()}</h1>
      <p>Target: ${session.target || '-'} | Mapel: ${session.mapel || '-'} | Tanggal: ${session.tanggal || '-'} | Durasi: ${session.durasi} menit</p>
      ${questions.length > 0 ? questions.map(s => `
        <div class="soal">
          <div class="soal-no">Soal ${s.no}</div>
          <div class="soal-teks">${s.teks}</div>
          ${['A','B','C','D'].map(p => `<div class="pilihan">${p}. ${s.pilihan?.[p] || '-'}</div>`).join('')}
        </div>`).join('') : '<p>Tidak ada soal tersimpan pada sesi ini.</p>'}
      <div class="btn" style="position:fixed;bottom:30px;right:30px">
        <button onclick="window.print()" style="padding:12px 24px;background:#2563eb;color:white;border:none;border-radius:12px;font-weight:900;cursor:pointer">Cetak / Download PDF</button>
      </div></body></html>`;
    win.document.write(html);
    win.document.close();
  };

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════
  return (
    <div className="space-y-6 animate-fadeIn">

      {/* ── PILL TABS ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-[2.5rem] px-8 py-5 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-2 justify-start">
          {EXAM_TABS.map(tab => {
            const isActive = activeExamTab === tab.id;
            const isSettings = tab.id === 'pengaturan';
            const isMonitor = tab.id === 'monitor';
            const count = (sessions[tab.id] || []).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveExamTab(tab.id)}
                className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[12px] font-black transition-all duration-300"
                style={isActive
                  ? { backgroundColor: tab.color, color: '#fff', boxShadow: `0 8px 20px -5px ${tab.shadow}` }
                  : { backgroundColor: '#F1F5F9', color: '#64748B' }
                }
              >
                {isSettings ? <Settings size={16} /> : isMonitor ? (
                  <><Users size={16} /><span className="whitespace-nowrap">{tab.label}</span></>
                ) : (
                  <>
                    <span className="whitespace-nowrap">{tab.label}</span>
                    <span className={`inline-flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${isActive ? 'bg-white/25 text-white' : 'bg-white text-slate-500 shadow-sm'}`}>{count}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB CONTENT ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* MONITOR PESERTA — penegakan keamanan ujian CBT (izin masuk kembali). */}
        {activeExamTab === 'monitor' ? (
          <MonitorPeserta key="monitor" />
        ) : activeExamTab === 'pengaturan' ? (
          <motion.div key="pengaturan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6 md:p-10">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Sistem Keamanan &amp; Toleransi Gangguan Ujian</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">Konfigurasi aturan ujian yang diterapkan pada server. Semua perubahan disimpan ke database.</p>
              </div>

              {examSettingsLoading && !examSettings ? (
                <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div>
              ) : !examSettings ? (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
                  Gagal memuat pengaturan ujian.
                  <button onClick={loadExamSettings} className="ml-auto underline">Coba lagi</button>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
                    {EXAM_SETTING_ROWS.map((row) => {
                      const on = !!examSettings[row.enabled];
                      return (
                        <div key={row.key} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-4">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><row.icon className="h-5 w-5" /></div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-800">{row.title}</p>
                              <p className="mt-0.5 text-[13px] font-medium leading-relaxed text-slate-500">{row.desc}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-4">
                            {row.num && (
                              <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                                {row.numLabel}
                                <input type="number" min={row.min} max={row.max} disabled={!on} value={examSettings[row.num]}
                                  onChange={(e) => setExamSettings((s) => ({ ...s, [row.num]: e.target.value }))}
                                  className="h-10 w-20 rounded-xl border border-slate-200 bg-white px-3 text-center text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-40" />
                              </label>
                            )}
                            <Switch on={on} onChange={(v) => setExamSettings((s) => ({ ...s, [row.enabled]: v }))} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                    <button onClick={loadExamSettings} disabled={examSettingsSaving} className="rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-100 disabled:opacity-50">Reset</button>
                    <button onClick={saveExamSettings} disabled={examSettingsSaving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60">
                      {examSettingsSaving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan Perubahan
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>

        ) : (

          /* EXAM SESSION TABS: six standard school exam categories */
          <motion.div key={activeExamTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

            <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">

              {/* Header row */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h3 className="text-2xl font-black tracking-tight" style={{ color: activeTab?.color }}>{activeTab?.label}</h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{currentSessions.length} sesi terdaftar</p>
                </div>
                <button
                  onClick={() => openCreate()}
                  className="flex items-center gap-2 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: activeTab?.color, boxShadow: `0 12px 24px -6px ${activeTab?.shadow}` }}
                >
                  <Plus size={16} /> Buat Sesi Ujian Baru
                </button>
              </div>

              {/* Table */}
              {sessionsLoading ? (
                <div className="py-16 text-center text-sm font-bold text-slate-400">Memuat sesi dari database...</div>
              ) : currentSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: activeTab?.bgLight }}>📋</div>
                  <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[11px]">Belum ada sesi ujian</p>
                  <p className="text-slate-300 font-medium text-sm">Klik "+ Buat Sesi Ujian Baru" untuk memulai</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-50 rounded-xl">
                        {['Nama Sesi', 'Target/Kelas', 'Tanggal', 'Waktu', 'Durasi', 'Token', 'Status', 'Pengaturan', 'Aksi'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 first:rounded-l-xl last:rounded-r-xl whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentSessions.map((session, i) => {
                        // Status efektif: sesi yang sudah melewati Waktu Berakhir otomatis "Selesai"
                        // (cek langsung new Date() > end_time), tanpa perlu aksi hentikan manual.
                        const pastEnd = session.end_time && new Date() > new Date(session.end_time);
                        const effStatus = (pastEnd || session.effective_status === 'ended') ? 'selesai'
                          : session.status;
                        const badge = getStatusBadge(effStatus);
                        // Ringkasan target: prioritas dari server (tingkat / multi-kelas), fallback label lokal.
                        const targetLabel = session.target_label
                          || targetOptions.find(o => String(o.value) === String(session.target))?.label
                          || session.target || '-';

                        return (
                          <tr key={session.id} className={`border-b border-slate-50 transition-colors hover:bg-slate-50/50 ${i % 2 !== 0 ? 'bg-[#F9FAFB]/50' : ''}`}>
                            <td className="px-4 py-4">
                              <p className="font-black text-slate-800 text-sm">{session.nama}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{session.mapel || '-'}</p>
                            </td>
                            <td className="px-4 py-4 max-w-[220px]">
                              <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 max-w-full truncate" title={targetLabel}>{targetLabel}</span>
                            </td>
                            <td className="px-4 py-4 text-sm font-bold text-slate-600 whitespace-nowrap">{session.tanggal || '-'}</td>
                            <td className="px-4 py-4 text-sm font-bold text-slate-600 whitespace-nowrap">{session.waktuMulai || '-'} - {session.waktuSelesai || '-'}</td>
                            <td className="px-4 py-4 text-sm font-bold text-slate-600 whitespace-nowrap">{session.durasi ? `${session.durasi} mnt` : '-'}</td>
                            <td className="px-4 py-4 text-sm font-black text-blue-700 whitespace-nowrap">{session.exam_code || <span className="text-slate-300">Belum dibuat</span>}</td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${badge.pulse ? 'animate-pulse' : ''}`}
                                style={{ backgroundColor: badge.bg, color: badge.text }}
                              >
                                {badge.pulse && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${(session.shuffle_questions ?? true) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {(session.shuffle_questions ?? true) ? 'Acak Soal' : 'Urut Soal'}
                                </span>
                                <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${session.show_score ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {session.show_score ? 'Ditampilkan' : 'Disembunyikan'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* DRAFT */}
                                {effStatus === 'draft' && (
                                  <ActionBtn color="#10B981" onClick={() => setConfirmModal({ type: 'start', session })}>▶ Mulai</ActionBtn>
                                )}
                                {/* BERLANGSUNG */}
                                {effStatus === 'berlangsung' && (
                                  <>
                                    <ActionBtn color="#EF4444" onClick={() => setConfirmModal({ type: 'stop', session })}>■ Hentikan</ActionBtn>
                                    <ActionBtn color="#3B82F6" onClick={() => setMonitorModal(session)}><Users size={12} /> Pantau</ActionBtn>
                                  </>
                                )}
                                {/* SELESAI (manual Hentikan ATAU otomatis lewat Waktu Berakhir):
                                    tombol "Hentikan" berubah jadi chip "Selesai" hitam. */}
                                {effStatus === 'selesai' && (
                                  <>
                                    <span className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide bg-slate-800 text-white whitespace-nowrap">■ Selesai</span>
                                    <ActionBtn color="#3B82F6" onClick={() => setMonitorModal(session)}><Users size={12} /> Pantau</ActionBtn>
                                  </>
                                )}
                                <ActionBtn color={activeTab?.color} light onClick={() => openCreate(session)}>Edit</ActionBtn>
                                <ActionBtn color="#EF4444" light onClick={() => setDeleteConfirm(session.id)}>Hapus</ActionBtn>
                                <ActionBtn color="#2563EB" light onClick={() => handleGenerateToken(session)}>{session.exam_code ? 'Generate Ulang Token' : 'Generate Token'}</ActionBtn>
                                {/* ALWAYS: KELOLA SOAL */}
                                <ActionBtn color="#F59E0B" onClick={() => setSoalModal(session)}>Soal</ActionBtn>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: BUAT / EDIT SESI
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {createModal && (
           <ModalWrap onClose={closeCreate} fitViewport disableBackdropClose>
            <motion.div initial={{ opacity: 0, y: 60, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96, y: 40 }}
              className="flex h-[94vh] max-h-[94vh] min-h-0 w-full max-w-4xl shrink-0 flex-col overflow-hidden rounded-[2rem] bg-slate-50 shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-6 py-5 sm:px-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200"><ShieldCheck size={23} /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">Ruang Kendali Ujian</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">{editingItem ? 'Edit Sesi Ujian' : 'Buat Sesi Ujian Baru'} – {activeTab?.label}</h3>
                  </div>
                </div>
                <ModalCloseControl onClose={closeCreate} />
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8" style={{ overflowAnchor: 'none' }}>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-700">01</span>
                    <div><h4 className="font-black text-slate-800">Informasi dasar ujian</h4><p className="mt-1 text-xs text-slate-500">Atur kategori dan rombongan belajar peserta.</p></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Kategori ujian</label>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm font-extrabold text-emerald-800">{activeTab?.label}</div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Tingkat kelas</label>
                      <select value={classLevel} onChange={(event) => {
                        const lvl = event.target.value;
                        setClassLevel(lvl);
                        setForm((current) => ({
                          ...current,
                          target: '',
                          targetClassIds: (current.targetClassIds || []).filter((id) => {
                            if (!lvl) return true;
                            const opt = targetOptions.find((o) => String(o.value) === String(id));
                            return opt && String(opt.name || opt.label).trim().split(/\s+/)[0].toUpperCase() === lvl;
                          }),
                        }));
                      }} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
                        <option value="">Semua tingkat</option><option value="X">Kelas X</option><option value="XI">Kelas XI</option><option value="XII">Kelas XII</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Target kelas (opsional)</label>
                      {filteredClassOptions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center text-xs font-bold text-slate-400">
                          {classLevel ? `Belum ada kelas tingkat ${classLevel}.` : 'Belum ada kelas tersedia.'}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                          {filteredClassOptions.map((opt) => {
                            const selected = (form.targetClassIds || []).some((id) => String(id) === String(opt.value));
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => toggleTargetClass(opt.value)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                                  selected
                                    ? 'border-blue-500 bg-blue-500 text-white shadow-sm shadow-blue-200'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-white bg-white/20' : 'border-slate-300'}`}>
                                  {selected && <Check size={11} />}
                                </span>
                                {opt.name || opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-slate-500">
                        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-[14px] w-[14px] shrink-0" aria-hidden="true">
                          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="#FBBF24" />
                          <path d="M12 9v4" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
                          <path d="M12 17h.01" stroke="#1F2937" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                        <span>Kosongkan jika ujian berlaku untuk semua kelas di tingkat ini, atau pilih beberapa kelas tertentu saja.</span>
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-sm font-black text-teal-700">02</span>
                    <div><h4 className="font-black text-slate-800">Sumber soal</h4><p className="mt-1 text-xs text-slate-500">Gunakan paket yang sudah tersimpan atau impor dokumen Word.</p></div>
                  </div>
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <button type="button" disabled={Boolean(editingItem)} onClick={() => setSourceMode('bank')} className={`rounded-xl border p-4 text-left transition ${sourceMode === 'bank' ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-60`}>
                      <span className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><FileSpreadsheet size={17} className="text-blue-600" />Bank Soal</span><span className="mt-1 block text-xs text-slate-500">Pilih paket yang sudah ada di database.</span>
                    </button>
                    <button type="button" disabled={Boolean(editingItem)} onClick={() => { setSourceMode('docx'); setForm((current) => ({ ...current, paketSoalId: '' })); }} className={`rounded-xl border p-4 text-left transition ${sourceMode === 'docx' ? 'border-teal-300 bg-teal-50 ring-2 ring-teal-100' : 'border-slate-200 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-60`}>
                      <span className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><FileText size={17} className="text-teal-600" />Impor Word (.docx)</span><span className="mt-1 block text-xs text-slate-500">Teks, opsi A–E, kunci, dan gambar tertanam.</span>
                    </button>
                  </div>
                  {sourceMode === 'bank' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2"><SearchableSelect label="Paket soal" options={questionBank.map((item) => ({ value: String(item.id), label: `${item.title} · ${item.subject || 'Tanpa mapel'} — ${item.question_format === 'esai' ? '[Esai PDF - Khusus Tugas Guru]' : '[Pilihan Ganda]'}`, disabled: item.question_format === 'esai' }))} value={form.paketSoalId} onChange={selectPackage} placeholder="Cari dan pilih paket soal..." /></div>
                      <FI label="Mata pelajaran" value={form.mapel} readOnly placeholder="Diambil dari paket soal" />
                      <div className="flex items-end"><div className="w-full rounded-xl bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800">{form.paketSoalId ? `${uploadedSoal.length} soal siap dipratinjau` : 'Pilih paket untuk memuat ringkasan soal'}</div></div>
                      <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600"><b>Penjelasan singkat:</b> Bank Soal adalah kumpulan paket soal yang sudah pernah dibuat sebelumnya (oleh Guru maupun Admin). Pilih salah satu paket yang tersedia untuk langsung dipakai pada sesi ini tanpa mengimpor ulang dokumen Word; mata pelajaran beserta seluruh soalnya mengikuti paket terpilih.</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FI label="Mata pelajaran" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Contoh: Matematika" />
                        <FI label="Judul paket (opsional)" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Otomatis dari mapel dan kategori" />
                      </div>
                      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/60 p-4 transition hover:border-teal-400 hover:bg-teal-50">
                        <span className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white"><UploadCloud size={20} /></span><span className="min-w-0"><b className="block truncate text-sm text-slate-800">{docxFile?.name || 'Pilih dokumen soal Word'}</b><small className="mt-1 block text-xs text-slate-500">.docx · Maksimal 20 MB · gambar PNG/JPG dapat ditanam pada paragraf soal</small></span></span>
                        <span className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-black text-teal-700 shadow-sm">PILIH FILE</span>
                        <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => { handleDocxFile(event.target.files?.[0]); event.target.value = ''; }} />
                      </label>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600"><b>Penjelasan singkat:</b> tiap soal diawali nomor seperti <code>1. Pertanyaan</code>, opsi memakai <code>A.</code> sampai <code>E.</code> (boleh berupa teks maupun gambar), dan kunci ditulis <code>Kunci: A</code>. Gambar bisa ditanam pada batang soal maupun pada opsi jawaban. Baris <code>Mata Pelajaran : Matematika</code> di atas soal pertama otomatis mengisi kolom Mata pelajaran. Dokumen diparsing dulu untuk pratinjau; paket serta sesi disimpan bersama ke database saat tombol utama ditekan.</div>
                      {docxPreviewLoading && <p className="text-xs font-bold text-teal-700">Membaca dokumen dan gambar...</p>}
                      {docxPreviewError && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{docxPreviewError}</p>}
                      {docxFile && uploadedSoal.length > 0 && <p className="text-xs font-bold text-emerald-700">{uploadedSoal.length} soal berhasil diparsing dan siap disimpan.</p>}
                    </div>
                   )}
                  </section>

                 <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-sm font-black text-amber-700">03</span><div><h4 className="font-black text-slate-800">Waktu dan token akses</h4><p className="mt-1 text-xs text-slate-500">Tentukan waktu mulai, waktu berakhir sesi, dan durasi pengerjaan.</p></div></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FI label="Tanggal & waktu mulai" type="datetime-local" value={form.mulai} onChange={(event) => setForm((current) => ({ ...current, mulai: event.target.value }))} />
                    <FI label="Tanggal & waktu berakhir" type="datetime-local" value={form.selesai} onChange={(event) => setForm((current) => ({ ...current, selesai: event.target.value }))} />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-end">
                    <FI label="Durasi ujian (menit)" type="number" min="1" max="600" value={form.durasi} onChange={(event) => setForm((current) => ({ ...current, durasi: event.target.value }))} placeholder="Contoh: 90" />
                    <div className="space-y-2">
                      <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Token ujian</label>
                      <div className="flex overflow-hidden rounded-2xl border border-blue-200 bg-blue-50">
                        <input readOnly tabIndex={-1} value={form.exam_code} placeholder="Kode 8 karakter" className="min-w-0 flex-1 bg-transparent px-4 py-4 text-sm font-black tracking-[0.18em] text-slate-700 outline-none placeholder:font-bold placeholder:tracking-normal placeholder:text-slate-400" />
                        <button type="button" onClick={() => setForm((current) => ({ ...current, exam_code: makeExamToken() }))} disabled={!canGenerateToken} title={canGenerateToken ? 'Buat token otomatis' : 'Lengkapi tingkat/target kelas, sumber soal, waktu mulai, waktu berakhir, dan durasi dulu'} className="shrink-0 border-l border-blue-200 bg-white px-5 py-4 text-xs font-black uppercase tracking-wider text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40">Generate</button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                    <Clock3 size={15} className="shrink-0 text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jadwal</span>
                    {form.mulai && form.selesai ? (() => {
                      const d1 = new Date(form.mulai); const d2 = new Date(form.selesai);
                      const sameDay = d1.toDateString() === d2.toDateString();
                      const dateStr = d1.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                      const t1 = d1.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                      const t2 = d2.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                      const rentang = sameDay ? `${dateStr}, ${t1} – ${t2}` : `${d1.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} – ${d2.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`;
                      const over = form.durasi && (d2 - d1) / 60000 < Number(form.durasi);
                      return (
                        <>
                          <span>{rentang}</span>
                          <span className="text-slate-300">·</span>
                          <span>Durasi {form.durasi ? `${form.durasi} mnt` : '—'}</span>
                          {over && <span className="ml-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-rose-600 ring-1 ring-rose-200">melebihi rentang</span>}
                        </>
                      );
                    })() : (
                      <span className="text-slate-400">Isi waktu mulai &amp; berakhir untuk melihat rentang jadwal.</span>
                    )}
                  </div>
                </section>

                 <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                   <div className="mb-4 flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-700">04</span><div><h4 className="font-black text-slate-800">Tindakan Lanjutan Ujian</h4><p className="mt-1 text-xs text-slate-500">Atur pengacakan soal dan visibilitas hasil ujian bagi peserta.</p></div></div>
                   <div className="space-y-3">
                      <div className={`rounded-xl border p-4 transition ${form.shuffle_questions ? 'border-teal-200 bg-teal-50/70' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-4">
                          <b className="text-sm text-slate-800">Acak Urutan Soal untuk Setiap Murid</b>
                          <button type="button" role="switch" aria-checked={Boolean(form.shuffle_questions)} aria-label="Acak urutan soal untuk setiap murid" onClick={() => setForm((current) => ({ ...current, shuffle_questions: !current.shuffle_questions }))} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 ${form.shuffle_questions ? 'bg-teal-600' : 'bg-slate-300'}`}>
                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${form.shuffle_questions ? 'left-6' : 'left-1'}`} />
                          </button>
                        </div>
                        <p className={`mt-2 text-xs font-semibold ${form.shuffle_questions ? 'text-teal-700' : 'text-amber-700'}`}>
                         {form.shuffle_questions
                           ? 'Aktif — Urutan nomor soal akan diacak berbeda untuk setiap peserta guna mencegah kecurangan.'
                           : 'Nonaktif — Seluruh peserta akan mengerjakan soal dengan urutan nomor yang sama persis sesuai paket soal.'}
                       </p>
                     </div>
                     <div className={`rounded-xl border p-4 transition ${form.show_score ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-slate-50'}`}>
                       <div className="flex items-center justify-between gap-4">
                         <b className="text-sm text-slate-800">Tampilkan Nilai Secara Instan</b>
                         <button type="button" role="switch" aria-checked={Boolean(form.show_score)} aria-label="Tampilkan nilai secara instan" onClick={() => setForm((current) => ({ ...current, show_score: !current.show_score }))} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${form.show_score ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                           <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${form.show_score ? 'left-6' : 'left-1'}`} />
                         </button>
                       </div>
                       <p className={`mt-2 text-xs font-semibold ${form.show_score ? 'text-emerald-700' : 'text-amber-700'}`}>
                         {form.show_score
                            ? 'Aktif — Nilai akhir dan jumlah jawaban benar langsung tampil di layar akhir peserta setelah ujian selesai.'
                           : 'Nonaktif — Nilai akhir dan kunci jawaban disembunyikan dari peserta; hasil ujian hanya direkap oleh Admin Akademik.'}
                       </p>
                     </div>
                   </div>
                 </section>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
                <button disabled={docxPreviewLoading || savingSession} onClick={() => setPreviewModal(true)} className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs font-black uppercase tracking-wider text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"><Eye size={15} className="mr-2 inline" />Pratinjau Paket Soal</button>
                <button disabled={savingSession || docxPreviewLoading} onClick={handleSave} className="rounded-xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{savingSession ? 'Menyimpan sesi...' : 'Simpan & Aktifkan Sesi'}</button>
              </div>
            </motion.div>
          </ModalWrap>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: PRATINJAU SOAL (SEBELUM SIMPAN SESI)
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {previewModal && (
          <ModalWrap onClose={() => setPreviewModal(false)}>
            <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-amber-50">
                <div>
                  <h3 className="text-xl font-black text-slate-800">Pratinjau Soal & Gambar</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Validasi kecocokan soal dan gambar sebelum menyimpan sesi</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPreviewModal(false)} className="p-3 bg-white/60 hover:bg-white rounded-2xl text-slate-400 transition-colors"><X size={20} /></button>
                </div>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-50">
                        {['No', 'Teks Soal', 'Gambar', 'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E', 'Kunci'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 first:rounded-l-xl last:rounded-r-xl whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewQuestions.map((s, i) => {
                        const hasImage = Boolean(s.gambar);
                        const choices = s.pilihan || { A: '-', B: '-', C: '-', D: '-' };
                        return (
                        <tr key={s.no} className={`border-b border-slate-50 ${i % 2 !== 0 ? 'bg-[#F9FAFB]' : 'bg-white'}`}>
                          <td className="px-4 py-4 font-black text-slate-400 text-sm align-top">{s.no}</td>
                          <td className="px-4 py-4 max-w-[200px] align-top">
                            <p className="text-sm font-medium text-slate-700 line-clamp-3">{s.teks}</p>
                          </td>
                          <td className="px-4 py-4 align-top">
                            {hasImage ? (
                              <img src={s.gambar} alt={`Gambar soal ${s.no}`} className="h-20 w-24 rounded-xl border border-slate-200 bg-white object-contain" />
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-300"><ImageIcon size={12} />-</span>
                            )}
                          </td>
                          {['A','B','C','D','E'].map(p => {
                            const label = choices[p];
                            const img = s.pilihan_gambar?.[p];
                            const hasText = label && label !== '-';
                            return (
                            <td key={p} className="px-4 py-4 text-[13px] text-slate-500 font-medium max-w-[120px] align-top">
                              {hasText && <span className="block">{label}</span>}
                              {img && <img src={img} alt={`Gambar opsi ${p}`} className={`max-h-16 w-full rounded-lg border border-slate-200 bg-white object-contain ${hasText ? 'mt-1' : ''}`} />}
                              {!hasText && !img && <span className="text-slate-300">-</span>}
                            </td>
                            );
                          })}
                          <td className="px-4 py-4 align-top">
                            <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-xl text-[11px] font-black">{s.kunci}</span>
                          </td>
                        </tr>
                      )})}
                      {previewQuestions.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                            Belum ada soal yang diupload untuk sesi ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="px-10 py-6 border-t border-slate-100 flex gap-3 justify-end bg-slate-50">
                <button onClick={() => setPreviewModal(false)} className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">Kembali Edit</button>
                <button disabled={savingSession} onClick={() => { setPreviewModal(false); handleSave(); }} className="px-8 py-3 rounded-xl text-white font-black text-[11px] uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-60"
                  style={{ backgroundColor: activeTab?.color }}>Simpan &amp; Aktifkan Sesi</button>
              </div>
            </motion.div>
          </ModalWrap>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: KONFIRMASI MULAI / HENTIKAN
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {confirmModal && (
          <ModalWrap onClose={() => setConfirmModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white text-2xl font-black"
                style={{ backgroundColor: confirmModal.type === 'start' ? '#10B981' : '#EF4444' }}>
                {confirmModal.type === 'start' ? '▶' : '■'}
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-3">
                {confirmModal.type === 'start' ? 'Mulai Ujian?' : 'Hentikan Ujian?'}
              </h3>
              <p className="text-slate-500 font-medium text-sm mb-8 leading-relaxed">
                {confirmModal.type === 'start'
                  ? `Yakin memulai ujian "${confirmModal.session.nama}" untuk semua peserta? Timer akan mulai berjalan di sisi server.`
                  : `Semua peserta akan otomatis logout dari sesi "${confirmModal.session.nama}". Jawaban tersimpan tetap aman.`}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)} className="flex-1 py-3.5 rounded-xl bg-slate-100 text-slate-600 font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all">Batal</button>
                <button
                  onClick={() => confirmModal.type === 'start' ? handleStart(confirmModal.session) : handleStop(confirmModal.session)}
                  className="flex-1 py-3.5 rounded-xl text-white font-black text-[11px] uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all"
                  style={{ backgroundColor: confirmModal.type === 'start' ? '#10B981' : '#EF4444' }}>
                  {confirmModal.type === 'start' ? 'Ya, Mulai!' : 'Ya, Hentikan!'}
                </button>
              </div>
            </motion.div>
          </ModalWrap>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: HAPUS KONFIRMASI
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {deleteConfirm && (
          <ModalWrap onClose={() => setDeleteConfirm(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-10 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-2xl mx-auto mb-5 flex items-center justify-center text-2xl">🗑️</div>
              <h3 className="text-lg font-black text-slate-800 mb-2">Hapus Total Sesi?</h3>
              <p className="text-slate-500 text-sm font-medium mb-3 text-left leading-relaxed">Tindakan ini <b className="text-rose-600">menghapus permanen</b> dan tidak bisa dikembalikan:</p>
              <ul className="mb-7 space-y-1 text-left text-[13px] font-medium text-slate-500">
                <li>• Jadwal &amp; pengaturan sesi ujian ini</li>
                <li>• Data pantauan / attempt peserta (tab Monitor)</li>
                <li>• <b className="text-slate-700">Seluruh nilai hasil ujian murid</b> pada sesi ini</li>
                <li>• Paket soal &amp; butir soalnya — <i>hanya jika tidak dipakai sesi lain</i></li>
              </ul>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-[11px] uppercase tracking-widest">Batal</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-black text-[11px] uppercase tracking-widest hover:bg-red-600 active:scale-95 transition-all">Hapus Total</button>
              </div>
            </motion.div>
          </ModalWrap>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: PANTAU PESERTA AKTIF
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {monitorModal && (
          <PantauPesertaModal session={monitorModal} onClose={() => setMonitorModal(null)} />
        )}
      </AnimatePresence>


      {/* ══════════════════════════════════════════════════════════════
          MODAL: KELOLA SOAL
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {soalModal && (
          <ModalWrap onClose={() => setSoalModal(null)}>
            <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-amber-50">
                <div>
                  <h3 className="text-xl font-black text-slate-800">Kelola Soal</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{soalModal.nama} • {soalModal.mapel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleCetakLembar(soalModal)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                    <Printer size={14} /> Cetak
                  </button>
                  <button onClick={() => setSoalModal(null)} className="p-3 bg-white/60 hover:bg-white rounded-2xl text-slate-400 transition-colors"><X size={20} /></button>
                </div>
              </div>
              <div className="p-6 max-h-[72vh] overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50">
                        {['No', 'Teks Soal', 'Gambar', 'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Kunci'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 first:rounded-l-xl last:rounded-r-xl whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sessionQuestions.map((s, i) => (
                        <tr key={s.no} className={`border-b border-slate-50 ${i % 2 !== 0 ? 'bg-[#F9FAFB]' : 'bg-white'}`}>
                          <td className="px-4 py-4 font-black text-slate-400 text-sm">{s.no}</td>
                          <td className="px-4 py-4 max-w-[200px]">
                            <p className="text-sm font-medium text-slate-700 line-clamp-2">{s.teks}</p>
                          </td>
                           <td className="px-4 py-4">
                             {s.gambar ? (
                               <img src={s.gambar} alt="soal" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                             ) : (
                               <span className="text-[11px] font-bold text-slate-300">&mdash;</span>
                             )}
                           </td>
                           {['A','B','C','D'].map(p => (
                             <td key={p} className="px-4 py-4 text-sm text-slate-500 font-medium max-w-[120px]">
                               {s.pilihan?.[p] ? (
                                 <span className="truncate block">{s.pilihan[p]}</span>
                               ) : s.pilihan_gambar?.[p] ? (
                                 <img src={s.pilihan_gambar[p]} alt={`Opsi ${p}`} className="max-h-16 w-auto rounded-lg border border-slate-200 object-contain" />
                               ) : (
                                 <span className="text-slate-300">&mdash;</span>
                               )}
                             </td>
                           ))}
                          <td className="px-4 py-4">
                            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-[11px] font-black">{s.kunci}</span>
                          </td>
                        </tr>
                      ))}
                      {sessionQuestions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-slate-300 text-sm font-bold">
                            Belum ada soal tersimpan pada sesi ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </ModalWrap>
        )}
      </AnimatePresence>

    </div>
  );
};

// ── SHARED COMPONENTS ──────────────────────────────────────────────────────────
const ModalWrap = ({ children, onClose, fitViewport = false, disableBackdropClose = false }) => {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    // Keep the page behind the dialog stationary while allowing the modal's
    // own scrollable content to work normally.
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return createPortal(
    <div className={`fixed inset-0 z-[1000] flex overscroll-contain justify-center overflow-hidden p-4 bg-slate-900/60 backdrop-blur-md ${fitViewport ? 'items-start pt-[3vh]' : 'items-center'}`} onClick={e => { if (!disableBackdropClose && e.target === e.currentTarget) onClose(); }}>
      {children}
    </div>,
    document.body
  );
};

const ActionBtn = ({ children, color, light = false, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
    style={light
      ? { backgroundColor: `${color}18`, color: color }
      : { backgroundColor: color, color: '#fff' }
    }
  >
    {children}
  </button>
);

// ── Monitor Peserta: status pengerjaan CBT + izin masuk kembali (penegakan keamanan). ──
function MonitorPeserta() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [q, setQ] = useState('');
  const [classes, setClasses] = useState([]);
  const [remoteAttempt, setRemoteAttempt] = useState(null);
  const [reviewModal, setReviewModal] = useState(null); // { student_name, rating, feedback, at }

  // Daftar seluruh kelas terdaftar (school_classes) utk dropdown filter, diurut tingkat → nama.
  useEffect(() => {
    let alive = true;
    operatorAPI.getMasterData()
      .then((r) => {
        if (!alive) return;
        const list = (r.data?.data?.kelas || []).map((k) => k.nama).filter(Boolean);
        setClasses(Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'id', { numeric: true })));
      })
      .catch(() => { /* gagal ambil kelas: dropdown tetap punya opsi dari attempt */ });
    return () => { alive = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const { data } = await operatorAPI.getExamAttempts();
      setRows(data.data || []);
    } catch {
      setErr('Gagal memuat data peserta ujian.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const unlock = async (id) => {
    setBusyId(id);
    try {
      await operatorAPI.unlockExamAttempt(id);
      toast.success('Izin masuk kembali diberikan.');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal memberikan izin.');
    } finally {
      setBusyId(null);
    }
  };

  const STATUS = {
    active:    { label: 'Sedang Mengerjakan', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
    submitted: { label: 'Selesai Dikumpulkan', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    locked:    { label: 'Terkunci', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
    expired:   { label: 'Waktu Habis', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
  };
  const REASON = { tab_limit: 'melewati batas pindah tab', idle: 'tidak aktif (auto-logout)', manual_exit: 'keluar manual', force_logout: 'dikeluarkan pengawas' };
  const JENIS = {
    simulasi: 'Simulasi', uts: 'UTS', uas: 'UAS', praktek: 'Ujian Praktek', usp: 'USP', remedial: 'Susulan / Remedial',
  };

  const all = rows || [];
  const classOptions = Array.from(new Set([
    ...classes,
    ...all.map((r) => r.class_name).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  // Jenis ujian: prioritas 6 kelompok baku, tambahkan apa pun yang muncul di data.
  const jenisOptions = Array.from(new Set([
    ...Object.keys(JENIS),
    ...all.map((r) => r.exam_type).filter(Boolean),
  ]));
  const counts = {
    total: all.length,
    active: all.filter((r) => r.status === 'active').length,
    locked: all.filter((r) => r.locked).length,
    submitted: all.filter((r) => r.status === 'submitted').length,
  };
  const term = q.trim().toLowerCase();
  const list = all.filter((r) => {
    if (filterClass && r.class_name !== filterClass) return false;
    if (filterJenis && (r.exam_type || '') !== filterJenis) return false;
    if (term && !(`${r.student_name || ''} ${r.nisn || ''}`.toLowerCase().includes(term))) return false;
    return true;
  });

  return (
    <motion.div key="monitor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="space-y-6 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-slate-800">Monitor Peserta Ujian</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">Status pengerjaan CBT &amp; penegakan keamanan. Beri &ldquo;Izinkan Masuk Kembali&rdquo; untuk peserta terkunci.</p>
          </div>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50">
            <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Attempt', v: counts.total, c: 'text-slate-800' },
            { label: 'Mengerjakan', v: counts.active, c: 'text-sky-600' },
            { label: 'Terkunci', v: counts.locked, c: 'text-rose-600' },
            { label: 'Selesai', v: counts.submitted, c: 'text-emerald-600' },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center">
              <p className={`text-2xl font-black tabular-nums ${k.c}`}>{k.v}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Filter kelas (dropdown dari school_classes) + pencarian peserta */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-48 shrink-0 sm:w-56">
            <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-400" />
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-9 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            >
              <option value="">Semua Kelas</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="relative w-48 shrink-0 sm:w-56">
            <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-400" />
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-9 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            >
              <option value="">Semua Jenis Ujian</option>
              {jenisOptions.map((t) => (
                <option key={t} value={t}>{JENIS[t] || t}</option>
              ))}
            </select>
          </div>
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs sm:ml-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama murid atau NISN…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </div>
        </div>

        {loading && !rows ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}</div>
        ) : err ? (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{err}
            <button onClick={load} className="ml-auto underline">Coba lagi</button>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-black text-slate-500">{all.length === 0 ? 'Belum ada peserta memulai ujian.' : 'Tidak ada peserta pada filter ini.'}</p>
            <p className="mt-1 text-xs font-medium text-slate-400">{all.length === 0 ? 'Data muncul saat murid memulai sesi CBT aktif.' : 'Coba pilih kelas lain atau kosongkan pencarian.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-black">Peserta</th>
                  <th className="px-5 py-3 font-black">Kelas</th>
                  <th className="px-5 py-3 font-black">Ujian</th>
                  <th className="px-5 py-3 font-black">Status</th>
                  <th className="px-5 py-3 font-black">Pindah Tab</th>
                  <th className="px-5 py-3 font-black">Benar / Soal</th>
                  <th className="px-5 py-3 font-black">Nilai</th>
                  <th className="px-5 py-3 font-black">Rating</th>
                  <th className="px-5 py-3 font-black">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {list.map((r) => {
                  const st = STATUS[r.status] || STATUS.expired;
                  // Remote hanya utk ujian yang MASIH berlangsung (bukan selesai/expired waktunya).
                  const ongoing = r.ends_at && new Date(r.ends_at) > new Date();
                  const canRemote = (r.status === 'active' || r.status === 'locked') && ongoing;
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-5 py-3"><p className="font-black text-slate-800">{r.student_name || '-'}</p><p className="text-[11px] font-bold text-slate-400">{r.nisn || '-'}</p></td>
                      <td className="px-5 py-3 font-bold text-slate-600">{r.class_name || '-'}</td>
                      <td className="px-5 py-3"><p className="font-bold text-slate-700">{r.exam || '-'}</p><p className="mt-0.5 text-[11px] font-bold text-slate-400">Token {r.exam_code || '-'}</p></td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${st.cls}`}>
                          {r.locked && <ShieldCheck className="h-3 w-3" />}{st.label}
                        </span>
                        {r.locked && r.lock_reason && <p className="mt-1 text-[10px] font-bold text-rose-500">{REASON[r.lock_reason] || r.lock_reason}</p>}
                      </td>
                      <td className="px-5 py-3 font-black tabular-nums text-slate-600">{r.tab_switches}×</td>
                      <td className="px-5 py-3 font-black tabular-nums text-slate-600">
                        {r.total_questions ? `${r.correct_answers ?? 0} / ${r.total_questions}` : <span className="text-[11px] font-bold text-slate-300">&mdash;</span>}
                      </td>
                      <td className="px-5 py-3">
                        {r.total_questions && r.score != null ? (
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black tabular-nums ring-1 ${r.score >= 86 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : r.score >= 71 ? 'bg-sky-50 text-sky-700 ring-sky-200' : r.score >= 56 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{Math.round(r.score)}</span>
                        ) : <span className="text-[11px] font-bold text-slate-300">&mdash;</span>}
                      </td>
                      <td className="px-5 py-3">
                        {r.review_rating ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-0.5" title={`${r.review_rating}/5`}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star key={n} className={`h-3.5 w-3.5 ${n <= r.review_rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                              ))}
                            </span>
                            {r.review_feedback ? (
                              <button type="button" onClick={() => setReviewModal({ student_name: r.student_name, rating: r.review_rating, feedback: r.review_feedback, at: r.review_at })} className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-700 transition hover:bg-sky-100">
                                <MessageSquare className="h-3 w-3" /> Masukan
                              </button>
                            ) : null}
                          </div>
                        ) : <span className="text-[11px] font-bold text-slate-300">&mdash;</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {canRemote && (
                            <button onClick={() => setRemoteAttempt({ id: r.id })} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md transition hover:bg-slate-900">
                              <Monitor className="h-3.5 w-3.5" /> Remote
                            </button>
                          )}
                          {r.locked && (
                            <button onClick={() => unlock(r.id)} disabled={busyId === r.id} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-indigo-500/25 transition hover:brightness-110 disabled:opacity-60">
                              {busyId === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Izinkan Masuk Kembali
                            </button>
                          )}
                          {!canRemote && !r.locked && <span className="text-[11px] font-bold text-slate-300">&mdash;</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {remoteAttempt && (
        <StudentExamRunner
          key={`remote-${remoteAttempt.id}`}
          remoteMode
          attemptId={remoteAttempt.id}
          session={null}
          onRemoteClose={(info) => {
            setRemoteAttempt(null);
            if (info?.submitted) { toast.success('Ujian peserta diselesaikan via Remote.'); }
            load();
          }}
        />
      )}
      {reviewModal && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setReviewModal(null); }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Masukan Murid</h3>
              <button type="button" onClick={() => setReviewModal(null)} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm font-black text-slate-800">{reviewModal.student_name || '—'}</p>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${n <= reviewModal.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                ))}
                <span className="ml-1 text-xs font-black tabular-nums text-slate-500">{reviewModal.rating}/5</span>
              </div>
              <p className="mt-3 text-sm font-medium leading-relaxed text-slate-700">{reviewModal.feedback || 'Tidak ada catatan (hanya rating).'}</p>
              {reviewModal.at && <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Dikirim {new Date(reviewModal.at).toLocaleString('id-ID')}</p>}
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button type="button" onClick={() => setReviewModal(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100">Tutup</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </motion.div>
  );
}

// ── Pantau Peserta Aktif (per sesi): baca exam_attempts nyata + aksi unlock/reset/force logout. ──
function PantauPesertaModal({ session, onClose }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [pendingReset, setPendingReset] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!session?.id) return;
    setLoading(true); setErr('');
    try {
      const { data } = await operatorAPI.getExamAttempts({ session_id: session.id });
      setRows(data.data || []);
    } catch {
      setErr('Gagal memuat peserta sesi ini.');
    } finally {
      setLoading(false);
    }
  }, [session?.id]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (kind, p) => {
    setBusy((b) => ({ ...b, [p.id]: true }));
    try {
      if (kind === 'unlock') { await operatorAPI.unlockExamAttempt(p.id); toast.success(`${p.student_name || 'Peserta'} diizinkan masuk kembali.`); }
      else if (kind === 'reset') { await operatorAPI.resetExamAttempt(p.id); toast.success(`Sesi ${p.student_name || 'Peserta'} direset.`); }
      else if (kind === 'force') { await operatorAPI.forceLogoutExamAttempt(p.id); toast.success(`${p.student_name || 'Peserta'} dikeluarkan (force logout).`); }
      setPendingReset(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Aksi gagal dilakukan.');
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[p.id]; return n; });
    }
  };

  const ST = {
    active:    { label: 'Sedang Mengerjakan', cls: 'bg-sky-100 text-sky-700' },
    submitted: { label: 'Selesai Dikumpulkan', cls: 'bg-emerald-100 text-emerald-700' },
    locked:    { label: 'Terkunci', cls: 'bg-rose-100 text-rose-700' },
    expired:   { label: 'Waktu Habis', cls: 'bg-slate-100 text-slate-500' },
  };
  const REASON = { tab_limit: 'melewati batas pindah tab', idle: 'auto-logout', manual_exit: 'keluar manual', force_logout: 'dikeluarkan pengawas' };
  const list = rows || [];
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return '-'; } };

  return (
    <ModalWrap onClose={onClose}>
      <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-blue-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white"><Users size={20} /></div>
            <div>
              <h3 className="text-xl font-black text-slate-800">Pantau Peserta Aktif</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{session.nama}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-green-100 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Live</span>
            </div>
            <button onClick={onClose} className="p-3 bg-white/60 hover:bg-white rounded-2xl text-slate-400 transition-colors"><X size={20} /></button>
          </div>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading && !rows ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />)}</div>
          ) : err ? (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{err}
              <button onClick={load} className="ml-auto underline">Coba lagi</button>
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-slate-400">Belum ada peserta memulai sesi ini.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="bg-slate-50">
                    {['Nama Siswa', 'Kelas', 'Status', 'Waktu Mulai', 'Jawaban', 'Benar / Nilai', 'Aksi'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 first:rounded-l-xl last:rounded-r-xl">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const st = ST[p.status] || ST.expired;
                    const isBusy = !!busy[p.id];
                    return (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-black text-slate-800 text-sm">{p.student_name || '-'}</p>
                          <p className="text-[10px] font-bold text-slate-400">{p.nisn || '-'}</p>
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-slate-600">{p.class_name || '-'}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black ${st.cls}`}>
                            {p.locked && <ShieldCheck size={11} />}{st.label}
                          </span>
                          {p.locked && p.lock_reason && <p className="mt-1 text-[10px] font-bold text-rose-500">{REASON[p.lock_reason] || p.lock_reason}</p>}
                          {p.tab_switches > 0 && <p className="mt-0.5 text-[10px] font-bold text-red-500">⚠ {p.tab_switches}× pindah tab</p>}
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-slate-600">{p.started_at ? fmtTime(p.started_at) : '-'}</td>
                        <td className="px-4 py-4 text-sm font-bold text-slate-600">{p.answered ?? 0} soal</td>
                        <td className="px-4 py-4">
                          {p.total_questions ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black tabular-nums text-slate-700">{p.correct_answers ?? 0}/{p.total_questions}</span>
                              {p.score != null && <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tabular-nums ${p.score >= 75 ? 'bg-emerald-100 text-emerald-700' : p.score >= 56 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{Math.round(p.score)}</span>}
                            </div>
                          ) : <span className="text-[11px] font-bold text-slate-300">&mdash;</span>}
                        </td>
                        <td className="px-4 py-4">
                          {pendingReset === p.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-500">Reset?</span>
                              <button onClick={() => runAction('reset', p)} disabled={isBusy} className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">{isBusy ? '…' : 'Ya'}</button>
                              <button onClick={() => setPendingReset(null)} disabled={isBusy} className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase bg-slate-200 text-slate-600 hover:bg-slate-300">Batal</button>
                            </div>
                          ) : (
                            <div className="flex gap-2 flex-wrap">
                              {p.locked && (
                                <button onClick={() => runAction('unlock', p)} disabled={isBusy} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all whitespace-nowrap disabled:opacity-50">
                                  {isBusy ? '…' : 'Izinkan Masuk'}
                                </button>
                              )}
                              <button onClick={() => setPendingReset(p.id)} disabled={isBusy} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide bg-amber-100 text-amber-700 hover:bg-amber-200 transition-all whitespace-nowrap disabled:opacity-50">
                                <RotateCcw size={11} className="inline mr-1" />Reset
                              </button>
                              <button onClick={() => runAction('force', p)} disabled={isBusy || p.status === 'submitted'} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide bg-red-100 text-red-600 hover:bg-red-200 transition-all whitespace-nowrap disabled:opacity-50">
                                {isBusy ? '…' : 'Force Logout'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </ModalWrap>
  );
}

export default ExamsTab;
