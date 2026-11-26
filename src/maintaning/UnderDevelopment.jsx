import React from 'react';
import { motion } from 'framer-motion';
import { Hammer, Construction, Clock, Sparkles, LayoutDashboard } from 'lucide-react';
import GlassCard from '../components/dashboard/shared/GlassCard';

const UnderDevelopment = () => {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[80vh] w-full overflow-hidden">
      {/* Background Animated Orbs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
          x: [0, 50, 0],
          y: [0, -50, 0]
        }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-400 rounded-full blur-[120px] pointer-events-none"
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.05, 0.15, 0.05],
          x: [0, -30, 0],
          y: [0, 60, 0]
        }}
        transition={{ duration: 12, repeat: Infinity }}
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-rose-400 rounded-full blur-[150px] pointer-events-none"
      />

      <div className="relative z-10 p-8 text-center max-w-2xl mx-auto">
        {/* Cinematic Icon Container */}
        <div className="relative inline-block mb-10">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="relative z-20 w-32 h-32 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-100 flex items-center justify-center overflow-hidden"
          >
            {/* Inner Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50/50 to-transparent" />
            
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 0],
                y: [0, -5, 0]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative z-10 text-indigo-600"
            >
              <Construction size={56} strokeWidth={1.5} />
            </motion.div>

            {/* Shine Effect */}
            <motion.div 
              animate={{ x: ['-200%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
            />
          </motion.div>

          {/* Floating Decorative Elements */}
          <motion.div 
            animate={{ y: [0, -15, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute -top-4 -right-4 w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-lg border border-white"
          >
            <Hammer size={24} />
          </motion.div>
          
          <motion.div 
            animate={{ y: [0, 15, 0], rotate: [0, -15, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
            className="absolute -bottom-2 -left-6 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-xl border-2 border-white"
          >
            <Sparkles size={20} />
          </motion.div>
        </div>

        {/* Text Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-100 bg-indigo-50/50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            <LayoutDashboard className="w-3 h-3" /> System Module Status: Processing
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-slate-950 tracking-tight leading-[1.1]">
            Modul Sedang <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-rose-500">
              Dikembangkan
            </span>
          </h1>
          
          <p className="text-slate-500 text-base md:text-lg font-medium leading-relaxed max-w-lg mx-auto">
            Kami sedang merancang pengalaman terbaik untuk fitur ini. Tunggu kejutan menarik di pembaruan sistem berikutnya!
          </p>
        </motion.div>

        {/* Progress Indicators */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-6"
        >
          <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white shadow-sm transition-all hover:shadow-md">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} className="text-slate-400" /> Tahap Desain & UI
            </span>
          </div>
          
          <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white shadow-sm transition-all hover:shadow-md">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <Hammer size={14} className="text-slate-400" /> Integrasi Backend
            </span>
          </div>
        </motion.div>

        {/* Bottom Decorative Line */}
        <div className="mt-16 w-24 h-1.5 bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full mx-auto opacity-20" />
      </div>

      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
    </div>
  );
};

export default UnderDevelopment;
