import React from 'react';
import { motion } from 'framer-motion';

const RoleBadge = ({ role }) => {
  const getRoleStyle = (role) => {
    switch (role?.toLowerCase()) {
      case 'murid': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'guru': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'admin_akademik': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getRoleStyle(role)}`}>
      {role?.replace('_', ' ')}
    </span>
  );
};

export default RoleBadge;
