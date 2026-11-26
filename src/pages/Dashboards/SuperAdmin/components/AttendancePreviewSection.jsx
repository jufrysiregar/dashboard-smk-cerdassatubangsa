import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, CheckCircle, Calendar, Search, AlertCircle, Upload, Save, Trash2
} from 'lucide-react';

/* ─── Status config (same as AttendanceTab) ─── */
const GURU_STATUS = [
  { id: 'Hadir',    label: 'Hadir',    bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { id: 'Izin',     label: 'Izin',     bg: 'bg-amber-50',   text: 'text-amber-600'   },
  { id: 'Sakit',    label: 'Sakit',    bg: 'bg-amber-50',   text: 'text-amber-600'   },
  { id: 'Alpha',    label: 'Alpha',    bg: 'bg-red-50',      text: 'text-red-600'     },
  { id: 'Terlambat',label: 'Terlambat',bg: 'bg-orange-50',  text: 'text-orange-600'  },
];
const SISWA_STATUS = [
  { id: 'Hadir', label: 'Hadir', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { id: 'Izin',  label: 'Izin',  bg: 'bg-amber-50',   text: 'text-amber-600'   },
  { id: 'Sakit', label: 'Sakit', bg: 'bg-amber-50',   text: 'text-amber-600'   },
  { id: 'Alpha', label: 'Alpha', bg: 'bg-red-50',      text: 'text-red-600'     },
];

const stripId = (name) => (name ? name.replace(/^\d+ - /, '') : '');


const getEffectiveDays = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  let count = 0;
  const days = new Date(year, month, 0).getDate();
  for (let i = 1; i <= days; i++) {
    const d = new Date(year, month - 1, i).getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
};

const getWorkingDayIndex = (dateStr) => {
  const date = new Date(dateStr);
  let index = 0;
  for (let i = 1; i <= date.getDate(); i++) {
    const d = new Date(date.getFullYear(), date.getMonth(), i).getDay();
    if (d !== 0 && d !== 6) index++;
  }
  return index;
};

/* ─── Shared empty state ─── */
const EmptyState = ({ icon: Icon, message }) => (
  <tr>
    <td colSpan="10" className="p-20 text-center">
      <div className="flex flex-col items-center justify-center py-10">
        {Icon && <Icon size={64} className="mb-6 text-slate-300 opacity-40" />}
        <p className="text-lg font-bold text-slate-400 italic">{message}</p>
      </div>
    </td>
  </tr>
);

/* ─── Table Header ─── */
const Th = ({ children, center }) => (
  <th className={`px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200 last:border-r-0 ${center ? 'text-center' : 'text-left'}`}>
    {children}
  </th>
);

/* ═══════════════════════════════════════════════════ */
const AttendancePreviewSection = ({ teachersList = [], studentsList = [], staffList = [], masterData = {} }) => {
  const [activeSubTab, setActiveSubTab] = useState('staff');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('Semua');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [majorFilter, setMajorFilter] = useState('Semua');
  const [staffSearch, setStaffSearch]  = useState('');
  const [guruSearch,  setGuruSearch]   = useState('');

  /* reset filters on tab switch */
  useEffect(() => {
    setStatusFilter('Semua');
    setMajorFilter('Semua');
    setGuruSearch('');
    setStaffSearch('');
  }, [activeSubTab]);

  /* attendance state */
  const [staffAttendance, setStaffAttendance]   = useState([]);
  const [guruAttendance,  setGuruAttendance]    = useState([]);
  const [siswaAttendance, setSiswaAttendance]   = useState([]);

  /* class options from master data prop */
  const classes = useMemo(() => {
    const set = new Set();
    const kelasList = masterData?.kelas || [];
    kelasList.forEach(k => {
      if (k.name || k.nama) set.add(k.name || k.nama);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterData]);

  /* populate from props */
  useEffect(() => {
    const md = masterData;

    const studentToClass = {};
    if (md?.kelas) md.kelas.forEach(k => {
      // Handle both API format (students array) and display format
      const studentArray = k.students || [];
      if (Array.isArray(studentArray)) {
        studentArray.forEach(s => { 
          if (s.id) studentToClass[String(s.id)] = k.name || k.nama; 
        });
      }
    });

    const teacherToJurusan = {};
    if (md?.teachers) md.teachers.forEach(g => { 
      if (g.id) teacherToJurusan[String(g.id)] = g.jurusan || g.department_name; 
    });
    // Fallback if guru array is used
    if (md?.guru) md.guru.forEach(g => { 
      if (g.guruId || g.id) teacherToJurusan[String(g.guruId || g.id)] = g.jurusan; 
    });

    if (staffList.length > 0) {
      setStaffAttendance(staffList.map(u => ({
        id: u.id, name: u.name || u.full_name || 'Tanpa Nama',
        nip: u.nisn_nip || u.employee_id || u.nip || '-',
        status: 'Hadir', jamTerlambat: '', keterangan: '-',
      })));
    }
    if (teachersList.length > 0) {
      setGuruAttendance(teachersList.map(u => ({
        id: u.id, name: u.name || u.full_name || 'Tanpa Nama',
        nip: u.nisn_nip || u.employee_id || u.nip || '-',
        jurusan: teacherToJurusan[String(u.id)] || u.d_bidang || u.jurusan || '-',
        status: 'Hadir', jamTerlambat: '', keterangan: '-',
      })));
    }
    if (studentsList.length > 0) {
      setSiswaAttendance(studentsList.map(u => ({
        id: u.id, name: u.name || u.full_name || 'Tanpa Nama',
        nisn: u.nisn || u.nisn_nip || '-',
        class: studentToClass[String(u.id)] || u.class || u.kelas || '-',
        status: 'Hadir', keterangan: '-',
      })));
    }
  }, [teachersList, staffList, studentsList]);

  /* teacher majors derived from data */
  const teacherMajors = useMemo(() => {
    const s = new Set(guruAttendance.map(g => g.jurusan).filter(j => j && j !== '-'));
    return Array.from(s).sort();
  }, [guruAttendance]);

  /* filtered lists */
  const filteredStaff = useMemo(() =>
    staffAttendance.filter(g =>
      (statusFilter === 'Semua' || g.status === statusFilter) &&
      g.name.toLowerCase().includes(staffSearch.toLowerCase())
    ), [staffAttendance, statusFilter, staffSearch]);

  const filteredGuru = useMemo(() =>
    guruAttendance.filter(g =>
      (statusFilter === 'Semua' || g.status === statusFilter) &&
      (majorFilter === 'Semua' || g.jurusan === majorFilter) &&
      (g.name.toLowerCase().includes(guruSearch.toLowerCase()) || g.nip.toLowerCase().includes(guruSearch.toLowerCase()))
    ), [guruAttendance, statusFilter, majorFilter, guruSearch]);

  const siswaByClass = useMemo(() =>
    siswaAttendance.filter(s => selectedClass === 'Semua' || s.class === selectedClass),
    [siswaAttendance, selectedClass]);

  const filteredSiswa = useMemo(() =>
    siswaByClass.filter(s => statusFilter === 'Semua' || s.status === statusFilter),
    [siswaByClass, statusFilter]);

  /* ── FILTER BAR ── */
  const FilterBar = ({ children }) => (
    <div className="p-5 border-2 border-slate-50 rounded-[28px] bg-slate-50/50">
      <div className="flex flex-wrap lg:flex-nowrap items-end justify-between gap-4">
        {children}
      </div>
    </div>
  );

  const DateField = () => (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Tanggal</label>
      <div className="relative">
        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sky-500" size={14} />
        <input
          type="date" value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full pl-8 pr-3 py-2 bg-white border-2 border-slate-100 rounded-xl outline-none font-bold text-xs text-slate-600"
        />
        <p className="absolute top-full left-0 text-[8px] font-bold text-slate-400 mt-1 whitespace-nowrap italic pointer-events-none">
          Hari Kerja ke-{getWorkingDayIndex(selectedDate)} dari {getEffectiveDays(selectedDate.slice(0, 7))} Hari Efektif
        </p>
      </div>
    </div>
  );

  const StatusSelect = ({ statuses }) => (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Status</label>
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        className="px-3 py-2 bg-white border-2 border-slate-100 rounded-xl outline-none font-bold text-xs text-slate-600 h-[38px]">
        <option value="Semua">Semua Status</option>
        {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </div>
  );

  const SearchBox = ({ value, onChange, placeholder }) => (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
      <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="pl-9 pr-4 py-2 bg-white border-2 border-slate-100 rounded-xl outline-none font-bold text-xs text-slate-600 w-[220px] h-[38px]" />
    </div>
  );

  /* ── TABLE WRAPPER ── */
  const TableWrap = ({ count, label, children }) => (
    <div className="relative">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          {label} <span className="bg-sky-100 text-sky-600 px-2 py-0.5 rounded text-[10px]">{count}</span>
        </h3>
        {/* ← Tandai Semua Hadir & Notice Wali Kelas dihilangkan */}
      </div>
      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            {children}
          </table>
        </div>
      </div>
    </div>
  );

  /* ── STATUS SELECT inline ── */
  const StatusSelectInline = ({ value, onChange, statuses }) => {
    const cfg = statuses.find(s => s.id === value) || statuses[0];
    return (
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none border-none cursor-pointer ${cfg.bg} ${cfg.text}`}>
        {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    );
  };

  /* ── ROW SHARED ── */
  const ReadOnlyBadge = ({ value, statuses }) => {
    const cfg = statuses.find(s => s.id === value) || statuses[0];
    return (
      <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${cfg.bg} ${cfg.text}`}>
        {value}
      </span>
    );
  };

  /* ── STAFF TABLE ── */
  const StaffTable = () => (
    <FilterBar>
      <div className="flex flex-row items-end gap-3 flex-1 min-w-0">
        <DateField />
        <StatusSelect statuses={GURU_STATUS} />
        {/* Rekap Bulanan dihilangkan */}
      </div>
      <div className="flex items-center gap-2">
        <SearchBox value={staffSearch} onChange={setStaffSearch} placeholder="Cari nama staff..." />
        {/* Ekspor dihilangkan */}
      </div>
    </FilterBar>
  );

  /* ── GURU TABLE ── */
  const GuruFilterBar = () => (
    <FilterBar>
      <div className="flex flex-row items-end gap-3 flex-1 min-w-0">
        <DateField />
        <StatusSelect statuses={GURU_STATUS} />
        <div className="flex flex-col gap-1 min-w-[120px]">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Jurusan</label>
          <select value={majorFilter} onChange={e => setMajorFilter(e.target.value)}
            className="px-3 py-2 bg-white border-2 border-slate-100 rounded-xl outline-none font-bold text-xs text-slate-600 h-[38px]">
            <option value="Semua">Semua Jurusan</option>
            {teacherMajors.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {/* Rekap Bulanan dihilangkan */}
      </div>
      <div className="flex items-center gap-2">
        <SearchBox value={guruSearch} onChange={setGuruSearch} placeholder="Cari Nama / NIP Guru..." />
        {/* Ekspor dihilangkan */}
      </div>
    </FilterBar>
  );

  /* ── SISWA FILTER ── */
  const SiswaFilterBar = () => (
    <FilterBar>
      <div className="flex flex-row items-end gap-3 flex-1 min-w-0">
        <DateField />
        <div className="flex flex-col gap-1 min-w-[120px]">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Pilih Kelas</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            className="px-3 py-2 bg-white border-2 border-slate-100 rounded-xl outline-none font-bold text-xs text-slate-600 h-[38px]">
            <option value="Semua">Semua Kelas</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <StatusSelect statuses={SISWA_STATUS} />
        {/* Rekap Kelas dihilangkan */}
      </div>
      <div className="flex items-center gap-2">
        {/* Notice Wali Kelas & Ekspor Excel dihilangkan */}
      </div>
    </FilterBar>
  );

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Presensi Sekolah</h3>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
          Pratinjau data kehadiran secara realtime (Read Only — Super Admin)
        </p>
      </div>

      {/* Sub-tab nav — same colors as AdminAkademik */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 min-h-16 w-fit">
        {[
          { id: 'staff', label: 'Kehadiran Staff', active: 'bg-[#F43F5E] shadow-rose-200' },
          { id: 'guru',  label: 'Kehadiran Guru',  active: 'bg-[#0EA5E9] shadow-sky-200'  },
          { id: 'siswa', label: 'Kehadiran Siswa/i', active: 'bg-[#0D9488] shadow-emerald-200' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] outline-none transition-all
              ${activeSubTab === tab.id ? `${tab.active} text-white shadow-lg` : 'text-slate-400 hover:bg-slate-50'}`}>
            <Users size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* ── STAFF ── */}
        {activeSubTab === 'staff' && (
          <motion.div key="staff" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
            <StaffTable />
            <TableWrap count={staffAttendance.length} label="Daftar Presensi Staff">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-200">
                  <Th>NIP</Th><Th>Nama Staff</Th><Th center>Status</Th>
                  <Th center>Jam Lambat</Th><Th>Keterangan</Th><Th center>File Surat</Th>
                  <Th center>Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.length === 0 ? <EmptyState icon={AlertCircle} message="Data staff tidak ditemukan." /> :
                  filteredStaff.map((g, idx) => (
                    <tr key={g.id} className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-sky-50/40`}>
                      <td className="px-4 py-3 border-r border-slate-100">
                        <span className="text-xs font-mono font-bold text-slate-500">{g.nip}</span>
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100">
                        <p className="text-sm font-bold text-slate-700">{stripId(g.name)}</p>
                      </td>
                      <td className="px-4 py-3 text-center border-r border-slate-100">
                        <ReadOnlyBadge value={g.status} statuses={GURU_STATUS} />
                      </td>
                      <td className="px-4 py-3 text-center border-r border-slate-100">
                        {g.status === 'Terlambat'
                          ? <span className="text-xs font-mono text-orange-500">{g.jamTerlambat || '-'}</span>
                          : <span className="text-slate-200">-</span>}
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100">
                        <span className="text-xs text-slate-500">{g.keterangan === '-' || g.status === 'Hadir' ? '-' : g.keterangan}</span>
                      </td>
                      <td className="px-4 py-3 text-center border-r border-slate-100">
                        {(g.status === 'Izin' || g.status === 'Sakit')
                          ? <div className="p-2 bg-slate-50 text-sky-300 rounded-lg inline-flex"><Upload size={14} /></div>
                          : <span className="text-slate-200">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button disabled className="p-1.5 bg-slate-50 text-slate-300 rounded-lg cursor-not-allowed opacity-60">
                            <Save size={13} />
                          </button>
                          <button disabled className="p-1.5 bg-slate-50 text-slate-300 rounded-lg cursor-not-allowed opacity-60">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </TableWrap>
          </motion.div>
        )}

        {/* ── GURU ── */}
        {activeSubTab === 'guru' && (
          <motion.div key="guru" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
            <GuruFilterBar />
            <TableWrap count={guruAttendance.length} label="Daftar Presensi Guru">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-200">
                  <Th>NIP</Th><Th>Nama Guru</Th><Th center>Status</Th>
                  <Th center>Jam Lambat</Th><Th>Keterangan</Th><Th center>File Surat</Th>
                  <Th center>Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGuru.length === 0 ? <EmptyState icon={AlertCircle} message="Data guru tidak ditemukan." /> :
                  filteredGuru.map((g, idx) => (
                    <tr key={g.id} className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-sky-50/40`}>
                      <td className="px-4 py-3 border-r border-slate-100">
                        <span className="text-xs font-mono font-bold text-slate-500">{g.nip}</span>
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100">
                        <p className="text-sm font-bold text-slate-700">{stripId(g.name)}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{g.jurusan}</p>
                      </td>
                      <td className="px-4 py-3 text-center border-r border-slate-100">
                        <ReadOnlyBadge value={g.status} statuses={GURU_STATUS} />
                      </td>
                      <td className="px-4 py-3 text-center border-r border-slate-100">
                        {g.status === 'Terlambat'
                          ? <span className="text-xs font-mono text-orange-500">{g.jamTerlambat || '-'}</span>
                          : <span className="text-slate-200">-</span>}
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100">
                        <span className="text-xs text-slate-500">{g.status === 'Hadir' ? '-' : (g.keterangan || '-')}</span>
                      </td>
                      <td className="px-4 py-3 text-center border-r border-slate-100">
                        {(g.status === 'Izin' || g.status === 'Sakit')
                          ? <div className="p-2 bg-slate-50 text-sky-300 rounded-lg inline-flex"><Upload size={14} /></div>
                          : <span className="text-slate-200">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button disabled className="p-1.5 bg-slate-50 text-slate-300 rounded-lg cursor-not-allowed opacity-60">
                            <Save size={13} />
                          </button>
                          <button disabled className="p-1.5 bg-slate-50 text-slate-300 rounded-lg cursor-not-allowed opacity-60">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </TableWrap>
          </motion.div>
        )}

        {/* ── SISWA ── */}
        {activeSubTab === 'siswa' && (
          <motion.div key="siswa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <SiswaFilterBar />
            <TableWrap count={filteredSiswa.length} label="Daftar Presensi Siswa">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-200">
                  <Th>NISN</Th><Th>Nama Siswa/i &amp; Kelas</Th>
                  <Th center>Status</Th><Th>Keterangan</Th>
                  <Th center>Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSiswa.length === 0 ? (
                  <EmptyState icon={AlertCircle} message={
                    selectedClass === 'Semua'
                      ? 'Silakan pilih kelas untuk melihat daftar siswa.'
                      : `Data siswa untuk kelas ${selectedClass} tidak tersedia.`
                  } />
                ) : filteredSiswa.map((s, idx) => (
                  <tr key={s.id} className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-sky-50/40`}>
                    <td className="px-4 py-3 border-r border-slate-100">
                      <span className="text-xs font-mono font-bold text-slate-500">{s.nisn || '-'}</span>
                    </td>
                    <td className="px-4 py-3 border-r border-slate-100">
                      <p className="text-sm font-bold text-slate-700">
                        {stripId(s.name)}
                        <span className="text-slate-300 mx-1.5 font-normal">|</span>
                        <span className="text-sky-600 uppercase text-[10px] tracking-wider">{s.class}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-slate-100">
                      <ReadOnlyBadge value={s.status} statuses={SISWA_STATUS} />
                    </td>
                    <td className="px-4 py-3 border-r border-slate-100">
                      <span className="text-xs text-slate-500">{s.status === 'Hadir' ? '-' : (s.keterangan || '-')}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button disabled className="p-1.5 bg-slate-50 text-slate-300 rounded-lg cursor-not-allowed opacity-60">
                          <Save size={13} />
                        </button>
                        <button disabled className="p-1.5 bg-slate-50 text-slate-300 rounded-lg cursor-not-allowed opacity-60">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendancePreviewSection;
