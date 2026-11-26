import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Mail, KeyRound, ShieldCheck, AlertCircle, AlertTriangle, Sparkles, Clock3, Shield, ArrowLeft } from 'lucide-react';
import { authAPI } from '../utils/api';
import { getPasswordStrength, getRoleFromId, validatePassword, validateSchoolId } from '../utils/validation';
import ForgotPasswordRequestStep from '../components/auth/ForgotPasswordRequestStep';
import ForgotPasswordVerifyStep from '../components/auth/ForgotPasswordVerifyStep';
import ForgotPasswordResetStep from '../components/auth/ForgotPasswordResetStep';
import bgImage from '../assets/images/sekolah.jpg';
import schoolLogo from '../assets/logos/logo22.png';
import operatorImg from '../assets/logos/operator.jpg';


const STEP_ORDER = ['request', 'verify', 'reset'];
const RECOVERY_BG_VERSION = '2026-03-31-otp-3';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('request');
  const [formData, setFormData] = useState({
    schoolId: '',
    otp: '',
    resetToken: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const currentStepIndex = STEP_ORDER.indexOf(step);
  const passwordStrength = formData.newPassword ? getPasswordStrength(formData.newPassword) : null;
  const recoveryBackgroundUrl = `${bgImage}?v=${RECOVERY_BG_VERSION}`;

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'otp' ? value.replace(/\D/g, '').slice(0, 6) : value;

    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    setApiError('');
  };

  const validateSchoolIdStep = () => {
    const value = formData.schoolId.trim();

    if (!value) {
      setErrors({ schoolId: 'ID pengguna wajib diisi' });
      return false;
    }

    const validation = validateSchoolId(value, getRoleFromId(value));

    if (!validation.valid) {
      setErrors({ schoolId: validation.errors[0] });
      return false;
    }

    setErrors({});
    return true;
  };

  const validateOtpStep = () => {
    const newErrors = {};

    if (!validateSchoolId(formData.schoolId.trim(), getRoleFromId(formData.schoolId.trim())).valid) {
      newErrors.schoolId = 'Masukkan ID pengguna yang valid';
    }

    if (!formData.otp) {
      newErrors.otp = 'Kode OTP wajib diisi';
    } else if (formData.otp.length !== 6) {
      newErrors.otp = 'Kode OTP harus 6 digit';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordStep = () => {
    const newErrors = {};

    if (!validateSchoolId(formData.schoolId.trim(), getRoleFromId(formData.schoolId.trim())).valid) {
      newErrors.schoolId = 'Masukkan ID pengguna yang valid';
    }

    if (!formData.resetToken) {
      newErrors.otp = 'Sesi reset tidak ditemukan. Verifikasi OTP lagi.';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'Password baru wajib diisi';
    } else {
      const passwordValidation = validatePassword(formData.newPassword);
      if (!passwordValidation.valid) {
        newErrors.newPassword = passwordValidation.errors[0];
      }
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Konfirmasi password wajib diisi';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Password tidak cocok';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFlowToRequest = () => {
    setStep('request');
    setVerifiedEmail('');
    setInfoMessage('');
    setApiError('');
    setErrors({});
    setFormData(prev => ({
      ...prev,
      otp: '',
      resetToken: '',
      newPassword: '',
      confirmPassword: ''
    }));
  };

  const handleVerifyUser = async (event) => {
    event.preventDefault();

    if (!validateSchoolIdStep()) return;

    setLoading(true);
    setApiError('');

    try {
      const response = await authAPI.verifyResetUser({
        schoolId: formData.schoolId.trim()
      });

      setVerifiedEmail(response.data.email || '');
      setInfoMessage('Data akun berhasil diverifikasi. Klik Send OTP untuk melanjutkan.');
      setErrors({});
      setFormData(prev => ({
        ...prev,
        otp: '',
        resetToken: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error) {
      setInfoMessage('');
      setApiError(error.response?.data?.message || 'Data akun gagal diverifikasi. Coba lagi beberapa saat.');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    const response = await authAPI.sendResetOtp({
      schoolId: formData.schoolId.trim()
    });

    const email = response.data.email || verifiedEmail;

    setVerifiedEmail(email);
    setStep('verify');
    setInfoMessage(response.data.message || `OTP terkirim ke: ${email}`);
    setErrors({});
    setFormData(prev => ({
      ...prev,
      otp: '',
      resetToken: '',
      newPassword: '',
      confirmPassword: ''
    }));
  };

  const handleSendOtp = async () => {
    if (!validateSchoolIdStep()) return;

    setLoading(true);
    setApiError('');

    try {
      await sendOtp();
    } catch (error) {
      setInfoMessage('');
      setApiError(error.response?.data?.message || 'Gagal mengirim kode OTP. Coba lagi beberapa saat.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();

    if (!validateOtpStep()) return;

    setLoading(true);
    setApiError('');

    try {
      const response = await authAPI.verifyResetOtp({
        schoolId: formData.schoolId.trim(),
        otp: formData.otp
      });

      setStep('reset');
      setInfoMessage(response.data.message);
      setErrors({});
      setFormData(prev => ({
        ...prev,
        resetToken: response.data.resetToken,
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error) {
      setInfoMessage('');
      setApiError(error.response?.data?.message || 'Kode OTP tidak valid atau sudah kedaluwarsa.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (!validatePasswordStep()) return;

    setLoading(true);
    setApiError('');

    try {
      await authAPI.resetPassword({
        schoolId: formData.schoolId.trim(),
        resetToken: formData.resetToken,
        newPassword: formData.newPassword,
        newPassword_confirmation: formData.confirmPassword
      });

      setStep('success');

      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error) {
      setInfoMessage('');
      setApiError(error.response?.data?.message || 'Gagal mengubah password. Silakan verifikasi OTP lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!validateSchoolIdStep()) return;

    setLoading(true);
    setApiError('');

    try {
      await sendOtp();
    } catch (error) {
      setInfoMessage('');
      setApiError(error.response?.data?.message || 'Gagal mengirim ulang kode OTP.');
    } finally {
      setLoading(false);
    }
  };

  const stepIcon = step === 'request'
    ? <Mail className="w-9 h-9 text-white" />
    : step === 'verify'
      ? <ShieldCheck className="w-9 h-9 text-white" />
      : <KeyRound className="w-9 h-9 text-white" />;

  const fadeUp = {
    hidden: { opacity: 0, y: 36, filter: 'blur(10px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.8, ease: 'easeOut' }
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen relative overflow-hidden bg-slate-950">
        <motion.div
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${recoveryBackgroundUrl})` }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.12),_transparent_32%),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92),rgba(17,24,39,0.86))]" />
        <div className="absolute -top-20 left-10 h-72 w-72 rounded-full bg-slate-300/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-teal-300/10 blur-[140px]" />

        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900/40 p-8 text-center text-white shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
          >
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800/70 ring-1 ring-emerald-100/20">
              <CheckCircle2 className="h-10 w-10 text-emerald-200" />
            </div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-800/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-100">
              <Sparkles className="h-3.5 w-3.5 text-teal-200" />
              Password Recovery v2.0
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Password Berhasil Diperbarui</h2>
            <p className="mt-3 text-sm leading-6 text-slate-200/80">
              Kata sandi baru sudah aktif dan seluruh sesi lama telah ditutup. Anda akan dialihkan kembali ke halaman login.
            </p>
            <div className="mx-auto mt-6 h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      <motion.div
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${recoveryBackgroundUrl})` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.12),_transparent_26%),linear-gradient(135deg,rgba(2,6,23,0.97),rgba(15,23,42,0.93),rgba(17,24,39,0.86))]" />
      <motion.div
        animate={{ y: [0, -25, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-20 top-16 h-80 w-80 rounded-full bg-slate-300/10 blur-[120px]"
      />
      <motion.div
        animate={{ y: [0, 35, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        className="absolute -right-8 bottom-0 h-[26rem] w-[26rem] rounded-full bg-teal-400/10 blur-[140px]"
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10">
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
            <span className="text-sm font-medium">Batal</span>
          </button>
          <div className="hidden sm:flex items-center gap-1.5">
             <img src={schoolLogo} alt="Logo" className="w-14 h-14 object-contain" />
             <div className="text-left">
                <p className="text-sm text-white font-semibold">SMK Cerdas Satu Bangsa</p>
             </div>
          </div>
        </motion.div>

        <div className="flex flex-col gap-14 lg:flex-row lg:items-center lg:justify-between flex-1">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.14, delayChildren: 0.12 }
            }
          }}
          className="hidden lg:flex lg:w-[48%] lg:flex-col"
        >




          <motion.h1 variants={fadeUp} className="max-w-xl text-5xl font-black leading-[1.08] tracking-tight text-white">
            Reset password dengan alur yang lebih
            {' '}
            <span className="bg-gradient-to-r from-slate-100 via-teal-100 to-sky-200 bg-clip-text text-transparent">
              elegan, aman, dan jelas.
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-6 max-w-xl text-lg leading-8 text-slate-200/80">
            Portal ini memastikan hanya pemilik email resmi yang bisa melanjutkan perubahan kata sandi. Semua tahapan dirancang ringkas, modern, dan mudah diikuti.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 grid grid-cols-3 gap-4">
            {[
              { icon: Shield, title: 'OTP 6 Digit', text: 'Kode unik dikirim ke email resmi pengguna.' },
              { icon: Clock3, title: '5 Menit Aktif', text: 'Kode cepat kedaluwarsa untuk mengurangi risiko.' },
              { icon: KeyRound, title: 'Sesi Lama Putus', text: 'Setelah reset, token login lama langsung dicabut.' }
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="rounded-[1.6rem] border border-white/10 bg-slate-900/30 p-5 backdrop-blur-md shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200/20 to-teal-200/10 text-slate-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-200/80">{item.text}</p>
                </div>
              );
            })}
          </motion.div>

          <motion.div 
            variants={fadeUp}
            whileHover={{ scale: 1.015 }}
            className="mt-8 group relative overflow-hidden rounded-2xl border border-rose-500/20 bg-slate-900/50 p-5 backdrop-blur-xl transition-all cursor-default shadow-[0_8px_30px_rgba(225,29,72,0.12)] hover:border-rose-500/40 hover:shadow-[0_8px_40px_rgba(225,29,72,0.25)]"
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-500/10 blur-[30px] transition-all duration-500 group-hover:bg-rose-500/25 group-hover:blur-[40px]" />
            
            <div className="relative z-10 flex items-start gap-4">
              <div 
                className="mt-1.5 flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[1rem] border border-white/20 bg-white/5 p-[2px] shadow-lg backdrop-blur-md transition-all group-hover:border-rose-400/40"
              >
                <img 
                  src={operatorImg} 
                  alt="Operator" 
                  className="h-full w-full rounded-[0.85rem] object-cover px-0" 
                />
              </div>
              <div>
                <h4 className="mb-1 text-[0.75rem] font-bold uppercase tracking-wider text-rose-300/90">Butuh Bantuan Langsung?</h4>
                <p className="text-[0.875rem] font-medium leading-relaxed text-slate-300">
                  Akses bisa dipulihkan secara luring. Kunjungi <strong className="bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent font-bold">Operator Sekolah</strong> dengan membawa <strong className="text-white font-semibold">Kartu Identitas Anda</strong>.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 34 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.85, delay: 0.2, ease: 'easeOut' }}
          className="w-full lg:flex lg:w-[46%] lg:justify-end"
        >
          <div className="w-full max-w-xl">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-7 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-8">
              <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-slate-300/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-20 h-52 w-52 rounded-full bg-teal-300/10 blur-3xl" />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-800/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-100">
                  <Sparkles className="h-3.5 w-3.5 text-teal-200" />
                  Password Recovery v2.0
                </div>

                <div className="mt-6 flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white sm:text-[2rem]">Lupa Password</h1>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-200/80">
                      Verifikasi ID pengguna dulu, kirim OTP ke email akun yang tersimpan, lalu buat kata sandi baru dengan aman.
                    </p>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-white/10 bg-slate-800/40 text-white shadow-inner shadow-white/5">
                    {stepIcon}
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'request', label: 'Verifikasi Data' },
                    { id: 'verify', label: 'Masukkan OTP' },
                    { id: 'reset', label: 'Password Baru' }
                  ].map((item, index) => {
                    const itemIndex = STEP_ORDER.indexOf(item.id);
                    const isActive = currentStepIndex >= itemIndex;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border px-3 py-3 text-center text-xs font-semibold transition-all ${
                          isActive
                            ? 'border-teal-200/20 bg-slate-800/60 text-white shadow-[0_12px_25px_rgba(15,23,42,0.18)]'
                            : 'border-white/10 bg-slate-900/20 text-slate-300/70'
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Step {index + 1}</div>
                        <div className="mt-1">{item.label}</div>
                      </div>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  {apiError && (
                    <motion.div
                      key={`error-${apiError}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 backdrop-blur-sm"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-200" />
                        <p className="text-sm leading-6 text-rose-50">{apiError}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {infoMessage && !apiError && (
                    <motion.div
                      key={`info-${infoMessage}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 backdrop-blur-sm"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-200" />
                        <p className="text-sm leading-6 text-emerald-50">{infoMessage}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-6">
                  {step === 'request' && (
                    <ForgotPasswordRequestStep
                      schoolId={formData.schoolId}
                      verifiedEmail={verifiedEmail}
                      loading={loading}
                      errors={errors}
                      onChange={handleChange}
                      onVerifyUser={handleVerifyUser}
                      onSendOtp={handleSendOtp}
                      onResetVerifiedUser={resetFlowToRequest}
                    />
                  )}

                  {step === 'verify' && (
                    <ForgotPasswordVerifyStep
                      schoolId={formData.schoolId}
                      email={verifiedEmail}
                      otp={formData.otp}
                      loading={loading}
                      errors={errors}
                      onChange={handleChange}
                      onSubmit={handleVerifyOtp}
                      onResendOtp={handleResendOtp}
                      onChangeAccount={resetFlowToRequest}
                    />
                  )}

                  {step === 'reset' && (
                    <ForgotPasswordResetStep
                      schoolId={formData.schoolId}
                      email={verifiedEmail}
                      newPassword={formData.newPassword}
                      confirmPassword={formData.confirmPassword}
                      showNewPassword={showNewPassword}
                      showConfirmPassword={showConfirmPassword}
                      loading={loading}
                      errors={errors}
                      passwordStrength={passwordStrength}
                      onChange={handleChange}
                      onSubmit={handleResetPassword}
                      onToggleNewPassword={() => setShowNewPassword(prev => !prev)}
                      onToggleConfirmPassword={() => setShowConfirmPassword(prev => !prev)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
        </div>
      </div>
    </div>
  );
}
