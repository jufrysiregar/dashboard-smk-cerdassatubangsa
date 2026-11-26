import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Eye, Copy, Check, Loader2, Clock, Users, Award, CheckCircle2,
    TrendingUp, FileText,
} from 'lucide-react';
import { tugasAPI, BASE_URL } from '../../../../utils/api';
import ModalCloseControl from '../../../../components/dashboard/shared/ModalCloseControl';
import InlineFilePreviewModal from '../../../../components/dashboard/shared/InlineFilePreviewModal';
import useEscapeKey from '../../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';

const notify = (message, type = 'success') =>
    window.dispatchEvent(new CustomEvent('dashboardToast', { detail: { message, type } }));

const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS_META = {
    belum_masuk: { label: 'Belum Masuk', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
    sedang: { label: 'Sedang Mengerjakan', cls: 'bg-amber-100 text-amber-700 ring-amber-200' },
    dinilai: { label: 'Selesai / Dinilai', cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
    perlu_koreksi: { label: 'Perlu Koreksi', cls: 'bg-orange-100 text-orange-700 ring-orange-200' },
    habis_waktu: { label: 'Selesai', cls: 'bg-slate-200 text-slate-600 ring-slate-300' },
};

const trophyFor = (rank) => (rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);

const Avatar = ({ src, name }) => {
    const [broken, setBroken] = useState(false);
    const initial = (name || '?').trim().slice(0, 1).toUpperCase();
    // avatar_path = path relatif storage (mis. uploads/avatars/ID/xxx.jpg) → butuh prefix.
    const url = src && !/^https?:\/\//i.test(src) ? `${BASE_URL}/storage/${src.replace(/^\/+/, '')}` : src;
    if (!url || broken) {
        return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-500 ring-1 ring-slate-200">{initial}</span>;
    }
    return <img src={url} alt="" onError={() => setBroken(true)} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />;
};

// Modal terpadu "Detail, Pantau & Penilaian" — gabungan Detail + Kelola&Nilai + Pantau
// dalam satu pintu (ikon Mata). Sumber data: GET /teacher/tugas/{id}/monitor (sesi +
// statistik + peserta). Tidak menyentuh modal Edit.
const TugasDetailUnifiedModal = ({ open, task, onClose, onGraded }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all');
    const [drafts, setDrafts] = useState({});   // submission_id -> {nilai, feedback}
    const [saving, setSaving] = useState({});
    const [previewFile, setPreviewFile] = useState(null); // { apiPath, url, name, ext, answerHtml }

    useBodyScrollLock(open);
    useEscapeKey(open && !previewFile, onClose);

    const fetchData = useCallback(async () => {
        if (!task?.id) return;
        setLoading(true);
        try {
            const res = await tugasAPI.monitor(task.id);
            const payload = res.data?.data ?? res.data ?? {};
            setData(payload);
            const seed = {};
            (payload.peserta ?? []).forEach((p) => {
                if (p.submission_id) {
                    const nilai = p.nilai_esai ?? p.nilai_cbt ?? '';
                    seed[p.submission_id] = { nilai: nilai === null ? '' : nilai, feedback: p.feedback ?? '' };
                }
            });
            setDrafts(seed);
        } catch (err) {
            notify(err?.response?.data?.message || 'Gagal memuat detail sesi.', 'error');
        } finally {
            setLoading(false);
        }
    }, [task?.id]);

    useEffect(() => {
        if (open) fetchData();
        else { setData(null); setFilter('all'); }
    }, [open, fetchData]);

    const sesi = data?.sesi || {};
    const isEssay = sesi.mode_soal === 'esai_pdf';
    const peserta = data?.peserta || [];

    // nilai per peserta (esai → nilai_esai, cbt → nilai_cbt), + status turunan.
    const rows = useMemo(() => peserta.map((p) => {
        const nilai = isEssay ? (p.nilai_esai ?? null) : (p.nilai_cbt ?? null);
        let key;
        if (p.state === 'selesai') key = nilai != null ? 'dinilai' : 'perlu_koreksi';
        else key = p.state; // sedang | belum_masuk
        return { ...p, nilai, statusKey: key };
    }), [peserta, isEssay]);

    // Peringkat kelas: dense rank peserta bernilai (nilai desc, waktu kumpul asc).
    const ranked = useMemo(() => {
        const graded = rows.filter((r) => r.nilai != null)
            .sort((a, b) => (b.nilai - a.nilai) || (new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0)));
        const map = {};
        graded.forEach((r, i) => { map[r.siswa_id] = i + 1; });
        return map;
    }, [rows]);

    const sorted = useMemo(() => {
        const order = (r) => {
            const rk = ranked[r.siswa_id];
            if (rk != null) return [0, rk];
            if (r.statusKey === 'perlu_koreksi') return [1, 0];
            if (r.statusKey === 'sedang') return [2, 0];
            return [3, 0]; // belum_masuk
        };
        return [...rows].sort((a, b) => {
            const [ga, ra] = order(a), [gb, rb] = order(b);
            return ga - gb || ra - rb || String(a.name).localeCompare(String(b.name));
        });
    }, [rows, ranked]);

    const filtered = useMemo(() => {
        if (filter === 'all') return sorted;
        if (filter === 'dinilai') return sorted.filter((r) => r.statusKey === 'dinilai' || r.statusKey === 'habis_waktu');
        return sorted.filter((r) => r.statusKey === filter);
    }, [sorted, filter]);

    const nilaiList = rows.map((r) => r.nilai).filter((v) => v != null).map(Number);
    const rata = nilaiList.length ? (nilaiList.reduce((a, b) => a + b, 0) / nilaiList.length).toFixed(1) : '—';
    const tertinggi = nilaiList.length ? Math.max(...nilaiList) : '—';
    const terendah = nilaiList.length ? Math.min(...nilaiList) : '—';
    const belumMasuk = rows.filter((r) => r.statusKey === 'belum_masuk').length;
    const sedang = rows.filter((r) => r.statusKey === 'sedang').length;
    const selesai = rows.filter((r) => r.statusKey === 'dinilai' || r.statusKey === 'perlu_koreksi' || r.statusKey === 'habis_waktu').length;

    const copyToken = async () => {
        if (!sesi.token_akses) return;
        try { await navigator.clipboard.writeText(sesi.token_akses); notify('Token disalin.', 'success'); }
        catch { notify('Salin manual: ' + sesi.token_akses, 'error'); }
    };

    const saveGrade = async (p) => {
        if (!p.submission_id) return;
        const d = drafts[p.submission_id] || {};
        if (d.nilai === '' || d.nilai === undefined || Number.isNaN(Number(d.nilai))) { notify('Masukkan nilai terlebih dahulu.', 'error'); return; }
        setSaving((s) => ({ ...s, [p.submission_id]: true }));
        try {
            await tugasAPI.gradeSubmission(task.id, p.submission_id, { nilai: Number(d.nilai), feedback: (d.feedback || '').trim() || null });
            notify('Penilaian tersimpan.', 'success');
            await fetchData();
            onGraded?.();
        } catch (err) {
            notify(err?.response?.data?.message || 'Gagal menyimpan nilai.', 'error');
        } finally {
            setSaving((s) => ({ ...s, [p.submission_id]: false }));
        }
    };

    const TABS = [
        { id: 'all', label: 'Semua', count: rows.length },
        { id: 'dinilai', label: 'Selesai / Dinilai', count: rows.filter((r) => r.statusKey === 'dinilai' || r.statusKey === 'habis_waktu').length },
        { id: 'perlu_koreksi', label: 'Perlu Koreksi', count: rows.filter((r) => r.statusKey === 'perlu_koreksi').length },
        { id: 'sedang', label: 'Sedang Mengerjakan', count: sedang },
        { id: 'belum_masuk', label: 'Belum Masuk', count: belumMasuk },
    ];

    return createPortal(
        open ? (
            <>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-2xl" onClick={onClose}>
                <div onClick={(e) => e.stopPropagation()}
                    className="my-auto flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">

                    {/* Header */}
                    <div className="shrink-0 bg-gradient-to-r from-green-700 to-emerald-600 p-5 text-white flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Eye size={18} /></div>
                            <div className="min-w-0">
                                <h4 className="truncate text-sm font-black uppercase tracking-widest">{sesi.judul || task?.judul || 'Detail & Penilaian'}</h4>
                                <p className="truncate text-xs text-emerald-100">Detail, Pantau &amp; Penilaian Tugas</p>
                            </div>
                        </div>
                        <ModalCloseControl onClose={onClose} tone="onDark" />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                        {loading || !data ? (
                            <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="animate-spin" size={26} /></div>
                        ) : (
                            <>
                                {/* Info ringkas sesi */}
                                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                                    <Info label="Kelas" value={sesi.kelas || '—'} />
                                    <Info label="Mata Pelajaran" value={sesi.mapel || '—'} />
                                    <Info label="Status" value={<span className="truncate">{task?.display_status || task?.status || '—'}</span>} />
                                    <Info label="Bobot" value={`${sesi.bobot ?? 20}%`} />
                                    <Info label="Waktu Mulai" value={fmtDateTime(sesi.starts_at)} />
                                    <Info label="Deadline" value={fmtDateTime(sesi.deadline_at)} />
                                    <Info label="Durasi" value={sesi.duration_minutes ? `${sesi.duration_minutes} menit` : '—'} />
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Token Akses</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-black tracking-[0.2em] text-slate-800 tabular-nums">{sesi.token_akses || '—'}</span>
                                            {sesi.token_akses && (
                                                <button type="button" onClick={copyToken} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"><Copy size={11} /> Salin</button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {sesi.deskripsi && String(sesi.deskripsi).trim() ? (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Deskripsi &amp; Instruksi</p>
                                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{sesi.deskripsi}</p>
                                    </div>
                                ) : null}

                                {/* Kartu statistik */}
                                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                                    <Stat icon={Users} label="Belum Masuk" value={belumMasuk} cls="from-slate-500 to-slate-700" />
                                    <Stat icon={Clock} label="Sedang Mengerjakan" value={sedang} cls="from-amber-400 to-orange-500" />
                                    <Stat icon={CheckCircle2} label="Selesai / Terkumpul" value={selesai} cls="from-emerald-500 to-teal-600" />
                                    <Stat icon={TrendingUp} label="Rata-Rata Nilai" value={rata} cls="from-violet-500 to-indigo-600" />
                                    <Stat icon={Award} label="Tertinggi / Terendah" value={`${tertinggi} / ${terendah}`} cls="from-rose-500 to-pink-600" small />
                                </div>

                                {/* Tab filter */}
                                <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
                                    {TABS.map((tab) => {
                                        const active = filter === tab.id;
                                        return (
                                            <button key={tab.id} type="button" onClick={() => setFilter(tab.id)}
                                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${active ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                                                {tab.label}
                                                <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Tabel terpadu */}
                                <div className="overflow-hidden rounded-2xl border border-slate-200">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                                                    <th className="px-3 py-3 text-center w-16">Peringkat</th>
                                                    <th className="px-3 py-3">Murid</th>
                                                    <th className="px-3 py-3">Status</th>
                                                    <th className="px-3 py-3">{isEssay ? 'Jawaban / Lampiran' : 'Hasil CBT'}</th>
                                                    <th className="px-3 py-3">Nilai &amp; Feedback</th>
                                                    <th className="px-3 py-3 text-center">Poin</th>
                                                    <th className="px-3 py-3 text-center">Total Poin</th>
                                                    <th className="px-3 py-3 text-center">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {filtered.length === 0 ? (
                                                    <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">Tidak ada murid pada kategori ini.</td></tr>
                                                ) : filtered.map((p) => {
                                                    const meta = STATUS_META[p.statusKey] || STATUS_META.belum_masuk;
                                                    const rank = ranked[p.siswa_id];
                                                    const d = drafts[p.submission_id] || {};
                                                    const canGrade = p.submission_id && (p.statusKey === 'dinilai' || p.statusKey === 'perlu_koreksi' || p.statusKey === 'habis_waktu');
                                                    // Dirty-check per baris: bandingkan draft vs nilai/feedback tersimpan di server.
                                                    const savedNilai = p.nilai != null ? String(p.nilai) : '';
                                                    const savedFeedback = p.feedback ?? '';
                                                    const curNilai = d.nilai != null && d.nilai !== '' ? String(d.nilai) : '';
                                                    const curFeedback = d.feedback ?? '';
                                                    const isDirty = canGrade && (curNilai !== savedNilai || curFeedback !== savedFeedback);
                                                    const hasSaved = savedNilai !== '';
                                                    const hasAnswer = !!(p.jawaban_teks && String(p.jawaban_teks).replace(/<[^>]*>/g, '').trim()) || !!p.jawaban_foto_url;
                                                    return (
                                                        <tr key={p.siswa_id} className="align-top hover:bg-emerald-50/20">
                                                            <td className="px-3 py-3 text-center">
                                                                {rank != null ? (
                                                                    <span className="inline-flex items-center gap-1 text-sm font-black text-slate-700">{trophyFor(rank) || <span className="text-slate-400">#{rank}</span>}</span>
                                                                ) : <span className="text-slate-300">—</span>}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <div className="flex items-center gap-2.5">
                                                                    <Avatar src={p.avatar_path} name={p.name} />
                                                                    <div className="min-w-0">
                                                                        <p className="truncate font-semibold text-slate-800">{p.name}</p>
                                                                        <p className="text-[11px] font-mono text-slate-400">NISN {p.nisn || '—'}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${meta.cls}`}>{meta.label}</span>
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {isEssay ? (
                                                                 <div className="max-w-[210px] space-y-1.5">
                                                                     {hasAnswer ? (
                                                                         <button type="button" onClick={() => setPreviewFile({ apiPath: p.jawaban_file_api_url || '', url: p.jawaban_foto_url || '', name: p.jawaban_file_name || 'jawaban', ext: p.jawaban_file_ext, answerHtml: p.jawaban_teks || '' })} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"><Eye size={12} /> Lihat Jawaban</button>
                                                                     ) : <span className="text-xs text-slate-400">{p.statusKey === 'sedang' ? 'Menunggu jawaban' : '—'}</span>}
                                                                 </div>
                                                                ) : (
                                                                    <span className="text-xs font-semibold text-slate-600">{p.nilai != null ? `Skor otomatis: ${p.nilai}` : (p.state === 'selesai' ? 'Terkumpul' : '—')}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                {canGrade ? (
                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                        <input type="number" min={0} max={100} value={d.nilai ?? ''} placeholder="Nilai"
                                                                            onChange={(e) => setDrafts((prev) => ({ ...prev, [p.submission_id]: { ...d, nilai: e.target.value } }))}
                                                                            className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                                                        <input type="text" value={d.feedback ?? ''} placeholder="Feedback"
                                                                            onChange={(e) => setDrafts((prev) => ({ ...prev, [p.submission_id]: { ...d, feedback: e.target.value } }))}
                                                                            className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                                                    </div>
                                                                ) : <span className="text-xs text-slate-400">—</span>}
                                                            </td>
                                                            <td className="px-3 py-3 text-center">
                                                                <span className="inline-flex items-center gap-1 font-black tabular-nums text-emerald-600"><Award size={12} /> {p.poin_diperoleh ?? 0}</span>
                                                            </td>
                                                            <td className="px-3 py-3 text-center font-bold tabular-nums text-slate-600">{p.total_poin ?? 0}</td>
                                                            <td className="px-3 py-3 text-center">
                                                                {canGrade ? (
                                                                    <button type="button" onClick={() => saveGrade(p)} disabled={!isDirty || saving[p.submission_id]}
                                                                        title={!isDirty ? (hasSaved ? 'Sudah tersimpan' : 'Belum ada perubahan') : 'Simpan penilaian murid ini'}
                                                                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${
                                                                            !isDirty
                                                                                ? (hasSaved
                                                                                    ? 'cursor-default bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
                                                                                    : 'cursor-not-allowed bg-slate-100 text-slate-400')
                                                                                : 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-600 active:scale-95'
                                                                        }`}>
                                                                        {saving[p.submission_id]
                                                                            ? <><Loader2 size={13} className="animate-spin" /> Menyimpan…</>
                                                                            : (!isDirty && hasSaved)
                                                                                ? <><Check size={13} /> Tersimpan</>
                                                                                : <><Check size={13} /> Simpan</>}
                                                                    </button>
                                                                ) : <span className="text-xs text-slate-400">—</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="shrink-0 border-t border-slate-100 bg-slate-50/95 px-6 py-3.5 flex justify-end">
                        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Tutup</button>
                    </div>
                </div>
            </div>
            <InlineFilePreviewModal open={!!previewFile} file={previewFile} onClose={() => setPreviewFile(null)} />
            </>
        ) : null,
        document.body,
    );
};

const Info = ({ label, value }) => (
    <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <div className="text-sm font-semibold text-slate-700">{value}</div>
    </div>
);

const Stat = ({ icon: Icon, label, value, cls, small }) => (
    <div className={`rounded-2xl bg-gradient-to-br ${cls} p-3.5 text-white shadow-sm`}>
        <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">{label}</p>
            <Icon size={15} className="text-white/80" />
        </div>
        <p className={`mt-1 font-black tabular-nums ${small ? 'text-lg' : 'text-2xl'}`}>{value}</p>
    </div>
);

export default TugasDetailUnifiedModal;
