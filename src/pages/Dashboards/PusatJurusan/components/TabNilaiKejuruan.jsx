import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pusatJurusanAPI } from '../../../../utils/api';
import { useCachedQuery } from '../../../../utils/queryCache';
import ActivePeriodCard from '../../../../components/dashboard/shared/ActivePeriodCard';
import {
  GraduationCap, Users, ClipboardCheck, Award, Wallet, Search, ChevronDown, Cpu,
  Save, Loader2, AlertTriangle, ShieldCheck, RefreshCw, Eye, Briefcase,
  BookOpen, Lock,
} from 'lucide-react';

const KKM = 75;
const fmtRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

/* ── Kartu KPI ── */
const KpiCard = ({ grad, icon: Icon, watermark: WIcon, value, sub, label }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
    className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
  >
    <WIcon className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 rotate-12 opacity-15 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
    <div className="relative flex items-center gap-4">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-inset ring-white/30 backdrop-blur-sm"><Icon className="h-6 w-6" /></span>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none tracking-tight">{value}</p>
        {sub && <p className="mt-1 truncate text-[11px] font-bold text-white/85">{sub}</p>}
        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/70">{label}</p>
      </div>
    </div>
  </motion.div>
);

/* ── Mode selector pills ── */
const MODES = [
  { key: 'pkl', label: 'Nilai Akhir PKL (XI)', icon: Briefcase },
  { key: 'ukk', label: 'Nilai UKK (XII)', icon: Award },
  { key: 'monitoring', label: 'Monitoring Kelompok C', icon: Eye },
];
const ModeTabs = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {MODES.map((m) => {
      const Icon = m.icon;
      return (
        <button key={m.key} type="button" onClick={() => onChange(m.key)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all ${value === m.key ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}>
          <Icon className="h-3.5 w-3.5" /> {m.label}
        </button>
      );
    })}
  </div>
);

/* ── Empty state helper ── */
const EmptyState = ({ icon: Icon, title, desc }) => (
  <div className="py-14 text-center">
    <Icon className="mx-auto mb-3 h-12 w-12 text-slate-200" />
    <p className="text-sm font-black uppercase tracking-wider text-slate-400">{title}</p>
    <p className="mt-1 text-xs font-medium text-slate-400">{desc}</p>
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
const TabNilaiKejuruan = ({ selectedJurusan }) => {
  const id = selectedJurusan?.id;
  const [mode, setMode] = useState('pkl');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const { data: dsum } = useCachedQuery(
    id ? `pj:summary:${id}` : null,
    () => pusatJurusanAPI.getDashboardSummary(id).then((r) => r.data),
    { enabled: !!id },
  );
  const periode = dsum?.periode || {};

  return (
    <div className="space-y-6">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#f5fde7] via-[#f8fdec] to-white p-6 text-slate-900 shadow-sm ring-1 ring-[#eaf8dc] xl:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
              <Cpu className="h-3 w-3" /> Portal Major Department Center
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-950 xl:text-5xl">Nilai Kejuruan &amp; Validasi UKK</h2>
          </div>
          <ActivePeriodCard tahunAjaran={periode.tahun_ajaran} semester={periode.semester} />
        </div>
      </section>

      {/* ── 4 KPI ── */}
      <KpiRow id={id} />

      {/* ── Messages ── */}
      {err && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 ring-1 ring-inset ring-red-600/10"><AlertTriangle size={16} /> {err}</div>
      )}
      {msg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10"><ShieldCheck size={16} /> {msg}</div>
      )}

      {/* ── MODE TABS ── */}
      <ModeTabs value={mode} onChange={setMode} />

      {/* ── MODE CONTENT ── */}
      {mode === 'pkl' && <ModePkl id={id} setErr={setErr} setMsg={setMsg} />}
      {mode === 'ukk' && <ModeUkk id={id} setErr={setErr} setMsg={setMsg} />}
      {mode === 'monitoring' && <ModeMonitoring id={id} setErr={setErr} />}
    </div>
  );
};

