import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Info } from 'lucide-react';

// Layar Instruksi & Pesan Guru untuk Kuis/Tugas Guru (CBT & Esai). Muncul SETELAH token
// valid (resolveEntry) dan SEBELUM ruang pengerjaan dibuka. Hitung mundur 10 detik;
// tombol "Saya Paham" SELALU aktif (bisa diklik kapan saja), dan otomatis lanjut saat 0.
const TeacherQuizInstructionsModal = ({ open, quiz, onConfirm, onClose }) => {
    const [count, setCount] = useState(10);
    const firedRef = useRef(false);

    useEffect(() => {
        if (!open) return undefined;
        firedRef.current = false;
        setCount(10);
        const id = window.setInterval(() => setCount((c) => (c > 0 ? c - 1 : 0)), 1000);
        return () => window.clearInterval(id);
    }, [open, quiz]);

    const enter = () => {
        if (firedRef.current) return;
        firedRef.current = true;
        onConfirm?.();
    };

    useEffect(() => {
        if (open && count === 0) enter();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, count]);

    if (!open || !quiz) return null;

    const durasi = quiz.duration_minutes ? `${quiz.duration_minutes} menit` : 'Tanpa batas durasi tetap';
    const pesanGuru = (quiz.deskripsi && String(quiz.deskripsi).trim()) ? String(quiz.deskripsi).trim() : '';

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md">
            <div className="my-auto max-h-[92vh] w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
                <div className="flex items-center gap-3 bg-gradient-to-r from-green-700 to-emerald-600 p-5 text-white">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><FileText size={18} /></span>
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Instruksi Pengerjaan</p>
                        <h3 className="truncate text-base font-black">{quiz.nama || 'Tugas / Kuis'}</h3>
                    </div>
                </div>

                <div className="max-h-[calc(92vh-88px)] overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mata Pelajaran</p>
                            <p className="font-bold text-slate-800">{quiz.mapel || '—'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Kelas</p>
                            <p className="font-bold text-slate-800">{quiz.target || '—'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Durasi</p>
                            <p className="font-bold text-slate-800">{durasi}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Jenis</p>
                            <p className="font-bold text-slate-800">{quiz.mode_soal === 'esai_pdf' ? 'Esai (Lembar PDF)' : 'Kuis Pilihan Ganda'}</p>
                        </div>
                    </div>

                    {pesanGuru && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><Info size={12} /> Pesan Guru</p>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{pesanGuru}</p>
                        </div>
                    )}

                    {quiz.resume && (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Melanjutkan sesi yang belum selesai — timer memakai waktu yang tersisa.</p>
                    )}

                    <button type="button" onClick={enter}
                        className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 hover:brightness-105 active:scale-95 transition-all">
                        ({count}) Saya Paham
                    </button>
                </div>
            </div>
        </div>
        , document.body
    );
};

export default TeacherQuizInstructionsModal;
