import React from 'react';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * SectionLoading — komponen loading/error state seragam untuk semua menu
 * Kepala Sekolah & Wakil Kepala Sekolah.
 *
 * Props:
 *  - loading   : boolean
 *  - error     : string | null
 *  - onRetry   : function — dipanggil saat tombol "Coba Lagi" diklik
 *  - label     : string — teks di bawah spinner, misal "Memuat data akademik..."
 */
const SectionLoading = ({ loading = false, error = null, onRetry, label = 'Memuat data...' }) => {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center h-96"
      >
        <div className="flex flex-col items-center gap-5">
          {/* Spinner cincin ganda */}
          <div className="relative w-16 h-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-2 rounded-full border-2 border-transparent border-b-blue-300"
            />
          </div>

          {/* Label */}
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm font-bold text-slate-500 tracking-wide"
          >
            {label}
          </motion.p>

          {/* Garis animasi */}
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 120, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"
          />
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center h-96"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          <p className="text-slate-700 font-bold max-w-xs">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-colors"
            >
              Coba Lagi
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return null;
};

export default SectionLoading;
