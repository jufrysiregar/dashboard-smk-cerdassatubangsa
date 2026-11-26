import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Image as ImageIcon, Loader2, UploadCloud, X } from 'lucide-react';
import { examAPI, teacherAPI } from '../../../../utils/api';

const fieldClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';
const labelClass = 'mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400';

export default function TeacherQuestionPackageModal({ isOpen, onClose, onSuccess }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [format, setFormat] = useState('pilihan_ganda'); // 'pilihan_ganda' | 'esai'
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEsai = format === 'esai';
  const selectedClass = classes.find((item) => String(item.id) === String(classId));
  const subjects = selectedClass?.subjects || [];
  const selectedSubject = subjects.find((item) => String(item.id) === String(subjectId));
  const sizeLabel = useMemo(() => file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '', [file]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    setError('');
    setQuestions([]);
    setFile(null);
    setClassId('');
    setSubjectId('');
    setFormat('pilihan_ganda');
    setTitle('');
    setLoadingClasses(true);
    teacherAPI.getClasses()
      .then((response) => setClasses(response.data?.data || []))
      .catch((fetchError) => setError(fetchError.response?.data?.message || 'Daftar kelas yang Anda ampu gagal dimuat.'))
      .finally(() => setLoadingClasses(false));
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ganti format soal → berkas lama tidak relevan (tipe berbeda), bersihkan.
  const changeFormat = (next) => {
    setFormat(next);
    setFile(null);
    setQuestions([]);
    setError('');
  };

  const chooseFile = (selected) => {
    const next = selected?.[0] || null;
    setFile(next);
    setQuestions([]);
    setError('');
    if (!next) return;
    const ok = isEsai ? next.name.toLowerCase().endsWith('.pdf') : next.name.toLowerCase().endsWith('.docx');
    if (!ok) {
      setFile(null);
      setError(isEsai ? 'Gunakan file PDF (.pdf) lembar soal.' : 'Gunakan dokumen Word (.docx).');
    }
  };

  const parsePreview = async () => {
    if (!file) return setError('Pilih dokumen .docx terlebih dahulu.');
    setParsing(true);
    setError('');
    try {
      const data = new FormData();
      data.append('docx_file', file);
      const response = await examAPI.previewDocx(data);
      setQuestions(response.data?.data?.questions || []);
    } catch (parseError) {
      setError(parseError.response?.data?.message || parseError.response?.data?.errors?.docx_file?.[0] || 'Dokumen gagal dibaca. Periksa format soal dan coba lagi.');
    } finally {
      setParsing(false);
    }
  };

  const savePackage = async () => {
    if (!classId || !subjectId) { setError('Pilih kelas dan mata pelajaran terlebih dahulu.'); return; }
    if (!file) { setError(isEsai ? 'Unggah file PDF lembar soal terlebih dahulu.' : 'Unggah dokumen .docx soal terlebih dahulu.'); return; }
    setSaving(true);
    setError('');
    const data = new FormData();
    data.append('school_class_id', classId);
    data.append('subject', selectedSubject?.name || '');
    data.append('question_format', format);
    if (title.trim()) data.append('title', title.trim());
    data.append(isEsai ? 'pdf_file' : 'docx_file', file);
    try {
      await teacherAPI.createQuestionPackageDocx(data);
      onSuccess?.();
      onClose();
    } catch (saveError) {
      const firstError = Object.values(saveError.response?.data?.errors || {})[0]?.[0];
      setError(firstError || saveError.response?.data?.message || 'Paket soal gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  return createPortal(
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[1200] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950/65 p-3 backdrop-blur-md sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div role="dialog" aria-modal="true" aria-labelledby="teacher-question-title" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]" initial={{ opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.99 }} transition={{ duration: 0.18 }}>
          <header className="flex shrink-0 items-center justify-between bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-6 text-white">
            <h2 id="teacher-question-title" className="text-sm font-black uppercase tracking-[0.14em]">BUAT PAKET BANK SOAL</h2>
            <div className="flex items-center gap-2">
              <kbd className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-black tracking-wider text-blue-100">Esc</kbd>
              <button type="button" onClick={onClose} disabled={saving} aria-label="Tutup (Esc)" className="rounded-full p-2.5 text-white transition-all hover:bg-rose-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40"><X className="h-5 w-5" /></button>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-slate-50/60 p-5 sm:p-7">
            {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

            {/* ── Section 1: Informasi Paket (grid 2×2) ── */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-sm font-black text-white">1</span><div><h3 className="font-black text-slate-800">Informasi paket</h3><p className="text-xs text-slate-500">Pilih kelas dan mapel yang memang Anda ampu.</p></div></div>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className={labelClass}>Kelas Tujuan</span>
                  <select className={fieldClass} value={classId} disabled={loadingClasses} onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }}>
                    <option value="">{loadingClasses ? 'Memuat kelas…' : '— Pilih kelas —'}</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Mata Pelajaran</span>
                  <select className={fieldClass} value={subjectId} disabled={!classId || !subjects.length} onChange={(e) => setSubjectId(e.target.value)}>
                    <option value="">{!classId ? 'Pilih kelas terlebih dahulu' : subjects.length ? '— Pilih mata pelajaran —' : 'Belum ada mapel yang ditugaskan'}</option>
                    {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Format Soal</span>
                  <select className={fieldClass} value={format} onChange={(e) => changeFormat(e.target.value)}>
                    <option value="pilihan_ganda">Pilihan Ganda</option>
                    <option value="esai">Esai</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Judul Paket</span>
                  <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Contoh: ${selectedSubject?.name || 'Latihan Bab 1'}`} />
                </label>
              </div>
            </section>

            {/* ── Section 2: dinamis mengikuti Format Soal ── */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-sm font-black text-white">2</span><div>
                <h3 className="font-black text-slate-800">{isEsai ? 'Lembar Soal Esai (PDF)' : 'Impor soal dari Word'}</h3>
                <p className="text-xs text-slate-500">{isEsai ? 'Unggah PDF lembar soal. Tidak ada parsing butir — murid akan melihat & menjawab langsung dari PDF.' : 'Nomori soal, tulis opsi A–E, lalu tambahkan baris “Kunci: A”. Gambar tertanam ikut dibaca.'}</p>
              </div></div>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 px-5 py-8 text-center transition hover:border-emerald-400 hover:bg-emerald-50">
                <input type="file" accept={isEsai ? '.pdf,application/pdf' : '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'} className="sr-only" onChange={(e) => chooseFile(e.target.files)} />
                {file
                  ? <><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white"><FileText className="h-6 w-6" /></span><span className="mt-3 text-sm font-black text-slate-800">{file.name}</span><span className="mt-1 text-xs text-slate-500">{sizeLabel}</span></>
                  : <><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-emerald-600 shadow-sm"><UploadCloud className="h-6 w-6" /></span><span className="mt-3 text-sm font-black text-slate-800">{isEsai ? 'Pilih atau jatuhkan file PDF (.pdf)' : 'Pilih atau jatuhkan dokumen .docx'}</span><span className="mt-1 text-xs text-slate-500">Maksimal 20 MB</span></>}
              </label>

              {file && !isEsai && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" onClick={parsePreview} disabled={parsing} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60">{parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{parsing ? 'Membaca dokumen…' : 'Pratinjau hasil baca'}</button>
                  <button type="button" onClick={() => chooseFile(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Hapus file</button>
                </div>
              )}
              {file && isEsai && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" onClick={() => chooseFile(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Hapus file</button>
                </div>
              )}

              {!isEsai && questions.length > 0 && (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between"><h4 className="font-black text-slate-800">Pratinjau {questions.length} soal</h4><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Siap disimpan</span></div>
                  {questions.map((question) => (
                    <article key={question.no} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-bold text-slate-800">{question.no}. {question.teks}</p>
                      {question.gambar && <img src={question.gambar} alt={`Ilustrasi soal ${question.no}`} className="mt-3 max-h-52 rounded-xl border border-slate-100 object-contain" />}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(question.pilihan || {}).map(([key, value]) => <p key={key} className={`rounded-xl px-3 py-2 text-xs ${question.kunci === key ? 'bg-emerald-50 font-bold text-emerald-800' : 'bg-slate-50 text-slate-600'}`}><b>{key}.</b> {value || '—'}</p>)}</div>
                      <p className="mt-2 text-[11px] font-bold text-slate-400">{question.gambar ? <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Gambar terdeteksi</span> : 'Tanpa gambar'}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
            <button type="button" onClick={savePackage} disabled={saving || parsing || !file || !classId || !subjectId} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-700 px-6 py-4 text-sm font-black text-white shadow-lg shadow-emerald-700/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Menyimpan paket…' : 'Simpan ke Bank Soal'}</button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
