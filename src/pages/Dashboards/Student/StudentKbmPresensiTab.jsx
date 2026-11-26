import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { studentAPI, BASE_URL } from '../../../utils/api';
import {
  CalendarDays, BookOpen, Clock, MapPin, User, Download, PlayCircle,
  CheckCircle2, XCircle, AlertTriangle, FileText, X,
  CalendarCheck, Inbox, Eye, GraduationCap, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── KONSTANTA & HELPER ─────────────────────────────────────────
const DAY_LABELS = { senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu' };
const DAY_ORDER = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

// Warna status kehadiran (konsisten tema dashboard): Hadir=emerald, Terlambat=orange, Izin=sky, Sakit=amber, Alpha=rose.
const STATUS_CONFIG = {
  hadir:      { label: 'Hadir',      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200',  icon: CheckCircle2 },
  terlambat:  { label: 'Terlambat',  cls: 'text-orange-700 bg-orange-50 border-orange-200',     icon: Clock },
  izin:       { label: 'Izin',       cls: 'text-sky-700 bg-sky-50 border-sky-200',               icon: FileText },
  sakit:      { label: 'Sakit',      cls: 'text-amber-700 bg-amber-50 border-amber-200',         icon: AlertTriangle },
  alpha:      { label: 'Alpha',      cls: 'text-rose-700 bg-rose-50 border-rose-200',            icon: XCircle },
};

const DAY_KEY_FROM_JS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']; // index = Date.getDay()

// "HH:MM" -> menit sejak 00:00.
const toMin = (t) => { const [h, m] = String(t || '0:0').split(':'); return (Number(h) || 0) * 60 + (Number(m) || 0); };

const PRIMARY_BTN = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-md shadow-indigo-500/25 transition-all duration-300 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';
const GHOST_BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 transition-all duration-300 hover:border-blue-300 hover:text-blue-600';

function Loading({ text = 'Memuat...' }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400"><Clock className="h-4 w-4 animate-spin" /> {text}</div>;
}
function Empty({ icon: Icon = Inbox, title, desc }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
      <div className="mb-3 rounded-2xl bg-slate-50 p-4 text-slate-300"><Icon className="h-7 w-7" /></div>
      <p className="text-sm font-black text-slate-600">{title}</p>
      {desc && <p className="mt-1 text-xs font-bold text-slate-400">{desc}</p>}
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────
const StudentKbmPresensiTab = () => {
  const [activeTab, setActiveTab] = useState('jadwal');
  const [now, setNow] = useState(() => new Date());

  // Data
  const [scheduleData, setScheduleData] = useState(null);
  const [materials, setMaterials] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [attError, setAttError] = useState('');

  // Filter mapel (dipakai di tab Materi; ikut menyaring Jadwal & Presensi).
  const [mapelFilter, setMapelFilter] = useState('all');
  const [materiSearch, setMateriSearch] = useState('');
  const [attMonth, setAttMonth] = useState(() => new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(() => new Date().getFullYear());

  // Kartu "hari ini" pada tab Jadwal — untuk highlight & auto-scroll fokus.
  const todayRef = useRef(null);
  const scrolledToToday = useRef(false);

  // Modal
  const [previewMateri, setPreviewMateri] = useState(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);

  const todayKey = DAY_KEY_FROM_JS[now.getDay()];

  // Jam real-time.
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  // Kunci scroll body saat modal terbuka.
  useEffect(() => {
    if (!previewMateri && !joinOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [previewMateri, joinOpen]);

  // Muat jadwal + materi sekali.
  useEffect(() => {
    studentAPI.getSchedule().then(r => setScheduleData(r.data.data)).catch(() => setScheduleData({ term: null, schedules: [] }));
    studentAPI.getMaterials().then(r => setMaterials(r.data.data || [])).catch(() => setMaterials([]));
  }, []);

  // Muat presensi saat periode berubah (juga saat mount).
  useEffect(() => {
    setAttendance(null); setAttError('');
    studentAPI.getAttendance({ bulan: attMonth, tahun: attYear })
      .then(r => setAttendance(r.data.data))
      .catch(() => setAttError('Data presensi gagal dimuat.'));
  }, [attMonth, attYear]);

  // Daftar mapel unik untuk dropdown filter (dari jadwal + materi).
  const mapelOptions = useMemo(() => {
    const set = new Set();
    (scheduleData?.schedules || []).forEach(s => s.subject && set.add(s.subject));
    (materials || []).forEach(m => m.mapel && set.add(m.mapel));
    return Array.from(set).sort();
  }, [scheduleData, materials]);

  // Murid dianggap "punya kelas" bila ada minimal 1 enrollment (class_students).
  const hasClass = (scheduleData?.classes?.length || 0) > 0;

  // Auto-scroll fokus ke kartu "hari ini" SEKALI saat tab Jadwal siap (hari ini punya sesi).
  useEffect(() => {
    if (activeTab !== 'jadwal' || !scheduleData || !hasClass) return;
    if (scrolledToToday.current || !todayRef.current) return;
    todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    scrolledToToday.current = true;
  }, [activeTab, scheduleData, hasClass]);

  const openJoin = () => { setJoinToken(''); setJoinOpen(true); };

  const reloadAll = () => {
    studentAPI.getSchedule().then((r) => setScheduleData(r.data.data)).catch(() => {});
    studentAPI.getMaterials().then((r) => setMaterials(r.data.data || [])).catch(() => {});
    setAttendance(null);
    studentAPI.getAttendance({ bulan: attMonth, tahun: attYear }).then((r) => setAttendance(r.data.data)).catch(() => {});
  };

  const submitJoin = async () => {
    // Bersihkan token: buang SEMUA spasi lalu uppercase (mis. " zcn 9eafq " -> "ZCN9EAFQ").
    const cleanToken = joinToken.replace(/\s+/g, '').toUpperCase();
    if (!cleanToken) return;
    setJoinBusy(true);
    const opts = { duration: 6000 };
    try {
      const res = await studentAPI.joinClass(cleanToken);
      const already = res.data?.already === true;
      const msg = res.data?.message || (already ? 'Anda sudah berada di kelas ini.' : 'Berhasil bergabung kelas!');
      
      if (already) {
        toast.error(msg, opts);
      } else {
        toast.success(msg, opts);
      }
      setJoinOpen(false);
      setJoinToken('');
      reloadAll();
    } catch (e) {
      const status = e.response?.status;
      const serverMsg = e.response?.data?.message;
      const msg = serverMsg
        || (status === 401 ? 'Sesi Anda berakhir. Silakan login ulang.' : null)
        || (status ? `Permintaan gagal (kode ${status}). Pastikan server backend aktif.` : (e.message || 'Koneksi ke server gagal. Backend tidak dapat dijangkau.'));
      
      toast.error(msg, opts);
      setJoinOpen(false);
    } finally {
      setJoinBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* HERO — bentuk mengikuti banner dashboard */}
      <div className="relative overflow-hidden rounded-[3rem] border border-blue-100 bg-white p-8 text-slate-900 shadow-xl xl:p-12">
        <div className="absolute right-0 top-0 h-full w-[45%] rounded-full bg-gradient-to-l from-[#0ea5e9] via-[#0284c7] to-[#0369a1] opacity-20 blur-[120px]"></div>
        <div className="absolute left-0 top-0 h-full w-[35%] rounded-full bg-gradient-to-r from-[#0ea5e9] via-[#0284c7] to-[#0369a1] opacity-10 blur-[100px]"></div>

        <div className="relative flex flex-col items-start justify-between gap-6 text-left md:flex-row md:items-center">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
              <GraduationCap className="h-3 w-3" /> Portal Students Authority
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">KBM &amp; Presensi</h1>
            <p className="mt-2 max-w-2xl text-base font-normal leading-relaxed text-slate-500">
              Pusat aktivitas belajar harian, rekap kehadiran, dan materi pelajaran Anda.
            </p>
          </div>

          {/* Badge jam real-time */}
          <div className="flex shrink-0 flex-col items-end gap-1 rounded-2xl border border-gray-100 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-widest text-slate-700">{now.toLocaleDateString('id-ID', { weekday: 'long' })},</span>
              <span className="text-xs font-bold text-slate-500">{now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-lg font-black tabular-nums tracking-widest text-slate-700">{now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">WIB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status kelas: badge "Kelas Aktif" + Wali bila sudah punya kelas; CTA token hanya bila belum. */}
      {scheduleData && (
        hasClass ? (
          <div className="flex flex-wrap items-center justify-end gap-2 px-1">
            {(scheduleData.classes || []).map((c, i) => (
              <React.Fragment key={c.id ?? `cls-${i}`}>
                <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-700">
                  <GraduationCap className="h-4 w-4" /> Kelas Aktif: {c.name}
                </span>
                {c.homeroom_teacher && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">
                    <User className="h-4 w-4 text-slate-400" /> Wali Kelas: {c.homeroom_teacher}
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3 px-1">
            <p className="animate-pulse text-sm font-black text-amber-600">Belum bergabung dengan kelas?</p>
            <button type="button" onClick={openJoin} className={PRIMARY_BTN}>Token Kelas</button>
          </div>
        )
      )}

      {/* TAB BAR */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {[{ id: 'jadwal', label: 'Jadwal Pelajaran', icon: CalendarDays }, { id: 'presensi', label: 'Presensi & Kehadiran', icon: CheckCircle2 }, { id: 'materi', label: 'Materi & Sumber', icon: BookOpen }].map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${activeTab === t.id ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'}`}>
              <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.id === 'jadwal' ? 'Jadwal' : t.id === 'presensi' ? 'Presensi' : 'Materi'}</span>
            </button>
          );
        })}
      </div>

      {/* KONTEN TAB */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {scheduleData && !hasClass
            ? renderJoinCard()
            : (<>
              {activeTab === 'jadwal' && renderJadwal()}
              {activeTab === 'presensi' && renderPresensi()}
              {activeTab === 'materi' && renderMateri()}
            </>)}
        </motion.div>
      </AnimatePresence>

      {renderPreviewModal()}
      {renderJoinModal()}
    </div>
  );

  // ─── SECTION RENDERERS ───
  function renderJoinCard() {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-sky-200 bg-white px-6 py-16 text-center shadow-sm">
        <div className="mb-4 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-4 text-white shadow-lg"><GraduationCap className="h-8 w-8" /></div>
        <h3 className="text-lg font-black text-slate-800">Anda belum bergabung di kelas</h3>
        <p className="mt-1 max-w-md text-sm text-slate-500">Masukkan token kelas yang diberikan admin akademik untuk mengakses jadwal pelajaran, materi, dan presensi.</p>
        <button type="button" onClick={openJoin} className={`${PRIMARY_BTN} mt-5`}>
          <GraduationCap className="h-4 w-4" /> Masukkan Token Kelas
        </button>
      </div>
    );
  }

  function renderJoinModal() {
    if (!joinOpen || typeof document === 'undefined') return null;
    return createPortal(
      <AnimatePresence>
        {joinOpen && (
          <motion.div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
            onClick={(e) => e.target === e.currentTarget && setJoinOpen(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><GraduationCap className="h-5 w-5" /></div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Gabung Kelas</h3>
                    <p className="text-[11px] font-bold text-slate-400">Masukkan token dari admin akademik</p>
                  </div>
                </div>
                <button type="button" onClick={() => setJoinOpen(false)} className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"><X className="h-5 w-5" /></button>
              </div>

              <div className="space-y-3 p-6">
                <p className="text-xs leading-relaxed text-slate-500">Token kelas diberikan oleh admin akademik. Setelah bergabung, jadwal, materi, dan presensi kelas akan langsung tersedia di halaman ini.</p>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Token Kelas</label>
                  <input
                    value={joinToken}
                    onChange={(e) => setJoinToken(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitJoin(); }}
                    maxLength={32}
                    placeholder="CONTOH: TKJ24A"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black uppercase tracking-widest text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                <button type="button" onClick={() => setJoinOpen(false)} className={`${GHOST_BTN} flex-1`}>Batal</button>
                <button type="button" onClick={submitJoin} disabled={joinBusy || !joinToken.trim()} className={`${PRIMARY_BTN} flex-1`}>
                  {joinBusy ? 'Memproses...' : 'Gabung Kelas'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
  }

  function renderJadwal() {
    if (!scheduleData) return <Loading text="Memuat jadwal..." />;
    const rows = (scheduleData.schedules || []).filter((s) => mapelFilter === 'all' || s.subject === mapelFilter);
    if (rows.length === 0) {
      return <Empty icon={CalendarDays} title="Belum ada jadwal" desc="Kelas Anda belum memiliki jadwal pada semester aktif." />;
    }

    // Status sesi otomatis: TERJADWAL (belum mulai) / SEDANG BERLANGSUNG / SELESAI.
    const liveStatus = (s) => {
      if (s.day !== todayKey) return { label: 'Terjadwal', cls: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: CalendarDays };
      const cur = now.getHours() * 60 + now.getMinutes();
      const st = toMin(s.start), en = toMin(s.end);
      if (cur < st) return { label: 'Terjadwal', cls: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: CalendarDays };
      if (cur >= st && cur <= en) return { label: 'Sedang Berlangsung', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: PlayCircle };
      return { label: 'Selesai', cls: 'text-slate-500 bg-slate-100 border-slate-200', icon: CheckCircle2 };
    };

    const grouped = {};
    rows.forEach((r) => { (grouped[r.day] = grouped[r.day] || []).push(r); });

    // Tampilan per hari Senin–Sabtu (konsisten); hari ini di-highlight + jadi fokus scroll.
    const WEEKDAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

    return (
      <div className="space-y-5">
        {scheduleData.term && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-white px-4 py-3 text-xs font-bold text-slate-500 shadow-sm">
            <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-blue-600" /> Semester aktif: <strong className="text-slate-700">{scheduleData.term.academic_year} · {scheduleData.term.semester}</strong></span>
            <span>{rows.length} sesi terjadwal</span>
          </div>
        )}
        {WEEKDAYS.map((day) => {
          const dayRows = (grouped[day] || []).slice().sort((a, b) => toMin(a.start) - toMin(b.start));
          const isToday = day === todayKey;
          return (
            <section
              key={day}
              ref={isToday ? todayRef : undefined}
              className={`rounded-2xl border bg-white p-4 shadow-sm transition-all ${isToday ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-100'}`}
            >
              <h4 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-700">
                <CalendarDays className="h-4 w-4 text-sky-600" /> {DAY_LABELS[day] || day}
                {isToday && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">HARI INI</span>}
              </h4>
              {dayRows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-100 bg-slate-50/50 px-4 py-3 text-center text-xs font-bold text-slate-400">Tidak ada sesi pada hari ini.</p>
              ) : (
                <div className="space-y-2">
                  {dayRows.map((s) => {
                    const st = liveStatus(s); const Icon = st.icon;
                    return (
                      <div key={s.id} className="group flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
                        <div className="flex w-28 shrink-0 items-center gap-1.5 text-sm font-black tabular-nums text-sky-700">
                          <Clock className="h-3.5 w-3.5 text-slate-400" /> {s.start?.slice(0, 5)}-{s.end?.slice(0, 5)}
                        </div>
                        <div className="min-w-[160px] flex-1">
                          <p className="text-sm font-black text-slate-800">{s.subject || '-'}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-slate-400">
                            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {s.teacher || '-'}</span>
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.room || 'Ruang belum ditentukan'}</span>
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${st.cls}`}>
                          <Icon className="h-3 w-3" /> {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }
  function renderPresensi() {
    if (attError) return <div className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-600">{attError}</div>;
    if (!attendance) return <Loading text="Memuat presensi..." />;

    const sem = attendance.semester || {};
    const semCards = [
      { label: 'Hadir', value: sem.hadir || 0, dot: 'bg-emerald-500', text: 'text-emerald-700' },
      { label: 'Sakit', value: sem.sakit || 0, dot: 'bg-amber-500', text: 'text-amber-700' },
      { label: 'Izin', value: sem.izin || 0, dot: 'bg-sky-500', text: 'text-sky-700' },
      { label: 'Alpa', value: sem.alpha || 0, dot: 'bg-rose-500', text: 'text-rose-700' },
    ];
    const records = (attendance.records || []).filter((r) => {
      if (mapelFilter !== 'all' && r.mapel !== mapelFilter) return false;
      return true;
    });
    const pct = Math.max(0, Math.min(100, Number(sem.percentage) || 0));

    return (
      <div className="space-y-5">
        {/* Rekap kehadiran SEMESTER AKTIF — data nyata siswa ini. */}
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
            <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Rekap Kehadiran
            </h4>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">Semester {sem.label || 'Aktif'}</span>
          </div>
          <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
            {/* Cincin persentase kehadiran */}
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" strokeWidth="3.5" />
                  {sem.total > 0 && (
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${pct} 100`} />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black tabular-nums text-slate-900">{sem.total > 0 ? `${sem.percentage}%` : '-'}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Hadir</span>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-500">
                <p className="text-sm font-black text-slate-700">{sem.total || 0} sesi tercatat</p>
                <p className="mt-0.5">pada semester aktif</p>
              </div>
            </div>
            {/* 4 angka rekap semester */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {semCards.map((c) => (
                <div key={c.label} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center">
                  <p className={`text-2xl font-black tabular-nums ${c.text}`}>{c.value}</p>
                  <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} /> {c.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filter periode daftar riwayat */}
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-xs font-bold text-slate-500 shadow-sm">
          <span className="mr-1 uppercase tracking-wider">Periode Riwayat</span>
          <select value={attMonth} onChange={(e) => setAttMonth(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold outline-none focus:border-blue-500">
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i).toLocaleDateString('id-ID', { month: 'long' })}</option>)}
          </select>
          <select value={attYear} onChange={(e) => setAttYear(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold outline-none focus:border-blue-500">
            {[attYear - 2, attYear - 1, attYear, attYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Riwayat Pertemuan & Materi KBM (presensi + jurnal guru) */}
        {records.length === 0 ? (
          <Empty icon={CalendarCheck} title="Belum ada riwayat pertemuan" desc="Belum ada catatan presensi & jurnal untuk periode / filter ini." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3 text-sm font-black uppercase tracking-wider text-slate-700">Riwayat Pertemuan &amp; Materi KBM · {records.length} sesi</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-black">Tanggal &amp; Jam</th>
                    <th className="px-5 py-3 font-black">Mata Pelajaran</th>
                    <th className="px-5 py-3 font-black">Materi Pembahasan</th>
                    <th className="px-5 py-3 font-black">Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map((r) => {
                    const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.alpha; const Icon = cfg.icon;
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-3 font-bold text-slate-600 tabular-nums">
                          {r.tanggal ? new Date(r.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          {r.jam_ke && <span className="ml-1 text-slate-400">· {r.jam_ke}</span>}
                        </td>
                        <td className="px-5 py-3 font-black text-slate-800">{r.mapel || '-'}</td>
                        <td className="px-5 py-3 text-slate-600">{r.materi || <span className="italic text-slate-300">Belum ada materi tercatat</span>}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${cfg.cls}`}>
                            <Icon className="h-3 w-3" /> {cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }
  function renderMateri() {
    if (!materials) return <Loading text="Memuat materi..." />;
    const q = materiSearch.trim().toLowerCase();
    const list = materials.filter((m) => {
      if (mapelFilter !== 'all' && m.mapel !== mapelFilter) return false;
      if (!q) return true;
      return [m.judul, m.deskripsi, m.mapel, m.guru, m.kategori, m.topik]
        .some((f) => f && String(f).toLowerCase().includes(q));
    });
    if (list.length === 0) {
      return <Empty icon={BookOpen} title="Belum ada materi" desc="Tidak ada materi dari guru yang cocok dengan kelas / mapel / pencarian ini." />;
    }

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-700">
            <BookOpen className="h-4 w-4 text-amber-600" /> Materi &amp; Sumber Belajar
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={materiSearch}
                onChange={(e) => setMateriSearch(e.target.value)}
                placeholder="Cari materi..."
                className="w-40 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs font-bold outline-none focus:border-blue-500 sm:w-48"
              />
            </div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Mapel</label>
            <select value={mapelFilter} onChange={(e) => setMapelFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold outline-none focus:border-blue-500">
              <option value="all">Semua Mata Pelajaran</option>
              {mapelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-700">{list.length} materi</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => {
            const fileUrl = m.file_name ? `${BASE_URL}/storage/uploads/materi/${m.file_name}` : null;
            return (
              <div key={m.id} className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="rounded-xl bg-amber-50 p-2 text-amber-600"><BookOpen className="h-5 w-5" /></div>
                  {m.kategori && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{m.kategori}</span>}
                </div>
                <h4 className="line-clamp-2 text-sm font-black text-slate-800">{m.judul}</h4>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-400">
                  <span>{m.mapel || '-'}</span>
                  <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {m.guru || '-'}</span>
                </p>
                {m.deskripsi && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{m.deskripsi}</p>}
                <p className="mt-2 text-[11px] font-bold text-slate-400">
                  {m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-50 pt-3">
                  <button type="button" onClick={() => setPreviewMateri(m)} className={GHOST_BTN}>
                    <Eye className="h-3.5 w-3.5" /> Lihat Detail
                  </button>
                  {fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" download className={PRIMARY_BTN}>
                      <Download className="h-3.5 w-3.5" /> Unduh
                    </a>
                  )}
                  {m.link_video && (
                    <a href={m.link_video} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-md shadow-rose-500/25 transition-all duration-300 hover:from-red-600 hover:to-rose-700 hover:shadow-lg active:scale-95">
                      <PlayCircle className="h-3.5 w-3.5" /> Video
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  function renderPreviewModal() {
    if (!previewMateri || typeof document === 'undefined') return null;
    const m = previewMateri;
    const fileUrl = m.file_name ? `${BASE_URL}/storage/uploads/materi/${m.file_name}` : null;
    return createPortal(
      <AnimatePresence>
        {previewMateri && (
          <motion.div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
            onClick={(e) => e.target === e.currentTarget && setPreviewMateri(null)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
                <div className="flex items-center gap-2">
                  {m.kategori && <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">{m.kategori}</span>}
                  <span className="text-xs font-semibold text-slate-400">{m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                </div>
                <button type="button" onClick={() => setPreviewMateri(null)} className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"><X className="h-5 w-5" /></button>
              </div>

              <div className="space-y-4 overflow-y-auto p-6">
                <h3 className="text-xl font-black leading-snug text-slate-900">{m.judul}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 pb-3 text-xs font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-slate-400" /> {m.mapel || '-'}</span>
                  <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" /> {m.guru || '-'}</span>
                  {m.kelas && <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-slate-400" /> {m.kelas}</span>}
                  {m.topik && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> Topik: {m.topik}</span>}
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{m.deskripsi || 'Materi ini tidak memiliki deskripsi.'}</p>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                {fileUrl && (
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" download className={PRIMARY_BTN}>
                    <Download className="h-4 w-4" /> Unduh Materi
                  </a>
                )}
                {m.link_video && (
                  <a href={m.link_video} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-md shadow-rose-500/25 transition-all duration-300 hover:from-red-600 hover:to-rose-700 hover:shadow-lg active:scale-95">
                    <PlayCircle className="h-4 w-4" /> Buka Video
                  </a>
                )}
                <button type="button" onClick={() => setPreviewMateri(null)} className={`${GHOST_BTN} ml-auto`}>Tutup</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
  }
};

export default StudentKbmPresensiTab;
