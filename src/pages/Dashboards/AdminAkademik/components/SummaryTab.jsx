import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import {
  Users, GraduationCap, DoorOpen, ClipboardCheck, CalendarClock, Calendar,
  Wrench, Monitor, Package, AlertTriangle, ArrowRight, CalendarDays,
  Megaphone, Bell,
} from 'lucide-react';
import { operatorAPI, calendarAPI, informationCenterAPI } from '../../../../utils/api';
import { useCachedQuery } from '../../../../utils/queryCache';

/* ── Angka beranimasi (count-up) saat data API masuk. ── */
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

const ChartCard = ({ title, action, children, className = '' }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

const EmptyChart = ({ text = 'Belum ada data untuk ditampilkan' }) => (
  <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
    <Package className="h-9 w-9 text-slate-200" />
    <p className="text-sm font-bold text-slate-400">{text}</p>
  </div>
);

const TINGKAT_COLORS = { X: '#2563eb', XI: '#0d9488', XII: '#7c3aed' };
const ASET_COLORS = ['#10b981', '#f59e0b', '#6366f1', '#0ea5e9', '#f43f5e'];
const KBM_COLORS = ['#10b981', '#cbd5e1'];
const KUNCI_COLORS = ['#6366f1', '#cbd5e1'];

const tooltipStyle = { borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(79,70,229,0.12)', fontSize: 12, fontWeight: 700 };

const SummaryTab = ({ onNavigate, onSync }) => {
  const [donutMode, setDonutMode] = useState('kbm'); // 'kbm' | 'aset' | 'kunci'
  const [agenda, setAgenda] = useState([]);
  const [infos, setInfos] = useState([]);
  const [kabarTab, setKabarTab] = useState('agenda'); // 'agenda' | 'info'

  const { data: d, loading, error, refetch } = useCachedQuery(
    'admin-akademik:dashboard-summary',
    () => operatorAPI.getAkademikSummary().then((r) => r.data?.data ?? {}),
    { ttl: 30000 },
  );

  // 3 agenda terdekat (Kalender) + 3 informasi terbaru (Pusat Informasi) — data nyata.
  const loadAgenda = useCallback(async () => {
    try {
      const [evRes, infoRes] = await Promise.all([
        calendarAPI.getEvents().catch(() => null),
        informationCenterAPI.getInfos({ per_page: 3 }).catch(() => null),
      ]);
      const rows = evRes?.data?.data ?? evRes?.data ?? [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const upcoming = (Array.isArray(rows) ? rows : [])
        .filter((e) => e.event_date && new Date(e.event_date) >= today)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
        .slice(0, 3);
      setAgenda(upcoming.map((e) => ({ id: e.id, nama: e.title, tanggal: e.event_date, catatan: e.catatan || '' })));
      const irows = infoRes?.data?.data ?? infoRes?.data ?? [];
      setInfos(Array.isArray(irows) ? irows.slice(0, 3) : []);
    } catch { /* biarkan empty state */ }
  }, []);

  // Real-time: refetch saat jendela/tab kembali fokus — tanpa background polling.
  useEffect(() => {
    loadAgenda();
    const refresh = () => { if (!document.hidden) { refetch(); loadAgenda(); } };
    const onVis = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVis); };
  }, [refetch, loadAgenda]);

  if (error && !d) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
        <AlertTriangle size={16} /> Gagal memuat Dashboard Akademik. Periksa koneksi server.
        <button onClick={refetch} className="ml-auto inline-flex items-center gap-1 text-rose-700 underline">Coba lagi</button>
      </div>
    );
  }

  // Skeleton saat cache belum ada data sama sekali.
  if (!d && loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200/70"></div>)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70 lg:col-span-8"></div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70 lg:col-span-4"></div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70 lg:col-span-6"></div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70 lg:col-span-6"></div>
        </div>
      </div>
    );
  }

  const k = d?.kpi || {};
  const periode = d?.periode || {};
  const sebaran = Array.isArray(d?.sebaran_siswa) ? d.sebaran_siswa : [];
  const donutKbm = d?.donut?.kbm || [];
  const donutAset = d?.donut?.aset || [];
  const donutKunci = d?.donut?.kunci || [];
  const donutData = donutMode === 'kbm' ? donutKbm : donutMode === 'aset' ? donutAset : donutKunci;
  const donutColors = donutMode === 'kbm' ? KBM_COLORS : donutMode === 'aset' ? ASET_COLORS : KUNCI_COLORS;
  const donutTotal = donutData.reduce((s, x) => s + (Number(x.value) || 0), 0);
  const bebanGuru = Array.isArray(d?.beban_guru) ? d.beban_guru : [];
  const kesiapan = d?.kesiapan || {};
  const belumLengkap = Array.isArray(kesiapan.belum_lengkap) ? kesiapan.belum_lengkap : [];

  const periodeLabel = `${periode.semester || '—'} · TA ${periode.tahun_ajaran || '—'}`;

  return (
    <div className="space-y-6">
      {/* ── BARIS 1: 4 KPI ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard grad={KPI_GRAD.blue} icon={Users} watermark={GraduationCap} value={k.total_siswa} label="Total Siswa Aktif" delay={0}>
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white ring-1 ring-inset ring-white/25">L: {k.siswa_l ?? 0}</span>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white ring-1 ring-inset ring-white/25">P: {k.siswa_p ?? 0}</span>
          </div>
        </KpiCard>

        <KpiCard grad={KPI_GRAD.indigo} icon={DoorOpen} watermark={ClipboardCheck} value={k.total_kelas} label="Rombongan Belajar" sub={`${k.kelas_wali ?? 0} kelas punya wali`} onClick={() => onNavigate?.('manajemen_kbm')} delay={0.075} />

        <KpiCard grad={KPI_GRAD.emerald} icon={CalendarClock} watermark={Calendar} value={k.sesi_kbm} label="Sesi KBM Terjadwal" sub={periodeLabel} onClick={() => onNavigate?.('manajemen_kbm')} delay={0.15} />

        <KpiCard grad={KPI_GRAD.amber} icon={Wrench} watermark={Monitor} value={k.aset_baik} label="Fasilitas & Aset Umum" sub={`${k.aset_dipinjam ?? 0} unit dipinjam`} onClick={() => onNavigate?.('manajemen_kbm')} delay={0.225} />
      </div>

      {/* ── BARIS 2: Stacked Bar (8) + Donut (4) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ChartCard title="Sebaran Siswa per Jurusan & Tingkat" className="lg:col-span-8">
          {sebaran.length === 0 ? (
            <EmptyChart text="Belum ada jurusan / sebaran siswa" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sebaran} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="jurusan" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                  <Bar dataKey="X" name="Tingkat X" stackId="a" fill={TINGKAT_COLORS.X} radius={[0, 0, 0, 0]} maxBarSize={46} isAnimationActive={false} />
                  <Bar dataKey="XI" name="Tingkat XI" stackId="a" fill={TINGKAT_COLORS.XI} maxBarSize={46} isAnimationActive={false} />
                  <Bar dataKey="XII" name="Tingkat XII" stackId="a" fill={TINGKAT_COLORS.XII} radius={[6, 6, 0, 0]} maxBarSize={46} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Distribusi"
          className="lg:col-span-4"
          action={
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              <button onClick={() => setDonutMode('kbm')} className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${donutMode === 'kbm' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>KBM</button>
              <button onClick={() => setDonutMode('aset')} className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${donutMode === 'aset' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Aset</button>
              <button onClick={() => setDonutMode('kunci')} className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${donutMode === 'kunci' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Kunci</button>
            </div>
          }
        >
          <div className="relative h-64">
            {donutTotal === 0 ? (
              <EmptyChart text={donutMode === 'kbm' ? 'Belum ada kelas' : donutMode === 'aset' ? 'Belum ada aset umum' : 'Belum ada mapel terjadwal'} />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={3} isAnimationActive={false}>
                      {donutData.map((entry, i) => <Cell key={i} fill={donutColors[i % donutColors.length] || '#e2e8f0'} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v}`, n]} />
                    <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
                  <span className="text-2xl font-black text-slate-900">{donutTotal}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{donutMode === 'kbm' ? 'Kelas' : donutMode === 'aset' ? 'Unit' : 'Mapel'}</span>
                </div>
              </>
            )}
          </div>
        </ChartCard>
      </div>

      {/* ── BARIS 3: Beban Guru (6) + Kesiapan & Agenda (6) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ChartCard title="Distribusi Beban Jam Mengajar Guru" className="lg:col-span-6">
          {bebanGuru.length === 0 ? (
            <EmptyChart text="Belum ada jadwal mengajar pada periode aktif" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bebanGuru} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="guru" width={110} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.06)' }} formatter={(v) => [`${v} jam`, 'Jam mengajar']} />
                  <Bar dataKey="jam" name="Jam Mengajar" fill="#6366f1" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Kartu Monitoring Operasional */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Kesiapan KBM & Agenda Terdekat</h3>
            <button onClick={() => onNavigate?.('manajemen_kbm')} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-indigo-600 transition hover:bg-indigo-600 hover:text-white">
              Kelola KBM <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Progress kesiapan */}
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Kelas punya Wali</span><span>{kesiapan.persen_wali ?? 0}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, kesiapan.persen_wali || 0))}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Kelas punya Jadwal</span><span>{kesiapan.persen_jadwal ?? 0}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, kesiapan.persen_jadwal || 0))}%` }} />
              </div>
            </div>
          </div>

          {/* Kelas belum lengkap */}
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Kelas belum lengkap</p>
            {belumLengkap.length === 0 ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs font-bold text-emerald-700">Semua kelas sudah lengkap wali & jadwal.</div>
            ) : (
              <div className="space-y-1.5">
                {belumLengkap.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/50 px-3.5 py-2.5">
                    <span className="text-sm font-bold text-slate-700">{c.name}</span>
                    <span className="text-[10px] font-black uppercase tracking-wide text-amber-600">{(c.kurang || []).join(' & ')}</span>
                  </div>
                ))}
                <button onClick={() => onNavigate?.('manajemen_kbm')} className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700">
                  Buka Manajemen KBM <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* AGENDA | INFORMASI */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1">
              <button onClick={() => setKabarTab('agenda')} className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${kabarTab === 'agenda' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Agenda</button>
              <button onClick={() => setKabarTab('info')} className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${kabarTab === 'info' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Informasi</button>
            </div>
            {kabarTab === 'agenda' ? (
              agenda.length === 0 ? (
                <div className="flex items-center gap-2 py-2 text-xs font-bold text-slate-400">
                  <CalendarDays className="h-4 w-4 text-slate-200" /> Belum ada agenda mendatang.
                </div>
              ) : (
                <div className="space-y-1">
                  {agenda.map((ag) => (
                    <div key={ag.id} className="flex items-start justify-between gap-3 border-b border-slate-50 py-2 last:border-0">
                      <p className="min-w-0 text-sm font-bold text-slate-700">
                        {ag.nama}
                        {ag.catatan && <span className="ml-2 font-medium italic text-emerald-600">· {ag.catatan}</span>}
                      </p>
                      <span className="shrink-0 text-[11px] font-bold text-indigo-600">
                        {ag.tanggal ? new Date(ag.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              infos.length === 0 ? (
                <div className="flex items-center gap-2 py-2 text-xs font-bold text-slate-400">
                  <Megaphone className="h-4 w-4 text-slate-200" /> Belum ada informasi terbaru.
                </div>
              ) : (
                <div className="space-y-1">
                  {infos.map((it) => (
                    <div key={it.id} className="flex items-start gap-2 border-b border-slate-50 py-2 last:border-0">
                      <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-700">{it.title}</p>
                        <p className="text-[11px] font-medium text-slate-400">
                          {(it.published_at || it.created_at) ? new Date(it.published_at || it.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryTab;
