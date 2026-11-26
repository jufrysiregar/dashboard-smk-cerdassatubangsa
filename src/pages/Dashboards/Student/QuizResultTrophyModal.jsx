import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, X, Lock, Trophy } from 'lucide-react';
import schoolLogo from '../../../assets/logos/logo22.png';
import { schoolAPI } from '../../../utils/api';

const TROPHY_BADGE = { gold: '🏆', silver: '🥈', bronze: '🥉', certificate: '🎖️' };
const trophyBadge = (tier, rank) => TROPHY_BADGE[tier] || (rank != null ? `#${rank}` : '🎖️');

// Layar selesai KUIS/TUGAS GURU — disamakan dengan layar selesai CBT Operator
// (StudentExamRunner.jsx): layar penuh putih, logo + nama sekolah, tombol
// PRATINJAU SOAL & TUTUP SESI, panel Peringkat & Keaktifan Kelas (terbuka/gembok).
const QuizResultTrophyModal = ({ open, onClose, result }) => {
    const [schoolName, setSchoolName] = useState('SMK Cerdas Satu Bangsa');
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        let alive = true;
        schoolAPI.getProfile()
            .then((r) => { const n = r.data?.data?.school_name; if (alive && n) setSchoolName(n); })
            .catch(() => { /* fallback nama brand */ });
        return () => { alive = false; };
    }, []);

    if (!open || !result) return null;

    const isCbt = Array.isArray(result.questions_review);
    const reveal = result.tampilkan_nilai === true;
    const review = result.questions_review || [];
    const leaderboard = Array.isArray(result.leaderboard) ? result.leaderboard : null;
    const jenis = result.jenis || 'Kuis';
    // Label dinamis: CBT → "tugas / kuis pilihan ganda"; esai → jenis-nya (mis. "tugas esai").
    const jenisLabel = isCbt ? 'tugas / kuis pilihan ganda' : String(jenis).toLowerCase();
    const thankYou = `Terima kasih telah menyelesaikan ${jenisLabel} sesi ini.`;

    // TUTUP SESI → muat ulang halaman penuh. Alur kuis guru TIDAK menulis
    // sessionStorage 'pending_exam_review', jadi pop-up ulasan ujian Operator tak muncul.
    const tutupSesi = () => { window.location.reload(); };

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-white">
            <div className="flex min-h-full flex-col items-center justify-center px-6 py-12 text-center">
                <div className="w-full">
                    {/* ── Header tengah: logo + nama sekolah ── */}
                    <div className="mb-8 flex flex-row flex-wrap items-center justify-center gap-x-5 gap-y-3">
                        <img src={schoolLogo} alt="Logo Sekolah" className="h-24 w-24 object-contain sm:h-28 sm:w-28" />
                        <p className="text-2xl font-black tracking-tight text-slate-800 sm:text-4xl">{schoolName}</p>
                    </div>

                    {/* ── Judul besar: 1 baris memanjang kiri-kanan, rata tengah ── */}
                    <h2 className="mx-auto w-full whitespace-nowrap text-center text-[clamp(1.05rem,3.5vw,3rem)] font-black leading-tight text-slate-900">{thankYou}</h2>

                    {/* ── Baris status ── */}
                    <div className="mt-8 inline-block text-left">
                        <p className="text-lg font-bold text-slate-700 sm:text-xl">Mata Pelajaran : {result.mapel || '—'}</p>
                        {isCbt && reveal ? (
                            <p className="mt-2 text-lg font-bold text-slate-700 sm:text-xl">
                                Nilai &amp; Benar Anda : {result.nilai != null ? result.nilai : '—'}
                                {result.correct_answers != null && result.total_questions != null ? ` (${result.correct_answers}/${result.total_questions} Benar)` : ''}
                                {' · '}<span className="text-amber-600">+{result.poin_diperoleh ?? 0} Poin</span>
                            </p>
                        ) : isCbt && !reveal ? (
                            <p className="mt-2 text-lg font-bold text-slate-700 sm:text-xl">
                                Nilai &amp; Benar Anda : <span className="text-slate-400">Disembunyikan Guru</span>
                            </p>
                        ) : (
                            <p className="mt-2 text-lg font-bold text-slate-700 sm:text-xl">
                                Jawaban Anda telah diterima guru.{' '}
                                <span className="text-amber-600">+{result.poin_diperoleh ?? 0} Poin</span> keaktifan.
                            </p>
                        )}
                    </div>

                    {/* ── Tombol aksi utama ── */}
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                        {isCbt && review.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowPreview(true)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-700 active:scale-95"
                            >
                                <Eye size={16} /> Pratinjau Soal
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={tutupSesi}
                            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-10 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 active:scale-95"
                        >
                            Tutup Sesi
                        </button>
                    </div>

                    {result.auto && (
                        <p className="mt-6 text-sm font-black uppercase tracking-wider text-amber-600">
                            Dikumpulkan otomatis karena waktu habis.
                        </p>
                    )}

                    {/* ── Garis pembatas + Panel Peringkat & Keaktifan Kelas (khusus CBT) ── */}
                    {isCbt && (
                        <div className="mx-auto mt-10 w-full max-w-2xl">
                            <div className="border-t border-slate-200 pt-8 text-left">
                                {reveal
                                    ? <LeaderboardPanel leaderboard={leaderboard || []} rank={result.rank} total={result.total_peserta ?? (leaderboard?.length || 0)} trophy={result.trophy_tier} />
                                    : <LockedPanel />}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── MODAL PRATINJAU SOAL ── */}
            <AnimatePresence>
                {showPreview && review.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
                        onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
                        >
                            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Pratinjau Soal</h3>
                                <button type="button" onClick={() => setShowPreview(false)} aria-label="Tutup"
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"><X size={18} /></button>
                            </div>
                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                                {!reveal && (
                                    <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                                        Kunci jawaban &amp; penilaian masih disembunyikan guru. Kamu hanya melihat soal dan pilihan jawabanmu.
                                    </p>
                                )}
                                {review.map((item, idx) => {
                                    const letters = Array.from(new Set([...Object.keys(item.options || {}), ...Object.keys(item.option_images || {})]));
                                    const keys = letters.length ? letters : ['A', 'B', 'C', 'D', 'E'];
                                    return (
                                        <div key={item.question_id ?? idx} className="rounded-2xl border border-slate-200 p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-bold text-slate-800">{item.no ?? idx + 1}. {item.text}</p>
                                                {reveal && (
                                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${item.benar ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {item.benar ? 'Benar' : 'Salah'}
                                                    </span>
                                                )}
                                            </div>
                                            {item.image_url && <img src={item.image_url} alt="Ilustrasi soal" className="mt-2 max-h-40 rounded-lg border border-slate-100 object-contain" />}
                                            <div className="mt-3 space-y-1.5">
                                                {keys.map((key) => {
                                                    const isKunci = reveal && item.kunci_jawaban && key === item.kunci_jawaban;
                                                    const isJawaban = item.jawaban_murid && key === item.jawaban_murid;
                                                    const optText = item.options?.[key];
                                                    const optImg = item.option_images?.[key];
                                                    return (
                                                        <div key={key} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${isKunci ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-slate-600'} ${isJawaban && !isKunci ? (reveal ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700') : ''}`}>
                                                            <span className="font-black">{key}.</span>
                                                            <span className="min-w-0 flex-1">
                                                                {optText || ''}
                                                                {optImg && <img src={optImg} alt={`Opsi ${key}`} className="mt-1 max-h-24 rounded border border-slate-100 object-contain" />}
                                                            </span>
                                                            {isKunci && <span className="shrink-0 text-[10px] font-black uppercase text-emerald-600">Kunci</span>}
                                                            {isJawaban && <span className="shrink-0 text-[10px] font-black uppercase text-slate-400">Jawaban Anda</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
                                <button type="button" onClick={() => setShowPreview(false)} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-blue-700 active:scale-95">Tutup</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>,
        document.body,
    );
};

// Panel peringkat terbuka — ringkasan posisi elegan + daftar baris bersih & modern.
const LeaderboardPanel = ({ leaderboard, rank, total, trophy }) => {
    const totalMurid = total || leaderboard.length || 0;
    return (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-amber-500 shadow-sm"><Trophy size={18} /></span>
                <h4 className="text-sm font-black uppercase tracking-widest text-indigo-700">Peringkat &amp; Keaktifan Kelas</h4>
            </div>

            {rank != null && (
                <div className="flex items-center justify-center gap-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 px-6 py-5">
                    <span className="text-4xl leading-none">{trophyBadge(trophy, rank)}</span>
                    <div className="text-left">
                        <p className="text-xl font-black text-amber-700 sm:text-2xl">
                            {rank === 1 ? 'Juara 1' : `Peringkat ${rank}`}
                            <span className="mx-2 text-amber-300">·</span>
                            <span className="text-slate-700">Peringkat {rank} dari {totalMurid || '—'} Murid</span>
                        </p>
                        <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-amber-600/70">Posisi kamu di kelas ini</p>
                    </div>
                </div>
            )}

            <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
                {leaderboard.length === 0 ? (
                    <p className="px-6 py-8 text-center text-sm font-semibold text-slate-400">Belum ada peserta yang dinilai.</p>
                ) : leaderboard.map((row) => (
                    <div key={row.rank} className={`flex items-center gap-4 px-6 py-3.5 transition ${row.is_current_user ? 'bg-emerald-50/70' : 'hover:bg-slate-50'}`}>
                        <span className="w-9 shrink-0 text-center text-xl">{trophyBadge(row.trophy_tier, row.rank)}</span>
                        <span className={`w-9 shrink-0 text-center text-sm font-black tabular-nums ${row.rank <= 3 ? 'text-amber-600' : 'text-slate-400'}`}>#{row.rank}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                            {row.nama}
                            {row.is_current_user && <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">Kamu</span>}
                        </span>
                        <span className="shrink-0 text-base font-black tabular-nums text-emerald-600">{row.skor}</span>
                        <span className="w-14 shrink-0 text-right text-xs font-black tabular-nums text-amber-500">+{row.poin}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Panel terkunci — pratinjau ter-blur + gembok saat guru menyembunyikan nilai.
const LockedPanel = () => (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <Lock size={16} className="text-slate-400" />
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Peringkat &amp; Keaktifan Kelas</h4>
        </div>
        <div className="select-none space-y-2.5 p-5 blur-sm" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                    <span className="text-lg">🏆</span>
                    <span className="h-3.5 w-16 rounded-full bg-slate-200" />
                    <span className="ml-auto h-3.5 w-10 rounded-full bg-slate-200" />
                </div>
            ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 backdrop-blur-[2px]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-3xl">🔒</span>
            <p className="text-sm font-black uppercase tracking-wider text-slate-600">Peringkat &amp; Nilai Kelas Dikunci oleh Guru</p>
        </div>
    </div>
);

export default QuizResultTrophyModal;
