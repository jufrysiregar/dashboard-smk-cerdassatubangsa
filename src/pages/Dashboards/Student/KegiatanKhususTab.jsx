import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { studentAPI } from '../../../utils/api';
import { getQueryData, setQueryData } from '../../../utils/queryCache';
import {
  Trophy, Briefcase, CalendarDays, Clock, MapPin, Download, Award, Sparkles, X,
  Filter, GraduationCap, TrendingUp, Building2, Eye, Coins,
} from 'lucide-react';

const TINGKAT_LABEL = { sekolah: 'Sekolah', kecamatan: 'Kecamatan', kabupaten: 'Kabupaten/Kota', provinsi: 'Provinsi', nasional: 'Nasional', internasional: 'Internasional' };
const TIPE_KEGIATAN = { perlombaan: 'Perlombaan', pertukaran_siswa: 'Pertukaran Siswa', study_tour: 'Study Tour', ekstrakurikuler: 'Ekstrakurikuler', magang: 'Magang' };
const PKL_STATUS = { aktif: 'bg-sky-50 text-sky-700 border-sky-200', selesai: 'bg-emerald-50 text-emerald-700 border-emerald-200', belum: 'bg-slate-100 text-slate-500 border-slate-200' };

// Kunci cache in-memory (pola queryCache) → render instan saat pindah menu.
const kegiatanCacheKey = (ta, sem) => `student:kegiatan:${ta || ''}:${sem || ''}`;
const PKL_CACHE_KEY = 'student:pkl';

const dash = (v) => { const s = v == null ? '' : String(v).trim(); return s !== '' ? s : null; };

function pklTampilan(status) {
  if (!status) return 'Belum Terjadwal';
  const k = String(status).toLowerCase();
  if (['aktif', 'berlangsung', 'jalan', 'proses', 'magang'].includes(k)) return 'Aktif PKL';
  if (['selesai', 'final', 'lulus', 'terakhir'].includes(k)) return 'Selesai';
  return status;
}
function pklBadgeKey(status) {
  if (!status) return 'belum';
  const k = String(status).toLowerCase();
  if (['aktif', 'berlangsung', 'jalan', 'proses', 'magang'].includes(k)) return 'aktif';
  if (['selesai', 'final', 'lulus'].includes(k)) return 'selesai';
  return 'belum';
}

function Loading() { return <div className="p-8 text-center text-sm font-bold text-slate-400">Memuat data kegiatan...</div>; }
function Empty({ text }) { return <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-400">{text}</div>; }

// ── Modal house-style (portal, z-[9999], Esc + X) — read-only ───
function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18 }}
        className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ── KPI themed (seragam dgn Keuangan & Nilai) ────────────────────
function KpiCard({ icon: Icon, label, value, sub, theme }) {
  const shown = value === '' || value == null ? '—' : value;
  return (
    <div className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${theme.card}`}>
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl ${theme.glow}`} />
      <Icon className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${theme.watermark}`} strokeWidth={1.5} />
      <div className="relative flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ring-1 ring-white/60 ${theme.iconBox}`}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="truncate text-2xl font-black leading-tight text-slate-900">{shown}</p>
        </div>
      </div>
      {sub && <p className="relative mt-2 text-[11px] font-bold text-slate-500">{sub}</p>}
    </div>
  );
}

