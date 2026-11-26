import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { pusatJurusanAPI } from '../../../../utils/api';
import {
  Loader2, X, FileText, CheckCircle, Award, ShieldCheck, BadgeCheck, Star,
  Save, Lock, ClipboardList,
} from 'lucide-react';

const ASPEK_PKL = [
  { key: 'kehadiran', label: 'Kehadiran' },
  { key: 'kedisiplinan', label: 'Kedisiplinan' },
  { key: 'kerjasama', label: 'Kerjasama' },
  { key: 'inisiatif', label: 'Inisiatif' },
  { key: 'kerapian', label: 'Kerapian' },
  { key: 'penerapan', label: 'Kemampuan Penerapan Keahlian Industri' },
];
const emptyAspek = () => Object.fromEntries(ASPEK_PKL.map((a) => [a.key, '']));

const STEPS = [
  { key: 'logbook', label: 'Logbook', icon: ClipboardList },
  { key: 'laporan', label: 'Verifikasi Laporan', icon: FileText },
  { key: 'nilai', label: 'Penilaian & Finalisasi', icon: Star },
  { key: 'sertifikat', label: 'Sertifikat', icon: Award },
];

const PklSiklusModal = ({ jurusanId, pklId, onClose, onChanged }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [step, setStep] = useState('logbook');
  const [aspekNilai, setAspekNilai] = useState(emptyAspek());
  const [savedNilai, setSavedNilai] = useState(emptyAspek()); // baseline nilai tersimpan (utk deteksi perubahan)

  const load = useCallback(async () => {
    if (!pklId) return;
    setLoading(true); setErr('');
    try {
      const r = await pusatJurusanAPI.getPklDetail(jurusanId, pklId);
      setDetail(r.data?.data || null);
    } catch (e) { setErr(e?.response?.data?.message || 'Gagal memuat detail PKL.'); }
    finally { setLoading(false); }
  }, [jurusanId, pklId]);

  useEffect(() => { setStep('logbook'); load(); }, [load]);

  // Kunci scroll konten belakang saat modal terbuka (jangan bisa di-scroll).
  useEffect(() => {
    if (!pklId) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [pklId]);

  // Prefill 6 aspek dari penilaian tersimpan (aspek = kunci).
  useEffect(() => {
    const rows = detail?.penilaian || [];
    const next = emptyAspek();
    rows.forEach((pn) => { if (Object.prototype.hasOwnProperty.call(next, pn.aspek)) next[pn.aspek] = String(Number(pn.nilai)); });
    setAspekNilai(next);
    setSavedNilai(next);
  }, [detail]);

  const act = async (label, fn) => {
    setBusy(label); setErr('');
    try { await fn(); await load(); onChanged && onChanged(); }
    catch (e) { setErr(e?.response?.data?.message || 'Aksi gagal.'); }
    finally { setBusy(''); }
  };

  const verifikasiLaporan = (laporanId) => act('verif', () => pusatJurusanAPI.verifyLaporanMagang(jurusanId, laporanId));

  const simpanPenilaian = async (e) => {
    e.preventDefault();
    setBusy('nilai'); setErr('');
    try {
      await pusatJurusanAPI.storePenilaianMagang(jurusanId, pklId, { nilai: aspekNilai });
      setSavedNilai(aspekNilai); // update baseline lokal → tombol Simpan mati lagi, TANPA reload/flash modal
      onChanged && onChanged();
    } catch (e2) {
      setErr(e2?.response?.data?.message || 'Gagal menyimpan penilaian.');
    } finally {
      setBusy('');
    }
  };
  // Finalisasi: simpan 6 aspek (pakai nilai di layar) → finalisasi → tutup pop-up saat sukses.
  const finalisasi = async () => {
    if (ASPEK_PKL.some((a) => aspekNilai[a.key] === '' || aspekNilai[a.key] == null)) {
      setErr('Lengkapi ke-6 aspek penilaian terlebih dahulu.');
      return;
    }
    setBusy('final'); setErr('');
    try {
      await pusatJurusanAPI.storePenilaianMagang(jurusanId, pklId, { nilai: aspekNilai });
      await pusatJurusanAPI.finalisasiPkl(jurusanId, pklId);
      onChanged && onChanged();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Finalisasi gagal.');
      setBusy('');
    }
  };
  const sertifikat = () => act('sertifikat', () => pusatJurusanAPI.terbitkanSertifikat(jurusanId, pklId));

  if (!pklId) return null;
  const pkl = detail;
  const isFinal = pkl?.status_final === 'final';
  const laporanTerverifikasi = (pkl?.laporan || []).some((l) => l.status === 'diverifikasi');
  const sertifikatAktif = isFinal && laporanTerverifikasi;
  const filledAspek = ASPEK_PKL.filter((a) => aspekNilai[a.key] !== '' && aspekNilai[a.key] != null);
  const sumAspek = filledAspek.reduce((s, a) => s + Number(aspekNilai[a.key]), 0);
  const nilaiLaporan = Math.round((sumAspek / ASPEK_PKL.length) * 100) / 100; // (Total 6) / 6
  const lengkapAspek = filledAspek.length === ASPEK_PKL.length;
  const adaPerubahan = ASPEK_PKL.some((a) => String(aspekNilai[a.key] ?? '') !== String(savedNilai[a.key] ?? ''));

  const stepDone = {
    logbook: (pkl?.logbooks || []).length > 0,
    laporan: laporanTerverifikasi,
    nilai: isFinal,
    sertifikat: !!pkl?.sertifikat,
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
          {/* Header gradien gelap */}
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 px-6 py-4">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-indigo-500/30 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Award className="h-5 w-5 text-indigo-200" /></span>
                <div>
                  <h3 className="text-lg font-black text-white">Siklus PKL — {pkl?.siswa?.name || '…'}</h3>
                  <p className="text-xs font-semibold text-indigo-100/80">{pkl?.tempat_magang || 'Penempatan PKL'}{pkl?.schoolClass?.name ? ` · ${pkl.schoolClass.name}` : ''}</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X size={18} /></button>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex gap-1 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = step === s.key;
              const locked = s.key === 'sertifikat' && !sertifikatAktif;
              return (
                <button key={s.key} onClick={() => setStep(s.key)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-[11px] font-black uppercase tracking-wide transition-all ${active ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${stepDone[s.key] ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {stepDone[s.key] ? <CheckCircle className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                  {locked && <Lock className="h-3 w-3 text-slate-300" />}
                </button>
              );
            })}
          </div>

          <div className="max-h-[64vh] space-y-5 overflow-y-auto p-6">
            {loading && <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Memuat...</div>}
            {err && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 ring-1 ring-inset ring-red-600/10">{err}</div>}

            {!loading && pkl && (
              <>
                {/* STEP 1 — Logbook */}
                {step === 'logbook' && (
                  <section>
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><ClipboardList className="h-4 w-4" /> Logbook & Aktivitas Harian ({(pkl.logbooks || []).length})</h4>
                    {(pkl.logbooks || []).length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs font-medium text-slate-400">Belum ada logbook dari siswa.</p>
                    ) : (
                      <div className="space-y-2">
                        {(pkl.logbooks || []).map((lb) => (
                          <div key={lb.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                            <p className="text-xs font-bold text-slate-600">{lb.uraian || lb.aktivitas}</p>
                            <p className="text-[10px] text-slate-400">{lb.tanggal || '—'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* STEP 2 — Verifikasi Laporan */}
                {step === 'laporan' && (
                  <section>
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><FileText className="h-4 w-4" /> Verifikasi Laporan Akhir</h4>
                    {(pkl.laporan || []).length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs font-medium text-slate-400">Belum ada laporan dikirim siswa.</p>
                    ) : (
                      <div className="space-y-2">
                        {(pkl.laporan || []).map((l) => (
                          <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-700">{l.judul_laporan}</p>
                              <p className="text-[10px] font-semibold uppercase text-slate-400">{l.status}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {l.file_laporan && <a href={l.file_laporan} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200"><FileText className="h-3.5 w-3.5" /> Pratinjau</a>}
                              {l.status !== 'diverifikasi'
                                ? <button onClick={() => verifikasiLaporan(l.id)} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-50"><CheckCircle className="h-3.5 w-3.5" /> Verifikasi Laporan</button>
                                : <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Terverifikasi</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* STEP 3 — Penilaian & Finalisasi */}
                {step === 'nilai' && (
                  <section className="space-y-4">
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><Star className="h-4 w-4" /> Penilaian &amp; Finalisasi ke Rapor</h4>

                    {/* 6 aspek baku — 1 kolom nilai 0-100 */}
                    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                      {ASPEK_PKL.map((a) => (
                        <div key={a.key} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="flex-1 text-sm font-bold text-slate-700">{a.label}</span>
                          <input type="number" min="0" max="100" value={aspekNilai[a.key]}
                            onChange={(e) => setAspekNilai((p) => ({ ...p, [a.key]: e.target.value }))}
                            className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                            placeholder="0-100" />
                        </div>
                      ))}
                    </div>

                    {/* Hasil otomatis: Nilai Laporan Akhir PKL = (Total 6) / 6 */}
                    <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 px-5 py-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Nilai Laporan Akhir PKL</p>
                        <p className="text-[11px] font-semibold text-slate-500">Rata-rata otomatis (Total 6 aspek ÷ 6) · terisi {filledAspek.length}/6</p>
                      </div>
                      <span className={`text-3xl font-black tabular-nums ${lengkapAspek ? 'text-indigo-700' : 'text-slate-300'}`}>{nilaiLaporan.toFixed(2)}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <div className="text-xs font-bold text-slate-400">
                        {isFinal && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20"><ShieldCheck className="h-3.5 w-3.5" /> Final · {pkl.nilai_akhir}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={simpanPenilaian} disabled={!!busy || !adaPerubahan}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                          {busy === 'nilai' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Penilaian
                        </button>
                        <button onClick={finalisasi} disabled={!!busy || !lengkapAspek}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110 disabled:opacity-50">
                          {busy === 'final' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Finalisasi &amp; Sinkron ke Rapor
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* STEP 4 — Sertifikat */}
                {step === 'sertifikat' && (
                  <section className="space-y-4">
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><Award className="h-4 w-4" /> Penerbitan Sertifikat PKL</h4>
                    {!sertifikatAktif ? (
                      <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                        Sertifikat aktif setelah <b>laporan terverifikasi</b> dan <b>nilai difinalisasi</b>.
                      </div>
                    ) : pkl.sertifikat ? (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                        <p className="flex items-center gap-2 text-sm font-black text-emerald-700"><BadgeCheck className="h-4 w-4" /> Sertifikat Terbit</p>
                        <p className="mt-1 font-mono text-xs text-emerald-700">{pkl.sertifikat.nomor_sertifikat}</p>
                        {pkl.sertifikat.tanggal_terbit && <p className="mt-1 text-[11px] text-emerald-600">Terbit: {new Date(pkl.sertifikat.tanggal_terbit).toLocaleDateString('id-ID')}</p>}
                      </div>
                    ) : (
                      <button onClick={sertifikat} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/25 hover:brightness-110 disabled:opacity-50">
                        {busy === 'sertifikat' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />} Terbitkan Sertifikat PKL
                      </button>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default PklSiklusModal;
