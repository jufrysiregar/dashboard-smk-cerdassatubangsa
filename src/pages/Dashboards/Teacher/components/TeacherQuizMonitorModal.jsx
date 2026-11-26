import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    KeyRound, Copy, RefreshCw, Settings2, Check, X as XIcon,
    Users, Clock3, CheckCircle2, Loader2, Save, Award, Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { tugasAPI, BASE_URL } from '../../../../utils/api';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import useEscapeKey from '../../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';

const backdropClass = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-4 overflow-y-auto w-full h-full modal-backdrop-clean no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';
const modalVariants = {
    initial: { scale: 0.96, opacity: 0, y: 10 },
    animate: { scale: 1, opacity: 1, y: 0, transition: { type: 'spring', stiffness: 340, damping: 28 } },
    exit: { scale: 0.96, opacity: 0, y: 10, transition: { duration: 0.15 } },
};

const stateMeta = {
    belum_masuk: { label: 'Belum Masuk', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
    sedang: { label: 'Sedang Mengerjakan', cls: 'bg-amber-100 text-amber-700 ring-amber-200' },
    selesai: { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
};

const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const TeacherQuizMonitorModal = ({ open, onClose, taskId, onChanged }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [grades, setGrades] = useState({});   // submissionKey -> {nilai, feedback}
    const [savingGrade, setSavingGrade] = useState({});

    useBodyScrollLock(open);
    useEscapeKey(open && !editing, onClose);

    const sesi = data?.sesi;
    const isEssay = sesi?.mode_soal === 'esai_pdf';

    const fetchMonitor = useCallback(async () => {
        if (!taskId) return;
        setLoading(true);
        try {
            const res = await tugasAPI.monitor(taskId);
            const payload = res.data?.data ?? res.data;
            setData(payload);
            setEditForm({
                starts_at: payload.sesi?.starts_at ? payload.sesi.starts_at.slice(0, 16) : '',
                deadline_at: payload.sesi?.deadline_at ? payload.sesi.deadline_at.slice(0, 16) : '',
                duration_minutes: payload.sesi?.duration_minutes ?? '',
                bobot: payload.sesi?.bobot ?? 20,
                judul: payload.sesi?.judul ?? '',
                acak_soal: !!payload.sesi?.acak_soal,
                tampilkan_nilai: !!payload.sesi?.tampilkan_nilai,
                izinkan_ketik: !!payload.sesi?.izinkan_ketik,
                izin_upload_foto: !!payload.sesi?.izinkan_upload_foto,
            });
            const seed = {};
            (payload.peserta ?? []).forEach((p) => {
                if (p.submission_id) seed[p.submission_id] = { nilai: p.nilai_esai ?? '', feedback: p.feedback ?? '' };
            });
            setGrades(seed);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Gagal memuat panel kendali sesi.');
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        if (open) fetchMonitor();
        else { setData(null); setEditing(false); }
    }, [open, fetchMonitor]);

    const copyToken = async () => {
        if (!sesi?.token_akses) return;
        try {
            await navigator.clipboard.writeText(sesi.token_akses);
            toast.success('Token disalin.');
        } catch {
            toast.error('Gagal menyalin — salin manual: ' + sesi.token_akses);
        }
    };

    const regenerate = async () => {
        setRegenerating(true);
        try {
            await tugasAPI.regenerateToken(taskId);
            toast.success('Token akses baru dibuat.');
            await fetchMonitor();
            onChanged?.();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Gagal membuat token baru.');
        } finally {
            setRegenerating(false);
        }
    };

    const saveEdit = async () => {
        if (!sesi) return;
        setSavingEdit(true);
        try {
            const fd = new FormData();
            fd.append('_method', 'PUT');
            fd.append('judul', editForm.judul || sesi.judul || 'Sesi');
            fd.append('bobot', editForm.bobot ?? 20);
            if (editForm.starts_at) fd.append('starts_at', editForm.starts_at.replace('T', ' ') + ':00');
            if (editForm.deadline_at) fd.append('deadline_at', editForm.deadline_at.replace('T', ' ') + ':00');
            if (editForm.duration_minutes !== '') fd.append('duration_minutes', editForm.duration_minutes);
            fd.append('acak_soal', editForm.acak_soal ? '1' : '0');
            fd.append('tampilkan_nilai', editForm.tampilkan_nilai ? '1' : '0');
            fd.append('izinkan_ketik', editForm.izinkan_ketik ? '1' : '0');
            fd.append('izinkan_upload_foto', editForm.izin_upload_foto ? '1' : '0');
            await tugasAPI.update(taskId, fd);
            toast.success('Pengaturan sesi diperbarui.');
            setEditing(false);
            await fetchMonitor();
            onChanged?.();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Gagal menyimpan pengaturan.');
        } finally {
            setSavingEdit(false);
        }
    };

    const saveGrade = async (p) => {
        if (!p.submission_id) return;
        const g = grades[p.submission_id] || {};
        if (g.nilai === '' || g.nilai === undefined || Number.isNaN(Number(g.nilai))) {
            toast.error('Masukkan nilai terlebih dahulu.'); return;
        }
        setSavingGrade((prev) => ({ ...prev, [p.submission_id]: true }));
        try {
            await tugasAPI.gradeSubmission(taskId, p.submission_id, {
                nilai: Number(g.nilai),
                feedback: (g.feedback || '').trim() || null,
            });
            toast.success('Koreksi tersimpan & poin diperbarui.');
            await fetchMonitor();
            onChanged?.();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Gagal menyimpan koreksi.');
        } finally {
            setSavingGrade((prev) => ({ ...prev, [p.submission_id]: false }));
        }
    };

    const Toggle = ({ field, label, hint }) => (
        <button type="button" onClick={() => setEditForm((p) => ({ ...p, [field]: !p[field] }))}
            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${editForm?.[field] ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <span>
                <span className="block text-sm font-bold text-slate-700">{label}</span>
                {hint && <span className="block text-xs text-slate-400">{hint}</span>}
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${editForm?.[field] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${editForm?.[field] ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
        </button>
    );

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className={backdropClass} onClick={onClose}>
                    <motion.div {...modalVariants} onClick={(e) => e.stopPropagation()}
                        className="my-auto w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">

                        {/* Header */}
                        <div className="shrink-0 bg-gradient-to-r from-green-700 to-emerald-600 p-5 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Users size={18} /></div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-black uppercase tracking-widest truncate">{sesi?.judul || 'Panel Kendali Sesi'}</h4>
                                    <p className="text-xs text-emerald-100 truncate">{sesi?.mapel || '—'} · {sesi?.kelas || '—'}</p>
                                </div>
                            </div>
                            <ModalCloseControl onClose={onClose} tone="onDark" />
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {loading || !data ? (
                                <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="animate-spin" size={26} /></div>
                            ) : (
                                <div className="p-6 space-y-5">

                                    {/* ── Kendali Header: token + aksi ── */}
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white"><KeyRound size={18} /></div>
                                                <div>
                                                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Token Akses Sesi</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-2xl font-black tracking-[0.3em] text-slate-900 tabular-nums">{sesi.token_akses || '—'}</span>
                                                        {sesi.token_akses && (
                                                            <button type="button" onClick={copyToken} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"><Copy size={12} /> Salin</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {sesi.token_akses && (
                                                    <button type="button" onClick={regenerate} disabled={regenerating}
                                                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                                                        <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} /> Generate Ulang Token
                                                    </button>
                                                )}
                                                <button type="button" onClick={() => setEditing((v) => !v)}
                                                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${editing ? 'bg-slate-200 text-slate-700' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow'}`}>
                                                    <Settings2 size={13} /> {editing ? 'Tutup' : 'Edit Pengaturan Sesi'}
                                                </button>
                                            </div>
                                        </div>

                                        {editing && editForm && (
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <label className="block text-xs font-bold text-slate-600">Waktu Mulai
                                                        <input type="datetime-local" value={editForm.starts_at} onChange={(e) => setEditForm((p) => ({ ...p, starts_at: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                                                    </label>
                                                    <label className="block text-xs font-bold text-slate-600">Deadline (Susulan)
                                                        <input type="datetime-local" value={editForm.deadline_at} onChange={(e) => setEditForm((p) => ({ ...p, deadline_at: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                                                    </label>
                                                    <label className="block text-xs font-bold text-slate-600">Durasi (menit)
                                                        <input type="number" min={1} value={editForm.duration_minutes} onChange={(e) => setEditForm((p) => ({ ...p, duration_minutes: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                                                    </label>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                    <Toggle field="acak_soal" label="Acak Urutan Soal" hint="Urutan soal berbeda tiap murid" />
                                                    <Toggle field="tampilkan_nilai" label="Tampilkan Nilai & Peringkat ke Murid" hint="Skor + trofi muncul setelah selesai" />
                                                    {isEssay && <Toggle field="izinkan_ketik" label="Izinkan Jawaban Ketik Teks" />}
                                                    {isEssay && <Toggle field="izin_upload_foto" label="Izinkan Upload Foto Lembar Kerja" />}
                                                </div>
                                                {isEssay && !editForm.izinkan_ketik && !editForm.izin_upload_foto && (
                                                    <p className="text-xs font-bold text-rose-600">Minimal salah satu metode jawaban harus aktif.</p>
                                                )}
                                                <div className="flex justify-end">
                                                    <button type="button" onClick={saveEdit} disabled={savingEdit}
                                                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-black text-white shadow disabled:opacity-50">
                                                        {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Pengaturan
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Statistik kelas ── */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatChip icon={Users} label="Belum Masuk" value={data.statistik?.belum_masuk ?? 0} cls="from-slate-500 to-slate-700" />
                                        <StatChip icon={Clock3} label="Sedang Mengerjakan" value={data.statistik?.sedang_mengerjakan ?? 0} cls="from-amber-400 to-orange-500" />
                                        <StatChip icon={CheckCircle2} label="Selesai" value={data.statistik?.selesai ?? 0} cls="from-emerald-500 to-teal-600" />
                                    </div>

                                    {/* ── Daftar progres murid ── */}
                                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                                                    <th className="px-4 py-3">Murid</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3">{isEssay ? 'Jawaban Esai' : 'Skor CBT'}</th>
                                                    {isEssay && <th className="px-4 py-3">Koreksi</th>}
                                                    <th className="px-4 py-3 text-center">Poin</th>
                                                    <th className="px-4 py-3 text-center">Total Poin</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {(data.peserta ?? []).map((p) => {
                                                    const meta = stateMeta[p.state] || stateMeta.belum_masuk;
                                                    const g = grades[p.submission_id] || {};
                                                    return (
                                                        <tr key={p.siswa_id} className="align-top hover:bg-emerald-50/20">
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2.5">
                                                                    {p.avatar_path ? (
                                                                        <img src={`${BASE_URL}/storage/${String(p.avatar_path).replace(/^\/+/, '')}`} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200" />
                                                                    ) : (
                                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">{(p.name || '?').slice(0, 1)}</span>
                                                                    )}
                                                                    <div className="min-w-0">
                                                                        <p className="truncate font-semibold text-slate-800">{p.name}</p>
                                                                        <p className="text-xs text-slate-400">{p.nisn || '—'}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${meta.cls}`}>{meta.label}</span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {isEssay ? (
                                                                    <div className="space-y-1.5 max-w-[220px]">
                                                                        {p.jawaban_teks ? <p className="line-clamp-2 text-xs text-slate-600">{p.jawaban_teks}</p> : null}
                                                                        {p.jawaban_foto_url ? (
                                                                            <a href={p.jawaban_foto_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"><ImageIcon size={12} /> Lihat Foto</a>
                                                                        ) : null}
                                                                        {!p.jawaban_teks && !p.jawaban_foto_url ? <span className="text-xs text-slate-400">—</span> : null}
                                                                    </div>
                                                                ) : (
                                                                    <span className="font-black tabular-nums text-slate-800">{p.nilai_cbt != null ? p.nilai_cbt : '—'}</span>
                                                                )}
                                                            </td>
                                                            {isEssay && (
                                                                <td className="px-4 py-3">
                                                                    {p.submission_id ? (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <input type="number" min={0} max={100} value={g.nilai ?? ''} placeholder="Nilai"
                                                                                onChange={(e) => setGrades((prev) => ({ ...prev, [p.submission_id]: { ...g, nilai: e.target.value } }))}
                                                                                className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                                                            <input type="text" value={g.feedback ?? ''} placeholder="Feedback"
                                                                                onChange={(e) => setGrades((prev) => ({ ...prev, [p.submission_id]: { ...g, feedback: e.target.value } }))}
                                                                                className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                                                            <button type="button" onClick={() => saveGrade(p)} disabled={savingGrade[p.submission_id]}
                                                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50" title="Simpan koreksi">
                                                                                {savingGrade[p.submission_id] ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
                                                                            </button>
                                                                        </div>
                                                                    ) : <span className="text-xs text-slate-400">Belum mengerjakan</span>}
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-3 text-center">
                                                                <span className="inline-flex items-center gap-1 font-black tabular-nums text-emerald-600"><Award size={12} /> {p.poin_diperoleh ?? 0}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-bold tabular-nums text-slate-600">{p.total_poin ?? 0}</td>
                                                        </tr>
                                                    );
                                                })}
                                                {(data.peserta ?? []).length === 0 && (
                                                    <tr><td colSpan={isEssay ? 6 : 5} className="px-4 py-12 text-center text-sm text-slate-400">Tidak ada murid di kelas ini.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 border-t border-slate-100 bg-slate-50/95 px-6 py-3.5 flex justify-end">
                            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Tutup</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

const StatChip = ({ icon: Icon, label, value, cls }) => (
    <div className={`rounded-2xl bg-gradient-to-br ${cls} p-3.5 text-white shadow-sm`}>
        <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">{label}</p>
            <Icon size={16} className="text-white/80" />
        </div>
        <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
    </div>
);

export default TeacherQuizMonitorModal;
