import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck, Clock, Users, Wallet, BookOpen, ClipboardCheck,
  ArrowRight, Bell, Printer, TrendingUp, CheckCircle2, Layers,
  MessageSquare, AlertTriangle, GraduationCap, Percent,
  Megaphone, CalendarDays, Inbox, Eye, User,
} from 'lucide-react';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import { previewLaporanEksekutifPDF } from '../../../utils/laporanEksekutifPdf';
import { getExecutivePath } from '../../../utils/executiveDashboard';
import { calendarAPI } from '../../../utils/api';

const rupiah = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;
const pctText = (v) => (v == null ? 'Belum ada data' : `${Number(v).toFixed(1)}%`);

function KpiCard({ label, value, sub, icon: Icon, accent, delay, children }) {
  return (
    <div
      className={`kpi-hover animate-fade-in-up relative overflow-hidden rounded-3xl border ${accent.border} bg-gradient-to-br ${accent.grad} p-6 shadow-sm`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative z-10 flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 ${accent.chip} rounded-2xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${accent.text}`} />
        </div>
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="relative z-10 text-3xl font-black text-slate-900">{value}</p>
      {sub ? <p className="relative z-10 mt-1 text-xs font-semibold text-slate-500">{sub}</p> : null}
      {children ? <div className="relative z-10 mt-3">{children}</div> : null}
      <Icon className={`kpi-watermark pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${accent.text} opacity-[0.07]`} />
    </div>
  );
}

// Grafik tren pemasukan vs pengeluaran 6 bulan (SVG). Fallback: perbandingan jurnal vs jadwal.
const CashflowChart = ({ data = [], kbm }) => {
  const hasCash = data.some((m) => (m.income || 0) > 0 || (m.expense || 0) > 0);
  if (!hasCash) {
    const jmlJurnal = kbm?.jurnal_terisi ?? 0;
    const jmlJadwal = kbm?.jadwal_total ?? 0;
    const max = Math.max(jmlJadwal, jmlJurnal, 1);
    return (
      <div className="flex items-end justify-around gap-6 h-56 px-2">
        {[
          { label: 'Jadwal Mengajar', value: jmlJadwal, color: '#8b5cf6' },
          { label: 'Jurnal KBM Terisi', value: jmlJurnal, color: '#0ea5e9' },
        ].map((b) => (
          <div key={b.label} className="flex flex-col items-center gap-2 flex-1">
            <div className="w-full flex items-end justify-center h-40">
              <div className="animate-grow-x w-12 rounded-t-xl" style={{ height: `${(b.value / max) * 100}%`, background: b.color, minHeight: b.value > 0 ? 8 : 2 }} />
            </div>
            <p className="text-sm font-black text-slate-900">{b.value}</p>
            <p className="text-[11px] font-bold text-slate-500 text-center">{b.label}</p>
          </div>
        ))}
      </div>
    );
  }
  const max = Math.max(...data.flatMap((m) => [m.income || 0, m.expense || 0]), 1);
  return (
    <div className="flex items-end justify-between gap-2 h-56 px-1">
      {data.map((m, i) => (
        <div key={i} className="flex flex-col items-center gap-2 flex-1">
          <div className="w-full flex items-end justify-center gap-1 h-40">
            <div className="animate-grow-x w-4 rounded-t-md bg-emerald-500" style={{ height: `${((m.income || 0) / max) * 100}%`, animationDelay: `${i * 60}ms`, minHeight: (m.income || 0) > 0 ? 4 : 1 }} />
            <div className="animate-grow-x w-4 rounded-t-md bg-rose-400" style={{ height: `${((m.expense || 0) / max) * 100}%`, animationDelay: `${i * 60 + 30}ms`, minHeight: (m.expense || 0) > 0 ? 4 : 1 }} />
          </div>
          <p className="text-[10px] font-bold text-slate-500">{m.month || m.label}</p>
        </div>
      ))}
    </div>
  );
};

const HealthBar = ({ label, value, color, delay }) => {
  const pctVal = value == null ? 0 : Math.max(0, Math.min(100, Number(value)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600">{label}</span>
        <span className="text-xs font-black text-slate-900">{value == null ? '—' : `${pctVal.toFixed(0)}%`}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`animate-grow-x h-full rounded-full`} style={{ width: `${pctVal}%`, background: color, animationDelay: `${delay}ms` }} />
      </div>
    </div>
  );
};

const DashboardEksekutif = ({ stats, clock, user, announcements = [], navigate, accessRole }) => {
  const overview = stats?.executive?.overview;
  const [pdfPreview, setPdfPreview] = useState(null);

  const pop = overview?.populasi || {};
  const kbm = overview?.kbm || {};
  const keu = overview?.keuangan || {};
  const ev = overview?.evaluasi_audit || {};
  const period = overview?.period || {};
  const health = overview?.health_indicators || [];
  const cashflow = overview?.cashflow_trend || [];
  const priorityActions = useMemo(() => overview?.priority_actions || [], [overview]);

  // ── KABAR TERBARU (tab Agenda / Informasi) — integrasi sama seperti portal murid ──
  const [kabarTab, setKabarTab] = useState('informasi');
  const [agendaList, setAgendaList] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await calendarAPI.getEvents();
        const rows = res?.data?.data ?? res?.data ?? [];
        if (!alive) return;
        const list = (Array.isArray(rows) ? rows : [])
          .map((e) => ({ id: e.id, nama: e.title, tanggal: e.event_date, dibuat: e.created_at }));
        setAgendaList(list);
      } catch { /* Beranda tetap jalan tanpa agenda */ }
    })();
    return () => { alive = false; };
  }, []);
  const isSameLocalDay = (dateStr) => {
    if (!dateStr) return false;
    const dt = new Date(dateStr);
    const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
  };
  const hasNewAgenda = agendaList.length > 0 && isSameLocalDay(agendaList[0].dibuat);
  const hasNewInfo = announcements.length > 0 && announcements[0].is_read === false;

  if (!stats) return <SectionLoading loading={true} label="Memuat dashboard eksekutif..." />;

  const clockObj = clock || { time: '', day: '', date: '' };
  const principalName = user?.name || overview?.principal_name || 'Kepala Sekolah';
  const tungguKeputusan = (keu.approval_pending ?? 0) + (ev.pkg_pending ?? 0);

  const handlePrint = async () => {
    try {
      const res = await previewLaporanEksekutifPDF({ overview, principalName });
      if (res) setPdfPreview(res);
    } catch { /* toast ditangani util */ }
  };

  const goto = (target) => navigate?.(getExecutivePath(user, target));

  return (
    <div className="space-y-8">
      {/* ── Hero Eksekutif ── */}
      <div className="animate-fade-in-up relative overflow-hidden rounded-[3rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-7 lg:p-9 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> {accessRole === 'wakil_sekolah' ? 'Portal Vice Principal Authority' : 'Portal Principal Authority'}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Selamat Datang, {principalName}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Pusat kendali strategis, ringkasan kinerja sekolah lintas bidang, dan pengesahan kebijakan eksekutif.
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

      {/* ── 4 KPI Cards (stagger) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <KpiCard label="Populasi Sekolah" value={String(pop.siswa_aktif ?? 0)} sub={`${pop.guru_aktif ?? 0} tenaga didik · ${pop.rombel ?? 0} rombel aktif`} icon={Users} delay={0} accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }} />
        <KpiCard label="Arus Kas & SPP Bulan Ini" value={rupiah(keu.pemasukan_bulan)} sub={`Tunggakan SPP ${rupiah(keu.tunggakan_spp)}`} icon={Wallet} delay={70} accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }} />
        <KpiCard label="Capaian KBM & Rapor" value={pctText(kbm.kelengkapan_jurnal_pct)} sub={`Rapor published ${kbm.rapor_published ?? 0} · Rata nilai ${kbm.rata_nilai == null ? 'belum ada' : kbm.rata_nilai}`} icon={BookOpen} delay={140} accent={{ grad: 'from-violet-50/90 via-white to-violet-50/50', border: 'border-violet-200/70', chip: 'bg-violet-100', text: 'text-violet-600' }} />
        <KpiCard label="Menunggu Keputusan Pimpinan" value={String(tungguKeputusan)} sub={`${keu.approval_pending ?? 0} anggaran · ${ev.pkg_pending ?? 0} PKG belum dinilai`} icon={ClipboardCheck} delay={210} accent={{ grad: 'from-amber-50/90 via-white to-rose-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }}>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => goto('finance')} className="inline-flex items-center gap-1 rounded-lg bg-white/80 border border-amber-200 px-3 py-1.5 text-[11px] font-black text-amber-700 hover:bg-amber-600 hover:text-white transition-colors">Keuangan <ArrowRight className="h-3 w-3" /></button>
            <button onClick={() => goto('teacher_performance')} className="inline-flex items-center gap-1 rounded-lg bg-white/80 border border-amber-200 px-3 py-1.5 text-[11px] font-black text-amber-700 hover:bg-amber-600 hover:text-white transition-colors">Evaluasi <ArrowRight className="h-3 w-3" /></button>
          </div>
        </KpiCard>
      </div>

      {/* ── Bar aksi laporan eksekutif (kanan, di bawah KPI) ── */}
      <div className="flex items-center justify-end">
        <button onClick={handlePrint} className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-rose-700 transition-colors shadow-sm">
          <Printer className="h-4 w-4" /> Cetak Laporan Eksekutif Sekolah (PDF)
        </button>
      </div>

      {/* ── Grid asimetris 7/5 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kiri (7/12) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="animate-fade-in-up bg-white rounded-2xl border border-slate-100 p-6 shadow-sm" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-black text-slate-900">Tren Pemasukan vs Pengeluaran</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">6 bulan terakhir. Bila transaksi kas masih 0, ditampilkan perbandingan keaktifan KBM (riil).</p>
            <CashflowChart data={cashflow} kbm={kbm} />
          </div>

          <div className="animate-fade-in-up bg-white rounded-2xl border border-slate-100 p-6 shadow-sm" style={{ animationDelay: '140ms' }}>
            <div className="flex items-center gap-2 mb-4">
              <Percent className="h-5 w-5 text-sky-600" />
              <h3 className="text-base font-black text-slate-900">Indikator Kesehatan Sekolah</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              {health.map((h, i) => (
                <HealthBar key={h.label} label={h.label} value={h.value} color={h.color} delay={i * 90} />
              ))}
            </div>
          </div>
        </div>

        {/* Kanan (5/12) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="animate-fade-in-up bg-white rounded-2xl border border-slate-100 p-6 shadow-sm" style={{ animationDelay: '120ms' }}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <h3 className="text-base font-black text-slate-900">Tindakan Prioritas Kepala Sekolah</h3>
            </div>
            {priorityActions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-sm font-black text-emerald-600">Semua indikator prioritas dalam kondisi terkendali.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {priorityActions.map((a, i) => (
                  <button key={i} onClick={() => goto(a.target)} className="animate-fade-in-up w-full flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-left hover:bg-white hover:shadow-md transition-all" style={{ animationDelay: `${i * 70}ms` }}>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{a.label}</p>
                      <p className="text-xs font-bold text-amber-600 mt-0.5">{a.action}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black ${a.severity === 'high' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                      {a.severity === 'high' ? 'Mendesak' : 'Perhatian'} <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Kolom Kanan: Kabar Terbaru (Agenda / Informasi) — pola seragam portal murid */}
          <div className="animate-fade-in-up rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden" style={{ animationDelay: '180ms' }}>
            {/* Header + tab */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-rose-50 p-2 text-rose-600"><Megaphone className="h-5 w-5" /></div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Kabar Terbaru</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setKabarTab('agenda')}
                  className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${kabarTab === 'agenda' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  Agenda
                  {hasNewAgenda && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
                </button>
                <button
                  type="button"
                  onClick={() => setKabarTab('informasi')}
                  className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${kabarTab === 'informasi' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  Informasi
                  {hasNewInfo && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
                </button>
              </div>
            </div>

            {/* Konten */}
            {kabarTab === 'agenda' ? (
              <div className="p-5">
                {agendaList.length > 0 ? (
                  <div className="space-y-1">
                    {agendaList.map((ag) => (
                      <div key={ag.id} className="flex items-center group">
                        <span className="mr-3 font-black text-amber-500">•</span>
                        <div className="flex flex-grow items-center justify-between border-b border-slate-100 py-3 pr-1">
                          <p className="text-sm font-bold tracking-wide text-slate-700">
                            {ag.nama}
                            <span className="ml-3 font-medium text-slate-400">
                              {ag.tanggal ? new Date(ag.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">Belum ada agenda</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {announcements.length > 0 ? announcements.slice(0, 2).map((ann) => {
                  const isUnread = ann.is_read === false;
                  const excerpt = String(ann.content || '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                  const dateLabel = (ann.published_at || ann.created_at)
                    ? new Date(ann.published_at || ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                    : '-';
                  return (
                    <button
                      key={ann.id}
                      onClick={() => goto('news')}
                      className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${isUnread ? 'border-rose-100 bg-rose-50/30' : 'border-slate-100 bg-white'}`}
                    >
                      {isUnread ? (
                        <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                        </span>
                      ) : (
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-200" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`truncate text-sm font-black transition-colors group-hover:text-blue-600 ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>{ann.title}</p>
                          {isUnread && <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">Baru</span>}
                        </div>
                        {excerpt && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{excerpt}</p>
                        )}
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                          <User className="h-3 w-3" />
                          <span className="font-bold tracking-wide text-slate-600">{ann.author?.name || ann.author || 'Pengumuman'}</span>
                          <span>·</span>
                          <span>{dateLabel}</span>
                        </div>
                      </div>
                      <Eye className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:text-blue-600 group-hover:scale-110" />
                    </button>
                  );
                }) : (
                  <div className="py-6 text-center">
                    <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">Belum ada informasi</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <RaporPdfPreview state={pdfPreview} onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }} title="Pratinjau Laporan Eksekutif Sekolah (PDF)" downloadLabel="Unduh Laporan" />
    </div>
  );
};

export default DashboardEksekutif;
