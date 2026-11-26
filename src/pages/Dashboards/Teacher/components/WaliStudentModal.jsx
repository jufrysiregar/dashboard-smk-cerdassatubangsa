import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, FileText, Loader2, MessageSquare, Phone, Plus, Printer,
  RefreshCw, ShieldAlert, Trophy, User,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import ConfirmDialog from '../../../../components/dashboard/shared/ConfirmDialog';
import RaporPdfPreview from '../../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';
import { BASE_URL, teacherAPI } from '../../../../utils/api';
import { previewRaporPDF } from '../../../../utils/raporPdf';

const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

const BK_LABEL = { konseling: 'Konseling', pembinaan: 'Pembinaan', pelanggaran: 'Pelanggaran', izin_khusus: 'Izin Khusus' };
const BK_TONE = {
  konseling: 'bg-sky-50 text-sky-700 ring-sky-200',
  pembinaan: 'bg-amber-50 text-amber-700 ring-amber-200',
  pelanggaran: 'bg-rose-50 text-rose-700 ring-rose-200',
  izin_khusus: 'bg-violet-50 text-violet-700 ring-violet-200',
};
const SIKAP_OPTIONS = [
  { value: 'sangat_baik', label: 'Sangat Baik' },
  { value: 'baik', label: 'Baik' },
  { value: 'cukup', label: 'Cukup' },
  { value: 'kurang', label: 'Kurang' },
];
const KEPUTUSAN_OPTIONS = [
  { value: '', label: 'Belum ditentukan' },
  { value: 'naik', label: 'Naik Kelas' },
  { value: 'tidak_naik', label: 'Tidak Naik Kelas' },
  { value: 'lulus', label: 'Lulus' },
  { value: 'tidak_lulus', label: 'Tidak Lulus' },
];

/**
 * Modal detail siswa Command Center Wali Kelas:
 * kartu profil + poin prestasi + catatan BK + finalisasi rapor (tersimpan nyata ke DB).
 */
