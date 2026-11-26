import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Clock, Eye, UploadCloud, RotateCcw, LogOut,
  Lock, AlertTriangle, GraduationCap, Loader2, ZoomIn, ZoomOut, X,
} from 'lucide-react';
import { examSessionAPI, studentAPI, schoolAPI, operatorAPI } from '../../../utils/api';
import schoolLogo from '../../../assets/logos/logo22.png';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import useEscapeKey from '../../../utils/useEscapeKey';
import ConfirmDialog from '../../../components/dashboard/shared/ConfirmDialog';

// ── helper ──────────────────────────────────────────────────────
const fmtClock = (ms) => {
  if (ms == null) return '--:--';
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const RULE_ROWS = (s) => {
  if (!s) return [];
  return [
    { icon: Clock, on: true, label: 'Durasi Ujian', value: `${s.idle_minutes ? '' : ''}`, text: `Soal dikerjakan dalam batas waktu yang ditentukan pengawas.` },
    { icon: RotateCcw, on: s.idle_enabled, label: 'Auto-Logout Saat Inaktif', text: s.idle_enabled ? `Tidak ada aktivitas > ${s.idle_minutes} menit → jawaban tersimpan & keluar otomatis.` : 'Tidak diaktifkan.' },
    { icon: Eye, on: s.tabdetect_enabled, label: 'Deteksi Pindah Tab', text: s.tabdetect_enabled ? `Maksimal ${s.tab_tolerance}× pindah tab; melewati batas akan mengunci sesi.` : 'Tidak diaktifkan.' },
    { icon: Lock, on: s.manual_reentry_enabled, label: 'Kunci Akses Keluar Manual', text: s.manual_reentry_enabled ? 'Keluar saat ujian berlangsung mengunci sesi sampai diizinkan Admin/Pengawas.' : 'Boleh masuk kembali tanpa izin.' },
    { icon: UploadCloud, on: s.offline_local_enabled, label: 'Toleransi Koneksi Putus', text: s.offline_local_enabled ? 'Jawaban sementara disimpan di perangkat ini, tersinkron ulang saat daring pulih.' : 'Tidak diaktifkan.' },
    { icon: ShieldCheck, on: s.session_recovery_enabled, label: 'Pemulihan Sesi', text: s.session_recovery_enabled ? 'Posisi jawaban & sisa waktu dipulihkan dari server bila perangkat bermasalah.' : 'Tidak diaktifkan.' },
  ];
};

const EXAM_TYPE_LABELS = {
  simulasi: 'Simulasi',
  uts: 'UTS',
  uas: 'UAS',
  praktek: 'Ujian Praktik',
  usp: 'Ujian Satuan Pendidikan',
  remedial: 'Susulan / Remedial',
};

// Label jenis ujian utk halaman penutup: pakai `jenis` dari server, fallback ke
// pemetaan `exam_type`, lalu default 'Ujian'.
const examTypeLabel = (s) => {
  const raw = String(s?.jenis || EXAM_TYPE_LABELS[s?.exam_type] || s?.exam_type || '').trim();
  return raw || 'Ujian';
};

// Ucapan terima kasih dinamis: hindari dobel kata "ujian" bila jenis sudah diawali "Ujian".
const thankYouText = (s) => {
  const jenis = examTypeLabel(s);
  return /^ujian\b/i.test(jenis)
    ? `Terima kasih telah menyelesaikan ${jenis} sesi ini.`
    : `Terima kasih telah menyelesaikan ujian ${jenis} sesi ini.`;
};

export default function StudentExamRunner({ session: sessionProp, onClose, onSubmitted, initialToken = '', remoteMode = false, attemptId = null, onRemoteClose }) {
  const [session, setSession] = useState(sessionProp);
  const [remoteStudent, setRemoteStudent] = useState(null);
  const examId = session?.id;
  const localKey = `cbt:attempt:${examId}`;

  const [step, setStep] = useState('loading'); // loading | tata | token | exam | locked | done
  const [settings, setSettings] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [token, setToken] = useState(() => String(initialToken || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8));
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [answers, setAnswers] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // idle|saving|saved|local|offline
  const [remainingMs, setRemainingMs] = useState(null);
  const [lockInfo, setLockInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [activeQ, setActiveQ] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [schoolName, setSchoolName] = useState('SMK Cerdas Satu Bangsa');
  const [starting, setStarting] = useState(false);          // overlay "Memuat ujian…" saat mulai dari tata tertib
  const [ackCountdown, setAckCountdown] = useState(10);     // timer baca aturan (detik) sebelum "Saya Paham" aktif

  // Nama sekolah utk kop layar akhir (sumber DB nyata; fallback = nama brand header).
  useEffect(() => {
    let alive = true;
    schoolAPI.getProfile()
      .then((r) => { const n = r.data?.data?.school_name; if (alive && n) setSchoolName(n); })
      .catch(() => { /* tetap pakai fallback */ });
    return () => { alive = false; };
  }, []);

  // Kontrol kaca pembesar (teks + gambar ikut ter-skala). Default 100%.
  const ZOOM_LEVELS = [60, 80, 100, 120, 140, 160, 180, 200, 250];
  const [zoomIdx, setZoomIdx] = useState(2);
  const zoom = ZOOM_LEVELS[zoomIdx];

  const answersRef = useRef(answers);
  const dirtyRef = useRef({}); // jawaban yang diubah aktor sesi ini (belum disinkron), utk autosave parsial
  const lastActivity = useRef(Date.now());
  const finishedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const autoAckedRef = useRef(false); // penanda auto-advance tata tertib sudah jalan (hindari dobel)
  const nextTimerRef = useRef(null);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Kunci scroll body selama runner terbuka.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Ambil aturan tata tertib (konfigurasi Admin Akademik) saat dibuka.
  useEffect(() => {
    if (remoteMode) { loadRemote(); return undefined; }
    let alive = true;
    examSessionAPI.getStudentExamSettings()
      .then((r) => { if (alive) { setSettings(r.data.data); setStep('tata'); } })
      .catch(() => { if (alive) setStep('tata'); }); // tetap lanjut; aturan tetap ditegakkan server saat mulai
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc: boleh tutup hanya sebelum masuk tata tertib / token / hasil (tata tertib: khusus tombol BATAL).
  // Mode remote memakai tombol "Tutup Remote" sendiri, bukan Esc.
  useEscapeKey(!remoteMode && ['loading', 'token', 'done'].includes(step), () => onClose?.());

  // Timer baca aturan: mulai dari 10 detik saat layar tata tertib terbuka; tombol
  // "Saya Paham" TETAP aktif kapan pun (bisa diklik langsung), tapi kalau dibiarkan,
  // saat hitungan habis (0) otomatis lanjut ke layar soal.
  useEffect(() => {
    if (step !== 'tata' || remoteMode) return undefined;
    autoAckedRef.current = false;
    setAckCountdown(10);
    const id = setInterval(() => setAckCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step, remoteMode]);

  const loadLocal = () => { try { return JSON.parse(localStorage.getItem(localKey) || '{}'); } catch { return {}; } };

  const doStart = async () => {
    if (token.replace(/\s/g, '').length !== 8) return;
    setTokenBusy(true); setTokenError('');
    try {
      const r = await examSessionAPI.startExam({ exam_id: examId, token: token.replace(/\s/g, '').toUpperCase() });
      const data = r.data.data;
      setQuestions(data.questions || []);
      setAttempt(data.attempt);
      if (data.settings) setSettings(data.settings);
      const serverAns = data.attempt?.answers;
      const restored = (serverAns && Object.keys(serverAns).length) ? serverAns : loadLocal();
      setAnswers(restored && typeof restored === 'object' ? restored : {});
      lastActivity.current = Date.now();
      finishedRef.current = false;
      setActiveQ(0);
      setStep('exam');
    } catch (e) {
      const status = e.response?.status;
      const body = e.response?.data;
      if (status === 423 || body?.locked) {
        setLockInfo({ reason: body?.data?.attempt?.lock_reason || 'locked', tab_switches: body?.data?.attempt?.tab_switches });
        setStep('locked');
      } else if (status === 409) {
        setResult({ already: true });
        setStep('done');
      } else {
        setTokenError(body?.message || 'Gagal memulai ujian. Periksa token Anda.');
      }
    } finally {
      setTokenBusy(false);
    }
  };

  // Tombol "Saya Paham" di tata tertib: langsung mulai (token sudah diisi di awal) →
  // tampilkan loading "Memuat ujian…", lewati halaman token. Kalau token belum ada,
  // fallback minta input manual. Bisa diklik kapan pun (tidak menunggu hitungan habis).
  const handleAcknowledge = () => {
    if (starting) return;
    if (token.replace(/\s/g, '').length === 8) {
      setStarting(true);
      Promise.resolve(doStart()).finally(() => setStarting(false));
    } else {
      setStep('token');
    }
  };

  // Auto-advance: kalau hitungan baca aturan habis (0) dan murid belum klik, masuk otomatis.
  useEffect(() => {
    if (step !== 'tata' || remoteMode || starting || ackCountdown > 0) return;
    if (!autoAckedRef.current) {
      autoAckedRef.current = true;
      handleAcknowledge();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ackCountdown, step, remoteMode, starting]);

  // Remote: muat layar ujian peserta (urutan soal & jawaban identik dgn murid).
  const loadRemote = async () => {
    if (!attemptId) return;
    try {
      const r = await operatorAPI.getRemoteAttempt(attemptId);
      const d = r.data.data;
      setSession(d.session);
      setQuestions(d.questions || []);
      setAttempt(d.attempt);
      if (d.settings) setSettings(d.settings);
      setRemoteStudent(d.student || null);
      const serverAns = d.attempt?.answers;
      setAnswers(serverAns && typeof serverAns === 'object' ? serverAns : {});
      if (d.remaining_seconds != null) setRemainingMs(d.remaining_seconds * 1000);
      dirtyRef.current = {};
      finishedRef.current = false;
      lastActivity.current = Date.now();
      setActiveQ(0);
      setStep('exam');
    } catch {
      setStep('loading');
    }
  };

  // Auto-mulai bila token telah diketahui (dialirkan dari panel "Masuk Ruang Ujian").
  useEffect(() => {
    if (initialToken && step === 'token' && !autoStartedRef.current) {
      autoStartedRef.current = true;
      doStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, initialToken]);

  // Timer mundur dari ends_at server (otoritatif; utk pemulihan sesi).
  useEffect(() => {
    if (step !== 'exam' || !attempt?.ends_at) return undefined;
    const end = new Date(attempt.ends_at).getTime();
    const tick = () => {
      const rem = end - Date.now();
      setRemainingMs(rem > 0 ? rem : 0);
      if (rem <= 0 && !finishedRef.current && !remoteMode) { finishedRef.current = true; autoSubmit(); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, attempt]);

  // Gagal autosave: bila server melaporkan attempt terkunci (mis. force logout pengawas) → tutup layar ke status terkunci.
  const onAutosaveFail = (e) => {
    const d = e?.response?.data;
    if (e?.response?.status === 423 || d?.locked) {
      setLockInfo({ reason: d?.data?.attempt?.lock_reason || 'force_logout' });
      setStep('locked');
      return;
    }
    setSaveStatus(navigator.onLine === false ? 'offline' : 'local');
  };

  // Kirim HANYA jawaban yang diubah aktor ini (dirty) → merge di server, lalu tarik
  // server_answers utk sinkron perubahan pihak lain (Operator↔Murid) tanpa saling timpa.
  const flushSync = () => {
    const payload = dirtyRef.current;
    setSaveStatus('saving');
    const call = remoteMode
      ? operatorAPI.remoteSaveAttempt(attemptId, payload)
      : examSessionAPI.autosaveExam(examId, payload);
    call.then((r) => {
      setSaveStatus('saved');
      dirtyRef.current = {};
      const sa = r?.data?.data?.server_answers;
      if (sa && typeof sa === 'object') {
        setAnswers((cur) => {
          let changed = false;
          const next = { ...cur };
          Object.keys(sa).forEach((k) => {
            if (next[k] !== sa[k]) { next[k] = sa[k]; changed = true; }
          });
          return changed ? next : cur;
        });
      }
    }).catch((e) => { if (remoteMode) setSaveStatus('local'); else onAutosaveFail(e); });
  };

  // Auto-save jawaban (localStorage + server) dengan debounce.
  useEffect(() => {
    if (step !== 'exam') return undefined;
    if (!remoteMode) { try { localStorage.setItem(localKey, JSON.stringify(answers)); } catch { /* penuh/ditolak: abaikan */ } }
    const id = setTimeout(flushSync, remoteMode ? 1200 : 3500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, step, examId, localKey]);

  // Sinkron ulang jawaban yang tertahan saat koneksi pulih.
  useEffect(() => {
    if (step !== 'exam' || remoteMode) return undefined;
    const onOnline = () => flushSync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, examId, remoteMode]);

  // Deteksi pindah tab (visibilitychange) → laporkan ke server; bisa memicu kunci.
  useEffect(() => {
    if (remoteMode) return undefined; // sensor anti-cheat dimatikan di browser Operator
    if (step !== 'exam' || !settings?.tabdetect_enabled) return undefined;
    const onVis = () => {
      if (document.hidden) {
        examSessionAPI.reportTabSwitch(examId).then((r) => {
          const d = r.data.data;
          setAttempt((a) => (a ? { ...a, tab_switches: d.tab_switches } : a));
          if (d.locked) { setLockInfo({ reason: 'tab_limit', tab_switches: d.tab_switches }); setStep('locked'); }
        }).catch(() => { /* offline: hitung lokal saja, server menyusul */ });
      } else {
        lastActivity.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [step, settings, examId]);

  // Auto-logout saat inaktif melewati batas.
  useEffect(() => {
    if (remoteMode) return undefined; // auto-logout inaktif dimatikan di browser Operator
    if (step !== 'exam' || !settings?.idle_enabled) return undefined;
    const limit = (settings.idle_minutes || 3) * 60 * 1000;
    const bump = () => { lastActivity.current = Date.now(); };
    const evs = ['mousedown', 'keydown', 'touchstart', 'wheel'];
    evs.forEach((ev) => window.addEventListener(ev, bump));
    const id = setInterval(() => {
      if (Date.now() - lastActivity.current > limit && !finishedRef.current) {
        finishedRef.current = true;
        examSessionAPI.autosaveExam(examId, answersRef.current).catch(() => {});
        examSessionAPI.lockExam(examId, 'idle').then((r) => {
          if (r.data.data?.locked) { setLockInfo({ reason: 'idle' }); setStep('locked'); }
          else onClose?.();
        }).catch(() => onClose?.());
      }
    }, 5000);
    return () => { clearInterval(id); evs.forEach((ev) => window.removeEventListener(ev, bump)); };
  }, [step, settings, examId, onClose]);

  const autoSubmit = async () => {
    if (finishedRef.current && step !== 'exam') return;
    finishedRef.current = true;
    try { await examSessionAPI.autosaveExam(examId, answersRef.current); } catch { /* offline */ }
    try {
      const r = await studentAPI.submitQuiz({ paket_soal_id: session.paket_soal_id, exam_session_id: examId, answers: answersRef.current });
      setResult({ score: r.data?.data?.score, correct: r.data?.data?.correct_answers, total: r.data?.data?.total_questions, showScore: session.show_score, review: r.data?.data?.review || null, auto: true });
      try { localStorage.removeItem(localKey); } catch { /* */ }
      setStep('done');
      onSubmitted?.();
    } catch {
      setStep('done');
      setResult({ auto: true, failed: true });
    }
  };

  const requestExit = () => {
    if (remoteMode) { onRemoteClose?.(); return; } // Operator bebas keluar tanpa mengunci murid
    setConfirmState({
      title: 'Keluar dari Ujian?',
      message: settings?.manual_reentry_enabled
        ? 'Sesuai aturan keamanan, keluar akan MENGUNCI sesi Anda sampai diizinkan masuk kembali oleh Admin/Pengawas. Jawaban terakhir disimpan.'
        : 'Jawaban terakhir akan disimpan. Anda masih bisa masuk kembali selama waktu tersisa.',
      confirmLabel: 'Ya, Keluar', danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        try { await examSessionAPI.autosaveExam(examId, answersRef.current); } catch { /* offline */ }
        const r = await examSessionAPI.lockExam(examId, 'manual_exit').catch(() => null);
        if (r?.data?.data?.locked) { setLockInfo({ reason: 'manual_exit' }); setStep('locked'); }
        else onClose?.();
      },
    });
  };

  const requestSubmit = () => {
    const total = questions.length;
    const done = Object.keys(answersRef.current).filter((k) => answersRef.current[k]).length;
    setConfirmState({
      title: 'Kumpulkan Jawaban?',
      message: `${done} dari ${total} soal telah dijawab. Setelah dikirim, jawaban tidak dapat diubah.`,
      confirmLabel: 'Kirim Sekarang', danger: false, loading: submitting,
      confirmClassName: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25',
      onConfirm: async () => {
        setSubmitting(true);
        try {
          if (remoteMode) {
            await operatorAPI.remoteSubmitAttempt(attemptId, answersRef.current);
            finishedRef.current = true;
            setConfirmState(null);
            setSubmitting(false);
            onRemoteClose?.({ submitted: true });
            return;
          }
          await examSessionAPI.autosaveExam(examId, answersRef.current).catch(() => {});
          const r = await studentAPI.submitQuiz({ paket_soal_id: session.paket_soal_id, exam_session_id: examId, answers: answersRef.current });
          finishedRef.current = true;
          setResult({ score: r.data?.data?.score, correct: r.data?.data?.correct_answers, total: r.data?.data?.total_questions, showScore: session.show_score, review: r.data?.data?.review || null, message: r.data?.data?.message });
          try { localStorage.removeItem(localKey); } catch { /* */ }
          setConfirmState(null);
          setSubmitting(false);
          // Jawaban tersimpan → tampilkan halaman penutup yang sama (identik dgn auto-submit).
          setStep('done');
          onSubmitted?.();
        } catch (e) {
          setConfirmState(null);
          setSubmitError(e.response?.data?.message || 'Gagal mengirim jawaban. Periksa koneksi lalu coba lagi.');
          setSubmitting(false);
        }
      },
    });
  };

  const answeredCount = useMemo(() => Object.keys(answers).filter((k) => answers[k]).length, [answers]);
  const totalQ = questions.length;
  const lowTime = remainingMs != null && remainingMs <= 60000;

  // Pilih jawaban → simpan + auto-pindah ke soal berikutnya (~300ms), kecuali soal terakhir.
  const selectAnswer = (qid, key) => {
    setAnswers((a) => ({ ...a, [qid]: key }));
    dirtyRef.current = { ...dirtyRef.current, [String(qid)]: key };
    lastActivity.current = Date.now();
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(() => {
      setActiveQ((i) => (i < questions.length - 1 ? i + 1 : i));
    }, 300);
  };
  useEffect(() => () => { if (nextTimerRef.current) clearTimeout(nextTimerRef.current); }, []);

  // Tombol `Refresh` → simpan sesi yang baru selesai ke sessionStorage (utk pop-up
  // review pasca-refresh), lalu muat ulang halaman bersih & kembali ke halaman terakhir murid.
  const finishAndReload = () => {
    try {
      sessionStorage.setItem('pending_exam_review', JSON.stringify({
        exam_session_id: examId,
        exam_title: session.nama || '',
        subject_name: session.mapel || '',
      }));
    } catch { /* private mode: abaikan */ }
    window.location.reload();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-50">
      {/* ── OVERLAY MULAI UJIAN (dari tata tertib) ── */}
      {starting && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center gap-2 bg-white text-sm font-black uppercase tracking-widest text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Memuat ujian…
        </div>
      )}

      {/* ── LOADING ── */}
      {step === 'loading' && (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Memuat aturan ujian…
        </div>
      )}

      {/* ── TATA TERTIB ── */}
      {step === 'tata' && (
        <Shell>
          <div className="mx-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-[#0ea5e9] via-[#0284c7] to-[#0369a1] px-7 py-6 text-white">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/70">Persiapan Ujian</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">{session.nama}</h2>
              <p className="mt-1 text-sm font-bold text-white/80">{session.mapel} · {session.target}</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-white p-7">
              <p className="text-sm font-bold text-slate-500">Baca ketentuan berikut. Aturan ini diambil dari konfigurasi keamanan ujian sekolah dan ditegakkan otomatis selama pengerjaan.</p>
              {RULE_ROWS(settings).map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className={`flex items-start gap-3 rounded-2xl border p-4 ${row.on ? 'border-slate-100 bg-slate-50/60' : 'border-slate-100 bg-white opacity-60'}`}>
                    <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${row.on ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800">{row.label}</p>
                      <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">{row.text}</p>
                    </div>
                    <span className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${row.on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{row.on ? 'Aktif' : 'Nonaktif'}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-7 py-4">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Batal</button>
              <button type="button" onClick={handleAcknowledge} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/25 hover:brightness-105 active:scale-95">{ackCountdown > 0 ? `(${ackCountdown}) Saya Paham` : 'Saya Paham'}</button>
            </div>
          </div>
        </Shell>
      )}

      {/* ── TOKEN ── */}
      {step === 'token' && (
        <Shell onClose={onClose} closable>
          <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-blue-600">Verifikasi Sesi</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Masukkan Token Ujian</h2>
                <p className="mt-1 text-sm text-slate-500">Masukkan token 8 karakter dari pengawas.</p>
              </div>
              <ModalCloseControl onClose={onClose} />
            </div>
            <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">{session.nama} · {session.mapel}</p>
            <form onSubmit={(e) => { e.preventDefault(); doStart(); }}>
              <input autoFocus value={token} onChange={(e) => setToken(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8))} maxLength={8} placeholder="Contoh: YB-20OZB" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl font-black uppercase tracking-[0.3em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              {tokenError && <p className="mt-3 text-sm font-bold text-rose-600">{tokenError}</p>}
              <button type="submit" disabled={tokenBusy || token.length !== 8} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{tokenBusy ? 'Memeriksa…' : 'Mulai Mengerjakan'}</button>
            </form>
          </div>
        </Shell>
      )}

      {/* ── RUANG UJIAN ── */}
      {step === 'exam' && (
        <div className="flex h-full flex-col">
          {remoteMode && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-700 px-5 py-2.5 text-white shadow-sm">
              <p className="min-w-0 text-[11px] font-black uppercase tracking-wider sm:text-xs">
                MODE REMOTE — Mengendalikan Ujian: {remoteStudent?.name || '—'} ({remoteStudent?.class_name || '—'}) • Status: {attempt?.status === 'locked' ? 'Terkunci' : 'Mengerjakan'}
              </p>
              <button type="button" onClick={() => onRemoteClose?.()} className="shrink-0 rounded-lg bg-white/15 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider transition hover:bg-white/25">Tutup Remote</button>
            </div>
          )}
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><GraduationCap className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-800">{session.nama}</p>
                <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">{session.mapel} · {session.target}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 px-1 py-1">
                <button type="button" onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} disabled={zoomIdx === 0} aria-label="Perkecil" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><ZoomOut className="h-4 w-4" /></button>
                <span className="min-w-[3.25rem] px-1 py-1 text-center text-[11px] font-black tabular-nums text-slate-700">{zoom}%</span>
                <button type="button" onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))} disabled={zoomIdx === ZOOM_LEVELS.length - 1} aria-label="Perbesar" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><ZoomIn className="h-4 w-4" /></button>
              </div>
              {settings?.tabdetect_enabled && !remoteMode && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600"><Eye className="h-3.5 w-3.5" /> Pindah tab {attempt?.tab_switches || 0}/{settings.tab_tolerance}</span>
              )}
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-black tabular-nums ${lowTime ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'}`}><Clock className="h-4 w-4" /> {fmtClock(remainingMs)}</span>
            </div>
          </header>

          <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
            {/* ── Panel navigasi soal (kiri) ── */}
            <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:w-[272px] md:border-b-0 md:border-r">
              <p className="px-4 pb-2 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Navigasi Soal</p>
              <div className="max-h-[150px] overflow-y-auto px-4 pb-3 pt-4 md:max-h-none md:flex-1">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, i) => {
                    const isAns = Boolean(answers[q.id]);
                    const isActive = i === activeQ;
                    return (
                      <button key={q.id} type="button" onClick={() => setActiveQ(i)} className={`h-10 w-10 rounded-lg text-sm font-black transition-all ${isActive ? 'ring-2 ring-blue-600 ring-offset-2' : ''} ${isAns ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{i + 1}</button>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{answeredCount}/{totalQ} Dijawab</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500" /> Dijawab</span>
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-200" /> Belum</span>
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border-2 border-blue-600" /> Aktif</span>
                </div>
              </div>
            </aside>

            {/* ── Area soal (kanan): kanvas putih penuh, rata kiri ── */}
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="overflow-x-auto px-6 py-6 md:px-10 md:py-8">
                <div style={{ zoom: zoom / 100 }} className="w-full max-w-4xl">
                  {totalQ === 0 ? (
                    <p className="py-16 text-center text-sm font-bold text-slate-400">Belum ada soal pada sesi ini.</p>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-justify text-base font-bold leading-7 text-slate-800">{activeQ + 1}. {questions[activeQ]?.teks}</p>
                      {questions[activeQ]?.gambar && <img src={questions[activeQ].gambar} alt="Ilustrasi soal" className="mt-4 max-h-[60vh] w-auto max-w-full rounded-xl border border-slate-100 object-contain" />}
                      <div className="mt-5 space-y-2.5">
                        {(() => {
                          const q = questions[activeQ] || {};
                          // Union huruf opsi dari teks & gambar; utk soal pilihan-ganda
                          // yang opsinya nihil (mis. pilihan ada di dalam gambar soal),
                          // fallback ke A-E supaya murid tetap bisa memilih.
                          const optKeys = Array.from(new Set([
                            ...Object.keys(q.pilihan || {}),
                            ...Object.keys(q.pilihan_gambar || {}),
                          ]));
                          const keys = optKeys.length ? optKeys : ['A', 'B', 'C', 'D', 'E'];
                          return keys.map((key) => (
                            <label key={key} className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-base transition-all ${answers[q.id] === key ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 hover:bg-slate-50'}`}>
                              <input type="radio" name={`q-${q.id}`} value={key} checked={answers[q.id] === key} onChange={() => selectAnswer(q.id, key)} className="mt-0.5 accent-blue-600" />
                              <span className="min-w-0 flex-1"><b className="mr-1">{key}.</b>{q.pilihan?.[key] || ''}
                                {q.pilihan_gambar?.[key] && (
                                  <img src={q.pilihan_gambar[key]} alt={`Gambar opsi ${key}`} className="mt-2 max-h-40 w-auto max-w-full rounded-lg border border-slate-100 object-contain" />
                                )}
                              </span>
                            </label>
                          ));
                        })()}
                      </div>
                    </>
                  )}
                  {submitError && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{submitError}</p>}
                </div>
              </div>
            </div>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button type="button" onClick={requestExit} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-6 py-3.5 text-sm font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50"><LogOut className="h-5 w-5" /> Keluar</button>
            <button type="button" onClick={requestSubmit} disabled={submitting || totalQ === 0} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-9 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50"><Lock className="h-5 w-5" /> Akhiri Ujian</button>
          </footer>
        </div>
      )}

      {/* ── TERKUNCI ── */}
      {step === 'locked' && (
        <Shell>
          <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Lock className="h-8 w-8" /></div>
            <h2 className="text-xl font-black text-slate-900">Sesi Ujian Terkunci</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
              {lockInfo?.reason === 'tab_limit' && `Anda melewati batas pindah tab (${lockInfo?.tab_switches ?? '-'}×). `}
              {lockInfo?.reason === 'idle' && 'Sesi Anda keluar otomatis karena tidak ada aktivitas. '}
              {lockInfo?.reason === 'manual_exit' && 'Anda keluar dari sesi saat ujian berlangsung. '}
              {lockInfo?.reason === 'force_logout' && 'Pengawas mengeluarkan Anda dari sesi. '}
              Sesuai aturan keamanan, masuk kembali memerlukan izin Admin/Pengawas.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-700"><AlertTriangle className="h-4 w-4" /> Menunggu izin masuk kembali</p>
            <button type="button" onClick={onClose} className="mt-6 w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white hover:bg-slate-900">Tutup</button>
          </div>
        </Shell>
      )}

      {/* ── SELESAI (layar putih penuh, seragam manual & auto-submit) ── */}
      {step === 'done' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 text-center">
          <div className="w-full">
            <div className="mb-8 flex flex-row flex-wrap items-center justify-center gap-x-5 gap-y-3">
              <img src={schoolLogo} alt="Logo Sekolah" className="h-24 w-24 object-contain sm:h-28 sm:w-28" />
              <p className="text-2xl font-black tracking-tight text-slate-800 sm:text-4xl">{schoolName}</p>
            </div>

            <h2 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl lg:text-5xl">{thankYouText(session)}</h2>

            <div className="mt-8 inline-block text-left">
              <p className="text-lg font-bold text-slate-700 sm:text-xl">Mata Pelajaran : {session.mapel || '—'}</p>
              <p className="mt-2 text-lg font-bold text-slate-700 sm:text-xl">
                Nilai &amp; Benar Anda : {result?.showScore
                  ? `${result?.score != null ? result.score : '—'} | ${result?.correct != null && result?.total != null ? `${result.correct}/${result.total}` : '—'}`
                  : 'Disembunyikan Operator'}
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                disabled={!result?.showScore}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                <Eye size={16} /> Pratinjau Soal
              </button>
              <button
                type="button"
                onClick={finishAndReload}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-10 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700 active:scale-95"
              >
                Tutup Sesi
              </button>
            </div>

            {result?.already && <p className="mt-6 text-sm font-semibold text-slate-500">Anda sudah mengumpulkan ujian ini sebelumnya.</p>}
            {result?.failed && <p className="mt-6 text-sm font-semibold text-amber-600">Jawaban dikirim otomatis. Jika ada kendala, hubungi pengawas.</p>}
            {result?.auto && <p className="mt-6 text-xs font-bold uppercase tracking-wider text-amber-600">Dikumpulkan otomatis karena waktu habis.</p>}
          </div>
        </div>
      )}

      {/* ── MODAL PRATINJAU SOAL (koreksi benar/salah; hanya saat show_score ON) ── */}
      {step === 'done' && showPreview && result?.showScore && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Pratinjau Soal</h3>
              <button type="button" onClick={() => setShowPreview(false)} aria-label="Tutup" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
              {questions.map((q, idx) => {
                const rv = (result.review || []).find((item) => String(item.id) === String(q.id));
                const benar = Boolean(rv?.benar);
                return (
                  <div key={q.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800">{idx + 1}. {q.teks}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${benar ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{benar ? 'Benar' : 'Salah'}</span>
                    </div>
                    {q.gambar && <img src={q.gambar} alt="Ilustrasi soal" className="mt-2 max-h-40 rounded-lg border border-slate-100 object-contain" />}
                    <div className="mt-3 space-y-1.5">
                      {(() => {
                        const optKeys = Array.from(new Set([
                          ...Object.keys(q.pilihan || {}),
                          ...Object.keys(q.pilihan_gambar || {}),
                        ]));
                        const keys = optKeys.length ? optKeys : ['A', 'B', 'C', 'D', 'E'];
                        return keys.map((key) => {
                          const isKunci = rv?.kunci && key === rv.kunci;
                          const isJawaban = rv?.jawaban_siswa && key === rv.jawaban_siswa;
                          return (
                            <div key={key} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${isKunci ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-slate-600'} ${isJawaban && !isKunci ? 'bg-rose-50 text-rose-700' : ''}`}>
                              <span className="font-black">{key}.</span>
                              <span className="min-w-0 flex-1">{q.pilihan?.[key] || ''}
                                {q.pilihan_gambar?.[key] && <img src={q.pilihan_gambar[key]} alt={`Opsi ${key}`} className="mt-1 max-h-24 rounded border border-slate-100 object-contain" />}
                              </span>
                              {isKunci && <span className="shrink-0 text-[10px] font-black uppercase text-emerald-600">Kunci</span>}
                              {isJawaban && <span className="shrink-0 text-[10px] font-black uppercase text-slate-400">Jawaban Anda</span>}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setShowPreview(false)} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-blue-700 active:scale-95">Tutup</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>,
    document.body,
  );
}

function Shell({ children, onClose, closable }) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(e) => closable && e.target === e.currentTarget && onClose?.()}>
      {children}
    </div>
  );
}
