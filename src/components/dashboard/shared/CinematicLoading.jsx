import React from 'react';
import { motion } from 'framer-motion';
import { Layout } from 'lucide-react';

const CinematicLoading = ({ 
  roleName = "Pusat Jurusan", 
  title = "Memuat Halaman Dashboard",
  icon = <Layout className="w-10 h-10 text-blue-600/40" />
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[80vh] flex flex-col items-center justify-center bg-gray-50/20"
    >
      <div className="relative flex flex-col items-center">
        {/* Cinematic Aura Backdrop */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute -inset-20 bg-blue-600/30 blur-[120px] rounded-full"
        />

        {/* Elegant Ring Animation */}
        <div className="relative w-28 h-28 mb-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-[1px] border-t-blue-600 border-b-blue-600 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 border-[1px] border-l-blue-400/20 border-r-blue-400/20 rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            {icon}
          </div>
        </div>

        {/* Cinematic Typography with Focus Transition */}
        <div className="text-center relative">
          <motion.h3 
            initial={{ opacity: 0, letterSpacing: "1em", filter: "blur(12px)" }}
            animate={{ opacity: 1, letterSpacing: "0.4em", filter: "blur(0px)" }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="text-xs font-black text-gray-900 uppercase tracking-[0.4em] mb-3"
          >
            {title}
          </motion.h3>
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "100%", opacity: 1 }}
            transition={{ delay: 0.5, duration: 1.5 }}
            className="h-[1px] bg-gradient-to-r from-transparent via-blue-600/50 to-transparent mb-3"
          />
          <p className="text-[9px] font-black text-blue-600/40 uppercase tracking-[0.6em] animate-pulse">
            {roleName}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default CinematicLoading;