export default function WaliStudentModal({
  open, studentId, onClose, onChanged, classInfo, homeroomTeacher, subjects = [],
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [preview, setPreview] = useState(null); // { url, filename } — pratinjau rapor di layar
  const [showPrestasiForm, setShowPrestasiForm] = useState(false);
  const [showBkForm, setShowBkForm] = useState(false);

  // Form rapor (state = nilai yang sedang diedit)
  const [catatan, setCatatan] = useState('');
  const [sikapSt, setSikapSt] = useState('');
  const [sikSo, setSikSo] = useState('');
  const [keputusan, setKeputusan] = useState('');
  const [koreksi, setKoreksi] = useState({ sakit: '', izin: '', alpha: '' });
  const [baseline, setBaseline] = useState(null);

  // Form prestasi baru
  const [pNama, setPNama] = useState('');
  const [pTingkat, setPTingkat] = useState('');
  const [pPoin, setPPoin] = useState('');
  const [editingPrestasi, setEditingPrestasi] = useState(null);

  // Form BK baru
  const [bkKategori, setBkKategori] = useState('konseling');
  const [bkUraian, setBkUraian] = useState('');
  const [bkTindak, setBkTindak] = useState('');
  const [bkTanggal, setBkTanggal] = useState('');

  useEscapeKey(open && !saving && !preview, () => onClose());
  useBodyScrollLock(open);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const res = await teacherAPI.getHomeroomStudent(studentId);
      const d = res.data;
      setDetail(d);
      const r = d.rapor || {};
      setCatatan(r.catatan_wali_kelas || '');
      setSikapSt(r.sikap_spiritual || '');
      setSikSo(r.sikap_sosial || '');
      setKeputusan(r.keputusan || '');
      const k = {
        sakit: d.koreksi?.sakit ?? '',
        izin: d.koreksi?.izin ?? '',
        alpha: d.koreksi?.alpha ?? '',
      };
      setKoreksi(k);
      setBaseline({
        catatan: r.catatan_wali_kelas || '',
        sikap_spiritual: r.sikap_spiritual || '',
        sikap_sosial: r.sikap_sosial || '',
        keputusan: r.keputusan || '',
        koreksi: k,
      });
    } catch {
      toast.error('Gagal memuat detail siswa.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (open && studentId) load();
    if (!open) {
      setDetail(null);
      setShowPrestasiForm(false);
      setShowBkForm(false);
      setEditingPrestasi(null);
      setPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return null;
      });
    }
  }, [open, studentId, load]);

  const hasDiff = useMemo(() => {
    if (!baseline) return false;
    if (catatan !== baseline.catatan) return true;
    if (sikapSt !== baseline.sikap_spiritual) return true;
    if (sikSo !== baseline.sikap_sosial) return true;
    if (keputusan !== baseline.keputusan) return true;
    return ['sakit', 'izin', 'alpha'].some((k) => String(koreksi[k] ?? '') !== String(baseline.koreksi[k] ?? ''));
  }, [baseline, catatan, sikapSt, sikSo, keputusan, koreksi]);

  const saveRapor = async () => {
    if (!hasDiff || saving) return;
    setSaving(true);
    try {
      const res = await teacherAPI.saveHomeroomRapor({
        siswa_id: studentId,
        catatan_wali_kelas: catatan.trim() || null,
        sikap_spiritual: sikapSt || null,
        sikap_sosial: sikSo || null,
        keputusan: keputusan || null,
        koreksi_sakit: koreksi.sakit === '' ? null : Number(koreksi.sakit),
        koreksi_izin: koreksi.izin === '' ? null : Number(koreksi.izin),
        koreksi_alpha: koreksi.alpha === '' ? null : Number(koreksi.alpha),
      });
      toast.success(res.data?.message || 'Catatan rapor berhasil disimpan.');
      if (typeof onChanged === 'function') onChanged();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Gagal menyimpan catatan rapor.');
    } finally {
      setSaving(false);
    }
  };

  const submitPrestasi = async (e) => {
    e.preventDefault();
    if (!pNama.trim() || !pTingkat || poinInvalid(pPoin)) return;
    try {
      const res = await teacherAPI.addHomeroomPrestasi({
        siswa_id: studentId, nama_kegiatan: pNama.trim(), tingkat: pTingkat, poin: Number(pPoin),
      });
      toast.success(res.data?.message || 'Poin prestasi berhasil disimpan.');
      setPNama(''); setPTingkat(''); setPPoin(''); setShowPrestasiForm(false);
      await load();
      if (typeof onChanged === 'function') onChanged();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Gagal menyimpan poin prestasi.');
    }
  };

  const updatePrestasi = async (id) => {
    if (!editingPrestasi?.nama_kegiatan?.trim() || !editingPrestasi.tingkat || poinInvalid(editingPrestasi.poin)) return;
    try {
      const res = await teacherAPI.updateHomeroomPrestasi(id, {
        nama_kegiatan: editingPrestasi.nama_kegiatan.trim(),
        tingkat: editingPrestasi.tingkat,
        poin: Number(editingPrestasi.poin),
        keterangan: editingPrestasi.keterangan || null,
      });
      toast.success(res.data?.message || 'Poin prestasi berhasil diperbarui.');
      setEditingPrestasi(null);
      await load();
      if (typeof onChanged === 'function') onChanged();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Gagal memperbarui poin prestasi.');
    }
  };

  const deletePrestasi = (row) => {
    setConfirmState({
      title: 'Hapus Poin Prestasi',
      message: `Hapus "${row.nama_kegiatan}" (${row.poin} poin) dari daftar prestasi siswa ini?`,
      confirmLabel: 'Ya, Hapus',
      onConfirm: async () => {
        try {
          await teacherAPI.deleteHomeroomPrestasi(row.id);
          toast.success('Poin prestasi berhasil dihapus.');
          await load();
          if (typeof onChanged === 'function') onChanged();
        } catch {
          toast.error('Gagal menghapus poin prestasi.');
        } finally {
          setConfirmState(null);
        }
      },
    });
  };

  const submitBk = async (e) => {
    e.preventDefault();
    if (!bkUraian.trim()) return;
    try {
      const res = await teacherAPI.addHomeroomBk({
        siswa_id: studentId,
        kategori: bkKategori,
        uraian: bkUraian.trim(),
        tindak_lanjut: bkTindak.trim() || null,
        tanggal: bkTanggal || null,
      });
      toast.success(res.data?.message || 'Catatan konseling berhasil disimpan.');
      setBkUraian(''); setBkTindak(''); setBkTanggal(''); setBkKategori('konseling'); setShowBkForm(false);
      await load();
      if (typeof onChanged === 'function') onChanged();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Gagal menyimpan catatan konseling.');
    }
  };

  const deleteBk = (row) => {
    setConfirmState({
      title: 'Hapus Catatan Konseling',
      message: 'Catatan pembinaan siswa ini akan dihapus permanen dari database. Lanjutkan?',
      confirmLabel: 'Ya, Hapus',
      onConfirm: async () => {
        try {
          await teacherAPI.deleteHomeroomBk(row.id);
          toast.success('Catatan konseling berhasil dihapus.');
          await load();
          if (typeof onChanged === 'function') onChanged();
        } catch {
          toast.error('Gagal menghapus catatan konseling.');
        } finally {
          setConfirmState(null);
        }
      },
    });
  };

  const closePreview = () => {
    setPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const handlePreviewPdf = async () => {
    if (!detail) return;
    setPrinting(true);
    try {
      const actual = detail.presensi || {};
      const kor = detail.koreksi || {};
      const pdfStudent = {
        ...detail.student,
        semester: detail.periode?.semester,
        tahun_ajaran: detail.periode?.tahun_ajaran,
        grade_avg: detail.grade_avg,
        subject_grades: detail.subject_grades,
        catatan_wali_kelas: catatan,
        sikap_spiritual: sikapSt || null,
        sikap_sosial: sikSo || null,
        keputusan: keputusan || detail.rapor?.keputusan || null,
        prestasi: (detail.prestasi || []).map((p) => `${p.nama_kegiatan} (${p.tingkat}, ${p.poin} poin)`).join(', ') || null,
        rapor_status: detail.rapor?.status || 'draft',
        predikat: detail.rapor?.predikat || null,
      };
      const p = await previewRaporPDF({
        student: pdfStudent,
        subjects,
        classInfo,
        homeroomTeacher,
        report: {
          poinPrestasi: (detail.prestasi || []).reduce((a, pr) => a + Number(pr.poin || 0), 0),
          skorAkhir: detail.peringkat?.skor ?? null,
          peringkat: detail.peringkat?.rank ?? null,
          jumlahSiswa: detail.peringkat?.of ?? null,
          // Angka akhir = koreksi wali kelas bila diisi, selain itu rekap log presensi.
          ketidakhadiran: {
            sakit: kor.sakit ?? actual.sakit ?? 0,
            izin: kor.izin ?? actual.izin ?? 0,
            alpha: kor.alpha ?? actual.alpha ?? 0,
          },
          prestasiList: detail.prestasi || [],
          pkl: detail.pkl || null,
        },
      });
      if (p) setPreview(p);
    } catch { /* toast sudah ditampilkan util */ } finally {
      setPrinting(false);
    }
  };

  const gradeRows = detail
    ? Object.entries(detail.subject_grades || {}).map(([id, g]) => ({ id, ...g }))
    : [];

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
            {/* Header: hanya judul teks */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-black text-slate-800">
                {detail ? detail.student.name : 'Detail Siswa'}
              </h3>
              <ModalCloseControl onClose={() => !saving && onClose()} />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-5 space-y-6">
              {loading || !detail ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                  <RefreshCw size={26} className="animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-wider">Memuat data siswa...</p>
                </div>
              ) : (
                <>
                  {/* ── Kartu Profil Lengkap ── */}
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5">
                    <div className="flex items-start gap-4">
                      <StudentAvatar avatarPath={detail.student.avatar_path} name={detail.student.name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-black text-slate-800">{detail.student.name}</p>
                        <p className="mt-0.5 text-[11px] font-mono text-slate-400">
                          NIS/NISN: {detail.student.nisn} · Kelas {detail.student.kelas} · {detail.student.gender === 'P' ? 'Perempuan' : detail.student.gender === 'L' ? 'Laki-laki' : '-'}
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                            <Phone size={12} className="text-emerald-600" /> {detail.student.phone || '-'}
                          </p>
                          <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                            <ShieldAlert size={12} className="text-blue-600" /> Ortu: {detail.student.parent_phone || '-'}
                          </p>
                          <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 sm:col-span-2">
                            <User size={12} className="text-slate-400" /> {detail.student.birth_place}, {detail.student.birth_date} · {detail.student.address}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MiniStat label="Rata Nilai" value={detail.grade_avg ?? '-'} tone="text-slate-800" />
                      <MiniStat
                        label="Peringkat"
                        value={detail.peringkat ? `#${detail.peringkat.rank} / ${detail.peringkat.of}` : '-'}
                        tone="text-indigo-700"
                      />
                      <MiniStat label="Poin Prestasi" value={String((detail.prestasi || []).reduce((a, p) => a + Number(p.poin || 0), 0))} tone="text-amber-700" />
                      <MiniStat
                        label="Tunggakan"
                        value={detail.tagihan?.total_due > 0 ? rupiah(detail.tagihan.total_due) : detail.tagihan?.items?.length ? 'Lunas' : '-'}
                        tone={detail.tagihan?.total_due > 0 ? 'text-rose-700' : 'text-emerald-700'}
                      />
                    </div>
                  </div>

                  {/* ── 1. Poin Prestasi / Lomba ── */}
                  <SectionShell
                    icon={Trophy}
                    tint="bg-amber-50 text-amber-600"
                    title="Poin Prestasi / Lomba"
                    actionLabel="Tambah Prestasi"
                    onAction={() => { setShowBkForm(false); setShowPrestasiForm((v) => !v); }}
                  >
                    {(detail.prestasi || []).length === 0 && !showPrestasiForm && (
                      <EmptyLine text="Belum ada poin prestasi untuk siswa ini pada periode aktif." />
                    )}
                    <div className="space-y-2">
                      {(detail.prestasi || []).map((p) => (
                        <div key={p.id} className="rounded-xl border border-slate-100 bg-white p-3">
                          {editingPrestasi?.id === p.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_80px]">
                                <input
                                  value={editingPrestasi.nama_kegiatan}
                                  onChange={(e) => setEditingPrestasi((s) => ({ ...s, nama_kegiatan: e.target.value }))}
                                  placeholder="Juara 2 LKS Jaringan"
                                  className={inputCls}
                                />
                                <input
                                  value={editingPrestasi.tingkat}
                                  onChange={(e) => setEditingPrestasi((s) => ({ ...s, tingkat: e.target.value }))}
                                  placeholder="Provinsi"
                                  className={inputCls}
                                />
                                <input
                                  type="number" min="0" max="100"
                                  value={editingPrestasi.poin}
                                  onChange={(e) => setEditingPrestasi((s) => ({ ...s, poin: e.target.value }))}
                                  className={inputCls}
                                />
                              </div>
                              <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setEditingPrestasi(null)} className="text-[11px] font-black text-slate-400 hover:text-slate-600 transition-colors">Batal</button>
                                <button type="button" onClick={() => updatePrestasi(p.id)} className="text-[11px] font-black text-amber-500 transition-colors hover:text-amber-700">Simpan</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black text-slate-800">{p.nama_kegiatan}</p>
                                <p className="mt-0.5 text-[11px] font-bold text-slate-400">{p.tingkat}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700 tabular-nums">+{p.poin} poin</span>
                                <button
                                  type="button"
                                  onClick={() => { setShowPrestasiForm(false); setEditingPrestasi({ id: p.id, nama_kegiatan: p.nama_kegiatan, tingkat: p.tingkat, poin: String(p.poin), keterangan: p.keterangan || '' }); }}
                                  className="text-[11px] font-black text-amber-500 transition-colors hover:text-amber-700"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deletePrestasi(p)}
                                  className="text-[11px] font-black text-rose-500 transition-colors hover:text-rose-700"
                                >
                                  Hapus
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {showPrestasiForm && (
                      <form onSubmit={submitPrestasi} className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_80px]">
                          <input value={pNama} onChange={(e) => setPNama(e.target.value)} placeholder="Nama lomba / kegiatan" className={inputCls} />
                          <input value={pTingkat} onChange={(e) => setPTingkat(e.target.value)} placeholder="Tingkat" className={inputCls} list="wali-tingkat-list" />
                          <input type="number" min="0" max="100" value={pPoin} onChange={(e) => setPPoin(e.target.value)} placeholder="Poin" className={inputCls} />
                        </div>
                        <datalist id="wali-tingkat-list">
                          {['Sekolah', 'Kecamatan', 'Kota / Kabupaten', 'Provinsi', 'Nasional', 'Internasional'].map((t) => <option key={t} value={t} />)}
                        </datalist>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={!pNama.trim() || !pTingkat || poinInvalid(pPoin)}
                            className={`rounded-full px-5 py-2 text-[11px] font-black transition-all ${!pNama.trim() || !pTingkat || poinInvalid(pPoin) ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95'}`}
                          >
                            Simpan Prestasi
                          </button>
                        </div>
                      </form>
                    )}
                  </SectionShell>

                  {/* ── 2. Catatan Konseling / Pembinaan ── */}
                  <SectionShell
                    icon={MessageSquare}
                    tint="bg-sky-50 text-sky-600"
                    title="Catatan Konseling / Pembinaan"
                    actionLabel="Tambah Catatan"
                    onAction={() => { setShowPrestasiForm(false); setShowBkForm((v) => !v); }}
                  >
                    {(detail.bk_catatan || []).length === 0 && !showBkForm && (
                      <EmptyLine text="Belum ada riwayat konseling atau pembinaan perilaku." />
                    )}
                    <div className="space-y-2">
                      {(detail.bk_catatan || []).map((c) => (
                        <div key={c.id} className="rounded-xl border border-slate-100 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ring-1 ${BK_TONE[c.kategori] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                                  {BK_LABEL[c.kategori] || c.kategori}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">{formatTanggal(c.tanggal)}</span>
                              </div>
                              <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-700">{c.uraian}</p>
                              {c.tindak_lanjut && (
                                <p className="mt-1 text-[11px] font-medium italic text-slate-500">Tindak lanjut: {c.tindak_lanjut}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteBk(c)}
                              className="shrink-0 text-[11px] font-black text-rose-500 transition-colors hover:text-rose-700"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {showBkForm && (
                      <form onSubmit={submitBk} className="mt-3 space-y-2 rounded-xl border border-sky-200 bg-sky-50/40 p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <select value={bkKategori} onChange={(e) => setBkKategori(e.target.value)} className={inputCls}>
                            {Object.entries(BK_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <input type="date" value={bkTanggal} onChange={(e) => setBkTanggal(e.target.value)} className={inputCls} />
                        </div>
                        <textarea rows={2} value={bkUraian} onChange={(e) => setBkUraian(e.target.value)} placeholder="Uraian kejadian dan konteksnya" className={`${inputCls} resize-none`} />
                        <textarea rows={2} value={bkTindak} onChange={(e) => setBkTindak(e.target.value)} placeholder="Rencana tindak lanjut bersama orang tua" className={`${inputCls} resize-none`} />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={!bkUraian.trim()}
                            className={`rounded-full px-5 py-2 text-[11px] font-black transition-all ${!bkUraian.trim() ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-sky-600 text-white hover:bg-sky-700 active:scale-95'}`}
                          >
                            Simpan Catatan
                          </button>
                        </div>
                      </form>
                    )}
                  </SectionShell>

                  {/* ── 3. Finalisasi Rapor ── */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                    <div className="mb-4 flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><FileText size={17} /></span>
                      <div>
                        <h4 className="text-sm font-black text-slate-800">Finalisasi Rapor Siswa</h4>
                        <p className="text-[11px] font-semibold text-slate-400">
                          Periode {detail.periode?.tahun_ajaran || '-'} · Semester {detail.periode?.semester || '-'}
                          {detail.rapor?.status === 'final' ? ' · sudah dibagikan ke siswa' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <span className={labelCls}>Narasi Catatan Wali Kelas</span>
                        <textarea
                          rows={3}
                          value={catatan}
                          onChange={(e) => setCatatan(e.target.value)}
                          placeholder="Pertahankan kedisiplinan dan tingkatkan partisipasi praktik jaringan."
                          className={`${inputCls} resize-none`}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <span className={labelCls}>Sikap Spiritual</span>
                          <select value={sikapSt} onChange={(e) => setSikapSt(e.target.value)} className={inputCls}>
                            <option value="">Belum dinilai</option>
                            {SIKAP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <span className={labelCls}>Sikap Sosial</span>
                          <select value={sikSo} onChange={(e) => setSikSo(e.target.value)} className={inputCls}>
                            <option value="">Belum dinilai</option>
                            {SIKAP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <span className={labelCls}>Keputusan</span>
                          <select value={keputusan} onChange={(e) => setKeputusan(e.target.value)} className={inputCls}>
                            {KEPUTUSAN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <span className={labelCls}>Koreksi Akhir Kehadiran untuk Rapor</span>
                        <div className="grid grid-cols-3 gap-3">
                          {['sakit', 'izin', 'alpha'].map((k) => (
                            <div key={k} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-center">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{k}</span>
                              <input
                                type="number" min="0"
                                value={koreksi[k]}
                                onChange={(e) => setKoreksi((s) => ({ ...s, [k]: e.target.value }))}
                                placeholder={String(detail.presensi?.[k] ?? 0)}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-black text-slate-800 focus:border-emerald-500 focus:outline-none transition"
                              />
                              <p className="mt-1 text-[10px] font-bold text-slate-400">Log: {detail.presensi?.[k] ?? 0}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pratinjau nilai & peringkat */}
                      <div className="overflow-hidden rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pratinjau Nilai Mapel & Peringkat</span>
                          <span className="text-[10px] font-black text-slate-400">
                            {detail.peringkat ? `Peringkat #${detail.peringkat.rank} dari ${detail.peringkat.of} · Skor ${detail.peringkat.skor}` : 'Peringkat belum terbentuk (nilai/poin kosong)'}
                          </span>
                        </div>
                        {gradeRows.length === 0 ? (
                          <p className="px-3.5 py-6 text-center text-[11px] font-bold italic text-slate-400">
                            Belum ada mapel terjadwal / nilai pada periode ini.
                          </p>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <tbody className="divide-y divide-slate-50">
                              {gradeRows.map((g) => (
                                <tr key={g.id}>
                                  <td className="px-3.5 py-2 font-bold text-slate-700">{g.subject_name}</td>
                                  <td className="px-2 py-2 text-center text-[11px] font-bold text-slate-400">KKM {g.kkm}</td>
                                  <td className="px-3.5 py-2 text-right font-black tabular-nums text-slate-800">
                                    {g.akhir ?? <span className="text-slate-300">-</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={handlePreviewPdf}
                          disabled={printing}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-black text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
                        >
                          {printing ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                          {printing ? 'Menyiapkan...' : 'Pratinjau Rapor PDF'}
                        </button>
                        <p className="text-[10px] font-bold text-slate-400">
                          {hasDiff ? 'Ada perubahan yang belum disimpan' : 'Semua perubahan sudah tersimpan'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer terpisah: 1 tombol primer full-width tanpa ikon */}
            <div className="shrink-0 border-t border-slate-100 bg-[#F1F5F9] px-6 py-4">
              <button
                type="button"
                onClick={saveRapor}
                disabled={!hasDiff || saving || loading || !detail}
                className={`w-full rounded-full py-3 text-sm font-black transition-all ${
                  hasDiff && !saving && detail
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800 active:scale-[0.99] shadow-md shadow-emerald-600/20'
                    : 'cursor-not-allowed bg-slate-200 text-slate-400'
                }`}
              >
                {saving ? <Loader2 size={16} className="inline animate-spin" /> : 'Simpan Catatan Rapor'}
              </button>
            </div>
          </motion.div>

          <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
          <RaporPdfPreview state={preview} onClose={closePreview} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-50 transition';
const labelCls = 'mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500';

const poinInvalid = (v) => v === '' || Number(v) < 0 || Number(v) > 100 || Number.isNaN(Number(v));

const formatTanggal = (d) => {
  if (!d) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));
  } catch {
    return String(d);
  }
};

function SectionShell({ icon: Icon, tint, title, actionLabel, onAction, children }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}><Icon size={17} /></span>
        <button type="button" onClick={() => setCollapsed((v) => !v)} className="flex flex-1 items-center justify-between text-left">
          <h4 className="text-sm font-black text-slate-800">{title}</h4>
          <ChevronDown size={15} className={`text-slate-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-black text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          <Plus size={13} /> {actionLabel}
        </button>
      </div>
      {!collapsed && children}
    </div>
  );
}

function EmptyLine({ text }) {
  return <p className="py-3 text-center text-[11px] font-bold italic text-slate-400">{text}</p>;
}

function MiniStat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-2.5 text-center">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-black tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

export function StudentAvatar({ avatarPath, name, size = 'md' }) {
  const [imgError, setImgError] = useState(false);
  const dims = size === 'lg' ? 'h-16 w-16 text-xl' : size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-sm';
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (avatarPath && !imgError) {
    return (
      <img
        src={`${BASE_URL}/storage/${avatarPath}`}
        alt={name}
        loading="lazy"
        onError={() => setImgError(true)}
        className={`${dims} shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm`}
      />
    );
  }
  return (
    <div className={`${dims} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 font-black text-white shadow-sm`}>
      {initial}
    </div>
  );
}