function DonutChart({ total, segments }) {
  const R = 42, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#F1F5F9" strokeWidth="12" />
          {total > 0 && segments.map((s) => {
            if (!s.value) return null;
            const segLen = (s.value / total) * C;
            const seg = <circle key={s.key} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${segLen} ${C - segLen}`} strokeDashoffset={-acc} />;
            acc += segLen;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-slate-900">{total}</span>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">catatan</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-bold text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}</span>
            <span className="font-black text-slate-800">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab 1: Prestasi & Penghargaan (prestasi_wali_kelas, read-only)
function PrestasiSection({ items, onDetail }) {
  const [tingkat, setTingkat] = useState('all');
  const opts = useMemo(() => Array.from(new Set(items.map((p) => p.tingkat).filter(Boolean))), [items]);
  const list = tingkat === 'all' ? items : items.filter((p) => p.tingkat === tingkat);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Filter size={15} className="text-slate-400" />
        <select value={tingkat} onChange={(e) => setTingkat(e.target.value)} className="appearance-none rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 outline-none focus:border-indigo-400">
          <option value="all">Semua Tingkat</option>
          {opts.map((t) => <option key={t} value={t}>{TINGKAT_LABEL[t] || t}</option>)}
        </select>
        <span className="text-[11px] font-bold text-slate-400">{list.length} prestasi</span>
      </div>

      {!list.length ? <Empty text="Belum ada catatan prestasi dari Wali Kelas untuk Anda." /> : (
        <div className="grid gap-3">
          {list.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-xl bg-amber-50 p-2.5 text-amber-600"><Trophy size={20} /></div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-black text-slate-800">{p.nama_kegiatan}</h4>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase text-indigo-700">Tingkat {TINGKAT_LABEL[p.tingkat] || p.tingkat || '-'}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700"><Coins size={11} /> +{p.poin} Poin</span>
                    {(p.tahun_ajaran || p.semester) && <span className="text-xs font-bold text-slate-400">{dash(p.semester)}{p.tahun_ajaran ? ` · ${p.tahun_ajaran}` : ''}</span>}
                  </div>
                  {p.keterangan && <p className="mt-2 line-clamp-2 text-xs text-slate-500 leading-relaxed">{p.keterangan}</p>}
                </div>
                <button type="button" onClick={() => onDetail(p)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-50"><Eye size={13} /> Detail</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: PKL / Magang (read-only, tanpa form) ──────────────────
function PklSection({ pkl }) {
  if (!pkl) return <Empty text="Belum ada jadwal penempatan PKL dari Pusat Jurusan." />;

  const logbook = pkl.logbooks || [];
  const sertifikat = pkl.sertifikat;
  const pembimbingName = pkl.guru_pembimbing?.name || pkl.pembimbing;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-xl bg-sky-50 p-2.5 text-sky-600"><Building2 size={20} /></div>
            <div>
              <h4 className="text-sm font-black text-slate-800">{dash(pkl.tempat_magang) || 'Instansi belum diisi'}</h4>
              {pkl.alamat_magang && <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12} /> {pkl.alamat_magang}</p>}
              <p className="mt-1 text-xs font-bold text-slate-500">{(pkl.tanggal_mulai || '').slice(0, 10) || '-'} s/d {(pkl.tanggal_selesai || '').slice(0, 10) || '-'}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${PKL_STATUS[pklBadgeKey(pkl.status)]}`}>{pklTampilan(pkl.status)}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div><p className="font-black uppercase text-[10px] text-slate-400">Guru Pembimbing</p><p className="font-bold text-slate-700">{dash(pembimbingName) || '-'}</p></div>
          <div><p className="font-black uppercase text-[10px] text-slate-400">Nilai PKL</p><p className="font-bold text-slate-700">{pkl.nilai_akhir == null ? '-' : pkl.nilai_akhir}</p></div>
          <div><p className="font-black uppercase text-[10px] text-slate-400">Status Final</p><p className="font-bold text-slate-700">{dash(pkl.status_final) || '-'}</p></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><Award size={15} /> Sertifikat PKL</h4>
        {sertifikat ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-indigo-50 px-4 py-3">
            <div><p className="text-sm font-black text-indigo-800">{sertifikat.nomor_sertifikat}</p><p className="text-[10px] font-semibold uppercase text-indigo-500">Terbit {sertifikat.tanggal_terbit}</p></div>
            {sertifikat.file_path ? <a href={`/storage/${sertifikat.file_path}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-indigo-700"><Download size={13} /> Unduh</a> : <span className="text-[10px] font-bold uppercase text-indigo-500">Terverifikasi</span>}
          </div>
        ) : <p className="text-xs text-slate-400">Sertifikat belum diterbitkan Pusat Jurusan.</p>}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><CalendarDays size={15} /> Riwayat Logbook PKL</h4>
        {logbook.length === 0 ? <p className="text-xs text-slate-400">Belum ada logbook tercatat.</p> : (
          <ul className="space-y-2">
            {logbook.map((l) => (
              <li key={l.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs font-bold text-slate-700">{l.uraian || l.aktivitas}</p>
                <p className="text-[10px] text-slate-400">{(l.tanggal || '').slice(0, 10) || '-'}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Kegiatan Sekolah (read-only) ──────────────────────────
function KegiatanSection({ items, onDetail }) {
  const [tipe, setTipe] = useState('all');
  const opts = useMemo(() => Array.from(new Set(items.map((a) => a.activity_type).filter(Boolean))), [items]);
  const list = tipe === 'all' ? items : items.filter((a) => a.activity_type === tipe);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Filter size={15} className="text-slate-400" />
        <select value={tipe} onChange={(e) => setTipe(e.target.value)} className="appearance-none rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 outline-none focus:border-violet-400">
          <option value="all">Semua Kategori</option>
          {opts.map((t) => <option key={t} value={t}>{TIPE_KEGIATAN[t] || t}</option>)}
        </select>
        <span className="text-[11px] font-bold text-slate-400">{list.length} kegiatan</span>
      </div>

      {!list.length ? <Empty text="Anda belum tercatat sebagai peserta kegiatan sekolah." /> : (
        <div className="grid gap-3">
          {list.map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-xl bg-violet-50 p-2.5 text-violet-600"><Sparkles size={20} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-black text-slate-800">{a.title}</h4>
                    <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase text-violet-700">{TIPE_KEGIATAN[a.activity_type] || a.activity_type}</span>
                  </div>
                  {Object.keys(a.meta || {}).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(a.meta).map(([k, v]) => (
                        <span key={k} className="text-xs text-slate-500"><span className="font-black uppercase text-[10px] text-slate-400">{k}:</span> {v}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => onDetail(a)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-50"><Eye size={13} /> Detail</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: 'prestasi', label: 'Prestasi & Penghargaan', Icon: Trophy },
  { id: 'pkl', label: 'PKL / Magang', Icon: Briefcase },
  { id: 'kegiatan', label: 'Kegiatan Sekolah', Icon: CalendarDays },
];

const KegiatanKhususTab = ({ profile, academicPeriod, clock }) => {
  const period = academicPeriod || {};
  const cacheKey = kegiatanCacheKey(period.academic_year, period.semester);

  // Cache-first: render instan dari cache (tanpa "Memuat data kegiatan..."), lalu silent refetch.
  const [data, setData] = useState(() => getQueryData(cacheKey) ?? null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('prestasi');
  const [pkl, setPkl] = useState(() => { const c = getQueryData(PKL_CACHE_KEY); return c === undefined ? null : c; });
  const [detail, setDetail] = useState(null); // { type: 'prestasi'|'kegiatan', item }

  const load = useCallback(async () => {
    const cached = getQueryData(cacheKey);
    if (cached !== undefined) setData(cached);
    setError('');
    try {
      const r = await studentAPI.getActivities({ tahun_ajaran: period.academic_year || undefined, semester: period.semester || undefined });
      const d = r.data.data;
      setQueryData(cacheKey, d);
      setData(d);
    } catch {
      if (getQueryData(cacheKey) === undefined) setError('Data kegiatan gagal dimuat.');
    }
  }, [cacheKey, period.academic_year, period.semester]);

  const loadPkl = useCallback(async () => {
    const cached = getQueryData(PKL_CACHE_KEY);
    if (cached !== undefined) setPkl(cached);
    try {
      const r = await studentAPI.getPkl();
      const d = r.data?.data || null;
      setQueryData(PKL_CACHE_KEY, d);
      setPkl(d);
    } catch { /* diam: biarkan cache / empty-state tampil */ }
  }, []);

  useEffect(() => { load(); loadPkl(); }, [load, loadPkl]);

  const summary = data?.summary || {};
  const prestasiWali = data?.prestasi_wali || [];
  const kegiatan = data?.kegiatan || [];

  const counts = useMemo(() => ({
    prestasi: prestasiWali.length,
    pkl: pkl ? 1 : 0,
    kegiatan: kegiatan.length,
  }), [prestasiWali, pkl, kegiatan]);

  const donut = useMemo(() => {
    const ekskul = kegiatan.filter((a) => a.activity_type === 'ekstrakurikuler').length;
    const kegLain = kegiatan.length - ekskul;
    const segs = [
      { key: 'prestasi', label: 'Prestasi Lomba (Wali Kelas)', value: summary.prestasi_wali_count || 0, color: '#F59E0B' },
      { key: 'ekskul', label: 'Ekstrakurikuler', value: ekskul, color: '#8B5CF6' },
      { key: 'kegiatan', label: 'Kegiatan Sekolah', value: kegLain, color: '#0EA5E9' },
    ];
    return { total: segs.reduce((a, s) => a + s.value, 0), segs };
  }, [kegiatan, summary.prestasi_wali_count]);

  if (!data) {
    if (error) return <div className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-600">{error}</div>;
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      {/* HERO — identik Tugas & Ujian / Keuangan */}
      <div className="relative overflow-hidden rounded-[3rem] border border-blue-100 bg-white p-8 text-slate-900 shadow-xl xl:p-12">
        <div className="absolute right-0 top-0 h-full w-[45%] rounded-full bg-gradient-to-l from-[#0ea5e9] via-[#0284c7] to-[#0369a1] opacity-20 blur-[120px]"></div>
        <div className="absolute left-0 top-0 h-full w-[35%] rounded-full bg-gradient-to-r from-[#0ea5e9] via-[#0284c7] to-[#0369a1] opacity-10 blur-[100px]"></div>
        <div className="relative flex flex-col items-start justify-between gap-6 text-left md:flex-row md:items-center">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
              <GraduationCap className="h-3 w-3" /> Portal Students Authority
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Kegiatan Khusus &amp; Pengembangan Diri</h1>
            <p className="mt-2 max-w-3xl text-base font-normal text-slate-500">
              Pantau prestasi, penempatan PKL / Magang, dan kegiatan sekolah Anda.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 rounded-2xl border border-gray-100 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-widest text-slate-700">{clock?.day},</span>
              <span className="text-xs font-bold text-slate-500">{clock?.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-lg font-black tabular-nums tracking-widest text-slate-700">{clock?.time}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">WIB</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 KPI CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Trophy} label="Total Prestasi"
          value={summary.prestasi_wali_count || 0}
          sub={`+${summary.poin_wali_total || 0} poin prestasi wali`}
          theme={{ card: 'from-amber-50/90 via-white to-yellow-50/50 border-amber-200/70', glow: 'bg-amber-200/50', watermark: 'text-amber-500 opacity-[0.07]', iconBox: 'from-amber-100 to-amber-50 text-amber-700' }} />
        <KpiCard icon={Briefcase} label="Status PKL / Magang"
          value={pklTampilan(summary.pkl?.status)}
          sub={dash(summary.pkl?.tempat_magang) || 'Belum ada penempatan'}
          theme={{ card: 'from-sky-50/90 via-white to-blue-50/50 border-sky-200/70', glow: 'bg-sky-200/50', watermark: 'text-sky-500 opacity-[0.07]', iconBox: 'from-sky-100 to-sky-50 text-sky-700' }} />
        <KpiCard icon={CalendarDays} label="Kegiatan & Ekskul"
          value={summary.kegiatan_count || 0}
          sub="kegiatan / ekskul tercatat"
          theme={{ card: 'from-violet-50/90 via-white to-fuchsia-50/50 border-violet-200/70', glow: 'bg-violet-200/50', watermark: 'text-violet-500 opacity-[0.07]', iconBox: 'from-violet-100 to-violet-50 text-violet-700' }} />
        <KpiCard icon={TrendingUp} label="Poin Tambahan Rapor"
          value={`+${summary.poin_wali_total || 0}`}
          sub="otomatis masuk skor rapor"
          theme={{ card: 'from-emerald-50/90 via-white to-teal-50/50 border-emerald-200/70', glow: 'bg-emerald-200/50', watermark: 'text-emerald-500 opacity-[0.07]', iconBox: 'from-emerald-100 to-emerald-50 text-emerald-700' }} />
      </div>

      {/* BARIS 2 KOLOM RINGKASAN (read-only, tanpa panel aksi) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700"><Sparkles className="h-4 w-4 text-violet-600" /> Komposisi Prestasi &amp; Keaktifan</h3>
          {donut.total > 0 ? (
            <>
              <DonutChart total={donut.total} segments={donut.segs} />
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700">
                <Coins size={16} /> Poin tambahan rapor: +{summary.poin_wali_total || 0}
              </div>
            </>
          ) : (
            <Empty text="Belum ada catatan prestasi maupun keaktifan pada semester ini." />
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700"><Building2 className="h-4 w-4 text-sky-600" /> Status PKL &amp; Pembimbing Aktif</h3>
          {pkl ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-slate-800">{dash(pkl.tempat_magang) || 'Instansi belum diisi'}</p>
                  {pkl.alamat_magang && <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12} /> {pkl.alamat_magang}</p>}
                  <p className="mt-1 text-xs font-bold text-slate-500">{(pkl.tanggal_mulai || '').slice(0, 10) || '-'} s/d {(pkl.tanggal_selesai || '').slice(0, 10) || '-'}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${PKL_STATUS[pklBadgeKey(pkl.status)]}`}>{pklTampilan(pkl.status)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3"><p className="font-black uppercase text-[10px] text-slate-400">Guru Pembimbing</p><p className="mt-0.5 font-bold text-slate-700">{dash(pkl.guru_pembimbing?.name || pkl.pembimbing) || '-'}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="font-black uppercase text-[10px] text-slate-400">Nilai PKL</p><p className="mt-0.5 font-bold text-slate-700">{pkl.nilai_akhir == null ? '-' : pkl.nilai_akhir}</p></div>
              </div>
            </div>
          ) : (
            <Empty text="Belum ada jadwal penempatan PKL dari Pusat Jurusan." />
          )}
        </div>
      </div>

      {/* TAB BAR */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${activeTab === t.id ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'}`}>
            <t.Icon size={15} /> <span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.label.split(' ')[0]}</span>
            {counts[t.id] > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === t.id ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-500'}`}>{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === 'prestasi' && <PrestasiSection items={prestasiWali} onDetail={(item) => setDetail({ type: 'prestasi', item })} />}
        {activeTab === 'pkl' && <PklSection pkl={pkl} />}
        {activeTab === 'kegiatan' && <KegiatanSection items={kegiatan} onDetail={(item) => setDetail({ type: 'kegiatan', item })} />}
      </motion.div>

      {/* MODAL: Detail (read-only) */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.type === 'prestasi' ? 'Detail Prestasi' : 'Detail Kegiatan'}>
        {detail?.type === 'prestasi' && (() => { const p = detail.item; return (
          <div className="space-y-3 text-sm">
            <h4 className="text-lg font-black text-slate-900">{p.nama_kegiatan}</h4>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase text-indigo-700">Tingkat {TINGKAT_LABEL[p.tingkat] || p.tingkat || '-'}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700"><Coins size={11} /> +{p.poin} Poin</span>
              {(p.tahun_ajaran || p.semester) && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">{dash(p.semester)}{p.tahun_ajaran ? ` · ${p.tahun_ajaran}` : ''}</span>}
            </div>
            {p.keterangan ? <p className="leading-relaxed text-slate-600">{p.keterangan}</p> : <p className="italic text-slate-400">Tidak ada keterangan tambahan dari Wali Kelas.</p>}
          </div>
        ); })()}
        {detail?.type === 'kegiatan' && (() => { const a = detail.item; return (
          <div className="space-y-3 text-sm">
            <h4 className="text-lg font-black text-slate-900">{a.title}</h4>
            <span className="inline-block rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase text-violet-700">{TIPE_KEGIATAN[a.activity_type] || a.activity_type}</span>
            {Object.keys(a.meta || {}).length > 0 ? (
              <div className="space-y-1.5">
                {Object.entries(a.meta).map(([k, v]) => (<p key={k} className="text-slate-600"><span className="font-black uppercase text-[10px] text-slate-400">{k}:</span> {v}</p>))}
              </div>
            ) : <p className="italic text-slate-400">Tidak ada rincian tambahan.</p>}
            {a.created_at && <p className="text-xs text-slate-400">Dicatat: {new Date(a.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
          </div>
        ); })()}
      </Modal>
    </div>
  );
};

export default KegiatanKhususTab;
