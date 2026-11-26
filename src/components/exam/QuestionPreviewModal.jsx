import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Image as ImageIcon, Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import { examAPI } from '../../utils/api';

const typeOptions = {
  guru: [
    ['kuis', 'Kuis'],
    ['PR', 'PR'],
    ['praktek', 'Praktek'],
  ],
  admin_akademik: [
    ['SIMULASI', 'Simulasi'],
    ['UTS', 'Ujian Tengah Semester'],
    ['UAS', 'Ujian Akhir Semester'],
    ['UN', 'UN'],
  ],
  operator: [
    ['SIMULASI', 'Simulasi'],
    ['UTS', 'Ujian Tengah Semester'],
    ['UAS', 'Ujian Akhir Semester'],
    ['UN', 'UN'],
  ],
};

const dtLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 16);
};

const fmt = (value) => (value ? new Date(value).toLocaleString('id-ID') : '-');

const packageDraftFrom = (paket) => ({
  title: paket?.title || '',
  subject: paket?.subject || '',
  description: paket?.description || '',
  type: paket?.type || '',
  question_format: paket?.question_format || 'pilihan_ganda',
  delivery_mode: paket?.delivery_mode || 'realtime',
  start_at: dtLocal(paket?.start_at),
  deadline_at: dtLocal(paket?.deadline_at),
  duration_minutes: paket?.duration_minutes || 60,
  show_score: Boolean(paket?.show_score),
  is_active: Boolean(paket?.is_active),
});

const questionDraftFrom = (q, format = 'pilihan_ganda') => ({
  pertanyaan: q?.pertanyaan || '',
  gambar_source: q?.gambar_source || '',
  opsi_a: format === 'pilihan_ganda' ? q?.opsi?.find((i) => i.key === 'A')?.label || '' : '',
  opsi_b: format === 'pilihan_ganda' ? q?.opsi?.find((i) => i.key === 'B')?.label || '' : '',
  opsi_c: format === 'pilihan_ganda' ? q?.opsi?.find((i) => i.key === 'C')?.label || '' : '',
  opsi_d: format === 'pilihan_ganda' ? q?.opsi?.find((i) => i.key === 'D')?.label || '' : '',
  opsi_e: format === 'pilihan_ganda' ? q?.opsi?.find((i) => i.key === 'E')?.label || '' : '',
  kunci_jawaban: format === 'pilihan_ganda' ? q?.kunci_jawaban || 'A' : '',
});

