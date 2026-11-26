import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CinematicLoading from '../../../components/dashboard/shared/CinematicLoading';

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Ban,
  BarChart3,
  Bell,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Clock3,
  CreditCard,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  LayoutDashboard,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  Printer,
  Receipt,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  User as UserIcon,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cashierAPI, informationCenterAPI } from '../../../utils/api';
import CalendarTab from '../AdminAkademik/components/Calendar/CalendarTab';
import InformationCenterTab from '../../../components/dashboard/shared/InformationCenterTab';
import UnderDevelopment from '../../../maintaning/UnderDevelopment';
import CashierLaporanRekapitulasi from './CashierLaporanRekapitulasi';
import CashierDashboardKeuangan from './CashierDashboardKeuangan';
import CashierPembayaranVerifikasi from './CashierPembayaranVerifikasi';
import CashierTagihanTunggakan from './CashierTagihanTunggakan';
import CashierKasKecilDanaSekolah from './CashierKasKecilDanaSekolah';

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_TONES = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  lunas: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  belum_bayar: 'border-rose-200 bg-rose-50 text-rose-700',
  ditolak: 'border-rose-200 bg-rose-50 text-rose-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  proses_verifikasi: 'border-amber-200 bg-amber-50 text-amber-700',
  awaiting_approval: 'border-amber-200 bg-amber-50 text-amber-700',
  pending: 'border-blue-200 bg-blue-50 text-blue-700',
  void: 'border-slate-200 bg-slate-100 text-slate-600',
};


const PAYMENT_METHODS = [
  { value: 'cash', label: 'Tunai', helper: 'Pembayaran diterima langsung di loket cashier.' },
  { value: 'transfer', label: 'Transfer', helper: 'Cashier mencatat nominal transfer yang sudah tervalidasi.' },
  { value: 'qris', label: 'QRIS', helper: 'Pembayaran digital via kode QR yang sudah tervalidasi.' },
  { value: 'beasiswa', label: 'Beasiswa', helper: 'Tagihan lunas, tetapi kas tunai sekolah tidak bertambah.' },
];

const INPUT_MODES = [
  { value: 'manual', label: 'Manual' },
  { value: 'foto', label: 'Foto' },
  { value: 'pdf', label: 'PDF' },
  { value: 'excel', label: 'Excel' },
];

const TARGET_TYPES = [
  { value: 'all_students', label: 'Seluruh siswa' },
  { value: 'grade_level', label: 'Per tingkat' },
  { value: 'class_name', label: 'Per kelas' },
  { value: 'student_ids', label: 'Siswa spesifik' },
];

// Struktur sidebar Kasir: 5 Menu Utama + 2 Menu Shared.
// Tiap menu utama menaungi sub-view (leaf) lama supaya semua fungsi tetap terjangkau.
const CASHIER_GROUPS = {
  dashboard: [{ id: 'summary', label: 'Ringkasan' }],
  payment_verification: [
    { id: 'payments', label: 'Pembayaran' },
    { id: 'verifications', label: 'Verifikasi Online' },
    { id: 'history', label: 'Riwayat Transaksi' },
  ],
  billing_arrears: [
    { id: 'generate', label: 'Generate Tagihan' },
    { id: 'list', label: 'Daftar Tagihan' },
    { id: 'arrears', label: 'Monitoring Tunggakan' },
  ],
  cash_funds: [{ id: 'petty', label: 'Kas Kecil Harian' }, { id: 'cashbook', label: 'Dana Non-Siswa & Belanja Program' }],
  reports: [
    { id: 'buku_kas', label: 'Buku Kas Umum' },
    { id: 'rekap', label: 'Rekap & Rekonsiliasi' },
    { id: 'bulanan', label: 'Laporan Bulanan' },
  ],
};

const CASHIER_GROUP_TITLES = {
  dashboard: 'Dashboard Keuangan',
  payment_verification: 'Pembayaran & Verifikasi',
  billing_arrears: 'Tagihan & Tunggakan',
  cash_funds: 'Kas Kecil & Dana Sekolah',
  reports: 'Laporan & Rekapitulasi',
};

