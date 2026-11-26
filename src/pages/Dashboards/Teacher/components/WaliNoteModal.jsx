import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import SearchableDropdown from '../../../../components/SearchableDropdown';
import useEscapeKey from '../../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';
import { teacherAPI } from '../../../../utils/api';

const TIPE_OPTIONS = [
  { id: 'prestasi', label: 'Prestasi / Lomba' },
  { id: 'bk', label: 'Konseling / Pembinaan' },
];

const BK_KATEGORI = [
  { value: 'konseling', label: 'Konseling' },
  { value: 'pembinaan', label: 'Pembinaan Perilaku' },
  { value: 'pelanggaran', label: 'Pelanggaran Tata Tertib' },
  { value: 'izin_khusus', label: 'Izin Khusus / Dispensasi' },
];

const TINGKAT_OPTIONS = [
  { value: 'Sekolah', label: 'Tingkat Sekolah' },
  { value: 'Kecamatan', label: 'Tingkat Kecamatan' },
  { value: 'Kota / Kabupaten', label: 'Tingkat Kota / Kabupaten' },
  { value: 'Provinsi', label: 'Tingkat Provinsi' },
  { value: 'Nasional', label: 'Tingkat Nasional' },
  { value: 'Internasional', label: 'Tingkat Internasional' },
];

/**
 * Modal "+ Tambah Catatan BK / Prestasi" (house-style):
 * dropdown siswa di paling atas -> pilih jenis -> form dinamis. Auto-tutup saat sukses.
 */
export default function WaliNoteModal({ open, onClose, students = [], defaultStudentId = null, onSaved }) {
  const [jenis, setJenis] = useState('prestasi');
  const [siswaId, setSiswaId] = useState('');
  const [saving, setSaving] = useState(false);

  // Form prestasi
  const [namaKegiatan, setNamaKegiatan] = useState('');
  const [tingkat, setTingkat] = useState('');
  const [poin, setPoin] = useState('');

  // Form BK
  const [kategori, setKategori] = useState('konseling');
  const [uraian, setUraian] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState('');
  const [tanggal, setTanggal] = useState('');

  useEscapeKey(open, () => !saving && onClose());
  useBodyScrollLock(open);

  const currentSiswa = siswaId || defaultStudentId || '';

  const studentOptions = useMemo(
    () => students.map((s) => ({ value: s.id, label: `${s.name} — ${s.nisn}` })),
    [students],
  );

  const ready = useMemo(() => {
    if (!currentSiswa) return false;
    if (jenis === 'prestasi') {
      return namaKegiatan.trim() !== '' && tingkat !== '' && poin !== '' && Number(poin) >= 0;
    }
    return uraian.trim() !== '';
  }, [currentSiswa, jenis, namaKegiatan, tingkat, poin, uraian]);

  const resetForm = () => {
    setNamaKegiatan('');
    setTingkat('');
    setPoin('');
    setKategori('konseling');
    setUraian('');
    setTindakLanjut('');
    setTanggal('');
    setSiswaId('');
  };

  const handleSave = async () => {
    if (!ready || saving) return;
    setSaving(true);
    try {
      let res;
      if (jenis === 'prestasi') {
        res = await teacherAPI.addHomeroomPrestasi({
          siswa_id: currentSiswa,
          nama_kegiatan: namaKegiatan.trim(),
          tingkat,
          poin: Number(poin),
        });
      } else {
        res = await teacherAPI.addHomeroomBk({
          siswa_id: currentSiswa,
          kategori,
          uraian: uraian.trim(),
          tindak_lanjut: tindakLanjut.trim() || null,
          tanggal: tanggal || null,
        });
      }
      toast.success(res.data?.message || 'Catatan berhasil disimpan.');
      resetForm();
      if (typeof onSaved === 'function') onSaved();
      onClose();
    } catch (error) {
      const msg = error?.response?.data?.message || 'Gagal menyimpan catatan.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-50 transition';
  const labelCls = 'mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-2xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100"
          >
            {/* Header: hanya judul teks (house-style) */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-black text-slate-800">Tambah Catatan Siswa</h3>
              <ModalCloseControl onClose={() => !saving && onClose()} />
            </div>

            {/* Badan scroll */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-5 space-y-5">
              <div>
                <span className={labelCls}>Pilih Siswa</span>
                <SearchableDropdown
                  value={currentSiswa}
                  onChange={setSiswaId}
                  options={studentOptions}
                  placeholder="Cari dan pilih siswa kelas binaan"
                  searchPlaceholder="Ketik nama atau NISN siswa..."
                  themeColor="#059669"
                />
              </div>

              <div>
                <span className={labelCls}>Jenis Catatan</span>
                <div className="inline-flex gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                  {TIPE_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setJenis(t.id)}
                      className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                        jenis === t.id
                          ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {jenis === 'prestasi' ? (
                <div className="space-y-4">
                  <div>
                    <span className={labelCls}>Nama Lomba / Kegiatan</span>
                    <input
                      type="text"
                      value={namaKegiatan}
                      onChange={(e) => setNamaKegiatan(e.target.value)}
                      placeholder="Juara 1 Lomba Catur Pelajar"
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className={labelCls}>Tingkat</span>
                      <SearchableDropdown
                        value={tingkat}
                        onChange={setTingkat}
                        options={TINGKAT_OPTIONS}
                        placeholder="Pilih tingkat"
                        searchPlaceholder="Ketik tingkat..."
                        themeColor="#059669"
                      />
                    </div>
                    <div>
                      <span className={labelCls}>Poin Tambahan</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={poin}
                        onChange={(e) => setPoin(e.target.value)}
                        placeholder="10"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-400">
                    Poin otomatis menambah skor peringkat siswa pada Rekap Nilai.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className={labelCls}>Kategori</span>
                      <SearchableDropdown
                        value={kategori}
                        onChange={setKategori}
                        options={BK_KATEGORI}
                        placeholder="Pilih kategori"
                        searchPlaceholder="Ketik kategori..."
                        themeColor="#059669"
                      />
                    </div>
                    <div>
                      <span className={labelCls}>Tanggal Kejadian</span>
                      <input
                        type="date"
                        value={tanggal}
                        onChange={(e) => setTanggal(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <span className={labelCls}>Uraian</span>
                    <textarea
                      rows={4}
                      value={uraian}
                      onChange={(e) => setUraian(e.target.value)}
                      placeholder="Siswa sering terlambat masuk kelas pagi sejak minggu ketiga."
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                  <div>
                    <span className={labelCls}>Tindak Lanjut</span>
                    <textarea
                      rows={3}
                      value={tindakLanjut}
                      onChange={(e) => setTindakLanjut(e.target.value)}
                      placeholder="Panggilan orang tua pada pertemuan berikutnya."
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer terpisah (house-style): 1 tombol primer full-width tanpa ikon */}
            <div className="shrink-0 border-t border-slate-100 bg-[#F1F5F9] px-6 py-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={!ready || saving}
                className={`w-full rounded-full py-3 text-sm font-black transition-all ${
                  ready && !saving
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800 active:scale-[0.99] shadow-md shadow-emerald-600/20'
                    : 'cursor-not-allowed bg-slate-200 text-slate-400'
                }`}
              >
                {saving ? <Loader2 size={16} className="inline animate-spin" /> : 'Simpan Catatan'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
