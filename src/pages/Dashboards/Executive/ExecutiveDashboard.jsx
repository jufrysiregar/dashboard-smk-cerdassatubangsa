import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import CinematicLoading from '../../../components/dashboard/shared/CinematicLoading';
import InformationCenterTab from '../../../components/dashboard/shared/InformationCenterTab';

import {
  AlertCircle,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Megaphone,
  
  Search,
  Send,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cashierAPI, managementAPI, informationCenterAPI } from '../../../utils/api';
import { MessageSquare, ShieldCheck, ArrowRight, Shield, Crown, Clock, LayoutDashboard } from 'lucide-react';
import { resolveAccessRole } from '../../../utils/userMeta';
import {
  getExecutiveMenuItems,
  getExecutiveScopeLabel,
  getExecutivePath,
  resolveExecutiveScope,
} from '../../../utils/executiveDashboard';
import MonitoringAkademik from './MonitoringAkademik';
import MonitoringKeuangan from './MonitoringKeuangan';
import LaporanKinerjaGuru from './LaporanKinerjaGuru';
import LaporanKelulusan from './LaporanKelulusan';
import ArsipAlumni from './ArsipAlumni';
import ManajemenPengguna from './ManajemenPengguna';
import DashboardEksekutif from './DashboardEksekutif';
import CalendarTab from '../AdminAkademik/components/Calendar/CalendarTab';
import WakasekMonitoringAkademik from './WakasekMonitoringAkademik';
import WakasekMonitoringPresensi from './WakasekMonitoringPresensi';
import WakasekManajemenKelas from './WakasekManajemenKelas';
import WakasekMonitoringUjian from './WakasekMonitoringUjian';
import WakasekLaporanNilaiKelulusan from './WakasekLaporanNilaiKelulusan';
import WakasekDashboardManajerial from './WakasekDashboardManajerial';

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat('id-ID');

const formatCurrency = (value) => currency.format(Number(value || 0));
const formatNumber = (value) => number.format(Number(value || 0));
const formatScore = (value) => `${Number(value || 0).toFixed(1)}`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatDate = (value) => value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const formatDateTime = (value) => value ? new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

const toneClass = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-sky-200 bg-sky-50 text-sky-700',
};

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ kicker, title, description, actions = null }) => (
  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{kicker}</p>
      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{title}</h3>
      {description ? <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{description}</p> : null}
    </div>
    {actions}
  </div>
);

const StatCard = ({ label, value, help, accent = 'from-sky-500 to-cyan-500' }) => (
  <Panel className="overflow-hidden p-5">
    <div className={`h-1.5 rounded-full bg-gradient-to-r ${accent}`} />
    <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    {help ? <p className="mt-2 text-sm font-medium text-slate-500">{help}</p> : null}
  </Panel>
);

const EmptyBlock = ({ title, description }) => (
  <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/80 px-6 py-8 text-center">
    <AlertCircle className="h-8 w-8 text-slate-300" />
    <p className="mt-4 text-sm font-black text-slate-700">{title}</p>
    <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-500">{description}</p>
  </div>
);

const downloadFile = (name, content, mime) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const rowsToCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
};

const rowsToTsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join('\t'), ...rows.map((row) => headers.map((header) => String(row[header] ?? '')).join('\t'))].join('\n');
};