/* ── KPI Row (agregat 3 mode) ── */
const KpiRow = ({ id }) => {
  const { data: pkl } = useCachedQuery(
    id ? `pj:pkl-kpi:${id}` : null,
    () => pusatJurusanAPI.getPklRecap(id, 'XI').then((r) => r.data),
    { enabled: !!id },
  );
  const { data: ukk } = useCachedQuery(
    id ? `pj:ukk-kpi:${id}` : null,
    () => pusatJurusanAPI.getPraktikUkk(id, 'XII').then((r) => r.data),
    { enabled: !!id },
  );
  const { data: mon } = useCachedQuery(
    id ? `pj:mon-kpi:${id}` : null,
    () => pusatJurusanAPI.getPraktikUkk(id, null).then((r) => r.data),
    { enabled: !!id },
  );

  const pklTotal = pkl?.total ?? 0;
  const pklFinal = (pkl?.rows || []).filter((r) => r.status_final === 'final').length;
  const ukkRows = ukk?.rows || [];
  const ukkTerisi = ukkRows.filter((r) => Object.values(r.nilai || {}).some((c) => c.ukk != null)).length;
  const monMapel = mon?.mapel || [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard grad="from-blue-600 to-cyan-500" icon={Briefcase} watermark={GraduationCap} value={pklTotal} sub={`${pklFinal} sudah final`} label="Siswa PKL Tingkat XI" />
      <KpiCard grad="from-indigo-600 to-violet-600" icon={Award} watermark={ClipboardCheck} value={ukkRows.length} sub={`${ukkTerisi}/${ukkRows.length} nilai terisi`} label="Siswa Tingkat XII" />
      <KpiCard grad="from-emerald-600 to-teal-500" icon={BookOpen} watermark={ShieldCheck} value={monMapel.length} sub="kelompok C aktif" label="Mapel Produktif" />
      <KpiCard grad="from-amber-500 to-orange-600" icon={Users} watermark={Users} value={(mon?.rows || []).length} sub="di semua tingkat" label="Total Siswa Terdaftar" />
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MODE A — Nilai Akhir PKL (Tingkat XI) — READ-ONLY
   ══════════════════════════════════════════════════════════════════ */
const ModePkl = ({ id, setErr, setMsg }) => {
  const { data, loading, refetch } = useCachedQuery(
    id ? `pj:pkl:${id}` : null,
    () => pusatJurusanAPI.getPklRecap(id, 'XI').then((r) => r.data),
    { enabled: !!id, onError: () => setErr('Data PKL gagal dimuat.') },
  );

  const rows = data?.rows || [];
  const kelasList = data?.kelas || [];
  const [filterKelas, setFilterKelas] = useState('');

  const filtered = useMemo(() => rows.filter((r) => (!filterKelas || r.kelas_id === Number(filterKelas))), [rows, filterKelas]);

  const ghostSelectCls = 'appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-medium text-slate-600 outline-none transition-colors hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <GraduationCap className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className={ghostSelectCls}>
            <option value="">Semua Kelas XI</option>
            {kelasList.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-blue-700 ring-1 ring-inset ring-blue-600/20">
          <Lock className="h-3 w-3" /> Read-Only
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Briefcase size={18} className="text-blue-600" />
          <h3 className="text-base font-black text-slate-800">Rekap Nilai Akhir PKL — Tingkat XI</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Memuat data...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Briefcase} title="Belum ada data PKL" desc="Tidak ada siswa tingkat XI yang terdaftar PKL untuk jurusan ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left">Siswa</th>
                  <th className="px-4 py-3 text-left">Tempat Magang</th>
                  <th className="px-4 py-3 text-center">Status PKL</th>
                  <th className="px-4 py-3 text-center">Nilai Akhir</th>
                  <th className="px-4 py-3 text-center">Finalisasi</th>
                  <th className="px-4 py-3 text-center">Keuangan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.pkl_id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{r.nama}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-[11px] font-medium text-slate-400">{r.nisn || '—'}</span>
                        {r.kelas_name && <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">{r.kelas_name}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{r.tempat_magang || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ring-inset ${r.pkl_status === 'selesai' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : r.pkl_status === 'aktif' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' : 'bg-slate-100 text-slate-500 ring-slate-400/20'}`}>
                        {r.pkl_status === 'selesai' ? 'Selesai' : r.pkl_status === 'aktif' ? 'Aktif' : 'Belum'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-base font-black tabular-nums ${r.nilai_akhir != null ? (r.nilai_akhir >= KKM ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-300'}`}>
                        {r.nilai_akhir != null ? r.nilai_akhir : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.status_final === 'final' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/20"><ShieldCheck className="h-3 w-3" /> Final</span>
                      ) : (
                        <span className="inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">Belum Final</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!r.keuangan ? (
                        <span className="text-[11px] font-medium text-slate-300">belum ada tagihan</span>
                      ) : r.keuangan.layak ? (
                        <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Layak</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">Tunggakan</span>
                          <span className="text-[10px] font-bold tabular-nums text-amber-600">{fmtRp(r.keuangan.total_tunggakan)}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MODE B — Nilai UKK (Tingkat XII) — INLINE EDIT
   ══════════════════════════════════════════════════════════════════ */
const ModeUkk = ({ id, setErr, setMsg }) => {
  const { data, loading, refetch } = useCachedQuery(
    id ? `pj:ukk:${id}` : null,
    () => pusatJurusanAPI.getPraktikUkk(id, 'XII').then((r) => r.data),
    { enabled: !!id, onError: () => setErr('Data UKK gagal dimuat.') },
  );
  const { data: bdata, refetch: refetchBilling } = useCachedQuery(
    id ? `pj:billing:${id}:XII` : null,
    () => pusatJurusanAPI.getBillingJurusan(id, 'XII').then((r) => r.data),
    { enabled: !!id },
  );

  const rows = data?.rows || [];
  const mapel = data?.mapel || [];
  const kelasList = data?.kelas || [];
  const billingMap = useMemo(() => Object.fromEntries((bdata?.rows || []).map((b) => [b.siswa_id, b])), [bdata]);

  const [kelasId, setKelasId] = useState('');
  const [mapelId, setMapelId] = useState('');
  const [q, setQ] = useState('');
  const [inlineEdits, setInlineEdits] = useState({}); // { [siswa_id]: { ukk: value } }
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const activeMapelId = mapel.find((m) => String(m.id) === String(mapelId))?.id ?? (mapel[0]?.id ?? '');

  const filtered = useMemo(() => rows.filter((r) => (
    (!kelasId || r.kelas_id === Number(kelasId))
    && (!q || (r.nama || '').toLowerCase().includes(q.toLowerCase()) || String(r.nisn || '').includes(q))
  )), [rows, kelasId, q]);

  const ghostSelectCls = 'appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-medium text-slate-600 outline-none transition-colors hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';

  const handleInlineChange = (siswaId, val) => {
    setInlineEdits((prev) => ({ ...prev, [siswaId]: { ...prev[siswaId], ukk: val } }));
  };

  const saveSingle = async (row) => {
    const editVal = inlineEdits[row.siswa_id]?.ukk;
    if (editVal === undefined || editVal === '') return;
    const v = row.nilai?.[activeMapelId] || {};
    setSaving(true); setErr('');
    try {
      await pusatJurusanAPI.savePraktikUkk(id, {
        kelas_id: row.kelas_id, mapel_id: activeMapelId, siswa_id: row.siswa_id,
        nilai_praktek: v.praktek ?? null,
        nilai_ukk: Number(editVal),
      });
      setInlineEdits((prev) => { const n = { ...prev }; delete n[row.siswa_id]; return n; });
      await refetch();
    } catch (e2) {
      setErr(e2?.response?.data?.message || 'Gagal menyimpan nilai.');
    } finally { setSaving(false); }
  };

  const syncRapor = async () => {
    setSyncing(true); setErr(''); setMsg('');
    try {
      const r = await pusatJurusanAPI.verifikasiPraktikUkk(id, {
        tingkat: 'XII', kelas_id: kelasId ? Number(kelasId) : null, mapel_id: activeMapelId || null,
      });
      setMsg(r.data?.message || 'Sinkron selesai.');
      await refetch();
    } catch (e2) {
      setErr(e2?.response?.data?.message || 'Gagal sinkron ke rapor.');
    } finally { setSyncing(false); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <GraduationCap className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select value={kelasId} onChange={(e) => setKelasId(e.target.value)} className={ghostSelectCls}>
              <option value="">Semua Kelas XII</option>
              {kelasList.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <ClipboardCheck className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select value={activeMapelId} onChange={(e) => setMapelId(e.target.value)} className={ghostSelectCls}>
              {mapel.length === 0 && <option value="">(belum ada mapel produktif)</option>}
              {mapel.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari Nama / NISN…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-300 hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <button onClick={syncRapor} disabled={syncing}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Simpan &amp; Sinkronkan ke Rapor
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Award size={18} className="text-indigo-600" />
          <h3 className="text-base font-black text-slate-800">Nilai Tes Akhir / UKK — {mapel.find((m) => m.id === activeMapelId)?.name || 'Belum ada mapel'} (Kelas XII)</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Memuat data...</div>
        ) : (!activeMapelId || filtered.length === 0) ? (
          <EmptyState icon={Award} title="Belum ada data" desc={activeMapelId ? 'Tidak ada siswa kelas XII untuk filter ini.' : 'Belum ada mapel produktif (kelompok C) untuk tingkat XII.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left">Siswa</th>
                  <th className="px-4 py-3 text-left">Keuangan</th>
                  <th className="px-4 py-3 text-center">Nilai Praktik</th>
                  <th className="px-4 py-3 text-center">Nilai UKK</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const v = row.nilai?.[activeMapelId] || {};
                  const b = billingMap[row.siswa_id];
                  const editVal = inlineEdits[row.siswa_id]?.ukk;
                  const currentUkk = editVal !== undefined ? editVal : (v.ukk ?? '');
                  const isDirty = editVal !== undefined && String(editVal) !== String(v.ukk ?? '');
                  return (
                    <tr key={row.siswa_id} className="border-t border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{row.nama}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-400">{row.nisn || '—'}</span>
                          {row.kelas_name && <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">{row.kelas_name}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {!b || !b.total_tagihan ? (
                          <span className="text-[11px] font-medium text-slate-300">belum ada tagihan</span>
                        ) : b.layak ? (
                          <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Layak</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">Tunggakan</span>
                            <span className="text-[10px] font-bold tabular-nums text-amber-600">{fmtRp(b.total_tunggakan)}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center"><span className={`text-base font-black tabular-nums ${v.praktek != null ? 'text-slate-800' : 'text-slate-300'}`}>{v.praktek ?? '—'}</span></td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" min="0" max="100" value={currentUkk}
                          onChange={(e) => handleInlineChange(row.siswa_id, e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          placeholder="0-100" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {v.status === 'terverifikasi' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/20"><ShieldCheck className="h-3 w-3" /> Terverifikasi</span>
                        ) : isDirty ? (
                          <span className="inline-block rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">Perubahan</span>
                        ) : (
                          <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">Draft</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isDirty && (
                          <button onClick={() => saveSingle(row)} disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-60">
                            <Save className="h-3.5 w-3.5" /> Simpan
                          </button>
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
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MODE C — Monitoring Mapel Kelompok C — 100% READ-ONLY
   ══════════════════════════════════════════════════════════════════ */
const TINGKAT_OPTIONS = ['X', 'XI', 'XII'];
const ModeMonitoring = ({ id, setErr }) => {
  const [tingkat, setTingkat] = useState('X');
  const [kelasId, setKelasId] = useState('');
  const [mapelId, setMapelId] = useState('');
  const [q, setQ] = useState('');

  const { data, loading } = useCachedQuery(
    id ? `pj:mon:${id}:${tingkat}` : null,
    () => pusatJurusanAPI.getPraktikUkk(id, tingkat).then((r) => r.data),
    { enabled: !!id, onError: () => setErr('Data monitoring gagal dimuat.') },
  );

  const rows = data?.rows || [];
  const mapel = data?.mapel || [];
  const kelasList = data?.kelas || [];

  const activeMapelId = mapel.find((m) => String(m.id) === String(mapelId))?.id ?? (mapel[0]?.id ?? '');

  const filtered = useMemo(() => rows.filter((r) => (
    (!kelasId || r.kelas_id === Number(kelasId))
    && (!q || (r.nama || '').toLowerCase().includes(q.toLowerCase()) || String(r.nisn || '').includes(q))
  )), [rows, kelasId, q]);

  const ghostSelectCls = 'appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-medium text-slate-600 outline-none transition-colors hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {TINGKAT_OPTIONS.map((t) => (
              <button key={t} onClick={() => { setTingkat(t); setKelasId(''); setMapelId(''); }}
                className={`rounded-lg px-4 py-2 text-sm transition-all ${tingkat === t ? 'bg-white font-bold text-indigo-600 shadow-sm' : 'font-medium text-slate-500 hover:text-slate-700'}`}>
                Kelas {t}
              </button>
            ))}
          </div>
          <div className="relative">
            <GraduationCap className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select value={kelasId} onChange={(e) => setKelasId(e.target.value)} className={ghostSelectCls}>
              <option value="">Semua Kelas</option>
              {kelasList.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <ClipboardCheck className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select value={activeMapelId} onChange={(e) => setMapelId(e.target.value)} className={ghostSelectCls}>
              {mapel.length === 0 && <option value="">(belum ada mapel C)</option>}
              {mapel.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari Nama / NISN…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-300 hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-blue-700 ring-1 ring-inset ring-blue-600/20">
            <Lock className="h-3 w-3" /> Read-Only
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Eye size={18} className="text-indigo-600" />
          <h3 className="text-base font-black text-slate-800">Monitoring Nilai Kelompok C — {mapel.find((m) => m.id === activeMapelId)?.name || 'Belum ada mapel'} (Kelas {tingkat})</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Memuat data...</div>
        ) : (!activeMapelId || filtered.length === 0) ? (
          <EmptyState icon={Eye} title="Belum ada data" desc={activeMapelId ? `Tidak ada siswa untuk filter tingkat ${tingkat}.` : 'Belum ada mapel kelompok C untuk tingkat ini.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left">Siswa</th>
                  <th className="px-4 py-3 text-left">Kelas</th>
                  <th className="px-4 py-3 text-center">Nilai Praktik</th>
                  <th className="px-4 py-3 text-center">Nilai UKK</th>
                  <th className="px-4 py-3 text-center">Status Verifikasi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const v = row.nilai?.[activeMapelId] || {};
                  return (
                    <tr key={row.siswa_id} className="border-t border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{row.nama}</p>
                        <span className="text-[11px] font-medium text-slate-400">{row.nisn || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {row.kelas_name ? (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-600/20">{row.kelas_name}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center"><span className={`text-base font-black tabular-nums ${v.praktek != null ? (v.praktek >= KKM ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-300'}`}>{v.praktek ?? '—'}</span></td>
                      <td className="px-4 py-3 text-center"><span className={`text-base font-black tabular-nums ${v.ukk != null ? (v.ukk >= KKM ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-300'}`}>{v.ukk ?? '—'}</span></td>
                      <td className="px-4 py-3 text-center">
                        {v.status === 'terverifikasi' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/20"><ShieldCheck className="h-3 w-3" /> Terverifikasi</span>
                        ) : v.praktek != null || v.ukk != null ? (
                          <span className="inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">Draft</span>
                        ) : (
                          <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">Belum Dinilai</span>
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
    </div>
  );
};

export default TabNilaiKejuruan;
