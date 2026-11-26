import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Check, ClipboardCheck, Loader2, Search, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import useEscapeKey from '../../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';
import { teacherAPI } from '../../../../utils/api';
import { StudentAvatar } from './WaliStudentModal';

const STATUSES = [
  { value: 'hadir', short: 'H', label: 'Hadir', color: 'emerald' },
  { value: 'sakit', short: 'S', label: 'Sakit', color: 'amber' },
  { value: 'izin', short: 'I', label: 'Izin', color: 'blue' },
  { value: 'alpha', short: 'A', label: 'Alpha', color: 'rose' },
];
const PILL_ON = {
  emerald: 'border-emerald-600 bg-emerald-600 text-white',
  amber: 'border-amber-500 bg-amber-500 text-white',
  blue: 'border-blue-600 bg-blue-600 text-white',
  rose: 'border-rose-600 bg-rose-600 text-white',
};
const BADGE_TONE = {
  hadir: 'bg-emerald-100 text-emerald-700',
  terlambat: 'bg-orange-100 text-orange-700',
  sakit: 'bg-amber-100 text-amber-700',
  izin: 'bg-blue-100 text-blue-700',
  alpha: 'bg-rose-100 text-rose-700',
};

/**
 * Modal Presensi & Jurnal satu sesi KBM.
 * - readOnly=false (sesi sedang berlangsung): input status H/S/I/A + jurnal;
 *   footer HANYA satu tombol "Simpan Presensi & Jurnal" (presensi dulu, baru jurnal).
 * - readOnly=true (sesi tersimpan, sudah lewat jam): detail read-only, TANPA notifikasi
 *   error — penolakan luar-jam ditangani di halaman (toast kanan-bawah), bukan di sini.
 */
