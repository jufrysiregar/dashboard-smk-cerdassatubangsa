import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, BookOpen, CalendarDays, CheckCircle2, Clock, Clock3, Download,
  Eye, FileText, GraduationCap, Loader2, RotateCw, Users, CalendarRange, BarChart3,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import useEscapeKey from '../../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';
import { teacherAPI } from '../../../../utils/api';
import SesiKbmModal from './SesiKbmModal';

const weekdays = { sun: 'minggu', mon: 'senin', tue: 'selasa', wed: 'rabu', thu: 'kamis', fri: 'jumat', sat: 'sabtu' };
const DAY_ORDER = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const DAY_LABEL = { senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu' };

const getJakartaDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const getJakartaDay = () => weekdays[new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jakarta', weekday: 'short',
}).format(new Date()).toLowerCase()];
const getJakartaTime = () => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date());

const hhmm = (v) => (v ? String(v).slice(0, 5) : '-');
const monthStartEnd = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  const start = `${monthStr}-01`;
  const last = new Date(y, m, 0).getDate();
  return [start, `${monthStr}-${String(last).padStart(2, '0')}`];
};

const STATUS_BADGE = {
  live: { label: 'Sedang Berlangsung', cls: 'bg-emerald-500 text-white', pulse: true },
  saved: { label: 'Tersimpan', cls: 'bg-sky-100 text-sky-700', pulse: false },
  upcoming: { label: 'Akan Datang', cls: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200', pulse: false },
  outside: { label: 'Di Luar Jam Mengajar', cls: 'bg-slate-100 text-slate-400', pulse: false },
};

/**
 * KBM & Presensi — ruang kerja guru 3 tab (data 100% riil dari DB):
 *  1. Presensi & Jurnal Hari Ini — kartu sesi + status otomatis (jam vs jadwal + rekaman DB).
 *  2. Jadwal Mengajar Mingguan — dari jadwal KBM Admin Akademik, hari ini di-highlight.
 *  3. Riwayat Jurnal & Rekap Kehadiran — jurnal milik guru + rekap presensi + ekspor xlsx.
 * Aturan validasi jam mengajar TETAP ditekankan backend saat input (modal menampilkan
 * pesan penolakan asli bila dibuka di luar jam).
 */
const EPresensiTab = ({ clock }) => {
  const tanggal = getJakartaDate();
  const hariIni = getJakartaDay();

  const [activeTab, setActiveTab] = useState('hari');
  const [sessions, setSessions] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [scheduleError, setScheduleError] = useState('');
  const [weekly, setWeekly] = useState([]);
  const [loadingWeekly, setLoadingWeekly] = useState(false);

  // Tab 3
  const [filters, setFilters] = useState(() => {
    const d = new Date();
    return { kelas_id: 'all', mapel_id: 'all', month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
  });
  const [journals, setJournals] = useState([]);
  const [journalTotal, setJournalTotal] = useState(0);
  const [recap, setRecap] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [detailJurnal, setDetailJurnal] = useState(null);

  // Modal sesi
  const [modalSession, setModalSession] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadToday = useCallback(async () => {
    setLoadingToday(true);
    setScheduleError('');
    try {
      const [schedRes, recapRes, jrRes] = await Promise.all([
        teacherAPI.getMySchedule({ hari: hariIni, tanggal }),
        teacherAPI.getAttendanceRecap({ start_date: tanggal, end_date: tanggal }).catch(() => ({ data: { data: [] } })),
        teacherAPI.getJournals({ tanggal, per_page: 100 }).catch(() => ({ data: { data: { data: [] } } })),
      ]);
      const list = schedRes.data?.data || [];
      const jrList = jrRes.data?.data?.data || [];
      const recapRows = (recapRes.data?.data || []).filter((r) => String(r.tanggal).slice(0, 10) === tanggal);

      setSessions(list.map((item) => {
        const jamStart = hhmm(item.jam_mulai);
        // Recap presensi di-key (tanggal, kelas, mapel, jam_mulai) — cocokkan via nama + jam.
        const used = recapRows.filter((r) => (
          String(r.jam_ke).slice(0, 5) === jamStart
          && String(r.nama_kelas || '') === String(item.kelas_nama || '')
          && String(r.nama_mapel || '') === String(item.mapel_nama || '')
        ));
        const hadir = used.filter((r) => r.status === 'hadir' || r.status === 'terlambat').length;
        const jurnal = jrList.find((j) => (
          String(j.jam_ke).slice(0, 5) === jamStart
          && Number(j.kelas_id) === Number(item.kelas_id)
          && Number(j.mapel_id) === Number(item.mapel_id)
        ));
        const saved = used.length > 0 || Boolean(jurnal);
        return {
          ...item,
          jamStart,
          saved,
          tercatat: used.length,
          hadir,
          materi: jurnal?.materi_pokok || null,
          hari_label: DAY_LABEL[String(item.hari || '').toLowerCase()] || item.hari,
        };
      }));
    } catch (error) {
      setScheduleError(error?.response?.data?.message || 'Jadwal hari ini belum dapat dimuat.');
      setSessions([]);
    } finally {
      setLoadingToday(false);
    }
  }, [hariIni, tanggal]);

  const loadWeekly = useCallback(async () => {
    setLoadingWeekly(true);
    try {
      const res = await teacherAPI.getMySchedule();
      setWeekly(res.data?.data || []);
    } catch {
      setWeekly([]);
    } finally {
      setLoadingWeekly(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const [start, end] = monthStartEnd(filters.month);
    try {
      const [jr, rc] = await Promise.all([
        teacherAPI.getJournals({
          start_date: start,
          end_date: end,
          kelas_id: filters.kelas_id,
          mapel_id: filters.mapel_id,
          per_page: 200,
        }),
        teacherAPI.getTeacherAttendanceRecap({ start_date: start, end_date: end }).catch(() => ({ data: { data: [] } })),
      ]);
      setJournals(jr.data?.data?.data || []);
      setJournalTotal(jr.data?.data?.total || 0);
      setRecap(rc.data?.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Riwayat jurnal gagal dimuat.');
      setJournals([]);
      setRecap([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [filters]);

  useEffect(() => { loadToday(); }, [loadToday]);
  useEffect(() => { if (activeTab === 'mingguan' && weekly.length === 0) loadWeekly(); }, [activeTab, weekly.length, loadWeekly]);
  useEffect(() => { if (activeTab === 'riwayat') loadHistory(); }, [activeTab, loadHistory]);

  // Refetch data hari ini saat jendela fokus lagi (tanpa polling).
  useEffect(() => {
    const onFocus = () => loadToday();
    const onVisible = () => { if (document.visibilityState === 'visible') loadToday(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadToday]);

  const kelasOptions = useMemo(() => {
    const map = new Map();
    weekly.forEach((j) => j.kelas_id && map.set(j.kelas_id, j.kelas_nama));
    sessions.forEach((j) => j.kelas_id && map.set(j.kelas_id, j.kelas_nama));
    return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [weekly, sessions]);

  const mapelOptions = useMemo(() => {
    const map = new Map();
    weekly.forEach((j) => j.mapel_id && map.set(j.mapel_id, j.mapel_nama));
    sessions.forEach((j) => j.mapel_id && map.set(j.mapel_id, j.mapel_nama));
    return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [weekly, sessions]);

  const weeklyByDay = useMemo(() => {
    const grouped = Object.fromEntries(DAY_ORDER.map((d) => [d, []]));
    weekly.forEach((j) => {
      const d = String(j.hari || '').toLowerCase();
      if (grouped[d]) grouped[d].push(j);
    });
    Object.values(grouped).forEach((arr) => arr.sort((a, b) => String(a.jam_mulai).localeCompare(String(b.jam_mulai))));
    return grouped;
  }, [weekly]);

  const exportJournals = () => {
    if (journals.length === 0) { toast.error('Belum ada jurnal pada rentang ini.'); return; }
    const rows = journals.map((j) => ({
      'Tanggal': String(j.tanggal).slice(0, 10),
      'Jam': hhmm(j.jam_ke),
      'Kelas': j.class?.name || '-',
      'Mata Pelajaran': j.subject?.name || '-',
      'Materi / Pokok Bahasan': j.materi_pokok || '-',
      'Hadir': j.kehadiran?.hadir ?? 0,
      'Terlambat': j.kehadiran?.terlambat ?? 0,
      'Sakit': j.kehadiran?.sakit ?? 0,
      'Izin': j.kehadiran?.izin ?? 0,
      'Alpha': j.kehadiran?.alpha ?? 0,
      'Catatan': j.catatan || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Jurnal ${filters.month}`);
    XLSX.writeFile(wb, `Laporan_Jurnal_KBM_${filters.month}.xlsx`);
    toast.success('Laporan jurnal berhasil diunduh (.xlsx)');
  };

  const openSession = (item) => {
    // Integrasi lama dipertahankan: klik kartu di LUAR jam sesi => TANPA popup,
    // hanya notifikasi kanan-bawah dengan pesan yang sama persis dengan backend.
    const nowT = getJakartaTime();
    const live = nowT >= String(item.jam_mulai).slice(0, 8) && nowT < String(item.jam_selesai).slice(0, 8);
    if (!live) {
      toast.error('Absensi gagal, diluar jadwal mengajar.');
      return;
    }
    setModalSession({
      jadwal_id: item.jadwal_id,
      kelas_id: item.kelas_id,
      kelas_nama: item.kelas_nama,
      mapel_id: item.mapel_id,
      mapel_nama: item.mapel_nama,
      jam_mulai: item.jam_mulai,
      jam_selesai: item.jam_selesai,
      tanggal,
      hari_label: item.hari_label,
      is_substitute_assignment: item.is_substitute_assignment,
      guru_asli: item.guru_asli,
    });
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* ── Hero (ORIGINAL — tidak diubah) ── */}
      <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="overflow-hidden rounded-[2rem] border border-green-100 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
              <GraduationCap className="h-3 w-3" /> Portal Teachers Workspace
            </div>
            {/* Clock WIB */}
            <div className="flex flex-col items-end gap-1 px-4 py-2 rounded-2xl bg-white/80 border border-green-100 shadow-sm shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clock?.day || 'Hari ini'},</span>
                <span className="text-xs font-bold text-slate-500">{clock?.date || ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-400" />
                <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clock?.time || ''}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">KBM &amp; Presensi</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Pilih jadwal hari ini, catat kehadiran murid, lalu simpan jurnal pembelajaran dalam satu alur terpadu.
          </p>
        </div>
      </motion.header>

      {/* ── Bar Navigasi 3 Tab ── */}
      <div className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {[
          { id: 'hari', label: 'Presensi & Jurnal Hari Ini', icon: Users },
          { id: 'mingguan', label: 'Jadwal Mengajar Mingguan', icon: CalendarRange },
          { id: 'riwayat', label: 'Riwayat Jurnal & Rekap Kehadiran', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all ${
                active
                  ? 'bg-gradient-to-r from-green-500 to-emerald-700 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* ══ TAB 1 — PRESENSI & JURNAL HARI INI ══ */}
        {activeTab === 'hari' && (
          <motion.div key="hari" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><CalendarDays className="h-5 w-5" /></span>
                  <div>
                    <h2 className="font-extrabold text-slate-900">Jadwal Mengajar Hari Ini</h2>
                    <p className="text-sm text-slate-500">{clock?.day || DAY_LABEL[hariIni] || ''}, {clock?.date || tanggal} — klik kartu sesi untuk presensi &amp; jurnal.</p>
                  </div>
                </div>
                <button type="button" onClick={loadToday} disabled={loadingToday} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  <RotateCw className={`h-4 w-4 ${loadingToday ? 'animate-spin' : ''}`} /> Segarkan
                </button>
              </div>

              {scheduleError && (
                <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-semibold text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />{scheduleError}
                </div>
              )}

              {loadingToday ? (
                <div className="px-5 py-12 text-center text-base text-slate-400">Memuat jadwal…</div>
              ) : sessions.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="font-bold text-slate-700">Tidak ada jadwal mengajar hari ini</p>
                  <p className="mt-1 text-base text-slate-500">Jadwal yang ditugaskan kepada Anda akan muncul di sini.</p>
                </div>
              ) : (
                <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {sessions.map((item) => {
                    // Status real-time: dibandingkan ulang tiap render (prop clock tick per detik).
                    const nowT = getJakartaTime();
                    const live = nowT >= String(item.jam_mulai).slice(0, 8) && nowT < String(item.jam_selesai).slice(0, 8);
                    const future = nowT < String(item.jam_mulai).slice(0, 8);
                    const status = live ? 'live' : future ? 'upcoming' : item.saved ? 'saved' : 'outside';
                    const badge = STATUS_BADGE[status];
                    return (
                      <button
                        key={item.jadwal_id}
                        type="button"
                        onClick={() => openSession(item)}
                        className={`group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                          status === 'live' ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white hover:border-emerald-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm font-extrabold tabular-nums text-slate-500">
                            <Clock3 className="h-4 w-4" />{hhmm(item.jam_mulai)}–{hhmm(item.jam_selesai)}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${badge.cls}`}>
                            {badge.pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-3 font-extrabold text-slate-900">{item.kelas_nama || 'Kelas'}</p>
                        <p className="mt-0.5 text-base text-slate-600">{item.mapel_nama || 'Mata pelajaran'}</p>
                        {item.is_substitute_assignment && (
                          <p className="mt-2 text-sm font-bold text-sky-700">Menggantikan {item.guru_asli || 'guru lain'}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
                          {item.saved ? (
                            <>
                              <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} /> {item.hadir}/{item.jumlah_siswa || item.tercatat} Hadir</span>
                              {item.materi && <span className="max-w-[130px] truncate text-slate-400" title={item.materi}>· {item.materi}</span>}
                            </>
                          ) : status === 'upcoming' ? (
                            <span className="text-slate-400">Belum masuk jam mengajar</span>
                          ) : status === 'outside' ? (
                            <span className="text-slate-400">Sesi lewat — belum ada rekaman presensi</span>
                          ) : (
                            <span className="text-emerald-700">Silakan isi presensi &amp; jurnal</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
            <p className="px-1 text-sm font-semibold text-slate-400">
              Presensi &amp; jurnal hanya dapat disimpan saat sesi berjalan (rentang jam jadwal) — penolakan ditampilkan otomatis dari sistem.
            </p>
          </motion.div>
        )}

        {/* ══ TAB 2 — JADWAL MENGAJAR MINGGUAN ══ */}
        {activeTab === 'mingguan' && (
          <motion.div key="mingguan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {loadingWeekly ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center text-base text-slate-400">Memuat jadwal mingguan…</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {DAY_ORDER.map((day) => {
                  const items = weeklyByDay[day] || [];
                  const isToday = day === hariIni;
                  return (
                    <div key={day} className={`rounded-2xl border bg-white shadow-sm transition ${isToday ? 'border-emerald-400 ring-4 ring-emerald-50' : 'border-slate-200'}`}>
                      <div className={`flex items-center justify-between border-b px-4 py-3 ${isToday ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50/60'}`}>
                        <h3 className={`text-base font-black uppercase tracking-wider ${isToday ? 'text-emerald-700' : 'text-slate-600'}`}>{DAY_LABEL[day]}</h3>
                        {isToday && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">Hari Ini</span>}
                      </div>
                      {items.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm font-bold italic text-slate-400">Tidak ada jadwal mengajar</p>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {items.map((j) => (
                            <div key={`${j.jadwal_id}`} className="px-4 py-3">
                              <p className="text-sm font-extrabold tabular-nums text-slate-500">{hhmm(j.jam_mulai)}–{hhmm(j.jam_selesai)}</p>
                              <p className="mt-1 text-base font-black text-slate-800">{j.kelas_nama || 'Kelas'}</p>
                              <p className="text-sm font-semibold text-slate-500">{j.mapel_nama || 'Mata pelajaran'}</p>
                              {j.is_substitute_assignment && <p className="mt-1 text-xs font-bold text-sky-700">Menggantikan {j.guru_asli}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ══ TAB 3 — RIWAYAT JURNAL & REKAP KEHADIRAN ══ */}
        {activeTab === 'riwayat' && (
          <motion.div key="riwayat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
            {/* Filter bar */}
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">Kelas yang Diajar</span>
                <select value={filters.kelas_id} onChange={(e) => setFilters((p) => ({ ...p, kelas_id: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:outline-none">
                  <option value="all">Semua Kelas</option>
                  {kelasOptions.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">Mata Pelajaran</span>
                <select value={filters.mapel_id} onChange={(e) => setFilters((p) => ({ ...p, mapel_id: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:outline-none">
                  <option value="all">Semua Mapel</option>
                  {mapelOptions.map(([id, nama]) => <option key={id} value={id}>{nama}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">Rentang Bulan</span>
                <input type="month" value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:outline-none" />
              </label>
              <button type="button" onClick={loadHistory} disabled={loadingHistory} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <RotateCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} /> Terapkan
              </button>
              <button type="button" onClick={exportJournals} className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition">
                <Download size={14} className="text-emerald-600" /> Ekspor Laporan Jurnal (.xlsx)
              </button>
            </div>

            {/* Tabel riwayat */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-black uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3.5 text-left">Tanggal &amp; Jam</th>
                      <th className="px-3 py-3.5 text-left">Kelas</th>
                      <th className="px-3 py-3.5 text-left">Mata Pelajaran</th>
                      <th className="px-3 py-3.5 text-left min-w-[180px]">Materi / Pokok Bahasan</th>
                      <th className="px-3 py-3.5 text-center">Rekap Kehadiran (H/S/I/A)</th>
                      <th className="px-3 py-3.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingHistory ? (
                      <tr><td colSpan={6} className="py-14 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></td></tr>
                    ) : journals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-14 text-center">
                          <p className="font-bold text-slate-700">Belum ada jurnal pada rentang ini</p>
                          <p className="mt-1 text-sm text-slate-500">Jurnal yang Anda simpan lewat sesi KBM akan tercatat di sini.</p>
                        </td>
                      </tr>
                    ) : (
                      journals.map((j) => {
                        const k = j.kehadiran || {};
                        return (
                          <tr key={j.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800">{formatTanggalJurnal(j.tanggal)}</p>
                              <p className="text-xs font-mono text-slate-400">{hhmm(j.jam_ke)}</p>
                            </td>
                            <td className="px-3 py-3 font-bold text-slate-700">{j.class?.name || '-'}</td>
                            <td className="px-3 py-3 font-semibold text-slate-600">{j.subject?.name || '-'}</td>
                            <td className="max-w-[220px] truncate px-3 py-3 font-semibold text-slate-700" title={j.materi_pokok || ''}>{j.materi_pokok || '-'}</td>
                            <td className="px-3 py-3 text-center">
                              {(k.total || 0) === 0 ? (
                                <span className="text-xs font-bold italic text-slate-300">Tanpa log presensi</span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-black tabular-nums">
                                  <span className="text-emerald-700">{k.hadir + k.terlambat} H</span>
                                  <span className="text-amber-600">{k.sakit} S</span>
                                  <span className="text-blue-600">{k.izin} I</span>
                                  <span className="text-rose-600">{k.alpha} A</span>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button type="button" onClick={() => setDetailJurnal(j)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95">
                                <Eye size={13} /> Detail
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {journals.length > 0 && (
                <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs font-bold text-slate-400">
                  {journals.length} dari {journalTotal} jurnal ditampilkan (rentang {filters.month}).
                </p>
              )}
            </div>

            {/* Ringkasan rekap kehadiran per kelas/mapel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><BarChart3 size={17} /></span>
                <div>
                  <h3 className="text-base font-black text-slate-800">Rekap Kehadiran Mata Pelajaran Anda</h3>
                  <p className="text-sm font-bold text-slate-400">Dihitung riil dari log presensi rentang {filters.month}</p>
                </div>
              </div>
              {recap.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center">
                  <p className="text-sm font-black uppercase tracking-wider text-slate-400">Belum ada pertemuan terekam</p>
                  <p className="mt-1 text-sm font-medium text-slate-400">Rekap muncul setelah presensi sesi KBM disimpan.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {recap.map((r) => (
                    <div key={`${r.kelas_id}-${r.mapel_id}`} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-base font-black text-slate-800">{r.kelas_nama}</p>
                          <p className="truncate text-sm font-bold text-slate-500">{r.mapel_nama} · {r.pertemuan} pertemuan</p>
                        </div>
                        <span className={`text-lg font-black tabular-nums ${r.persentase == null ? 'text-slate-300' : r.persentase >= 90 ? 'text-emerald-600' : r.persentase >= 75 ? 'text-amber-600' : 'text-rose-600'}`}>
                          {r.persentase != null ? `${r.persentase}%` : '-'}
                        </span>
                      </div>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700" style={{ width: `${Math.min(100, r.persentase || 0)}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-bold tabular-nums text-slate-500">
                        H {r.hadir + r.terlambat} · S {r.sakit} · I {r.izin} · A {r.alpha}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal sesi (presensi + jurnal) */}
      <SesiKbmModal
        open={modalOpen}
        session={modalSession}
        onClose={() => setModalOpen(false)}
        onChanged={() => { loadToday(); if (activeTab === 'riwayat') loadHistory(); }}
      />

      {/* Modal detail jurnal riwayat */}
      <JurnalDetailModal jurnal={detailJurnal} onClose={() => setDetailJurnal(null)} />
    </div>
  );
};

const formatTanggalJurnal = (t) => {
  if (!t) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(String(t).slice(0, 10)));
  } catch {
    return String(t).slice(0, 10);
  }
};

function JurnalDetailModal({ jurnal, onClose }) {
  const open = Boolean(jurnal);
  useEscapeKey(open, onClose);
  useBodyScrollLock(open);

  const k = jurnal?.kehadiran || {};
  const absen = jurnal?.siswa_absen || [];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-2xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-black text-slate-800">Detail Jurnal Pertemuan</h3>
              <ModalCloseControl onClose={onClose} />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-5 space-y-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-sm font-black uppercase tracking-wider text-slate-400">{formatTanggalJurnal(jurnal.tanggal)} · {hhmm(jurnal.jam_ke)}</p>
                <p className="mt-1 text-lg font-black text-slate-800">{jurnal.class?.name || '-'} · {jurnal.subject?.name || '-'}</p>
              </div>

              <div>
                <h4 className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><BookOpen size={13} className="text-violet-600" /> Materi / Pokok Bahasan</h4>
                <p className="text-base font-bold text-slate-800">{jurnal.materi_pokok || '-'}</p>
              </div>
              {jurnal.catatan && (
                <div>
                  <h4 className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-500">Kegiatan / Catatan Pembelajaran</h4>
                  <p className="text-base font-medium leading-relaxed text-slate-700">{jurnal.catatan}</p>
                </div>
              )}
              {jurnal.hambatan && (
                <div>
                  <h4 className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-500">Hambatan</h4>
                  <p className="text-base font-medium leading-relaxed text-slate-700">{jurnal.hambatan}</p>
                </div>
              )}

              <div>
                <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Rekap Kehadiran</h4>
                {(k.total || 0) === 0 ? (
                  <p className="text-sm font-bold italic text-slate-400">Tidak ada log presensi pada pertemuan ini.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 text-sm font-black tabular-nums">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Hadir {k.hadir + k.terlambat}</span>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700">Terlambat {k.terlambat}</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Sakit {k.sakit}</span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">Izin {k.izin}</span>
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">Alpha {k.alpha}</span>
                  </div>
                )}
              </div>

              {absen.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Siswa Sakit / Izin / Alpa / Terlambat</h4>
                  <div className="space-y-1.5">
                    {absen.map((a, i) => (
                      <div key={`${a.nama}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-2">
                        <p className="truncate text-sm font-bold text-slate-700">{a.nama}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          {a.keterangan && <span className="max-w-[160px] truncate text-xs font-semibold text-slate-400" title={a.keterangan}>{a.keterangan}</span>}
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase ${
                            a.status === 'sakit' ? 'bg-amber-100 text-amber-700' : a.status === 'izin' ? 'bg-blue-100 text-blue-700' : a.status === 'terlambat' ? 'bg-orange-100 text-orange-700' : 'bg-rose-100 text-rose-700'
                          }`}>{a.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="shrink-0 border-t border-slate-100 bg-[#F1F5F9] px-6 py-4">
              <button type="button" onClick={onClose} className="w-full rounded-full bg-slate-200 py-3 text-base font-black text-slate-600 transition hover:bg-slate-300">Tutup</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default EPresensiTab;
