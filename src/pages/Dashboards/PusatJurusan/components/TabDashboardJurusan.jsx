import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { pusatJurusanAPI, calendarAPI, informationCenterAPI } from '../../../../utils/api';
import { useCachedQuery } from '../../../../utils/queryCache';
import InventarisPanel from './InventarisPanel';
import ActivePeriodCard from '../../../../components/dashboard/shared/ActivePeriodCard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  GraduationCap, Users, ClipboardCheck, Award, Monitor, TrendingUp, Cpu,
  CalendarClock, Wrench, FileText, ChevronRight, X, AlertTriangle,
  Megaphone, CalendarDays, Inbox, Eye, User,
} from 'lucide-react';

const go = (id) => window.dispatchEvent(new CustomEvent('navigateDashboard', { detail: id }));

// Angka beranimasi (count-up) saat data API masuk.
const AnimatedNumber = ({ value, decimals = 0, suffix = '' }) => {
  const target = Number(value) || 0;
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf; const dur = 600; const st = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - st) / dur); setN(target * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <>{n.toFixed(decimals)}{suffix}</>;
};

const KPI_GRAD = {
  blue: 'from-blue-600 to-cyan-500',
  indigo: 'from-indigo-600 to-violet-600',
  emerald: 'from-emerald-600 to-teal-500',
  amber: 'from-amber-500 to-orange-600',
};

