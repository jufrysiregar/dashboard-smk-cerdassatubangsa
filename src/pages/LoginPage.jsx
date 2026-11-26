import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle, Moon, Lock, ShieldAlert, X, Clock, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '../utils/api';

import bgImage from '../assets/images/sekolah.jpg';
import schoolLogo from '../assets/logos/logo-smk.png';

const LOGIN_BG_VERSION = '2026-03-31-4';

// 1-Click Role Login — credentials mirror "Tutorial dan Data User.md".
const QUICK_LOGINS = [
  { label: 'Super Admin', schoolId: 'superadmin@164990', password: 'Super!138.', color: 'from-violet-500 to-purple-600' },
  { label: 'Admin Akademik', schoolId: 'randyasha@000058', password: 'Super!140.', color: 'from-indigo-500 to-blue-600' },
  { label: 'Guru', schoolId: 'budisantoso@000040', password: 'Budi123_', color: 'from-emerald-500 to-teal-600' },
  { label: 'Murid', schoolId: 'agussari@0028', password: 'Agussari123_', color: 'from-sky-500 to-cyan-600' },
  { label: 'Kasir', schoolId: 'ahmadjkk@000055', password: 'Adhmad123_', color: 'from-amber-500 to-orange-600' },
  { label: 'Kepala Sekolah', schoolId: 'muhtadinn@000053', password: 'Muhtadin123_', color: 'from-rose-500 to-pink-600' },
  { label: 'Wakepsek', schoolId: 'elinaph@000054', password: 'Elina123_', color: 'from-fuchsia-500 to-pink-600' },
  { label: 'Pusat Jurusan', schoolId: 'hendrasanjaya@000059', password: 'Hendra123_', color: 'from-lime-500 to-green-600' },
  { label: 'Magang & Honorer', schoolId: 'farhanlaburehia@000065', password: 'Farhan123_', color: 'from-cyan-500 to-blue-600' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    schoolId: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [systemStatus, setSystemStatus] = useState(null); // 'sleep' | 'maintenance' | null
  const loginBackgroundUrl = `${bgImage}?v=${LOGIN_BG_VERSION}`;

  const clearErrors = () => {
    if (apiError) setApiError('');
    if (systemStatus) setSystemStatus(null);
    if (Object.keys(errors).length > 0) setErrors({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    setApiError('');
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.schoolId.trim()) {
      newErrors.schoolId = 'ID Sekolah wajib diisi';
    }
    if (!formData.password) {
      newErrors.password = 'Password wajib diisi';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const performLogin = async (schoolId, password) => {
    setLoading(true);
    setApiError('');
    try {
      const response = await authAPI.login({ schoolId: String(schoolId).trim().toLowerCase(), password });
      localStorage.removeItem('activeAcademicCalendar');
      localStorage.removeItem('academicCalendarTitle');
      localStorage.removeItem('calendarPublished');
      sessionStorage.setItem('token', response.data.token);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      sessionStorage.removeItem('sleep_redirecting');
      sessionStorage.removeItem('sleep_data');
      sessionStorage.removeItem('sleep_countdown_started');
      navigate('/dashboard');
    } catch (error) {
      const data = error.response?.data;
      if (data?.system_status === 'maintenance') {
        setSystemStatus({ type: 'maintenance', message: data.message, estimatedEnd: data.estimated_end });
      } else {
        setApiError(data?.message || 'Login gagal. Coba kredensial lain.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role) => performLogin(role.schoolId, role.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setApiError('');
    try {
      const response = await authAPI.login({
        ...formData,
        schoolId: formData.schoolId.trim().toLowerCase(),
      });
      
      // AUTO-SYNC CLEAR: Pastikan data kalender lama terhapus saat login baru
      localStorage.removeItem('activeAcademicCalendar');
      localStorage.removeItem('academicCalendarTitle');
      localStorage.removeItem('calendarPublished');
      
      sessionStorage.setItem('token', response.data.token);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
      sessionStorage.removeItem('sleep_redirecting');
      sessionStorage.removeItem('sleep_data');
      sessionStorage.removeItem('sleep_countdown_started');
      // Jika server cleaning aktif, simpan pesan untuk ditampilkan di dashboard
      if (response.data.system_status === 'cleaning') {
        sessionStorage.setItem('cleaning_login_message', response.data.cleaning_message || 'Super Admin sedang membersihkan server. Sistem mungkin sedikit lambat.');
      } else {
        sessionStorage.removeItem('cleaning_login_message');
      }
      navigate('/dashboard');
    } catch (error) {
      const data = error.response?.data;
      if (data?.system_status === 'maintenance') {
        setSystemStatus({ type: 'maintenance', message: data.message, estimatedEnd: data.estimated_end });
      } else if (data?.system_status === 'sleep') {
        setSystemStatus({ type: 'sleep', message: data.message });
      } else if (data?.system_status === 'operator_not_online') {
        setSystemStatus({ type: 'operator_not_online', message: data.message, start: data.start, end: data.end });
      } else if (data?.system_status === 'locked') {
        setSystemStatus({ type: 'locked', message: data.message });
      } else {
        setApiError(data?.message || 'Login gagal. Periksa kembali ID dan password Anda.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      onClick={clearErrors}
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black selection:bg-white/30"
    >
      
      {/* 1. LAYER BACKGROUND - VISIBLE SCHOOL BACKGROUND WITH PARALLAX FEEL */}
      <motion.div 
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loginBackgroundUrl})` }}
      />

      {/* 2. LAYER OVERLAY - VERY SUBTLE TINT (NO HEAVY BLACK OUT) */}
      <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px]" />
      
      {/* Floating Dynamic Gradients behind the card to make it pop */}
      <motion.div 
         animate={{ x: [-100, 100, -100], y: [-50, 50, -50], rotate: [0, 90, 0] }}
         transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
         className="absolute top-1/4 right-1/4 w-[40rem] h-[40rem] bg-gradient-to-r from-teal-400/20 to-emerald-500/20 rounded-full blur-[100px] z-10 pointer-events-none"
      />
      <motion.div 
         animate={{ x: [100, -100, 100], y: [50, -50, 50], rotate: [0, -90, 0] }}
         transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
         className="absolute bottom-1/4 left-1/4 w-[40rem] h-[40rem] bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-full blur-[100px] z-10 pointer-events-none"
      />

      {/* 3. LAYER KONTEN UTAMA */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20">
        
        {/* BAGIAN KIRI: Typografi dengan gaya eksklusif */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, ease: 'easeOut' }}
          className="hidden lg:flex w-1/2 flex-col text-white"
        >
          <div className="w-24 h-24 mb-8 bg-white/10 backdrop-blur-2xl rounded-[2rem] p-4 border border-white/20 shadow-2xl">
            <img src={schoolLogo} alt="Logo SMK" className="w-full h-full object-contain filter drop-shadow-lg" />
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold mb-4 leading-tight tracking-tight drop-shadow-2xl">
            Sistem Manajemen <br/>
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]">
              SekolahKU
            </span>
          </h1>

          <div className="w-20 h-1 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full mb-8 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>

          <motion.h2 
            animate={{ 
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              filter: [
                "drop-shadow(0 0 10px rgba(250,204,21,0.3))", 
                "drop-shadow(0 0 25px rgba(250,204,21,0.8))", 
                "drop-shadow(0 0 10px rgba(250,204,21,0.3))"
              ]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ backgroundSize: '200% auto' }}
            className="text-3xl sm:text-4xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-100 to-amber-400 tracking-[0.05em] uppercase inline-block"
          >
            SMK Cerdas Satu Bangsa
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.6, duration: 1 }}
            className="relative mt-8 pl-6 py-2 border-l-[3px] border-cyan-400/40"
          >
            <motion.div 
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute top-0 left-0 -ml-[3px] w-[3px] h-full bg-gradient-to-b from-emerald-400 via-cyan-400 to-blue-500 blur-md" 
            />
            <p className="text-lg text-white/90 leading-[1.8] font-light italic max-w-lg tracking-wide drop-shadow-lg">
              Mentransformasi potensi bangsa melalui pendidikan berbasis teknologi yang cerdas, aman, dan terintegrasi untuk mencetak generasi terbaik bagi masa depan Indonesia.
            </p>
          </motion.div>
        </motion.div>

        {/* BAGIAN KANAN: FORM "VISION PRO" STYLE GLASSMORPHISM (NON-KLASIK) */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
          className="w-full lg:w-[450px]"
        >
          {/* KOTAK SUPER-ROUNDED VISION PRO STYLE */}
          <div className="relative p-8 sm:p-12 rounded-[3.5rem] bg-white/[0.08] backdrop-blur-[40px] border border-white/[0.15] shadow-[0_30px_60px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]">
            
            <div className="lg:hidden flex flex-col items-center text-center mb-8">
              <div className="w-20 h-20 bg-white/10 rounded-[1.5rem] p-3 border border-white/20 mb-4 shadow-xl">
                <img src={schoolLogo} alt="Logo Mobile" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-1 shadow-black/50 drop-shadow-md">SekolahKU</h2>
              <motion.p 
                animate={{ 
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  filter: [
                    "drop-shadow(0 0 5px rgba(250,204,21,0.4))", 
                    "drop-shadow(0 0 15px rgba(250,204,21,0.9))", 
                    "drop-shadow(0 0 5px rgba(250,204,21,0.4))"
                  ]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                style={{ backgroundSize: '200% auto' }}
                className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-100 to-amber-400 text-sm font-black tracking-[0.2em] uppercase inline-block"
              >
                SMK Cerdas Satu Bangsa
              </motion.p>
            </div>

            <div className="hidden lg:block mb-10">
              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Selamat Datang</h2>
              <p className="text-white/60 font-medium">Silakan login ke akun Anda</p>
            </div>

            <AnimatePresence>
              {systemStatus && systemStatus.type !== 'maintenance' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.9 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.9 }}
                  className={`mb-8 p-5 rounded-[1.5rem] backdrop-blur-xl border text-white text-sm shadow-lg ${
                    systemStatus.type === 'locked'
                      ? 'bg-cyan-500/20 border-cyan-500/30'
                      : systemStatus.type === 'operator_not_online'
                      ? 'bg-amber-500/20 border-amber-500/30'
                      : 'bg-blue-500/20 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {systemStatus.type === 'locked'
                      ? <Lock className="w-6 h-6 flex-shrink-0 text-cyan-300 mt-0.5" />
                      : systemStatus.type === 'operator_not_online'
                      ? <ShieldAlert className="w-6 h-6 flex-shrink-0 text-amber-300 mt-0.5" />
                      : <Moon className="w-6 h-6 flex-shrink-0 text-blue-300 mt-0.5" />
                    }
                    <div className="space-y-1">
                      <p className="font-black uppercase tracking-widest text-xs">
                        {systemStatus.type === 'locked' ? 'Akses Terkunci' :
                         systemStatus.type === 'operator_not_online' ? 'Menunggu Operator Sekolah' :
                         'Server Sleep Mode'}
                      </p>
                      <p className="font-medium text-white/80">{systemStatus.message}</p>
                      {systemStatus.type === 'operator_not_online' && systemStatus.start && systemStatus.end && (
                        <p className="text-xs text-white/50 mt-1">Jam operasional: {systemStatus.start} – {systemStatus.end} WIB</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {apiError && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, scale: 0.9 }} animate={{ opacity: 1, height: 'auto', scale: 1 }} exit={{ opacity: 0, height: 0, scale: 0.9 }}
                  className="mb-8 p-4 rounded-[1.5rem] bg-red-500/20 backdrop-blur-xl border border-red-500/30 text-white text-sm flex gap-3 items-center shadow-lg"
                >
                  <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-200" />
                  <p className="font-medium text-red-100">{apiError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* ID Pengguna - BENTUK PILL (ROUNDED-FULL) */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80 px-2 tracking-wide">ID Pengguna</label>
                <div className="relative">
                  <input
                    type="text"
                    name="schoolId"
                    value={formData.schoolId}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Username"
                    className={`w-full bg-black/20 text-white ${errors.schoolId ? 'border border-red-400/60 ring-4 ring-red-500/20' : 'border border-white/10 focus:border-white/30 focus:bg-white/10 focus:ring-4 focus:ring-white/10'} rounded-full px-6 py-4 outline-none transition-all duration-300 placeholder:text-white/30 placeholder:italic shadow-inner`}
                  />
                </div>
                <AnimatePresence>
                  {errors.schoolId && <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-xs text-red-300 px-4 pt-1 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.schoolId}</motion.p>}
                </AnimatePresence>
              </div>

              {/* Password - BENTUK PILL (ROUNDED-FULL) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2">
                  <label className="block text-sm font-medium text-white/80 tracking-wide">Kata Sandi</label>
                  <button type="button" onClick={() => navigate('/lupa-password')} className="text-xs font-medium text-rose-500 hover:text-rose-400 transition-colors">Lupa sandi?</button>
                </div>
                <div className="relative group/input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    maxLength={12}
                    placeholder="••••••••••••••••"
                    className={`w-full bg-black/20 text-white ${errors.password ? 'border border-red-400/60 ring-4 ring-red-500/20' : 'border border-white/10 focus:border-white/30 focus:bg-white/10 focus:ring-4 focus:ring-white/10'} rounded-full px-6 py-4 outline-none transition-all duration-300 placeholder:text-white/30 pr-14 shadow-inner tracking-widest text-lg`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/20 hover:text-white transition-all backdrop-blur-md"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <AnimatePresence>
                  {errors.password && <motion.p initial={{opacity:0}} animate={{opacity:1}} className="text-xs text-red-300 px-4 pt-1 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.password}</motion.p>}
                </AnimatePresence>
              </div>

              {/* Submit Button - PILL & GLOWING */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={loading}
                className="w-full bg-white hover:bg-emerald-50 text-slate-900 font-bold text-[15px] py-4 rounded-full mt-4 flex items-center justify-center gap-3 transition-colors shadow-[0_10px_30px_rgba(255,255,255,0.2)]"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-slate-900/20 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="font-black text-xs uppercase tracking-[0.2em] ml-2">Masuk ke Dashboard</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Daftar Link - MODERN PILL */}
            <div className="mt-10 text-center">
              <button 
                onClick={() => navigate('/daftar')}
                className="relative inline-flex items-center gap-2 px-6 py-3 rounded-full bg-black/20 text-white hover:bg-white/10 transition-colors border border-white/5 text-sm font-medium backdrop-blur-md shadow-inner hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                <span>Daftar Akun Baru Sekarang</span>
              </button>
            </div>

          </div>

          {/* 1-CLICK ROLE LOGIN — panel terpisah, di luar card login */}
          <div className="mt-6 w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-white/15" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Login Cepat per Role</span>
              <div className="h-px flex-1 bg-white/15" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_LOGINS.map((role) => (
                <motion.button
                  key={role.schoolId}
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={loading}
                  onClick={() => handleQuickLogin(role)}
                  className={`text-left px-3 py-2.5 rounded-2xl bg-gradient-to-br ${role.color} text-white shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center ring-1 ring-white/10`}
                >
                  <span className="text-[12px] font-black leading-tight">{role.label}</span>
                </motion.button>
              ))}
            </div>
            <p className="mt-3 text-center text-[10px] text-white/45">
              1 klik langsung masuk dashboard role tsb. Data contoh tersimpan di browser (localStorage).
            </p>
          </div>
        </motion.div>
      </div>

      {/* MAINTENANCE OVERLAY — Surat Resmi */}
      <AnimatePresence>
        {systemStatus && systemStatus.type === 'maintenance' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />

            {/* Surat Resmi */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Header merah */}
              <div className="bg-red-600 px-8 py-5 flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-black uppercase tracking-widest text-sm">Pemberitahuan Sistem</span>
              </div>

              {/* Isi Surat */}
              <div className="px-10 py-8 space-y-6" style={{ fontFamily: 'Calibri, sans-serif' }}>
                {/* Judul surat */}
                <div className="space-y-1">
                  <p className="text-slate-900 font-bold text-xl">Kepada Pengguna Sekolah,</p>
                </div>

                {/* Isi paragraf */}
                <div className="text-slate-700 leading-relaxed text-lg space-y-4">
                  <p>
                    Kami memohon maaf atas ketidaknyamanan nya. Untuk saat ini, sistem sedang dalam proses maintenance.
                    Selama proses ini berjalan, silahkan lakukan kegiatan KBM secara offline dan membuat data laporan
                    secara digital atau fisik sebagai bukti KBM. Untuk keterangan lebih lanjut silahkan hubungi operator
                    sekolah. Jadwal maintenance kemungkinan diluar dari analisa kami, bisa lebih cepat atau lebih lama.
                    Silahkan login secara berkala atau hubungi operator sekolah. Terimakasih atas kesabaran dan
                    perhatian kalian semua.
                  </p>

                  {/* Estimasi Selesai */}
                  {systemStatus.estimatedEnd && (
                    <div className="flex items-center gap-2 text-red-600 font-bold">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Jadwal maintenance :{' '}
                        {new Date(systemStatus.estimatedEnd).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        })} WIB
                      </span>
                    </div>
                  )}
                  {!systemStatus.estimatedEnd && (
                    <p className="text-slate-500 italic">Jadwal maintenance : (jam yang ditentukan)</p>
                  )}
                </div>

                {/* Ttd */}
                <div className="text-right pt-2">
                  <p className="text-slate-900 font-bold text-lg">Super Admin - Operator</p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-10 pb-8">
                <button
                  onClick={() => setSystemStatus(null)}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl tracking-widest uppercase text-sm transition-all shadow-lg shadow-slate-200"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
