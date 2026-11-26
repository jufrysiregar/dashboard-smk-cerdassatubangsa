import React from 'react';
import { Settings, Clock, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const MaintenancePage = () => {
  const data = JSON.parse(sessionStorage.getItem('maintenance_data') || '{}');
  const message = data.message || 'Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti.';
  const estimatedEnd = data.estimated_end ? new Date(data.estimated_end).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
      >
        <div className="bg-red-600 p-12 text-white text-center relative overflow-hidden">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl"
          />
          <div className="relative z-10">
            <div className="w-24 h-24 bg-white/20 rounded-3xl backdrop-blur-md flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Settings className="w-12 h-12 text-white animate-spin-slow" />
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-2 uppercase">System Maintenance</h1>
            <div className="h-1.5 w-24 bg-white/40 rounded-full mx-auto" />
          </div>
        </div>

        <div className="p-12 text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Mohon Maaf Atas Ketidaknyamanannya</h2>
            <p className="text-slate-500 font-medium leading-relaxed">
              {message}
            </p>
          </div>

          {estimatedEnd && (
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-red-50 rounded-2xl border border-red-100 text-red-600">
              <Clock className="w-5 h-5" />
              <span className="font-bold">Estimasi Selesai: {estimatedEnd}</span>
            </div>
          )}

          <div className="pt-4 flex flex-col items-center gap-4">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Tim IT SekolahKU</p>
            <button 
              onClick={() => window.location.href = '/'}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
            >
              Coba Lagi Nanti
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-6 border-t border-slate-100 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emergency System Level 4 Protocol Active</span>
        </div>
      </motion.div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}} />
    </div>
  );
};

export default MaintenancePage;
