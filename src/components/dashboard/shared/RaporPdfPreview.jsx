import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';
import ModalCloseControl from './ModalCloseControl';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';

/**
 * Pratinjau rapor PDF di layar (iframe, viewer bawaan browser) dengan tombol
 * unduh terpisah — download TIDAK otomatis jalan saat tombol pratinjau diklik.
 *
 * Pemakaian:
 *   const [preview, setPreview] = useState(null); // { url, filename }
 *   const p = await previewRaporPDF({...}); setPreview(p);
 *   <RaporPdfPreview state={preview} onClose={() => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); }} />
 */
export default function RaporPdfPreview({ state, onClose, title = 'Pratinjau Rapor PDF', downloadLabel = 'Unduh Rapor PDF' }) {
  const open = !!state;

  useEscapeKey(open, onClose);
  useBodyScrollLock(open);

  const handleDownload = () => {
    if (!state?.url) return;
    const a = document.createElement('a');
    a.href = state.url;
    a.download = state.filename || 'Rapor.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-2xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100"
          >
            {/* Header: hanya judul teks (house-style) */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-black text-slate-800">{title}</h3>
              <ModalCloseControl onClose={onClose} />
            </div>

            {/* Viewer */}
            <div className="flex-1 bg-slate-100">
              <iframe
                title="Pratinjau Rapor PDF"
                src={state.url}
                className="h-full w-full border-0"
              />
            </div>

            {/* Footer terpisah: 1 tombol primer full-width (house-style) */}
            <div className="shrink-0 border-t border-slate-100 bg-[#F1F5F9] px-6 py-4">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-700 py-3 text-sm font-black text-white transition-all hover:bg-emerald-800 active:scale-[0.99] shadow-md shadow-emerald-600/20"
              >
                <Download size={16} />
                {downloadLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
