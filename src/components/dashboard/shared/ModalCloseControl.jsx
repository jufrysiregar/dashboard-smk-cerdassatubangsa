import { X } from 'lucide-react';

/**
 * Kontrol tutup modal seragam (house-style).
 * - "Esc" = teks statis saja (penanda pintasan keyboard, bukan tombol).
 * - "X"   = tombol BULAT & besar; jadi MERAH saat hover/klik; klik menutup modal.
 * Pintasan keyboard Escape ditangani terpisah (useEscapeKey / handler masing-masing modal).
 *
 * tone="onDark" dipakai untuk modal ber-header gelap/berwarna (gradien amber→oranye)
 * supaya default "Esc" & "X" putih dan tetap terbaca. Default (light) tidak berubah.
 */
export default function ModalCloseControl({ onClose, tone = 'light' }) {
  const onDark = tone === 'onDark';
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span className={`select-none text-[13px] tracking-wide ${onDark ? 'font-black text-white' : 'font-bold text-slate-400'}`}>Esc</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup (Esc)"
        className={`grid h-9 w-9 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${
          onDark
            ? 'bg-white/15 text-white hover:bg-rose-600 hover:text-white active:bg-rose-700'
            : 'bg-slate-100 text-slate-500 hover:bg-rose-600 hover:text-white active:bg-rose-700'
        }`}
      >
        <X size={22} strokeWidth={2.5} />
      </button>
    </div>
  );
}
