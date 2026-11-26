import React from 'react';
import { Moon, Clock, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const SleepModePage = () => {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 overflow-hidden">
      {/* Animated Background Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.1 }}
            animate={{ opacity: [0.1, 0.5, 0.1] }}
            transition={{ duration: Math.random() * 3 + 2, repeat: Infinity }}
            className="absolute bg-white rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 3}px`,
              height: `${Math.random() * 3}px`,
            }}
          />
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white/5 backdrop-blur-xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 text-white"
      >
        <div className="p-12 text-center space-y-10 relative z-10">
          <div className="relative inline-block">
            <div className="w-32 h-32 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/20 border border-blue-500/30">
              <Moon className="w-16 h-16 text-blue-400" />
            </div>
            <motion.div 
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -top-4 -right-4 text-4xl"
            >
              💤
            </motion.div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight uppercase">System is Sleeping</h1>
            <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-md mx-auto">
              Sistem sedang dalam mode tidur. Silakan akses kembali pada jam operasional.
            </p>
          </div>

          <div className="p-8 bg-white/5 rounded-3xl border border-white/5 space-y-6">
            <div className="flex items-center justify-center gap-4 text-slate-300">
              <Clock className="w-6 h-6 text-blue-400" />
              <span className="font-bold tracking-widest uppercase">Jam Operasional Aktif</span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">Hemat energi &amp; Keamanan data optimal</p>
          </div>

          <div className="pt-4">
            <button 
              onClick={() => window.location.href = '/'}
              className="px-10 py-5 bg-white text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl shadow-white/10"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>

        <div className="bg-white/5 p-6 border-t border-white/5 flex items-center justify-center gap-3">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sistem Keamanan Berlapis Aktif</span>
        </div>
      </motion.div>
    </div>
  );
};

export default SleepModePage;