export default function QuestionPreviewModal({
  isOpen,
  onClose,
  paket,
  loading,
  error,
  role = 'guru',
  onPackageChanged,
  onPackageDeleted,
}) {
  const [editingPackage, setEditingPackage] = useState(false);
  const [packageDraft, setPackageDraft] = useState(packageDraftFrom(paket));
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [questionDraft, setQuestionDraft] = useState(questionDraftFrom(null));
  const [savingPackage, setSavingPackage] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setEditingPackage(false);
      setEditingQuestionId(null);
      setPackageDraft(packageDraftFrom(paket));
      setQuestionDraft(questionDraftFrom(null, paket?.question_format));
      setFeedback(null);
    }
  }, [isOpen, paket?.id]);

  useEffect(() => {
    setPackageDraft(packageDraftFrom(paket));
  }, [paket]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  if (!isOpen) return null;

  const isEssay = (paket?.question_format || packageDraft.question_format) === 'esai';
  const isOperator = role === 'operator' || role === 'admin_akademik';
  const manage = role === 'guru' || role === 'admin_akademik';
  const availableTypes = typeOptions[role] || typeOptions.guru;

  const refreshPackage = async () => {
    if (onPackageChanged && paket?.id) await onPackageChanged(paket.id);
  };

  const savePackage = async () => {
    try {
      setSavingPackage(true);
      setFeedback(null);
      const payload = isOperator
        ? { ...packageDraft, delivery_mode: 'realtime', deadline_at: null }
        : packageDraft;
      await examAPI.updatePaketSoal(paket.id, payload);
      setEditingPackage(false);
      setFeedback({ type: 'success', message: 'Paket soal berhasil diperbarui.' });
      await refreshPackage();
    } catch (e) {
      setFeedback({ type: 'error', message: e.response?.data?.message || 'Paket soal gagal diperbarui.' });
    } finally {
      setSavingPackage(false);
    }
  };

  const deletePackage = async () => {
    if (!window.confirm(`Hapus paket soal "${paket.title}"? Semua soal ikut terhapus.`)) return;
    try {
      setDeletingPackage(true);
      await examAPI.deletePaketSoal(paket.id);
      if (onPackageDeleted) await onPackageDeleted();
    } catch (e) {
      setDeletingPackage(false);
      setFeedback({ type: 'error', message: e.response?.data?.message || 'Paket soal gagal dihapus.' });
    }
  };

  const saveQuestion = async (id) => {
    try {
      setSavingQuestion(true);
      setFeedback(null);
      const payload = {
        pertanyaan: questionDraft.pertanyaan,
        gambar_source: questionDraft.gambar_source,
      };
      if (!isEssay) {
        payload.opsi_a = questionDraft.opsi_a;
        payload.opsi_b = questionDraft.opsi_b;
        payload.opsi_c = questionDraft.opsi_c;
        payload.opsi_d = questionDraft.opsi_d;
        payload.opsi_e = questionDraft.opsi_e;
        payload.kunci_jawaban = questionDraft.kunci_jawaban;
      }
      await examAPI.updateQuestion(id, payload);
      setEditingQuestionId(null);
      setFeedback({ type: 'success', message: 'Soal berhasil diperbarui.' });
      await refreshPackage();
    } catch (e) {
      setFeedback({ type: 'error', message: e.response?.data?.message || 'Soal gagal diperbarui.' });
    } finally {
      setSavingQuestion(false);
    }
  };

  const deleteQuestion = async (question) => {
    if (!window.confirm(`Hapus soal nomor ${question.nomor_urut}?`)) return;
    try {
      setDeletingQuestionId(question.id);
      await examAPI.deleteQuestion(question.id);
      setFeedback({ type: 'success', message: 'Soal berhasil dihapus.' });
      await refreshPackage();
    } catch (e) {
      setFeedback({ type: 'error', message: e.response?.data?.message || 'Soal gagal dihapus.' });
    } finally {
      setDeletingQuestionId(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex h-[100dvh] w-screen items-center justify-center overflow-hidden p-3 sm:p-5">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" />
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 24 }} className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-6 py-5">
            <div>
              <div className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700">Preview Paket Soal</div>
              <h3 className="mt-3 text-2xl font-black text-slate-900">{paket?.title || 'Memuat Paket Soal'}</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">{paket?.type_label || 'Membaca isi paket...'}</p>
            </div>
            <button onClick={onClose} className="rounded-full bg-white p-3 text-slate-400 shadow-sm transition-colors hover:bg-rose-50 hover:text-rose-500"><X className="h-5 w-5" /></button>
          </div>

          <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain px-6 py-6">
            {loading && (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-5 rounded-full bg-indigo-50 p-5 text-indigo-600"><Loader2 className="h-8 w-8 animate-spin" /></div>
                <h4 className="text-xl font-black text-slate-800">Membaca Isi Paket</h4>
              </div>
            )}

            {!loading && error && (
              <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-rose-500 shadow-sm"><AlertCircle className="h-7 w-7" /></div>
                <h4 className="text-lg font-black text-rose-700">Preview Gagal Dimuat</h4>
                <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>
              </div>
            )}

            {!loading && !error && paket && (
              <div className="space-y-6">
                {feedback && (
                  <div className={`rounded-[1.5rem] border p-4 ${feedback.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    <p className="text-sm font-black">{feedback.message}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <Info title="Total Soal" value={paket.soals?.length || 0} />
                  <Info title="Mata Pelajaran" value={paket.subject || '-'} />
                  <Info title="Format Soal" value={isEssay ? 'Esai' : 'Pilihan Ganda'} />
                  <Info title="Kode Ujian" value={paket.exam_code || '-'} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <Info title="Mode Waktu" value={paket.delivery_mode === 'deadline' ? 'Tenggat pengumpulan' : 'Mulai saat murid klik mulai'} />
                  <Info title="Mulai Akses" value={fmt(paket.start_at)} />
                  <Info title={paket.delivery_mode === 'deadline' ? 'Tenggat' : 'Durasi'} value={paket.delivery_mode === 'deadline' ? fmt(paket.deadline_at) : `${paket.duration_minutes || 0} menit`} />
                  <Info title="Nilai" value={paket.show_score ? 'Tampil langsung' : 'Disembunyikan'} />
                </div>

                {manage && (
                  <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aksi Paket</p>
                        <h4 className="mt-1 text-lg font-black text-slate-800">Kelola paket soal ini</h4>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => { setEditingPackage((v) => !v); setPackageDraft(packageDraftFrom(paket)); }} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100"><Pencil className="h-4 w-4" /> {editingPackage ? 'Tutup Edit Paket' : 'Edit Paket'}</button>
                        <button type="button" disabled={deletingPackage} onClick={deletePackage} className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-60"><Trash2 className="h-4 w-4" /> {deletingPackage ? 'Menghapus...' : 'Hapus Paket'}</button>
                      </div>
                    </div>

                    {editingPackage ? (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Mata Pelajaran"><input value={packageDraft.subject} onChange={(e) => setPackageDraft({ ...packageDraft, subject: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400" /></Field>
                        <Field label="Kategori"><select value={packageDraft.type} onChange={(e) => setPackageDraft({ ...packageDraft, type: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400">{availableTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                        <Field label="Judul Evaluasi" span><input value={packageDraft.title} onChange={(e) => setPackageDraft({ ...packageDraft, title: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400" /></Field>
                        <Field label="Format Soal"><select value={packageDraft.question_format} onChange={(e) => setPackageDraft({ ...packageDraft, question_format: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400"><option value="pilihan_ganda">Pilihan Ganda</option><option value="esai">Esai</option></select></Field>
                        <Field label="Mode Waktu">{isOperator ? <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800">Realtime</div> : <select value={packageDraft.delivery_mode} onChange={(e) => setPackageDraft({ ...packageDraft, delivery_mode: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400"><option value="realtime">Mulai saat murid klik mulai</option><option value="deadline">Tenggat pengumpulan</option></select>}</Field>
                        <Field label="Mulai Akses"><input type="datetime-local" value={packageDraft.start_at} onChange={(e) => setPackageDraft({ ...packageDraft, start_at: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400" /></Field>
                        {isOperator || packageDraft.delivery_mode !== 'deadline'
                          ? <Field label="Durasi (menit)"><input type="number" min="1" max="600" value={packageDraft.duration_minutes} onChange={(e) => setPackageDraft({ ...packageDraft, duration_minutes: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400" /></Field>
                          : null}
                        {!isOperator && packageDraft.delivery_mode === 'deadline'
                          ? <Field label="Tenggat"><input type="datetime-local" value={packageDraft.deadline_at} onChange={(e) => setPackageDraft({ ...packageDraft, deadline_at: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400" /></Field>
                          : null}
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={packageDraft.show_score} onChange={(e) => setPackageDraft({ ...packageDraft, show_score: e.target.checked })} className="h-4 w-4 accent-indigo-600" />Tampilkan nilai langsung</label>
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={packageDraft.is_active} onChange={(e) => setPackageDraft({ ...packageDraft, is_active: e.target.checked })} className="h-4 w-4 accent-indigo-600" />Paket aktif</label>
                        <Field label="Catatan Paket" span><textarea rows="3" value={packageDraft.description} onChange={(e) => setPackageDraft({ ...packageDraft, description: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400" /></Field>
                        <div className="md:col-span-2 flex gap-3">
                          <button type="button" onClick={savePackage} disabled={savingPackage} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-60"><Save className="h-4 w-4" /> {savingPackage ? 'Menyimpan...' : 'Simpan Paket'}</button>
                          <button type="button" onClick={() => { setEditingPackage(false); setPackageDraft(packageDraftFrom(paket)); }} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-100">Batal</button>
                        </div>
                      </div>
                    ) : paket.description ? (
                      <div className="rounded-[1.25rem] border border-indigo-100 bg-indigo-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Catatan Paket</p>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-indigo-900">{paket.description}</p>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="space-y-5">
                  {paket.soals?.map((question) => {
                    const editing = editingQuestionId === question.id;
                    return (
                      <div key={question.id} className="overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm">
                        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-black text-white">{question.nomor_urut}</div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Question Card</p>
                                <h4 className="text-sm font-black text-slate-800">Soal Nomor {question.nomor_urut}</h4>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {question.gambar_status === 'matched' && <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600"><CheckCircle className="h-3.5 w-3.5" /> Gambar Tersambung</span>}
                              {question.gambar_status === 'missing' && <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600"><AlertCircle className="h-3.5 w-3.5" /> File Gambar Belum Ada</span>}
                              {manage && <>
                                <button type="button" onClick={() => editing ? setEditingQuestionId(null) : (setEditingQuestionId(question.id), setQuestionDraft(questionDraftFrom(question, paket.question_format)))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /> {editing ? 'Tutup Edit' : 'Edit Soal'}</button>
                                <button type="button" disabled={deletingQuestionId === question.id} onClick={() => deleteQuestion(question)} className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-rose-700 disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" /> {deletingQuestionId === question.id ? 'Menghapus...' : 'Hapus Soal'}</button>
                              </>}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-5 p-5">
                          {editing ? (
                            <div className="space-y-4">
                              <Field label="Pertanyaan"><textarea rows="4" value={questionDraft.pertanyaan} onChange={(e) => setQuestionDraft({ ...questionDraft, pertanyaan: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400" /></Field>
                              <Field label="Nama File Gambar"><input value={questionDraft.gambar_source} onChange={(e) => setQuestionDraft({ ...questionDraft, gambar_source: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400" /></Field>
                              {!isEssay && (
                                <>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {['a', 'b', 'c', 'd', 'e'].map((key) => (
                                      <Field key={key} label={`Pilihan ${key.toUpperCase()}`}><textarea rows="2" value={questionDraft[`opsi_${key}`]} onChange={(e) => setQuestionDraft({ ...questionDraft, [`opsi_${key}`]: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400" /></Field>
                                    ))}
                                  </div>
                                  <Field label="Kunci Jawaban"><select value={questionDraft.kunci_jawaban} onChange={(e) => setQuestionDraft({ ...questionDraft, kunci_jawaban: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400">{['A', 'B', 'C', 'D', 'E'].map((i) => <option key={i} value={i}>{i}</option>)}</select></Field>
                                </>
                              )}
                              <div className="flex gap-3">
                                <button type="button" onClick={() => saveQuestion(question.id)} disabled={savingQuestion} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-60"><Save className="h-4 w-4" /> {savingQuestion ? 'Menyimpan...' : 'Simpan Soal'}</button>
                                <button type="button" onClick={() => setEditingQuestionId(null)} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-100">Batal</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-base font-bold leading-relaxed text-slate-800">{question.pertanyaan}</p>
                              {question.has_image && question.image_url && <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50"><img src={question.image_url} alt={`Ilustrasi soal ${question.nomor_urut}`} className="max-h-[320px] w-full object-contain" /></div>}
                              {question.gambar_status === 'missing' && <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><div className="rounded-full bg-white p-2 text-amber-500 shadow-sm"><ImageIcon className="h-4 w-4" /></div><div><p className="text-sm font-black text-amber-700">Nama file tercatat, tetapi gambar belum ditemukan.</p><p className="mt-1 text-xs font-bold uppercase tracking-widest text-amber-600">{question.gambar_source}</p></div></div></div>}
                              {isEssay ? (
                                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Mode Jawaban</p><p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">Paket ini bertipe esai, jadi murid nantinya hanya melihat pertanyaan lalu menulis jawabannya sendiri.</p></div>
                              ) : (
                                <>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{question.opsi?.map((option) => <div key={`${question.id}-${option.key}`} className="rounded-[1.25rem] border border-slate-200 bg-white p-4"><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Pilihan {option.key}</p><p className="mt-1 text-sm font-bold leading-relaxed text-slate-800">{option.label}</p></div>)}</div>
                                  {question.kunci_jawaban && <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3"><p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">Kunci Jawaban</p><p className="mt-1 text-lg font-black text-emerald-700">{question.kunci_jawaban}</p></div>}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function Info({ title, value }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}

function Field({ label, children, span = false }) {
  return (
    <div className={`space-y-2 ${span ? 'md:col-span-2' : ''}`}>
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
      {children}
    </div>
  );
}
