import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle2, ArrowLeft, ShieldCheck, Mail, Lock, Loader2, User, Calendar, Briefcase, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { validateSchoolId, validatePassword, validateEmail, getPasswordStrength } from '../utils/validation';
import { authAPI } from '../utils/api';

// Impor background dan logo (konsisten dengan LoginPage)
import bgImage from '../assets/images/sekolah.jpg';
import schoolLogo from '../assets/logos/logo22.png';

const REGISTER_VERSION = '2026-03-31-V1';
const ROLE_LABELS = {
  kepala_sekolah: 'Kepala Sekolah',
  wakil_sekolah: 'Wakil Kepala Sekolah',
  guru: 'Guru',
  murid: 'Murid',
  cashier: 'Kasir',
  pusat_jurusan: 'Pusat Jurusan',
};

const POSITION_STATUS_LABELS = {
  tetap: 'Tetap',
  honorer: 'Honorer',
  magang: 'Magang',
};

const PUBLIC_PENDING_ACCESS_ROLES = ['guru', 'murid', 'cashier', 'pusat_jurusan'];
const FIXED_TETAP_ROLES = ['kepala_sekolah', 'wakil_sekolah'];

const stripTitlesForSchoolId = (value) => {
  const normalizedValue = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const withoutPrefixTitles = normalizedValue.replace(/^(?:(?:dr|drs|dra|h|hj|ir|prof|kh|drg)\.?\s+)+/i, '');
  return withoutPrefixTitles.split(',')[0].trim();
};

const normalizeSchoolIdName = (value) =>
  stripTitlesForSchoolId(value)
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();

const buildSchoolId = (fullName, registrationNumber) => {
  const normalizedName = normalizeSchoolIdName(fullName || '');
  const normalizedNumber = (registrationNumber || '').replace(/\D/g, '');

  if (!normalizedName || !normalizedNumber) {
    return '';
  }

  return `${normalizedName}@${normalizedNumber}`;
};

