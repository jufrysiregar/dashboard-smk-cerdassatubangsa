import { AlertCircle,  ShieldCheck } from 'lucide-react';

export default function ForgotPasswordVerifyStep({
  schoolId,
  email,
  otp,
  loading,
  errors,
  onChange,
  onSubmit,
  onResendOtp,
  onChangeAccount
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-2xl border border-slate-200/10 bg-slate-800/40 px-4 py-3 backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
          OTP Terkirim Ke
        </p>
        <p className="mt-1 text-sm font-medium text-white break-all">{email}</p>
        <p className="mt-1 text-xs text-slate-300/70">
          ID pengguna: {schoolId}
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-100 mb-2">
          Masukkan Kode OTP <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="otp"
          value={otp}
          onChange={onChange}
          inputMode="numeric"
          className={`w-full rounded-2xl border px-4 py-3.5 text-center text-2xl tracking-[0.35em] text-white placeholder:text-slate-400 backdrop-blur-md transition-all duration-300 outline-none ${
            errors.otp
              ? 'border-rose-400/60 bg-rose-500/10 focus:border-rose-300 focus:ring-4 focus:ring-rose-400/15'
              : 'border-white/10 bg-slate-950/20 focus:border-teal-200/40 focus:ring-4 focus:ring-teal-200/10'
          }`}
          placeholder="000000"
          disabled={loading}
          autoFocus
        />
        {errors.otp && (
          <p className="mt-2 text-sm text-rose-200 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.otp}
          </p>
        )}
        <p className="mt-1.5 text-xs text-slate-300/60">
          Cek inbox atau folder spam email Anda. OTP salah maksimal 5 kali percobaan.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl border border-slate-200/10 bg-gradient-to-r from-slate-100 via-stone-100 to-teal-100 px-6 py-3.5 font-semibold text-slate-950 shadow-[0_20px_40px_rgba(15,23,42,0.22)] transition-all duration-300 hover:shadow-[0_25px_55px_rgba(15,23,42,0.28)] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2 mt-6"
      >
        {loading ? (
          <>
            <div className="h-5 w-5 rounded-full border-2 border-slate-900/20 border-t-slate-900 animate-spin" />
            Memverifikasi...
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5" />
            Verifikasi OTP
          </>
        )}
      </button>

      <div className="flex items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={onResendOtp}
          className="inline-flex items-center gap-2 text-teal-100 hover:text-white font-medium transition-colors"
          disabled={loading}
        >
          
          Kirim Ulang OTP
        </button>
        <button
          type="button"
          onClick={onChangeAccount}
          className="text-slate-300/80 hover:text-white transition-colors"
          disabled={loading}
        >
          Ganti ID
        </button>
      </div>
    </form>
  );
}
