import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { adminAkademikAPI, pusatJurusanAPI } from '../../utils/api';
import SearchableDropdown from '../SearchableDropdown';
import useEscapeKey from '../../utils/useEscapeKey';
import { Loader2, X, AlertTriangle, ShieldAlert } from 'lucide-react';

const ORANGE = '#C2410C';
const timeCls = "w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 outline-none transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-100";
const textCls = "w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100";
const lbl = "ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400";
const toHHMM = (v) => (v ? String(v).slice(0, 5) : '');

// Generator kode belajar client-side (identik dgn Admin Akademik).
const genKode = (parts) => {
  if (parts.some((p) => !p)) return '';
  const source = parts.join('|');
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i += 1) code += alpha[(hash >>> (i * 5)) & 31];
  const rand = window.crypto?.getRandomValues ? window.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 0xffffffff);
  for (let i = 0; i < 4; i += 1) code += alpha[(rand >>> (i * 5)) & 31];
  return code;
};

const emptyRow = () => ({ mapelNama: '', mapelId: '', guruId: '', hari: '', jamMulai: '', jamSelesai: '', ruangan: '', kodeBelajar: '' });

/**
 * KelolaKbmModal — editor "Jadwal Mengajar" untuk Pusat Jurusan (Tambah/Edit
 * Mapel Produktif). Sistem simpan SATUAN: satu kelas + satu guru + satu mapel
 * per penyimpanan (tidak ada lagi "Tambahkan Guru & Jadwal Lagi").
 * - Urutan field: (1) Kelas → (2) Guru global → (3) Nama Mapel (autocomplete
 *   mapel C jurusan; kategori terkunci C) → (4) Hari → (5) Jam Mulai/Selesai
 *   (validasi + deteksi bentrok real-time) → (6) Ruang + Preview/Info kode_belajar.
 */