const KpiCard = ({ grad, icon: Icon, value, decimals, suffix, label, sub, watermark: WIcon, onClick, delay = 0, children }) => (
  <motion.button
    type="button"
    onClick={onClick}
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={`group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 text-left text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <WIcon className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 rotate-12 opacity-15 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
    <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 ring-1 ring-inset ring-white/30 backdrop-blur-sm"><Icon className="h-6 w-6" /></div>
    <p className="relative mt-3 text-3xl font-black leading-none tracking-tight">{value == null ? '—' : <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />}</p>
    <p className="relative mt-1.5 text-[11px] font-black uppercase tracking-widest text-white/80">{label}</p>
    {sub && <p className="relative mt-0.5 text-[11px] font-medium text-white/70">{sub}</p>}
    {children}
  </motion.button>
);

const TabDashboardJurusan = ({ selectedJurusan }) => {
  const [modal, setModal] = useState(null);
  const [donutMode, setDonutMode] = useState('pkl');
  const invRef = useRef(null);

  // Kabar Terbaru (Agenda + Informasi) — meniru Beranda murid.
  const [kabarTab, setKabarTab] = useState('informasi');
  const [agendaList, setAgendaList] = useState([]);
  const [infos, setInfos] = useState([]);
  const [previewAnn, setPreviewAnn] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [evRes, infoRes] = await Promise.all([
        calendarAPI.getEvents().catch(() => null),
        informationCenterAPI.getInfos({ per_page: 5 }).catch(() => null),
      ]);
      if (!alive) return;
      const evRows = evRes?.data?.data ?? evRes?.data ?? [];
      setAgendaList((Array.isArray(evRows) ? evRows : []).map((e) => ({ id: e.id, nama: e.title, tanggal: e.event_date, dibuat: e.created_at })));
      const infoRows = infoRes?.data?.data ?? infoRes?.data ?? [];
      setInfos(Array.isArray(infoRows) ? infoRows : []);
    })();
    return () => { alive = false; };
  }, []);

  const isSameLocalDay = (dateStr) => {
    if (!dateStr) return false;
    const dt = new Date(dateStr); const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
  };
  const hasNewAgenda = agendaList.length > 0 && isSameLocalDay(agendaList[0].dibuat);
  const hasNewInfo = infos.length > 0 && infos[0].is_read === false;

  const openAnnouncement = (ann) => {
    if (ann.is_read === false) {
      setInfos((prev) => prev.map((it) => (it.id === ann.id ? { ...it, is_read: true } : it)));
      informationCenterAPI.markAsRead(ann.id).then(() => window.dispatchEvent(new Event('info-unread:refresh'))).catch(() => {});
    }
    setPreviewAnn(ann);
  };

  useEffect(() => {
    if (!previewAnn && !modal) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [previewAnn, modal]);

  const { data: d, loading, error, refetch } = useCachedQuery(
    `pusjur:dashsum:${selectedJurusan?.id || 'none'}`,
    () => pusatJurusanAPI.getDashboardSummary(selectedJurusan.id).then((r) => r.data),
    { ttl: 30000, enabled: !!selectedJurusan?.id },
  );

  // Real-time sync: saat jendela/tab kembali fokus, langsung tarik data terbaru
  // (mis. Operator menambah siswa / Admin mengubah jadwal di role lain).
  useEffect(() => {
    if (!selectedJurusan?.id) return undefined;
    const onVis = () => { if (!document.hidden) refetch(); };
    window.addEventListener('focus', refetch);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('focus', refetch); document.removeEventListener('visibilitychange', onVis); };
  }, [refetch, selectedJurusan?.id]);

  const scrollToInv = useCallback(() => invRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), []);

  if (error && !d) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
        <AlertTriangle size={16} /> Gagal memuat ringkasan jurusan. Periksa koneksi server.
        <button onClick={refetch} className="ml-auto inline-flex items-center gap-1 text-rose-700 underline">Coba lagi</button>
      </div>
    );
  }

  const k = d?.kpi || {};
  const sarana = d?.sarana || {};
  const grouped = d?.grouped_chart || [];
  const pklDonut = d?.pkl_donut || [];
  const kondisiDonut = d?.kondisi_donut || [];
  const donutData = donutMode === 'pkl' ? pklDonut : kondisiDonut;
  const donutTotal = donutData.reduce((s, x) => s + (Number(x.value) || 0), 0);
  const DONUT_COLORS = donutMode === 'pkl' ? ['#6366f1', '#10b981', '#cbd5e1'] : ['#10b981', '#f59e0b', '#f43f5e'];
  const per = k.siswa_per_tingkat || {};
  const periode = d?.periode || {};

  // Skeleton (hanya saat cache belum ada — indikator endpoint lambat/gagal).
  if (!d) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-[2rem] bg-slate-200/70"></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200/70"></div>)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70 lg:col-span-7"></div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70 lg:col-span-5"></div>
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HERO Command Center */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#f5fde7] via-[#f8fdec] to-white p-6 text-slate-900 shadow-sm ring-1 ring-[#eaf8dc] xl:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
              <Cpu className="h-3 w-3" /> Portal Major Department Center
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-950 xl:text-5xl">{d?.jurusan?.name || selectedJurusan?.name || 'Jurusan'}</h2>
          </div>
          <ActivePeriodCard tahunAjaran={periode.tahun_ajaran} semester={periode.semester} />
        </div>
      </section>

      {/* BARIS 2: 4 KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard grad={KPI_GRAD.blue} icon={Users} watermark={GraduationCap} value={k.total_siswa} label="Populasi Siswa Jurusan" delay={0}>
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {['X', 'XI', 'XII'].map((t) => (
              <span key={t} className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white ring-1 ring-inset ring-white/25">{t}: {per[t] ?? 0}</span>
            ))}
          </div>
        </KpiCard>

        <KpiCard grad={KPI_GRAD.indigo} icon={CalendarClock} watermark={ClipboardCheck} value={k.jadwal_c_aktif} label="Slot Jadwal Produktif (C)" sub={k.plotting_persen == null ? 'Belum ada plotting' : `${k.plotting_persen}% kelas terplot`} onClick={() => go('kurikulum_jadwal')} delay={0.075}>
          <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-all duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, k.plotting_persen || 0))}%` }}></div>
          </div>
        </KpiCard>

        <KpiCard grad={KPI_GRAD.emerald} icon={Award} watermark={TrendingUp} value={k.avg_praktek} decimals={1} label="Rata Nilai Praktik / UKK" sub={`UKK: ${k.avg_ukk == null ? '—' : k.avg_ukk} · XII siap: ${k.siap_ukk_xii ?? 0}`} onClick={() => go('nilai_kejuruan')} delay={0.15} />

        <KpiCard grad={KPI_GRAD.amber} icon={Wrench} watermark={Monitor} value={sarana.total} label="Kesehatan Sarana & Lab" sub={`${sarana.baik ?? 0} unit layak · ${k.tiket_aktif ?? 0} tiket aktif`} onClick={scrollToInv} delay={0.225} />
      </div>

      {/* BARIS 3: 2 Grafik (7 + 5) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7">
          <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-700">Kehadiran vs Nilai Praktik per Tingkat</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grouped} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gKehadiran" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#2563eb" /></linearGradient>
                  <linearGradient id="gNilai" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#0d9488" /></linearGradient>
                </defs>
                <XAxis dataKey="tingkat" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(79,70,229,0.12)', fontSize: 12, fontWeight: 700 }} />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                <Bar dataKey="kehadiran" name="Kehadiran (%)" fill="url(#gKehadiran)" radius={[6, 6, 0, 0]} maxBarSize={38} isAnimationActive={false} />
                <Bar dataKey="nilai_praktek" name="Nilai Praktik" fill="url(#gNilai)" radius={[6, 6, 0, 0]} maxBarSize={38} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Distribusi</h3>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              <button onClick={() => setDonutMode('pkl')} className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${donutMode === 'pkl' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>PKL</button>
              <button onClick={() => setDonutMode('kondisi')} className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${donutMode === 'kondisi' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Aset</button>
            </div>
          </div>
          <div className="relative h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={3} isAnimationActive={false}>
                  {donutData.map((entry, i) => <Cell key={i} fill={DONUT_COLORS[i] || '#e2e8f0'} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v}`, n]} contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700 }} />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
              <span className="text-2xl font-black text-slate-900">{donutTotal}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{donutMode === 'pkl' ? 'Siswa' : 'Unit'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BARIS 4: Inventaris (8) + Kabar Terbaru (4) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div ref={invRef} className="lg:col-span-8">
          <InventarisPanel selectedJurusan={selectedJurusan} onChanged={refetch} />
        </div>

        {/* Kabar Terbaru — UI existing DIPERTAHANKAN */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md"><Megaphone className="h-5 w-5" /></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Kabar Terbaru</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setKabarTab('agenda')}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${kabarTab === 'agenda' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                Agenda {hasNewAgenda && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
              </button>
              <button type="button" onClick={() => setKabarTab('informasi')}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${kabarTab === 'informasi' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                Informasi {hasNewInfo && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
              </button>
            </div>
          </div>

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
            <div className="space-y-3 p-4">
              {infos.length > 0 ? infos.slice(0, 4).map((ann) => {
                const isUnread = ann.is_read === false;
                const excerpt = String(ann.content || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                const dateLabel = (ann.published_at || ann.created_at) ? new Date(ann.published_at || ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-';
                return (
                  <button key={ann.id} onClick={() => openAnnouncement(ann)}
                    className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${isUnread ? 'border-rose-100 bg-rose-50/30' : 'border-slate-100 bg-white'}`}>
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
                      {excerpt && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{excerpt}</p>}
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <User className="h-3 w-3" /><span>{ann.author?.name || ann.author_name || 'Admin'}</span><span>·</span><span>{dateLabel}</span>
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

      {/* Modal detail */}
      {modal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="animate-fadeIn w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-6 py-5">
              <h3 className="text-lg font-black text-slate-900">{modal.title}</h3>
              <button onClick={() => setModal(null)} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="max-h-[60vh] space-y-1 overflow-y-auto p-4">
              {modal.rows.length === 0 ? (
                <p className="py-10 text-center text-sm font-bold text-slate-400">Belum ada data.</p>
              ) : (
                modal.rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                    <span className="text-sm font-bold text-slate-800">{r.label}</span>
                    {r.sub && <span className="text-xs font-medium text-slate-400">{r.sub}</span>}
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button onClick={() => setModal(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Tutup</button>
            </div>
          </div>
        </div>
      , typeof document !== 'undefined' ? document.body : undefined)}

      {/* Modal detail Kabar (Informasi) */}
      {previewAnn && typeof document !== 'undefined' && createPortal(
        <div onClick={(e) => e.target === e.currentTarget && setPreviewAnn(null)} className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
          <div className="animate-fadeIn flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Informasi</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">{previewAnn.title}</h3>
                <p className="mt-1 text-xs font-bold text-slate-500">{previewAnn.author?.name || previewAnn.author_name || 'Admin'} · {new Date(previewAnn.published_at || previewAnn.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <button onClick={() => setPreviewAnn(null)} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <div className="text-sm leading-relaxed text-slate-700 [&_img]:max-w-full [&_img]:rounded-xl" dangerouslySetInnerHTML={{ __html: previewAnn.content || '<p className="italic text-slate-400">Tidak ada isi.</p>' }} />
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button onClick={() => setPreviewAnn(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Tutup</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default TabDashboardJurusan;