const resolveCashierGroup = (menu) => {
  if (CASHIER_GROUPS[menu]) return menu;
  const entry = Object.entries(CASHIER_GROUPS).find(([, leaves]) => leaves.some((l) => l.id === menu));
  return entry ? entry[0] : null;
};


const paymentMethodLabel = (value) => {
  const normalized = value === 'adjustment' ? 'beasiswa' : value;
  return PAYMENT_METHODS.find((item) => item.value === normalized)?.label || String(normalized || '-');
};

const fileAccept = (mode) => {
  if (mode === 'foto') return '.jpg,.jpeg,.png,.webp';
  if (mode === 'pdf') return '.pdf';
  if (mode === 'excel') return '.csv,.xlsx,.xls';
  return '.jpg,.jpeg,.png,.webp,.pdf,.csv,.xlsx,.xls';
};

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const formatThousands = (value) => {
  const digits = normalizeDigits(value);
  if (!digits) return '';
  return new Intl.NumberFormat('id-ID').format(Number(digits));
};

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatDate = (value, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', options).format(new Date(value));
};

const FIELD_CLASS = 'mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const FILE_CLASS = 'mt-2 block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700';
const PRIMARY_BUTTON = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300';
const SECONDARY_BUTTON = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700';
const DANGER_BUTTON = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100';

const Panel = ({ children, className = '' }) => (
  <motion.section
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    className={`rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur ${className}`}
  >
    {children}
  </motion.section>
);