const KelolaKbmModal = ({
  isOpen, onClose, onSuccess,
  userRole = 'pusat_jurusan',
  userJurusanId = null,
  defaultClassId = '',
  editData = null,
  kelasList = [],
  mapelList = [],
  guruList = [],
  existingRows = [],
  existingRowsKelasId = null,
}) => {
  const isAdmin = userRole === 'admin_akademik';
  const isPusjur = userRole === 'pusat_jurusan';

  const [kelasId, setKelasId] = useState('');
  const [kategori, setKategori] = useState(isAdmin ? '' : 'c');
  const [row, setRowState] = useState(emptyRow());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [guruGlobal, setGuruGlobal] = useState([]);

  // Pintasan keyboard: tekan Esc = tutup/batalkan (hanya saat modal terbuka).
  useEscapeKey(isOpen, () => { if (onClose) onClose(); });

  const setRow = (patch) => setRowState((r) => ({ ...r, ...patch }));

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Init saat dibuka / mode edit (prefill seluruh isian).
  useEffect(() => {
    if (!isOpen) return;
    setErr('');
    if (editData) {
      setKelasId(String(editData.kelas_id ?? defaultClassId ?? ''));
      setKategori(isAdmin ? (['a', 'b'].includes(String(editData.kategori_jadwal)) ? String(editData.kategori_jadwal) : 'a') : 'c');
      setRowState({
        ...emptyRow(),
        mapelNama: editData.mapel_nama || '',
        mapelId: String(editData.mapel_id ?? ''),
        guruId: String(editData.guru_id ?? ''),
        hari: String(editData.hari || '').toLowerCase(),
        jamMulai: toHHMM(editData.jam_mulai),
        jamSelesai: toHHMM(editData.jam_selesai),
        ruangan: editData.ruang_nama || '',
        kodeBelajar: editData.kode_belajar || '',
      });
    } else {
      setKelasId(defaultClassId ? String(defaultClassId) : '');
      setKategori(isAdmin ? '' : 'c');
      setRowState(emptyRow());
    }
  }, [isOpen, editData, defaultClassId, isAdmin]);

  // Pusjur: muat daftar guru global (semua guru aktif + NIP) tiap modal dibuka.
  // Catatan: `guruList` (prop default []) sengaja TIDAK dimasukkan ke deps —
  // identitas array baru tiap render memicu loop refetch tak berujung. Deps di
  // bawah stabil, jadi efek hanya jalan sekali per buka (tanpa loop), dan setiap
  // buka selalu menarik data segar (cache-buster di api.js) sehingga NIP terbaru
  // ikut terisi — bukan `guruGlobal` basi dari fetch sebelumnya.
  useEffect(() => {
    if (!isOpen || !isPusjur) return undefined;
    if (Array.isArray(guruList) && guruList.length > 0) { setGuruGlobal(guruList); return undefined; }
    let alive = true;
    pusatJurusanAPI.getGuruJurusan(userJurusanId)
      .then((r) => { if (alive) setGuruGlobal(r.data?.data || []); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPusjur, userJurusanId]);

  const kelasOptions = (kelasList || []).map((k) => ({ value: k.id ?? k.dbId, label: k.nama || k.name || '' })).filter((o) => o.value != null && o.label);

  // Autocomplete mapel C yang sudah ada di jurusan (tanpa data dummy).
  const mapelSuggestions = (mapelList || []).map((m) => String(m.name || '').trim()).filter(Boolean);
  const matchMapel = (name) => {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return (mapelList || []).find((m) => String(m.name || '').trim().toLowerCase() === n) || null;
  };

  // Pola sama dengan KBM Terpadu (Admin Akademik): label "Nama (NIP)" agar tak salah orang.
  const resolveNip = (u) => u?.nisn_nip || u?.nip || u?.employee_id || null;
  const guruOptions = (isPusjur ? guruGlobal : guruList).map((g) => {
    const nama = g.nama || g.name || g.full_name || '';
    const nip = resolveNip(g);
    return { value: g.id, label: nama ? `${nama} (${nip || '-'})` : '' };
  }).filter((o) => o.value != null && o.label);
  const mapelOptions = (mapelList || []).map((m) => ({ value: m.id ?? m.dbId, label: m.name || m.nama || '' })).filter((o) => o.value != null && o.label);

  // ── Validasi client-side: jam & deteksi bentrok real-time ──
  const jamInvalid = (r) => Boolean(r.jamMulai && r.jamSelesai && r.jamSelesai <= r.jamMulai);
  const rowConflict = (r) => {
    if (!kelasId || !r.hari || !r.jamMulai || !r.jamSelesai || jamInvalid(r)) return null;
    // existingRows bisa lintas kelas — cocokkan bentrok hanya pada kelas yang dipilih di form.
    return (existingRows || []).find((x) => (
      String(x.kelas_id ?? x.kelasId) === String(kelasId)
      && String(x.hari).toLowerCase() === String(r.hari).toLowerCase()
      && String(x.id) !== String(editData?.id ?? '')
      && String(x.jam_mulai).slice(0, 5) < r.jamSelesai
      && String(x.jam_selesai).slice(0, 5) > r.jamMulai
    )) || null;
  };

  const rowValid = (r) => {
    if (isPusjur) return Boolean(r.mapelNama.trim() && r.guruId && r.hari && r.jamMulai && r.jamSelesai && r.kodeBelajar && !jamInvalid(r));
    return Boolean(r.mapelId && r.guruId && r.hari && r.jamMulai && r.jamSelesai && r.kodeBelajar && !jamInvalid(r));
  };
  const canSubmit = kelasId && rowValid(row) && (isAdmin ? !!kategori : true) && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true); setErr('');
    try {
      const r = row;
      const payload = {
        kelas_id: Number(kelasId), guru_id: Number(r.guruId),
        hari: r.hari, jam_mulai: r.jamMulai, jam_selesai: r.jamSelesai,
        kategori_jadwal: isAdmin ? (kategori || null) : 'c',
      };
      if (isPusjur) {
        const matched = matchMapel(r.mapelNama);
        if (matched) payload.mapel_id = Number(matched.id);
        else payload.mapel_nama = r.mapelNama.trim();
      } else {
        payload.mapel_id = Number(r.mapelId);
      }
      if (r.ruangan) payload.ruang_nama = r.ruangan;
      if (r.kodeBelajar) payload.kode_belajar = r.kodeBelajar;
      if (editData?.id) await adminAkademikAPI.updateJadwalGuru(editData.id, payload);
      else await adminAkademikAPI.createJadwalGuru(payload);
      onSuccess && onSuccess();
      onClose && onClose();
    } catch (e2) {
      // Pesan bentrok guru/kelas dari backend tampil jelas di dalam modal.
      setErr(e2?.response?.data?.message || 'Gagal menyimpan jadwal.');
    } finally { setSaving(false); }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header gradien senada */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-4">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-indigo-500/30 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <h3 className="text-xl font-black tracking-tight text-white">{editData ? 'Edit Jadwal Produktif Jurusan' : 'Tambah Jadwal Produktif Jurusan'}</h3>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[10px] font-black tracking-widest text-white/70">Esc</span>
              <button type="button" onClick={onClose} title="Tutup" aria-label="Tutup (Esc)" className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/10 p-1.5 text-white/80 transition-colors hover:border-rose-400/40 hover:bg-rose-500 hover:text-white"><X size={16} /></button>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="max-h-[72vh] space-y-5 overflow-y-auto p-6">
          {err && <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-inset ring-red-600/10"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {err}</div>}

          <section className="space-y-4">
            {/* BARIS 1: Pilih Kelas | Kategori (Admin) | Pilih Nama Guru */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className={lbl}>Pilih Kelas {isPusjur && <span className="font-normal normal-case text-slate-300">(milik jurusan)</span>}</label>
                <SearchableDropdown value={kelasId} onChange={setKelasId} options={kelasOptions} placeholder="— Silahkan pilih kelas —" searchPlaceholder="Cari kelas..." themeColor={ORANGE} disabled={Boolean(editData) || kelasOptions.length === 0} />
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <label className={lbl}>Kategori</label>
                  <SearchableDropdown value={kategori} onChange={setKategori}
                    options={[
                      { value: 'a', label: 'A - Umum' },
                      { value: 'b', label: 'B - Muatan Lokal' },
                      { value: 'c', label: 'C - Produktif Jurusan', disabled: true, disabledReason: 'Mapel produktif hanya boleh dijadwalkan Pusat Jurusan' },
                    ]}
                    placeholder="Pilih kategori" themeColor={ORANGE}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className={lbl}>Pilih Nama Guru <span className="font-normal normal-case text-slate-300">(seluruh guru aktif)</span></label>
                <SearchableDropdown value={row.guruId} onChange={(id) => setRow({ guruId: id, kodeBelajar: '' })} options={guruOptions} placeholder="— Silahkan pilih guru —" searchPlaceholder="Cari nama atau NIP..." themeColor={ORANGE} />
              </div>
            </div>

            {/* BARIS 2: Nama Mapel (manual + notif Kelompok C) | Pilih Hari */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className={lbl}>{isPusjur ? 'Masukkan Nama Mata Pelajaran' : 'Pilih Mata Pelajaran'}</label>
                {isPusjur ? (
                  <input
                    list="kbm-mapel-c-suggestions" value={row.mapelNama}
                    onChange={(e) => setRow({ mapelNama: e.target.value, kodeBelajar: '' })}
                    placeholder="mis. Jaringan Dasar" className={`${textCls} no-datalist-caret`}
                  />
                ) : (
                  <SearchableDropdown value={row.mapelId} onChange={(id) => setRow({ mapelId: id, guruId: '', kodeBelajar: '' })} options={mapelOptions} placeholder="Pilih mata pelajaran" searchPlaceholder="Cari mapel..." themeColor={ORANGE} disabled={Boolean(editData) || mapelOptions.length === 0} />
                )}
                {isPusjur && (
                  <datalist id="kbm-mapel-c-suggestions">
                    {mapelSuggestions.map((n) => <option key={n} value={n} />)}
                  </datalist>
                )}
                {isPusjur && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span className="text-[11px] font-bold text-emerald-800">Kelompok C · Produktif Jurusan (terkunci otomatis)</span>
                    {matchMapel(row.mapelNama) ? (
                      <span className="ml-auto inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">Terdaftar</span>
                    ) : row.mapelNama.trim() ? (
                      <span className="ml-auto inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">Baru</span>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className={lbl}>Pilih Hari</label>
                <SearchableDropdown value={row.hari} onChange={(d) => setRow({ hari: d, kodeBelajar: '' })} options={['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'].map((d) => ({ value: d, label: d.toUpperCase() }))} placeholder="Pilih hari" themeColor={ORANGE} />
              </div>
            </div>

            {/* BARIS 3: Jadwal Mulai | Jadwal Selesai */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className={lbl}>Jadwal Mulai</label>
                <input type="time" value={row.jamMulai} onChange={(e) => setRow({ jamMulai: e.target.value, kodeBelajar: '' })} className={timeCls} />
              </div>
              <div className="space-y-2">
                <label className={lbl}>Jadwal Selesai</label>
                <input type="time" value={row.jamSelesai} onChange={(e) => setRow({ jamSelesai: e.target.value, kodeBelajar: '' })} className={timeCls} />
              </div>
            </div>
            {jamInvalid(row) && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                <AlertTriangle size={14} /> Jam berakhir harus lebih besar dari jam mulai.
              </div>
            )}
            {!jamInvalid(row) && rowConflict(row) && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/20">
                <AlertTriangle size={14} /> Bentrok dengan jadwal <b>&nbsp;{rowConflict(row).mapel_nama}&nbsp;</b> ({String(rowConflict(row).jam_mulai).slice(0, 5)}–{String(rowConflict(row).jam_selesai).slice(0, 5)}) di kelas ini.
              </div>
            )}

            {/* BARIS 4: Ruang Belajar | Kode Belajar */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <input value={row.ruangan} onChange={(e) => setRow({ ruangan: e.target.value })} placeholder="Ruang belajar (opsional)" className={textCls} />
              </div>
              <div className="space-y-2">
                <div className="flex overflow-hidden rounded-2xl border border-blue-200 bg-blue-50">
                  <input readOnly value={row.kodeBelajar} placeholder="Kode 8 karakter" className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm font-black tracking-[0.18em] text-slate-700 outline-none" />
                  <button type="button" onClick={() => setRow({ kodeBelajar: genKode([kelasId, row.mapelNama || row.mapelId, row.guruId, row.hari, kategori, row.jamMulai, row.jamSelesai]) })} disabled={!row.hari || !row.jamMulai || !row.jamSelesai} className="border-l border-blue-200 bg-white px-5 text-xs font-black uppercase tracking-wider text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40">Generate</button>
                </div>
              </div>
            </div>
          </section>

          <button type="submit" disabled={!canSubmit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/40 transition-all hover:-translate-y-0.5 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : 'Simpan Jadwal'}
          </button>
        </form>
      </motion.div>
    </div>,
    document.body
  );
};

export default KelolaKbmModal;
