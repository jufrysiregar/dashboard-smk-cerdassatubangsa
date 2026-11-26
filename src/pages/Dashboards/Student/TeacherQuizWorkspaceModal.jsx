import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Clock, Upload, FileText, Image as ImageIcon, Flag, Loader2, ZoomIn, ZoomOut, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { studentAPI } from '../../../utils/api';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import QuizResultTrophyModal from './QuizResultTrophyModal';
import PdfViewer from '../../../components/dashboard/shared/PdfViewer';
import RichEssayEditor from '../../../components/dashboard/shared/RichEssayEditor';

const pad = (n) => String(n).padStart(2, '0');
const mmss = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

// Bersihkan awalan nomor urut ("1.", "66)", "12 - ") dari teks soal — nomor sudah
// tampil di navigasi/grid, jadi teks cukup isinya saja.
const cleanQuestionText = (t) => String(t ?? '').replace(/^\s*\d{1,3}\s*[.)\-]\s+/, '');

// Tingkat kaca pembesar (teks & gambar soal ikut ter-skala). Default 100%.
const ZOOM_LEVELS = [60, 80, 100, 120, 140, 160, 180, 200];

// Ruang pengerjaan KUIS GURU (cbt_docx & esai_pdf) — layar penuh 2 kolom.
// PERBEDAAN TEGAS dijaga: hasil kuis guru tetap memunculkan Skor + Peringkat +
// Trofi/Piagam + Poin Keaktifan (via QuizResultTrophyModal), bukan ujian Operator.
const TeacherQuizWorkspaceModal = ({ open, onClose, session, onDone }) => {
    const isCbt = session?.mode_soal === 'cbt_docx';
    const questions = useMemo(() => session?.questions ?? [], [session]);
    const [current, setCurrent] = useState(0);
    const [answers, setAnswers] = useState({});          // soalId -> letter
    const [doubtful, setDoubtful] = useState({});        // soalId -> bool (Ragu-Ragu)
    const [essayText, setEssayText] = useState('');
    const [essayFile, setEssayFile] = useState(null);
    const [fileError, setFileError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [resultOpen, setResultOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [essayConfirmOpen, setEssayConfirmOpen] = useState(false);
    const [zoomIdx, setZoomIdx] = useState(2);
    const zoom = ZOOM_LEVELS[zoomIdx];
    // Kontrol penampil PDF esai — zoom & jumlah halaman dirender di header hijau.
    const [pdfScale, setPdfScale] = useState(1);
    const [pdfPages, setPdfPages] = useState(0);
    const [saveState, setSaveState] = useState('idle');  // idle|saving|saved

    // JANGKAR waktu dari server: ends_at absolut → timer tak pernah reset saat refresh.
    const endsAtMs = useMemo(() => {
        const parsed = session?.ends_at ? Date.parse(session.ends_at) : NaN;
        return Number.isFinite(parsed) ? parsed : null;
    }, [session]);
    const [remaining, setRemaining] = useState(() => {
        if (endsAtMs != null) return Math.max(0, Math.round((endsAtMs - Date.now()) / 1000));
        return session?.remaining_seconds ?? null;
    });

    const nextTimerRef = useRef(null);
    const saveTimerRef = useRef(null);
    const lastSigRef = useRef(null);
    const autoSubmitRef = useRef(false);
    const essayAutoRef = useRef(false); // force-exit esai saat waktu habis (sekali per sesi)
    // id sesi yang sudah TERKUMPUL — mengunci layar hasil agar tidak pernah balik ke butir soal.
    const submittedSessionIdRef = useRef(null);

    useBodyScrollLock(open);

    const localKey = session?.id ? `cbtQuiz:attempt:${session.id}` : null;
    const readLocal = () => { try { return JSON.parse(localStorage.getItem(localKey || '') || '{}'); } catch { return {}; } };

    // Reset + restore saat sesi berganti. Sisa waktu dari ends_at server; jawaban dari
    // saved_answers (server) yang dimerge fallback localStorage → refresh tak kehilangan.
    useEffect(() => {
        if (!open || !session) return;
        // Terkunci permanen: bila sesi yang sama sudah selesai dikirim, JANGAN pernah
        // reset resultOpen/result — murid tetap di layar hasil, tak kembali ke butir soal
        // (mis. saat parent re-render / objek session dibuat ulang / HMR).
        if (submittedSessionIdRef.current === session.id) return;
        setCurrent(0); setEssayText(''); setEssayFile(null); setFileError('');
        setPdfScale(1); setPdfPages(0);
        setResult(null); setResultOpen(false); setConfirmOpen(false); setEssayConfirmOpen(false); setZoomIdx(2); setSaveState('idle');
        autoSubmitRef.current = false;
        essayAutoRef.current = false;
        submittedSessionIdRef.current = null; // sesi baru → buka kunci
        const parsed = session.ends_at ? Date.parse(session.ends_at) : NaN;
        setRemaining(Number.isFinite(parsed) ? Math.max(0, Math.round((parsed - Date.now()) / 1000)) : (session.remaining_seconds ?? null));

        if (session.mode_soal === 'cbt_docx') {
            const serverAns = (session.saved_answers && typeof session.saved_answers === 'object') ? session.saved_answers : {};
            const local = readLocal();
            const merged = { ...local, ...serverAns };
            delete merged.doubtful;
            setAnswers(merged);
            setDoubtful((local.doubtful && typeof local.doubtful === 'object') ? local.doubtful : {});
            lastSigRef.current = JSON.stringify(merged); // hindari save dobel saat mount
        } else {
            setAnswers({}); setDoubtful({}); lastSigRef.current = null;
            // Resume esai: pulihkan jawaban ketik tersimpan (HTML) dari server bila ada.
            if (typeof session.saved_answers === 'string') setEssayText(session.saved_answers);
        }
    }, [open, session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Countdown berbasis ends_at server → terus maju, tak kembali ke durasi awal.
    useEffect(() => {
        if (!open || endsAtMs == null) return undefined;
        const tick = () => setRemaining(Math.max(0, Math.round((endsAtMs - Date.now()) / 1000)));
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [open, endsAtMs]);

    useEffect(() => () => {
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    }, []);

    const timeUp = endsAtMs != null && remaining != null && remaining <= 0;
    const locked = timeUp || submitting || resultOpen || confirmOpen || essayConfirmOpen;
    const answeredCount = useMemo(() => Object.keys(answers).filter((k) => answers[k]).length, [answers]);

    // Pilih opsi → simpan + auto-pindah ke soal berikutnya (~300ms), kecuali soal terakhir.
    const selectAnswer = (qid, letter) => {
        if (locked) return;
        setAnswers((p) => ({ ...p, [qid]: letter }));
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
        nextTimerRef.current = setTimeout(() => {
            setCurrent((c) => (c < questions.length - 1 ? c + 1 : c));
        }, 300);
    };

    // Auto-save jawaban (debounce ~400ms) → localStorage + endpoint save-progress.
    const answersSig = JSON.stringify(answers);
    useEffect(() => {
        if (!open || !isCbt || !session || !localKey) return undefined;
        try { localStorage.setItem(localKey, JSON.stringify({ ...answers, doubtful })); } catch { /* kuota penuh */ }
        if (locked) return undefined;
        if (answersSig === lastSigRef.current) return undefined;
        lastSigRef.current = answersSig;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            setSaveState('saving');
            studentAPI.saveProgress(session.id, { answers })
                .then(() => setSaveState('saved'))
                .catch(() => setSaveState('idle'));
        }, 400);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [answersSig, doubtful, open, isCbt, session, localKey, locked]); // eslint-disable-line react-hooks/exhaustive-deps

    // Kirim aktual (dipakai tombol konfirmasi & auto-submit). TIDAK memblokir soal kosong —
    // kekosongan sudah diringkas di modal konfirmasi (kondisi B).
    const doSubmit = useCallback(async (isAuto = false) => {
        setConfirmOpen(false);
        setSubmitting(true);
        try {
            const res = await studentAPI.submitCbt(session.id, { answers });
            const data = res.data?.data ?? res.data ?? {};
            setResult({ ...data, auto: !!isAuto });
            setResultOpen(true);
            submittedSessionIdRef.current = session.id; // kunci layar hasil sesi ini
            try { if (localKey) localStorage.removeItem(localKey); } catch { /* */ }
            onDone?.();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Gagal mengirim jawaban.');
        } finally {
            setSubmitting(false);
        }
    }, [answers, session, onDone, localKey]);

    // Klik manual "Kumpulkan Jawaban" → selalu buka 1 modal konfirmasi dinamis (CBT).
    const requestSubmit = useCallback(() => {
        if (locked) return;
        setConfirmOpen(true);
    }, [locked]);

    // Pilih file jawaban esai — validasi klien: ekstensi + ukuran maks 10 MB.
    const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'doc', 'docx'];
    const onPickFile = (e) => {
        const f = e.target.files?.[0] || null;
        setFileError('');
        if (!f) { setEssayFile(null); return; }
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
            setEssayFile(null);
            setFileError('Format tidak didukung. Gunakan PDF, Word (.doc/.docx), atau Foto (.jpg/.jpeg).');
            e.target.value = '';
            return;
        }
        if (f.size > 10 * 1024 * 1024) {
            setEssayFile(null);
            setFileError(`Ukuran file melebihi 10 MB (${(f.size / 1048576).toFixed(1)} MB).`);
            e.target.value = '';
            return;
        }
        setEssayFile(f);
    };

    const submitEssay = useCallback(async (isAuto = false) => {
        const canKetik = !!session.izinkan_ketik;
        const canFoto = !!session.izinkan_upload_foto;
        const fd = new FormData();
        const essayPlain = String(essayText || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        if (canKetik && essayPlain) fd.append('jawaban', essayText);
        if (canFoto && essayFile) fd.append('jawaban_foto', essayFile);
        // Jawaban boleh kosong — backend mencatat submission tetap selesai (200)
        // sehingga layar "Terima kasih" tampil, bukan 422.
        if (isAuto) fd.append('auto_submit', '1');
        setSubmitting(true);
        try {
            const res = await studentAPI.submitEssay(session.id, fd);
            setResult({ ...(res.data?.data ?? res.data ?? {}), auto: !!isAuto });
            setResultOpen(true);
            submittedSessionIdRef.current = session.id; // kunci layar hasil sesi ini
            onDone?.();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Gagal mengirim jawaban.');
        } finally {
            setSubmitting(false);
        }
    }, [session, essayText, essayFile, onDone]);

    // Klik manual "Kirim Sekarang" (esai) → buka modal konfirmasi, BUKAN langsung kirim.
    const requestSubmitEssay = useCallback(() => {
        if (locked) return;
        setEssayConfirmOpen(true);
    }, [locked]);

    // Waktu habis → kunci & KELUARKAN PAKSA: auto-submit jawaban terakhir (walau ada
    // yang belum dijawab), lalu tampilkan hasil. Sekali saja per sesi.
    useEffect(() => {
        if (!open || !isCbt || autoSubmitRef.current || submitting || resultOpen) return;
        if (timeUp) {
            autoSubmitRef.current = true;
            doSubmit(true);
        }
    }, [timeUp, open, isCbt, submitting, resultOpen, doSubmit]);

    // Waktu habis (esai) → auto-submit apa adanya (termasuk jawaban kosong — backend
    // kini menerima) → murid SELALU mendarat di layar "Terima kasih" dari payload server.
    // Sekali saja per sesi.
    useEffect(() => {
        if (!open || isCbt || essayAutoRef.current || submitting || resultOpen) return;
        if (!timeUp) return;
        essayAutoRef.current = true;
        submitEssay(true);
    }, [timeUp, open, isCbt, submitting, resultOpen, submitEssay]);

    if (!open || !session) return null;

    // Setelah terkumpul, kunci layar hasil: hanya trophy yang dirender — butir soal
    // TIDAK mungkin muncul kembali (pratinjau tetap bisa lewat modal trophy sendiri).
    if (result) {
        return createPortal(
            <QuizResultTrophyModal open={resultOpen} onClose={() => { setResultOpen(false); onClose?.(); }} result={result} />,
            document.body,
        );
    }

    const q = questions[current];
    const canKetik = !!session.izinkan_ketik;
    const canFoto = !!session.izinkan_upload_foto;
    const essayMethodsReady = canKetik || canFoto;

    // Data utk modal konfirmasi CBT (dinamis: ragu-ragu vs kosong).
    const doubtNumbers = questions.map((item, i) => (doubtful[item.id] ? i + 1 : null)).filter((n) => n != null);
    const firstDoubtIdx = questions.findIndex((item) => doubtful[item.id]);
    const hasDoubt = doubtNumbers.length > 0;
    const totalQ = questions.length;
    const emptyQ = Math.max(0, totalQ - answeredCount);

    return createPortal(
        <>
            <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-50">
                {/* ── Header penuh (hijau gradiasi) ── */}
                <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-green-700 via-emerald-600 to-teal-600 px-5 py-3 text-white shadow-sm">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                            <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Tugas / Kuis {isCbt ? 'Pilihan Ganda' : 'Esai Guru'}</p>
                            <p className="truncate text-base font-black text-white sm:text-lg">
                                {session.mapel || '—'}{session.target ? ` · ${session.target}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                        {isCbt && (
                            <span className="hidden items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-black tabular-nums sm:inline-flex">
                                {answeredCount}/{questions.length} terjawab
                            </span>
                        )}

                        {/* Peringatan waktu habis (indikator "Menyimpan…/Tersimpan" sengaja dibuang — autosave tetap jalan senyap) */}
                        {isCbt && timeUp && (
                            <span className="inline-flex items-center rounded-xl bg-rose-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                                Waktu habis — keluar otomatis
                            </span>
                        )}

                        {/* Kacamata pembesar (CBT) — perbesar teks & gambar soal */}
                        {isCbt && questions.length > 0 && (
                            <div className="flex items-center gap-0.5 rounded-xl bg-white/15 px-1 py-1">
                                <button type="button" onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} disabled={zoomIdx === 0} aria-label="Perkecil"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"><ZoomOut size={15} /></button>
                                <span className="min-w-[3.25rem] px-1 text-center text-[11px] font-black tabular-nums text-white">{zoom}%</span>
                                <button type="button" onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))} disabled={zoomIdx === ZOOM_LEVELS.length - 1} aria-label="Perbesar"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"><ZoomIn size={15} /></button>
                            </div>
                        )}

                        {/* Kontrol PDF esai: jumlah halaman + zoom (− % +) — hasil render "3 Halaman − 100% + 05:00" */}
                        {!isCbt && (session.soal_pdf_api_url || session.pdf_url) && (
                            <div className="flex items-center gap-1.5">
                                {pdfPages > 0 && (
                                    <span className="hidden rounded-xl bg-white/15 px-3 py-1.5 text-sm font-black tabular-nums sm:inline-flex">
                                        {pdfPages} Halaman
                                    </span>
                                )}
                                <div className="flex items-center gap-0.5 rounded-xl bg-white/15 px-1 py-1">
                                    <button type="button" onClick={() => setPdfScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))} disabled={pdfScale <= 0.5} aria-label="Perkecil"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"><ZoomOut size={15} /></button>
                                    <button type="button" onClick={() => setPdfScale(1)} title="Reset 100%"
                                        className="min-w-[3.25rem] px-1 text-center text-[11px] font-black tabular-nums text-white transition hover:bg-white/15">{Math.round(pdfScale * 100)}%</button>
                                    <button type="button" onClick={() => setPdfScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))} disabled={pdfScale >= 3} aria-label="Perbesar"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"><ZoomIn size={15} /></button>
                                </div>
                            </div>
                        )}

                        {remaining != null && (
                            <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-black tabular-nums ${remaining <= 60 ? 'bg-rose-500 text-white' : 'bg-white/15 text-white'}`}>
                                <Clock size={14} /> {mmss(remaining)}
                            </span>
                        )}
                    </div>
                </header>

                {/* ── Body 2 kolom ── */}
                <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
                    {isCbt ? (
                        <>
                            {/* KIRI: navigasi soal saja (legend pindah ke footer bawah) */}
                            <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:w-[330px] md:border-b-0 md:border-r">
                                <p className="px-5 pb-2 pt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Navigasi Soal</p>
                                <div className="max-h-[180px] overflow-y-auto px-5 py-5 md:max-h-none md:flex-1">
                                    <div className="grid grid-cols-5 gap-2">
                                        {questions.map((item, i) => {
                                            const isAns = Boolean(answers[item.id]);
                                            const isDoubt = Boolean(doubtful[item.id]);
                                            const isActive = i === current;
                                            return (
                                                <button key={item.id} type="button" onClick={() => setCurrent(i)}
                                                    className={`relative flex h-12 w-full items-center justify-center rounded-xl text-lg font-black transition-all ${isActive ? 'ring-2 ring-emerald-600 ring-offset-2' : ''} ${isDoubt ? 'bg-amber-400 text-white' : isAns ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                                    {i + 1}
                                                    {isDoubt && <Flag size={11} className="absolute -right-1 -top-1 fill-white text-white" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </aside>

                            {/* KANAN: kartu soal besar + opsi A–E */}
                            <div className="flex-1 overflow-y-auto bg-white">
                                {questions.length === 0 ? (
                                    <div className="p-10 text-center text-sm font-bold text-slate-400">Tidak ada butir soal untuk sesi ini.</div>
                                ) : (
                                    <div className="w-full px-6 py-4 md:px-10 md:py-6">
                                        {/* Ragu-Ragu — kanan pojok atas, di bawah header */}
                                        <div className="mb-3 flex justify-end">
                                            <button type="button"
                                                disabled={locked}
                                                onClick={() => setDoubtful((p) => ({ ...p, [q.id]: !p[q.id] }))}
                                                className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-bold transition ${doubtful[q.id] ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700'}`}>
                                                <Flag size={15} className={doubtful[q.id] ? 'fill-amber-500 text-amber-500' : ''} />
                                                {doubtful[q.id] ? 'Ditandai Ragu' : 'Ragu-Ragu'}
                                            </button>
                                        </div>
                                        <div style={{ zoom: zoom / 100 }} className="w-full">
                                            <p className="text-justify text-base font-bold leading-7 text-slate-800 whitespace-pre-wrap">
                                                {cleanQuestionText(q.text)}
                                            </p>
                                            {q.image_url && (
                                                <img src={q.image_url} alt="Ilustrasi soal" className="mb-4 mt-3 max-h-[45vh] w-auto max-w-full rounded-xl border border-slate-100 object-contain" />
                                            )}
                                            <div className="mt-5 space-y-2.5">
                                                {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                                                    const hasText = q.options?.[letter] != null && q.options[letter] !== '';
                                                    const img = q.option_images?.[letter];
                                                    if (!hasText && !img) return null;
                                                    const active = answers[q.id] === letter;
                                                    return (
                                                        <button key={letter} type="button" onClick={() => selectAnswer(q.id, letter)} disabled={locked}
                                                            className={`flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left transition ${locked ? 'cursor-not-allowed opacity-60' : ''} ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
                                                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{letter}</span>
                                                            <span className="min-w-0 flex-1">
                                                                {hasText && <span className="block text-justify text-sm font-medium text-slate-700">{q.options[letter]}</span>}
                                                                {img && <img src={img} alt={`Opsi ${letter}`} className="mt-2 max-h-40 w-auto max-w-full rounded-lg border border-slate-100 object-contain" />}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Kiri: PDF soal flush tepat di bawah header hijau — zoom & halaman di header */}
                            <div className="flex min-h-[280px] flex-1 flex-col bg-white md:min-h-0">
                                {(session.soal_pdf_api_url || session.pdf_url) ? (
                                    <PdfViewer apiUrl={session.soal_pdf_api_url} fallbackUrl={session.pdf_url} scale={pdfScale} onNumPagesChange={setPdfPages} />
                                ) : (
                                    <div className="flex flex-1 items-center justify-center p-10 text-center text-sm font-bold text-amber-600">File soal belum tersedia.</div>
                                )}
                            </div>

                            {/* Kanan: metode jawaban + Kumpulkan (timer cukup di header utama) */}
                            <aside className="flex shrink-0 flex-col overflow-y-auto border-t border-slate-200 bg-white md:w-[360px] md:border-t-0 md:border-l">
                                <p className="shrink-0 border-b border-slate-100 px-4 py-3 text-sm font-black uppercase tracking-widest text-slate-800">Masukkan Jawaban Anda</p>
                                <div className="flex flex-1 flex-col gap-4 p-4">
                                {canKetik ? (
                                    <RichEssayEditor key={`essay-${session.id}`} value={essayText} onChange={setEssayText} disabled={locked} placeholder="Tulis jawabanmu di sini..." />
                                ) : null}

                                {canKetik && canFoto ? (
                                    <div className="flex items-center gap-3" aria-hidden="true">
                                        <span className="h-px flex-1 bg-slate-300" />
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Atau</span>
                                        <span className="h-px flex-1 bg-slate-300" />
                                    </div>
                                ) : null}

                                {canFoto ? (
                                    <div>
                                        <input id="esai-file" type="file" accept=".pdf,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={onPickFile} disabled={locked} />
                                        {essayFile ? (
                                            <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
                                                <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-700"><ImageIcon size={14} className="shrink-0 text-emerald-600" /><span className="truncate" title={essayFile.name}>{essayFile.name}</span></span>
                                                <button type="button" onClick={() => { setEssayFile(null); setFileError(''); }} title="Batalkan file" aria-label="Batalkan file"
                                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"><X size={14} /></button>
                                            </div>
                                        ) : session?.saved_foto_url ? (
                                            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-700"><FileText size={14} className="shrink-0 text-slate-500" /><span className="truncate" title={session.saved_file_name || 'file tersimpan'}>{session.saved_file_name || 'File tersimpan'}</span></span>
                                                <label htmlFor="esai-file" className="shrink-0 cursor-pointer rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700 hover:bg-emerald-50">Ganti</label>
                                            </div>
                                        ) : (
                                            <label htmlFor="esai-file" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-5 text-center hover:border-emerald-400 hover:bg-emerald-50/40">
                                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Upload size={20} /></span>
                                                <span className="text-xs font-bold text-slate-700">Klik untuk unggah PDF / Word / Foto</span>
                                                <span className="text-[10px] font-semibold text-slate-400">.pdf, .doc/.docx, .jpg/.jpeg — maks. 10 MB</span>
                                            </label>
                                        )}
                                        {fileError && <p className="mt-1.5 text-xs font-bold text-rose-600">{fileError}</p>}
                                    </div>
                                ) : null}

                                {(!canKetik && !canFoto) && (
                                    <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Guru belum mengizinkan metode jawaban untuk sesi ini.</p>
                                )}

                                <div className="mt-auto">
                                    <button type="button" onClick={requestSubmitEssay} disabled={submitting || !essayMethodsReady}
                                        className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 hover:brightness-105 active:scale-95 disabled:opacity-50 transition-all">
                                            Kirim Sekarang
                                        </button>
                                    </div>
                                </div>
                            </aside>
                        </>
                    )}
                </div>

                {/* ── Footer CBT: legenda di kiri, Kumpulkan Jawaban di kanan ── */}
                {isCbt && (
                    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-3.5">
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-slate-500">
                            <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-emerald-500" /> Dijawab</span>
                            <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-amber-400" /> Ragu</span>
                            <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-slate-100 ring-1 ring-slate-200" /> Belum</span>
                        </div>
                        <button type="button" onClick={requestSubmit} disabled={locked || questions.length === 0}
                            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 hover:brightness-105 active:scale-95 disabled:opacity-50 transition-all">
                            Kumpulkan Jawaban
                        </button>
                    </footer>
                )}
            </div>

            {/* ── MODAL KONFIRMASI KUMPULKAN (CBT, dinamis: ragu-ragu vs kosong) ── */}
            {confirmOpen && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
                >
                    <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className={`px-6 pt-6 ${hasDoubt ? 'bg-amber-50/60' : ''}`}>
                            <div className="flex items-start gap-3">
                                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${hasDoubt ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    {hasDoubt ? <Flag size={20} /> : <FileText size={20} />}
                                </span>
                                <div className="min-w-0">
                                    <h3 className="text-base font-black text-slate-900">
                                        {hasDoubt ? 'Masih Ada Soal yang Ditandai Ragu-Ragu' : 'Kumpulkan Jawaban Sekarang?'}
                                    </h3>
                                    <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-600">
                                        {hasDoubt
                                            ? `Soal nomor ${doubtNumbers.join(', ')} masih kamu tandai ragu-ragu. Apakah kamu yakin ingin mengirim seluruh jawaban ke guru sekarang?`
                                            : emptyQ === 0
                                                ? `Semua soal (${totalQ}/${totalQ}) telah terjawab. Jawaban yang sudah dikirim tidak dapat diubah kembali.`
                                                : `${answeredCount} dari ${totalQ} soal telah terjawab. Masih ada ${emptyQ} soal yang belum dijawab. Jawaban yang sudah dikirim tidak dapat diubah kembali.`}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                            <button
                                type="button"
                                onClick={() => { if (hasDoubt && firstDoubtIdx !== -1) setCurrent(firstDoubtIdx); setConfirmOpen(false); }}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
                            >
                                {hasDoubt ? 'Periksa Kembali' : 'Batal'}
                            </button>
                            <button
                                type="button"
                                onClick={() => doSubmit(false)}
                                disabled={submitting}
                                className={`rounded-xl px-6 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-lg transition active:scale-95 disabled:opacity-60 ${hasDoubt ? 'bg-amber-500 shadow-amber-500/25 hover:bg-amber-600' : 'bg-emerald-600 shadow-emerald-500/25 hover:bg-emerald-700'}`}
                            >
                                {submitting ? 'Mengirim…' : hasDoubt ? 'Ya, Kirim Sekarang' : 'Ya, Kumpulkan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL KONFIRMASI KIRIM ESAI (dinamis: status kelengkapan jawaban) ── */}
            {essayConfirmOpen && (() => {
                const typed = session?.izinkan_ketik && String(essayText || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
                const filed = session?.izinkan_upload_foto && !!essayFile;
                const ready = typed || filed;
                const summary = typed && filed
                    ? 'Jawaban ketik teks sudah diisi dan file lampiran sudah terunggah. Jawaban yang sudah dikirim tidak dapat diubah kembali.'
                    : typed
                        ? 'Jawaban ketik teks sudah diisi. Jawaban yang sudah dikirim tidak dapat diubah kembali.'
                        : filed
                            ? 'File lampiran sudah terunggah. Jawaban yang sudah dikirim tidak dapat diubah kembali.'
                            : 'Jawaban masih kosong. Tulis jawaban atau unggah file terlebih dahulu sebelum mengirim.';
                return (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
                        onMouseDown={(e) => { if (e.target === e.currentTarget) setEssayConfirmOpen(false); }}>
                        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
                            <div className={`px-6 pt-6 ${ready ? '' : 'bg-amber-50/60'}`}>
                                <div className="flex items-start gap-3">
                                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${ready ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                        <FileText size={20} />
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-black text-slate-900">Kirim Jawaban Tugas Esai Sekarang?</h3>
                                        <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-600">{summary}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
                                <button type="button" onClick={() => setEssayConfirmOpen(false)}
                                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50">Batal</button>
                                <button type="button" onClick={() => { setEssayConfirmOpen(false); submitEssay(false); }} disabled={submitting}
                                    className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                                    {submitting ? 'Mengirim…' : 'Ya, Kirim Sekarang'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <QuizResultTrophyModal open={resultOpen} onClose={() => { setResultOpen(false); onClose?.(); }} result={result} />
        </>,
        document.body,
    );
};

export default TeacherQuizWorkspaceModal;