export default function ExecutiveDashboard({ activeTab = 'overview', user }) {
  const navigate = useNavigate();
  const accessRole = resolveAccessRole(user);
  const scope = resolveExecutiveScope(user);
  const menuItems = getExecutiveMenuItems(user);
  const currentItem = menuItems.find((item) => item.id === activeTab) || menuItems[0];
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [searchText, setSearchText] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalNotes, setApprovalNotes] = useState({});
  const [approvalAction, setApprovalAction] = useState(null);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [clock, setClock] = useState({ time: '', day: '', date: '' });

  useEffect(() => {
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
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [statsRes, annRes] = await Promise.all([
        managementAPI.getStats(),
        informationCenterAPI.getInfos({ per_page: 5 }),
      ]);

      setStats(statsRes.data.data);
      setAnnouncements(annRes.data?.data || []);
    } catch (error) {
      setNotice({ type: 'error', message: error.response?.data?.message || 'Dashboard eksekutif gagal dimuat.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    return undefined;
  }, []);

  useEffect(() => {
    if (activeTab === 'news') {
      return undefined;
    }

    const interval = window.setInterval(fetchStats, 120000);
    return () => window.clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const executive = stats?.executive || {};
  const overview = executive.overview || {};
  const academics = executive.academics || {};
  const studentAffairs = executive.student_affairs || {};
  const staffing = executive.staffing || {};
  const finance = executive.finance || {};
  const facilities = executive.facilities || {};
  const analytics = executive.analytics || {};
  const sharedAnnouncements = executive.shared_announcements || [];
  const workflow = stats?.workflow || {};
  const metaCoverage = executive.meta?.data_coverage || {};
  const periodData = overview.attendance?.[selectedPeriod] || [];
  const scopeSummaries = executive.vice_principal?.scope_summaries || {};
  const scopeSummary = scope ? scopeSummaries[scope] : null;
  const classOptions = useMemo(() => ['all', ...(academics.score_by_class || []).map((item) => item.class_name)], [academics.score_by_class]);

  const filteredClassRows = useMemo(() => (academics.score_by_class || []).filter((item) => {
    const text = `${item.class_name} ${item.department_name} ${item.homeroom_teacher || ''}`.toLowerCase();
    const classMatch = classFilter === 'all' || item.class_name === classFilter;
    const statusMatch = statusFilter === 'all' || (item.status || '').toLowerCase().includes(statusFilter.toLowerCase());
    return classMatch && statusMatch && text.includes(searchText.toLowerCase());
  }), [academics.score_by_class, classFilter, searchText, statusFilter]);

  const filteredInventory = useMemo(() => (facilities.inventory_list || []).filter((item) => {
    const text = `${item.name} ${item.location} ${item.jurusan || ''} ${item.condition}`.toLowerCase();
    return text.includes(searchText.toLowerCase());
  }), [facilities.inventory_list, searchText]);

  const exportRows = useMemo(() => {
    switch (activeTab) {
      case 'academics':
      case 'curriculum_report':
        return filteredClassRows.map((row) => ({
          Kelas: row.class_name,
          Jurusan: row.department_name,
          WaliKelas: row.homeroom_teacher || '-',
          RataNilai: row.average_score ?? 'N/A',
          Status: row.status,
        }));
      case 'finance':
        return (finance.arrears_students || []).map((row) => ({
          Siswa: row.student_name,
          NIS: row.school_id,
          Tagihan: row.bill_count,
          TotalTunggakan: row.total_due,
          JatuhTempoTerakhir: row.latest_due_date || '-',
        }));
      case 'facilities':
      case 'facility_inventory':
        return filteredInventory.map((row) => ({
          Nama: row.name,
          Lokasi: row.location,
          Jumlah: row.quantity,
          Kondisi: row.condition,
          Jurusan: row.jurusan || '-',
        }));
      default:
        return (overview.period_comparison || []).map((row) => ({
          Metrik: row.label,
          SaatIni: row.current,
          Sebelumnya: row.previous,
          Format: row.format,
        }));
    }
  }, [activeTab, filteredClassRows, filteredInventory, finance.arrears_students, overview.period_comparison]);

  const handleExport = (mode) => {
    if (!exportRows.length) {
      setNotice({ type: 'error', message: 'Belum ada data yang bisa diekspor pada panel ini.' });
      return;
    }

    if (mode === 'csv') {
      downloadFile(`${currentItem?.id || 'executive'}.csv`, rowsToCsv(exportRows), 'text/csv;charset=utf-8');
      setNotice({ type: 'success', message: 'Ekspor CSV berhasil dibuat.' });
      return;
    }

    if (mode === 'excel') {
      downloadFile(`${currentItem?.id || 'executive'}.xls`, `\ufeff${rowsToTsv(exportRows)}`, 'application/vnd.ms-excel');
      setNotice({ type: 'success', message: 'Ekspor Excel berhasil dibuat.' });
      return;
    }

    const popup = window.open('', '_blank', 'width=960,height=720');
    if (!popup) {
      setNotice({ type: 'error', message: 'Popup diblokir. Izinkan popup untuk ekspor PDF/print.' });
      return;
    }

    popup.document.write(`<html><head><title>${currentItem?.title || 'Laporan Executive'}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f8fafc}</style></head><body><h2>${currentItem?.title || 'Laporan Executive'}</h2><table><thead><tr>${Object.keys(exportRows[0]).map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${exportRows.map((row) => `<tr>${Object.values(row).map((value) => `<td>${value ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handleExpenseAction = async (item, action) => {
    const note = approvalNotes[item.id]?.trim() || '';
    if (action === 'reject' && !note) {
      setNotice({ type: 'error', message: 'Alasan penolakan wajib diisi sebelum menolak pengajuan.' });
      return;
    }

    try {
      setApprovalAction(`${action}-${item.id}`);
      if (action === 'approve') {
        await cashierAPI.approveExpense(item.id, { note: note || 'Disetujui pimpinan sekolah.' });
        setNotice({ type: 'success', message: `Pengeluaran ${item.transaction_code} berhasil disetujui.` });
      } else {
        await cashierAPI.rejectExpense(item.id, { reason: note });
        setNotice({ type: 'success', message: `Pengeluaran ${item.transaction_code} berhasil ditolak.` });
      }

      const response = await managementAPI.getStats();
      setStats(response.data.data);
      setApprovalNotes((current) => ({ ...current, [item.id]: '' }));
    } catch (error) {
      setNotice({ type: 'error', message: error.response?.data?.message || 'Approval keuangan gagal diproses.' });
    } finally {
      setApprovalAction(null);
    }
  };

  const handleSendAnnouncement = async (event) => {
    event.preventDefault();

    try {
      await managementAPI.postAnnouncement({
        title: announcementTitle,
        content: announcementText,
        target_roles: ['guru', 'murid', 'cashier', 'operator', 'admin_akademik'],
      });
      setAnnouncementTitle('');
      setAnnouncementText('');
      setShowAnnounceModal(false);
      setNotice({ type: 'success', message: 'Pengumuman berhasil dipublikasikan ke dashboard terkait.' });
      const response = await managementAPI.getStats();
      setStats(response.data.data);
    } catch (error) {
      setNotice({ type: 'error', message: error.response?.data?.message || 'Pengumuman gagal dipublikasikan.' });
    }
  };

  const renderMetrics = (items, accents = []) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <StatCard
          key={`${item.label}-${index}`}
          label={item.label}
          value={typeof item.value === 'number' ? formatNumber(item.value) : item.value}
          help={item.help}
          accent={accents[index % Math.max(accents.length, 1)] || 'from-sky-500 to-cyan-500'}
        />
      ))}
    </div>
  );

  const renderListPanel = (title, description, items, renderItem, emptyTitle, emptyDescription) => (
    <Panel className="h-full">
      <SectionTitle kicker="Detail" title={title} description={description} />
      <div className="mt-6 space-y-3">
        {items?.length ? items.map(renderItem) : <EmptyBlock title={emptyTitle} description={emptyDescription} />}
      </div>
    </Panel>
  );

  const renderOverview = (hideScopeSummary = false) => (
    <div className="space-y-8">
      {/* BARIS 1: Kartu Ringkasan (4 kartu) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Siswa Aktif" value={formatNumber(stats?.counts?.students || 0)} accent="from-sky-500 to-cyan-500" />
        <StatCard label="Total Guru" value={formatNumber(stats?.counts?.teachers || 0)} accent="from-emerald-500 to-teal-500" />
        <StatCard label="Total Kelas" value={formatNumber(stats?.counts?.classes || 0)} accent="from-amber-500 to-orange-500" />
        <StatCard label="Tingkat Kelulusan" value={`${formatNumber(stats?.graduation_rate || 0)}%`} accent="from-purple-500 to-pink-500" />
      </div>

      {/* BARIS 2: Grafik Tren Nilai Rata-rata Sekolah */}
      <Panel>
        <SectionTitle 
          kicker="Tren Akademik" 
          title="Tren Rata-rata Nilai Ujian (per Semester)" 
          description="Line chart menampilkan tren nilai rata-rata sekolah per semester dengan filter mata pelajaran."
          actions={(
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500">
                <Filter className="h-4 w-4" />
                <select className="bg-transparent outline-none">
                  <option value="all">Semua Mata Pelajaran</option>
                  <option value="matematika">Matematika</option>
                  <option value="bahasa">Bahasa Indonesia</option>
                  <option value="inggris">Bahasa Inggris</option>
                  <option value="ipa">IPA</option>
                  <option value="ips">IPS</option>
                </select>
              </label>
            </div>
          )}
        />
        <div className="mt-6 h-80">
          {stats?.grade_trends && stats.grade_trends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.grade_trends}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="nilai" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} name="Rata-rata Nilai" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyBlock title="Belum ada data tren nilai" description="Data tren nilai per semester akan muncul setelah sistem memiliki data nilai yang cukup." />
          )}
        </div>
      </Panel>

      {/* BARIS 3: Grafik Kehadiran Guru vs Siswa */}
      <Panel>
        <SectionTitle 
          kicker="Persentase Kehadiran" 
          title="Persentase Kehadiran Bulan Ini" 
          description="Bar chart menampilkan persentase kehadiran guru dan siswa bulan ini."
        />
        <div className="mt-6 h-80">
          {stats?.attendance ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { kategori: 'Guru', persentase: stats.attendance.teacher_rate || 0 },
                { kategori: 'Siswa', persentase: stats.attendance.student_rate || 0 },
              ]}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="kategori" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Bar dataKey="persentase" fill="#2563eb" radius={[10, 10, 0, 0]} name="Persentase Kehadiran" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyBlock title="Belum ada data kehadiran" description="Data kehadiran guru dan siswa akan muncul setelah sistem presensi aktif." />
          )}
        </div>
      </Panel>

      {/* BARIS 4: Ringkasan Keuangan Cepat */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Panel className="p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Total Pemasukan Bulan Ini</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats?.financial?.monthly_income || 0)}</p>
        </Panel>
        <Panel className="p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Total Tunggakan</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats?.workflow?.open_bill_count || 0)}</p>
        </Panel>
        <Panel className="p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Persentase Pembayaran</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{formatNumber(stats?.financial?.payment_rate || 0)}%</p>
        </Panel>
      </div>

      {/* BARIS 5: Pengumuman Terbaru (Preview dari Pusat Informasi) */}
      <Panel className="!p-0 overflow-hidden">
         <div className="p-6 border-b border-indigo-50 flex items-center justify-between bg-indigo-50/20">
            <div className="flex items-center gap-3">
               <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
                  <MessageSquare size={18} />
               </div>
               <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Pengumuman Terbaru</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5">Preview dari Pusat Informasi</p>
               </div>
            </div>
            <button 
               onClick={() => navigate(getExecutivePath(user, 'news'))}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-900 hover:text-white"
            >
              Lihat Semua
            </button>
         </div>
         <div className="p-6">
            <p className="text-sm text-slate-600 mb-4">2 pengumuman terbaru yang targetnya termasuk Kepala Sekolah</p>
            {announcements && announcements.length > 0 ? (
              <div className="space-y-4">
                {announcements.slice(0, 2).map(info => (
                  <div 
                    key={info.id}
                    onClick={() => window.dispatchEvent(new CustomEvent('navigateDashboard', { detail: 'news' }))}
                    className="p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-lg cursor-pointer transition-all"
                  >
                     <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          info.type === 'Peringatan' ? 'bg-rose-50 text-rose-500' : 
                          info.type === 'Berita' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'
                        }`}>
                           {info.type === 'Peringatan' ? <ShieldCheck size={20} /> : <MessageSquare size={20} />}
                        </div>
                        <div className="min-w-0 flex-1">
                           <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{info.title}</h4>
                           <p className="text-xs text-slate-500 mt-2 line-clamp-2">{info.content?.replace(/<[^>]*>?/gm, '')}</p>
                           <p className="text-xs text-slate-400 mt-2">{formatDateTime(info.created_at)}</p>
                        </div>
                     </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center rounded-[2.5rem] border-2 border-dashed border-slate-100">
                 <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Belum ada pengumuman</p>
              </div>
            )}
         </div>
      </Panel>
    </div>
  );

  const renderAcademics = () => (
    <div className="space-y-8">
      {renderMetrics([
        { label: 'Mapel Terekam', value: academics.subject_overview?.length || 0, help: 'Berbasis submission nilai yang sudah masuk.' },
        { label: 'Siswa Berprestasi', value: academics.top_students?.length || 0, help: 'Rerata nilai terbaik.' },
        { label: 'Perlu Perhatian', value: academics.attention_students?.length || 0, help: 'Rerata nilai di bawah ambang aman.' },
        { label: 'Ujian Terjadwal', value: academics.exam_schedule?.length || 0, help: 'Paket soal dengan jadwal aktif.' },
      ], ['from-indigo-500 to-sky-500', 'from-emerald-500 to-teal-500', 'from-rose-500 to-orange-500', 'from-amber-500 to-yellow-500'])}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr,1fr]">
        <Panel>
          <SectionTitle kicker="Performa" title="Tren performa akademik" description="Nilai rata-rata siswa berdasarkan submission kuis yang sudah masuk." />
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={academics.performance_trend || []}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="average_score" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} name="Nilai Rata-rata" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        {renderListPanel('Top & Attention', 'Daftar siswa unggul dan siswa yang perlu intervensi.', [...(academics.top_students || []).slice(0, 3), ...(academics.attention_students || []).slice(0, 3)], (item, index) => <div key={`${item.student_id}-${index}`} className="rounded-[1.4rem] border border-slate-100 bg-slate-50 px-4 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{item.student_name}</p><p className="mt-1 text-xs font-medium text-slate-500">{item.school_id} / {item.class_name || 'Kelas belum terhubung'}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${item.status === 'Berprestasi' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{item.status}</span></div><p className="mt-3 text-sm font-medium text-slate-600">Rata-rata nilai: <span className="font-black text-slate-900">{formatScore(item.average_score)}</span></p></div>, 'Belum ada data siswa', 'Submission nilai belum cukup untuk menyusun leaderboard siswa.')}
      </div>

      <Panel>
        <SectionTitle kicker="Monitoring Nilai" title="Per kelas dan mata pelajaran" description="Gunakan filter untuk menyaring kelas tertentu, status, atau pencarian wali kelas/jurusan." actions={(
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500"><Filter className="h-4 w-4" /><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="bg-transparent outline-none">{classOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'Semua kelas' : item}</option>)}</select></label>
            <label className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500"><ClipboardList className="h-4 w-4" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent outline-none"><option value="all">Semua status</option><option value="Aman">Aman</option><option value="Perlu">Perlu perhatian</option><option value="Menunggu">Menunggu data</option></select></label>
            <label className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500"><Search className="h-4 w-4" /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Cari kelas/jurusan" className="w-full bg-transparent outline-none" /></label>
          </div>
        )} />
        <div className="mt-6 overflow-x-auto">
          {filteredClassRows.length ? <table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-400"><th className="px-3 py-3 font-black">Kelas</th><th className="px-3 py-3 font-black">Jurusan</th><th className="px-3 py-3 font-black">Wali Kelas</th><th className="px-3 py-3 font-black">Mapel</th><th className="px-3 py-3 font-black">Nilai</th><th className="px-3 py-3 font-black">Status</th></tr></thead><tbody>{filteredClassRows.map((row) => <tr key={row.class_name} className="border-b border-slate-100"><td className="px-3 py-4 font-black text-slate-900">{row.class_name}</td><td className="px-3 py-4 text-slate-600">{row.department_name}</td><td className="px-3 py-4 text-slate-600">{row.homeroom_teacher || '-'}</td><td className="px-3 py-4 text-slate-600">{row.subject_count}</td><td className="px-3 py-4 text-slate-600">{row.average_score == null ? 'N/A' : formatScore(row.average_score)}</td><td className="px-3 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{row.status}</span></td></tr>)}</tbody></table> : <EmptyBlock title="Belum ada baris kelas yang cocok" description="Coba longgarkan filter atau tunggu data nilai per kelas masuk lebih lengkap." />}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {renderListPanel('Jadwal Ujian / Ulangan', 'Paket soal yang sudah memiliki jadwal mulai atau deadline.', academics.exam_schedule || [], (item) => <div key={item.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50 px-4 py-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.type} / {item.subject || 'Mapel'}</p><p className="mt-2 text-sm font-black text-slate-900">{item.title}</p><p className="mt-2 text-sm text-slate-600">Mulai {formatDateTime(item.start_at)} Â· Deadline {formatDateTime(item.deadline_at)}</p></div>, 'Belum ada ujian terjadwal', 'Bank soal akan muncul di sini setelah memiliki jadwal aktif.')}
        {renderListPanel('Rekap Kehadiran Guru Mengajar', 'Kehadiran guru dibaca dari presensi kerja yang memakai konteks mengajar.', academics.teacher_presence || [], (item) => <div key={item.teacher_id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50 px-4 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{item.teacher_name}</p><p className="mt-1 text-xs font-medium text-slate-500">{item.school_id}</p></div><span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">{formatPercent(item.attendance_rate)}</span></div><p className="mt-3 text-sm text-slate-600">{item.class_count} kelas Â· {item.subject_count} mapel Â· sesi tercatat {item.teaching_sessions}</p></div>, 'Belum ada presensi guru', 'Presensi mengajar akan tampil saat guru sudah melakukan check-in dengan konteks mengajar.')}
      </div>
    </div>
  );

  const renderStudentAffairs = () => (
    <div className="space-y-8">
      {renderMetrics((studentAffairs.demographics || []).map((item) => ({ label: item.label, value: item.value })), ['from-fuchsia-500 to-pink-500', 'from-sky-500 to-cyan-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500'])}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {renderListPanel('Prestasi Siswa', 'Mengambil siswa dengan rerata nilai tertinggi saat ini.', studentAffairs.achievements || [], (item) => <div key={item.student_id} className="rounded-[1.4rem] border border-emerald-100 bg-emerald-50 px-4 py-4"><p className="text-sm font-black text-slate-900">{item.student_name}</p><p className="mt-1 text-xs font-medium text-slate-500">{item.school_id} / {item.class_name || 'Kelas belum terhubung'}</p><p className="mt-3 text-sm text-emerald-700">Rata-rata nilai {formatScore(item.average_score)}</p></div>, 'Belum ada prestasi yang terekam', 'Leaderboard prestasi akan aktif setelah submission nilai bertambah.')}
        {renderListPanel('Siswa Perlu Perhatian', 'Dipakai untuk pembinaan awal sambil menunggu modul pelanggaran dan BK yang lebih detail.', academics.attention_students || [], (item) => <div key={item.student_id} className="rounded-[1.4rem] border border-rose-100 bg-rose-50 px-4 py-4"><p className="text-sm font-black text-slate-900">{item.student_name}</p><p className="mt-1 text-xs font-medium text-slate-500">{item.school_id} / {item.class_name || 'Kelas belum terhubung'}</p><p className="mt-3 text-sm text-rose-700">Rata-rata nilai {formatScore(item.average_score)}</p></div>, 'Belum ada daftar perhatian khusus', 'Saat ini belum ada siswa dengan rerata nilai di bawah ambang aman.')}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel><SectionTitle kicker="Absensi" title="Monitoring absensi siswa" description="Modul absensi siswa belum ada di backend, jadi blok ini saya siapkan sebagai slot integrasi berikutnya." /><div className="mt-6">{metaCoverage.student_attendance ? null : <EmptyBlock title="Absensi siswa belum terhubung" description="Begitu tabel absensi siswa tersedia, grafik harian/mingguan/bulanan akan hidup otomatis di panel ini." />}</div></Panel>
        <Panel><SectionTitle kicker="Disiplin" title="Pelanggaran & pembinaan" description="Saat ini panel menggunakan siswa yang perlu perhatian akademik sebagai indikator awal pembinaan." /><div className="mt-6">{academics.attention_students?.length ? academics.attention_students.slice(0, 4).map((item) => <div key={item.student_id} className="mb-3 rounded-[1.4rem] border border-slate-100 bg-slate-50 px-4 py-4"><p className="text-sm font-black text-slate-900">{item.student_name}</p><p className="mt-1 text-xs text-slate-500">{item.school_id}</p></div>) : <EmptyBlock title="Belum ada catatan pembinaan" description="Integrasi pelanggaran, poin, dan pembinaan siswa masih belum tersedia di skema database saat ini." />}</div></Panel>
        <Panel><SectionTitle kicker="Kegiatan" title="Ekskul, OSIS, dan mutasi" description="Tempat untuk aktivitas siswa non-akademik dan mutasi masuk/keluar saat modulnya sudah siap." /><div className="mt-6"><EmptyBlock title="Belum ada data ekskul / mutasi" description="Saya sengaja menyiapkan slot ini agar struktur dashboard sudah siap saat tabel kegiatan siswa ditambahkan nanti." /></div></Panel>
      </div>
    </div>
  );

  const renderStaffing = () => (
    <div className="space-y-8">
      {renderMetrics([
        { label: 'Guru', value: staffing.headcount?.teachers || 0 },
        { label: 'Staf', value: staffing.headcount?.staff || 0 },
        { label: 'Honorer', value: staffing.headcount?.honorer || 0 },
        { label: 'Magang', value: staffing.headcount?.magang || 0 },
      ], ['from-blue-500 to-indigo-600', 'from-cyan-500 to-sky-500', 'from-amber-500 to-yellow-500', 'from-fuchsia-500 to-pink-500'])}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,1fr]">
        <Panel>
          <SectionTitle kicker="Presensi" title="Absensi guru dan staf" description="Ringkasan harian dari presensi kerja yang masuk hari ini." />
          <div className="mt-6 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={staffing.attendance_trend || []}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip /><Legend /><Bar dataKey="present" name="Total Hadir" fill="#0f766e" radius={[8, 8, 0, 0]} /><Bar dataKey="teaching" name="Konteks Mengajar" fill="#2563eb" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Panel>
        {renderListPanel('Performa Mengajar', 'Diambil dari input penilaian performa guru yang sudah tersedia.', staffing.teaching_performance || [], (item) => <div key={item.teacher_id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50 px-4 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{item.teacher_name}</p><p className="mt-1 text-xs text-slate-500">{item.school_id}</p></div><span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">{formatScore(item.average_score)}</span></div><p className="mt-3 text-sm text-slate-600">Penilaian terakhir {formatDate(item.latest_assessment)}</p></div>, 'Belum ada data performa', 'Input performa mengajar dari waka kurikulum belum tersedia saat ini.')}
      </div>
      <Panel><SectionTitle kicker="Daftar Hadir" title="Status guru dan staf hari ini" description="Bisa dipakai untuk briefing cepat, cek siapa yang sudah check-in, dan siapa yang belum." /><div className="mt-6 overflow-x-auto">{(staffing.attendance_list || []).length ? <table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-400"><th className="px-3 py-3 font-black">Nama</th><th className="px-3 py-3 font-black">Role</th><th className="px-3 py-3 font-black">Status</th><th className="px-3 py-3 font-black">Check-in</th><th className="px-3 py-3 font-black">Jam</th></tr></thead><tbody>{staffing.attendance_list.map((row) => <tr key={row.user_id} className="border-b border-slate-100"><td className="px-3 py-4 font-black text-slate-900">{row.name}</td><td className="px-3 py-4 text-slate-600">{row.role}</td><td className="px-3 py-4 text-slate-600">{row.status}</td><td className="px-3 py-4 text-slate-600">{formatDateTime(row.check_in_at)}</td><td className="px-3 py-4 text-slate-600">{formatNumber(row.total_minutes || 0)} menit</td></tr>)}</tbody></table> : <EmptyBlock title="Belum ada presensi staf" description="Status kepegawaian akan tampil setelah data check-in/check-out masuk." />}</div></Panel>
    </div>
  );

  const renderFinance = () => (
    <div className="space-y-8">
      {renderMetrics([
        { label: 'SPP Lunas', value: finance.spp_summary?.paid || 0 },
        { label: 'Belum Bayar', value: finance.spp_summary?.pending || 0 },
        { label: 'Verifikasi', value: finance.spp_summary?.verification || 0 },
        { label: 'Terlambat', value: finance.spp_summary?.overdue || 0 },
      ], ['from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-sky-500 to-blue-600', 'from-rose-500 to-red-600'])}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr,1fr]">
        <Panel><SectionTitle kicker="Cashflow" title="Pemasukan dan pengeluaran" description="Laporan bulanan yang sama dipakai untuk dashboard kepala sekolah dan laporan analitik." /><div className="mt-6 h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={finance.cashflow || []}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => formatCurrency(value)} /><Legend /><Area type="monotone" dataKey="income" name="Pemasukan" stroke="#0f766e" fill="#99f6e4" strokeWidth={3} /><Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#dc2626" fill="#fecaca" strokeWidth={3} /></AreaChart></ResponsiveContainer></div></Panel>
        {renderListPanel('Siswa Menunggak', 'Daftar prioritas follow-up pembayaran.', finance.arrears_students || [], (item) => <div key={item.student_id} className="rounded-[1.4rem] border border-amber-100 bg-amber-50 px-4 py-4"><p className="text-sm font-black text-slate-900">{item.student_name}</p><p className="mt-1 text-xs text-slate-500">{item.school_id}</p><p className="mt-3 text-sm text-amber-700">{item.bill_count} tagihan Â· {formatCurrency(item.total_due)}</p></div>, 'Belum ada daftar tunggakan', 'Semua tagihan siswa saat ini terpantau aman atau belum ada data billing aktif.')}
      </div>
      {renderListPanel('Approval Pengeluaran', 'Pengajuan petty cash yang membutuhkan keputusan pimpinan.', workflow.approval_queue || [], (item) => <div key={item.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 px-4 py-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.transaction_code}</p><p className="mt-2 text-sm font-black text-slate-900">{item.title}</p><p className="mt-2 text-sm text-slate-600">{item.category} Â· {formatCurrency(item.amount)}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Pending</span></div><textarea rows="2" value={approvalNotes[item.id] || ''} onChange={(event) => setApprovalNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Catatan approval / alasan penolakan" className="mt-4 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900" /><div className="mt-3 grid grid-cols-2 gap-3"><button type="button" disabled={approvalAction !== null} onClick={() => handleExpenseAction(item, 'approve')} className="rounded-[1.2rem] bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{approvalAction === `approve-${item.id}` ? 'Memproses...' : 'Approve'}</button><button type="button" disabled={approvalAction !== null} onClick={() => handleExpenseAction(item, 'reject')} className="rounded-[1.2rem] bg-rose-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{approvalAction === `reject-${item.id}` ? 'Memproses...' : 'Reject'}</button></div></div>, 'Tidak ada approval tertunda', 'Semua pengajuan pengeluaran sudah berada dalam status yang jelas.')}
    </div>
  );

  const renderFacilities = () => (
    <div className="space-y-8">
      {renderMetrics([
        { label: 'Inventaris', value: facilities.summary?.inventory_total || 0 },
        { label: 'Kondisi Baik', value: facilities.summary?.good || 0 },
        { label: 'Butuh Atensi', value: facilities.summary?.requires_attention || 0 },
        { label: 'Issue Aktif', value: facilities.summary?.issues_open || 0 },
      ], ['from-sky-500 to-cyan-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-red-600'])}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,1fr]">
        <Panel><SectionTitle kicker="Kondisi" title="Status fasilitas sekolah" description="Mengambil kondisi barang dari inventaris dan laporan issue sarpras." /><div className="mt-6 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={facilities.condition_breakdown || []}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
        {renderListPanel('Jadwal Maintenance', 'Prioritas perawatan berdasarkan laporan kerusakan atau kondisi inventaris.', facilities.maintenance_schedule || [], (item, index) => <div key={`${item.title}-${index}`} className="rounded-[1.4rem] border border-slate-100 bg-slate-50 px-4 py-4"><p className="text-sm font-black text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.location || 'Lokasi belum diisi'}</p><p className="mt-3 text-sm text-slate-600">{item.status} Â· jadwal {formatDate(item.scheduled_for)}</p></div>, 'Belum ada jadwal maintenance', 'Jadwal perawatan akan muncul saat ada issue terbuka atau inventaris berstatus rusak.')}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {renderListPanel('Laporan Kerusakan', 'Ringkasan issue inventaris terbaru.', facilities.damage_reports || [], (item) => <div key={item.id} className="rounded-[1.4rem] border border-rose-100 bg-rose-50 px-4 py-4"><p className="text-sm font-black text-slate-900">{item.item_name}</p><p className="mt-1 text-xs text-slate-500">{item.location || 'Tanpa lokasi'} Â· {item.type}</p><p className="mt-3 text-sm text-rose-700">{item.status} Â· qty {formatNumber(item.quantity || 0)}</p></div>, 'Belum ada laporan kerusakan', 'Tidak ada issue inventaris aktif saat ini.')}
        <Panel><SectionTitle kicker="Inventaris" title="Daftar inventaris" description="Bisa dicari per nama barang, lokasi, jurusan, atau kondisi." /><div className="mt-6 flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500"><Search className="h-4 w-4" /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Cari inventaris" className="w-full bg-transparent outline-none" /></div><div className="mt-6 overflow-x-auto">{filteredInventory.length ? <table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-400"><th className="px-3 py-3 font-black">Nama</th><th className="px-3 py-3 font-black">Lokasi</th><th className="px-3 py-3 font-black">Jumlah</th><th className="px-3 py-3 font-black">Kondisi</th></tr></thead><tbody>{filteredInventory.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="px-3 py-4 font-black text-slate-900">{row.name}</td><td className="px-3 py-4 text-slate-600">{row.location}</td><td className="px-3 py-4 text-slate-600">{formatNumber(row.quantity)}</td><td className="px-3 py-4 text-slate-600">{row.condition}</td></tr>)}</tbody></table> : <EmptyBlock title="Inventaris tidak ditemukan" description="Coba kata kunci lain atau tunggu data inventaris masuk lebih lengkap." />}</div></Panel>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-8">
      {renderMetrics((analytics.comparison_cards || []).map((item) => ({ label: item.label, value: item.format === 'currency' ? formatCurrency(item.current) : item.format === 'percent' ? formatPercent(item.current) : formatScore(item.current), help: `Sebelumnya: ${item.format === 'currency' ? formatCurrency(item.previous) : item.format === 'percent' ? formatPercent(item.previous) : formatScore(item.previous)}` })), ['from-slate-900 to-slate-700', 'from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500'])}
      <Panel><SectionTitle kicker="Long Term" title="Grafik tren jangka panjang" description="Menggabungkan saldo bulanan, performa akademik, dan persentase kehadiran guru." /><div className="mt-6 h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.long_term_trend || []}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip /><Legend /><Line yAxisId="left" dataKey="balance" name="Saldo" stroke="#0f766e" strokeWidth={3} /><Line yAxisId="right" dataKey="average_score" name="Rata-rata Nilai" stroke="#2563eb" strokeWidth={3} /><Line yAxisId="right" dataKey="teacher_presence" name="Kehadiran Guru" stroke="#f97316" strokeWidth={3} /></LineChart></ResponsiveContainer></div></Panel>
    </div>
  );

  const renderScopedOverview = (summary, title) => (
    <div className="space-y-8">
      <Panel><SectionTitle kicker="Bidang Wakasek" title={title} description={summary?.headline || 'Ringkasan bidang untuk membantu fokus kerja wakasek pada area yang relevan.'} /><div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{(summary?.stats || []).map((item) => <StatCard key={item.label} label={item.label} value={formatNumber(item.value)} accent="from-blue-500 to-indigo-600" />)}</div></Panel>
      {renderOverview(true)}
    </div>
  );

  const renderActiveSection = () => {
    switch (activeTab) {
      case 'overview': return accessRole === 'wakil_sekolah' ? <WakasekDashboardManajerial stats={stats} clock={clock} user={user} announcements={announcements} navigate={navigate} accessRole={accessRole} /> : <DashboardEksekutif stats={stats} clock={clock} user={user} announcements={announcements} navigate={navigate} accessRole={accessRole} />;
      case 'calendar_ta': return (
        <div className="w-full space-y-8 animate-fadeIn">
          {/* Header Badge â€” mirip Admin Akademik */}
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
          <CalendarTab isPreviewOnly={true} isWakasek={accessRole === 'wakil_sekolah'} />
        </div>
      );
      case 'news': return <InformationCenterTab />;
      
      // WAKASEK SPECIFIC ROUTES
      case 'wakasek_academics': return <WakasekMonitoringAkademik stats={stats} clock={clock} accessRole={accessRole} user={user} />;
      case 'wakasek_attendance': return <WakasekMonitoringPresensi stats={stats} clock={clock} accessRole={accessRole} user={user} />;
      case 'wakasek_class_management': return <WakasekManajemenKelas stats={stats} clock={clock} accessRole={accessRole} user={user} onRefresh={fetchStats} />;
      case 'wakasek_exams': return <WakasekMonitoringUjian stats={stats} clock={clock} accessRole={accessRole} user={user} />;
      case 'wakasek_graduation': return <WakasekLaporanNilaiKelulusan stats={stats} clock={clock} accessRole={accessRole} user={user} />;

      case 'academics': 
      case 'curriculum_report': 
      case 'curriculum_exams': 
      case 'curriculum_rpp': 
      case 'curriculum_schedule': 
        return <MonitoringAkademik stats={stats} clock={clock} accessRole={accessRole} />;
      case 'finance': return <MonitoringKeuangan stats={stats} clock={clock} accessRole={accessRole} />;
      case 'teacher_performance': return <LaporanKinerjaGuru stats={stats} clock={clock} accessRole={accessRole} />;
      case 'graduation_report': return <LaporanKelulusan stats={stats} clock={clock} accessRole={accessRole} />;
      case 'alumni_archive': return <ArsipAlumni stats={stats} clock={clock} accessRole={accessRole} />;
      case 'user_management': return <ManajemenPengguna stats={stats} clock={clock} accessRole={accessRole} />;
      case 'student_affairs': case 'student_attendance': case 'student_discipline': case 'student_organizations': case 'student_achievements': case 'student_counseling': return renderStudentAffairs();
      case 'staffing': return renderStaffing();
      case 'facilities': case 'facility_inventory': case 'facility_maintenance': case 'facility_procurement': case 'facility_rooms': return renderFacilities();
      case 'analytics': return renderAnalytics();
      case 'public_alumni': case 'public_partnerships': case 'public_publications': case 'public_admissions': return renderListPanel('Publikasi & Humas', 'Menggunakan feed pengumuman dan slot integrasi untuk alumni, kerjasama, dan PPDB.', sharedAnnouncements, (item) => <div key={item.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50 px-4 py-4"><p className="text-sm font-black text-slate-900">{item.title}</p><p className="mt-2 text-sm text-slate-600">{item.content?.replace(/<[^>]*>?/gm, '')}</p><p className="mt-3 text-xs text-slate-500">Oleh {item.author || 'Sistem'} Â· {formatDateTime(item.created_at)}</p></div>, 'Belum ada publikasi sekolah', 'Feed publikasi akan tampil di sini setelah pengumuman atau berita sekolah diposting.');
      case 'vice_scope_kurikulum': return renderScopedOverview(scopeSummaries.kurikulum, 'Preview Bidang Kurikulum');
      case 'vice_scope_kesiswaan': return renderScopedOverview(scopeSummaries.kesiswaan, 'Preview Bidang Kesiswaan');
      case 'vice_scope_humas': return renderScopedOverview(scopeSummaries.humas, 'Preview Bidang Humas');
      case 'vice_scope_sarpras': return renderScopedOverview(scopeSummaries.sarpras, 'Preview Bidang Sarpras');
      default: 
        if (accessRole === 'wakil_sekolah') return <WakasekDashboardManajerial stats={stats} clock={clock} user={user} announcements={announcements} navigate={navigate} accessRole={accessRole} />;
        return renderOverview();
    }
  };

  if (loading && !stats) {
    return <CinematicLoading roleName={accessRole === 'kepala_sekolah' ? "Kepala Sekolah" : "Wakil Sekolah"} />;
  }

  return (
    <div className={['news', 'calendar_ta'].includes(activeTab) ? 'animate-fadeIn' : 'space-y-8 pb-20 animate-fadeIn'}>
      <AnimatePresence>{notice ? <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className={`rounded-[1.5rem] border px-5 py-4 text-sm font-black ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{notice.message}</motion.div> : null}</AnimatePresence>

      {!(['news', 'calendar_ta', 'academics', 'graduation_report', 'finance', 'teacher_performance', 'alumni_archive', 'user_management', 'curriculum_report', 'curriculum_exams', 'curriculum_rpp', 'curriculum_schedule'].includes(activeTab) || activeTab === 'overview' || (['wakasek_class_management', 'wakasek_academics', 'wakasek_exams', 'wakasek_attendance', 'wakasek_graduation'].includes(activeTab) && accessRole === 'wakil_sekolah')) && (
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-6 lg:p-8 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
                <ShieldCheck className="h-3 w-3" /> {accessRole === 'kepala_sekolah' ? 'Portal Principal Authority' : 'Portal Vice Principal Authority'}
              </div>
              {/* Clock WIB */}
              <div className="flex flex-col items-end gap-1 px-4 py-2 rounded-2xl bg-white/80 border border-amber-100 shadow-sm shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clock.day},</span>
                  <span className="text-xs font-bold text-slate-500">{clock.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clock.time}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
                </div>
              </div>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {accessRole === 'kepala_sekolah' ? 'Area Kerja Kepala Sekolah' : 'Area Kerja Wakil Kepala Sekolah'}
            </h1>
            {accessRole === 'kepala_sekolah' && (
              <p className="mt-3 text-sm italic text-slate-600 font-medium">
                "Memimpin dengan teladan, mendidik dengan hati, membawa perubahan untuk masa depan."
              </p>
            )}
            {accessRole === 'wakil_sekolah' && (
              <p className="mt-3 text-sm italic text-slate-600 font-medium">
                "Bersinergi membangun sistem, bekerja sama mencerdaskan siswa."
              </p>
            )}
          </div>
        </motion.div>
      )}

      {renderActiveSection()}

      <AnimatePresence>{showAnnounceModal ? <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAnnounceModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" /><motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }} className="relative w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-2xl font-black text-slate-900">Broadcast Pengumuman</h3><button type="button" onClick={() => setShowAnnounceModal(false)} className="rounded-full p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><form onSubmit={handleSendAnnouncement} className="mt-6 space-y-4"><input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Judul pengumuman" className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-slate-900" required /><textarea value={announcementText} onChange={(event) => setAnnouncementText(event.target.value)} rows="5" placeholder="Isi pengumuman" className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-slate-900" required /><button type="submit" className="flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-slate-900 px-4 py-4 text-sm font-black text-white"><Send className="h-4 w-4" />Publikasikan</button></form></motion.div></div> : null}</AnimatePresence>
    </div>
  );
}
