import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, BadgeCheck, ArrowRight, Loader2 } from 'lucide-react';

/**
 * Pop-up kejutan satu-kali-tampil saat pegawai Magang/Honorer dipromosikan
 * menjadi pegawai tetap. Desain: slate/navy gelap + aksen emas (amber) + emerald,
 * berwibawa & profesional (bukan warna-warni kekanak-kanakan).
 */
const PromotionSurpriseModal = ({ celebration, onAcknowledge }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!celebration) return null;

  const ROLE_LABELS = { guru: 'Guru', cashier: 'Kasir', kasir: 'Kasir', admin_akademik: 'Admin Akademik', pusat_jurusan: 'Pusat Jurusan', kepala_sekolah: 'Kepala Sekolah', wakil_sekolah: 'Wakil Kepala Sekolah', operator: 'Super Admin', magang_honor: 'Magang & Honorer' };
  const STATUS_LABELS = { honorer: 'Honorer', magang: 'Magang', tetap: 'Tetap' };
  const roleLabel = (r) => ROLE_LABELS[r] || r || '';

  const prevStatus = STATUS_LABELS[celebration.previous_status] || '';
  const previousLabel = celebration.previous_role === 'magang_honor'
    ? 'Magang & Honorer'
    : [roleLabel(celebration.previous_role), prevStatus].filter(Boolean).join(' ');
  const newLabel = celebration.new_role_label || roleLabel(celebration.new_role) || 'Pegawai Tetap';
  const categoryLabel = celebration.staff_category === 'kontrak' ? 'Pegawai Kontrak' : 'Pegawai Tetap';
  const message = celebration.custom_message
    || `Terima kasih atas dedikasi Anda selama masa ${previousLabel || 'mengabdi'}. Selamat atas pengangkatan sebagai ${newLabel} (${categoryLabel}). Ruang kerja dan hak akses Anda sudah aktif sepenuhnya.`;

  const handleStart = async () => {
    setIsSubmitting(true);
    try {
      await onAcknowledge?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />

      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[2.5rem] border border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.7)]">
        {/* Aksen emas atas */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-600" />
        {/* Glow dekoratif */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-9 pt-10">
          <div className="flex items-center justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-300 shadow-inner">
              <Sparkles className="h-8 w-8" />
            </div>
          </div>

          <p className="text-center text-[11px] font-black uppercase tracking-[0.35em] text-amber-400/80">Selamat &amp; Sukses</p>
          <h2 className="mt-2 text-center text-[26px] font-black leading-tight tracking-tight text-white">
            Anda Resmi Dipromosikan
          </h2>

          {/* Lencana transisi jabatan */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-[12px] font-bold text-slate-300">
              {previousLabel}
            </span>
            <ArrowRight className="h-5 w-5 text-amber-400" />
            <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-[12px] font-black uppercase tracking-wide text-slate-900 shadow-md">
              <BadgeCheck className="h-4 w-4" />
              {newLabel} — {categoryLabel}
            </span>
          </div>

          {/* Apresiasi */}
          <div className="mt-7 rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5">
            <p className="text-[13px] leading-relaxed text-slate-200 font-medium">{message}</p>
          </div>

          <p className="mt-5 text-center text-[12px] font-semibold text-emerald-400">
            Ruang kerja &amp; seluruh menu baru Anda sudah aktif sepenuhnya.
          </p>

          <button
            type="button"
            onClick={handleStart}
            disabled={isSubmitting}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-700 px-6 py-4 text-[12px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-emerald-900/40 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Mulai di Ruang Kerja Baru <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PromotionSurpriseModal;
