import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import {
  Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ShieldCheck, Clock, Wallet, TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  FileSpreadsheet, Printer, Eye, History, Inbox, Loader2, ClipboardList, Users, Banknote,
} from 'lucide-react';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { managementAPI, cashierAPI } from '../../../utils/api';
import { previewKeuanganKepsekPDF } from '../../../utils/keuanganKepsekPdf';

const rupiahFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const formatCurrency = (v) => rupiahFmt.format(Number(v || 0));
const formatPct = (v) => (v == null ? '-' : `${Number(v).toFixed(1)}%`);

function KpiCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border ${accent.border} bg-gradient-to-br ${accent.grad} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}>
      <div className="relative z-10 flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 ${accent.chip} rounded-2xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${accent.text}`} />
        </div>
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="relative z-10 text-2xl font-black text-slate-900">{value}</p>
      {sub ? <p className="relative z-10 mt-1 text-xs font-semibold text-slate-500">{sub}</p> : null}
      <Icon className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${accent.text} opacity-[0.07]`} />
    </div>
  );
}

const MonitoringKeuangan = ({ stats: parentStats, clock, accessRole }) => {
  const [localFinance, setLocalFinance] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const rejectOpen = !!rejectTarget;
  const detailOpen = !!detailModal;
  useEscapeKey(rejectOpen, () => { setRejectTarget(null); setRejectReason(''); });
  useEscapeKey(detailOpen, () => setDetailModal(null));
  useBodyScrollLock(rejectOpen || detailOpen);

  const finance = localFinance || parentStats?.executive?.finance_audit;
  const kpis = finance?.kpis || {};
  const cashflow = finance?.cashflow || [];
  const approvalQueue = finance?.approval_queue || [];
  const recentDecisions = finance?.recent_decisions || [];
  const classes = finance?.classes || [];
  const period = finance?.period || {};

  const loading = !parentStats;

  const reload = async () => {
    try {
      const r = await managementAPI.getStats();
      setLocalFinance(r.data?.data?.executive?.finance_audit || null);
    } catch { /* pertahankan data lama */ }
  };

  const handleApprove = async (item) => {
    try {
      setBusyId(`approve-${item.id}`);
      await cashierAPI.approveExpense(item.id, { note: 'Disetujui pimpinan sekolah.' });
      toast.success(`Pengeluaran ${item.transaction_code} disetujui.`);
      await reload();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Gagal menyetujui pengeluaran.');
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) { toast.error('Alasan penolakan wajib diisi.'); return; }
    try {
      setBusyId(`reject-${rejectTarget.id}`);
      await cashierAPI.rejectExpense(rejectTarget.id, { reason: rejectReason.trim() });
      toast.success(`Pengeluaran ${rejectTarget.transaction_code} ditolak.`);
      setRejectTarget(null); setRejectReason('');
      await reload();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Gagal menolak pengeluaran.');
    } finally {
      setBusyId(null);
    }
  };

  const handleExportExcel = () => {
    if (!classes.length) return;
    const data = classes.map((c, i) => ({
      No: i + 1,
      Kelas: c.name || '-',
      'Wali Kelas': c.homeroom_teacher || 'Belum ditentukan',
      'Siswa Aktif': c.active_students ?? 0,
      'Total Tagihan': c.total_tagihan ?? 0,
      'Total Terbayar': c.total_terbayar ?? 0,
      'Sisa Tunggakan': c.sisa_tunggakan ?? 0,
      'Persentase Lunas': c.pct_lunas == null ? '-' : `${c.pct_lunas}%`,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Keuangan');
    XLSX.writeFile(wb, `Rekap_Keuangan_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewKeuanganKepsekPDF({ rows: classes, kpis, period });
      if (res) setPdfPreview(res);
    } catch { /* toast ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat data keuangan..." />;

  const clockObj = clock || { time: '', day: '', date: '' };
  const hasCashflow = cashflow.some((m) => (m.income || 0) > 0 || (m.expense || 0) > 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner ── */}
      <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-6 lg:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> {accessRole === 'wakil_sekolah' ? 'Portal Vice Principal Authority' : 'Portal Principal Authority'}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Keuangan &amp; Approval Anggaran</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Audit arus kas sekolah, realisasi penerimaan SPP per kelas, tunggakan siswa, serta pengesahan pengeluaran operasional.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 px-4 py-2 rounded-2xl bg-white/80 border border-amber-100 shadow-sm shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clockObj.day},</span>
              <span className="text-xs font-bold text-slate-500">{clockObj.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clockObj.time}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 stagger-grid">
        <KpiCard label="Pemasukan Bulan Ini" value={formatCurrency(kpis.pemasukan_bulan_ini)} sub={`Saldo kas aktif ${formatCurrency(kpis.saldo_kas_aktif)}`} icon={Banknote} accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }} />
        <KpiCard label="Total Tunggakan SPP" value={formatCurrency(kpis.total_tunggakan)} sub={`${kpis.siswa_menunggak ?? 0} siswa menunggak`} icon={AlertTriangle} accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }} />
        <KpiCard label="Rasio Pelunasan" value={kpis.rasio_pelunasan == null ? 'Belum ada tagihan' : formatPct(kpis.rasio_pelunasan)} sub={`${formatCurrency(kpis.total_terbayar)} / ${formatCurrency(kpis.total_tagihan)}`} icon={TrendingUp} accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }} />
        <KpiCard label="Antrean Approval Anggaran" value={String(kpis.approval_pending_count ?? 0)} sub={`Nilai pengajuan ${formatCurrency(kpis.approval_pending_total)}`} icon={ClipboardList} accent={{ grad: 'from-rose-50/90 via-white to-rose-50/50', border: 'border-rose-200/70', chip: 'bg-rose-100', text: 'text-rose-600' }} />
      </div>

      {/* ── Panel Persetujuan Pengeluaran ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-rose-600" />
            <h3 className="text-lg font-black text-slate-900">Persetujuan Pengeluaran Kasir</h3>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">(Wewenang Kepala Sekolah)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${approvalQueue.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
              {approvalQueue.length} menunggu
            </span>
            <button onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
              <History className="h-3.5 w-3.5" /> {showHistory ? 'Sembunyikan' : 'Riwayat Keputusan'}
            </button>
          </div>
        </div>

        {approvalQueue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Tanggal', 'Kode / Keterangan', 'Kategori', 'Nominal', 'Diajukan Oleh', 'Aksi'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvalQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 text-sm text-slate-600">{item.transaction_date || '-'}</td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-slate-900">{item.title || '-'}</p>
                      <p className="text-xs text-slate-500">{item.transaction_code || '-'}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{item.category || '-'}</td>
                    <td className="px-5 py-4 text-sm font-black text-rose-700">{formatCurrency(item.amount)}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{item.requested_by || '-'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleApprove(item)} disabled={!!busyId} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-colors disabled:opacity-50">
                          {busyId === `approve-${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Setujui
                        </button>
                        <button onClick={() => { setRejectTarget(item); setRejectReason(''); }} disabled={!!busyId} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-black hover:bg-rose-700 transition-colors disabled:opacity-50">
                          <XCircle className="h-3.5 w-3.5" /> Tolak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <Inbox className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-black text-slate-500">Tidak ada pengajuan pengeluaran yang menunggu persetujuan saat ini</p>
          </div>
        )}

        {showHistory && (
          <div className="border-t border-slate-100 px-6 py-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Riwayat Keputusan Anggaran</p>
            {recentDecisions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-slate-400">
                    <tr>
                      {['Keterangan', 'Kategori', 'Nominal', 'Keputusan', 'Oleh', 'Waktu'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-black">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentDecisions.map((d) => (
                      <tr key={`${d.id}-${d.status}`}>
                        <td className="px-3 py-2 font-bold text-slate-900">{d.title || d.transaction_code}</td>
                        <td className="px-3 py-2 text-slate-600">{d.category || '-'}</td>
                        <td className="px-3 py-2 text-slate-700">{formatCurrency(d.amount)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-black ${d.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{d.status === 'approved' ? 'Disetujui' : 'Ditolak'}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{d.decided_by || '-'}</td>
                        <td className="px-3 py-2 text-slate-500">{d.decided_at ? new Date(d.decided_at).toLocaleString('id-ID') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Belum ada riwayat keputusan pengeluaran.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Grafik Arus Kas ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Arus Kas</p>
          <h3 className="mt-1 text-xl font-black text-slate-900">Tren Pemasukan &amp; Pengeluaran (6 Bulan Terakhir)</h3>
        </div>
        <div className="h-72">
          {hasCashflow ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashflow}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Line type="monotone" dataKey="income" name="Pemasukan" stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="expense" name="Pengeluaran" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-black text-slate-400">Belum ada arus kas tercatat</p>
                <p className="text-xs text-slate-400 mt-1">Grafik muncul setelah transaksi keuangan disetujui</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter/Ekspor ── */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 shrink-0">
            <Wallet className="h-4 w-4" /> {period.tahun_ajaran || '-'}{period.semester ? ` · ${period.semester}` : ''}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3 ml-auto shrink-0">
          <button onClick={handleExportExcel} disabled={!classes.length} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <FileSpreadsheet className="h-4 w-4" /> Ekspor Laporan Keuangan (.xlsx)
          </button>
          <button onClick={handlePrintPDF} disabled={!classes.length} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Printer className="h-4 w-4" /> Cetak Rekap Keuangan &amp; Tunggakan (PDF)
          </button>
        </div>
      </div>

      {/* ── Tabel Tagihan per Kelas ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Realisasi per Kelas</p>
          <h3 className="mt-1 text-lg font-black text-slate-900">Tagihan per Kelas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Kelas', 'Wali Kelas', 'Siswa Aktif', 'Total Tagihan', 'Total Terbayar', 'Sisa Tunggakan', 'Persentase Lunas', 'Aksi'].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classes.length > 0 ? (
                classes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-slate-900">{c.name || '-'}</p>
                      <p className="text-xs text-slate-500">{c.department_name || '-'}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{c.homeroom_teacher || <span className="text-slate-400 italic">Belum ditentukan</span>}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{c.active_students}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{formatCurrency(c.total_tagihan)}</td>
                    <td className="px-5 py-4 text-sm font-bold text-emerald-700">{formatCurrency(c.total_terbayar)}</td>
                    <td className="px-5 py-4 text-sm font-bold text-rose-700">{formatCurrency(c.sisa_tunggakan)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                          <div className={`animate-grow-x h-full rounded-full ${c.pct_lunas >= 80 ? 'bg-emerald-500' : c.pct_lunas >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(c.pct_lunas || 0, 100)}%` }} />
                        </div>
                        <span className="text-sm font-black text-slate-700">{c.pct_lunas == null ? '-' : `${c.pct_lunas}%`}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => setDetailModal(c)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-colors">
                        <Eye className="h-4 w-4" /> Detail Kelas
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <Wallet className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada kelas / tagihan</p>
                      <p className="text-xs text-slate-500">Data muncul setelah kelas dibuat &amp; tagihan siswa diinput lewat modul Kasir.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailOpen && <KelasDetailModal cls={detailModal} onClose={() => setDetailModal(null)} />}
      {rejectOpen && <RejectModal item={rejectTarget} reason={rejectReason} setReason={setRejectReason} onCancel={() => { setRejectTarget(null); setRejectReason(''); }} onSubmit={submitReject} busy={busyId === `reject-${rejectTarget?.id}`} />}

      <RaporPdfPreview state={pdfPreview} onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }} title="Pratinjau Rekap Keuangan (PDF)" downloadLabel="Unduh Rekap Keuangan" />
    </div>
  );
};

const KelasDetailModal = ({ cls, onClose }) => {
  const students = cls.students || [];
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-amber-500 to-orange-600 px-7 py-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">Detail Tagihan Kelas</p>
            <h3 className="text-2xl font-black text-white">{cls.name || 'Kelas'}</h3>
            <p className="mt-1 text-sm text-amber-50">Wali: {cls.homeroom_teacher || 'Belum ditentukan'}</p>
          </div>
          <ModalCloseControl onClose={onClose} tone="onDark" />
        </div>
        <div className="px-7 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <MiniStat label="Siswa Aktif" value={cls.active_students ?? 0} />
            <MiniStat label="Total Tagihan" value={formatCurrency(cls.total_tagihan)} />
            <MiniStat label="Sisa Tunggakan" value={formatCurrency(cls.sisa_tunggakan)} />
            <MiniStat label="% Lunas" value={cls.pct_lunas == null ? '-' : `${cls.pct_lunas}%`} />
          </div>
          {students.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['Nama Siswa', 'NIS', 'Tagihan', 'Terbayar', 'Sisa', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-black">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td>
                      <td className="px-4 py-3 text-slate-500">{s.nis || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(s.total_billed)}</td>
                      <td className="px-4 py-3 text-emerald-700">{formatCurrency(s.total_paid)}</td>
                      <td className="px-4 py-3 text-rose-700 font-bold">{formatCurrency(s.remaining)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-black ${s.status === 'lunas' ? 'bg-emerald-50 text-emerald-700' : s.status === 'menunggak' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                          {s.status === 'lunas' ? 'Lunas' : s.status === 'menunggak' ? 'Menunggak' : 'Belum ada tagihan'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Users className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada siswa di kelas ini</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

const RejectModal = ({ item, reason, setReason, onCancel, onSubmit, busy }) => {
  useEscapeKey(true, onCancel);
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-lg rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-rose-500 to-red-600 px-7 py-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-100">Alasan Penolakan</p>
            <h3 className="text-xl font-black text-white">{item?.title || item?.transaction_code || 'Pengeluaran'}</h3>
            <p className="mt-1 text-sm text-rose-50">Nominal {formatCurrency(item?.amount)}</p>
          </div>
          <ModalCloseControl onClose={onCancel} tone="onDark" />
        </div>
        <div className="px-7 py-6">
          <label className="text-xs font-black uppercase tracking-wider text-slate-500">Alasan (wajib diisi)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Tuliskan alasan penolakan pengeluaran ini..." className="mt-2 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-rose-400" />
          <div className="mt-5 flex gap-3">
            <button onClick={onCancel} className="flex-1 rounded-[1.2rem] border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors">Batal</button>
            <button onClick={onSubmit} disabled={busy} className="flex-1 flex items-center justify-center gap-2 rounded-[1.2rem] bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700 transition-colors disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Tolak Pengeluaran
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const MiniStat = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
    <p className="text-base font-black text-slate-900">{value}</p>
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
  </div>
);

export default MonitoringKeuangan;
