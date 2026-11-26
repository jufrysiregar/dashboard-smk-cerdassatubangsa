import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { adminGradesAPI } from '../../../../utils/api';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';
import {
  ClipboardCheck, Lock, Unlock, Eye, Save, Plus, Trash2, Printer, FileSpreadsheet,
  RefreshCw, CheckCircle2, BookOpen, Scale, Award, Users, Search, Loader2, AlertTriangle,
} from 'lucide-react';

const TABS = [
  { id: 'monitor', label: 'Monitoring Kesiapan Nilai', icon: ClipboardCheck },
  { id: 'aturan', label: 'Aturan Bobot & KKM / KKTP', icon: Scale },
  { id: 'ledger', label: 'Legger & Cetak Rapor', icon: BookOpen },
];
const SEMESTER_OPTS = [{ value: 'ganjil', label: 'Ganjil' }, { value: 'genap', label: 'Genap' }];
const KELOMPOK_LABEL = { A: 'Umum', B: 'Muatan Lokal', C: 'Produktif' };

/* Refetch saat jendela/tab kembali fokus — tanpa background polling. */
function useRealtimeReload(reload) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    const on = () => { if (!document.hidden) ref.current?.(); };
    window.addEventListener('focus', on);
    document.addEventListener('visibilitychange', on);
    return () => { window.removeEventListener('focus', on); document.removeEventListener('visibilitychange', on); };
  }, []);
}

