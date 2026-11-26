import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Konfirmasi hapus/aksi destruktif IN-APP (bukan window.confirm bawaan browser),
 * karena aplikasi jalan di LAN — dialog native browser terlihat kaku & tidak seragam.
 *
 * Pemakaian:
 *   const [confirm, setConfirm] = useState(null);
 *   setConfirm({ title, message, confirmLabel, onConfirm });
 *   <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
 */
export default function ConfirmDialog({ state, onClose }) {
  const open = !!state;

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const {
    title = 'Konfirmasi',
    message = '',
    confirmLabel = 'Ya, Hapus',
    cancelLabel = 'Batal',
    danger = true,
    loading = false,
    confirmClassName,
    onConfirm,
  } = state;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md"
        onMouseDown={(e) => e.target === e.currentTarget && !loading && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }}
          className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 px-6 py-4">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-indigo-500/30 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${danger ? 'bg-rose-500/15 ring-rose-300/30' : 'bg-white/10 ring-white/15'}`}>
                <AlertTriangle className={`h-5 w-5 ${danger ? 'text-rose-300' : 'text-indigo-200'}`} />
              </span>
              <h3 className="text-lg font-black text-white">{title}</h3>
            </div>
          </div>

          <div className="p-6">
            <p className="text-sm font-semibold leading-7 text-slate-600">{message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60">
                {cancelLabel}
              </button>
              <button type="button" onClick={onConfirm} disabled={loading}
                className={confirmClassName
                  ? `inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-colors disabled:opacity-60 ${confirmClassName}`
                  : `inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 disabled:opacity-60 ${danger ? 'bg-gradient-to-r from-rose-600 to-red-600 shadow-rose-500/25' : 'bg-gradient-to-r from-indigo-600 to-blue-600 shadow-indigo-500/25'}`}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {confirmLabel}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
