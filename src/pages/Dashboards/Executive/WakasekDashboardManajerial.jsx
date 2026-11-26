import React, { useMemo, useState, useEffect } from 'react';
import {
  ShieldCheck, Clock, LayoutGrid, BookOpen, ClipboardList, UserCheck,
  Printer, ArrowRight, Activity, TrendingUp, CheckCircle2,
  Megaphone, CalendarDays, Inbox, Eye, User,
} from 'lucide-react';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import { getExecutivePath } from '../../../utils/executiveDashboard';
import { previewWakasekOperasionalPDF } from '../../../utils/wakasekOperasionalPdf';
import { calendarAPI } from '../../../utils/api';

function KpiCard({ label, value, sub, icon: Icon, accent, highlight, delay }) {
  return (
    <div
      className={`kpi-hover animate-fade-in-up relative overflow-hidden rounded-3xl border ${highlight ? 'border-rose-300' : accent.border} bg-gradient-to-br ${accent.grad} p-6 shadow-sm`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative z-10 flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 ${accent.chip} rounded-2xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${accent.text}`} />
        </div>
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="relative z-10 text-3xl font-black text-slate-900">{value}</p>
      {sub ? <p className={`relative z-10 mt-1 text-xs font-semibold ${highlight ? 'text-rose-600' : 'text-slate-500'}`}>{sub}</p> : null}
      <Icon className={`kpi-watermark pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${accent.text} opacity-[0.07]`} />
    </div>
  );
}

// Grafik batang horizontal SVG: jadwal mengajar vs jurnal terisi per kelas (riil).
const OperationalChart = ({ rows = [] }) => {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <Activity className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Belum ada data kelas</p>
        <p className="text-xs text-slate-500 max-w-xs">Perbandingan jadwal vs jurnal akan muncul saat rombel & jadwal mengajar tercatat.</p>
      </div>
    );
  }
  const max = Math.max(...rows.flatMap((r) => [r.schedule_count || 0, r.journal_count || 0]), 1);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-400" /> Jadwal Mengajar</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Jurnal Terisi</span>
      </div>
      {rows.map((r, i) => {
        const sched = r.schedule_count || 0;
        const jurn = r.journal_count || 0;
        return (
          <div key={`${r.name}-${i}`}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-bold text-slate-700">{r.name}</span>
              <span className="text-xs font-black text-slate-500">{jurn} / {sched} jurnal</span>
            </div>
            <svg width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none" className="overflow-visible">
              <rect x="0" y="3" width="100" height="7" rx="1.5" fill="#f1f5f9" />
              <rect
                x="0" y="3" width={(sched / max) * 100} height="7" rx="1.5" fill="#94a3b8"
                className="animate-grow-x" style={{ transformBox: 'fill-box', transformOrigin: 'left center', animationDelay: `${i * 70}ms` }}
              />
              <rect x="0" y="14" width="100" height="7" rx="1.5" fill="#f1f5f9" />
              {jurn > 0 && (
                <rect
                  x="0" y="14" width={(jurn / max) * 100} height="7" rx="1.5" fill="#10b981"
                  className="animate-grow-x" style={{ transformBox: 'fill-box', transformOrigin: 'left center', animationDelay: `${i * 70 + 35}ms` }}
                />
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
};

const ProgressBar = ({ label, value, help, has_data, delay }) => {
  const pct = has_data && value != null ? Math.max(0, Math.min(100, Number(value))) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600">{label}</span>
        <span className="text-xs font-black text-slate-900">{has_data && value != null ? `${pct.toFixed(0)}%` : 'Belum ada data'}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="animate-grow-x h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${pct}%`, animationDelay: `${delay}ms` }} />
      </div>
      {help ? <p className="text-[11px] text-slate-400">{help}</p> : null}
    </div>
  );
};

const pctText = (v) => (v == null ? 'Belum ada jadwal' : `${Number(v).toFixed(1)}%`);

