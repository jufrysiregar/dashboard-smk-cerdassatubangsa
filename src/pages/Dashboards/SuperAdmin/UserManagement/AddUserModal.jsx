import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, User, Mail, Phone, Lock, ChevronDown, Eye, EyeOff, RefreshCw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { operatorAPI } from '../../../../utils/api';
import useBodyScrollLock from '../../../../utils/useBodyScrollLock';
import DatePickerInput from '../../../../components/shared/DatePickerInput';
import ScrollableSelect from '../../../../components/shared/ScrollableSelect';

// Jabatan / role fungsional saja. "Honorer / Magang" BUKAN jabatan, melainkan
// status kepegawaian (lihat STATUS_OPTIONS di bawah).
const ROLE_OPTIONS = [
  { value: 'murid',          label: 'Murid',                     color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { value: 'guru',           label: 'Guru',                      color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  { value: 'cashier',        label: 'Kasir',                     color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  { value: 'pusat_jurusan',  label: 'Pusat Jurusan',             color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
  { value: 'kepala_sekolah', label: 'Kepala Sekolah',            color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { value: 'wakil_sekolah',  label: 'Wakil Kepala Sekolah',      color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff' },
  { value: 'operator',       label: 'Super Admin - Operator',    color: '#374151', bg: '#f9fafb', border: '#d1d5db' },
  { value: 'admin_akademik', label: 'Admin Akademik - Operator', color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
];
const ROLE_VALUES = ROLE_OPTIONS.map(r => r.value);

// Jabatan yang TIDAK punya pilihan status kepegawaian.
const STATUS_FIXED_ROLES = ['murid', 'kepala_sekolah', 'wakil_sekolah'];

const STATUS_OPTIONS = [
  { value: 'tetap',   label: 'TETAP' },
  { value: 'honorer', label: 'HONORER' },
  { value: 'magang',  label: 'MAGANG' },
];

// Pesan apresiasi default saat honorer/magang diangkat menjadi pegawai tetap.
const defaultAppreciationMessage = (name) =>
  `Terima kasih atas dedikasi dan kontribusi ${name} selama mengabdi. `
  + `Selamat atas pengangkatan sebagai Pegawai Tetap — ruang kerja dan hak akses Anda sudah aktif sepenuhnya.`;

const PLACEMENT_OPTIONS = {
  magang: [
    { value: 'kasir', label: 'Kasir' }, { value: 'pusat_jurusan', label: 'Pusat Jurusan' },
    { value: 'admin_akademik', label: 'Admin Akademik' }, { value: 'guru', label: 'Guru' },
    { value: 'perpustakaan', label: 'Perpustakaan' }, { value: 'tata_usaha', label: 'Tata Usaha' },
  ],
  honorer: [
    { value: 'kasir', label: 'Kasir' }, { value: 'pusat_jurusan', label: 'Pusat Jurusan' },
    { value: 'admin_akademik', label: 'Admin Akademik' }, { value: 'guru', label: 'Guru' },
    { value: 'perpustakaan', label: 'Perpustakaan' }, { value: 'tata_usaha', label: 'Tata Usaha' },
    { value: 'kantin', label: 'Kantin' }, { value: 'keamanan', label: 'Keamanan' },
  ],
};

const DEFAULT_FORM = {
  name: '',
  identity_number: '',
  nisn_nip: '',
  secondary_identity_number: '',
  username_prefix: '',
  access_role: '',
  birth_place: '',
  birth_date: '',
  gender: '',
  position_status: '',
  joined_at: '',
  contract_end_date: '',
  is_active: true,
  email: '',
  phone: '',
  whatsapp: '',
  parent_phone: '',
  password: 'password',
  jurusan_id: '',
  subject_name: '',
  penempatan_di: '',
  penanggung_jawab_id: '',
  special_start_date: '',
  special_end_date: '',
  special_status: 'aktif',
  catatan_super_admin: '',
};

const AddUserModal = ({ isOpen, onClose, onSuccess, userToEdit = null, allUsers = [], kbmMasterData = {} }) => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [initialSnapshot, setInitialSnapshot] = useState(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const genderDropdownRef = useRef(null);
  const [usernameError, setUsernameError] = useState('');
  const [nisnError, setNisnError] = useState('');
  const [pembimbingSearch, setPembimbingSearch] = useState('');
  const [isPembimbingListOpen, setIsPembimbingListOpen] = useState(false);

  // Daftar jurusan & kelas diambil SEGAR dari API saat modal dibuka, supaya id
  // yang dikirim ke backend tidak basi (menghindari "jurusan id is invalid").
  const [jurusans, setJurusans] = useState(Array.isArray(kbmMasterData?.jurusans) ? kbmMasterData.jurusans : []);

  const [autoGenerate, setAutoGenerate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Pesan apresiasi pengangkatan tetap (muncul hanya saat honorer/magang -> tetap).
  const [promotionMessage, setPromotionMessage] = useState('');

  const isEdit = !!userToEdit;
  const identityLimit = form.access_role === 'murid' ? 4 : 6;
  const isStudent = form.access_role === 'murid';
  const statusEligible = form.access_role !== '' && !STATUS_FIXED_ROLES.includes(form.access_role);
  const showContract = statusEligible && ['honorer', 'magang'].includes(form.position_status);
  const requiresJurusan = form.access_role === 'pusat_jurusan';

  // Deteksi pengangkatan tetap: profil asal honorer/magang (atau role magang_honor)
  // yang pada form ini dipilih menjadi TETAP.
  const wasSpecialStaff = isEdit && (
    ['honorer', 'magang'].includes((userToEdit.position_status || '').toLowerCase())
    || (userToEdit.access_role || userToEdit.role) === 'magang_honor'
  );
  const isPromotionToTetap = wasSpecialStaff && form.position_status === 'tetap';

  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '', text: '' };
    const checks = [pwd.length >= 8, /[A-Z]/.test(pwd), /[0-9]/.test(pwd), /[^A-Za-z0-9]/.test(pwd)];
    const score = checks.filter(Boolean).length;
    if (score <= 1) return { score, label: 'Sangat Lemah', color: 'bg-red-500', text: 'text-red-600' };
    if (score === 2) return { score, label: 'Lemah', color: 'bg-orange-400', text: 'text-orange-600' };
    if (score === 3) return { score, label: 'Cukup', color: 'bg-yellow-400', text: 'text-yellow-600' };
    return { score, label: 'Kuat', color: 'bg-emerald-500', text: 'text-emerald-600' };
  };
  const pwdStrength = getPasswordStrength(form.password);

  useEffect(() => {
    if (!isGenderDropdownOpen) return undefined;
    const closeOnOutsideClick = event => {
      if (!genderDropdownRef.current?.contains(event.target)) setIsGenderDropdownOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isGenderDropdownOpen]);

  // Esc untuk menutup modal (house-style).
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const generateCode = async () => {
    setIsGenerating(true);
    try {
      const type = form.access_role === 'murid' ? 'murid' : 'staff';
      const res = await operatorAPI.generateUniqueCode({ type, prefix: form.username_prefix });
      if (res.data.success) set('identity_number', String(res.data.code).replace(/\D/g, '').slice(0, identityLimit));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal generate kode unik. Coba lagi.');
      setAutoGenerate(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoGenerateToggle = async (checked) => {
    if (checked && !form.access_role) { toast.error('Pilih jabatan terlebih dahulu.'); return; }
    setAutoGenerate(checked);
    if (checked) await generateCode();
    else set('identity_number', '');
  };

  const splitLoginParts = (schoolId, username, accessRole) => {
    const maxDigits = accessRole === 'murid' ? 4 : 6;
    const rawSchoolId = String(schoolId || '');
    const rawUsername = String(username || '');
    const rawLogin = rawSchoolId.includes('@') ? rawSchoolId : rawUsername.includes('@') ? rawUsername : rawSchoolId;
    if (rawLogin.includes('@')) {
      const [prefix = '', number = ''] = rawLogin.split('@');
      return { usernamePrefix: prefix.toLowerCase().replace(/[^a-z]/g, ''), identityNumber: number.replace(/\D/g, '').slice(0, maxDigits) };
    }
    return { usernamePrefix: rawUsername.split('@')[0].toLowerCase().replace(/[^a-z]/g, ''), identityNumber: rawSchoolId.replace(/\D/g, '').slice(0, maxDigits) };
  };

  // Tarik daftar jurusan segar setiap modal dibuka.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    operatorAPI.getMasterData()
      .then(res => {
        if (cancelled) return;
        const list = res.data?.data?.jurusans;
        if (Array.isArray(list) && list.length) setJurusans(list);
      })
      .catch(() => { /* pakai fallback kbmMasterData yang sudah ada di state awal */ });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Pre-fill lengkap saat modal dibuka / user target berubah.
  useEffect(() => {
    if (!isOpen) return;
    if (userToEdit) {
      let accessRole = userToEdit.access_role || userToEdit.role || '';
      // Kompatibilitas data lama: role 'magang_honor' dipetakan ke jabatan
      // penempatannya bila cocok, jika tidak jatuh ke 'guru'.
      if (accessRole === 'magang_honor') {
        const placement = userToEdit.magang?.penempatan_di || userToEdit.honorer?.penempatan_di;
        accessRole = ROLE_VALUES.includes(placement) ? placement : 'guru';
      }
      const { usernamePrefix, identityNumber } = splitLoginParts(userToEdit.school_id, userToEdit.username, accessRole);
      const positionStatus = accessRole === 'murid' ? '' : (userToEdit.position_status || 'tetap');

      const initial = {
        ...DEFAULT_FORM,
        name: userToEdit.name || '',
        identity_number: identityNumber,
        nisn_nip: userToEdit.nisn_nip || '',
        secondary_identity_number: userToEdit.secondary_identity_number || '',
        username_prefix: usernamePrefix,
        birth_place: userToEdit.birth_place || '',
        birth_date: (userToEdit.birth_date || '').substring(0, 10),
        gender: userToEdit.gender || '',
        access_role: accessRole,
        position_status: positionStatus,
        joined_at: userToEdit.joined_at || '',
        contract_end_date: userToEdit.contract_end_date || '',
        is_active: String(userToEdit.is_active) !== '0' && userToEdit.is_active !== false,
        email: userToEdit.email || '',
        phone: userToEdit.phone || '',
        whatsapp: userToEdit.whatsapp || '',
        parent_phone: userToEdit.parent_phone || '',
        password: '',
        jurusan_id: (userToEdit.jurusan_id ?? userToEdit.jurusanId) ? String(userToEdit.jurusan_id ?? userToEdit.jurusanId) : '',
        subject_name: userToEdit.subject_name || '',
        penempatan_di: userToEdit.magang?.penempatan_di || userToEdit.honorer?.penempatan_di || '',
        penanggung_jawab_id: userToEdit.magang?.pembimbing_id || userToEdit.honorer?.penanggung_jawab_id || '',
        special_start_date: (userToEdit.magang?.tanggal_mulai || userToEdit.honorer?.kontrak_mulai || userToEdit.joined_at || '').substring(0, 10),
        special_end_date: (userToEdit.magang?.tanggal_selesai || userToEdit.honorer?.kontrak_selesai || userToEdit.contract_end_date || '').substring(0, 10),
        special_status: userToEdit.magang?.status || userToEdit.honorer?.status || 'aktif',
        catatan_super_admin: userToEdit.magang?.catatan_super_admin || userToEdit.honorer?.catatan_super_admin || '',
      };
      setForm(initial);
      setInitialSnapshot(initial);
      setAutoGenerate(false);
      const currentId = userToEdit.magang?.pembimbing_id || userToEdit.honorer?.penanggung_jawab_id;
      const currentPerson = allUsers.find(u => String(u.id) === String(currentId));
      setPembimbingSearch(currentPerson ? currentPerson.name : '');
    } else {
      setForm({ ...DEFAULT_FORM, password: 'password' });
      setInitialSnapshot({ ...DEFAULT_FORM, password: 'password' });
      setAutoGenerate(false);
      setPembimbingSearch('');
    }
  }, [isOpen, userToEdit]);

  // Saat form berubah menjadi pengangkatan tetap, siapkan pesan apresiasi default;
  // selain itu kosongkan agar tidak terkirim.
  useEffect(() => {
    if (!isOpen) { setPromotionMessage(''); return; }
    if (isPromotionToTetap) {
      setPromotionMessage((prev) => (prev.trim() === '' ? defaultAppreciationMessage(userToEdit?.name || '') : prev));
    } else {
      setPromotionMessage('');
    }
  }, [isOpen, isPromotionToTetap, userToEdit]);

  useEffect(() => {
    if (form.identity_number.length > identityLimit) {
      setForm(prev => ({ ...prev, identity_number: prev.identity_number.slice(0, identityLimit) }));
    }
  }, [form.access_role, form.identity_number, identityLimit]);

  useEffect(() => {
    const fullUsername = form.username_prefix + (form.identity_number ? '@' + form.identity_number : '');
    if (fullUsername.trim() && allUsers.length > 0) {
      const isTaken = allUsers.some(u => {
        if (isEdit && String(u.id) === String(userToEdit?.id)) return false;
        return (u.username || u.school_id) === fullUsername;
      });
      setUsernameError(isTaken ? 'Username telah digunakan, silakan ganti awalan.' : '');
    } else {
      setUsernameError('');
    }
  }, [form.username_prefix, form.identity_number, allUsers, isEdit, userToEdit]);

  useEffect(() => {
    setNisnError(form.nisn_nip && !/^\d+$/.test(form.nisn_nip) ? 'Nomor identitas utama hanya boleh berisi angka.' : '');
  }, [form.nisn_nip]);

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const availableJurusans = Array.isArray(jurusans) ? jurusans : [];
  const selectedRole = ROLE_OPTIONS.find(r => r.value === form.access_role);
  const accentColor = '#2563eb';
  const accentBg = '#eff6ff';
  const accentBdr = '#bfdbfe';

  const isUsernameValid = form.username_prefix.trim() !== '' && form.identity_number.toString().trim().length === identityLimit;
  const normalizedEmail = form.email.trim().toLowerCase();
  const emailLooksValid = normalizedEmail === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const emailAlreadyUsed = normalizedEmail !== '' && allUsers.some(user =>
    String(user.email || '').trim().toLowerCase() === normalizedEmail && !(isEdit && String(user.id) === String(userToEdit?.id))
  );
  const contractDatesInvalid = showContract && form.special_start_date && form.special_end_date && form.special_end_date < form.special_start_date;
  const contractMissing = showContract && (!form.special_start_date || !form.special_end_date);

  const penanggungJawabOptions = allUsers.filter(u => {
    const userRole = u.access_role || u.role;
    const userStatus = u.position_status || 'tetap';
    const isSameUser = isEdit && String(u.id) === String(userToEdit?.id);
    return userRole !== 'murid' && userRole !== 'magang_honor' && userStatus !== 'magang' && userStatus !== 'honorer'
      && u.is_active !== false && !isSameUser
      && (!pembimbingSearch.trim() || u.name.toLowerCase().includes(pembimbingSearch.toLowerCase()));
  });

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialSnapshot);
  const hasRequiredChanges = !isEdit || isDirty;

  const isValid = form.name.trim() !== ''
    && isUsernameValid
    && form.gender !== ''
    && form.access_role !== ''
    && emailLooksValid && !emailAlreadyUsed && !usernameError && !nisnError && !isGenerating
    && (!requiresJurusan || form.jurusan_id !== '')
    && !contractDatesInvalid && !contractMissing
    && (!isEdit || !form.password || pwdStrength.score === 4);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleRoleChange = (value) => {
    setAutoGenerate(false);
    setForm(previous => ({
      ...previous,
      access_role: value,
      position_status: value === 'murid' ? '' : (STATUS_FIXED_ROLES.includes(value) ? 'tetap' : 'tetap'),
      penempatan_di: '', penanggung_jawab_id: '', special_start_date: '', special_end_date: '',
      parent_phone: value === 'murid' ? previous.parent_phone : '',
    }));
    setPembimbingSearch('');
    setIsPembimbingListOpen(false);
  };

  const handleSubmit = async () => {
    if (!isValid || !hasRequiredChanges || isSaving || isGenerating) return;
    setIsSaving(true);
    try {
      const loginId = form.username_prefix + (form.identity_number ? '@' + form.identity_number : '');
      const payload = {
        name: form.name,
        school_id: loginId,
        username: loginId,
        birth_place: form.birth_place || undefined,
        birth_date: form.birth_date || undefined,
        gender: form.gender,
        access_role: form.access_role,
        position_status: isStudent ? undefined : form.position_status || 'tetap',
        joined_at: showContract ? form.special_start_date : undefined,
        contract_end_date: showContract ? form.special_end_date : undefined,
        is_active: form.is_active,
        email: form.email.trim() || null,
        phone: form.phone || null,
        whatsapp: isStudent ? (form.phone || null) : (form.phone || null),
        parent_phone: isStudent ? (form.parent_phone || null) : null,
        jurusan_id: requiresJurusan ? (form.jurusan_id ? Number(form.jurusan_id) : null) : (isStudent ? (form.jurusan_id ? Number(form.jurusan_id) : null) : null),
        subject_name: form.access_role === 'guru' ? form.subject_name : undefined,
        nisn_nip: form.nisn_nip || null,
        secondary_identity_number: form.secondary_identity_number || null,
      };

      if (showContract && form.penempatan_di) {
        if (form.position_status === 'magang') {
          payload.magang_data = {
            penempatan_di: form.penempatan_di,
            pembimbing_id: form.penanggung_jawab_id || null,
            tanggal_mulai: form.special_start_date,
            tanggal_selesai: form.special_end_date,
            status: form.special_status,
            catatan_super_admin: form.catatan_super_admin,
          };
        } else {
          payload.honorer_data = {
            penempatan_di: form.penempatan_di,
            penanggung_jawab_id: form.penanggung_jawab_id || null,
            kontrak_mulai: form.special_start_date,
            kontrak_selesai: form.special_end_date,
            status: form.special_status,
            catatan_super_admin: form.catatan_super_admin,
          };
        }
      }

      if (form.password.trim()) payload.password = form.password;

      // Pengangkatan honorer/magang -> tetap: sertakan pesan apresiasi.
      if (isEdit && isPromotionToTetap) {
        payload.promotion_message = promotionMessage || defaultAppreciationMessage(form.name) || undefined;
      }

      if (isEdit) {
        await operatorAPI.updateUser(userToEdit.id, payload);
        toast.success(`Data ${form.name} berhasil diperbarui!`);
        onSuccess();
        onClose();
      } else {
        const res = await operatorAPI.createUser(payload);
        const createdUser = res.data?.data || {};
        toast.success(`Akun ${form.name} berhasil dibuat!`);
        onSuccess(createdUser);
        onClose();
      }
    } catch (err) {
      const raw = err.response?.data;
      const msg = (raw?.errors ? Object.values(raw.errors).flat().join(', ') : '') || raw?.message || `Gagal ${isEdit ? 'memperbarui' : 'membuat'} akun`;
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = "w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-[#0f172a] focus:outline-none focus:bg-white focus:border-blue-500 transition-all";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-md animate-fadeIn" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[calc(100vh-2rem)] flex flex-col bg-white/95 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-500 animate-slideUp" style={{ border: `2px solid ${accentBdr}` }}>
        {/* Header */}
        <div className="px-10 py-8 flex items-center justify-between shrink-0" style={{ background: accentBg, borderBottom: `1px solid ${accentBdr}` }}>
          <div>
            <h2 className="text-[22px] font-black text-[#0f172a] tracking-tight">{isEdit ? 'Edit Profil Pengguna' : 'Tambah Akun Baru'}</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                {selectedRole ? `JABATAN: ${selectedRole.label}` : 'Pilih jabatan'}
              </span>
              {statusEligible && form.position_status && (
                <span className="px-3 py-1 bg-slate-700 rounded-lg text-[10px] font-black uppercase tracking-widest text-white">
                  STATUS: {form.position_status.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-black/5 transition-all active:scale-90">
            <X className="w-6 h-6 text-[#475569]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-10 grid grid-cols-2 gap-x-12 gap-y-8 flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar">
          {/* KOLOM KIRI */}
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Nama Lengkap <span className="text-rose-500">*</span></label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value.replace(/[^a-zA-Z\s.,]/g, ''))} className={inputCls} />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Jenis Kelamin <span className="text-rose-500">*</span></label>
              <div ref={genderDropdownRef} className="relative">
                <button type="button" onClick={() => setIsGenderDropdownOpen(o => !o)} aria-haspopup="listbox" aria-expanded={isGenderDropdownOpen} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left text-[13px] font-bold text-[#0f172a] transition-all hover:border-blue-300 hover:bg-white focus:border-blue-500 focus:outline-none">
                  <span className={`flex items-center gap-3 ${form.gender ? 'text-[#0f172a]' : 'text-slate-400'}`}>
                    {form.gender ? <><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-lg font-black ${form.gender === 'L' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>{form.gender === 'L' ? '♂' : '♀'}</span>{form.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</> : 'Pilih jenis kelamin'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isGenderDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isGenderDropdownOpen && <div role="listbox" className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  {[{ value: 'L', label: 'Laki-laki', icon: '♂', iconClass: 'bg-blue-100 text-blue-600' }, { value: 'P', label: 'Perempuan', icon: '♀', iconClass: 'bg-pink-100 text-pink-600' }].map(option => <button key={option.value} type="button" onClick={() => { set('gender', option.value); setIsGenderDropdownOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold transition-colors ${form.gender === option.value ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-lg font-black ${option.iconClass}`}>{option.icon}</span>{option.label}</button>)}
                </div>}
              </div>
            </div>

            {/* Kotak Jabatan / Role */}
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 shadow-sm">
              <label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Pilih Jabatan / Role <span className="text-rose-500">*</span></label>
              <ScrollableSelect value={form.access_role} onChange={handleRoleChange} options={ROLE_OPTIONS} placeholder="-- Pilih jabatan --" />
              {requiresJurusan && <div className="mt-5"><label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Pilih Jurusan <span className="text-rose-500">*</span></label><select value={form.jurusan_id} onChange={e => set('jurusan_id', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[13px] font-bold text-[#0f172a] focus:border-blue-500 focus:outline-none"><option value="">-- Pilih Jurusan --</option>{availableJurusans.map(m => <option key={m.id} value={m.id}>{m.code || m.kode || '-'} ({String(m.name || m.nama || '').replace('&', 'dan')})</option>)}</select><p className="mt-2 px-1 text-[10px] font-bold text-slate-400">Pilihan diambil dari Master Data Akademik.</p></div>}
            </div>

            {/* Status Kepegawaian (terpisah dari jabatan) */}
            {statusEligible && (
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 shadow-sm">
                <label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Status Kepegawaian <span className="text-rose-500">*</span></label>
                <div className="flex gap-2">{STATUS_OPTIONS.map(option => <button key={option.value} type="button" onClick={() => { set('position_status', option.value); set('penempatan_di', ''); }} className={`flex-1 rounded-xl border-2 py-3 text-[10px] font-black transition-all ${form.position_status === option.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300'}`}>{option.label}</button>)}</div>

                {showContract && (
                  <div className="mt-5 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Tanggal Mulai <span className="text-rose-500">*</span></label><DatePickerInput value={form.special_start_date} onChange={v => set('special_start_date', v)} minYear={new Date().getFullYear() - 20} maxYear={new Date().getFullYear() + 30} /></div>
                      <div><label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Tanggal Berakhir <span className="text-rose-500">*</span></label><DatePickerInput value={form.special_end_date} onChange={v => set('special_end_date', v)} minYear={new Date().getFullYear() - 20} maxYear={new Date().getFullYear() + 30} minDate={form.special_start_date} durationFrom={form.special_start_date} /></div>
                      {contractDatesInvalid && <p className="col-span-2 px-1 text-[10px] font-bold text-rose-500">Tanggal berakhir tidak boleh sebelum tanggal mulai.</p>}
                    </div>
                    <div><label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Ditempatkan di</label><ScrollableSelect value={form.penempatan_di} onChange={v => set('penempatan_di', v)} options={PLACEMENT_OPTIONS[form.position_status] || []} placeholder="-- Pilih unit penempatan --" /></div>
                    <div>
                      <label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Penanggung Jawab <span className="font-bold normal-case text-slate-400">(Opsional)</span></label>
                      <div className="relative"><input value={pembimbingSearch} onChange={e => { setPembimbingSearch(e.target.value); setIsPembimbingListOpen(true); }} onFocus={() => setIsPembimbingListOpen(true)} placeholder="Cari nama penanggung jawab..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 pr-11 text-[13px] font-bold text-[#0f172a] focus:border-blue-500 focus:outline-none" />{(isPembimbingListOpen || pembimbingSearch) && <button type="button" onClick={() => { setPembimbingSearch(''); set('penanggung_jawab_id', ''); setIsPembimbingListOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-rose-500"><X className="h-4 w-4" /></button>}</div>
                      {isPembimbingListOpen && <div className="!mt-1 max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-b-xl border border-slate-200 bg-white">{penanggungJawabOptions.length ? penanggungJawabOptions.map(p => <button key={p.id} type="button" onClick={() => { set('penanggung_jawab_id', p.id); setPembimbingSearch(p.name); setIsPembimbingListOpen(false); }} className="block w-full px-4 py-3 text-left text-sm font-bold text-[#0f172a] hover:bg-blue-50">{p.name}</button>) : <div className="px-4 py-3 text-sm font-bold text-slate-400">Tidak ada penanggung jawab.</div>}</div>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nomor HP / WhatsApp dinamis (terpisah dari kotak jabatan) */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">No HP / Wa Pribadi</label>
                <div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" /><input inputMode="numeric" value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} placeholder="080012345678" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-[#0f172a] focus:outline-none focus:bg-white focus:border-blue-500 transition-all" /></div>
              </div>
              {isStudent && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">No HP Orangtua / Wali</label>
                  <div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" /><input inputMode="numeric" value={form.parent_phone} onChange={e => set('parent_phone', e.target.value.replace(/\D/g, ''))} placeholder="080012345678" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-[#0f172a] focus:outline-none focus:bg-white focus:border-emerald-500 transition-all" /></div>
                </div>
              )}
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Nomor Identitas <span className="text-slate-400 font-bold normal-case">(NISN / NIP)</span></label>
              <input value={form.nisn_nip} maxLength={18} inputMode="numeric" onChange={e => set('nisn_nip', e.target.value.replace(/\D/g, '').slice(0, 18))} placeholder="Masukkan jika tersedia" className={`w-full px-4 py-3.5 rounded-xl border text-[13px] font-bold text-[#0f172a] transition-all outline-none ${nisnError ? 'bg-slate-50 border-rose-400' : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500'}`} />
              {nisnError && <p className="mt-1.5 px-1 text-[10px] font-bold text-rose-500">{nisnError}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Nomor Identitas Sekunder <span className="text-slate-400 font-bold normal-case">(NIS / NUPTK)</span></label>
              <input value={form.secondary_identity_number} maxLength={255} onChange={e => set('secondary_identity_number', e.target.value)} placeholder="Huruf, angka, atau karakter khusus" className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-bold text-[#0f172a] focus:border-blue-500 focus:bg-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Email <span className="text-slate-400 font-bold normal-case">(Opsional)</span></label>
              <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" /><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="nama@email.com" className={`w-full pl-11 pr-4 py-3.5 bg-slate-50 border rounded-xl text-[13px] font-bold text-[#0f172a] focus:outline-none focus:bg-white transition-all ${form.email && (!emailLooksValid || emailAlreadyUsed) ? 'border-rose-400' : 'border-slate-200 focus:border-blue-500'}`} /></div>
              {form.email && !emailLooksValid && <p className="mt-1.5 px-1 text-[10px] font-bold text-rose-500">Format email belum valid.</p>}
              {emailAlreadyUsed && <p className="mt-1.5 px-1 text-[10px] font-bold text-rose-500">Email sudah digunakan akun lain.</p>}
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Angka Unik Login Sekolah <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input value={form.identity_number} readOnly={autoGenerate} disabled={!form.access_role} onChange={e => !autoGenerate && set('identity_number', e.target.value.replace(/\D/g, '').slice(0, identityLimit))} placeholder={!form.access_role ? 'Pilih jabatan dulu...' : autoGenerate ? 'Dibuat otomatis...' : `Ketik ${identityLimit} angka...`} className={`w-full px-4 py-3.5 pr-20 rounded-xl border text-[13px] font-bold text-[#0f172a] outline-none transition-all ${!form.access_role || autoGenerate ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500'}`} />
                {autoGenerate && <button type="button" onClick={generateCode} disabled={isGenerating || !form.access_role} className="absolute right-10 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 disabled:opacity-50" title="Generate ulang">{isGenerating ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <RefreshCw className="w-4 h-4" />}</button>}
                <label className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" title={autoGenerate ? 'Nonaktifkan generate otomatis' : 'Generate otomatis'}>
                  <input type="checkbox" checked={autoGenerate} onChange={e => handleAutoGenerateToggle(e.target.checked)} disabled={!form.access_role || isGenerating} className="w-4 h-4 rounded border-slate-300 accent-blue-600 disabled:opacity-50" />
                </label>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">ID Login Kamu <span className="text-rose-500">*</span></label>
              <div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" /><input value={form.username_prefix} disabled={!form.access_role} onChange={e => set('username_prefix', e.target.value.toLowerCase().replace(/[^a-z]/g, ''))} className="w-full pl-11 pr-28 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-[#0f172a] focus:outline-none focus:bg-white focus:border-blue-500 transition-all disabled:bg-slate-100 disabled:text-slate-400" /><span className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg bg-slate-200/80 text-[12px] font-black text-slate-500 pointer-events-none">@{form.identity_number || 'x'.repeat(identityLimit)}</span></div>
            </div>
            {isEdit && <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Password Baru <span className="text-slate-400 font-bold normal-case">(Kosongi jika tidak diubah)</span></label>
              <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" /><input type={showPassword ? 'text' : 'password'} value={form.password} placeholder="Min. 8 karakter, huruf besar, angka, simbol" onChange={e => set('password', e.target.value)} className={`w-full pl-11 pr-12 py-3.5 bg-slate-50 border rounded-xl text-[13px] font-bold text-[#0f172a] focus:outline-none focus:bg-white transition-all ${form.password && pwdStrength.score < 4 ? 'border-orange-300' : 'border-slate-200 focus:border-blue-500'}`} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-blue-600" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
              {form.password && <div className="mt-2 space-y-1.5"><div className="flex gap-1">{[1, 2, 3, 4].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full ${pwdStrength.score >= i ? pwdStrength.color : 'bg-slate-200'}`} />)}</div><p className={`text-[10px] font-black ${pwdStrength.text}`}>{pwdStrength.label}</p></div>}
            </div>}
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Tempat Lahir</label><input value={form.birth_place} onChange={e => set('birth_place', e.target.value.replace(/[^a-zA-Z\s]/g, '').toUpperCase())} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-[#0f172a] uppercase focus:outline-none focus:bg-white focus:border-blue-500" /></div><div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Tanggal Lahir</label><DatePickerInput value={form.birth_date} onChange={v => set('birth_date', v)} /></div></div>

            {/* Blok opsional: pengangkatan honorer/magang menjadi pegawai tetap */}
            {isPromotionToTetap && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">Pesan Apresiasi Pengangkatan Tetap</p>
                </div>
                <p className="text-[11px] text-amber-700/80 font-medium mb-3 leading-relaxed">
                  Opsional — ucapan selamat yang dikirim ke lonceng &amp; pop-up kejutan saat yang bersangkutan login berikutnya. Bisa diedit atau dibiarkan apa adanya.
                </p>
                <textarea value={promotionMessage} onChange={e => setPromotionMessage(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-white text-[13px] font-medium text-[#0f172a] focus:outline-none focus:border-amber-500 resize-none" />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-8 flex items-center justify-end gap-4 shrink-0" style={{ borderTop: `1px solid ${accentBdr}`, background: accentBg }}>
          <button onClick={onClose} className="px-8 py-4 rounded-full font-black text-[12px] uppercase tracking-[0.2em] text-[#64748b] hover:bg-black/5 transition-all active:scale-95">Batal</button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || !hasRequiredChanges || isSaving || isGenerating}
            className="px-12 py-4 rounded-full font-black text-[12px] uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-xl active:scale-95 disabled:scale-100"
            style={isValid && hasRequiredChanges && !isSaving && !isGenerating
              ? { background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`, color: 'white', boxShadow: `0 10px 30px ${accentColor}44` }
              : { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed', boxShadow: 'none' }}
          >
            {isSaving && <Loader2 className="w-5 h-5 animate-spin" />}
            {isSaving ? 'MEMPROSES...' : isEdit ? 'SIMPAN PERUBAHAN' : 'BUAT AKUN SEKARANG'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AddUserModal;