export default function SesiKbmModal({ open, session, readOnly = false, onClose, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [journal, setJournal] = useState({ materi_pokok: '', catatan: '' });
  const [journalSaved, setJournalSaved] = useState(false);

  useEscapeKey(open && !saving, onClose);
  useBodyScrollLock(open);

  // onClose/onChanged dari parent = arrow function inline yang IDENTITAs-nya ganti
  // tiap render (halaman ini punya clock tick per detik). Kalau ikut di deps
  // useCallback, load() di-restart tiap detik => spinner loading nggak pernah selesai.
  // Disimpan di ref supaya effect cuma jalan saat open/session benar-benar berubah.
  const onCloseRef = useRef(onClose);
  const onChangedRef = useRef(onChanged);
  useEffect(() => { onCloseRef.current = onClose; onChangedRef.current = onChanged; });

  const jamKe = session?.jam_mulai ? String(session.jam_mulai).slice(0, 5) : '';

  const load = useCallback(async () => {
    if (!open || !session) return;
    setLoading(true);
    setSearch('');

    // Jurnal tersimpan (dipakai dua mode).
    let foundJurnal = null;
    try {
      const jr = await teacherAPI.getJournals({ tanggal: session.tanggal, kelas_id: session.kelas_id, mapel_id: session.mapel_id, per_page: 50 });
      foundJurnal = (jr.data?.data?.data || []).find((j) => String(j.jam_ke).slice(0, 5) === jamKe) || null;
    } catch { foundJurnal = null; }
    setJournal({ materi_pokok: foundJurnal?.materi_pokok || '', catatan: foundJurnal?.catatan || '' });

    if (readOnly) {
      // Read-only: langsung dari rekap presensi — tanpa percobaan input, tanpa toast error.
      setJournalSaved(Boolean(foundJurnal));
      try {
        const recap = await teacherAPI.getAttendanceRecap({
          start_date: session.tanggal, end_date: session.tanggal,
          kelas_id: session.kelas_id, mapel_id: session.mapel_id,
        });
        setStudents((recap.data?.data || [])
          .filter((r) => !jamKe || String(r.jam_ke).slice(0, 5) === jamKe)
          .map((r) => ({
            id: r.id, name: r.nama_siswa || '-', nis: r.nis, avatar_path: null,
            status: r.status || '', keterangan: r.keterangan || '',
          })));
      } catch {
        setStudents([]);
      }
      setLoading(false);
      return;
    }

    // Mode input (sesi sedang berlangsung).
    try {
      const res = await teacherAPI.getAttendanceStudents({
        tanggal: session.tanggal,
        kelas_id: session.kelas_id,
        mapel_id: session.mapel_id,
        jam_ke: jamKe,
        jadwal_guru_id: session.jadwal_id,
      });
      const rows = (res.data?.data || []).map((s) => ({
        id: s.id, name: s.name, nis: s.nis, avatar_path: s.avatar_path,
        status: s.status || '', keterangan: s.keterangan || '',
      }));
      setStudents(rows);
      setJournalSaved(Boolean(res.data?.is_already_submitted) && rows.length > 0 && rows.every((s) => s.status));
    } catch (error) {
      // Pinggir window: sesi keburu lewat saat modal dibuka — tutup, biarkan notifikasi
      // tunggal di halaman (kanan-bawah) yang bekerja, tanpa dobel popup.
      toast.error(error?.response?.data?.message || 'Absensi gagal, diluar jadwal mengajar.');
      onCloseRef.current?.();
    }
    setLoading(false);
  }, [open, session, jamKe, readOnly]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => students.reduce((acc, s) => {
    if (s.status) acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {}), [students]);
  const markedCount = students.filter((s) => !!s.status).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name?.toLowerCase().includes(q) || String(s.nis || '').toLowerCase().includes(q));
  }, [students, search]);

  const setStatus = (id, status) => {
    setStudents((cur) => cur.map((s) => (s.id === id ? { ...s, status } : s)));
  };
  const setKeterangan = (id, keterangan) => {
    setStudents((cur) => cur.map((s) => (s.id === id ? { ...s, keterangan } : s)));
  };
  const markAllPresent = () => {
    setStudents((cur) => cur.map((s) => ({ ...s, status: 'hadir' })));
  };

  const handleSave = async () => {
    if (saving || readOnly) return;
    if (students.length === 0) { toast.error('Belum ada siswa terdaftar pada kelas ini.'); return; }
    if (students.some((s) => !s.status)) { toast.error('Pilih status kehadiran untuk setiap siswa sebelum menyimpan.'); return; }
    if (!journal.materi_pokok.trim()) { toast.error('Materi / pokok bahasan wajib diisi.'); return; }
    setSaving(true);
    try {
      await teacherAPI.saveAttendance({
        tanggal: session.tanggal,
        kelas_id: Number(session.kelas_id),
        mapel_id: Number(session.mapel_id),
        jadwal_guru_id: session.jadwal_id,
        jam_ke: jamKe,
        presensi: students.map((s) => ({ siswa_id: s.id, status: s.status, keterangan: s.keterangan?.trim() || null })),
      });
      const jr = await teacherAPI.saveKbmSession({
        tanggal: session.tanggal,
        jadwal_guru_id: session.jadwal_id,
        materi_pokok: journal.materi_pokok.trim(),
        catatan: journal.catatan.trim() || null,
      });
      toast.success(jr.data?.message || 'Presensi & jurnal tersimpan — sesi KBM selesai.');
      if (typeof onChangedRef.current === 'function') onChangedRef.current();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Gagal menyimpan presensi & jurnal.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && session && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-2xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black text-slate-800">
                  {session.kelas_nama} · {session.mapel_nama}
                </h3>
                <p className="mt-0.5 text-sm font-bold text-slate-400">
                  {session.hari_label}, {session.tanggal} · {jamKe}–{String(session.jam_selesai).slice(0, 5)} WIB
                  {readOnly && <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-500">Read-only</span>}
                </p>
              </div>
              <ModalCloseControl onClose={() => !saving && onClose()} />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-5 space-y-5">
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
                  <Loader2 size={28} className="animate-spin" />
                  <p className="text-sm font-bold uppercase tracking-wider">Memuat data sesi...</p>
                </div>
              ) : (
                <>
                  {readOnly && (
                    <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-bold text-slate-600">
                      <AlertCircle size={17} className="mt-0.5 shrink-0 text-slate-400" />
                      <p>Sesi sudah lewat — data di bawah adalah rekaman tersimpan dan hanya dapat dilihat.</p>
                    </div>
                  )}

                  {/* ── Bagian 1: Presensi ── */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Users size={19} /></span>
                        <div>
                          <h4 className="text-base font-black text-slate-800">Presensi Siswa</h4>
                          <p className="text-sm font-bold text-slate-400">{markedCount}/{students.length} ditandai · H {totals.hadir || 0} · S {totals.sakit || 0} · I {totals.izin || 0} · A {totals.alpha || 0}</p>
                        </div>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={markAllPresent}
                          disabled={students.length === 0}
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-100 active:scale-95 disabled:opacity-50"
                        >
                          Tandai Semua Hadir
                        </button>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="relative border-b border-slate-100 px-4 py-3">
                        <Search size={16} className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Cari nama atau NISN siswa..."
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-50 transition"
                        />
                      </div>
                    )}
                    {students.length === 0 && !loading ? (
                      <p className="px-4 py-10 text-center text-sm font-bold italic text-slate-400">Belum ada siswa terdaftar pada kelas ini.</p>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {filtered.map((s) => (
                          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50/60 transition-colors">
                            <div className="flex min-w-[180px] items-center gap-3">
                              <StudentAvatar avatarPath={s.avatar_path} name={s.name} size="md" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-800">{s.name}</p>
                                <p className="text-xs font-mono text-slate-400">NISN {s.nis || '-'}</p>
                              </div>
                            </div>
                            {!readOnly ? (
                              <div className="flex items-center gap-2">
                                {STATUSES.map((st) => {
                                  const selected = s.status === st.value;
                                  return (
                                    <button
                                      key={st.value}
                                      type="button"
                                      aria-label={`${st.label}: ${s.name}`}
                                      aria-pressed={selected}
                                      onClick={() => setStatus(s.id, st.value)}
                                      className={`grid h-9 min-w-[38px] place-items-center rounded-full border px-2.5 text-sm font-black transition ${selected ? PILL_ON[st.color] : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                                    >
                                      {st.short}
                                    </button>
                                  );
                                })}
                                <input
                                  value={s.keterangan}
                                  onChange={(e) => setKeterangan(s.id, e.target.value)}
                                  placeholder="Catatan"
                                  className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 placeholder:text-slate-300 focus:border-emerald-400 focus:outline-none transition"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {s.status ? (
                                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${BADGE_TONE[s.status] || 'bg-slate-100 text-slate-600'}`}>{s.status}</span>
                                ) : (
                                  <span className="text-xs font-bold text-slate-300">belum ditandai</span>
                                )}
                                {s.keterangan && <span className="max-w-[180px] truncate text-xs font-semibold text-slate-400" title={s.keterangan}>{s.keterangan}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Bagian 2: Jurnal Pembelajaran ── */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                    <h4 className="text-base font-black text-slate-800">Jurnal Pembelajaran</h4>
                    {!readOnly ? (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Materi / Pokok Bahasan</label>
                          <textarea
                            required
                            rows={2}
                            maxLength={200}
                            value={journal.materi_pokok}
                            onChange={(e) => setJournal((p) => ({ ...p, materi_pokok: e.target.value }))}
                            placeholder="Konfigurasi routing statis Cisco Packet Tracer"
                            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base font-semibold text-slate-800 placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 transition"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Kegiatan / Catatan Pembelajaran</label>
                          <textarea
                            rows={3}
                            value={journal.catatan}
                            onChange={(e) => setJournal((p) => ({ ...p, catatan: e.target.value }))}
                            placeholder="Siswa praktik berpasangan, 2 kelompok perlu pendampingan ekstra."
                            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base font-semibold text-slate-800 placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 transition"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-base font-bold text-slate-800">{journal.materi_pokok || <span className="italic font-semibold text-slate-300">Belum ada materi tercatat pada sesi ini.</span>}</p>
                        <p className="text-base font-medium text-slate-500">{journal.catatan || ''}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer terpisah: SATU tombol primer full-width (tanpa Batal) */}
            <div className="shrink-0 border-t border-slate-100 bg-[#F1F5F9] px-6 py-4">
              {!readOnly ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || students.length === 0 || !journal.materi_pokok.trim()}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-base font-black transition-all ${
                    saving || students.length === 0 || !journal.materi_pokok.trim()
                      ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800 active:scale-[0.99] shadow-md shadow-emerald-600/20'
                  }`}
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : journalSaved ? <Check size={18} /> : <ClipboardCheck size={18} />}
                  {saving ? 'Menyimpan...' : 'Simpan Presensi & Jurnal'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-full bg-slate-200 py-3.5 text-base font-black text-slate-600 transition hover:bg-slate-300"
                >
                  Tutup
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