const WakasekDashboardManajerial = ({ stats, clock, user, announcements = [], navigate, accessRole }) => {
  const section = useMemo(
    () => stats?.executive?.vice_principal?.sections?.wakasek_overview || {},
    [stats],
  );
  const kpis = useMemo(() => section.kpis || {}, [section]);
  const chart = useMemo(() => section.classes_chart || [], [section]);
  const progress = useMemo(() => section.progress || [], [section]);
  const priorityActions = useMemo(() => section.priority_actions || [], [section]);
  const period = useMemo(() => section.period || {}, [section]);

  const [pdfPreview, setPdfPreview] = useState(null);

  // ── KABAR TERBARU (tab Agenda / Informasi) — integrasi & tampilan sama seperti portal murid ──
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

  if (!stats) return <SectionLoading loading={true} label="Memuat dashboard manajerial wakasek..." />;

  const clockObj = clock || { time: '', day: '', date: '' };
  const wakasekName = user?.name || 'Wakil Kepala Sekolah';
  const newsPath = getExecutivePath(user, 'news');

  const handlePrint = async () => {
    try {
      const res = await previewWakasekOperasionalPDF({
        chart,
        progress,
        kpis,
        period,
        wakilName: wakasekName,
        wakilNip: user?.nisn_nip || user?.nip || user?.school_id || null,
      });
      if (res) setPdfPreview(res);
    } catch { /* toast ditangani util */ }
  };

  const goto = (target) => navigate?.(target);

  return (
    <div className="space-y-8">
      {/* ── Hero Banner Tunggal Wakasek ── */}
      <div className="animate-fade-in-up relative overflow-hidden rounded-[3rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-7 lg:p-9 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> Portal Vice Principal Authority
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Selamat Datang, {wakasekName}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600 whitespace-nowrap">
              Pusat koordinasi akademik: rombel, KBM, ujian CBT, dan kedisiplinan GTK.
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

      {/* ── 4 KPI Operasional (stagger) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <KpiCard
          label="Kesiapan Rombel & Wali Kelas"
          value={kpis.rombel_aktif ?? 0}
          sub={`${kpis.wali_terplot ?? 0}/${kpis.rombel_aktif ?? 0} wali ter-plot · ${kpis.siswa_aktif ?? 0} siswa aktif`}
          highlight={(kpis.rombel_tanpa_wali ?? 0) > 0}
          icon={LayoutGrid}
          delay={0}
          accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }}
        />
        <KpiCard
          label="Realisasi KBM & Jurnal Harian"
          value={pctText(kpis.realisasi_jurnal_pct)}
          sub={`${kpis.jurnal_terisi ?? 0} jurnal dari ${kpis.jadwal_total ?? 0} jadwal aktif`}
          icon={BookOpen}
          delay={70}
          accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }}
        />
        <KpiCard
          label="Agenda & Kesiapan Ujian CBT"
          value={kpis.ujian_total ?? 0}
          sub={`${kpis.ujian_terjadwal ?? 0} paket terjadwal`}
          icon={ClipboardList}
          delay={140}
          accent={{ grad: 'from-violet-50/90 via-white to-violet-50/50', border: 'border-violet-200/70', chip: 'bg-violet-100', text: 'text-violet-600' }}
        />
        <KpiCard
          label="Kedisiplinan Presensi GTK"
          value={`${kpis.gtk_hadir ?? 0}/${kpis.gtk_total ?? 0}`}
          sub="Tenaga didik hadir bulan ini"
          icon={UserCheck}
          delay={210}
          accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }}
        />
      </div>

      {/* ── Bar aksi ekspor (di luar Hero) ── */}
      <div className="flex items-center justify-end">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-rose-700 transition-colors shadow-sm"
        >
          <Printer className="h-4 w-4" /> Cetak Laporan Operasional Akademik (PDF)
        </button>
      </div>

      {/* ── Grid Analitik 7/5 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kiri 7/12 */}
        <div className="lg:col-span-7 space-y-6">
          <div className="animate-fade-in-up bg-white rounded-2xl border border-slate-100 p-6 shadow-sm" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base font-black text-slate-900">Peta Kesiapan Operasional Akademik</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">Perbandingan jadwal mengajar vs jurnal terisi per rombongan belajar (riil).</p>
            <OperationalChart rows={chart} />
          </div>

          <div className="animate-fade-in-up bg-white rounded-2xl border border-slate-100 p-6 shadow-sm" style={{ animationDelay: '140ms' }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-black text-slate-900">Indikator Progres Operasional</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              {progress.map((p, i) => (
                <ProgressBar key={p.label} label={p.label} value={p.value} help={p.help} has_data={p.has_data} delay={i * 90} />
              ))}
            </div>
          </div>
        </div>

        {/* Kanan 5/12 */}
        <div className="lg:col-span-5 space-y-6">
          <div className="animate-fade-in-up bg-white rounded-2xl border border-slate-100 p-6 shadow-sm" style={{ animationDelay: '120ms' }}>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-rose-600" />
              <h3 className="text-base font-black text-slate-900">Agenda Tindak Lanjut Wakasek</h3>
            </div>
            {priorityActions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-sm font-black text-emerald-600">Seluruh indikator operasional terkendali.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {priorityActions.map((a, i) => (
                  <button
                    key={`${a.target}-${i}`}
                    onClick={() => goto(a.target)}
                    className="animate-fade-in-up w-full flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-left hover:bg-white hover:shadow-md transition-all"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{a.label}</p>
                      <p className="text-xs font-bold text-indigo-600 mt-0.5">{a.action}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black ${a.severity === 'high' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                      {a.severity === 'high' ? 'Mendesak' : 'Perhatian'} <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
                      onClick={() => goto(newsPath)}
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

      <RaporPdfPreview
        state={pdfPreview}
        onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
        title="Pratinjau Laporan Operasional Akademik (PDF)"
        downloadLabel="Unduh Laporan"
      />
    </div>
  );
};

export default WakasekDashboardManajerial;
