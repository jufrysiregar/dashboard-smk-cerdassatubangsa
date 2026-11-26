import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  Save,
  Lock,
  CheckCircle2,
  Check,
  Edit3,
  ClipboardList,
  Sparkles,
  RefreshCw,
  Download,
  TrendingUp,
  Users,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { teacherAPI } from '../../../../utils/api';
import { StudentAvatar } from './WaliStudentModal';

const notify = (message, type = 'success') => {
  if (type === 'error') toast.error(message);
  else toast.success(message);
};

// Ambang SERAGAM satu sumber dgn rapor PDF / Admin Akademik / wali kelas: A>=85 B>=75 C>=65.
const getGradeInfo = (nilai) => {
  if (nilai >= 85) return { grade: 'A', predikat: 'Sangat Baik', pill: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200' };
  if (nilai >= 75) return { grade: 'B', predikat: 'Baik', pill: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200' };
  if (nilai >= 65) return { grade: 'C', predikat: 'Cukup', pill: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200' };
  return { grade: 'D', predikat: 'Kurang', pill: 'bg-rose-100 text-rose-800 ring-1 ring-rose-200' };
};

// Cermin persis computeFinal() di NilaiRaporController: bobot null => rumus resmi 60/40.
const computeAkhir = (harian, uts, uas, bobot) => {
  const num = (v) => (typeof v === 'number' ? v : null);
  const h = num(harian);
  const exams = [num(uts), num(uas)].filter((v) => v !== null);
  if (!bobot) {
    if (h !== null && exams.length > 0) {
      return Math.round(((h * 0.6) + ((exams.reduce((a, b) => a + b, 0) / exams.length) * 0.4)) * 100) / 100;
    }
    return h;
  }
  const examWeight = (bobot.pts || 0) + (bobot.pas || 0);
  const parts = [];
  if (h !== null && (bobot.tugas_uh || 0) > 0) parts.push([bobot.tugas_uh, h]);
  if (exams.length > 0 && examWeight > 0) parts.push([examWeight, exams.reduce((a, b) => a + b, 0) / exams.length]);
  if (parts.length === 0) return null;
  const sw = parts.reduce((a, p) => a + p[0], 0);
  return Math.round((parts.reduce((a, p) => a + p[0] * p[1], 0) / sw) * 100) / 100;
};

const inputCls = 'w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm font-bold text-slate-800 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition';

const NilaiRaporTab = ({ clock }) => {
  const [filter, setFilter] = useState({
    kelas_id: '',
    mapel_id: '',
    tahun_ajaran: '',
    semester: ''
  });

  const [options, setOptions] = useState({
    classes: [],
    subjects: [],
    calendars: []
  });

  const tahunAjaranList = [...new Set((options.calendars || []).map(c => c.academic_year))].filter(Boolean);
  const semesterList = [...new Set((options.calendars || [])
    .filter(c => c.academic_year === filter.tahun_ajaran)
    .map(c => (c.semester || '').toLowerCase())
    .filter(Boolean))];

  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [students, setStudents] = useState([]);
  const [konteks, setKonteks] = useState({ bobot: null, bobot_label: '', kkm: null, locked: false });
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [pullingAvg, setPullingAvg] = useState(false);
  const [savingRow, setSavingRow] = useState({});
  const [savedRows, setSavedRows] = useState({});
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('input');

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [classRes, gradeOptRes] = await Promise.all([
        teacherAPI.getClasses(),
        teacherAPI.getGradeOptions()
      ]);

      const allClasses = classRes.data?.data || [];
      const activeCalendars = gradeOptRes.data?.data?.active_calendars || [];

      setOptions(prev => ({
        ...prev,
        classes: allClasses,
        subjects: [],
        calendars: activeCalendars
      }));
    } catch (error) {
      console.error('Failed to fetch options', error);
      toast.error('Gagal memuat pilihan kelas/tahun ajaran');
    }
  };

  const handleKelasChange = async (kelas_id) => {
    setFilter({ kelas_id, mapel_id: '', tahun_ajaran: '', semester: '' });
    setOptions(prev => ({ ...prev, subjects: [] }));
    if (!kelas_id) return;
    setLoadingSubjects(true);
    try {
      const res = await teacherAPI.getSubjectsByClass(kelas_id);
      setOptions(prev => ({ ...prev, subjects: res.data?.data || [] }));
    } catch {
      toast.error('Gagal memuat mata pelajaran kelas ini');
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleApplyFilter = async () => {
    if (!filter.kelas_id || !filter.mapel_id || !filter.tahun_ajaran || !filter.semester) {
      toast.error('Harap lengkapi semua filter terlebih dahulu');
      return;
    }

    setLoadingFilter(true);
    try {
      const gradeRes = await teacherAPI.getGradingStudents(filter);
      const d = gradeRes.data || {};
      setStudents(d.data || []);
      setKonteks({ bobot: d.bobot ?? null, bobot_label: d.bobot_label ?? '', kkm: d.kkm ?? null, locked: Boolean(d.locked) });
      setIsFilterApplied(true);
      toast.success('Data penilaian siswa berhasil dimuat');
    } catch (error) {
      console.error('Failed to fetch data', error);
      toast.error(error?.response?.data?.message || 'Gagal memuat data penilaian');
    } finally {
      setLoadingFilter(false);
    }
  };

  const handleResetFilter = () => {
    setFilter({ kelas_id: '', mapel_id: '', tahun_ajaran: '', semester: '' });
    setOptions(prev => ({ ...prev, subjects: [] }));
    setIsFilterApplied(false);
    setStudents([]);
  };

  const updateStudentGrade = (siswaId, field, rawValue) => {
    setStudents(prev => prev.map(s => {
      if (s.id !== siswaId) return s;
      let val = null;
      if (rawValue !== '' && rawValue !== null && rawValue !== undefined) {
        const parsed = parseFloat(rawValue);
        if (!isNaN(parsed)) val = Math.min(100, Math.max(0, parsed));
      }
      const updated = { ...s, [field]: val };
      updated.akhir = computeAkhir(updated.harian, updated.uts, updated.uas, konteks.bobot);
      return updated;
    }));
  };

  // ── Tarik Rata-Rata Tugas & Kuis (riil: seluruh tugas/kuis terkorreksi kelas+mapel+semester) ──
  const handlePullTaskAverage = async () => {
    if (!filter.kelas_id || !filter.mapel_id) return;
    setPullingAvg(true);
    try {
      const res = await teacherAPI.getTaskAverage({
        kelas_id: filter.kelas_id,
        mapel_id: filter.mapel_id,
        semester: filter.semester,
        tahun_ajaran: filter.tahun_ajaran,
      });
      const rows = res.data?.data || [];
      if (rows.length === 0) {
        notify('Belum ada tugas/kuis terkorreksi untuk kelas & mapel ini.', 'error');
        return;
      }
      const map = new Map(rows.map(r => [r.siswa_id, r.rata]));
      let filled = 0;
      setStudents(prev => prev.map(s => {
        const rata = map.get(s.id);
        if (rata === undefined) return s;
        filled++;
        const updated = { ...s, harian: rata };
        updated.akhir = computeAkhir(updated.harian, updated.uts, updated.uas, konteks.bobot);
        return updated;
      }));
      notify(`Rata-rata tugas & kuis ditarik untuk ${filled} siswa. Periksa lalu tekan Simpan Nilai Rapor.`);
    } catch (error) {
      notify(error?.response?.data?.message || 'Gagal menarik rata-rata tugas.', 'error');
    } finally {
      setPullingAvg(false);
    }
  };

  const buildPayload = (rows) => ({
    kelas_id: filter.kelas_id,
    mapel_id: filter.mapel_id,
    semester: filter.semester,
    tahun_ajaran: filter.tahun_ajaran,
    grades: rows.map(s => ({
      siswa_id: s.id,
      harian: typeof s.harian === 'number' ? s.harian : null,
      uts: typeof s.uts === 'number' ? s.uts : null,
      uas: typeof s.uas === 'number' ? s.uas : null
    }))
  });

  const handleSimpanRapor = async () => {
    if (konteks.locked) return;
    setSavingAll(true);
    try {
      const res = await teacherAPI.saveGrades(buildPayload(students));
      toast.success(res.data?.message || 'Nilai rapor tersimpan & terbaca di wali kelas.');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Gagal menyimpan nilai');
    } finally {
      setSavingAll(false);
    }
  };

  const handleSimpanBaris = async (student) => {
    if (konteks.locked) return;
    setSavingRow(prev => ({ ...prev, [student.id]: true }));
    try {
      await teacherAPI.saveGrades(buildPayload([student]));
      setSavedRows(prev => ({ ...prev, [student.id]: true }));
      setTimeout(() => setSavedRows(prev => ({ ...prev, [student.id]: false })), 2000);
      toast.success(`Nilai ${student.name} berhasil disimpan!`);
    } catch (error) {
      toast.error(error?.response?.data?.message || `Gagal menyimpan nilai ${student.name}`);
    } finally {
      setSavingRow(prev => ({ ...prev, [student.id]: false }));
    }
  };

  const totalStudents = students.length;
  const gradedStudents = students.filter(s => typeof s.akhir === 'number');
  const avgAkhir = gradedStudents.length > 0 ? (gradedStudents.reduce((acc, s) => acc + s.akhir, 0) / gradedStudents.length).toFixed(1) : '—';
  const highestScore = gradedStudents.length > 0 ? Math.max(...gradedStudents.map(s => s.akhir)).toFixed(1) : '—';
  const lowestScore = gradedStudents.length > 0 ? Math.min(...gradedStudents.map(s => s.akhir)).toFixed(1) : '—';
  const kkmValue = typeof konteks.kkm === 'number' ? konteks.kkm : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Modern Filter Card ────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md shadow-emerald-100">
              <Filter size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">Filter Penilaian &amp; Rapor</h3>
              <p className="text-xs text-slate-400">Pilih kelas, mapel, semester, dan tahun ajaran untuk memulai pengolahan nilai</p>
            </div>
          </div>
          {isFilterApplied && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Data Aktif: {students.length} Siswa
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Kelas <span className="text-red-500">*</span>
            </label>
            <select
              value={filter.kelas_id}
              onChange={(e) => handleKelasChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition"
            >
              <option value="">— Pilih Kelas —</option>
              {options.classes.map(c => (
                <option key={c.id} value={c.id}>{c.nama_kelas ?? c.name ?? c.nama}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Mata Pelajaran <span className="text-red-500">*</span>
            </label>
            <select
              value={filter.mapel_id}
              onChange={(e) => setFilter(prev => ({ ...prev, mapel_id: e.target.value, tahun_ajaran: '', semester: '' }))}
              disabled={!filter.kelas_id || loadingSubjects}
              className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition ${!filter.kelas_id || loadingSubjects ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
            >
              <option value="">
                {loadingSubjects ? 'Memuat mapel...' : !filter.kelas_id ? '— Pilih Kelas Terlebih Dahulu —' : '— Pilih Mata Pelajaran —'}
              </option>
              {options.subjects.map(s => (
                <option key={s.id} value={s.id}>{s.nama_mapel ?? s.name ?? s.nama}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Tahun Ajaran <span className="text-red-500">*</span>
            </label>
            <select
              value={filter.tahun_ajaran}
              onChange={(e) => setFilter(prev => ({ ...prev, tahun_ajaran: e.target.value, semester: '' }))}
              disabled={!filter.mapel_id}
              className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition ${!filter.mapel_id ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
            >
              <option value="">
                {!filter.mapel_id ? '— Pilih Mapel Terlebih Dahulu —' : tahunAjaranList.length === 0 ? '— Belum ada tahun ajaran terdaftar —' : '— Pilih Tahun Ajaran —'}
              </option>
              {tahunAjaranList.map(ta => (
                <option key={ta} value={ta}>{ta}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Semester <span className="text-red-500">*</span>
            </label>
            <select
              value={filter.semester}
              onChange={(e) => setFilter(prev => ({ ...prev, semester: e.target.value }))}
              disabled={!filter.tahun_ajaran}
              className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition ${!filter.tahun_ajaran ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
            >
              <option value="">
                {!filter.tahun_ajaran ? '— Pilih Tahun Ajaran Terlebih Dahulu —' : semesterList.length === 0 ? '— Belum ada semester terdaftar —' : '— Pilih Semester —'}
              </option>
              {semesterList.map(sm => (
                <option key={sm} value={sm}>
                  {sm === 'ganjil' ? 'Semester Ganjil' : sm === 'genap' ? 'Semester Genap' : sm.charAt(0).toUpperCase() + sm.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={handleApplyFilter}
            disabled={loadingFilter || !filter.kelas_id || !filter.mapel_id || !filter.tahun_ajaran || !filter.semester}
            className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-200 hover:from-green-600 hover:to-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loadingFilter ? 'Memuat Data...' : 'Terapkan Filter'}
          </button>
          <button
            type="button"
            onClick={handleResetFilter}
            disabled={!filter.kelas_id && !filter.mapel_id && !filter.tahun_ajaran && !filter.semester && !isFilterApplied}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {isFilterApplied && konteks.locked && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3.5">
          <Lock size={18} className="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-black text-rose-700">Terkunci oleh Admin Akademik</p>
            <p className="text-xs font-semibold text-rose-600">Nilai kelas &amp; mapel periode ini sedang dikunci — input dinonaktifkan. Hubungi Admin Akademik untuk membuka kunci.</p>
          </div>
        </div>
      )}

      {isFilterApplied && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
              {[
                { id: 'input', label: 'Input Nilai Siswa', icon: Edit3 },
                { id: 'rekap', label: 'Rekap Nilai Akhir', icon: ClipboardList }
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                      active
                        ? 'bg-gradient-to-r from-green-500 to-emerald-700 text-white shadow-md shadow-emerald-600/20'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeSubTab === 'input' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePullTaskAverage}
                  disabled={pullingAvg || konteks.locked}
                  title={konteks.locked ? 'Nilai terkunci oleh Admin Akademik' : 'Isi kolom Tugas/Harian dari rata-rata SELURUH tugas & kuis terkorreksi (pilihan ganda CBT & esai) pada kelas, mapel, dan semester ini. Angka tetap bisa Anda sesuaikan sebelum Simpan.'}
                  className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {pullingAvg ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                  Tarik Rata-Rata Tugas &amp; Kuis
                </button>
                <button
                  type="button"
                  onClick={handleSimpanRapor}
                  disabled={savingAll || loadingFilter || konteks.locked}
                  title={konteks.locked ? 'Nilai terkunci oleh Admin Akademik' : ''}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-emerald-100 hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {savingAll ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  {savingAll ? 'Menyimpan...' : 'Simpan Nilai Rapor'}
                </button>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Subtab 1: Input Nilai ────────────────────────────── */}
            {activeSubTab === 'input' && (
              <motion.div key="input" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                          <th className="px-4 py-3.5 text-left text-[11px] font-black uppercase tracking-wider text-slate-400 w-12">No</th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-black uppercase tracking-wider text-slate-400 min-w-[200px]">Profil Siswa</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-32">Tugas / Harian</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-28">UTS / PTS</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-28">UAS / PAS</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-emerald-600 w-28">Nilai Akhir</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-40">Predikat &amp; Status KKM</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-28">Simpan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {students.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                              <Users size={28} className="mx-auto mb-2 opacity-30" />
                              Tidak ada siswa terdaftar pada kelas ini.
                            </td>
                          </tr>
                        ) : students.map((student, idx) => {
                          const isSaving = savingRow[student.id];
                          const hasAkhir = typeof student.akhir === 'number';
                          const info = hasAkhir ? getGradeInfo(student.akhir) : null;
                          const tuntas = hasAkhir && kkmValue !== null ? student.akhir >= kkmValue : null;
                          return (
                            <tr key={student.id} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="px-4 py-3 text-xs font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <StudentAvatar avatarPath={student.avatar_path} name={student.name} size="sm" />
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-800">{student.name}</p>
                                    <p className="text-[10px] font-mono text-slate-400">NISN {student.nisn ?? student.nis ?? '—'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number" min={0} max={100} disabled={konteks.locked}
                                  value={typeof student.harian === 'number' && student.harian > 0 ? student.harian : ''}
                                  onChange={(e) => updateStudentGrade(student.id, 'harian', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-50`}
                                  placeholder="—"
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number" min={0} max={100} disabled={konteks.locked}
                                  value={typeof student.uts === 'number' && student.uts > 0 ? student.uts : ''}
                                  onChange={(e) => updateStudentGrade(student.id, 'uts', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-50`}
                                  placeholder="—"
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number" min={0} max={100} disabled={konteks.locked}
                                  value={typeof student.uas === 'number' && student.uas > 0 ? student.uas : ''}
                                  onChange={(e) => updateStudentGrade(student.id, 'uas', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-50`}
                                  placeholder="—"
                                />
                              </td>
                              <td className="px-4 py-3 text-center bg-emerald-50/40">
                                <span className="text-sm font-black text-emerald-700 tabular-nums">
                                  {hasAkhir ? student.akhir.toFixed(1) : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {info ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-black ${info.pill}`}>
                                      {info.grade} · {info.predikat}
                                    </span>
                                    {tuntas !== null && (
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${tuntas ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                        <CheckCircle2 size={10} />
                                        {tuntas ? `Tuntas (KKM ${kkmValue})` : `Belum Tuntas (KKM ${kkmValue})`}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs font-semibold text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleSimpanBaris(student)}
                                  disabled={isSaving || konteks.locked}
                                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                                    savedRows[student.id] ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  }`}
                                >
                                  {isSaving ? (
                                    <RefreshCw size={11} className="animate-spin" />
                                  ) : savedRows[student.id] ? (
                                    <>
                                      <Check size={11} className="stroke-[3]" />
                                      <span>Tersimpan</span>
                                    </>
                                  ) : (
                                    <>
                                      <Save size={11} />
                                      <span>Simpan</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="mt-3 px-1 text-[11px] font-semibold text-slate-400">
                  {konteks.bobot_label || 'Nilai Akhir dihitung otomatis.'} · KKM mapel ini: {kkmValue ?? '—'}
                </p>
              </motion.div>
            )}

            {/* ── Subtab 2: Rekap Nilai Akhir ──────────────────────── */}
            {activeSubTab === 'rekap' && (
              <motion.div key="rekap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Total Siswa</p>
                    <p className="mt-1 text-2xl font-black text-emerald-950">{totalStudents}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wide">Rata-rata Kelas</p>
                    <p className="mt-1 text-2xl font-black text-blue-900">{avgAkhir}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wide">Nilai Tertinggi</p>
                    <p className="mt-1 text-2xl font-black text-emerald-900">{highestScore}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                    <p className="text-xs font-bold text-rose-500 uppercase tracking-wide">Nilai Terendah</p>
                    <p className="mt-1 text-2xl font-black text-rose-900">{lowestScore}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                          <th className="px-4 py-3.5 text-left text-[11px] font-black uppercase tracking-wider text-slate-400 w-12">No</th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">Nama Siswa</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-28">Tugas / Harian</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-24">UTS</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-24">UAS</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-32">Nilai Akhir</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-28">Grade</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-32">Predikat</th>
                          <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-400 w-32">Status KKM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {students.map((student, idx) => {
                          const hasAkhir = typeof student.akhir === 'number';
                          const info = hasAkhir ? getGradeInfo(student.akhir) : null;
                          const tuntas = hasAkhir && kkmValue !== null ? student.akhir >= kkmValue : null;
                          return (
                            <tr key={student.id} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="px-4 py-3 text-xs font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{student.name}</td>
                              <td className="px-4 py-3 text-center text-xs font-mono font-semibold text-slate-600">
                                {typeof student.harian === 'number' ? student.harian.toFixed(1) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center text-xs font-mono font-semibold text-slate-600">
                                {typeof student.uts === 'number' ? student.uts : '—'}
                              </td>
                              <td className="px-4 py-3 text-center text-xs font-mono font-semibold text-slate-600">
                                {typeof student.uas === 'number' ? student.uas : '—'}
                              </td>
                              <td className="px-4 py-3 text-center text-sm font-black text-emerald-700 tabular-nums">
                                {hasAkhir ? student.akhir.toFixed(1) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {info ? (
                                  <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-black ${info.pill}`}>{info.grade}</span>
                                ) : (
                                  <span className="text-xs text-slate-400 font-semibold">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-xs font-semibold text-slate-500">
                                {info ? info.predikat : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {tuntas === null ? (
                                  <span className="text-xs text-slate-400 font-semibold">—</span>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${tuntas ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    <TrendingUp size={10} />
                                    {tuntas ? 'Tuntas' : 'Belum Tuntas'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs font-medium text-emerald-800 flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-600 shrink-0" />
                  <span><strong>Rumus Perhitungan:</strong> {konteks.bobot_label || 'Nilai Akhir = (60% × Tugas/Harian) + (40% × rata-rata UTS & UAS)'} — mengikuti Pengaturan Bobot Nilai Admin Akademik bila aturan aktif terpasang.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default NilaiRaporTab;
