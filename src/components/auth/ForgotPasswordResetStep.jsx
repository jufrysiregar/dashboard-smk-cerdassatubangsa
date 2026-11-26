import { AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';

export default function ForgotPasswordResetStep({
  schoolId,
  email,
  newPassword,
  confirmPassword,
  showNewPassword,
  showConfirmPassword,
  loading,
  errors,
  passwordStrength,
  onChange,
  onSubmit,
  onToggleNewPassword,
  onToggleConfirmPassword
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-2xl border border-slate-200/10 bg-slate-800/40 px-4 py-3 backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-100">
          OTP Tervalidasi
        </p>
        <p className="mt-1 text-sm text-white/90">
          Sekarang Anda bisa membuat password baru untuk akun <span className="font-semibold">{schoolId}</span>.
        </p>
        <p className="mt-1 text-xs text-slate-300/70 break-all">
          Email akun: {email}
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-100 mb-2">
          Password Baru <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showNewPassword ? 'text' : 'password'}
            name="newPassword"
            value={newPassword}
            onChange={onChange}
            className={`w-full rounded-2xl border px-4 py-3.5 pr-12 text-white placeholder:text-slate-400 backdrop-blur-md transition-all duration-300 outline-none ${
              errors.newPassword
                ? 'border-rose-400/60 bg-rose-500/10 focus:border-rose-300 focus:ring-4 focus:ring-rose-400/15'
                : 'border-white/10 bg-slate-950/20 focus:border-teal-200/40 focus:ring-4 focus:ring-teal-200/10'
            }`}
            placeholder="Masukkan password baru"
            disabled={loading}
            maxLength={12}
            autoFocus
          />
          <button
            type="button"
            onClick={onToggleNewPassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300/60 hover:text-white transition-colors"
            disabled={loading}
          >
            {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errors.newPassword && (
          <p className="mt-2 text-sm text-rose-200 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.newPassword}
          </p>
        )}
        {passwordStrength && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-300/70">Kekuatan Password:</span>
              <span className="text-xs font-medium text-white">{passwordStrength.text}</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                style={{
                  width: passwordStrength.level === 'weak'
                    ? '33%'
                    : passwordStrength.level === 'medium'
                      ? '66%'
                      : '100%'
                }}
              />
            </div>
          </div>
        )}
        <p className="mt-1.5 text-xs text-slate-300/60">
          Min 8, Max 12 karakter. Huruf pertama wajib huruf besar.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-100 mb-2">
          Konfirmasi Password Baru <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirmPassword"
            value={confirmPassword}
            onChange={onChange}
            className={`w-full rounded-2xl border px-4 py-3.5 pr-12 text-white placeholder:text-slate-400 backdrop-blur-md transition-all duration-300 outline-none ${
              errors.confirmPassword
                ? 'border-rose-400/60 bg-rose-500/10 focus:border-rose-300 focus:ring-4 focus:ring-rose-400/15'
                : 'border-white/10 bg-slate-950/20 focus:border-teal-200/40 focus:ring-4 focus:ring-teal-200/10'
            }`}
            placeholder="Ulangi password baru"
            disabled={loading}
            maxLength={12}
          />
          <button
            type="button"
            onClick={onToggleConfirmPassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300/60 hover:text-white transition-colors"
            disabled={loading}
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="mt-2 text-sm text-rose-200 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.confirmPassword}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/10 bg-slate-800/40 p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-teal-100 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-100">
            <p className="font-semibold mb-1">Catatan Keamanan:</p>
            <p className="text-xs leading-5 text-slate-300/80">
              Setelah password diganti, seluruh sesi login lama akan dicabut. Jadi akun hanya bisa dipakai lagi dengan password baru.
            </p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl border border-slate-200/10 bg-gradient-to-r from-slate-100 via-teal-50 to-sky-100 px-6 py-3.5 font-semibold text-slate-950 shadow-[0_20px_40px_rgba(15,23,42,0.22)] transition-all duration-300 hover:shadow-[0_25px_55px_rgba(15,23,42,0.28)] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2 mt-6"
      >
        {loading ? (
          <>
            <div className="h-5 w-5 rounded-full border-2 border-slate-900/20 border-t-slate-900 animate-spin" />
            Menyimpan...
          </>
        ) : (
          <>
            <KeyRound className="w-5 h-5" />
            Simpan Password Baru
          </>
        )}
      </button>
    </form>
  );
}