const getRegistrationNumberLengthForRole = (role) => {
  if (!role) {
    return null;
  }

  return role === 'murid' ? 4 : 6;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    gender: '',
    fullName: '',
    registrationNumber: '',
    verificationDocument: null,
    password: '',
    confirmPassword: '',
    accessRole: '',
    positionStatus: '',
    contractEndDate: '',
    agreeTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showConfirmationCard, setShowConfirmationCard] = useState(false);
  const registrationNumberLength = getRegistrationNumberLengthForRole(formData.accessRole);
  const isStudentRole = formData.accessRole === 'murid';
  const isFixedTetapRole = FIXED_TETAP_ROLES.includes(formData.accessRole);
  const effectivePositionStatus = isFixedTetapRole ? 'tetap' : formData.positionStatus;
  const shouldShowContractField = !isStudentRole && !isFixedTetapRole && ['honorer', 'magang'].includes(formData.positionStatus);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'file') {
      const selectedFile = e.target.files?.[0] || null;

      setFormData(prev => ({
        ...prev,
        [name]: selectedFile,
      }));

      if (errors[name]) {
        setErrors(prev => ({
          ...prev,
          [name]: '',
        }));
      }

      setApiError('');
      if (showConfirmationCard) {
        setShowConfirmationCard(false);
      }

      return;
    }

    const normalizedValue = name === 'registrationNumber' ? value.replace(/\D/g, '') : value;
    const activeRegistrationLength = name === 'accessRole'
      ? getRegistrationNumberLengthForRole(normalizedValue)
      : getRegistrationNumberLengthForRole(formData.accessRole);
    const nextValue = type === 'checkbox'
      ? checked
      : name === 'registrationNumber' && activeRegistrationLength
        ? normalizedValue.slice(0, activeRegistrationLength)
        : normalizedValue;
    const nextAccessRole = name === 'accessRole' ? nextValue : formData.accessRole;
    const nextIsStudentRole = nextAccessRole === 'murid';
    const nextIsFixedTetapRole = FIXED_TETAP_ROLES.includes(nextAccessRole);
    const shouldHideContractField = (name === 'positionStatus' && !['honorer', 'magang'].includes(nextValue))
      || (name === 'accessRole' && (nextIsStudentRole || nextIsFixedTetapRole));
    const shouldResetStaffFields = name === 'accessRole' && nextIsStudentRole;
    const shouldLockTetapStatus = name === 'accessRole' && nextIsFixedTetapRole;

    setFormData(prev => {
      const nextRegistrationLength = getRegistrationNumberLengthForRole(nextAccessRole);
      const nextRegistrationNumber = name === 'registrationNumber'
        ? nextValue
        : (nextRegistrationLength ? prev.registrationNumber.slice(0, nextRegistrationLength) : prev.registrationNumber);

      return {
        ...prev,
        [name]: nextValue,
        registrationNumber: nextRegistrationNumber,
        ...(shouldResetStaffFields ? { positionStatus: '', contractEndDate: '' } : {}),
        ...(shouldLockTetapStatus ? { positionStatus: 'tetap', contractEndDate: '' } : {}),
        ...(shouldHideContractField ? { contractEndDate: '' } : {}),
      };
    });
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    if (
      ((shouldResetStaffFields || shouldLockTetapStatus) && (errors.positionStatus || errors.contractEndDate))
      || (shouldHideContractField && errors.contractEndDate)
      || (name === 'accessRole' && errors.registrationNumber)
    ) {
      setErrors(prev => ({
        ...prev,
        ...((shouldResetStaffFields || shouldLockTetapStatus) ? { positionStatus: '', contractEndDate: '' } : {}),
        ...(shouldHideContractField ? { contractEndDate: '' } : {}),
        ...(name === 'accessRole' ? { registrationNumber: '' } : {}),
      }));
    }

    setApiError('');
    if (showConfirmationCard) {
      setShowConfirmationCard(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const generatedSchoolId = buildSchoolId(formData.fullName, formData.registrationNumber);
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email wajib diisi';
    } else {
      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.valid) {
        newErrors.email = 'email yang kamu masukkan tidak sesuai';
      }
    }
    
    // Gender validation
    if (!formData.gender) {
      newErrors.gender = 'Jenis kelamin wajib dipilih';
    }

    if (!formData.accessRole) {
      newErrors.accessRole = 'Role akses wajib dipilih';
    }

    if (formData.accessRole && formData.accessRole !== 'murid' && !FIXED_TETAP_ROLES.includes(formData.accessRole) && !formData.positionStatus) {
      newErrors.positionStatus = 'Status kepegawaian wajib dipilih';
    }

    if (['honorer', 'magang'].includes(formData.positionStatus) && !formData.contractEndDate) {
      newErrors.contractEndDate = 'Tanggal selesai kontrak wajib diisi';
    }
    
    // Name and ID validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Nama lengkap + gelar wajib diisi';
    } else if (!normalizeSchoolIdName(formData.fullName)) {
      newErrors.fullName = 'Nama lengkap + gelar harus mengandung huruf';
    }

    if (!formData.registrationNumber.trim()) {
      newErrors.registrationNumber = 'No induk wajib diisi';
    } else if (formData.registrationNumber !== formData.registrationNumber.replace(/\D/g, '')) {
      newErrors.registrationNumber = 'No induk hanya boleh angka';
    }

    if (!generatedSchoolId) {
      if (!newErrors.fullName) {
        newErrors.fullName = 'Nama lengkap belum bisa dibentuk menjadi ID Portal';
      }
    } else if (formData.accessRole) {
      const idValidation = validateSchoolId(generatedSchoolId, formData.accessRole);
      if (!idValidation.valid && idValidation.errors.length > 0) {
        const primaryError = idValidation.errors[0];

        if (primaryError.includes('4 angka') || primaryError.includes('6 angka')) {
          newErrors.registrationNumber = primaryError
            .replace('ID Murid', 'No induk murid')
            .replace('ID Staff', 'No induk staff');
        } else {
          newErrors.fullName = primaryError;
        }
      }
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password wajib diisi';
    } else {
      const pwdValidation = validatePassword(formData.password);
      if (!pwdValidation.valid) {
        newErrors.password = pwdValidation.errors[0];
      }
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Konfirmasi password wajib diisi';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Password tidak cocok';
    }
    
    // Terms validation
    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'Anda harus menyetujui ketentuan';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setShowConfirmationCard(true);
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    setApiError('');
    
    try {
      const payload = new FormData();
      const normalizedPositionStatus = isStudentRole ? null : (isFixedTetapRole ? 'tetap' : (formData.positionStatus || null));
      const normalizedContractEndDate = shouldShowContractField ? formData.contractEndDate : null;

      payload.append('email', formData.email);
      payload.append('gender', formData.gender);
      payload.append('schoolId', buildSchoolId(formData.fullName, formData.registrationNumber));
      payload.append('name', formData.fullName.trim());
      payload.append('password', formData.password);
      payload.append('password_confirmation', formData.confirmPassword);
      payload.append('accessRole', formData.accessRole);

      if (normalizedPositionStatus) {
        payload.append('positionStatus', normalizedPositionStatus);
      }

      if (normalizedContractEndDate) {
        payload.append('contractEndDate', normalizedContractEndDate);
      }

      if (formData.verificationDocument) {
        payload.append('verificationDocument', formData.verificationDocument);
      }

      const response = await authAPI.register(payload);
      const registrationMessage = response.data?.message || 'Pendaftaran berhasil diproses.';

      setSuccessMessage(registrationMessage);
      setShowConfirmationCard(false);
      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      setShowConfirmationCard(false);
      setApiError(
        error.response?.data?.message || 
        'Pendaftaran gagal. Silakan coba lagi.'
      );
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = formData.password ? getPasswordStrength(formData.password) : null;
  const registerBgUrl = `${bgImage}?v=${REGISTER_VERSION}`;
  const generatedSchoolId = buildSchoolId(formData.fullName, formData.registrationNumber);
  const selectedRoleLabel = ROLE_LABELS[formData.accessRole] || '-';
  const selectedPositionStatusLabel = POSITION_STATUS_LABELS[effectivePositionStatus] || '-';

  // Animasi Framer Motion (Ultra-Smooth)
  const fadeUp = {
    hidden: { opacity: 0, y: 30, filter: 'blur(10px)' },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: 'blur(0px)',
      transition: { duration: 0.8, ease: "easeOut" } 
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
        {/* Background Layer */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center brightness-50"
          style={{ backgroundImage: `url(${registerBgUrl})` }}
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-blue-900/40 to-slate-950/90 backdrop-blur-sm" />
        
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-20 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Pendaftaran Berhasil!
          </h2>
          <p className="text-blue-100/80 mb-8 leading-relaxed">
            {successMessage || (
              <>
                Selamat datang di keluarga besar <br/>
                <span className="font-bold text-blue-300 underline underline-offset-4">SMK Cerdas Satu Bangsa</span>.
                <br /><br />
                Gunakan ID Portal ini saat login:
              </>
            )}
          </p>
          <div className="mb-8 rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-100/50">ID Portal</p>
            <p className="mt-2 text-xl font-bold text-white">{generatedSchoolId}</p>
          </div>
          <p className="text-sm text-blue-100/70">
            {PUBLIC_PENDING_ACCESS_ROLES.includes(formData.accessRole)
              ? 'Status akun Anda akan aktif setelah disetujui Super Admin. Anda akan dialihkan ke halaman login sejenak...'
              : 'Anda akan dialihkan ke halaman login sejenak...'}
          </p>
          <div className="flex justify-center">
            <div className="w-10 h-10 border-4 border-blue-400/20 border-t-blue-400 rounded-full animate-spin" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950 py-8 px-3 sm:px-4 selection:bg-blue-500/30">
      
      {/* 1. LAYER BACKGROUND - FULLSCREEN IMAGE */}
      <motion.div 
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: `url(${registerBgUrl})` }}
      />

      {/* 2. LAYER OVERLAY & AMBIENT LIGHT */}
      <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-950 via-slate-950/90 to-blue-900/40" />
      
      {/* Floating Orbs (Futuristic Atmosphere) */}
      <motion.div 
         animate={{ y: [0, -60, 0], x: [0, 20, 0], scale: [1, 1.2, 1] }}
         transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
         className="absolute top-20 -right-20 w-[40rem] h-[40rem] bg-indigo-600/10 rounded-full blur-[150px] z-10 pointer-events-none"
      />
      <motion.div 
         animate={{ y: [0, 60, 0], x: [0, -30, 0], scale: [1, 1.1, 1] }}
         transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
         className="absolute -bottom-40 -left-20 w-[45rem] h-[45rem] bg-blue-500/10 rounded-full blur-[180px] z-10 pointer-events-none"
      />

      {/* 3. MAIN CONTENT CONTAINER */}
      <div className="relative z-20 mx-auto flex w-full max-w-[52rem] flex-col items-center">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex w-full items-center justify-between px-1"
        >
          <button
            onClick={() => navigate('/')}
            className="group flex items-center gap-2.5 text-blue-200/60 hover:text-white transition-all px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full backdrop-blur-md border border-white/5"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Batal & Kembali</span>
          </button>
          
          <div className="hidden sm:flex items-center gap-1.5">
             <img src={schoolLogo} alt="Logo" className="w-14 h-14 object-contain" />
             <div className="text-left">
                <p className="text-sm text-white font-semibold">SMK Cerdas Satu Bangsa</p>
             </div>
          </div>
        </motion.div>

        {/* GLASSMORPHISM CARD */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.25, duration: 1 }}
          className="relative w-full overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-[0_0_80px_rgba(30,58,138,0.3)] backdrop-blur-2xl md:p-8"
        >
          {/* Decorative Elements inside card */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-400/5 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/5 rounded-full blur-3xl -ml-32 -mb-32" />
          
          <div className="relative z-10">
            <div className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-8 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
              <div>
                <motion.div 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1 }}
                  className="mb-3 inline-flex items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/20 p-3"
                >
                  <UserPlus className="h-8 w-8 text-blue-300" />
                </motion.div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-[2.25rem]">
                  Bergabung <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">Sekarang</span>
                </h1>
                <p className="mt-2 text-base text-blue-100/60">Mulai perjalanan edukasi digital Anda di masa depan.</p>
              </div>
              
              <div className="hidden lg:block text-right">
                 <div className="inline-block px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-400/20">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-tighter">Registration Portal v2.0</span>
                 </div>
              </div>
            </div>

            {apiError && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-4 backdrop-blur-xl"
              >
                <div className="p-2 bg-red-500/20 rounded-lg">
                   <AlertCircle className="w-5 h-5 text-red-300" />
                </div>
                <p className="text-sm font-medium text-red-200">{apiError}</p>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              
              {/* SECTION: IDENTITAS DASAR */}
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                   <ShieldCheck className="w-4 h-4 text-blue-400" />
                   <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Akses & Identitas</h3>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-blue-100/70 uppercase tracking-wider ml-1 flex items-center gap-2">
                       <User className="w-3.5 h-3.5" /> Masukkan Nama Lengkap + Gelar
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className={`w-full rounded-2xl border ${errors.fullName ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-blue-400/50'} bg-slate-900/50 px-4 py-3.5 text-slate-400 outline-none transition-all placeholder:italic placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10`}
                      placeholder="masukkan nama lengkap dan gelar"
                      disabled={loading}
                    />
                    {errors.fullName && (
                      <p className="text-xs text-red-300 flex items-center gap-1.5 mt-1.5 ml-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.fullName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-blue-100/70 uppercase tracking-wider ml-1 flex items-center gap-2">
                       <ShieldCheck className="w-3.5 h-3.5" /> No Induk
                    </label>
                    <input
                      type="text"
                      name="registrationNumber"
                      value={formData.registrationNumber}
                      onChange={handleChange}
                      inputMode="numeric"
                      maxLength={registrationNumberLength ?? undefined}
                      className={`w-full rounded-2xl border ${errors.registrationNumber ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-blue-400/50'} bg-slate-900/50 px-4 py-3.5 text-slate-400 outline-none transition-all placeholder:italic placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10`}
                      placeholder="masukkan no induk kamu"
                      disabled={loading}
                    />
                    {errors.registrationNumber && (
                      <p className="text-xs text-red-300 flex items-center gap-1.5 mt-1.5 ml-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.registrationNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-start">
                  {/* Email */}
                  <div className="flex flex-col gap-2">
                    <label className="ml-1 flex h-5 items-center gap-2 text-xs font-bold uppercase tracking-wider leading-none text-blue-100/70">
                       <Mail className="w-3.5 h-3.5" /> Email Aktif
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`min-h-[52px] w-full rounded-2xl border ${errors.email ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-blue-400/50'} bg-slate-900/50 px-4 py-3.5 text-slate-400 outline-none transition-all placeholder:italic placeholder:text-slate-400`}
                      placeholder="email kamu &quot;..@gmail.com&quot;"
                      disabled={loading}
                    />
                    {errors.email && (
                      <p className="text-xs italic text-red-300 flex items-center gap-1.5 mt-1.5 ml-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Gender & Role (Nested Grid to keep Email width equal) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="ml-1 flex h-5 items-center text-xs font-bold uppercase tracking-wider leading-none text-blue-100/70">Jenis Kelamin</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className={`min-h-[52px] w-full appearance-none cursor-pointer rounded-2xl border ${errors.gender ? 'border-red-400/50' : 'border-white/10'} bg-slate-900/50 px-4 py-3.5 text-slate-200 outline-none transition-all focus:border-blue-400/50 md:text-sm text-xs`}
                        disabled={loading}
                      >
                        <option value="" className="bg-slate-900">Pilih jenis kelamin</option>
                        <option value="L" className="bg-slate-900">{'\u2642'} Laki-laki</option>
                        <option value="P" className="bg-slate-900">{'\u2640'} Perempuan</option>
                      </select>
                      {errors.gender && (
                        <p className="text-xs text-red-300 flex items-center gap-1.5 mt-1.5 ml-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {errors.gender}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="ml-1 flex h-5 items-center gap-2 text-xs font-bold uppercase tracking-wider leading-none text-blue-100/70">
                         <User className="w-3.5 h-3.5" /> Posisi Jabatan
                      </label>
                      <select
                        name="accessRole"
                        value={formData.accessRole}
                        onChange={handleChange}
                        className={`min-h-[52px] w-full appearance-none cursor-pointer rounded-2xl border ${errors.accessRole ? 'border-red-400/50' : 'border-white/10'} bg-slate-900/50 px-4 py-3.5 text-slate-200 outline-none transition-all focus:border-blue-400/50 md:text-sm text-xs`}
                        disabled={loading}
                      >
                        <option value="" className="bg-slate-900">Silahkan pilih</option>
                        <option value="guru" className="bg-slate-900">Guru</option>
                        <option value="murid" className="bg-slate-900">Murid</option>
                        <option value="cashier" className="bg-slate-900">Kasir</option>
                        <option value="pusat_jurusan" className="bg-slate-900">Pusat Jurusan</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Conditional Fields: Staff info */}
                <AnimatePresence mode="wait">
                  {formData.accessRole && formData.accessRole !== 'murid' && (
                    <motion.div 
                      key="staff-fields"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className={`grid grid-cols-1 ${shouldShowContractField ? 'md:grid-cols-2' : ''} gap-5 overflow-hidden pt-1`}
                    >
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-100/70 uppercase tracking-wider ml-1 flex items-center gap-2">
                           <Briefcase className="w-3.5 h-3.5" /> Status Kepegawaian
                        </label>
                        <select
                          name="positionStatus"
                          value={effectivePositionStatus}
                          onChange={handleChange}
                          className={`w-full appearance-none cursor-pointer rounded-2xl border ${errors.positionStatus ? 'border-red-400/50' : 'border-white/10'} bg-slate-900/50 px-4 py-3.5 text-slate-400 outline-none transition-all focus:border-blue-400/50`}
                          disabled={loading || isFixedTetapRole}
                        >
                          {!isFixedTetapRole && (
                          <option value="" className="bg-slate-900">Pilih Status</option>
                          )}
                          <option value="tetap" className="bg-slate-900">Tetap</option>
                          <option value="honorer" className="bg-slate-900">Honorer</option>
                          <option value="magang" className="bg-slate-900">Magang</option>
                        </select>
                        {isFixedTetapRole && (
                          <p className="ml-1 text-[10px] italic text-blue-100/55">
                            Posisi strategis ini otomatis dikunci sebagai pegawai tetap.
                          </p>
                        )}
                      </div>

                      <AnimatePresence initial={false}>
                        {shouldShowContractField && (
                          <motion.div
                            key="contract-end-date"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="space-y-2"
                          >
                            <label className="text-xs font-bold text-blue-100/70 uppercase tracking-wider ml-1 flex items-center gap-2">
                               <Calendar className="w-3.5 h-3.5" /> Selesai Kontrak
                            </label>
                            <input
                              type="date"
                              name="contractEndDate"
                              value={formData.contractEndDate}
                              onChange={handleChange}
                              className={`w-full rounded-2xl border ${errors.contractEndDate ? 'border-red-400/50' : 'border-white/10'} bg-slate-900/50 px-4 py-3.5 text-slate-400 outline-none transition-all focus:border-blue-400/50 dark:[color-scheme:dark]`}
                              disabled={loading}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-blue-100/70 uppercase tracking-wider ml-1 flex items-center gap-2">
                       <ShieldCheck className="w-3.5 h-3.5" /> ID Portal Pengguna
                    </label>
                    <div className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3">
                      <span className={`pr-4 ${generatedSchoolId ? 'text-slate-400' : 'italic text-slate-400'}`}>
                        {generatedSchoolId || 'membaca sistem masukkan'}
                      </span>
                      {generatedSchoolId ? (
                        <Lock className="h-4 w-4 shrink-0 text-blue-200/40" />
                      ) : (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-200/40" />
                      )}
                    </div>
                    <p className="ml-1 text-[10px] italic text-slate-400">
                      ID pengguna dibuat otomatis oleh sistem.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-blue-100/70 uppercase tracking-wider ml-1 flex items-center gap-2">
                       <Upload className="w-3.5 h-3.5" /> Upload Kartu Pelajar / KTP
                    </label>
                    <label className={`flex min-h-[52px] w-full cursor-pointer items-center justify-between rounded-2xl border ${errors.verificationDocument ? 'border-red-400/50' : 'border-white/10'} bg-slate-900/50 px-4 py-3 transition-all hover:border-blue-400/40`}>
                      <span className={`pr-4 ${formData.verificationDocument ? 'text-slate-400' : 'italic text-slate-400'}`}>
                        {formData.verificationDocument?.name || 'pilih file verifikasi kamu'}
                      </span>
                      <span className="inline-flex shrink-0 items-center rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                        Unggah
                      </span>
                      <input
                        type="file"
                        name="verificationDocument"
                        accept=".jpg,.jpeg,.png"
                        onChange={handleChange}
                        className="hidden"
                        disabled={loading}
                      />
                    </label>
                  </div>
                </div>
              </motion.div>

              {/* SECTION: KEAMANAN */}
              <div className="space-y-5 pt-2">
                <div className="flex items-center gap-2 mb-2">
                   <Lock className="w-4 h-4 text-indigo-400" />
                   <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Enkripsi & Keamanan</h3>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {/* Password */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-blue-100/70 uppercase tracking-wider ml-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className={`w-full rounded-2xl border ${errors.password ? 'border-red-400/50 focus:border-red-400' : 'border-white/10 focus:border-blue-400/50'} bg-slate-900/50 px-4 py-3.5 pr-12 text-slate-400 outline-none transition-all placeholder:italic placeholder:text-slate-400`}
                        placeholder="masukkan password"
                        disabled={loading}
                        maxLength={12}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-200/30 transition-colors hover:text-white"
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-red-300 flex items-center gap-1.5 mt-1.5 ml-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.password}
                      </p>
                    )}
                    {passwordStrength && (
                      <div className="px-1 pt-1">
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <span className="text-[10px] text-blue-100/40 uppercase font-bold tracking-tighter">Strength</span>
                          <span className={`text-[10px] font-bold uppercase ${passwordStrength.color.replace('bg-', 'text-')}`}>{passwordStrength.text}</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden border border-white/5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ 
                              width: passwordStrength.level === 'weak' ? '33%' : 
                                     passwordStrength.level === 'medium' ? '66%' : '100%' 
                            }}
                            className={`h-full transition-all duration-500 ${passwordStrength.color} shadow-[0_0_10px_rgba(59,130,246,0.3)]`}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-blue-100/70 uppercase tracking-wider ml-1">Ulangi Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={`w-full rounded-2xl border ${
                          errors.confirmPassword ? 'border-red-400/50' : 
                          formData.confirmPassword && formData.password === formData.confirmPassword ? 'border-green-500/50 focus:border-green-400' :
                          formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500/50 focus:border-red-400' : 'border-white/10 focus:border-blue-400/50'
                        } bg-slate-900/50 px-4 py-3.5 pr-12 text-slate-400 outline-none transition-all placeholder:italic placeholder:text-slate-400`}
                        placeholder="konfirmasi password"
                        disabled={loading}
                        maxLength={12}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-200/30 transition-colors hover:text-white"
                        disabled={loading}
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {formData.confirmPassword && (
                        <motion.p 
                          initial={{ opacity: 0, y: -5 }} 
                          animate={{ opacity: 1, y: 0 }}
                          className={`mt-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ml-1 ${
                            formData.password === formData.confirmPassword ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {formData.password === formData.confirmPassword ? (
                            <><CheckCircle2 className="w-3.5 h-3.5" /> Matched</>
                          ) : (
                            <><AlertCircle className="w-3.5 h-3.5" /> No Match</>
                          )}
                        </motion.p>
                      )}
                    </AnimatePresence>
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-300 flex items-center gap-1.5 mt-1.5 ml-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* TERMS & SUBMIT */}
              <div className="space-y-5 pt-6">
                <label className="group flex cursor-pointer items-center gap-3 px-1 py-1.5">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      name="agreeTerms"
                      checked={formData.agreeTerms}
                      onChange={handleChange}
                      className="w-5 h-5 rounded border-white/20 bg-slate-900/50 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 transition-all cursor-pointer accent-blue-500"
                      disabled={loading}
                    />
                  </div>
                  <span className="text-sm leading-tight text-slate-400">
                    Saya menyetujui syarat dan ketentuan serta kebijakan privasi yang berlaku <span className="text-red-500 font-bold">*</span>
                  </span>
                </label>

                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: "0px 0px 30px rgba(37, 99, 235, 0.4)" }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-base font-bold tracking-wide text-white shadow-xl transition-all hover:from-blue-500 hover:to-indigo-500"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  {loading ? (
                    <>
                      <div className="h-5 w-5 rounded-full border-[3px] border-white/20 border-t-white animate-spin" />
                      <span>Memproses Data...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5" />
                      <span>Buat Akun Sekarang</span>
                    </>
                  )}
                </motion.button>

                <p className="text-center text-sm text-blue-200/40">
                  Sudah memiliki akun?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="text-blue-300 hover:text-blue-200 font-bold hover:underline transition-all underline-offset-4"
                    disabled={loading}
                  >
                    Masuk ke Login Portal
                  </button>
                </p>
              </div>

            </form>

            <AnimatePresence>
              {showConfirmationCard && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 24, scale: 0.94 }}
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
                    className="w-full max-w-lg rounded-[2rem] border border-white/15 bg-slate-950/90 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.55)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-500/15">
                        <CheckCircle2 className="h-7 w-7 text-blue-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300/70">Konfirmasi Akun</p>
                        <h3 className="mt-2 text-2xl font-black text-white">Periksa data sebelum akun dibuat</h3>
                        <p className="mt-3 text-sm leading-relaxed text-blue-100/65">
                          Kalau semua sudah sesuai, lanjutkan untuk membuat akun baru dan menyimpan data ini ke sistem.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-blue-100/40">Nama Dashboard</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formData.fullName || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-blue-100/40">Email</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formData.email || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-blue-100/40">Role</p>
                        <p className="mt-2 text-sm font-semibold text-white">{selectedRoleLabel}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-blue-100/40">ID Portal</p>
                        <p className="mt-2 text-sm font-semibold text-white">{generatedSchoolId || 'Belum terbentuk'}</p>
                      </div>
                      {formData.accessRole && formData.accessRole !== 'murid' && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 sm:col-span-2">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-blue-100/40">Status Kepegawaian</p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {selectedPositionStatusLabel}
                            {shouldShowContractField && formData.contractEndDate ? ` • ${formData.contractEndDate}` : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setShowConfirmationCard(false)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-blue-100/80 transition hover:bg-white/10"
                        disabled={loading}
                      >
                        Periksa Lagi
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmSubmit}
                        className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={loading}
                      >
                        {loading ? 'Membuat Akun...' : 'Ya, Buat Akun'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