const StatusPill = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${STATUS_TONES[status] || 'border-blue-200 bg-blue-50 text-blue-700'}`}>
    {String(status || '-').replace(/_/g, ' ')}
  </span>
);

const EmptyState = ({ title, body }) => (
  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
    <FileText className="mx-auto h-8 w-8 text-slate-300" />
    <p className="mt-3 text-sm font-black text-slate-800">{title}</p>
    <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
  </div>
);

const SectionEyebrow = ({ children }) => (
  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">{children}</p>
);

const buildReceiptFromTransaction = (transaction, pool = []) => {
  const sameReceipt = pool.filter((item) => (
    item.student?.id === transaction.student?.id
      && item.receipt_code
      && item.receipt_code === transaction.receipt_code
      && item.status === 'approved'
  ));

  const sourceRows = sameReceipt.length ? sameReceipt : [transaction];
  const first = sourceRows[0];
  const totalAmount = sourceRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    receipt_code: first.receipt_code || first.transaction_code,
    student: first.student || { name: '-', school_id: '-' },
    payment_method: first.payment_method || first.channel,
    payment_date: first.payment_date || first.transaction_date,
    total_amount: first.receipt_total || totalAmount,
    cash_received: first.cash_received || 0,
    change_amount: first.change_amount || 0,
    items: sourceRows.map((item) => ({
      id: item.id,
      title: item.billing?.title || item.title,
      bill_code: item.billing?.bill_code || item.transaction_code,
      amount: item.amount,
      category: item.category,
    })),
  };
};

export default function CashierDashboard({ activeMenu, user }) {
  const receiptRef = useRef(null);
  const toastTimerRef = useRef(null);
  const isExecutive = ['kepala_sekolah', 'wakil_sekolah'].includes(user?.role);

  // Navigasi 5 menu utama + 2 shared: activeMenu dari sidebar dipetakan ke
  // grup + sub-view (activeTab) agar seluruh view lama tetap berfungsi.
  const [subTab, setSubTab] = useState(null);
  const pendingSubRef = useRef(null);
  const activeGroup = resolveCashierGroup(activeMenu);
  const activeTab = activeGroup
    ? (subTab && CASHIER_GROUPS[activeGroup].some((l) => l.id === subTab) ? subTab : CASHIER_GROUPS[activeGroup][0].id)
    : activeMenu;
  const goToGroup = (group, sub) => {
    pendingSubRef.current = sub || null;
    window.dispatchEvent(new CustomEvent('navigateDashboard', { detail: group }));
  };


  const [dashboard, setDashboard] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [billings, setBillings] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [verificationFilter, setVerificationFilter] = useState({ status: 'proses_verifikasi', date_from: '', date_to: '', q: '' });
  const [verificationAppliedFilter, setVerificationAppliedFilter] = useState({ status: 'proses_verifikasi', date_from: '', date_to: '', q: '' });
  const [verificationPage, setVerificationPage] = useState(1);
  const [verificationPagination, setVerificationPagination] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationDetailModal, setVerificationDetailModal] = useState(null);
  const [verificationRejectModal, setVerificationRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [selectedBillingIds, setSelectedBillingIds] = useState([]);
  const [historyData, setHistoryData] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedBills, setSelectedBills] = useState([]);
  const [toast, setToast] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [voidDialog, setVoidDialog] = useState({ item: null, reason: '' });
  const [historyFilter, setHistoryFilter] = useState({
    date_from: today(),
    date_to: today(),
    q: '',
    payment_method: '',
    class_name: '',
    page: 1,
    per_page: 10,
  });
  const [posForm, setPosForm] = useState({
    paymentMethod: 'cash',
    cashReceived: '',
    paymentDate: today(),
    inputMode: 'manual',
    file: null,
    notes: '',
    sendWhatsapp: true,
    sendEmail: false,
  });
  const [loading, setLoading] = useState({ shell: true, student: false, reports: false, history: false, directory: false });
  const [clock, setClock] = useState({ time: '', day: '', date: '' });
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
  const [historyDetailModal, setHistoryDetailModal] = useState(null);
  const [historyClasses, setHistoryClasses] = useState([]);
  const historyDebounceRef = useRef(null);









  const loadStudent = async (studentId) => {
    if (!studentId) {
      setStudentDetail(null);
      setSelectedBills([]);
      return;
    }

    setLoading((prev) => ({ ...prev, student: true }));
    try {
      const response = await cashierAPI.getStudentBilling(studentId);
      setStudentDetail(response.data.data);
    } catch (error) {
      console.error(error);
      notify('Data siswa gagal dibuka.', 'error');
    } finally {
      setLoading((prev) => ({ ...prev, student: false }));
    }
  };

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  };

  const loadShell = async () => {
    setLoading((prev) => ({ ...prev, shell: true }));
    try {
      const [dashboardRes, annRes] = await Promise.all([
        cashierAPI.getDashboard(),
        informationCenterAPI.getInfos({ per_page: 5 }),
      ]);
      setDashboard(dashboardRes.data.data);
      setAnnouncements(annRes.data?.data || []);
    } catch (error) {
      console.error(error);
      notify('Workspace cashier gagal dimuat.', 'error');
    } finally {
      setLoading((prev) => ({ ...prev, shell: false }));
    }
  };

  const loadHistory = async (nextFilter = historyFilter) => {
    setLoading((prev) => ({ ...prev, history: true }));
    try {
      const params = {
        date_from: nextFilter.date_from,
        date_to: nextFilter.date_to,
        q: nextFilter.q || undefined,
        payment_method: nextFilter.payment_method || undefined,
        class_name: nextFilter.class_name || undefined,
        page: nextFilter.page || 1,
        per_page: nextFilter.per_page || 10,
      };
      const response = await cashierAPI.getHistory(params);
      setHistoryData(response.data.data);
    } catch (error) {
      console.error(error);
      notify('Riwayat transaksi gagal dimuat.', 'error');
    } finally {
      setLoading((prev) => ({ ...prev, history: false }));
    }
  };


  const openReceipt = (transaction, pool) => {
    setReceiptData(buildReceiptFromTransaction(transaction, pool));
  };



  const printReceipt = () => {
    if (!receiptRef.current || !receiptData) return;
    const win = window.open('', '_blank', 'width=760,height=900');
    if (!win) return;
    win.document.write(`<html><head><title>${receiptData.receipt_code}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border-bottom:1px solid #cbd5e1;padding:10px;text-align:left}</style></head><body>${receiptRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const shareReceipt = (mode) => {
    if (!receiptData) return;
    const text = [`Kuitansi ${receiptData.receipt_code}`, `Siswa: ${receiptData.student?.name || '-'}`, `Metode: ${paymentMethodLabel(receiptData.payment_method)}`, `Total: ${formatCurrency(receiptData.total_amount)}`].join('\n');
    if (mode === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    if (mode === 'email') window.location.href = `mailto:?subject=${encodeURIComponent(`Kuitansi ${receiptData.receipt_code}`)}&body=${encodeURIComponent(text)}`;
  };


  const createPosPayment = async () => {
    if (!selectedStudentId) return notify('Pilih siswa yang akan diproses terlebih dahulu.', 'error');
    if (selectedBills.length === 0) return notify('Pilih minimal satu tagihan yang akan dibayar.', 'error');
    if (posForm.paymentMethod === 'cash' && Number(posForm.cashReceived || 0) < payableTotal) {
      return notify('Nominal kurang dari total tagihan.', 'error');
    }

    try {
      const formData = new FormData();
      formData.append('student_id', selectedStudentId);
      selectedBills.forEach((billId) => formData.append('billing_ids[]', billId));
      formData.append('payment_method', posForm.paymentMethod);
      formData.append('payment_date', posForm.paymentDate);
      formData.append('input_mode', posForm.inputMode);
      const cashAmount = (posForm.paymentMethod === 'cash') 
        ? String(Number(posForm.cashReceived || 0)) 
        : String(payableTotal);
      formData.append('cash_received', cashAmount);
      ['print', ...(posForm.sendWhatsapp ? ['whatsapp'] : []), ...(posForm.sendEmail ? ['email'] : [])]
        .forEach((channel) => formData.append('send_channels[]', channel));
      if (posForm.notes) formData.append('notes', posForm.notes);
      if (posForm.file) formData.append('file', posForm.file);

      const response = await cashierAPI.createPosPayment(formData);
      setReceiptData(response.data.data);
      setPosForm((current) => ({ ...current, cashReceived: '', inputMode: 'manual', file: null, notes: '' }));
      notify('Pembayaran berhasil disimpan dan kuitansi siap dicetak.');
      await Promise.all([loadShell(), loadStudent(selectedStudentId)]);
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.message || 'Gagal memproses. Cek koneksi.', 'error');
    }
  };

  const loadVerifications = async (filter = verificationAppliedFilter, page = verificationPage) => {
    setVerificationLoading(true);
    try {
      const params = { per_page: 10, page };
      if (filter.status && filter.status !== 'semua') params.status = filter.status;
      if (filter.date_from) params.date_from = filter.date_from;
      if (filter.date_to) params.date_to = filter.date_to;
      if (filter.q) params.q = filter.q;
      const res = await cashierAPI.getVerifications(params);
      setVerifications(res.data.data || []);
      setVerificationPagination(res.data.pagination || null);
    } catch (err) {
      console.error(err);
      notify('Gagal memuat data verifikasi.', 'error');
    } finally {
      setVerificationLoading(false);
    }
  };

  const approveVerificationNew = async (item, note = '') => {
    try {
      await cashierAPI.approveVerification(item.id, { note });
      notify('Pembayaran berhasil diverifikasi.');
      setVerificationDetailModal(null);
      await loadVerifications(verificationAppliedFilter, verificationPage);
      await loadShell();
    } catch (err) {
      console.error(err);
      notify('Gagal memverifikasi. Coba lagi.', 'error');
    }
  };

  const rejectVerificationNew = async (item) => {
    const finalReason = rejectReason === 'Lainnya (tulis manual)' ? rejectNote.trim() : rejectReason;
    if (!finalReason) return notify('Pilih atau tulis alasan penolakan.', 'error');
    try {
      await cashierAPI.rejectVerification(item.id, { reason: finalReason + (rejectNote && rejectReason !== 'Lainnya (tulis manual)' ? '. ' + rejectNote : '') });
      notify('Pembayaran ditolak. Notifikasi terkirim ke siswa.');
      setVerificationRejectModal(null);
      setVerificationDetailModal(null);
      setRejectReason('');
      setRejectNote('');
      await loadVerifications(verificationAppliedFilter, verificationPage);
      await loadShell();
    } catch (err) {
      console.error(err);
      notify('Gagal memproses penolakan. Coba lagi.', 'error');
    }
  };

  const decideVerification = async (item, approved) => {
    const message = approved ? window.prompt('Catatan approve (opsional):', '') : window.prompt('Alasan reject pembayaran:', 'Nominal tidak sesuai');
    if (message === null) return;
    if (!approved && !message.trim()) return notify('Alasan penolakan wajib diisi.', 'error');

    try {
      if (approved) await cashierAPI.approveVerification(item.id, { note: message });
      else await cashierAPI.rejectVerification(item.id, { reason: message });
      notify(approved ? 'Pembayaran online berhasil diverifikasi.' : 'Pembayaran online ditolak.', approved ? 'success' : 'error');
      await loadShell();
      if (selectedStudentId) await loadStudent(selectedStudentId);
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.message || 'Proses verifikasi gagal.', 'error');
    }
  };






  const openVoidDialog = (item) => {
    setVoidDialog({
      item,
      reason: item.transaction_type === 'income'
        ? 'Salah input nominal'
        : 'Pengeluaran dibatalkan',
    });
  };

  const closeVoidDialog = () => {
    setVoidDialog({ item: null, reason: '' });
  };

  const voidRecord = async () => {
    const item = voidDialog.item;
    const reason = voidDialog.reason.trim();
    if (!item || !reason) {
      notify('Alasan void wajib diisi.', 'error');
      return;
    }

    try {
      await cashierAPI.voidTransaction(item.id, { reason });
      notify('Transaksi dipindahkan ke status void.');
      closeVoidDialog();
      await loadShell();
      if (activeTab === 'history') await loadHistory();
      if (selectedStudentId) await loadStudent(selectedStudentId);
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.message || 'Void transaksi gagal.', 'error');
    }
  };

  useEffect(() => {
    loadShell();
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
    const clockInterval = setInterval(tick, 1000);
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      clearInterval(clockInterval);
    };
  }, []);

  // Reset sub-view saat berpindah menu utama (kecuali navigasi eksplisit via goToGroup).
  useEffect(() => {
    const group = resolveCashierGroup(activeMenu);
    if (!group) { setSubTab(null); return; }
    if (pendingSubRef.current && CASHIER_GROUPS[group].some((l) => l.id === pendingSubRef.current)) {
      setSubTab(pendingSubRef.current);
    } else {
      setSubTab(CASHIER_GROUPS[group][0].id);
    }
    pendingSubRef.current = null;
  }, [activeMenu]);

  // Auto-sync senyap Dashboard Keuangan: polling 18 detik + saat jendela fokus.
  // Gagal diambil diam-diam (state lama tidak di-reset) sesuai kebutuhan live.
  useEffect(() => {
    let alive = true;
    const silentRefresh = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await cashierAPI.getDashboard();
        if (alive && res?.data?.data) setDashboard(res.data.data);
      } catch (error) {
        console.error(error);
      }
    };
    // Sinkron langsung: mount + fokus tab + setelah aksi. Tanpa polling berkala.
    const onFocus = () => silentRefresh();
    const onVisible = () => { if (!document.hidden) silentRefresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await cashierAPI.searchStudents({ q: query });
        setStudents(response.data.data || []);
      } catch (error) {
        console.error(error);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query]);




  useEffect(() => {
    loadStudent(selectedStudentId);
  }, [selectedStudentId]);

  // expenses/petty cash kini ditangani CashierKasKecilDanaSekolah (sub-tab sendiri).

  // Hitung jumlah siswa target saat form buat tagihan berubah

  // Debounce pencarian siswa di form buat tagihan
  useEffect(() => {
    if (activeTab !== 'history') return;
    const f = { ...historyFilter, page: 1 };
    loadHistory(f);
  }, [historyFilter.class_name, historyFilter.payment_method, historyFilter.date_from, historyFilter.date_to]);

  // Auto-trigger saat kolom cari berubah (debounce 500ms)
  useEffect(() => {
    if (activeTab !== 'history') return;
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      const f = { ...historyFilter, page: 1 };
      loadHistory(f);
    }, 500);
    return () => { if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current); };
  }, [historyFilter.q]);

  useEffect(() => {
    setSelectedBills((current) => current.filter((id) => studentDetail?.bills?.some((bill) => bill.id === id && ['belum_bayar', 'ditolak'].includes(bill.status))));
  }, [studentDetail]);

  const metrics = [
    { label: 'Kas Masuk Hari Ini', value: formatCurrency(dashboard?.summary?.today_income || 0), icon: ArrowUpRight, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Kas Keluar Hari Ini', value: formatCurrency(dashboard?.summary?.today_expense || 0), icon: ArrowDownRight, tone: 'text-rose-600 bg-rose-50' },
    { label: 'Pending Verifikasi', value: dashboard?.summary?.pending_verifications || 0, icon: Bell, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Saldo Aktif', value: formatCurrency(dashboard?.summary?.current_balance || 0), icon: Wallet, tone: 'text-blue-600 bg-blue-50' },
  ];

  const summaryCards = [
    { title: 'Pembayaran Kilat', body: 'Input NIP atau nama siswa, buka tagihan aktif, simpan pembayaran, lalu cetak bukti.' },
    { title: 'Riwayat Transaksi', body: 'Cari transaksi yang baru terjadi beberapa menit lalu untuk cetak ulang kuitansi atau audit void.' },
    { title: 'Pusat Tagihan', body: 'Buat tagihan rutin, awal tahun, kegiatan, atau impor massal via Excel tanpa bentrok dengan dashboard lain.' },
    { title: 'Daftar Siswa', body: 'Cek identitas, kontak tersimpan, dan ringkasan tagihan siswa tanpa masuk ke proses pembayaran.' },
    { title: 'Verifikasi Online', body: 'Antrean transfer pending langsung tampil agar cashier bisa approve atau reject dengan alasan.' },
    { title: 'Petty Cash', body: 'Catat pengeluaran operasional dengan lampiran foto, PDF, atau Excel dan approval limit pimpinan.' },
    { title: 'Rekapitulasi', body: 'Total pemasukan, pengeluaran, dan void audit bisa dipantau cepat berdasarkan kategori pembayaran.' },
  ];

  if (loading.shell && !dashboard) {
    return <CinematicLoading roleName="Cashier" />;
  }

  return (
    <div className={['news', 'calendar_ta'].includes(activeTab) ? 'animate-fadeIn' : 'space-y-6 pb-20 text-slate-900 animate-fadeIn'}>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className={`fixed bottom-8 right-8 z-[90] max-w-sm rounded-2xl border px-5 py-4 text-sm font-bold shadow-2xl ${toast.type === 'error' ? 'border-rose-200 bg-white text-rose-700' : 'border-blue-200 bg-white text-blue-700'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Premium Header for Cashier Dashboard (Dashboard Keuangan & Pembayaran punya hero sendiri) */}
      {activeTab !== 'news' && activeTab !== 'calendar_ta' && activeTab !== 'summary' && !['payments', 'verifications', 'history', 'generate', 'list', 'arrears', 'petty', 'cashbook', 'expenses', 'buku_kas', 'rekap', 'bulanan'].includes(activeTab) && (
        <div className="overflow-hidden rounded-[2.5rem] border border-blue-100 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f5f9ff_100%)] p-8 lg:p-10 shadow-2xl shadow-blue-100/50 mb-8">
          <div className="relative flex flex-col md:flex-row justify-between gap-8 items-start">
            <div className="space-y-3 flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">
                  {(() => {
                    const icons = {
                      summary: <Wallet className="w-4 h-4" />,
                      payments: <Wallet className="w-4 h-4" />,
                      history: <Wallet className="w-4 h-4" />,
                      billings: <Wallet className="w-4 h-4" />,
                      directory: <Wallet className="w-4 h-4" />,
                      verifications: <Wallet className="w-4 h-4" />,
                      expenses: <Wallet className="w-4 h-4" />,
                       arrears: <Wallet className="w-4 h-4" />,
                     };
                     return icons[activeTab] || <Wallet className="w-4 h-4" />;
                  })()}
                  {(() => {
                    const labels = {
                      summary: 'Portal Cashier Workspace',
                      payments: 'Portal Cashier Workspace',
                      history: 'Portal Cashier Workspace',
                      billings: 'Portal Cashier Workspace',
                      directory: 'Portal Cashier Workspace',
                      verifications: 'Portal Cashier Workspace',
                      expenses: 'Portal Cashier Workspace',
                       arrears: 'Portal Cashier Workspace',
                     };
                     return labels[activeTab] || 'Portal Cashier Workspace';
                  })()}
                </div>
              </div>
              <h1 className="text-4xl font-black tracking-tight text-slate-950">
                {activeTab === 'payments'
                  ? 'Pembayaran Kilat'
                  : activeTab === 'history'
                    ? 'Riwayat Transaksi'
                    : activeTab === 'billings'
                      ? 'Manajemen Tagihan'
                      : activeTab === 'directory'
                        ? 'Daftar Siswa'
                        : activeTab === 'verifications'
                          ? 'Verifikasi Pembayaran Online'
                          : activeTab === 'expenses'
                            ? 'Kas Kecil (Petty Cash)'
                           : activeTab === 'arrears'
                             ? 'Tunggakan Siswa'
                             : activeTab === 'summary'
                               ? 'Area Kerja Kasir'
                               : 'Dashboard'}
              </h1>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {activeTab === 'payments'
                  ? 'Input pembayaran cepat. Cari siswa, pilih tagihan, proses bayar.'
                  : activeTab === 'history'
                    ? 'Lihat, cari, filter, dan ekspor semua transaksi pembayaran.'
                    : activeTab === 'billings'
                      ? 'Buat, edit, atau hapus tagihan untuk siswa (SPP, uang gedung, iuran kegiatan, dan lain-lain).'
                      : activeTab === 'directory'
                        ? 'Lihat data siswa dan status tunggakannya. Cari, filter, dan akses tagihan per siswa.'
                        : activeTab === 'verifications'
                          ? 'Konfirmasi bukti transfer/QRIS dari siswa atau orang tua. Verifikasi pembayaran agar otomatis masuk ke sistem.'
                          : activeTab === 'expenses'
                            ? 'Catat pemasukan dan pengeluaran operasional harian. Keluar masuk uang untuk keperluan kecil sekolah.'
                             : activeTab === 'arrears'
                               ? 'Daftar siswa yang masih memiliki sisa tagihan. Urutkan dari tunggakan terbesar untuk prioritas penagihan.'
                               : activeTab === 'summary'
                                 ? 'Menjunjung Integritas Kejujuran, Loyalitas, dan Melayani dengan 5S.'
                                 : 'Pusat kendali operasional keuangan sekolah secara real-time.'}
              </p>
            </div>
            {/* Clock WIB - kanan */}
            <div className="shrink-0 flex flex-col items-end gap-1 px-5 py-3 rounded-2xl bg-slate-50 border border-gray-100">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clock.day},</span>
                <span className="text-xs font-bold text-slate-500">{clock.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-blue-600" />
                <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clock.time}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab segmented control untuk menu utama dengan >1 view (Pembayaran punya sub-tab sendiri) */}
      {activeGroup && activeGroup !== 'payment_verification' && activeGroup !== 'billing_arrears' && activeGroup !== 'cash_funds' && activeGroup !== 'reports' && CASHIER_GROUPS[activeGroup]?.length > 1 && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {CASHIER_GROUPS[activeGroup].map((leaf) => {
            const isActive = activeTab === leaf.id;
            return (
              <button
                key={leaf.id}
                type="button"
                onClick={() => setSubTab(leaf.id)}
                className={`flex-1 min-w-max rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${isActive ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                {leaf.label}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'calendar_ta' && (
        <div className="w-full space-y-8 animate-fadeIn">
          {/* Header Kalender Akademik — disamakan dengan Super Admin / Operator */}
          <div className="overflow-hidden rounded-[2rem] border border-indigo-100 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(79,70,229,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#eef2ff_100%)] p-6 lg:p-8 shadow-2xl">
            <div className="relative">
              <div className="space-y-2">
                <div className="mb-3 flex items-center gap-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <LayoutDashboard className="w-3 h-3" /> Portal Admin Academic Authority
                  </div>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Kalender &amp; Agenda Pendidikan</h1>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Pusat Kalender Akademik &amp; Penjadwalan Agenda Sekolah.
                </p>
              </div>

              {/* Clock WIB — absolute di kanan, sama seperti Super Admin / Operator */}
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
          <CalendarTab isPreviewOnly={true} />
        </div>
      )}
      {activeTab === 'news' && <InformationCenterTab />}

      {activeTab === 'summary' && (
        <CashierDashboardKeuangan
          dashboard={dashboard}
          announcements={announcements}
          goToGroup={goToGroup}
          clock={clock}
          user={user}
        />
      )}

      {activeGroup === 'payment_verification' && (
        <CashierPembayaranVerifikasi
          subTab={activeTab}
          setSubTab={setSubTab}
          user={user}
          goToGroup={goToGroup}
          initialStudentId={selectedStudentId}
          clock={clock}
        />
      )}

      {activeGroup === 'billing_arrears' && (
        <CashierTagihanTunggakan
          subTab={activeTab}
          setSubTab={setSubTab}
          user={user}
          goToGroup={goToGroup}
          clock={clock}
        />
      )}

      {activeGroup === 'cash_funds' && (
        <CashierKasKecilDanaSekolah
          subTab={activeTab}
          setSubTab={setSubTab}
          user={user}
          clock={clock}
        />
      )}

      {/* ===== MENU #5: LAPORAN & REKAPITULASI ===== */}
      {activeGroup === 'reports' && (
        <CashierLaporanRekapitulasi
          subTab={activeTab}
          setSubTab={setSubTab}
          user={user}
          goToGroup={goToGroup}
          clock={clock}
        />
      )}


      <AnimatePresence>
        {voidDialog.item && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeVoidDialog}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="relative w-full max-w-xl rounded-[32px] border border-white/60 bg-white p-6 text-slate-900 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SectionEyebrow>Void Transaksi</SectionEyebrow>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">{voidDialog.item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Pembatalan tidak menghapus data. Status transaksi akan berubah menjadi `Void`, saldo laporan disesuaikan, dan jejak audit tetap tersimpan.
                  </p>
                </div>
                <button onClick={closeVoidDialog} className="rounded-full bg-slate-100 p-2 text-slate-600">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <p className="font-bold text-slate-900">{voidDialog.item.transaction_code}</p>
                <p className="mt-2">{voidDialog.item.student?.name || 'Tanpa siswa'}{voidDialog.item.student?.school_id ? ` / ${voidDialog.item.student.school_id}` : ''}</p>
                <p className="mt-1">{formatCurrency(voidDialog.item.amount)} / {voidDialog.item.category_group}</p>
              </div>

              <div className="mt-5">
                <SectionEyebrow>Alasan Wajib</SectionEyebrow>
                <textarea
                  value={voidDialog.reason}
                  onChange={(event) => setVoidDialog((current) => ({ ...current, reason: event.target.value }))}
                  rows="4"
                  className={FIELD_CLASS}
                  placeholder="Contoh: Salah input nominal atau murid batal bayar tunai lalu ganti transfer."
                />
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button onClick={closeVoidDialog} className={SECONDARY_BUTTON}>
                  Batal
                </button>
                <button onClick={voidRecord} className={DANGER_BUTTON} disabled={!voidDialog.reason.trim()}>
                  <Ban className="h-4 w-4" />
                  Konfirmasi Void
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
