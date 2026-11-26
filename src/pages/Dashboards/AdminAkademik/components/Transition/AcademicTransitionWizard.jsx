import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { adminAkademikAPI, calendarAPI } from '../../../../../utils/api';

const STEPS = ['Pilih TA', 'Pratinjau Kelulusan', 'Ringkasan Dampak', 'Konfirmasi'];

const AcademicTransitionWizard = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [terms, setTerms] = useState([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [preview, setPreview] = useState(null);
  const [excluded, setExcluded] = useState({}); // student_id -> true (tinggal kelas)
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    calendarAPI.listTerms()
      .then(({ data }) => setTerms(Array.isArray(data?.data) ? data.data : []))
      .catch(() => toast.error('Gagal memuat daftar tahun ajaran.'));
  }, []);

  const buildPayload = () => ({
    source_calendar_id: Number(sourceId),
    target_calendar_id: Number(targetId),
    retained_student_ids: Object.entries(excluded).filter(([, v]) => v).map(([k]) => Number(k)),
  });

  const runPreview = async () => {
    setLoadingPreview(true);
    try {
      const { data } = await adminAkademikAPI.previewAcademicTransition(buildPayload());
      setPreview(data?.data ?? null);
      setStep(1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Pratinjau transisi gagal dimuat.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const runExecute = async () => {
    setExecuting(true);
    try {
      const { data } = await adminAkademikAPI.executeAcademicTransition({ ...buildPayload(), confirm: true });
      setResult(data?.data ?? {});
      onDone?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Transisi tahun ajaran gagal dijalankan.');
    } finally {
      setExecuting(false);
    }
  };

  const canPreview = sourceId && targetId && sourceId !== targetId;

  return (
    <section className="space-y-6">
      {/* Stepper header */}
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
              i === step ? 'bg-gradient-to-r from-emerald-500 to-emerald-700 text-white shadow-md' : i < step ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
            }`}>
            {i < step ? <CheckCircle2 size={14} /> : <span>{i + 1}</span>} {label}
          </li>
        ))}
      </ol>

      {/* STEP 1: pilih TA */}
      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">TA Asal (akan diarsipkan)</span>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold">
              <option value="">Pilih TA asal</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.academic_year} · {t.semester} · {labelStatus(t)}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">TA Tujuan (akan aktif)</span>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold">
              <option value="">Pilih TA tujuan</option>
              {terms.filter((t) => String(t.id) !== String(sourceId)).map((t) => <option key={t.id} value={t.id}>{t.academic_year} · {t.semester} · {labelStatus(t)}</option>)}
            </select>
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button disabled={!canPreview || loadingPreview} onClick={runPreview}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-md disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none">
              {loadingPreview && <Loader2 size={14} className="animate-spin" />} Lanjut Pratinjau <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: pratinjau kelulusan + checklist tinggal kelas */}
      {step === 1 && preview && (
        <div className="space-y-5">
          <Info label="Akan lulus (Kelas XII)" value={preview.graduating?.count ?? 0} tone="emerald" />
          <div className="grid gap-4 md:grid-cols-2">
            <PromotionSummary label="Kelas XI → XII" data={preview.promotions?.XI_to_XII} />
            <PromotionSummary label="Kelas X → XI" data={preview.promotions?.X_to_XI} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Pengecualian — centang siswa yang tinggal kelas / tidak lulus
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {combineRoster(preview).length === 0 && <p className="text-xs text-slate-400 italic">Tidak ada siswa pada data pratinjau.</p>}
              {combineRoster(preview).map((s) => (
                <label key={s.student_id} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50">
                  <span className="text-sm font-semibold text-slate-700">
                    {s.student_id} · {s.jurusan_nama || s.jurusan_id || '—'}
                  </span>
                  <input type="checkbox" checked={!!excluded[s.student_id]} onChange={(e) => setExcluded((prev) => ({ ...prev, [s.student_id]: e.target.checked }))} />
                </label>
              ))}
            </div>
          </div>

          <NavButtons onBack={() => setStep(0)} onNext={() => setStep(2)} />
        </div>
      )}

      {/* STEP 3: ringkasan dampak */}
      {step === 2 && preview && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Lulus ke arsip alumni" value={preview.graduating?.count ?? 0} tone="emerald" />
            <Info label="Naik XI → XII" value={preview.promotions?.XI_to_XII?.count ?? 0} tone="indigo" />
            <Info label="Naik X → XI" value={preview.promotions?.X_to_XI?.count ?? 0} tone="indigo" />
            <Info label="Rombel Kelas X baru (kosong)" value="Kosong total" tone="sky" />
            <Info label="Reset jadwal & wali kelas" value="Dibersihkan" tone="amber" />
            <Info label="Sisa pengecualian tinggal kelas" value={Object.values(excluded).filter(Boolean).length} tone="rose" />
          </div>
          <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Konfirmasi" />
        </div>
      )}

      {/* STEP 4: konfirmasi + eksekusi */}
      {step === 3 && preview && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
            <AlertTriangle size={22} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm font-bold leading-relaxed text-amber-900">
              Transisi akan mengunci arsip TA asal, meluluskan Kelas XII ke arsip alumni (masa portal 6 bulan),
              menaikkan Kohor, dan mereset plotting/jadwal/wali di TA tujuan. Proses ini atomik — gagal satu tahap,
              seluruh transisi dibatalkan. Tindakan ini tidak dapat dibatalkan setelah selesai.
            </p>
          </div>

          {!result ? (
            <button disabled={executing} onClick={runExecute}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white disabled:bg-slate-200">
              {executing ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
              {executing ? 'Memproses transisi…' : 'Jalankan Transisi Sekarang'}
            </button>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-black text-emerald-800"><CheckCircle2 size={18} /> Transisi selesai.</p>
              <pre className="overflow-x-auto rounded-lg bg-white/70 p-3 text-[11px] text-emerald-900">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const labelStatus = (t) => ({ active: 'Aktif', draft: 'Draft', archived: 'Arsip' }[t.status] || t.status || '—');
const combineRoster = (p) => [...(p.graduating?.students || []), ...(p.promotions?.XI_to_XII?.students || []), ...(p.promotions?.X_to_XI?.students || [])];

function Info({ label, value, tone = 'indigo' }) {
  const tones = { emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200', indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200', sky: 'bg-sky-50 text-sky-700 border-sky-200', amber: 'bg-amber-50 text-amber-700 border-amber-200', rose: 'bg-rose-50 text-rose-700 border-rose-200' };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.indigo}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function PromotionSummary({ label, data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-800">{data?.count ?? 0} siswa</p>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel = 'Lanjut' }) {
  return (
    <div className="flex justify-between">
      <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600"><ArrowLeft size={14} /> Kembali</button>
      <button onClick={onNext} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-md">{nextLabel} <ArrowRight size={14} /></button>
    </div>
  );
}

export default AcademicTransitionWizard;