const StatCard = ({ label, value, sub, accent, icon: Icon }) => (
  <div className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm ${accent}`}>
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70 ring-1 ring-inset ring-black/5"><Icon className="h-5 w-5" /></div>
    <div className="min-w-0">
      <p className="text-2xl font-black leading-none text-slate-900">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      {sub && <p className="text-[11px] font-medium text-slate-400">{sub}</p>}
    </div>
  </div>
);

const Progress = ({ terisi, total }) => {
  const pct = total > 0 ? Math.round((terisi / total) * 100) : 0;
  const color = pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
      <span className="text-[11px] font-bold text-slate-500">{terisi}/{total}</span>
    </div>
  );
};

const KelompokTag = ({ kelompok, isPkl }) => (
  isPkl
    ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-700">PKL</span>
    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">Kel. {kelompok || '—'} · {KELOMPOK_LABEL[kelompok] || '—'}</span>
);

const num = (v) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }));

/* ── Modal Detail Rekap (read-only) ── */
function DetailRekapModal({ data, onClose }) {
  useBodyScrollLock(true);
  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [onClose]);
  const s = data || {};
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl" />
      <div className="relative flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4" style={{ backgroundColor: '#F1F5F9' }}>
          <div>
            <h3 className="text-base font-black text-slate-900">Detail Rekap Nilai (Read-Only)</h3>
            <p className="text-[11px] font-bold text-slate-500">{s.class?.name} · {s.subject?.name} · {s.semester} · TA {s.tahun_ajaran} · KKM {s.kkm}</p>
          </div>
          <ModalCloseControl onClose={onClose} />
        </div>
        <div className="overflow-y-auto p-6">
          {(s.students || []).length === 0 ? (
            <p className="py-10 text-center text-sm font-bold text-slate-400">Belum ada murid terdaftar pada kelas ini.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-3 py-2">No</th><th className="px-3 py-2">NIS</th><th className="px-3 py-2">Nama</th><th className="px-3 py-2 text-center">Harian</th><th className="px-3 py-2 text-center">UTS</th><th className="px-3 py-2 text-center">UAS</th><th className="px-3 py-2 text-center">Praktik</th><th className="px-3 py-2 text-center">Akhir</th><th className="px-3 py-2 text-center">Nilai</th><th className="px-3 py-2 text-center">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.students.map((r, i) => (
                  <tr key={r.student_id}>
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.nis || '—'}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{r.name}</td>
                    <td className="px-3 py-2 text-center">{num(r.harian)}</td>
                    <td className="px-3 py-2 text-center">{num(r.uts)}</td>
                    <td className="px-3 py-2 text-center">{num(r.uas)}</td>
                    <td className="px-3 py-2 text-center">{num(r.praktek)}</td>
                    <td className="px-3 py-2 text-center font-extrabold text-slate-800">{num(r.akhir)}</td>
                    <td className="px-3 py-2 text-center font-black text-slate-600">{r.grade || '—'}</td>
                    <td className="px-3 py-2 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status === 'Tuntas' ? 'bg-emerald-50 text-emerald-700' : r.status === 'Belum tuntas' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-right text-[11px] font-bold text-slate-400">Verifikasi supervisi — nilai mentah tidak diubah di sini.</div>
      </div>
    </div>,
    document.body,
  );
}

/* ══════════════ TAB 1 — MONITORING ══════════════ */
function MonitoringTab() {
  const [filters, setFilters] = useState({ semester: 'ganjil', tahun_ajaran: '', tingkat: '', jurusan_id: '', kelas_id: '' });
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lockBusy, setLockBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminGradesAPI.getMatrix({
        semester: filters.semester,
        tahun_ajaran: filters.tahun_ajaran || undefined,
        tingkat: filters.tingkat || undefined,
        jurusan_id: filters.jurusan_id || undefined,
        kelas_id: filters.kelas_id || undefined,
      });
      const d = data?.data || null;
      setMatrix(d);
      if (d && !filters.tahun_ajaran && d.tahun_ajaran) setFilters((f) => ({ ...f, tahun_ajaran: d.tahun_ajaran }));
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Matriks kesiapan gagal dimuat.');
    } finally { setLoading(false); }
  }, [filters.semester, filters.tahun_ajaran, filters.tingkat, filters.jurusan_id, filters.kelas_id]);

  useEffect(() => { load(); }, [load]);
  useRealtimeReload(load);

  const rows = matrix?.rows || [];
  const fo = matrix?.filter_options || {};
  const kpi = useMemo(() => {
    const subjects = new Set(rows.map((r) => r.subject_id));
    const lengkap = rows.filter((r) => r.siswa_total > 0 && r.siswa_terisi >= r.siswa_total).length;
    const belum = rows.filter((r) => r.siswa_terisi === 0).length;
    const proses = rows.length - lengkap - belum;
    return { mapel: subjects.size, lengkap, proses, belum };
  }, [rows]);

  const openDetail = async (row) => {
    setDetailLoading(true);
    try {
      const { data } = await adminGradesAPI.getRecap({ kelas_id: row.class_id, mapel_id: row.subject_id, semester: filters.semester });
      setDetail(data?.data || null);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Detail rekap gagal dimuat.');
    } finally { setDetailLoading(false); }
  };

  const toggleLock = async (row) => {
    const key = `${row.class_id}-${row.subject_id}`;
    setLockBusy(key);
    try {
      const { data } = await adminGradesAPI.toggleLock({ class_id: row.class_id, subject_id: row.subject_id, semester: filters.semester, tahun_ajaran: matrix?.tahun_ajaran || filters.tahun_ajaran });
      toast.success(data?.message || 'Status kunci diubah.');
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Gagal mengubah status kunci.');
    } finally { setLockBusy(''); }
  };

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { k: 'tahun_ajaran', label: 'Tahun Ajaran', opts: (fo.tahun_ajaran_list || []).map((y) => ({ v: y, l: y })) },
            { k: 'semester', label: 'Semester', opts: SEMESTER_OPTS.map((o) => ({ v: o.value, l: o.label })) },
            { k: 'tingkat', label: 'Tingkat', opts: (fo.tingkat || []).map((t) => ({ v: t, l: t })) },
            { k: 'jurusan_id', label: 'Jurusan', opts: (fo.jurusans || []).map((j) => ({ v: j.id, l: j.code || j.name })) },
          ].map((f) => (
            <label key={f.k} className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">{f.label}</span>
              <select value={filters[f.k]} onChange={(e) => setF(f.k, e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
                <option value="">Semua</option>
                {f.opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Kelas</span>
            <select value={filters.kelas_id} onChange={(e) => setF('kelas_id', e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="">Semua</option>
              {(fo.classes || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Mapel Aktif" value={kpi.mapel} accent="border-indigo-100 text-indigo-600" icon={BookOpen} />
        <StatCard label="Nilai Lengkap (100%)" value={kpi.lengkap} accent="border-emerald-100 text-emerald-600" icon={CheckCircle2} />
        <StatCard label="Sedang Proses" value={kpi.proses} accent="border-amber-100 text-amber-600" icon={RefreshCw} />
        <StatCard label="Belum Input (0%)" value={kpi.belum} accent="border-slate-200 text-slate-500" icon={AlertTriangle} />
      </div>

      {/* Matriks */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Matriks Kesiapan per Kelas &amp; Mapel</h3>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Kelas</th><th className="px-4 py-3">Mata Pelajaran</th><th className="px-4 py-3">Guru Pengampu</th>
                <th className="px-4 py-3 text-center">Aktivitas</th><th className="px-4 py-3">Progres Input</th><th className="px-4 py-3 text-center">Ujian PTS/PAS</th>
                <th className="px-4 py-3 text-center">Kunci</th><th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && !loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm font-bold text-slate-400">Belum ada mapel terjadwal pada filter ini.</td></tr>
              ) : rows.map((r) => (
                <tr key={`${r.class_id}-${r.subject_id}`} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-bold text-slate-700">{r.class_name} <span className="text-[10px] font-medium text-slate-400">{r.grade_level}</span></td>
                  <td className="px-4 py-3"><span className="font-semibold text-slate-800">{r.subject_name}</span> <KelompokTag kelompok={r.kelompok} isPkl={r.is_pkl} /></td>
                  <td className="px-4 py-3 text-slate-600">{r.guru}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-600">{r.aktivitas}</td>
                  <td className="px-4 py-3"><Progress terisi={r.siswa_terisi} total={r.siswa_total} /></td>
                  <td className="px-4 py-3 text-center text-[11px] font-bold"><span className={r.pts > 0 ? 'text-emerald-600' : 'text-slate-400'}>PTS {r.pts}</span> · <span className={r.pas > 0 ? 'text-emerald-600' : 'text-slate-400'}>PAS {r.pas}</span></td>
                  <td className="px-4 py-3 text-center">{r.locked ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700"><Lock className="h-3 w-3" />Terkunci</span> : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500"><Unlock className="h-3 w-3" />Terbuka</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openDetail(r)} disabled={detailLoading} className="rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-amber-600 transition hover:bg-amber-500 hover:text-white disabled:opacity-50">Detail</button>
                      <button onClick={() => toggleLock(r)} disabled={lockBusy === `${r.class_id}-${r.subject_id}`} className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition hover:text-white ${r.locked ? 'bg-slate-100 text-slate-500 hover:bg-slate-500' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600'} disabled:opacity-50`}>{r.locked ? 'Buka Kunci' : 'Kunci'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && <DetailRekapModal data={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ══════════════ TAB 2 — ATURAN BOBOT & KKM ══════════════ */
const DEFAULT_PREDIKAT = [
  { grade: 'A', predikat: 'Sangat Baik', batas_bawah: 85, batas_atas: 100 },
  { grade: 'B', predikat: 'Baik', batas_bawah: 75, batas_atas: 84.99 },
  { grade: 'C', predikat: 'Cukup', batas_bawah: 65, batas_atas: 74.99 },
  { grade: 'D', predikat: 'Kurang', batas_bawah: 0, batas_atas: 64.99 },
];

function AturanTab() {
  const [rules, setRules] = useState([]);
  const [jurusans, setJurusans] = useState([]);
  const [tingkatOpts, setTingkatOpts] = useState(['X', 'XI', 'XII']);
  const [kkmRows, setKkmRows] = useState([]);
  const [predikat, setPredikat] = useState(DEFAULT_PREDIKAT);
  const [saving, setSaving] = useState('');

  const load = useCallback(async () => {
    try {
      const [w, k, p] = await Promise.all([adminGradesAPI.getWeightRules(), adminGradesAPI.getKkm(), adminGradesAPI.getPredikat()]);
      const wd = w.data?.data || {};
      setRules((wd.rules || []).map((r) => ({ ...r })));
      setJurusans(wd.jurusans || []);
      if (wd.tingkat_options?.length) setTingkatOpts(wd.tingkat_options);
      const kd = k.data?.data || {};
      const kkmMap = {};
      (kd.kkm || []).forEach((x) => { kkmMap[`${x.subject_id}|${x.tingkat || ''}`] = x.kktp; });
      setKkmRows((kd.subjects || []).map((s) => ({ subject_id: s.id, name: s.name, kelompok: s.kelompok, kktp: kkmMap[`${s.id}|`] ?? kkmMap[`${s.id}|X`] ?? (parseFloat(String(s.kkme || '').replace(',', '.')) || 70) })));
      const pd = p.data?.data || [];
      if (pd.length) setPredikat(pd.map((x) => ({ ...x })));
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Aturan penilaian gagal dimuat.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeReload(load);

  const addRule = () => setRules((r) => [...r, { tingkat: 'X', jurusan_id: '', bobot_tugas: 0, bobot_uh: 0, bobot_pts: 0, bobot_pas: 0 }]);
  const updRule = (i, key, val) => setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const delRule = (i) => setRules((rs) => rs.filter((_, idx) => idx !== i));
  const ruleSum = (r) => (Number(r.bobot_tugas) || 0) + (Number(r.bobot_uh) || 0) + (Number(r.bobot_pts) || 0) + (Number(r.bobot_pas) || 0);

  const saveRules = async () => {
    const bad = rules.find((r) => ruleSum(r) !== 100);
    if (bad) return toast.error('Setiap baris aturan harus berjumlah 100%.');
    setSaving('rules');
    try {
      await adminGradesAPI.saveWeightRules({ rules: rules.map((r) => ({ tingkat: r.tingkat || null, jurusan_id: r.jurusan_id ? Number(r.jurusan_id) : null, bobot_tugas: +r.bobot_tugas, bobot_uh: +r.bobot_uh, bobot_pts: +r.bobot_pts, bobot_pas: +r.bobot_pas })) });
      toast.success('Aturan bobot tersimpan.'); await load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal menyimpan bobot.'); } finally { setSaving(''); }
  };

  const saveKkm = async () => {
    setSaving('kkm');
    try {
      await adminGradesAPI.saveKkm({ items: kkmRows.map((r) => ({ subject_id: r.subject_id, tingkat: null, kktp: Number(r.kktp) || 0 })) });
      toast.success('KKM / KKTP tersimpan.'); await load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal menyimpan KKM.'); } finally { setSaving(''); }
  };

  const savePred = async () => {
    setSaving('pred');
    try {
      await adminGradesAPI.savePredikat({ items: predikat.map((r) => ({ grade: r.grade, predikat: r.predikat, batas_bawah: Number(r.batas_bawah), batas_atas: Number(r.batas_atas) })) });
      toast.success('Rentang predikat tersimpan.'); await load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Gagal menyimpan predikat.'); } finally { setSaving(''); }
  };

  const inputCls = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

  return (
    <div className="space-y-6">
      {/* Bobot */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Bobot Komponen Nilai Rapor</h3>
          <div className="flex gap-2">
            <button onClick={addRule} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-200"><Plus className="h-3.5 w-3.5" /> Baris</button>
            <button onClick={saveRules} disabled={saving === 'rules'} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-[10px] font-black uppercase text-white hover:bg-indigo-700 disabled:opacity-60">{saving === 'rules' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan</button>
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          {rules.length === 0 ? <p className="py-6 text-center text-sm font-bold text-slate-400">Belum ada aturan. Klik "Baris" untuk menambah.</p> : (
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-2 py-2">Tingkat</th><th className="px-2 py-2">Jurusan</th><th className="px-2 py-2 w-24">Tugas/Formatif</th><th className="px-2 py-2 w-24">Ulangan Harian</th><th className="px-2 py-2 w-24">PTS/UTS</th><th className="px-2 py-2 w-24">PAS/PAT</th><th className="px-2 py-2 w-20 text-center">Total</th><th className="px-2 py-2 w-10" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((r, i) => { const sum = ruleSum(r); return (
                  <tr key={i}>
                    <td className="px-2 py-2"><select value={r.tingkat || ''} onChange={(e) => updRule(i, 'tingkat', e.target.value)} className={inputCls}><option value="">Semua</option>{tingkatOpts.map((t) => <option key={t} value={t}>{t}</option>)}</select></td>
                    <td className="px-2 py-2"><select value={r.jurusan_id || ''} onChange={(e) => updRule(i, 'jurusan_id', e.target.value)} className={inputCls}><option value="">Umum</option>{jurusans.map((j) => <option key={j.id} value={j.id}>{j.code || j.name}</option>)}</select></td>
                    {['bobot_tugas', 'bobot_uh', 'bobot_pts', 'bobot_pas'].map((key) => <td key={key} className="px-2 py-2"><input type="number" min="0" max="100" value={r[key]} onChange={(e) => updRule(i, key, e.target.value)} className={inputCls} /></td>)}
                    <td className="px-2 py-2 text-center"><span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${sum === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{sum}%</span></td>
                    <td className="px-2 py-2 text-right"><button onClick={() => delRule(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* KKM */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Standar KKM / KKTP per Mata Pelajaran</h3>
          <button onClick={saveKkm} disabled={saving === 'kkm' || kkmRows.length === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-[10px] font-black uppercase text-white hover:bg-indigo-700 disabled:opacity-60">{saving === 'kkm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan</button>
        </div>
        <div className="max-h-96 overflow-y-auto p-4">
          {kkmRows.length === 0 ? <p className="py-6 text-center text-sm font-bold text-slate-400">Belum ada mata pelajaran.</p> : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {kkmRows.map((r, i) => (
                <div key={r.subject_id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-700">{r.name}</p><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Kel. {r.kelompok || '—'}</p></div>
                  <input type="number" min="0" max="100" value={r.kktp} onChange={(e) => setKkmRows((rs) => rs.map((x, idx) => (idx === i ? { ...x, kktp: e.target.value } : x)))} className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Predikat */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Rentang Predikat</h3>
          <button onClick={savePred} disabled={saving === 'pred'} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-[10px] font-black uppercase text-white hover:bg-indigo-700 disabled:opacity-60">{saving === 'pred' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan</button>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-2 py-2 w-16">Nilai</th><th className="px-2 py-2">Predikat</th><th className="px-2 py-2 w-28">Batas Bawah</th><th className="px-2 py-2 w-28">Batas Atas</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {predikat.map((r, i) => (
                <tr key={r.grade}>
                  <td className="px-2 py-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-sm font-black text-indigo-600">{r.grade}</span></td>
                  <td className="px-2 py-2"><input value={r.predikat} onChange={(e) => setPredikat((ps) => ps.map((x, idx) => (idx === i ? { ...x, predikat: e.target.value } : x)))} className={inputCls} /></td>
                  <td className="px-2 py-2"><input type="number" min="0" max="100" value={r.batas_bawah} onChange={(e) => setPredikat((ps) => ps.map((x, idx) => (idx === i ? { ...x, batas_bawah: e.target.value } : x)))} className={inputCls} /></td>
                  <td className="px-2 py-2"><input type="number" min="0" max="100" value={r.batas_atas} onChange={(e) => setPredikat((ps) => ps.map((x, idx) => (idx === i ? { ...x, batas_atas: e.target.value } : x)))} className={inputCls} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ══════════════ TAB 3 — LEGGER & CETAK ══════════════ */
function LedgerTab() {
  const [classes, setClasses] = useState([]);
  const [sel, setSel] = useState({ kelas_id: '', semester: 'ganjil', tahun_ajaran: '' });
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminGradesAPI.getOptions().then(({ data }) => setClasses(data?.data?.classes || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!sel.kelas_id) { setLedger(null); return; }
    setLoading(true);
    try {
      const { data } = await adminGradesAPI.getLedger({ kelas_id: sel.kelas_id, semester: sel.semester, tahun_ajaran: sel.tahun_ajaran || undefined });
      setLedger(data?.data || null);
    } catch (e) { toast.error(e?.response?.data?.message || 'Legger gagal dimuat.'); } finally { setLoading(false); }
  }, [sel.kelas_id, sel.semester, sel.tahun_ajaran]);

  useEffect(() => { load(); }, [load]);
  useRealtimeReload(load);

  const subjects = ledger?.subjects || [];
  const rows = ledger?.rows || [];
  const meta = ledger?.meta || {};

  const exportLegger = () => {
    if (!rows.length) return toast.error('Muat legger terlebih dahulu.');
    const data = rows.map((r, i) => { const base = { No: i + 1, NIS: r.nis || '-', 'Nama Siswa': r.name }; subjects.forEach((s) => { base[s.name] = r.values[s.id] ?? ''; }); base['Total'] = r.total; base['Rata-rata'] = r.rata ?? ''; base['Peringkat'] = r.rank ?? ''; return base; });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Legger');
    XLSX.writeFile(wb, `Legger_${ledger?.class?.name || 'Kelas'}_${sel.semester}.xlsx`);
  };

  const printRapor = (onlyStudent) => {
    if (!meta.can_print) return toast.error('Cetak aktif hanya bila nilai lengkap & terkunci.');
    const list = onlyStudent ? rows.filter((r) => r.student_id === onlyStudent) : rows;
    const esc = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const head = `<tr><th>No</th><th>NIS</th><th>Nama</th>${subjects.map((s) => `<th>${esc(s.name)}</th>`).join('')}<th>Total</th><th>Rata</th><th>Rank</th></tr>`;
    const body = list.map((r, i) => `<tr><td>${onlyStudent ? 1 : i + 1}</td><td>${esc(r.nis || '—')}</td><td>${esc(r.name)}</td>${subjects.map((s) => `<td>${r.values[s.id] ?? '—'}</td>`).join('')}<td>${r.total}</td><td>${r.rata ?? '—'}</td><td>${r.rank ?? '—'}</td></tr>`).join('');
    const w = window.open('', '_blank');
    if (!w) return toast.error('Izinkan pop-up untuk mencetak.');
    w.document.write(`<!doctype html><html><head><title>Rapor ${esc(ledger?.class?.name)}</title><style>body{font:13px Arial,sans-serif;color:#172033;padding:28px}h1{font-size:20px;margin:0 0 4px}p{color:#64748b;margin:0 0 18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dbe2eb;padding:7px;text-align:left}th{background:#f1f5f9;font-size:10px;text-transform:uppercase}td:nth-child(n+4){text-align:center}</style></head><body><h1>Legger Nilai — ${esc(ledger?.class?.name)}</h1><p>${esc(sel.semester)} · TA ${esc(ledger?.tahun_ajaran)} · Diterbitkan ${new Date().toLocaleDateString('id-ID')}</p><table><thead>${head}</thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
          <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Kelas</span>
            <select value={sel.kelas_id} onChange={(e) => setSel((s) => ({ ...s, kelas_id: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500"><option value="">-- Pilih kelas --</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Semester</span>
            <select value={sel.semester} onChange={(e) => setSel((s) => ({ ...s, semester: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500">{SEMESTER_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Tahun Ajaran</span>
            <input value={sel.tahun_ajaran} onChange={(e) => setSel((s) => ({ ...s, tahun_ajaran: e.target.value }))} placeholder="mis. 2026/2027" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500" /></label>
          <button onClick={load} disabled={!sel.kelas_id || loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Tampilkan</button>
        </div>
      </div>

      {ledger && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${meta.can_print ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-center gap-2 text-sm font-bold">
            {meta.can_print ? <><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="text-emerald-700">Nilai lengkap &amp; terkunci — siap dicetak.</span></>
              : <><AlertTriangle className="h-5 w-5 text-amber-600" /><span className="text-amber-700">Cetak terkunci: {meta.class_complete ? '' : 'nilai belum lengkap'}{!meta.class_complete && !meta.class_locked ? ' & ' : ''}{meta.class_locked ? '' : 'belum semua mapel dikunci'}.</span></>}
          </div>
          <div className="flex gap-2">
            <button onClick={exportLegger} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><FileSpreadsheet className="h-4 w-4" /> Export Legger</button>
            <button onClick={() => printRapor(null)} disabled={!meta.can_print} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Printer className="h-4 w-4" /> Cetak Rapor Kelas</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3"><h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Legger Nilai Kelas</h3></div>
        {!ledger ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center"><Users className="h-8 w-8 text-slate-200" /><p className="text-sm font-bold text-slate-400">Pilih kelas lalu klik Tampilkan.</p></div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm font-bold text-slate-400">Belum ada murid di kelas ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-3 py-3">No</th><th className="px-3 py-3">NIS</th><th className="px-3 py-3">Nama</th>{subjects.map((s) => <th key={s.id} className="px-3 py-3 text-center">{s.name}{s.name === 'PKL / Prakerin' ? ' (PKL)' : ''}</th>)}<th className="px-3 py-3 text-center">Total</th><th className="px-3 py-3 text-center">Rata</th><th className="px-3 py-3 text-center">Rank</th><th className="px-3 py-3 text-center">Absensi</th><th className="px-3 py-3 text-center">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.student_id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.nis || '—'}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{r.name}</td>
                    {subjects.map((s) => <td key={s.id} className="px-3 py-2 text-center">{r.values[s.id] ?? '—'}</td>)}
                    <td className="px-3 py-2 text-center font-bold text-slate-700">{r.total}</td>
                    <td className="px-3 py-2 text-center font-black text-slate-800">{r.rata ?? '—'}</td>
                    <td className="px-3 py-2 text-center font-bold text-indigo-600">{r.rank ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-[11px] font-bold text-slate-500">{r.absensi_hadir == null ? '—' : `${r.absensi_hadir}/${r.absensi_total}`}</td>
                    <td className="px-3 py-2 text-center"><button onClick={() => printRapor(r.student_id)} disabled={!meta.can_print} className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-600 hover:text-white disabled:opacity-40">Cetak</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ledger && rows.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
          <p className="mb-1 font-black uppercase tracking-widest text-slate-600">Catatan Wali Kelas</p>
          <div className="grid gap-1">
            {rows.filter((r) => r.catatan_wali).slice(0, 6).map((r) => <p key={r.student_id}><span className="font-bold text-slate-700">{r.name}:</span> {r.catatan_wali}</p>)}
            {rows.every((r) => !r.catatan_wali) && <p className="italic text-slate-400">Belum ada catatan wali kelas tersimpan.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════ SHELL ══════════════ */
export default function GradesReportTab() {
  const [tab, setTab] = useState('monitor');

  return (
    <section className="space-y-5 pb-8 text-slate-800">
      <div className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-5 py-6 md:px-7">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-indigo-600 p-3 text-white shadow-lg shadow-indigo-600/20"><ClipboardCheck size={23} /></div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Pengolahan Nilai <span className="text-indigo-600">&amp; Rapor</span></h2>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${tab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'monitor' && <MonitoringTab />}
      {tab === 'aturan' && <AturanTab />}
      {tab === 'ledger' && <LedgerTab />}
    </section>
  );
}
