import React from 'react';
import { ShieldCheck } from 'lucide-react';
import GlassCard from './GlassCard';

const DashboardSectionCard = ({
  title,
  description,
  onSync,
  syncing = false,
  children,
  className = "",
  showBadge = true,
  badgeText = "SUPER ADMIN - OPERATOR",
  showSync = true
}) => (
  <GlassCard className={`relative overflow-hidden border-none shadow-2xl bg-white ${className}`}>
    {/* Cinematic Shimmer Effect */}
    {syncing && <div className="shimmer-overlay" />}
    
    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
    
    <div className="relative flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex-1 md:pr-48 text-left">
          {showBadge && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
               <ShieldCheck className="w-3 h-3" /> {badgeText}
            </div>
          )}
          <h4 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">{title}</h4>
          <p className="mt-3 text-base font-medium leading-relaxed text-slate-500">{description}</p>
        </div>
        
        {showSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="md:absolute md:top-10 md:right-10 inline-flex items-center gap-3 rounded-2xl bg-indigo-600 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-700 hover:scale-[1.05] active:scale-95 shadow-2xl shadow-indigo-100 disabled:opacity-50 disabled:hover:scale-100 group"
          >
            Sinkronkan Data
          </button>
        )}
      </div>

      
      {children && <div className="mt-4">{children}</div>}
    </div>
  </GlassCard>
);

export default DashboardSectionCard;
