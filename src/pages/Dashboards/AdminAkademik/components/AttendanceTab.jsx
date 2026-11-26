import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, CheckCircle, Clock, Calendar, FileSpreadsheet,
    Download, Plus, Search, Filter, Printer, Bell,
    MoreVertical, Trash2, Save, X, UserPlus, ArrowUpRight,
    TrendingUp, AlertCircle, FileText, Upload, FileDown, Shield,
    Edit2, Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { adminAkademikAPI } from '../../../../utils/api';

// STATUS CONFIG
const GURU_STATUS = [
    { id: 'Hadir', label: 'Hadir', color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { id: 'Izin', label: 'Izin', color: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-600' },
    { id: 'Sakit', label: 'Sakit', color: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-600' },
    { id: 'Alpha', label: 'Alpha', color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-600' },
    { id: 'Terlambat', label: 'Terlambat', color: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-600' }
];

const SISWA_STATUS = [
    { id: 'hadir', label: 'Hadir', color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { id: 'izin', label: 'Izin', color: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-600' },
    { id: 'sakit', label: 'Sakit', color: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-600' },
    { id: 'alpha', label: 'Alpha', color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-600' },
    { id: 'terlambat', label: 'Terlambat', color: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-600' }
];

const scheduleTimesOverlap = (first, second) => {
    const parseRange = value => {
        const parts = String(value || '').split(/\s*[-–]\s*/);
        const minutes = time => {
            const [hours, mins] = String(time || '').slice(0, 5).split(':').map(Number);
            return Number.isFinite(hours) && Number.isFinite(mins) ? hours * 60 + mins : null;
        };
        return [minutes(parts[0]), minutes(parts[1])];
    };
    const [firstStart, firstEnd] = parseRange(first?.jam_ke);
    const [secondStart, secondEnd] = parseRange(second?.jam_ke);
    return [firstStart, firstEnd, secondStart, secondEnd].every(Number.isFinite)
        && firstStart < secondEnd && firstEnd > secondStart;
};

const getScheduleRange = row => {
    const [start, end] = String(row?.jam_ke || '').split(/\s*[-–]\s*/);
    return { start: String(start || '').slice(0, 5), end: String(end || '').slice(0, 5) };
};

const TeacherSearchDropdown = ({ teachers = [], value, onChange, placeholder = 'Cari nama atau NIP guru...', excludeIds = [] }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const selected = teachers.find(teacher => String(teacher.id) === String(value));
    const getName = teacher => teacher.name || teacher.full_name || 'Nama belum tersedia';
    const getNip = teacher => teacher.nisn_nip || teacher.nip || teacher.employee_id || 'NIP belum tersedia';
    const excludedValues = new Set(excludeIds.filter(Boolean).map(value => String(value).trim().toLocaleLowerCase('id')));
    const filtered = teachers.filter(teacher => {
        const teacherId = String(teacher.id);
        const teacherNip = String(getNip(teacher)).trim().toLocaleLowerCase('id');
        if (excludedValues.has(teacherId.toLocaleLowerCase('id')) || excludedValues.has(teacherNip)) return false;
        return `${getName(teacher)} ${teacherNip}`.includes(query.trim().toLocaleLowerCase('id'));
    }).slice(0, 30);

    return <div className="relative">
        <div className={`flex h-12 items-center gap-2 rounded-xl border bg-white px-3 transition ${open ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-200'}`}>
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
                value={open ? query : selected ? `${getName(selected)} (${getNip(selected)})` : query}
                onFocus={() => { setQuery(''); setOpen(true); }}
                onChange={event => { setQuery(event.target.value); setOpen(true); if (value) onChange(''); }}
                onBlur={() => window.setTimeout(() => setOpen(false), 120)}
                placeholder={placeholder}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400"
                autoComplete="off"
            />
            {value && <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(''); setQuery(''); setOpen(true); }} className="rounded-full px-1.5 text-slate-400 hover:text-rose-500" aria-label="Hapus pilihan guru"><X size={15}/></button>}
            <span className="text-xs text-slate-400">⌄</span>
        </div>
        {open && <div className="absolute z-[1300] mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {filtered.length ? filtered.map(teacher => <button key={teacher.id} type="button" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(String(teacher.id)); setQuery(''); setOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-indigo-50">
                <span className="truncate text-sm font-bold text-slate-700">{getName(teacher)}</span><span className="ml-3 shrink-0 font-mono text-xs text-slate-400">{getNip(teacher)}</span>
            </button>) : <p className="px-3 py-4 text-center text-sm font-semibold text-slate-400">Guru tidak ditemukan.</p>}
        </div>}
    </div>;
};

const readMasterClassOptions = () => {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const raw = window.localStorage.getItem('academic_master_data_v3');
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        const classes = Array.isArray(parsed?.kelas) ? parsed.kelas : [];
        return classes.map((item) => item?.nama).filter(Boolean);
    } catch (error) {
        console.error('Failed to read class options from master data', error);
        return [];
    }
};

const readMasterMapelOptions = () => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem('academic_master_data_v3');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.mapel) ? parsed.mapel : (Array.isArray(parsed?.subjects) ? parsed.subjects : []);
    } catch (error) {
        console.error('Failed to read mapel options from master data', error);
        return [];
    }
};

const getClassIdByName = (name) => {
    if (name === 'Semua') return 0;
    try {
        const raw = window.localStorage.getItem('academic_master_data_v3');
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        const classObj = Array.isArray(parsed?.kelas) ? parsed.kelas.find(k => k.nama === name) : null;
        return classObj ? classObj.id : 0;
    } catch (e) {
        return 0;
    }
};

const stripId = (name) => {
    if (!name) return '';
    // Menghapus prefix seperti "000058 - "
    return name.replace(/^\d+ - /, '');
};

// --- OVERRIDE MODAL COMPONENT (Task 9) ---
const OverrideModal = ({ overrideModal, setOverrideModal, handleOverride, teachersList = [] }) => {
    const [status, setStatus] = useState(overrideModal.currentStatus || '');
    const [alasan, setAlasan] = useState('');
    const [checkInTime, setCheckInTime] = useState(overrideModal.checkInAt ? String(overrideModal.checkInAt).slice(11, 16) : '');
    const [checkOutTime, setCheckOutTime] = useState(overrideModal.checkOutAt ? String(overrideModal.checkOutAt).slice(11, 16) : '');
    const [substituteTeacherId, setSubstituteTeacherId] = useState(overrideModal.substituteTeacherId || '');
    const [subStatusKosong, setSubStatusKosong] = useState(overrideModal.subStatusKosong || '');
    const [saving, setSaving] = useState(false);

    const defaultStatusOptions = [
        { value: 'alpha', label: 'Alpha' },
        { value: 'cuti', label: 'Cuti' },
        { value: 'hadir', label: 'Hadir' },
        { value: 'izin', label: 'Izin' },
        { value: 'sakit', label: 'Sakit' },
        { value: 'terlambat', label: 'Terlambat' },
    ];
    const canStaffTakeLeave = overrideModal.subjectType !== 'staff' || overrideModal.positionStatus === 'tetap';
    const statusOptions = overrideModal.subjectType === 'staff'
        ? [{ value: 'Alpha', label: 'Alpha' }, ...(canStaffTakeLeave ? [{ value: 'Cuti', label: 'Cuti' }] : []), { value: 'Hadir', label: 'Hadir' }, { value: 'Izin', label: 'Izin' }, { value: 'Sakit', label: 'Sakit' }].sort((a, b) => a.label.localeCompare(b.label, 'id'))
        : overrideModal.subjectType === 'guru'
            ? ['Alpha', 'Cuti', 'Hadir', 'Izin', 'Sakit'].map(value => ({ value, label: value }))
        : overrideModal.subjectType === 'kbm'
            ? [
                { value: 'kosong', label: 'Kosong' },
                { value: 'digantikan', label: 'Digantikan Guru' },
                { value: 'terlaksana', label: 'Terlaksana' },
            ]
            : defaultStatusOptions;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        if (!status) { toast.error('Pilih status koreksi terlebih dahulu.'); setSaving(false); return; }
        if (alasan.trim().length < 8) { toast.error('Alasan wajib diisi minimal 8 karakter.'); setSaving(false); return; }
        if (overrideModal.subjectType === 'kbm' && status === 'digantikan' && !substituteTeacherId) { toast.error('Pilih guru piket pengganti.'); setSaving(false); return; }
        if (overrideModal.subjectType === 'kbm' && status === 'kosong' && !subStatusKosong) { toast.error('Pilih alasan status sesi kosong.'); setSaving(false); return; }
        if (overrideModal.subjectType === 'staff' && status === 'Hadir' && (!checkInTime || !checkOutTime)) {
            toast.error('Isi waktu masuk dan waktu keluar untuk status Hadir.');
            setSaving(false);
            return;
        }
        await handleOverride(overrideModal.absensiId, { status, alasan: alasan.trim(), sub_status_kosong: status === 'kosong' ? subStatusKosong : null, substitute_teacher_id: substituteTeacherId, tanggal: overrideModal.tanggal, check_in_time: status === 'Hadir' ? checkInTime : null, check_out_time: status === 'Hadir' ? checkOutTime : null });
        setSaving(false);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    onClick={() => !saving && setOverrideModal({ isOpen: false, absensiId: null, currentStatus: 'hadir', currentKeterangan: '', guruName: '' })}
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
                >
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{({ siswa: 'Koreksi Presensi Siswa', staff: 'Koreksi Presensi Staff', kbm: 'Konfirmasi Pelaksanaan KBM', guru: 'Koreksi Absensi Guru' })[overrideModal.subjectType] || 'Koreksi Kehadiran'}</h3>
                                <p className="text-xs text-sky-600 font-bold mt-0.5">{overrideModal.guruName}</p>
                                <p className="mt-1 text-[11px] font-semibold text-slate-400">Tanggal: {overrideModal.tanggal || '-'}</p>
                                {overrideModal.subjectType === 'kbm' && overrideModal.teacherDailyStatus && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Catatan: Guru utama berhalangan {overrideModal.teacherDailyStatus}.</p>}
                            </div>
                            <button
                                onClick={() => !saving && setOverrideModal({ isOpen: false, absensiId: null, currentStatus: 'hadir', currentKeterangan: '', guruName: '' })}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                disabled={saving}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{overrideModal.subjectType === 'kbm' ? 'Status Sesi KBM' : 'Status Kehadiran'} <span className="text-rose-500">*</span></label>
                                <select
                                    value={status}
                                    onChange={(e) => { setStatus(e.target.value); if (e.target.value !== 'Hadir') { setCheckInTime(''); setCheckOutTime(''); } }}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-slate-600 focus:border-sky-400 transition-colors"
                                    disabled={saving}
                                >
                                    <option value="">Pilih status koreksi</option>
                                    {statusOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            {overrideModal.subjectType === 'kbm' && status === 'kosong' && <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Alasan sesi kosong <span className="text-rose-500">*</span></label>
                                <select required value={subStatusKosong} onChange={event => setSubStatusKosong(event.target.value)} className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 font-bold text-slate-700" disabled={saving}>
                                    <option value="">Pilih alasan</option><option value="sakit">Sakit</option><option value="izin">Izin</option><option value="cuti">Cuti</option><option value="terlambat">Terlambat / berhalangan sementara</option><option value="alpha">Alpha</option>
                                </select>
                            </div>}

                            {overrideModal.subjectType === 'staff' && status === 'Hadir' && <div className="grid grid-cols-2 gap-3">
                                <label className="space-y-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">Waktu Masuk <span className="text-rose-500">*</span>
                                    <input type="time" required value={checkInTime} onChange={event => setCheckInTime(event.target.value)} className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:border-sky-400" disabled={saving} />
                                </label>
                                <label className="space-y-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">Waktu Keluar <span className="text-rose-500">*</span>
                                    <input type="time" required value={checkOutTime} onChange={event => setCheckOutTime(event.target.value)} className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 font-bold text-slate-700 outline-none focus:border-sky-400" disabled={saving} />
                                </label>
                            </div>}

                            {overrideModal.subjectType === 'kbm' && status === 'digantikan' && <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Guru Piket Pengganti <span className="text-rose-500">*</span></label>
                                <select required value={substituteTeacherId} onChange={e => setSubstituteTeacherId(e.target.value)} className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 font-bold text-slate-700" disabled={saving}>
                                    <option value="">Pilih guru pengganti</option>
                                    {teachersList.filter(teacher => {
                                        const primaryTeacher = teachersList.find(item => String(item.id) === String(overrideModal.teacherId));
                                        const teacherNip = String(teacher.nisn_nip || teacher.nip || teacher.employee_id || '').trim().toLocaleLowerCase('id');
                                        const primaryNip = String(primaryTeacher?.nisn_nip || primaryTeacher?.nip || primaryTeacher?.employee_id || '').trim().toLocaleLowerCase('id');
                                        return String(teacher.id) !== String(overrideModal.teacherId) && (!primaryNip || teacherNip !== primaryNip);
                                    }).map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name || teacher.full_name}</option>)}
                                </select>
                            </div>}

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Alasan Perubahan <span className="text-rose-500">*</span></label>
                                <textarea
                                    rows={3}
                                    value={alasan}
                                    onChange={(e) => setAlasan(e.target.value)}
                                    placeholder="Tuliskan alasan dan dasar koreksi (minimal 8 karakter)..."
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-medium text-slate-600 focus:border-sky-400 transition-colors resize-none text-sm"
                                    disabled={saving}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setOverrideModal({ isOpen: false, absensiId: null, currentStatus: 'hadir', currentKeterangan: '', guruName: '' })}
                                    disabled={saving}
                                    className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-200 transition-all disabled:opacity-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-[2] py-3.5 bg-sky-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-sky-100 hover:bg-sky-700 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                            </svg>
                                            Menyimpan...
                                        </>
                                    ) : 'Simpan Koreksi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const StudentSessionCorrectionModal = ({ session, onClose, onSave, onConfirmSession, teachersList = [], canEdit }) => {
    const [drafts, setDrafts] = useState(() => Object.fromEntries((session?.students || []).map(student => [student.siswa_id, {
        status: student.status || '', reason: '', saving: false,
    }])));
    const [sessionOutcome, setSessionOutcome] = useState(({ substitute: 'digantikan', done_manual: 'terlaksana', izin: 'kosong', sakit: 'kosong', alpha: 'kosong', cuti: 'kosong', not_taught: 'kosong' })[session?.jadwal?.override_status] || session?.jadwal?.override_status || '');
    const [sessionSubStatus, setSessionSubStatus] = useState(session?.jadwal?.sub_status_kosong || ({ sakit: 'sakit', izin: 'izin', cuti: 'cuti', alpha: 'alpha', not_taught: 'alpha' })[session?.jadwal?.override_status] || '');
    const [sessionReason, setSessionReason] = useState('');
    const [sessionSubstituteId, setSessionSubstituteId] = useState(session?.jadwal?.substitute_teacher_id || '');
    const [savingSessionOutcome, setSavingSessionOutcome] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');
    const [studentStatusFilter, setStudentStatusFilter] = useState('Semua');
    const visibleStudents = (session?.students || []).filter(student => {
        const keyword = studentSearch.trim().toLocaleLowerCase('id');
        const matchesKeyword = !keyword || `${student.nama_siswa || ''} ${student.nisn || ''}`.toLocaleLowerCase('id').includes(keyword);
        const status = String(student.status || '').toLowerCase();
        const matchesStatus = studentStatusFilter === 'Semua' || status === studentStatusFilter;
        return matchesKeyword && matchesStatus;
    });

    const updateDraft = (studentId, patch) => setDrafts(current => ({
        ...current,
        [studentId]: { ...current[studentId], ...patch },
    }));

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                <motion.button aria-label="Tutup rincian presensi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
                <motion.section initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                    <header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-6 py-5">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-sky-600">Rincian Presensi & Koreksi</p>
                            <h3 className="mt-1 text-xl font-black text-slate-800">{session?.jadwal?.kelas_nama} · {session?.jadwal?.mapel_nama}</h3>
                            <p className="mt-1 text-sm text-slate-500">{session?.jadwal?.guru_nama} · {session?.jadwal?.waktu} · {session?.jadwal?.tanggal}</p>
                        </div>
                        <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"><X size={20} /></button>
                    </header>
                    <div className="overflow-auto p-5">
                        {canEdit && <section className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                            <div className="mb-3"><h4 className="text-sm font-black text-slate-800">Konfirmasi pelaksanaan mengajar</h4><p className="mt-1 text-xs font-medium text-slate-500">Status sesi guru dipisah dari status presensi setiap murid.</p>{session?.jadwal?.status_guru_harian && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Catatan: Guru utama berhalangan {session.jadwal.status_guru_harian}.</p>}</div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Status sesi <span className="text-rose-500">*</span>
                                <select value={sessionOutcome} onChange={event => setSessionOutcome(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="">Pilih hasil sesi</option><option value="terlaksana">Terlaksana</option><option value="digantikan">Digantikan</option><option value="kosong">Kosong</option></select>
                                </label>
                                {sessionOutcome === 'kosong' && <label className="space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Alasan sesi kosong <span className="text-rose-500">*</span><select required value={sessionSubStatus} onChange={event => setSessionSubStatus(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="">Pilih alasan</option><option value="sakit">Sakit</option><option value="izin">Izin</option><option value="cuti">Cuti</option><option value="terlambat">Terlambat / berhalangan sementara</option><option value="alpha">Alpha</option></select></label>}
                                {sessionOutcome === 'digantikan' && <label className="space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Guru pengganti <span className="text-rose-500">*</span>
                                    <TeacherSearchDropdown teachers={teachersList} value={sessionSubstituteId} onChange={setSessionSubstituteId} excludeIds={[session?.jadwal?.guru_id, teachersList.find(teacher => String(teacher.id) === String(session?.jadwal?.guru_id))?.nisn_nip]} placeholder="Ketik nama atau NIP guru..." />
                                </label>}
                                <label className="space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Alasan konfirmasi <span className="text-rose-500">*</span>
                                    <input value={sessionReason} onChange={event => setSessionReason(event.target.value)} placeholder="Minimal 8 karakter" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium normal-case tracking-normal text-slate-700" />
                                </label>
                            </div>
                            <div className="mt-3 flex justify-end"><button type="button" disabled={savingSessionOutcome || !sessionOutcome || sessionReason.trim().length < 8 || (sessionOutcome === 'kosong' && !sessionSubStatus) || (sessionOutcome === 'digantikan' && !sessionSubstituteId)} onClick={async () => { setSavingSessionOutcome(true); const ok = await onConfirmSession({ status: sessionOutcome, alasan: sessionReason.trim(), sub_status_kosong: sessionOutcome === 'kosong' ? sessionSubStatus : null, substitute_teacher_id: sessionSubstituteId, tanggal: session.jadwal.tanggal }); setSavingSessionOutcome(false); if (ok) setSessionReason(''); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black uppercase text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"><Save size={14}/>{savingSessionOutcome ? 'Menyimpan...' : 'Simpan Konfirmasi Sesi'}</button></div>
                        </section>}
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <input value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Cari nama atau NISN murid..." className="h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400" />
                            <select value={studentStatusFilter} onChange={event => setStudentStatusFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="Semua">Semua Status</option><option value="alpha">Alpha</option><option value="izin">Izin</option><option value="sakit">Sakit</option></select>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full min-w-[760px] text-left">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    <tr><th className="px-4 py-3">Murid</th><th className="px-4 py-3">Status Tercatat</th>{canEdit && <><th className="px-4 py-3">Status Koreksi</th><th className="px-4 py-3">Alasan Perubahan</th><th className="px-4 py-3 text-right">Aksi</th></>}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {visibleStudents.map(student => {
                                        const draft = drafts[student.siswa_id] || { status: '', reason: '', saving: false };
                                        return <tr key={student.siswa_id}>
                                            <td className="px-4 py-3"><p className="text-sm font-bold text-slate-700">{student.nama_siswa}</p><p className="mt-0.5 font-mono text-xs text-slate-400">{student.nisn || '-'}</p></td>
                                            <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${student.status ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{student.status || 'Belum Absen'}</span>{student.keterangan && <p className="mt-1 max-w-[180px] truncate text-[10px] text-slate-400" title={student.keterangan}>{student.keterangan}</p>}</td>
                                            {canEdit && <>
                                                <td className="px-4 py-3"><select value={draft.status} onChange={event => updateDraft(student.siswa_id, { status: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="">Pilih status</option>{SISWA_STATUS.map(status => <option key={status.id} value={status.id}>{status.label}</option>)}</select></td>
                                                <td className="px-4 py-3"><input value={draft.reason} onChange={event => updateDraft(student.siswa_id, { reason: event.target.value })} placeholder="Wajib isi alasan koreksi" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-400" /></td>
                                                <td className="px-4 py-3 text-right"><button disabled={draft.saving || !draft.status || draft.reason.trim().length < 8} onClick={async () => { updateDraft(student.siswa_id, { saving: true }); const success = await onSave(student, draft); updateDraft(student.siswa_id, { saving: false }); if (success) updateDraft(student.siswa_id, { reason: '' }); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-sky-600 px-3 text-xs font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"><Save size={14} />{draft.saving ? 'Menyimpan' : 'Simpan'}</button></td>
                                            </>}
                                        </tr>;
                                    })}
                                    {!visibleStudents.length && <tr><td colSpan={canEdit ? '5' : '2'} className="p-10 text-center text-sm font-semibold text-slate-400">{session?.students?.length ? 'Tidak ada murid yang cocok dengan filter.' : 'Tidak ada murid terdaftar di kelas ini.'}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.section>
            </div>
        </AnimatePresence>
    );
};

const AttendanceTab = ({ user, teachersList = [], studentsList = [], staffList = [], loading: globalLoading }) => {
    const [activeSubTab, setActiveSubTab] = useState('staff'); // 'staff' | 'guru' | 'siswa'
    const [teacherViewTab, setTeacherViewTab] = useState('sessions'); // 'sessions' | 'daily'
    const todayLocal = (() => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; })();
    const [selectedDate, setSelectedDate] = useState(todayLocal);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // 'YYYY-MM'
    const [selectedClass, setSelectedClass] = useState('Semua');
    const [statusFilter, setStatusFilter] = useState('Semua');
    const [staffCategoryFilter, setStaffCategoryFilter] = useState('Semua');
    const [majorFilter, setMajorFilter] = useState('Semua');
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [guruSearchQuery, setGuruSearchQuery] = useState('');

    // --- NEW STATES FOR SISWA RECAP ---
    const [recapStartDate, setRecapStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [recapEndDate, setRecapEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMapel, setSelectedMapel] = useState('0');
    const [siswaRecapData, setSiswaRecapData] = useState([]);
    
    const summarizedSiswaRecapData = useMemo(() => {
        const studentMap = new Map();
        
        siswaRecapData.forEach(item => {
            // Gabungkan NIS dan nama_mapel sebagai KEY agar tidak tercampur antar mapel
            const key = `${item.nis || item.siswa_id}_${item.nama_mapel}`;
            if (!studentMap.has(key)) {
                studentMap.set(key, {
                    nis: item.nis,
                    nama_siswa: item.nama_siswa,
                    nama_kelas: item.nama_kelas,
                    nama_mapel: item.nama_mapel,
                    hadir: 0,
                    izin: 0,
                    sakit: 0,
                    alpha: 0,
                    terlambat: 0,
                    total: 0
                });
            }
            
            const student = studentMap.get(key);
            const statusKey = (item.status || '').toLowerCase();
            if (statusKey in student) {
                student[statusKey] += 1;
            }
            student.total += 1;
        });
        
        return Array.from(studentMap.values());
    }, [siswaRecapData]);
    const [siswaRecapLoading, setSiswaRecapLoading] = useState(false);

    // Reset filter when switching sub-tabs
    useEffect(() => {
        setStatusFilter('Semua');
        setMajorFilter('Semua');
        setGuruSearchQuery('');
        setStaffSearchQuery('');
    }, [activeSubTab]);

    // Modals
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualStaffForm, setManualStaffForm] = useState({ user_id: '', status: '', alasan: '' });
    const [massStaffIds, setMassStaffIds] = useState([]);
    const [massStaffStatus, setMassStaffStatus] = useState('');
    const [massStaffCheckInTime, setMassStaffCheckInTime] = useState('');
    const [massStaffCheckOutTime, setMassStaffCheckOutTime] = useState('');
    const [massStaffReason, setMassStaffReason] = useState('');
    const [massStaffSaving, setMassStaffSaving] = useState(false);

    // Resolve current user for signatory (prop or storage)
    const currentUser = useMemo(() => {
        let resolvedUser = user;

        // 1. Get from storage if prop is empty
        if (!resolvedUser || !resolvedUser.name) {
            try {
                const stored = window.sessionStorage.getItem('user') || window.localStorage.getItem('school_user_data_v3');
                if (stored) resolvedUser = JSON.parse(stored);
            } catch (e) { }
        }

        if (!resolvedUser) return {};

        // 2. Cross-reference with staffList or teachersList to get the 18-digit NIP
        // Match by name or full_name
        const searchName = (resolvedUser.name || resolvedUser.full_name || '').toLowerCase();
        const found = [...staffList, ...teachersList].find(u => {
            const uName = (u.name || u.full_name || '').toLowerCase();
            // Check for exact match or name contained in formatted name (with sequential ID)
            return uName === searchName || uName.endsWith(searchName) || searchName.endsWith(uName);
        });

        return found ? { ...resolvedUser, ...found } : resolvedUser;
    }, [user, staffList, teachersList]);

    const [showMassModal, setShowMassModal] = useState(false);

    // Data States
    const [staffAttendance, setStaffAttendance] = useState([]);
    const [guruAttendance, setGuruAttendance] = useState([]);
    const [siswaAttendance, setSiswaAttendance] = useState([]);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showConfirmAllModal, setShowConfirmAllModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { type, id, name }

    // Guru Absensi API State
    const [guruAbsensiData, setGuruAbsensiData] = useState([]);
    const [guruAbsensiLoading, setGuruAbsensiLoading] = useState(false);
    const [guruAbsensiError, setGuruAbsensiError] = useState(null);
    const [replacementModalOpen, setReplacementModalOpen] = useState(false);
    const [replacementTeacherId, setReplacementTeacherId] = useState('');
    const [replacementMode, setReplacementMode] = useState('today');
    const [temporarySubStatus, setTemporarySubStatus] = useState('');
    const [replacementStartTime, setReplacementStartTime] = useState('');
    const [replacementEndTime, setReplacementEndTime] = useState('');
    const [replacementAssignments, setReplacementAssignments] = useState({});
    const [replacementReason, setReplacementReason] = useState('');
    const [replacementSaving, setReplacementSaving] = useState(false);

    // Override Modal State (Task 9)
    const [overrideModal, setOverrideModal] = useState({
        isOpen: false,
        absensiId: null,
        currentStatus: 'hadir',
        currentKeterangan: '',
        guruName: ''
    });
    // This component is mounted inside the Admin Akademik workspace. Keep the
    // correction controls visible here; the API still enforces role access.
    const canOverrideAttendance = true;

    // Rekap Guru API State (Task 10)
    const [rekapGuruData, setRekapGuruData] = useState([]);
    const [rekapGuruLoading, setRekapGuruLoading] = useState(false);
    const [rekapGuruError, setRekapGuruError] = useState(null);
    const [staffPresenceData, setStaffPresenceData] = useState([]);
    const [teacherDailyPresenceData, setTeacherDailyPresenceData] = useState([]);
    const [studentMonitoringData, setStudentMonitoringData] = useState([]);
    const [studentMonitoringLoading, setStudentMonitoringLoading] = useState(false);
    const [studentClassFilter, setStudentClassFilter] = useState('Semua');
    const [studentStatusFilter, setStudentStatusFilter] = useState('Semua');
    const [studentExportStart, setStudentExportStart] = useState(todayLocal);
    const [studentExportEnd, setStudentExportEnd] = useState(todayLocal);
    const [studentSessionModal, setStudentSessionModal] = useState(null);
    const [studentSessionLoading, setStudentSessionLoading] = useState(false);

    const teacherMajors = useMemo(() => {
        const majors = new Set(guruAttendance.map(g => g.jurusan).filter(j => j && j !== '-'));
        return Array.from(majors).sort();
    }, [guruAttendance]);

    const displayGuruAbsensiData = useMemo(() => {
        const keyword = guruSearchQuery.trim().toLowerCase();
        return (Array.isArray(guruAbsensiData) ? guruAbsensiData : []).filter(row => {
            const status = ({ terlaksana: 'Terlaksana', sudah: 'Terlaksana', digantikan: 'Digantikan', kosong: 'Kosong', belum: 'Belum Mengajar' })[row.status_jurnal] || 'Belum Mengajar';
            const matchesStatus = statusFilter === 'Semua' || statusFilter === status;
            const matchesKeyword = !keyword || [row.guru_nama, row.kelas_nama, row.mapel_nama].some(value => String(value || '').toLowerCase().includes(keyword));
            return matchesStatus && matchesKeyword;
        });
    }, [guruAbsensiData, statusFilter, guruSearchQuery]);

    const teacherTeachingPeriods = useMemo(() => guruAbsensiData
        .filter(row => String(row.guru_id) === String(replacementTeacherId))
        .map(row => ({ ...getScheduleRange(row), jadwal_id: row.jadwal_id, row }))
        .filter(period => period.start && period.end)
        .sort((a, b) => a.start.localeCompare(b.start)), [guruAbsensiData, replacementTeacherId]);

    const temporaryRangeIsValid = replacementMode === 'temporary' && replacementStartTime && replacementEndTime > replacementStartTime
        && teacherTeachingPeriods.some(period => period.start === replacementStartTime && replacementEndTime <= period.end);

    const replacementSchedules = useMemo(() => {
        const teacherSchedules = guruAbsensiData.filter(row => String(row.guru_id) === String(replacementTeacherId));
        if (replacementMode !== 'temporary') return teacherSchedules;
        if (!replacementStartTime || !replacementEndTime || replacementEndTime <= replacementStartTime) return [];
        return teacherSchedules.filter(row => {
            const { start, end } = getScheduleRange(row);
            return start === replacementStartTime && replacementEndTime <= end;
        });
    }, [guruAbsensiData, replacementTeacherId, replacementMode, replacementStartTime, replacementEndTime]);

    const teachersWithSelectedDateSchedules = useMemo(() => {
        const scheduledTeacherIds = new Set(guruAbsensiData.map(row => String(row.guru_id)));
        return teachersList.filter(teacher => scheduledTeacherIds.has(String(teacher.id)));
    }, [guruAbsensiData, teachersList]);

    const displaySiswaRecapData = useMemo(() => {
        return summarizedSiswaRecapData;
    }, [summarizedSiswaRecapData]);

    const classes = useMemo(() => {
        const uniqueClasses = new Set();
        readMasterClassOptions().forEach((item) => uniqueClasses.add(item));
        const allCls = Array.from(uniqueClasses).sort((left, right) => left.localeCompare(right));
        
        if (selectedMapel === '0' || !selectedMapel) return allCls;
        
        try {
            const raw = window.localStorage.getItem('academic_master_data_v3');
            if (!raw) return allCls;
            const parsed = JSON.parse(raw);
            const jadwal = Array.isArray(parsed?.jadwal) ? parsed.jadwal : [];
            
            const classIds = new Set(
                jadwal
                    .filter(j => String(j.mapel_id || j.subject_id) === String(selectedMapel))
                    .map(j => j.kelas_id || j.class_id)
            );
            
            if (classIds.size === 0) return allCls;
            
            const filtered = (parsed.kelas || [])
                .filter(k => classIds.has(k.id))
                .map(k => k.nama)
                .filter(Boolean);
                
            return filtered.length > 0 ? filtered.sort() : allCls;
        } catch (e) {
            return allCls;
        }
    }, [selectedMapel]);

    useEffect(() => {
        if (selectedClass !== 'Semua' && !classes.includes(selectedClass)) {
            setSelectedClass('Semua');
        }
    }, [classes, selectedClass]);

    // Sync attendance data setiap kali props berubah (sinkronisasi mulus dengan parent dashboard).
    // - User baru langsung muncul
    // - User off/expired langsung hilang (sudah difilter oleh parent sebelum dikirim)
    // - Fallback localStorage hanya dipakai saat mount pertama jika props masih kosong (race condition)
    useEffect(() => {
        // Read Master Data for mapping
        const raw = window.localStorage.getItem('academic_master_data_v3');
        let masterData = null;
        try {
            masterData = raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error("Failed to parse master data for attendance:", e);
        }

        const studentToClass = {};
        if (masterData && Array.isArray(masterData.kelas)) {
            masterData.kelas.forEach(k => {
                if (Array.isArray(k.students)) {
                    k.students.forEach(s => {
                        if (s.id) studentToClass[String(s.id)] = k.nama;
                    });
                }
            });
        }

        const teacherToJurusan = {};
        if (masterData && Array.isArray(masterData.guru)) {
            masterData.guru.forEach(g => {
                if (g.guruId) teacherToJurusan[String(g.guruId)] = g.jurusan;
            });
        }

        // Use the current API-backed props only; stale browser cache must not restore removed users.
        const resolvedStaff = staffList.filter(person => !['guru', 'teacher', 'murid', 'student'].includes(String(person.access_role || person.role || person.role_name || '').trim().toLowerCase()));
        const resolvedTeachers = teachersList;
        const resolvedStudents = studentsList;

        // Selalu rebuild dari data terbaru (termasuk jika jadi kosong karena semua user dinonaktifkan)
        setStaffAttendance(resolvedStaff.map(u => ({
            id: u.id,
            name: u.name || u.full_name || 'Tanpa Nama',
            nip: u.nisn_nip || u.employee_id || u.nip || '-',
            category: String(u.position_status || u.resolved_position_status || 'tetap').toLowerCase(),
            access_role: u.access_role || u.role || '',
            status: '',
            jamTerlambat: '',
            keterangan: '-',
        })));

        setGuruAttendance(resolvedTeachers.map(u => ({
            id: u.id,
            name: u.name || u.full_name || 'Tanpa Nama',
            nip: u.nisn_nip || u.employee_id || u.nip || '-',
            jurusan: teacherToJurusan[String(u.id)] || u.d_bidang || u.major || u.department || u.jurusan || '-',
            status: '',
            jamTerlambat: '',
            keterangan: '-',
        })));

        setSiswaAttendance(resolvedStudents.map(u => ({
            id: u.id,
            name: u.name || u.full_name || 'Tanpa Nama',
            nisn: u.nisn_nip || u.nisn || u.secondary_identity_number || u.student_id || '-',
            class: studentToClass[String(u.id)] || u.class || u.kelas || '-',
            status: '',
            keterangan: '-',
        })));
    }, [teachersList, staffList, studentsList]);

    // --- GURU ABSENSI API ---
    const fetchGuruAbsensiHarian = async (tanggal) => {
        setGuruAbsensiLoading(true);
        setGuruAbsensiError(null);
        try {
            const res = await adminAkademikAPI.getKbmMonitoring({ tanggal });
            setGuruAbsensiData(res.data.data || []);
        } catch (err) {
            setGuruAbsensiError('Gagal memuat data absensi guru.');
            setGuruAbsensiData([]);
        } finally {
            setGuruAbsensiLoading(false);
        }
    };

    useEffect(() => {
        if (activeSubTab === 'guru') {
            fetchGuruAbsensiHarian(selectedDate);
            fetchTeacherDailyPresence(selectedDate);
        }
    }, [activeSubTab, selectedDate]);

    const fetchTeacherDailyPresence = async (tanggal) => {
        try {
            const response = await adminAkademikAPI.getTeacherPresenceDaily({ tanggal });
            setTeacherDailyPresenceData(response.data.data || []);
        } catch (error) {
            setTeacherDailyPresenceData([]);
            toast.error(error.response?.data?.message || 'Gagal memuat presensi harian guru.');
        }
    };

    const fetchStaffPresence = async (tanggal) => {
        try {
            const res = await adminAkademikAPI.getStaffPresenceDaily({ tanggal });
            setStaffPresenceData(res.data.data || []);
        } catch (err) {
            setStaffPresenceData([]);
            toast.error('Gagal memuat presensi fisik staff.');
        }
    };

    useEffect(() => {
        if (activeSubTab === 'staff') fetchStaffPresence(selectedDate);
    }, [activeSubTab, selectedDate]);

    const fetchStudentMonitoring = async () => {
        setStudentMonitoringLoading(true);
        try {
            const res = await adminAkademikAPI.getStudentAttendanceMonitoring({ tanggal: selectedDate });
            setStudentMonitoringData(res.data.data || []);
        } catch (err) {
            setStudentMonitoringData([]);
            toast.error('Gagal memuat monitoring presensi kelas.');
        } finally {
            setStudentMonitoringLoading(false);
        }
    };

    useEffect(() => {
        if (activeSubTab === 'siswa') fetchStudentMonitoring();
    }, [activeSubTab, selectedDate]);

    const studentSessionClasses = useMemo(() => Array.from(new Set(studentMonitoringData.map(row => row.kelas_nama).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [studentMonitoringData]);
    const filteredStudentMonitoring = useMemo(() => studentMonitoringData.filter(row => {
        const matchesClass = studentClassFilter === 'Semua' || row.kelas_nama === studentClassFilter;
        const matchesStatus = studentStatusFilter === 'Semua' || row.status_presensi === studentStatusFilter;
        return matchesClass && matchesStatus;
    }), [studentMonitoringData, studentClassFilter, studentStatusFilter]);

    const openStudentSession = async (row) => {
        setStudentSessionLoading(true);
        try {
            const response = await adminAkademikAPI.getStudentAttendanceSession(row.jadwal_id, { tanggal: selectedDate });
            setStudentSessionModal({ jadwal: response.data.jadwal, students: response.data.data || [] });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal memuat rincian presensi sesi.');
        } finally {
            setStudentSessionLoading(false);
        }
    };

    const saveStudentSessionCorrection = async (student, draft) => {
        try {
            const response = await adminAkademikAPI.overrideStudentAttendanceSession(
                studentSessionModal.jadwal.jadwal_id,
                student.siswa_id,
                { tanggal: studentSessionModal.jadwal.tanggal, status: draft.status, alasan: draft.reason.trim() }
            );
            setStudentSessionModal(current => ({
                ...current,
                students: current.students.map(row => row.siswa_id === student.siswa_id
                    ? { ...row, presensi_id: response.data.data.id, status: response.data.data.status, keterangan: response.data.data.keterangan }
                    : row),
            }));
            await fetchStudentMonitoring();
            toast.success('Presensi murid berhasil dikoreksi.');
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menyimpan koreksi presensi.');
            return false;
        }
    };

    const confirmStudentSessionTeaching = async (payload) => {
        try {
            await adminAkademikAPI.overrideKbmMonitoring(studentSessionModal.jadwal.jadwal_id, payload);
            setStudentSessionModal(current => ({
                ...current,
                jadwal: {
                    ...current.jadwal,
                    override_status: payload.status === 'digantikan' ? 'substitute' : payload.status,
                    sub_status_kosong: payload.status === 'kosong' ? payload.sub_status_kosong : null,
                    override_reason: payload.alasan,
                    substitute_teacher_id: ['substitute', 'digantikan'].includes(payload.status) ? payload.substitute_teacher_id : null,
                },
            }));
            await Promise.all([fetchStudentMonitoring(), fetchGuruAbsensiHarian(payload.tanggal)]);
            toast.success('Konfirmasi pelaksanaan sesi berhasil disimpan.');
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menyimpan konfirmasi sesi.');
            return false;
        }
    };

    const exportStudentMonitoring = async () => {
        if (!studentExportStart || !studentExportEnd || studentExportStart > studentExportEnd) {
            toast.error('Rentang tanggal ekspor tidak valid.');
            return;
        }
        const start = new Date(`${studentExportStart}T00:00:00`);
        const end = new Date(`${studentExportEnd}T00:00:00`);
        const days = Math.floor((end - start) / 86400000) + 1;
        if (days > 62) {
            toast.error('Rentang ekspor maksimal 62 hari.');
            return;
        }

        const loadingToast = toast.loading('Menyiapkan laporan presensi...');
        try {
            const dates = Array.from({ length: days }, (_, index) => {
                const date = new Date(start);
                date.setDate(start.getDate() + index);
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            });
            const responses = await Promise.all(dates.map(tanggal => adminAkademikAPI.getStudentAttendanceMonitoring({ tanggal })));
            const sessions = responses.flatMap(response => response.data.data || []).filter(row => {
                const matchesClass = studentClassFilter === 'Semua' || row.kelas_nama === studentClassFilter;
                const matchesStatus = studentStatusFilter === 'Semua' || row.status_presensi === studentStatusFilter;
                return matchesClass && matchesStatus;
            });
            if (!sessions.length) {
                toast.error('Tidak ada sesi KBM pada filter dan rentang tanggal tersebut.', { id: loadingToast });
                return;
            }

            const sessionDetails = [];
            for (let index = 0; index < sessions.length; index += 8) {
                const batch = sessions.slice(index, index + 8);
                const details = await Promise.all(batch.map(row => adminAkademikAPI.getStudentAttendanceSession(row.jadwal_id, { tanggal: row.tanggal })));
                sessionDetails.push(...details.map(response => response.data));
            }

            const summaryReport = sessions.map(row => ({
                Tanggal: row.tanggal,
                Waktu: row.waktu,
                Kelas: row.kelas_nama,
                'Mata Pelajaran': row.mapel_nama,
                'Guru Pengampu': row.guru_nama,
                'Jumlah Murid': row.jumlah_siswa,
                'Sudah Mengisi': row.total_siswa,
                'Belum Mengisi': Math.max(0, row.jumlah_siswa - row.total_siswa),
                Status: row.status_presensi === 'sudah' ? 'Sudah Absen' : 'Belum Absen',
            }));
            const studentReport = sessionDetails.flatMap(detail => (detail.data || []).map(student => ({
                Tanggal: detail.jadwal.tanggal,
                Waktu: detail.jadwal.waktu,
                Kelas: detail.jadwal.kelas_nama,
                'Mata Pelajaran': detail.jadwal.mapel_nama,
                'Guru Pengampu': detail.jadwal.guru_nama,
                NISN: student.nisn || '-',
                'Nama Murid': student.nama_siswa,
                Status: student.status || 'Belum Absen',
                Catatan: student.keterangan || '-',
            })));

            const workbook = XLSX.utils.book_new();
            const summarySheet = XLSX.utils.json_to_sheet(summaryReport);
            summarySheet['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 34 }, { wch: 28 }, { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
            const studentSheet = XLSX.utils.json_to_sheet(studentReport);
            studentSheet['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 34 }, { wch: 28 }, { wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 42 }];
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan Sesi');
            XLSX.utils.book_append_sheet(workbook, studentSheet, 'Rincian Murid');
            XLSX.writeFile(workbook, `Laporan_Presensi_Siswa_${studentExportStart}_${studentExportEnd}.xlsx`);
            toast.success(`Laporan lengkap berhasil diunduh (${sessions.length} sesi, ${studentReport.length} baris murid).`, { id: loadingToast });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menyiapkan laporan presensi.', { id: loadingToast });
        }
    };

    // --- SISWA ABSENSI API ---
    const fetchSiswaRecap = async () => {
        setSiswaRecapLoading(true);
        try {
            const res = await adminAkademikAPI.getStudentRecap({
                start_date: recapStartDate,
                end_date: recapEndDate,
                kelas_id: selectedClass === 'Semua' ? 0 : selectedClass,
                mapel_id: selectedMapel
            });
            setSiswaRecapData(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch student recap:', err);
            toast.error(`Gagal memuat rekap presensi siswa: ${err.response?.data?.message || err.message}`);
        } finally {
            setSiswaRecapLoading(false);
        }
    };

    // --- OVERRIDE ABSENSI GURU (Task 9) ---
    const handleOverride = async (id, payload) => {
        const loadingToast = toast.loading('Menyimpan koreksi...');
        try {
            if (overrideModal.subjectType === 'staff') {
                await adminAkademikAPI.overrideStaffPresence(id, payload);
                await fetchStaffPresence(payload.tanggal);
                toast.success('Presensi staff berhasil dikoreksi', { id: loadingToast });
                setOverrideModal({ isOpen: false, absensiId: null, currentStatus: '', currentKeterangan: '', guruName: '', subjectType: null, tanggal: null });
                return;
            }
            if (overrideModal.subjectType === 'kbm') {
                await adminAkademikAPI.overrideKbmMonitoring(id, payload);
                await fetchGuruAbsensiHarian(payload.tanggal);
                toast.success('Status KBM berhasil dikoreksi', { id: loadingToast });
                setOverrideModal({ isOpen: false, absensiId: null, currentStatus: '', currentKeterangan: '', guruName: '', subjectType: null, tanggal: null });
                return;
            }
            if (overrideModal.subjectType === 'guru') {
                await adminAkademikAPI.overrideTeacherPresence(id, payload);
                await Promise.all([fetchGuruAbsensiHarian(payload.tanggal), fetchTeacherDailyPresence(payload.tanggal)]);
                toast.success('Presensi harian guru berhasil dikoreksi', { id: loadingToast });
                setOverrideModal({ isOpen: false, absensiId: null, currentStatus: '', currentKeterangan: '', guruName: '', subjectType: null, tanggal: null });
                return;
            }
            if (overrideModal.subjectType === 'siswa') {
                await adminAkademikAPI.updateStudentAttendance(id, payload);
                await fetchSiswaRecap();
                toast.success('Presensi siswa berhasil dikoreksi', { id: loadingToast });
                setOverrideModal({ isOpen: false, absensiId: null, currentStatus: 'hadir', currentKeterangan: '', guruName: '', subjectType: null });
                return;
            }
            const res = await adminAkademikAPI.overrideAbsensi(id, payload);
            // Update baris yang bersangkutan di guruAbsensiData
            setGuruAbsensiData(prev => prev.map(item =>
                item.id === id ? { ...item, ...res.data.data } : item
            ));
            toast.success('Absensi berhasil dikoreksi', { id: loadingToast });
            setOverrideModal({ isOpen: false, absensiId: null, currentStatus: 'hadir', currentKeterangan: '', guruName: '' });
        } catch (err) {
            const msg = err.response?.data?.message || 'Gagal mengoreksi absensi.';
            toast.error(msg, { id: loadingToast });
            // Jangan tutup modal, biarkan user coba lagi
        }
    };

    const saveTeacherReplacement = async (event) => {
        event.preventDefault();
        const assignments = replacementMode === 'today' ? replacementSchedules.map(row => ({
            jadwal_guru_id: row.jadwal_id,
            substitute_teacher_id: replacementAssignments[row.jadwal_id],
        })) : [];
        if (!replacementTeacherId) {
            toast.error('Pilih guru yang berhalangan.');
            return;
        }
        if (replacementMode === 'today' && (!assignments.length || assignments.some(item => !item.substitute_teacher_id))) {
            toast.error('Pilih guru yang berhalangan dan guru pengganti untuk setiap jadwal.');
            return;
        }
        if (replacementMode === 'temporary' && !temporaryRangeIsValid) {
            toast.error('Jam mulai harus sama dengan awal jadwal guru, dan jam selesai tidak boleh melewati akhir jadwal.');
            return;
        }
        if (replacementMode === 'temporary' && !temporarySubStatus) {
            toast.error('Pilih alasan guru berhalangan sementara.');
            return;
        }
        if (replacementMode === 'temporary' && !replacementSchedules.length) {
            toast.error('Tidak ada jadwal guru yang masuk dalam rentang waktu tersebut.');
            return;
        }
        if (replacementReason.trim().length < 8) {
            toast.error('Alasan penggantian wajib diisi minimal 8 karakter.');
            return;
        }
        setReplacementSaving(true);
        try {
            await adminAkademikAPI.replaceTodayKbmTeachers({
                tanggal: selectedDate,
                guru_id: Number(replacementTeacherId),
                mode: replacementMode,
                sub_status_kosong: replacementMode === 'temporary' ? temporarySubStatus : null,
                jam_mulai: replacementMode === 'temporary' ? replacementStartTime : null,
                jam_selesai: replacementMode === 'temporary' ? replacementEndTime : null,
                alasan: replacementReason.trim(),
                assignments,
            });
            await fetchGuruAbsensiHarian(selectedDate);
            toast.success(replacementMode === 'temporary' ? `Izin sementara dicatat untuk ${replacementSchedules.length} jadwal tanpa guru pengganti.` : `Penggantian tersimpan untuk ${assignments.length} jadwal.`);
            setReplacementModalOpen(false);
            setReplacementTeacherId('');
            setReplacementAssignments({});
            setReplacementReason('');
            setReplacementStartTime('');
            setReplacementEndTime('');
            setReplacementMode('today');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menyimpan penggantian guru.');
        } finally {
            setReplacementSaving(false);
        }
    };

    // --- REKAP GURU API (Task 10) ---
    const fetchRekapGuru = async (bulan, tahun) => {
        setRekapGuruLoading(true);
        setRekapGuruError(null);
        try {
            const res = await adminAkademikAPI.getAbsensiRekap({ bulan, tahun });
            setRekapGuruData(res.data.data || []);
        } catch (err) {
            setRekapGuruError('Gagal memuat rekap absensi guru.');
            setRekapGuruData([]);
        } finally {
            setRekapGuruLoading(false);
        }
    };

    useEffect(() => {
        if (showReportModal && activeSubTab === 'guru') {
            const [year, month] = selectedMonth.split('-').map(Number);
            fetchRekapGuru(month, year);
        }
    }, [showReportModal, activeSubTab, selectedMonth]);

    // --- ACTIONS ---
    const handleMarkAllHadir = () => {
        setShowConfirmAllModal(true);
    };

    const executeMarkAllHadir = () => {
        const label = activeSubTab === 'staff' ? 'staff' : activeSubTab === 'guru' ? 'guru' : 'siswa';
        
        if (activeSubTab === 'staff') {
            const ids = new Set(filteredStaff.map(i => i.id));
            setStaffAttendance(prev => prev.map(g => ids.has(g.id) ? { ...g, status: 'Hadir', keterangan: '-' } : g));
            toast.success(`Semua ${filteredStaff.length} staff ditandai hadir`);
        } else if (activeSubTab === 'guru') {
            const ids = new Set(filteredGuru.map(i => i.id));
            setGuruAttendance(prev => prev.map(g => ids.has(g.id) ? { ...g, status: 'Hadir', keterangan: '-' } : g));
            toast.success(`Semua ${filteredGuru.length} guru ditandai hadir`);
        } else {
            const ids = new Set(filteredSiswa.map(i => i.id));
            setSiswaAttendance(prev => prev.map(s => ids.has(s.id) ? { ...s, status: 'Hadir', keterangan: '-' } : s));
            toast.success(`Semua ${filteredSiswa.length} siswa ditandai hadir`);
        }
        setShowConfirmAllModal(false);
    };

    const exportToExcel = (data, filename) => {
        if (data.length === 0) return toast.error('Tidak ada data untuk diekspor');
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `${filename}.xlsx`);
        toast.success('File .xlsx berhasil diunduh');
    };

    const handleManualPresensi = async (e) => {
        e.preventDefault();
        if (!manualStaffForm.user_id || !manualStaffForm.status || manualStaffForm.alasan.trim().length < 8) {
            toast.error('Pilih staff dan status, lalu isi alasan minimal 8 karakter.');
            return;
        }
        const loadingToast = toast.loading('Menyimpan presensi staff...');
        try {
            await adminAkademikAPI.overrideStaffPresence(manualStaffForm.user_id, {
                tanggal: selectedDate, status: manualStaffForm.status, alasan: manualStaffForm.alasan.trim(),
            });
            await fetchStaffPresence(selectedDate);
            toast.success('Presensi staff berhasil disimpan.', { id: loadingToast });
            setShowManualModal(false);
            setManualStaffForm({ user_id: '', status: '', alasan: '' });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menyimpan presensi staff.', { id: loadingToast });
        }
    };

    const handleMassPresensi = async (e) => {
        e.preventDefault();
        if (!massStaffIds.length || !massStaffStatus || massStaffReason.trim().length < 8 || (massStaffStatus === 'Hadir' && (!massStaffCheckInTime || !massStaffCheckOutTime))) {
            toast.error(massStaffStatus === 'Hadir' && (!massStaffCheckInTime || !massStaffCheckOutTime) ? 'Isi waktu masuk dan waktu keluar untuk status Hadir.' : 'Pilih staff, status, dan isi alasan minimal 8 karakter.');
            return;
        }
        setMassStaffSaving(true);
        try {
            await adminAkademikAPI.overrideBulkStaffPresence({
                tanggal: selectedDate,
                alasan: massStaffReason.trim(),
                check_in_time: massStaffStatus === 'Hadir' ? massStaffCheckInTime : null,
                check_out_time: massStaffStatus === 'Hadir' ? massStaffCheckOutTime : null,
                attendance: massStaffIds.map(user_id => ({ user_id, status: massStaffStatus })),
            });
            await fetchStaffPresence(selectedDate);
            toast.success(`Presensi ${massStaffIds.length} staff berhasil disimpan.`);
            setShowMassModal(false);
            setMassStaffIds([]);
            setMassStaffStatus('');
            setMassStaffReason('');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal menyimpan presensi massal staff.');
        } finally {
            setMassStaffSaving(false);
        }
    };

    const confirmDelete = () => {
        if (deleteConfirm.type === 'staff') {
            setStaffAttendance(prev => prev.filter(g => g.id !== deleteConfirm.id));
        } else if (deleteConfirm.type === 'guru') {
            setGuruAttendance(prev => prev.filter(g => g.id !== deleteConfirm.id));
        } else {
            setSiswaAttendance(prev => prev.filter(s => s.id !== deleteConfirm.id));
        }
        toast.success('Data presensi berhasil dihapus');
        setDeleteConfirm(null);
    };

    const handleSaveRow = async (type, item) => {
        const loadingToast = toast.loading(`Menyimpan presensi ${item.name || 'siswa'}...`);
        try {
            if (type === 'siswa') {
                await adminAkademikAPI.updateStudentAttendance(item.id, {
                    status: item.status,
                    keterangan: item.keterangan
                });
                toast.success(`Data ${item.name || 'siswa'} berhasil disimpan`, { id: loadingToast });
                fetchSiswaRecap(); // Refresh data
            } else {
                toast.success(`Data ${item.name} berhasil disimpan`, { id: loadingToast });
            }
        } catch (error) {
            toast.error('Gagal menyimpan perubahan presensi', { id: loadingToast });
        }
    };

    // --- MONTHLY LOGIC ---
    const getDaysInMonth = (monthStr) => {
        const [year, month] = monthStr.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    };

    const getEffectiveDays = (monthStr) => {
        // Basic logic: count week days (Mon-Fri) or just use a fixed number for demo
        // For production, this should come from academic calendar
        const [year, month] = monthStr.split('-').map(Number);
        let count = 0;
        const days = getDaysInMonth(monthStr);
        for (let i = 1; i <= days; i++) {
            const day = new Date(year, month - 1, i).getDay();
            if (day !== 0 && day !== 6) count++; // Not Sat/Sun
        }
        return count;
    };

    const getPassedEffectiveDays = (monthStr) => {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 7);

        if (monthStr > todayStr) return 0;
        if (monthStr < todayStr) return getEffectiveDays(monthStr);

        const [year, month] = monthStr.split('-').map(Number);
        const currentDay = today.getDate();
        let count = 0;
        for (let i = 1; i <= currentDay; i++) {
            const day = new Date(year, month - 1, i).getDay();
            if (day !== 0 && day !== 6) count++;
        }
        return count;
    };

    const isMonthLocked = (monthStr) => {
        const today = new Date().toISOString().slice(0, 7);
        return monthStr < today;
    };

    const getWorkingDayIndex = (dateStr) => {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth();
        const dayOfMonth = date.getDate();

        let index = 0;
        for (let i = 1; i <= dayOfMonth; i++) {
            const d = new Date(year, month, i).getDay();
            if (d !== 0 && d !== 6) index++;
        }
        return index;
    };

    const generateMonthlySummary = (list) => {
        const totalEffectiveDays = getEffectiveDays(selectedMonth);
        const passedDays = getPassedEffectiveDays(selectedMonth);
        const isCurrentMonth = selectedMonth === new Date().toISOString().slice(0, 7);
        const isFuture = selectedMonth > new Date().toISOString().slice(0, 7);

        // For current month, use passed days as denominator to get accurate "so far" percentage
        const denominator = isCurrentMonth ? passedDays : totalEffectiveDays;

        return list.map(item => {
            // If future month, everything is 0
            if (isFuture || passedDays === 0) {
                return {
                    ...item,
                    hadir: 0,
                    izin: 0,
                    sakit: 0,
                    alpha: 0,
                    terlambat: 0,
                    persentase: "0.0",
                    isFuture: true
                };
            }

            // Simulate monthly data by generating random stats based on ID seed
            const seed = parseInt(String(item.id).replace(/\D/g, '').slice(-3)) || 100;

            // Scale random data based on passed days
            const scaleFactor = denominator / totalEffectiveDays;
            const rawHadir = Math.max(0, denominator - (seed % 3));
            const hadir = isCurrentMonth ? rawHadir : Math.max(0, totalEffectiveDays - (seed % 5));
            const izin = Math.floor((seed % 3) * scaleFactor);
            const sakit = Math.floor((seed % 2) * scaleFactor);
            const alpha = Math.max(0, denominator - hadir - izin - sakit);
            const terlambat = Math.floor((seed % 4) * scaleFactor);
            const persentase = denominator > 0 ? ((hadir / denominator) * 100).toFixed(1) : "0.0";

            return {
                ...item,
                hadir,
                izin,
                sakit,
                alpha,
                terlambat,
                persentase,
                isFuture: false
            };
        });
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('NIP/NISN disalin ke clipboard');
    };

    // --- CALCULATIONS ---
    const filteredStaff = useMemo(() => {
        const presenceByUser = new Map(staffPresenceData.map(item => [String(item.user_id), item]));
        return staffAttendance.map(person => {
            const presence = presenceByUser.get(String(person.id));
            const rawStatus = presence?.status || (presence ? 'Hadir' : 'Belum Check-in');
            return { ...person, ...(presence || {}), id: person.id, presence_id: presence?.id || null, status: rawStatus === 'Hadir (Manual)' ? 'Hadir' : rawStatus, check_in_at: presence?.check_in_at || null, check_out_at: presence?.check_out_at || null };
        }).filter(g => {
            const matchStatus = statusFilter === 'Semua' || g.status === statusFilter;
            const matchCategory = staffCategoryFilter === 'Semua' || g.category === staffCategoryFilter;
            const matchSearch = g.name.toLowerCase().includes(staffSearchQuery.toLowerCase());
            return matchStatus && matchCategory && matchSearch;
        });
    }, [staffAttendance, staffPresenceData, statusFilter, staffCategoryFilter, staffSearchQuery]);

    const filteredGuru = useMemo(() => {
        return guruAttendance.filter(g => {
            const matchStatus = statusFilter === 'Semua' || g.status === statusFilter;
            const matchMajor = majorFilter === 'Semua' || g.jurusan === majorFilter;
            const matchSearch = g.name.toLowerCase().includes(guruSearchQuery.toLowerCase()) || 
                              g.nip.toLowerCase().includes(guruSearchQuery.toLowerCase());
            return matchStatus && matchMajor && matchSearch;
        });
    }, [guruAttendance, statusFilter, majorFilter, guruSearchQuery]);

    const siswaByClass = useMemo(() => {
        return siswaAttendance.filter(s => selectedClass === 'Semua' || s.class === selectedClass);
    }, [siswaAttendance, selectedClass]);

    const filteredSiswa = useMemo(() => {
        return siswaByClass.filter(s => statusFilter === 'Semua' || s.status === statusFilter);
    }, [siswaByClass, statusFilter]);

    const statsStaff = {
        hadir: staffAttendance.filter(g => ['Hadir', 'Hadir (Manual)'].includes(g.status)).length,
        hadirFiltered: filteredStaff.filter(g => ['Hadir', 'Hadir (Manual)'].includes(g.status)).length,
        total: staffAttendance.length || 1,
        totalFiltered: filteredStaff.length
    };

    const statsGuru = {
        hadir: guruAttendance.filter(g => g.status === 'Hadir').length,
        hadirFiltered: filteredGuru.filter(g => g.status === 'Hadir').length,
        total: guruAttendance.length || 1,
        totalFiltered: filteredGuru.length
    };

    const statsSiswa = {
        hadir: siswaAttendance.filter(s => s.status === 'Hadir').length,
        hadirFiltered: filteredSiswa.filter(s => s.status === 'Hadir').length,
        total: siswaAttendance.length || 1,
        totalFiltered: filteredSiswa.length
    };

    return (
        <div className="space-y-8 pb-24">

            {/* MAIN CONTENT AREA */}
            <div className="w-full space-y-8">

                {/* TAB NAVIGATION */}
                <div className="flex flex-wrap md:flex-nowrap items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 min-h-16 w-fit">
                    <button
                        onClick={() => setActiveSubTab('staff')}
                        className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] outline-none transition-all
                   ${activeSubTab === 'staff' ? 'bg-[#F43F5E] text-white shadow-lg shadow-rose-200' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        <Users size={16} /> Kehadiran Staff
                    </button>
                    <button
                        onClick={() => setActiveSubTab('guru')}
                        className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] outline-none transition-all
                   ${activeSubTab === 'guru' ? 'bg-[#0EA5E9] text-white shadow-lg shadow-sky-200' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        <Users size={16} /> Kehadiran Guru
                    </button>
                    <button
                        onClick={() => setActiveSubTab('siswa')}
                        className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] outline-none transition-all
                   ${activeSubTab === 'siswa' ? 'bg-[#0D9488] text-white shadow-lg shadow-emerald-200' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        <Users size={16} /> Kehadiran Siswa/i
                    </button>
                </div>

                {/* --- TAB CONTENT AREA --- */}
                <AnimatePresence mode="wait">
                    {activeSubTab === 'staff' ? (
                        <motion.div key="staff-tab" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                            <div className="flex flex-wrap items-end justify-between gap-3 rounded-3xl border border-slate-100 bg-slate-50/60 p-5">
                                <div className="flex items-end gap-3">
                                    <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Tanggal
                                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700" />
                                    </label>
                                    <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Kategori Pegawai
                                        <select value={staffCategoryFilter} onChange={e => setStaffCategoryFilter(e.target.value)} className="block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="Semua">Semua Kategori</option><option value="tetap">Staf Tetap</option><option value="honorer">Honorer</option><option value="magang">Magang</option></select>
                                    </label>
                                    <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Status
                                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                                            <option value="Semua">Semua Status</option><option value="Alpha">Alpha</option><option value="Belum Check-in">Belum Check-in</option><option value="Cuti">Cuti</option><option value="Hadir">Hadir</option><option value="Izin">Izin</option><option value="Sakit">Sakit</option>
                                        </select>
                                    </label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input value={staffSearchQuery} onChange={e => setStaffSearchQuery(e.target.value)} placeholder="Cari nama staff..." className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                                    {canOverrideAttendance && <>
                                        <button onClick={() => { setMassStaffIds(staffAttendance.map(person => person.id)); setMassStaffStatus(''); setMassStaffCheckInTime(''); setMassStaffCheckOutTime(''); setMassStaffReason(''); setShowMassModal(true); }} className="flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black uppercase text-white hover:bg-indigo-700"><Users size={14}/> Presensi Massal</button>
                                    </>}
                                    <button onClick={() => exportToExcel(filteredStaff.map(row => ({ Nama: row.name, NIP: row.nip, Status: row.status, 'Check-in': row.check_in_at || '-' })), `Presensi_Staff_${selectedDate}`)} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black uppercase text-white"><Download size={14}/> Ekspor Excel</button>
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-100 px-5 py-4 text-sm font-black text-slate-700">Presensi Fisik Staff · {selectedDate}</div>
                                <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Nama Staff</th><th className="px-5 py-3">Kategori</th><th className="px-5 py-3">NIP / ID</th><th className="px-5 py-3">Status Check-in</th><th className="px-5 py-3">Waktu Masuk</th><th className="px-5 py-3">Waktu Keluar</th>{canOverrideAttendance && <th className="px-5 py-3 text-right">Aksi</th>}</tr></thead><tbody className="divide-y divide-slate-100">
                                    {filteredStaff.length ? filteredStaff.map((row, i) => <tr key={row.id} className={i%2 ? 'bg-slate-50/40' : ''}><td className="px-5 py-3 text-sm font-bold text-slate-700">{stripId(row.name)}</td><td className="px-5 py-3 text-xs font-bold capitalize text-slate-500">{row.category === 'tetap' ? 'Tetap' : row.category || 'Tetap'}</td><td className="px-5 py-3 font-mono text-xs text-slate-500">{row.nip}</td><td className="px-5 py-3"><span className={`rounded-full px-3 py-1 text-[10px] font-black ${row.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700' : ['Izin', 'Sakit', 'Cuti'].includes(row.status) ? 'bg-amber-50 text-amber-700' : row.status === 'Alpha' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{row.status}</span>{row.override_reason && <p className="mt-1 max-w-xs text-[10px] text-slate-400" title={row.override_reason}>Alasan: {row.override_reason}</p>}{row.override_by_name && <p className="text-[10px] font-semibold text-slate-400">Dikoreksi oleh {row.override_by_name}</p>}</td><td className="px-5 py-3 text-xs text-slate-600">{row.check_in_at ? new Date(row.check_in_at).toLocaleTimeString('id-ID') : '-'}</td><td className="px-5 py-3 text-xs text-slate-600">{row.check_out_at ? new Date(row.check_out_at).toLocaleTimeString('id-ID') : '-'}</td>{canOverrideAttendance && <td className="px-5 py-3 text-right"><button onClick={() => setOverrideModal({ isOpen: true, absensiId: row.user_id || row.id, userId: row.user_id || row.id, currentStatus: ['Alpha', 'Cuti', 'Hadir', 'Izin', 'Sakit'].includes(row.status) ? row.status : '', checkInAt: row.check_in_at, checkOutAt: row.check_out_at, guruName: row.name, positionStatus: row.category, accessRole: row.access_role, subjectType: 'staff', tanggal: selectedDate })} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-[10px] font-black uppercase text-sky-700 hover:bg-sky-100"><Edit2 size={13}/> Edit / Koreksi</button></td>}</tr>) : <tr><td colSpan={canOverrideAttendance ? '7' : '6'} className="p-16 text-center text-sm font-semibold text-slate-400">Tidak ada data staff untuk filter ini.</td></tr>}
                                </tbody></table></div>
                            </div>
                        </motion.div>
                    ) : activeSubTab === 'guru' ? (
                        <motion.div key="guru-tab" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                            <div role="tablist" aria-label="Tampilan kehadiran guru" className="flex w-fit flex-wrap items-center gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-1.5">
                                <button role="tab" aria-selected={teacherViewTab === 'sessions'} onClick={() => setTeacherViewTab('sessions')} className={`rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-wider transition-all ${teacherViewTab === 'sessions' ? 'bg-sky-600 text-white shadow-md shadow-sky-100' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}>Monitoring Sesi KBM</button>
                                <button role="tab" aria-selected={teacherViewTab === 'daily'} onClick={() => setTeacherViewTab('daily')} className={`rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-wider transition-all ${teacherViewTab === 'daily' ? 'bg-amber-500 text-white shadow-md shadow-amber-100' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}>Presensi Harian Guru</button>
                            </div>
                            {teacherViewTab === 'sessions' ? <>
                            <div className="flex flex-wrap items-end justify-between gap-3 rounded-3xl border border-slate-100 bg-slate-50/60 p-5">
                                <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Tanggal
                                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700" />
                                </label>
                                <div className="flex items-center gap-2">
                                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="Semua">Semua Status</option><option value="Belum Mengajar">Belum Mengajar</option><option value="Digantikan">Digantikan</option><option value="Kosong">Kosong</option><option value="Terlaksana">Terlaksana</option></select>
                                    <input value={guruSearchQuery} onChange={e => setGuruSearchQuery(e.target.value)} placeholder="Cari guru, kelas, mapel..." className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                                    {canOverrideAttendance && <button onClick={() => { setReplacementTeacherId(''); setReplacementAssignments({}); setReplacementReason(''); setTemporarySubStatus(''); setReplacementMode('today'); setReplacementModalOpen(true); }} className="flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black uppercase text-white hover:bg-indigo-700"><Users size={14}/> Penggantian Guru Hari Ini</button>}
                                    <button onClick={() => exportToExcel(displayGuruAbsensiData.map(row => ({ Guru: row.guru_nama, Kelas: row.kelas_nama, Mapel: row.mapel_nama, Waktu: row.jam_ke, 'Status Jurnal': ({sudah: 'Guru mengajar', belum: 'Belum Mengajar', tidak_mengajar: 'Guru tidak mengajar', digantikan: 'Digantikan Guru', alpha: 'Alpha', cuti: 'Cuti', izin: 'Izin', sakit: 'Sakit'})[row.status_jurnal] || row.status_jurnal })), `Monitoring_KBM_${selectedDate}`)} disabled={!displayGuruAbsensiData.length} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black uppercase text-white disabled:opacity-40"><Download size={14}/> Ekspor</button>
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-100 px-5 py-4 text-sm font-black text-slate-700">Monitoring KBM · {displayGuruAbsensiData.length} jadwal</div>
                                <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Guru Utama</th><th className="px-5 py-3">Kehadiran Harian Guru</th><th className="px-5 py-3">Kelas</th><th className="px-5 py-3">Mapel</th><th className="px-5 py-3">Jam Mengajar</th><th className="px-5 py-3">Guru Pengganti</th><th className="px-5 py-3">Status Sesi KBM</th>{canOverrideAttendance && <th className="px-5 py-3 text-right">Aksi</th>}</tr></thead><tbody className="divide-y divide-slate-100">
                                    {guruAbsensiLoading ? <tr><td colSpan={canOverrideAttendance ? '8' : '7'} className="p-16 text-center text-sm text-slate-400">Memuat jadwal dan jurnal...</td></tr> : guruAbsensiError ? <tr><td colSpan={canOverrideAttendance ? '8' : '7'} className="p-16 text-center text-sm text-red-500">{guruAbsensiError}</td></tr> : displayGuruAbsensiData.length ? displayGuruAbsensiData.map((row, i) => <tr key={row.jadwal_id} className={i%2 ? 'bg-slate-50/40' : ''}><td className="px-5 py-3 text-sm font-bold text-slate-700">{row.guru_nama}</td><td className="px-5 py-3"><span className={`rounded-full px-3 py-1 text-[10px] font-black ${row.status_guru_harian === 'Hadir' ? 'bg-emerald-50 text-emerald-700' : row.status_guru_harian ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{row.status_guru_harian || 'Belum Dicatat'}</span>{row.alasan_presensi_guru && <p className="mt-1 max-w-xs text-[10px] text-slate-400" title={row.alasan_presensi_guru}>Catatan: {row.alasan_presensi_guru}</p>}</td><td className="px-5 py-3 text-sm text-slate-600">{row.kelas_nama}</td><td className="px-5 py-3 text-sm text-slate-600">{row.mapel_nama}</td><td className="px-5 py-3 text-xs font-semibold text-slate-500">{row.jam_ke}</td><td className="px-5 py-3 text-sm text-slate-600">{row.substitute_teacher_name || '-'}</td><td className="px-5 py-3"><span className={`rounded-full px-3 py-1 text-[10px] font-black ${row.status_jurnal === 'terlaksana' ? 'bg-emerald-50 text-emerald-700' : row.status_jurnal === 'digantikan' ? 'bg-sky-50 text-sky-700' : row.status_jurnal === 'kosong' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{({ terlaksana: 'Terlaksana', digantikan: `Digantikan${row.substitute_teacher_name ? ` · ${row.substitute_teacher_name}` : ''}`, kosong: `Kosong${row.sub_status_kosong ? ` · ${row.sub_status_kosong}` : ''}`, belum: 'Belum Mengajar' })[row.status_jurnal] || 'Belum Mengajar'}</span>{row.override_reason && <p className="mt-1 text-[10px] text-slate-400" title={row.override_reason}>Alasan: {row.override_reason}</p>}{row.override_by_name && <p className="text-[10px] font-semibold text-slate-400">Dikoreksi oleh {row.override_by_name}</p>}</td>{canOverrideAttendance && <td className="px-5 py-3 text-right"><div className="flex justify-end gap-1.5"><button onClick={() => setOverrideModal({ isOpen: true, absensiId: row.guru_id, currentStatus: row.status_guru_harian || '', guruName: row.guru_nama, subjectType: 'guru', tanggal: selectedDate })} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] font-black uppercase text-amber-700 hover:bg-amber-100">Kehadiran</button><button onClick={() => { setReplacementTeacherId(String(row.guru_id)); setReplacementAssignments({}); setReplacementReason(''); setTemporarySubStatus(''); setReplacementMode('today'); setReplacementModalOpen(true); }} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-2 text-[10px] font-black uppercase text-indigo-700 hover:bg-indigo-100">Atur Pengganti</button><button onClick={() => setOverrideModal({ isOpen: true, absensiId: row.jadwal_id, teacherId: row.guru_id, currentStatus: ({ substitute: 'digantikan', done_manual: 'terlaksana', izin: 'kosong', sakit: 'kosong', alpha: 'kosong', cuti: 'kosong', not_taught: 'kosong' })[row.override_status] || row.override_status || '', subStatusKosong: row.sub_status_kosong || '', substituteTeacherId: row.substitute_teacher_id || '', teacherDailyStatus: row.status_guru_harian || '', guruName: `${row.guru_nama} · ${row.kelas_nama} · ${row.mapel_nama}`, subjectType: 'kbm', tanggal: selectedDate })} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-2 text-[10px] font-black uppercase text-sky-700 hover:bg-sky-100"><Edit2 size={13}/> Edit Sesi</button></div></td>}</tr>) : <tr><td colSpan={canOverrideAttendance ? '8' : '7'} className="p-16 text-center text-sm font-semibold text-slate-400">Tidak ada jadwal mengajar pada tanggal ini.</td></tr>}
                                </tbody></table></div>
                            </div>
                            </> : <>
                            <div className="flex flex-wrap items-end justify-between gap-3 rounded-3xl border border-slate-100 bg-slate-50/60 p-5">
                                <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Tanggal
                                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700" />
                                </label>
                            </div>
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-100 px-5 py-4"><p className="text-sm font-black text-slate-700">Presensi Harian Guru · {selectedDate}</p><p className="mt-1 text-xs font-medium text-slate-400">Status personal guru dicatat terpisah dari hasil sesi mengajar.</p></div>
                                <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Nama Guru</th><th className="px-5 py-3">NIP</th><th className="px-5 py-3">Status Harian</th><th className="px-5 py-3">Jam Masuk</th><th className="px-5 py-3">Jam Keluar</th><th className="px-5 py-3">Catatan</th>{canOverrideAttendance && <th className="px-5 py-3 text-right">Aksi</th>}</tr></thead><tbody className="divide-y divide-slate-100">
                                    {teacherDailyPresenceData.length ? teacherDailyPresenceData.map((row, index) => <tr key={row.teacher_id} className={index % 2 ? 'bg-slate-50/40' : ''}><td className="px-5 py-3 text-sm font-bold text-slate-700">{row.name}</td><td className="px-5 py-3 font-mono text-xs text-slate-500">{row.nisn_nip || row.school_id || '-'}</td><td className="px-5 py-3"><span className={`rounded-full px-3 py-1 text-[10px] font-black ${row.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700' : row.status ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{row.status || 'Belum Dicatat'}</span></td><td className="px-5 py-3 text-xs text-slate-600">{row.jam_masuk || '-'}</td><td className="px-5 py-3 text-xs text-slate-600">{row.jam_keluar || '-'}</td><td className="px-5 py-3 text-xs text-slate-500">{row.alasan_koreksi || '-'}</td>{canOverrideAttendance && <td className="px-5 py-3 text-right"><button onClick={() => setOverrideModal({ isOpen: true, absensiId: row.teacher_id, currentStatus: row.status || '', guruName: row.name, subjectType: 'guru', tanggal: selectedDate })} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-[10px] font-black uppercase text-sky-700 hover:bg-sky-100"><Edit2 size={13}/> Edit / Koreksi</button></td>}</tr>) : <tr><td colSpan={canOverrideAttendance ? '7' : '6'} className="p-12 text-center text-sm font-semibold text-slate-400">Belum ada data guru.</td></tr>}
                                </tbody></table></div>
                            </div>
                            </>}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="siswa-tab"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-5"
                        >
                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                                <div className="flex flex-wrap items-end gap-3">
                                    <label className="min-w-[170px] flex-1 space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        Tanggal Sesi
                                        <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-sky-400" />
                                    </label>
                                    <label className="min-w-[160px] flex-1 space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        Kelas
                                        <select value={studentClassFilter} onChange={event => setStudentClassFilter(event.target.value)} className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400">
                                            <option value="Semua">Semua Kelas</option>{studentSessionClasses.map(name => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                    </label>
                                    <label className="min-w-[160px] flex-1 space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        Status Absen
                                        <select value={studentStatusFilter} onChange={event => setStudentStatusFilter(event.target.value)} className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400">
                                            <option value="Semua">Semua Status</option><option value="belum">Belum Absen</option><option value="sudah">Sudah Absen</option>
                                        </select>
                                    </label>
                                    <div className="flex min-w-[280px] flex-[2] flex-wrap items-end gap-2">
                                        <label className="min-w-[125px] flex-1 space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ekspor Dari<input type="date" value={studentExportStart} onChange={event => setStudentExportStart(event.target.value)} className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700" /></label>
                                        <label className="min-w-[125px] flex-1 space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Sampai<input type="date" value={studentExportEnd} onChange={event => setStudentExportEnd(event.target.value)} className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700" /></label>
                                    </div>
                                    <button onClick={exportStudentMonitoring} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black uppercase text-white shadow-sm transition hover:bg-emerald-700"><Download size={15} /> Ekspor Laporan</button>
                                </div>
                            </section>

                            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                                    <div><h3 className="text-base font-black text-slate-800">Daftar Sesi KBM</h3><p className="mt-1 text-xs text-slate-500">Jadwal berdasarkan tanggal {selectedDate}</p></div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{filteredStudentMonitoring.length} sesi</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[900px] text-left">
                                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Jam / Waktu</th><th className="px-5 py-3">Kelas</th><th className="px-5 py-3">Mata Pelajaran</th><th className="px-5 py-3">Guru Pengampu</th><th className="px-5 py-3">Status Kehadiran Kelas</th><th className="px-5 py-3 text-right">Aksi</th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {studentMonitoringLoading ? <tr><td colSpan="6" className="p-12 text-center text-sm font-semibold text-slate-400">Memuat sesi KBM...</td></tr>
                                                : filteredStudentMonitoring.length ? filteredStudentMonitoring.map((row, index) => <tr key={row.jadwal_id} className={index % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                                                    <td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-slate-700">{row.waktu}</td>
                                                    <td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-slate-700">{row.kelas_nama}</td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">{row.mapel_nama}</td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">{row.guru_nama}</td>
                                                    <td className="px-5 py-4"><span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-black ${row.status_presensi === 'sudah' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{row.status_presensi === 'sudah' ? `Sudah Absen (${row.hadir_siswa ?? row.total_siswa}/${row.jumlah_siswa} Hadir)` : 'Belum Absen'}</span></td>
                                                    <td className="px-5 py-4 text-right"><button onClick={() => openStudentSession(row)} disabled={studentSessionLoading} className="inline-flex h-9 items-center justify-center rounded-xl bg-sky-50 px-3 text-xs font-black text-sky-700 transition hover:bg-sky-100 disabled:cursor-wait disabled:opacity-50">{studentSessionLoading ? 'Memuat...' : canOverrideAttendance ? 'Kelola / Koreksi' : 'Lihat Rincian'}</button></td>
                                                </tr>)
                                                : <tr><td colSpan="6" className="p-14 text-center"><div className="mx-auto flex max-w-sm flex-col items-center"><div className="mb-3 rounded-2xl bg-slate-50 p-4 text-slate-400"><Calendar size={25} /></div><p className="text-sm font-bold text-slate-600">Tidak ada jadwal KBM pada tanggal ini</p><p className="mt-1 text-xs text-slate-400">Coba pilih tanggal atau filter kelas yang lain.</p></div></td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* --- MODALS --- */}

            {replacementModalOpen && createPortal(
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
                    <button aria-label="Tutup pengaturan pengganti" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => !replacementSaving && setReplacementModalOpen(false)} />
                    <form onSubmit={saveTeacherReplacement} className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <header className="flex items-center justify-between border-b border-slate-100 bg-indigo-50 px-6 py-5">
                            <div><h3 className="text-xl font-black text-slate-800">{replacementMode === 'temporary' ? 'Izin Sementara Guru' : 'Penggantian Jadwal Guru'}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{replacementMode === 'temporary' ? `Catat jadwal yang terdampak tanpa guru pengganti · ${selectedDate}.` : `Pilih guru pengganti satu per satu untuk jadwal ${selectedDate}.`}</p></div>
                            <button type="button" onClick={() => setReplacementModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-rose-500"><X size={20}/></button>
                        </header>
                        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Guru yang digantikan / berhalangan
                                    <TeacherSearchDropdown teachers={teachersWithSelectedDateSchedules} value={replacementTeacherId} onChange={value => { setReplacementTeacherId(value); setReplacementAssignments({}); setTemporarySubStatus(''); if (replacementMode === 'temporary') { const first = guruAbsensiData.filter(row => String(row.guru_id) === String(value)).map(getScheduleRange).filter(period => period.start && period.end).sort((a, b) => a.start.localeCompare(b.start))[0]; setReplacementStartTime(first?.start || ''); setReplacementEndTime(first?.end || ''); } }} placeholder="Cari guru yang punya jadwal hari ini..." />
                                </label>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                <label className="space-y-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Masa penggantian
                                    <select value={replacementMode} onChange={event => { const mode = event.target.value; setReplacementMode(mode); setTemporarySubStatus(''); if (mode === 'temporary' && replacementTeacherId) { const first = guruAbsensiData.filter(row => String(row.guru_id) === String(replacementTeacherId)).map(getScheduleRange).filter(period => period.start && period.end).sort((a, b) => a.start.localeCompare(b.start))[0]; setReplacementStartTime(first?.start || ''); setReplacementEndTime(first?.end || ''); } }} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="today">Hari ini · semua jadwal</option><option value="temporary">Sementara · rentang jam</option></select>
                                </label>
                                {replacementMode === 'temporary' && <>
                                    <label className="space-y-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Jam mulai<input type="time" required value={replacementStartTime} onChange={event => setReplacementStartTime(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700" /></label>
                                    <label className="space-y-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Jam selesai<input type="time" required value={replacementEndTime} onChange={event => setReplacementEndTime(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700" /></label>
                                    <label className="space-y-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Alasan status sesi kosong <span className="text-rose-500">*</span><select required value={temporarySubStatus} onChange={event => setTemporarySubStatus(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="">Pilih alasan</option><option value="sakit">Sakit</option><option value="izin">Izin</option><option value="cuti">Cuti</option><option value="terlambat">Terlambat / berhalangan sementara</option><option value="alpha">Alpha</option></select></label>
                                    {!!teacherTeachingPeriods.length && <div className="md:col-span-3 -mt-1 rounded-xl bg-indigo-50 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Rentang jadwal mengajar guru hari ini</p><div className="mt-2 flex flex-wrap gap-2">{teacherTeachingPeriods.map((period, index) => <button key={`${period.jadwal_id}-${index}`} type="button" onClick={() => { setReplacementStartTime(period.start); setReplacementEndTime(period.end); }} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${replacementStartTime === period.start && replacementEndTime === period.end ? 'border-indigo-300 bg-indigo-600 text-white' : 'border-indigo-100 bg-white text-indigo-700 hover:border-indigo-300'}`}>{period.start}–{period.end}</button>)}</div><p className="mt-2 text-[11px] font-medium text-indigo-700">Jam mulai harus sama dengan awal jadwal. Jam selesai dapat dipilih sampai akhir jadwal.</p></div>}
                                </>}
                            </div>
                            <section className="rounded-2xl border border-slate-200">
                                <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-slate-50 px-4 py-3"><div><p className="text-sm font-black text-slate-700">{replacementMode === 'temporary' ? 'Jadwal terdampak izin' : 'Jadwal yang dialihkan'}</p><p className="mt-0.5 text-xs font-medium text-slate-400">{replacementMode === 'temporary' ? 'Jadwal dalam rentang ini dicatat sebagai izin tanpa guru pengganti.' : 'Tentukan guru pengganti untuk setiap jadwal.'}</p></div><span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">{replacementSchedules.length} jadwal</span></div>
                                <div className="divide-y divide-slate-100">
                                    {replacementSchedules.map(row => <div key={row.jadwal_id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_1fr] md:items-center">
                                        <div><p className="text-sm font-bold text-slate-800">{row.kelas_nama} · {row.mapel_nama}</p><p className="mt-1 text-xs font-semibold text-slate-400">{row.jam_ke}</p></div>
                                        {replacementMode === 'temporary' ? <div className="flex justify-start md:justify-end"><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">Izin sementara · tanpa pengganti</span></div> : <div className="space-y-1.5"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Guru pengganti untuk jadwal ini</p><TeacherSearchDropdown teachers={teachersList} value={replacementAssignments[row.jadwal_id] ?? (row.override_status === 'substitute' ? String(row.substitute_teacher_id) : '')} onChange={value => setReplacementAssignments(current => ({ ...current, [row.jadwal_id]: value }))} excludeIds={[replacementTeacherId, (() => { const absentTeacher = teachersList.find(teacher => String(teacher.id) === String(replacementTeacherId)); return absentTeacher?.nisn_nip || absentTeacher?.nip || absentTeacher?.employee_id; })(), ...replacementSchedules.filter(other => other.jadwal_id !== row.jadwal_id && scheduleTimesOverlap(row, other)).map(other => replacementAssignments[other.jadwal_id] ?? (other.override_status === 'substitute' ? other.substitute_teacher_id : '')).filter(Boolean)]} placeholder="Cari nama atau NIP guru pengganti..." /></div>}
                                    </div>)}
                                    {replacementTeacherId && replacementMode === 'temporary' && (!replacementStartTime || !replacementEndTime) && <p className="p-8 text-center text-sm font-semibold text-slate-500">Isi jam mulai dan jam selesai untuk melihat jadwal yang dicatat izin. Guru pengganti tidak diperlukan.</p>}
                                    {replacementTeacherId && replacementMode === 'temporary' && replacementStartTime && replacementEndTime && !temporaryRangeIsValid && <p className="p-8 text-center text-sm font-semibold text-rose-600">Jam mulai harus tepat pada awal jadwal guru dan jam selesai tidak boleh melewati akhir jadwal.</p>}
                                    {replacementTeacherId && replacementMode === 'temporary' && temporaryRangeIsValid && !replacementSchedules.length && <p className="p-8 text-center text-sm font-semibold text-slate-400">Tidak ada jadwal guru ini yang masuk dalam rentang waktu tersebut.</p>}
                                    {replacementTeacherId && replacementMode === 'today' && !replacementSchedules.length && <p className="p-8 text-center text-sm font-semibold text-slate-400">Guru ini tidak memiliki jadwal pada tanggal monitoring yang dipilih.</p>}
                                    {!replacementTeacherId && <p className="p-8 text-center text-sm font-semibold text-slate-400">Pilih guru yang berhalangan untuk melihat jadwal hari ini.</p>}
                                </div>
                            </section>
                            <label className="block space-y-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Alasan penggantian <span className="text-rose-500">*</span>
                                <textarea required minLength={8} value={replacementReason} onChange={event => setReplacementReason(event.target.value)} placeholder="Masukkan alasan penggantian, minimal 8 karakter" rows={3} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium normal-case tracking-normal text-slate-700" />
                            </label>
                        </div>
                        <footer className="border-t border-slate-100 bg-slate-50 p-5"><button type="submit" disabled={replacementSaving || !replacementTeacherId || !replacementSchedules.length || (replacementMode === 'today' && replacementSchedules.some(row => !(replacementAssignments[row.jadwal_id] || (row.override_status === 'substitute' ? row.substitute_teacher_id : null)))) || (replacementMode === 'temporary' && !temporaryRangeIsValid) || replacementReason.trim().length < 8} className="h-12 w-full rounded-xl bg-indigo-600 text-sm font-black uppercase tracking-wider text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">{replacementSaving ? 'Menyimpan...' : replacementMode === 'temporary' ? 'Simpan Izin Sementara' : 'Simpan Penggantian Jadwal'}</button></footer>
                    </form>
                </div>,
                document.body
            )}

            {/* STAFF PRESENCE: PER PERSON */}
            {showManualModal && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                        <motion.button aria-label="Tutup form presensi staff" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 cursor-default bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowManualModal(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-5">
                                <div><h3 className="text-xl font-black text-slate-800">Presensi Staff Per Orang</h3><p className="mt-1 text-xs font-semibold text-slate-500">Tanggal presensi: {selectedDate}</p></div>
                                <button type="button" onClick={() => setShowManualModal(false)} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-rose-500"><X size={20}/></button>
                            </div>
                            <form onSubmit={handleManualPresensi} className="space-y-5 p-6">
                                <label className="block space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Pilih Staff
                                    <select required value={manualStaffForm.user_id} onChange={event => setManualStaffForm(current => ({ ...current, user_id: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400">
                                        <option value="">Pilih nama staff</option>{staffAttendance.map(person => <option key={person.id} value={person.id}>{person.name} ({person.nip || '-'})</option>)}
                                    </select>
                                </label>
                                <label className="block space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Status Check-in
                                    <select required value={manualStaffForm.status} onChange={event => setManualStaffForm(current => ({ ...current, status: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400">
                                        <option value="">Pilih status</option><option value="Alpha">Alpha</option><option value="Cuti">Cuti</option><option value="Hadir">Hadir</option><option value="Izin">Izin</option><option value="Sakit">Sakit</option>
                                    </select>
                                </label>
                                <label className="block space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Catatan / Alasan <span className="text-rose-500">*</span>
                                    <textarea required minLength={8} value={manualStaffForm.alasan} onChange={event => setManualStaffForm(current => ({ ...current, alasan: event.target.value }))} rows={3} placeholder="Jelaskan dasar pencatatan presensi (minimal 8 karakter)" className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-400" />
                                </label>
                                <button type="submit" disabled={!manualStaffForm.user_id || !manualStaffForm.status || manualStaffForm.alasan.trim().length < 8} className="h-12 w-full rounded-xl bg-sky-600 text-sm font-black uppercase tracking-wider text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40">Simpan Presensi</button>
                            </form>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {/* STAFF PRESENCE: BULK */}
            {showMassModal && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                        <motion.button aria-label="Tutup presensi massal staff" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 cursor-default bg-slate-900/50 backdrop-blur-sm" onClick={() => !massStaffSaving && setShowMassModal(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-5">
                                <div><h3 className="text-xl font-black text-slate-800">Presensi Staff Massal</h3><p className="mt-1 text-xs font-semibold text-slate-500">{selectedDate} · {massStaffIds.length} staff dipilih</p></div>
                                <button type="button" disabled={massStaffSaving} onClick={() => setShowMassModal(false)} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-rose-500 disabled:opacity-50"><X size={20}/></button>
                            </div>
                            <form onSubmit={handleMassPresensi} className="flex min-h-0 flex-1 flex-col">
                                <div className="grid gap-4 border-b border-slate-100 p-5 md:grid-cols-2">
                                    <label className="space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Status untuk staff terpilih
                                        <select required value={massStaffStatus} onChange={event => setMassStaffStatus(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="">Pilih status</option><option value="Alpha">Alpha</option><option value="Cuti">Cuti</option><option value="Hadir">Hadir</option><option value="Izin">Izin</option><option value="Sakit">Sakit</option></select>
                                    </label>
                                    <label className="space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Catatan / Alasan <span className="text-rose-500">*</span>
                                        <input required minLength={8} value={massStaffReason} onChange={event => setMassStaffReason(event.target.value)} placeholder="Alasan pencatatan massal" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700" />
                                    </label>
                                </div>
                                {massStaffStatus === 'Hadir' && <div className="grid gap-4 border-b border-slate-100 px-5 pb-5 md:grid-cols-2">
                                    <label className="space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Waktu Masuk <span className="text-rose-500">*</span><input type="time" required value={massStaffCheckInTime} onChange={event => setMassStaffCheckInTime(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" /></label>
                                    <label className="space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Waktu Keluar <span className="text-rose-500">*</span><input type="time" required value={massStaffCheckOutTime} onChange={event => setMassStaffCheckOutTime(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700" /></label>
                                </div>}
                                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3 text-xs font-bold text-slate-500">
                                    <span>Pilih staff yang akan dicatat</span><button type="button" onClick={() => setMassStaffIds(massStaffIds.length === staffAttendance.length ? [] : staffAttendance.map(person => person.id))} className="text-sky-700 hover:text-sky-900">{massStaffIds.length === staffAttendance.length ? 'Batalkan semua' : 'Pilih semua staff'}</button>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto px-6">
                                    {staffAttendance.map(person => <label key={person.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 py-3.5">
                                        <input type="checkbox" checked={massStaffIds.includes(person.id)} onChange={event => setMassStaffIds(current => event.target.checked ? [...current, person.id] : current.filter(id => id !== person.id))} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-700">{person.name}</span><span className="font-mono text-[11px] text-slate-400">{person.nip || '-'}</span></span>
                                    </label>)}
                                    {!staffAttendance.length && <p className="p-10 text-center text-sm font-semibold text-slate-400">Tidak ada data staff.</p>}
                                </div>
                                <div className="border-t border-slate-100 bg-slate-50 p-5">
                                    <button type="submit" disabled={massStaffSaving || !massStaffIds.length || !massStaffStatus || massStaffReason.trim().length < 8 || (massStaffStatus === 'Hadir' && (!massStaffCheckInTime || !massStaffCheckOutTime))} className="h-12 w-full rounded-xl bg-indigo-600 text-sm font-black uppercase tracking-wider text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">{massStaffSaving ? 'Menyimpan Presensi...' : 'Simpan Presensi Staff Terpilih'}</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {/* REKAP / PDF PREVIEW MODAL */}
            {showReportModal && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 print-modal-container">
                        <style>{`
                            @media print {
                                @page { margin: 0 !important; size: auto; }
                                html, body { 
                                    margin: 0 !important; 
                                    padding: 0 !important; 
                                    visibility: hidden !important; 
                                    height: auto !important;
                                    overflow: visible !important;
                                }
                                #root, .no-print { display: none !important; visibility: hidden !important; }
                                .print-modal-container { 
                                    position: static !important; 
                                    display: block !important; 
                                    padding: 0 !important; 
                                    background: white !important;
                                    visibility: visible !important;
                                }
                                #print-area { 
                                    visibility: visible !important; 
                                    position: static !important; 
                                    width: 100% !important; 
                                    padding: 1.5cm !important;
                                    background: white !important;
                                    height: auto !important;
                                    box-shadow: none !important;
                                    transform: none !important;
                                }
                                #print-area * { visibility: visible !important; }
                                
                                /* Prevent header repetition */
                                .print-header { 
                                    display: block !important;
                                    position: relative !important;
                                    page-break-after: avoid;
                                }
                                
                                /* Table pagination fixes */
                                table { page-break-inside: auto; border-collapse: collapse !important; }
                                tr { page-break-inside: avoid; page-break-after: auto; }
                                thead { display: table-header-group; }
                                
                                /* Avoid blank second page by ensuring no overflow at the end */
                                .print-content-wrapper {
                                    margin-bottom: 0 !important;
                                    padding-bottom: 0 !important;
                                }
                            }
                        `}</style>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md no-print" onClick={() => setShowReportModal(false)} />
                        <motion.div id="print-area" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-6xl bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 print:hidden no-print">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Rekap Bulanan Akurat</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periode: {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedMonth + '-01'))}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Ganti Bulan</label>
                                        <input
                                            type="month"
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 outline-none focus:border-red-400"
                                        />
                                    </div>
                                    <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-red-100/50 hover:text-red-500 rounded-full transition-all"><X size={24} /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 lg:p-12 bg-slate-100/50 custom-scrollbar print:overflow-visible print:p-0 print:bg-white print:block">
                                {/* THE PDF-LIKE PAGE */}
                                <div className="bg-white mx-auto w-full shadow-2xl p-8 lg:p-16 rounded-sm border border-slate-200 min-h-[1000px] flex flex-col print:shadow-none print:border-none print:p-0 print:min-h-0 print:m-0 print:block print-content-wrapper">
                                    <div className="text-center border-b-2 border-slate-800 pb-8 mb-10 print:-mb-[1.8cm] print-header">
                                        <h1 className="text-2xl font-black uppercase mb-1">REKAP KEHADIRAN AKADEMIK</h1>
                                        <h2 className="text-lg font-bold text-slate-600 mb-2">{activeSubTab === 'staff' ? 'STAFF & MANAJEMEN' : activeSubTab === 'guru' ? 'GURU PENGAJAR' : `SISWA - KELAS ${selectedClass}`}</h2>
                                        <div className="flex flex-col items-center gap-1">
                                            <p className="text-xs font-medium text-slate-400">SMK Cerdas Satu Bangsa â€¢ {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedMonth + '-01'))}</p>
                                            <div className={`mt-2 px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border-2 ${selectedMonth === new Date().toISOString().slice(0, 7) ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                {selectedMonth === new Date().toISOString().slice(0, 7) ? `Status: Laporan Berjalan (In-Progress) â€¢ Periode: 01 - ${new Date().getDate()} ${new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date())}` : 'Status: Laporan Final (Permanen)'}
                                            </div>
                                        </div>
                                    </div>

                                    {isMonthLocked(selectedMonth) && (
                                        <div className="mb-8 p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl flex items-center gap-3 text-amber-700">
                                            <Shield size={20} />
                                            <p className="text-xs font-bold uppercase tracking-wide">Data Bulan Ini Telah Dikunci (Laporan Permanen)</p>
                                        </div>
                                    )}

                                    <div className="flex-1">
                                        <div className="overflow-x-auto border border-slate-300 rounded-lg print:overflow-visible print:border-none print:m-0">
                                            <table className="w-full border-collapse min-w-[800px] print:min-w-0 print:border-black print:text-[9px]">
                                                <thead>
                                                    {/* Spacer row to provide top margin on subsequent pages */}
                                                    <tr className="hidden print:table-row print:h-[2cm]">
                                                        <th colSpan="20" className="border-none"></th>
                                                    </tr>
                                                    <tr className="bg-slate-50 print:bg-white">
                                                        <th className="sticky left-0 z-20 bg-slate-50 border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 min-w-[40px] print:static print:bg-white print:border-slate-800 print:p-1">No</th>
                                                        <th className="sticky left-[40px] z-20 bg-slate-50 border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 text-left min-w-[150px] print:static print:bg-white print:border-slate-800 print:p-1">Nama Member</th>
                                                        {activeSubTab === 'guru' && <th className="border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 print:border-slate-800 print:p-1">Bidang/Jurusan</th>}
                                                        {activeSubTab === 'siswa' && <th className="border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 print:border-slate-800 print:p-1">Kelas</th>}
                                                        <th className="border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 min-w-[100px] print:border-slate-800 print:p-1">{activeSubTab === 'siswa' ? 'NISN' : 'NIP'}</th>
                                                        <th className="border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 text-center print:border-slate-800 print:p-1">H</th>
                                                        <th className="border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 text-center print:border-slate-800 print:p-1">S</th>
                                                        <th className="border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 text-center print:border-slate-800 print:p-1">I</th>
                                                        <th className="border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 text-center print:border-slate-800 print:p-1">A</th>
                                                        {activeSubTab !== 'siswa' && <th className="border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 text-center print:border-slate-800 print:p-1">T</th>}
                                                        <th className="border border-slate-300 p-3 text-[10px] font-black uppercase text-slate-600 bg-slate-100 font-black print:bg-white print:border-slate-800 print:p-1 text-center">%</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {activeSubTab === 'guru' ? (
                                                        rekapGuruLoading ? (
                                                            Array.from({ length: 5 }).map((_, i) => (
                                                                <tr key={i} className="animate-pulse">
                                                                    <td className="border border-slate-300 p-2"><div className="h-4 bg-slate-200 rounded w-6 mx-auto" /></td>
                                                                    <td className="border border-slate-300 p-2"><div className="h-4 bg-slate-200 rounded w-32" /></td>
                                                                    <td className="border border-slate-300 p-2"><div className="h-4 bg-slate-200 rounded w-20 mx-auto" /></td>
                                                                    <td className="border border-slate-300 p-2"><div className="h-4 bg-slate-200 rounded w-16 mx-auto" /></td>
                                                                    <td className="border border-slate-300 p-2"><div className="h-4 bg-slate-200 rounded w-8 mx-auto" /></td>
                                                                    <td className="border border-slate-300 p-2"><div className="h-4 bg-slate-200 rounded w-8 mx-auto" /></td>
                                                                    <td className="border border-slate-300 p-2"><div className="h-4 bg-slate-200 rounded w-8 mx-auto" /></td>
                                                                    <td className="border border-slate-300 p-2"><div className="h-4 bg-slate-200 rounded w-8 mx-auto" /></td>
                                                                    <td className="border border-slate-300 p-2"><div className="h-4 bg-slate-200 rounded w-8 mx-auto" /></td>
                                                                    <td className="border border-slate-300 p-2"><div className="h-4 bg-slate-200 rounded w-10 mx-auto" /></td>
                                                                </tr>
                                                            ))
                                                        ) : rekapGuruData.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="10" className="p-12 text-center">
                                                                    <div className="flex flex-col items-center gap-3">
                                                                        <AlertCircle size={40} className="text-slate-300" />
                                                                        <p className="text-sm font-bold text-slate-400 italic">Belum ada data rekap absensi guru untuk periode ini.</p>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ) : rekapGuruData.map((row, i) => (
                                                            <tr key={i} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent" style={i === 32 ? { pageBreakAfter: 'always', breakAfter: 'page' } : {}}>
                                                                <td className="sticky left-0 z-10 bg-white border border-slate-300 p-2 text-[11px] text-center font-bold text-slate-500 print:static print:border-slate-800 print:p-1 print:text-[8px]">{i + 1}</td>
                                                                <td className="sticky left-[40px] z-10 bg-white border border-slate-300 p-2 text-[11px] font-bold text-slate-700 whitespace-nowrap print:static print:border-slate-800 print:p-1 print:text-[8px]">{row.guru_nama || '-'}</td>
                                                                <td className="border border-slate-300 p-2 text-[9px] font-bold text-slate-500 text-center print:border-slate-800 print:p-1">{row.jurusan || '-'}</td>
                                                                <td className="border border-slate-300 p-2 text-center print:border-slate-800 print:p-1">
                                                                    <span className="text-[9px] font-mono text-slate-400 print:text-black print:text-[8px]">-</span>
                                                                </td>
                                                                <td className="border border-slate-300 p-2 text-[11px] font-black text-emerald-600 text-center print:border-slate-800 print:text-black print:p-1 print:text-[8px]">{row.hadir ?? 0}</td>
                                                                <td className="border border-slate-300 p-2 text-[11px] font-bold text-amber-500 text-center print:border-slate-800 print:text-black print:p-1 print:text-[8px]">{row.sakit ?? 0}</td>
                                                                <td className="border border-slate-300 p-2 text-[11px] font-bold text-amber-600 text-center print:border-slate-800 print:text-black print:p-1 print:text-[8px]">{row.izin ?? 0}</td>
                                                                <td className="border border-slate-300 p-2 text-[11px] font-bold text-red-500 text-center print:border-slate-800 print:text-black print:p-1 print:text-[8px]">{row.alpha ?? 0}</td>
                                                                <td className="border border-slate-300 p-2 text-[11px] font-bold text-orange-500 text-center print:border-slate-800 print:text-black print:p-1 print:text-[8px]">{row.terlambat ?? 0}</td>
                                                                <td className="border border-slate-300 p-2 text-[11px] font-black text-center bg-slate-50 print:border-slate-800 print:bg-white print:text-black print:p-1 print:text-[8px]">{row.persentase ?? '0.0'}%</td>
                                                            </tr>
                                                        ))
                                                    ) : generateMonthlySummary(activeSubTab === 'staff' ? filteredStaff : siswaByClass).map((row, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent" style={i === 32 ? { pageBreakAfter: 'always', breakAfter: 'page' } : {}}>
                                                            <td className="sticky left-0 z-10 bg-white border border-slate-300 p-2 text-[11px] text-center font-bold text-slate-500 print:static print:border-slate-800 print:p-1 print:text-[8px]">{i + 1}</td>
                                                            <td className="sticky left-[40px] z-10 bg-white border border-slate-300 p-2 text-[11px] font-bold text-slate-700 whitespace-nowrap print:static print:border-slate-800 print:p-1 print:text-[8px]">{stripId(row.name)}</td>
                                                            {activeSubTab === 'siswa' && <td className="border border-slate-300 p-2 text-[9px] font-bold text-slate-500 text-center print:border-slate-800 print:p-1">{row.class || '-'}</td>}
                                                            <td className="border border-slate-300 p-2 text-center print:border-slate-800 print:p-1">
                                                                <span className="text-[9px] font-mono text-slate-400 print:text-black print:text-[8px]">
                                                                    {row.nip || row.employee_id || row.nisn || '-'}
                                                                </span>
                                                            </td>
                                                            <td className="border border-slate-300 p-2 text-[11px] font-black text-emerald-600 text-center print:border-slate-800 print:text-black print:p-1 print:text-[8px]">{row.hadir}</td>
                                                            <td className="border border-slate-300 p-2 text-[11px] font-bold text-amber-500 text-center print:border-slate-800 print:text-black print:p-1 print:text-[8px]">{row.sakit}</td>
                                                            <td className="border border-slate-300 p-2 text-[11px] font-bold text-amber-600 text-center print:border-slate-800 print:text-black print:p-1 print:text-[8px]">{row.izin}</td>
                                                            <td className="border border-slate-300 p-2 text-[11px] font-bold text-red-500 text-center print:border-slate-800 print:text-black print:p-1 print:text-[8px]">{row.alpha}</td>
                                                            {activeSubTab !== 'siswa' && <td className="border border-slate-300 p-2 text-[11px] font-bold text-orange-500 text-center print:border-slate-800 print:text-black print:p-1 print:text-[8px]">{row.terlambat}</td>}
                                                            <td className="border border-slate-300 p-2 text-[11px] font-black text-center bg-slate-50 print:border-slate-800 print:bg-white print:text-black print:p-1 print:text-[8px]">{row.persentase}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="mt-6 flex items-center justify-between px-2">
                                            <div className="flex flex-center flex-col items-start gap-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Hari Kerja Berjalan: {getPassedEffectiveDays(selectedMonth)} Hari</span>
                                                    </div>
                                                    <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Target Efektif: {getEffectiveDays(selectedMonth)} Hari</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <AlertCircle size={10} className="text-amber-500" />
                                                    <span className="text-[9px] font-bold text-slate-400 italic">Rumus: (Hadir / Hari Kerja Berjalan) x 100 untuk akurasi data berjalan.</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 italic">
                                                Menampilkan {activeSubTab === 'guru' ? rekapGuruData.length : generateMonthlySummary(activeSubTab === 'staff' ? staffAttendance : siswaAttendance).length} data
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-10 lg:mt-20 flex justify-between items-end print:mt-6" style={{ pageBreakInside: 'avoid' }}>
                                        <div className="text-left">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                Dicetak Pada : {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </p>
                                            <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter">Verified System Report ID: #{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                                        </div>
                                        <div className="text-center min-w-[200px]">
                                            <p className="text-[11px] font-black uppercase mb-16">Operator Admin Akademik</p>
                                            <div className="w-full h-px bg-slate-800 mb-2" />
                                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{stripId(currentUser?.full_name || currentUser?.name || 'ADMIN AKADEMIK')}</p>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1">NIP. {
                                                currentUser?.nisn_nip ||
                                                currentUser?.nip ||
                                                currentUser?.employee_id ||
                                                currentUser?.id_number ||
                                                currentUser?.no_induk ||
                                                currentUser?.username ||
                                                (currentUser?.school_id?.includes('@') ? currentUser.school_id.split('@')[1] : currentUser?.school_id) ||
                                                currentUser?.id ||
                                                '-'
                                            }</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 border-t border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50 no-print">
                                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                    <AlertCircle size={14} />
                                    Pastikan data sudah divalidasi sebelum cetak
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            if (activeSubTab === 'guru') {
                                                exportToExcel(rekapGuruData.map(r => ({
                                                    Nama: r.guru_nama || '-',
                                                    Hadir: r.hadir ?? 0,
                                                    Sakit: r.sakit ?? 0,
                                                    Izin: r.izin ?? 0,
                                                    Alpha: r.alpha ?? 0,
                                                    Terlambat: r.terlambat ?? 0,
                                                    Persentase: `${r.persentase ?? '0.0'}%`
                                                })), `Rekap_guru_${selectedMonth}`);
                                            } else {
                                                exportToExcel(generateMonthlySummary(activeSubTab === 'staff' ? staffAttendance : siswaAttendance), `Rekap_${activeSubTab}_${selectedMonth}`);
                                            }
                                        }}
                                        className="px-6 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2"
                                    >
                                        <FileSpreadsheet size={18} /> Excel
                                    </button>
                                    <button
                                        onClick={() => {
                                            toast.success('Memulai cetak laporan...');
                                            window.print();
                                        }}
                                        className="px-10 py-4 bg-red-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-red-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                                    >
                                        <Printer size={18} /> Cetak Laporan
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
            {studentSessionModal && createPortal(
                <StudentSessionCorrectionModal
                    session={studentSessionModal}
                    canEdit={canOverrideAttendance}
                    teachersList={teachersList}
                    onClose={() => setStudentSessionModal(null)}
                    onSave={saveStudentSessionCorrection}
                    onConfirmSession={confirmStudentSessionTeaching}
                />,
                document.body
            )}

            {/* OVERRIDE ABSENSI GURU MODAL (Task 9) */}
            {overrideModal.isOpen && createPortal(
                <OverrideModal
                    overrideModal={overrideModal}
                    setOverrideModal={setOverrideModal}
                    handleOverride={handleOverride}
                    teachersList={teachersList}
                />,
                document.body
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteConfirm && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-sm bg-white rounded-[40px] shadow-2xl p-10 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
                            <div className="p-4 bg-red-50 text-red-500 rounded-full w-fit mx-auto mb-6">
                                <Trash2 size={32} />
                            </div>
                            <h4 className="text-lg font-black text-slate-800 mb-2">Konfirmasi Hapus</h4>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
                                Apakah Anda yakin ingin menghapus data presensi <span className="text-red-600 font-black">"{deleteConfirm.name}"</span>? Tindakan ini tidak dapat dibatalkan.
                            </p>
                            <div className="flex gap-4">
                                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all">Batal</button>
                                <button onClick={confirmDelete} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-100">Ya, Hapus</button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {/* CONFIRM ALL HADIR MODAL */}
            {showConfirmAllModal && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-sm bg-white rounded-[40px] shadow-2xl p-10 text-center relative overflow-hidden border border-slate-100">
                            <div className="absolute top-0 left-0 w-full h-2 bg-sky-500" />
                            <div className="p-4 bg-sky-50 text-sky-500 rounded-full w-fit mx-auto mb-6">
                                <CheckCircle size={32} />
                            </div>
                            <h4 className="text-lg font-black text-slate-800 mb-2">Presensi Massal</h4>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
                                Apakah Anda yakin ingin menandai <span className="text-sky-600 font-black">{(activeSubTab === 'staff' ? filteredStaff : activeSubTab === 'guru' ? filteredGuru : filteredSiswa).length} {activeSubTab === 'staff' ? 'Staff' : activeSubTab === 'guru' ? 'Guru' : 'Siswa'}</span> sebagai <span className="text-emerald-500 font-black">HADIR</span> hari ini?
                            </p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowConfirmAllModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Batal</button>
                                <button onClick={executeMarkAllHadir} className="flex-1 py-3 bg-sky-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-sky-100 hover:scale-105 transition-all">Ya, Tandai Hadir</button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

        </div>
    );
};

export default AttendanceTab;




