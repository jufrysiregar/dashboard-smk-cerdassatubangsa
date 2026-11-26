import { AlertCircle, Mail, SearchCheck, ShieldCheck } from 'lucide-react';

export default function ForgotPasswordRequestStep({
  schoolId,
  verifiedEmail,
  loading,
  errors,
  onChange,
  onVerifyUser,
  onSendOtp,
  onResetVerifiedUser
}) {
  const isVerified = Boolean(verifiedEmail);

  return (
    <div className="space-y-5">
      <form onSubmit={onVerifyUser} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-100 mb-2">
            ID Pengguna <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="schoolId"
            value={schoolId}
            onChange={onChange}
            className={`w-full rounded-2xl border px-4 py-3.5 text-white placeholder:text-slate-400 backdrop-blur-md transition-all duration-300 outline-none ${
              errors.schoolId
                ? 'border-rose-400/60 bg-rose-500/10 focus:border-rose-300 focus:ring-4 focus:ring-rose-400/15'
                : 'border-white/10 bg-slate-950/20 focus:border-teal-200/40 focus:ring-4 focus:ring-teal-200/10'
            }`}
            placeholder="Masukkan id anda"
            disabled={loading || isVerified}
            autoFocus={!isVerified}
          />
          {errors.schoolId && (
            <p className="mt-2 text-sm text-rose-200 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.schoolId}
            </p>
          )}
          <p className="mt-1.5 text-xs text-slate-300/60">
            Masukkan ID pengguna untuk menemukan email akun yang terdaftar di sistem.
          </p>
        </div>

        {!isVerified && (
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl border border-slate-200/10 bg-gradient-to-r from-slate-200 via-teal-100 to-sky-100 px-6 py-3.5 font-semibold text-slate-950 shadow-[0_20px_40px_rgba(15,23,42,0.22)] transition-all duration-300 hover:shadow-[0_25px_55px_rgba(15,23,42,0.28)] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 rounded-full border-2 border-slate-900/20 border-t-slate-900 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              <>
                <SearchCheck className="w-5 h-5" />
                Verifikasi Data
              </>
            )}
          </button>
        )}
      </form>

      {isVerified && (
        <>
          <div className="rounded-2xl border border-slate-200/10 bg-slate-800/40 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-teal-100 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-100 space-y-1">
                <p className="font-semibold">Email akun terverifikasi</p>
                <p className="text-base font-medium text-white break-all">{verifiedEmail}</p>
                <p className="text-xs leading-5 text-slate-300/80">
                  Jika data ini sudah benar, lanjutkan pengiriman OTP ke email tersebut.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/10 bg-slate-800/40 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-100 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-100 space-y-1">
                <p className="font-semibold">Lapisan keamanan ekstra</p>
                <p className="text-xs leading-5 text-slate-200/80">
                  OTP hanya dikirim ke email resmi akun yang sudah tersimpan di sistem sekolah. Form password baru baru akan terbuka setelah OTP valid.
                </p>
                <p className="text-xs leading-5 text-slate-300/80">
                  Batas kirim OTP: maksimal 3 kali dalam 1 jam, dan tiap kode hanya berlaku 5 menit.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onSendOtp}
              disabled={loading}
              className="flex-1 rounded-2xl border border-slate-200/10 bg-gradient-to-r from-slate-100 via-teal-50 to-sky-100 px-6 py-3.5 font-semibold text-slate-950 shadow-[0_20px_40px_rgba(15,23,42,0.22)] transition-all duration-300 hover:shadow-[0_25px_55px_rgba(15,23,42,0.28)] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 rounded-full border-2 border-slate-900/20 border-t-slate-900 animate-spin" />
                  Mengirim OTP...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  Send OTP
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onResetVerifiedUser}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-slate-900/20 px-5 py-3.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ganti ID
            </button>
          </div>
        </>
      )}
    </div>
  );
}
